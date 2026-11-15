// Runs the whole demo against the live project, signed in as real users (no secret key),
// and checks the rules that matter: the lead appears only when the quote is accepted, and
// the address stays hidden from the company until then.
//
// Needs the demo data (npm run seed) and the phone test numbers set in the dashboard.
// Each run posts one new job as the first demo customer, and customers are limited to 5
// jobs an hour, so after a couple of runs that customer is rate-limited. Re-run the seed
// (npm run seed) afterwards to clear the demo jobs and start fresh.
//
//   cd supabase && npm run demo
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SEED_PASSWORD } = process.env;
if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY || !SEED_PASSWORD) {
  console.error('Set SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY and SEED_PASSWORD in supabase/.env');
  process.exit(1);
}

const CUSTOMER_PHONE = '61400000001';
const TEST_CODE = '123456';
const COMPANY_EMAIL = 'integrator@findafixer.test';
const ADDRESS = '7 Demo Script Lane';

const url: string = SUPABASE_URL;
const publishableKey: string = SUPABASE_PUBLISHABLE_KEY;
const password: string = SEED_PASSWORD;

const newClient = (): SupabaseClient =>
  createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

let stepNumber = 0;
function pass(message: string): void {
  stepNumber += 1;
  console.log(`  ok ${String(stepNumber).padStart(2)}  ${message}`);
}

function ok(error: { message: string } | null, step: string): void {
  if (error) throw new Error(`${step}: ${error.message}`);
}

async function rowCount(client: SupabaseClient, table: string, column: string, value: string): Promise<number> {
  const { count, error } = await client.from(table).select('*', { count: 'exact', head: true }).eq(column, value);
  ok(error, `count ${table}`);
  return count ?? 0;
}

