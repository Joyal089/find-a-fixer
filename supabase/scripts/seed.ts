// Seeds demo data: 1 admin, 3 approved companies, 2 customers and 5 jobs at different
// stages, so the whole demo flow can be shown straight away.
//
// Runs on your computer with the secret key (never in the app). Safe to re-run: it
// removes the previous demo accounts first, and everything they own goes with them.
//
//   cd supabase && cp .env.example .env   (fill it in)
//   npm run seed
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const { SUPABASE_URL, SUPABASE_SECRET_KEY, SEED_PASSWORD } = process.env;
if (!SUPABASE_URL || !SUPABASE_SECRET_KEY || !SEED_PASSWORD || SEED_PASSWORD.length < 10) {
  console.error('Set SUPABASE_URL, SUPABASE_SECRET_KEY and SEED_PASSWORD (10+ characters) in supabase/.env');
  process.exit(1);
}

const db: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const ADMIN_EMAIL = 'admin@findafixer.test';

// Placeholder details: edit the trades, areas and licence numbers to match the real
// companies before showing this to them.
const COMPANIES = [
  {
    email: 'integrator@findafixer.test',
    name: 'Integrator Solutions',
    licence: 'DEMO-0001',
    trades: ['electrical', 'air_conditioning', 'handyman'],
    areas: ['Casuarina', 'Leanyer', 'Nightcliff', 'Rapid Creek', 'Darwin City', 'Parap'],
  },
  {
    email: 'plumbing@findafixer.test',
    name: 'Top End Plumbing (demo)',
    licence: 'DEMO-0002',
    trades: ['plumbing'],
    areas: ['Casuarina', 'Leanyer', 'Karama', 'Malak', 'Palmerston'],
  },
  {
    email: 'builders@findafixer.test',
    name: 'Darwin Build & Repair (demo)',
    licence: 'DEMO-0003',
    trades: ['construction', 'carpentry', 'painting', 'roofing'],
    areas: ['Darwin City', 'Stuart Park', 'Fannie Bay', 'Parap', 'Winnellie'],
  },
] as const;

// Add these as test numbers in Supabase (Authentication -> Sign In / Providers -> Phone)
// with a fixed code such as 123456, so the demo needs no real SMS.
const CUSTOMER_PHONES = ['61400000001', '61400000002'] as const;

type Result = { data: unknown; error: { message: string } | null };
type SuccessData<R extends Result> = NonNullable<Extract<R, { error: null }>['data']>;

/** Unwraps a Supabase result, stopping the script with a clear message on any failure. */
function must<R extends Result>(result: R, step: string): SuccessData<R> {
  if (result.error || result.data === null || result.data === undefined) {
    throw new Error(`${step}: ${result.error?.message ?? 'no data returned'}`);
  }
  return result.data as SuccessData<R>;
}

async function removeOldDemoAccounts(): Promise<void> {
  const emails = new Set<string>([ADMIN_EMAIL, ...COMPANIES.map((company) => company.email)]);
  const phones = new Set<string>(CUSTOMER_PHONES);
  const { users } = must(await db.auth.admin.listUsers({ page: 1, perPage: 1000 }), 'list users');
  for (const user of users) {
    if ((user.email && emails.has(user.email)) || (user.phone && phones.has(user.phone))) {
      must(await db.auth.admin.deleteUser(user.id), `delete ${user.email ?? user.phone}`);
    }
  }
}

async function createEmailUser(email: string): Promise<string> {
  const created = must(
    await db.auth.admin.createUser({ email, password: SEED_PASSWORD, email_confirm: true }),
    `create ${email}`,
  );
  return created.user.id;
}

async function createCustomer(phone: string): Promise<string> {
  const created = must(await db.auth.admin.createUser({ phone, phone_confirm: true }), `create ${phone}`);
  return created.user.id;
}

async function createCompany(company: (typeof COMPANIES)[number]): Promise<string> {
  const ownerId = await createEmailUser(company.email);
  const row = must(
    await db
      .from('companies')
      .insert({
        owner_id: ownerId,
        name: company.name,
        licence_number: company.licence,
        insurance_provider: 'Demo Insurance',
        insurance_expiry: '2027-12-31',
        trades: [...company.trades],
        service_areas: [...company.areas],
        status: 'approved',
        approved_at: new Date().toISOString(),
      })
      .select('id')
      .single(),
    `insert company ${company.name}`,
  );
  must(
    await db.from('profiles').update({ role: 'company', display_name: company.name }).eq('id', ownerId).select('id'),
    `set role for ${company.name}`,
  );
  return (row as { id: string }).id;
}

interface SeedJob {
  customerId: string;
  category: string;
  title: string;
  description: string;
  suburb: string;
  address: string;
  urgency: 'emergency' | 'this_week' | 'flexible';
}

