// Supabase Edge Function: turns database changes into Expo push notifications.
//
// Wire it up with Database Webhooks (Dashboard -> Integrations -> Webhooks), one each for:
//   jobs INSERT + UPDATE, quotes INSERT + UPDATE, messages INSERT
// pointing at this function, with an HTTP header  x-webhook-secret: <PUSH_WEBHOOK_SECRET>.
// Set the same value with:  supabase secrets set PUSH_WEBHOOK_SECRET=...
//
// Runs on Deno inside Supabase, where the service key is available server-side only.
import { createClient } from 'npm:@supabase/supabase-js@2';

interface WebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  record: Record<string, unknown> | null;
  old_record: Record<string, unknown> | null;
}

interface Notice {
  userIds: string[];
  title: string;
  body: string;
  jobId: string;
}

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const MAX_COMPANIES_NOTIFIED = 200;

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

async function jobParties(jobId: string): Promise<{ customerId: string; companyOwnerId: string | null; title: string } | null> {
  const { data: job } = await db.from('jobs').select('customer_id, company_id, title').eq('id', jobId).maybeSingle();
  if (!job) return null;
  let companyOwnerId: string | null = null;
  if (job.company_id) {
    const { data: company } = await db.from('companies').select('owner_id').eq('id', job.company_id).maybeSingle();
    companyOwnerId = company?.owner_id ?? null;
  }
  return { customerId: job.customer_id, companyOwnerId, title: job.title };
}

/** Decides who to tell, and what, for one database change. Null means nobody. */
async function buildNotice({ type, table, record, old_record }: WebhookPayload): Promise<Notice | null> {
  if (!record) return null;

  if (table === 'jobs' && type === 'INSERT') {
    const { data: companies } = await db
      .from('companies')
      .select('owner_id')
      .eq('status', 'approved')
      .contains('trades', [record.category])
      .contains('service_areas', [record.suburb])
      .limit(MAX_COMPANIES_NOTIFIED);
    return {
      userIds: (companies ?? []).map((company) => company.owner_id as string),
      title: 'New job in your area',
      body: `${record.title} · ${record.suburb}`,
      jobId: record.id as string,
    };
  }

  if (table === 'jobs' && type === 'UPDATE' && record.status !== old_record?.status) {
    const messages: Record<string, string> = {
      accepted: 'A company has taken your job.',
      completed: 'Your job has been marked as completed.',
    };
    const body = messages[record.status as string];
    return body
      ? { userIds: [record.customer_id as string], title: record.title as string, body, jobId: record.id as string }
      : null;
  }

  const jobId = record.job_id as string | undefined;
  if (!jobId) return null;
  const parties = await jobParties(jobId);
  if (!parties) return null;

  if (table === 'quotes' && type === 'INSERT') {
    return { userIds: [parties.customerId], title: parties.title, body: 'You have a new quote.', jobId };
  }
  if (table === 'quotes' && type === 'UPDATE' && record.status !== old_record?.status && parties.companyOwnerId) {
    const body = record.status === 'accepted' ? 'Your quote was accepted.' : 'Your quote was declined.';
    return { userIds: [parties.companyOwnerId], title: parties.title, body, jobId };
  }
  if (table === 'messages' && type === 'INSERT') {
    const recipient = record.sender_id === parties.customerId ? parties.companyOwnerId : parties.customerId;
    // The message text is left out so nothing private shows on a lock screen.
    return recipient ? { userIds: [recipient], title: parties.title, body: 'New message', jobId } : null;
  }
  return null;
}

Deno.serve(async (request) => {
  const secret = Deno.env.get('PUSH_WEBHOOK_SECRET');
  if (!secret || request.headers.get('x-webhook-secret') !== secret) {
    return new Response('Forbidden', { status: 403 });
  }

  const notice = await buildNotice((await request.json()) as WebhookPayload);
  if (!notice || notice.userIds.length === 0) return Response.json({ sent: 0 });

  const { data: tokens } = await db.from('push_tokens').select('token').in('user_id', notice.userIds);
  const messages = (tokens ?? []).map(({ token }) => ({
    to: token,
    title: notice.title,
    body: notice.body,
    data: { jobId: notice.jobId },
  }));
  if (messages.length === 0) return Response.json({ sent: 0 });

  const response = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(messages),
  });
  return Response.json({ sent: messages.length, expoStatus: response.status });
});