async function main(): Promise<void> {
  console.log(`Demo run against ${SUPABASE_URL}`);

  // --- Customer signs in with the test number ---
  const customer = newClient();
  ok((await customer.auth.signInWithOtp({ phone: CUSTOMER_PHONE })).error, 'request code');
  const verified = await customer.auth.verifyOtp({ phone: CUSTOMER_PHONE, token: TEST_CODE, type: 'sms' });
  ok(verified.error, 'verify code');
  const customerId = verified.data.user?.id;
  assert.ok(customerId, 'customer signed in');
  pass(`customer signed in with test number +${CUSTOMER_PHONE}`);

  // --- Company signs in ---
  const company = newClient();
  const login = await company.auth.signInWithPassword({ email: COMPANY_EMAIL, password });
  ok(login.error, 'company login');
  const companyUserId = login.data.user?.id;
  assert.ok(companyUserId, 'company signed in');
  const companyRow = await company.from('companies').select('id, name').eq('owner_id', companyUserId).single();
  ok(companyRow.error, 'load company');
  const companyId = (companyRow.data as { id: string; name: string }).id;
  pass(`company signed in: ${(companyRow.data as { name: string }).name}`);

  // --- Customer posts a job ---
  const jobId = randomUUID();
  const title = `Demo script: ceiling light flickers ${new Date().toISOString().slice(11, 19)}`;
  ok(
    (
      await customer.rpc('post_job', {
        p_id: jobId,
        p_category: 'electrical',
        p_title: title,
        p_description: 'Lounge ceiling light flickers when the fan is on. Posted by the demo script.',
        p_suburb: 'Casuarina',
        p_address: ADDRESS,
        p_urgency: 'this_week',
        p_media: [],
      })
    ).error,
    'post job',
  );
  pass(`customer posted "${title}"`);

  assert.equal(await rowCount(company, 'jobs', 'id', jobId), 1, 'company sees the job in its feed');
  assert.equal(await rowCount(company, 'job_private', 'job_id', jobId), 0, 'address hidden before accepting');
  pass('company sees the job in its feed; address and phone hidden');

  const earlyMessage = await company.from('messages').insert({ job_id: jobId, sender_id: companyUserId, body: 'Too early' });
  assert.ok(earlyMessage.error, 'chat is closed before a company accepts');
  pass('chat is closed before the job is accepted');

  // --- Company accepts the job: no lead yet ---
  ok((await company.rpc('accept_job', { p_job_id: jobId })).error, 'accept job');
  assert.equal(await rowCount(company, 'leads', 'job_id', jobId), 0, 'no lead after accepting the job');
  assert.equal(await rowCount(company, 'job_private', 'job_id', jobId), 0, 'address hidden after accepting');
  pass('company accepted the job: NO lead yet, address still hidden');

  // --- Chat is open from acceptance ---
  ok((await customer.from('messages').insert({ job_id: jobId, sender_id: customerId, body: 'Hi, when could you come?' })).error, 'customer message');
  ok((await company.from('messages').insert({ job_id: jobId, sender_id: companyUserId, body: 'Thursday morning. Quote on its way.' })).error, 'company message');
  assert.equal(await rowCount(customer, 'messages', 'job_id', jobId), 2);
  assert.equal(await rowCount(company, 'messages', 'job_id', jobId), 2);
  pass('both sides sent a chat message and each sees both');

  const foreignPhoto = await customer
    .from('messages')
    .insert({ job_id: jobId, sender_id: customerId, media_path: `${randomUUID()}/${customerId}/photo.jpg` });
  assert.ok(foreignPhoto.error, 'photo path outside this job is refused');
  pass('a chat photo path from another job folder is refused');

  // --- Company sends a quote: still no lead ---
  const quote = await company.rpc('send_quote', {
    p_job_id: jobId,
    p_amount_cents: 16500,
    p_notes: 'Replace the dimmer and check the wiring.',
    p_proposed_time: new Date(Date.now() + 3 * 86_400_000).toISOString(),
  });
  ok(quote.error, 'send quote');
  const quoteId = quote.data as string;
  assert.equal(await rowCount(company, 'leads', 'job_id', jobId), 0, 'no lead while the quote is pending');
  assert.equal(await rowCount(company, 'job_private', 'job_id', jobId), 0, 'address hidden while the quote is pending');
  pass('company sent a $165.00 quote: NO lead yet, address still hidden');

  // --- Customer accepts the quote: lead created, address released ---
  ok((await customer.rpc('respond_to_quote', { p_quote_id: quoteId, p_accept: true })).error, 'accept quote');
  const leads = await company.from('leads').select('company_id, counted').eq('job_id', jobId);
  ok(leads.error, 'read leads');
  assert.deepEqual(leads.data, [{ company_id: companyId, counted: true }], 'exactly one lead, for this company');
  pass('customer accepted the quote: exactly ONE lead now exists for the company');

  const contact = await company.from('job_private').select('address, contact_phone').eq('job_id', jobId);
  ok(contact.error, 'read contact');
  assert.deepEqual(contact.data, [{ address: ADDRESS, contact_phone: `+${CUSTOMER_PHONE}` }]);
  pass('company can now see the address and phone');

  const job = await customer.from('jobs').select('status').eq('id', jobId).single();
  ok(job.error, 'read job');
  assert.equal((job.data as { status: string }).status, 'scheduled');
  pass('job is Scheduled');

  // --- Chat still open after the quote is accepted ---
  ok((await customer.from('messages').insert({ job_id: jobId, sender_id: customerId, body: 'Great, see you Thursday.' })).error, 'customer message 2');
  ok((await company.from('messages').insert({ job_id: jobId, sender_id: companyUserId, body: 'See you then.' })).error, 'company message 2');
  assert.equal(await rowCount(company, 'messages', 'job_id', jobId), 4);
  pass('chat still works after the quote is accepted (4 messages)');

  await Promise.all([customer.auth.signOut(), company.auth.signOut()]);
  console.log(`\nAll ${stepNumber} steps passed.`);
}

main().catch((error: unknown) => {
  console.error(`\nFAILED after step ${stepNumber}: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