async function createJob(job: SeedJob, phone: string): Promise<string> {
  const row = must(
    await db
      .from('jobs')
      .insert({
        customer_id: job.customerId,
        category: job.category,
        title: job.title,
        description: job.description,
        suburb: job.suburb,
        urgency: job.urgency,
      })
      .select('id')
      .single(),
    `insert job ${job.title}`,
  );
  const jobId = (row as { id: string }).id;
  must(
    await db.from('job_private').insert({ job_id: jobId, address: job.address, contact_phone: `+${phone}` }).select('job_id'),
    `insert address for ${job.title}`,
  );
  return jobId;
}

/** Mirrors accept_job(): the job moves to accepted and the lead is logged. */
async function acceptAs(companyId: string, jobId: string): Promise<void> {
  must(
    await db.from('jobs').update({ status: 'accepted', company_id: companyId, accepted_at: new Date().toISOString() }).eq('id', jobId).select('id'),
    'accept job',
  );
  must(await db.from('leads').insert({ job_id: jobId, company_id: companyId }).select('id'), 'log lead');
}

const daysFromNow = (days: number): string => new Date(Date.now() + days * 86_400_000).toISOString();

async function main(): Promise<void> {
  await removeOldDemoAccounts();

  const adminId = await createEmailUser(ADMIN_EMAIL);
  must(await db.from('profiles').update({ role: 'admin', display_name: 'Admin' }).eq('id', adminId).select('id'), 'set admin role');

  const [integratorId, plumbingId] = await Promise.all(COMPANIES.map(createCompany));
  const [customerOne, customerTwo] = await Promise.all(CUSTOMER_PHONES.map(createCustomer));
  if (!integratorId || !plumbingId || !customerOne || !customerTwo) throw new Error('seed accounts missing');
  const [phoneOne, phoneTwo] = CUSTOMER_PHONES;

  // Three open jobs for the feeds.
  await createJob({ customerId: customerOne, category: 'electrical', title: 'Power point not working', description: 'Two power points in the kitchen stopped working after the storm.', suburb: 'Leanyer', address: '4 Demo Street', urgency: 'this_week' }, phoneOne);
  await createJob({ customerId: customerTwo, category: 'air_conditioning', title: 'Split system leaking water', description: 'Bedroom split system drips water inside when it runs for more than an hour.', suburb: 'Nightcliff', address: '9 Sample Avenue', urgency: 'emergency' }, phoneTwo);
  await createJob({ customerId: customerTwo, category: 'carpentry', title: 'Sticking front door', description: 'Front door has swollen in the wet season and will not close properly.', suburb: 'Parap', address: '21 Example Road', urgency: 'flexible' }, phoneTwo);

  // One accepted job with a quote waiting for the customer.
  const tapJob = await createJob({ customerId: customerOne, category: 'plumbing', title: 'Leaking kitchen tap', description: 'Kitchen mixer tap drips constantly and the cupboard underneath is getting wet.', suburb: 'Casuarina', address: '12 Demo Street', urgency: 'this_week' }, phoneOne);
  await acceptAs(plumbingId, tapJob);
  must(await db.from('quotes').insert({ job_id: tapJob, company_id: plumbingId, amount_cents: 18000, notes: 'New mixer cartridge and labour. About an hour on site.', proposed_time: daysFromNow(2) }).select('id'), 'insert quote');

  // One scheduled job with an accepted quote and a short chat.
  const fanJob = await createJob({ customerId: customerOne, category: 'electrical', title: 'Install ceiling fan', description: 'Replace an old ceiling fan in the lounge with a new one I have already bought.', suburb: 'Casuarina', address: '12 Demo Street', urgency: 'flexible' }, phoneOne);
  await acceptAs(integratorId, fanJob);
  const fanTime = daysFromNow(3);
  must(await db.from('quotes').insert({ job_id: fanJob, company_id: integratorId, amount_cents: 22000, notes: 'Supply of fan by customer. Includes removal of the old unit.', proposed_time: fanTime, status: 'accepted', responded_at: new Date().toISOString() }).select('id'), 'insert accepted quote');
  must(await db.from('jobs').update({ status: 'scheduled', scheduled_at: fanTime }).eq('id', fanJob).select('id'), 'schedule job');
  const integratorOwner = must(await db.from('companies').select('owner_id').eq('id', integratorId).single(), 'find owner') as { owner_id: string };
  must(
    await db.from('messages').insert([
      { job_id: fanJob, sender_id: customerOne, body: 'Thanks for the quote. Is there parking out the front?', created_at: new Date(Date.now() - 120_000).toISOString() },
      { job_id: fanJob, sender_id: integratorOwner.owner_id, body: 'No worries, street parking is fine. See you then.', created_at: new Date(Date.now() - 60_000).toISOString() },
    ]).select('id'),
    'insert messages',
  );

  console.log('Demo data ready.');
  console.log(`  Admin:     ${ADMIN_EMAIL}`);
  COMPANIES.forEach((company) => console.log(`  Company:   ${company.email}  (${company.name})`));
  CUSTOMER_PHONES.forEach((phone) => console.log(`  Customer:  +${phone}  (add as a test number with a fixed code)`));
  console.log('  Password for admin and company logins: the SEED_PASSWORD you set.');
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
