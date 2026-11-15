// Seeds demo data: 1 admin, 3 approved companies, 2 customers and 5 jobs at different
// stages, so the whole demo flow can be shown straight away.
//
// Runs on your computer with the secret key (never in the app). Safe to re-run: it
// removes the previous demo accounts first, and everything they own goes with them.
//
//   cd supabase && cp .env.example .env   (fill it in)
//   npm run seed
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const { SUPABASE_URL, SUPABASE_SECRET_KEY, SEED_PASSWORD } = process.env;
if (!SUPABASE_URL || !SUPABASE_SECRET_KEY || !SEED_PASSWORD || SEED_PASSWORD.length < 10) {
  console.error('Set SUPABASE_URL, SUPABASE_SECRET_KEY and SEED_PASSWORD (10+ characters) in supabase/.env');
  process.exit(1);
}

const db: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const ADMIN_EMAIL = 'admin@findafixer.test';

// Job photos live in supabase/seed-photos (JPEG). Each job lists the files it wants; any
// that are missing are skipped with a note, so the seed still works without them.
const PHOTO_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'seed-photos');
const JOB_MEDIA_BUCKET = 'job-media';
const missingPhotos: string[] = [];

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

/** Deletes every job photo a demo customer uploaded: <customer id>/<job id>/<file>. */
async function removeJobPhotos(customerId: string): Promise<void> {
  const bucket = db.storage.from(JOB_MEDIA_BUCKET);
  const jobFolders = must(await bucket.list(customerId, { limit: 1000 }), 'list photo folders');
  for (const folder of jobFolders) {
    const prefix = `${customerId}/${folder.name}`;
    const files = must(await bucket.list(prefix, { limit: 1000 }), 'list photos');
    if (files.length === 0) continue;
    must(await bucket.remove(files.map((file) => `${prefix}/${file.name}`)), 'remove old photos');
  }
}

async function removeOldDemoAccounts(): Promise<void> {
  const emails = new Set<string>([ADMIN_EMAIL, ...COMPANIES.map((company) => company.email)]);
  const phones = new Set<string>(CUSTOMER_PHONES);
  const { users } = must(await db.auth.admin.listUsers({ page: 1, perPage: 1000 }), 'list users');
  for (const user of users) {
    if ((user.email && emails.has(user.email)) || (user.phone && phones.has(user.phone))) {
      if (user.phone && phones.has(user.phone)) await removeJobPhotos(user.id);
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
  /** File names in supabase/seed-photos. */
  photos: string[];
  /** How long ago the job was posted. Spread out so the demo customers start well under the 5-jobs-an-hour limit. */
  postedHoursAgo: number;
}

const hoursAgo = (hours: number): string => new Date(Date.now() - hours * 3_600_000).toISOString();

// Darwin is UTC+9:30 all year (no daylight saving).
const DARWIN_OFFSET_MS = 9.5 * 3_600_000;

/** A round hour in Darwin time, some days ahead: darwinTime(2, 9) is 9:00 am the day after tomorrow. */
function darwinTime(daysAhead: number, hour: number): string {
  const local = new Date(Date.now() + DARWIN_OFFSET_MS);
  const localMidnightUtc = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + daysAhead, hour);
  return new Date(localMidnightUtc - DARWIN_OFFSET_MS).toISOString();
}

/** Uploads the job's photos to <customer id>/<job id>/ and records them, as post_job does. */
async function addPhotos(job: SeedJob, jobId: string): Promise<void> {
  for (const [index, fileName] of job.photos.entries()) {
    const file = join(PHOTO_DIR, fileName);
    if (!existsSync(file)) {
      missingPhotos.push(fileName);
      continue;
    }
    const path = `${job.customerId}/${jobId}/photo-${index + 1}.jpg`;
    must(
      await db.storage.from(JOB_MEDIA_BUCKET).upload(path, readFileSync(file), { contentType: 'image/jpeg', upsert: true }),
      `upload ${fileName}`,
    );
    must(
      await db.from('job_media').insert({ job_id: jobId, storage_path: path, media_type: 'photo' }).select('id'),
      `record ${fileName}`,
    );
  }
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
        created_at: hoursAgo(job.postedHoursAgo),
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
  await addPhotos(job, jobId);
  return jobId;
}

/** Mirrors accept_job(): the job moves to accepted. No lead yet. */
async function acceptAs(companyId: string, jobId: string, acceptedHoursAgo: number): Promise<void> {
  must(
    await db.from('jobs').update({ status: 'accepted', company_id: companyId, accepted_at: hoursAgo(acceptedHoursAgo) }).eq('id', jobId).select('id'),
    'accept job',
  );
}

async function main(): Promise<void> {
  await removeOldDemoAccounts();

  const adminId = await createEmailUser(ADMIN_EMAIL);
  must(await db.from('profiles').update({ role: 'admin', display_name: 'Admin' }).eq('id', adminId).select('id'), 'set admin role');

  const [integratorId, plumbingId] = await Promise.all(COMPANIES.map(createCompany));
  const [customerOne, customerTwo] = await Promise.all(CUSTOMER_PHONES.map(createCustomer));
  if (!integratorId || !plumbingId || !customerOne || !customerTwo) throw new Error('seed accounts missing');
  const [phoneOne, phoneTwo] = CUSTOMER_PHONES;

  // Three open jobs for the feeds.
  await createJob({ customerId: customerOne, category: 'electrical', title: 'Power point not working', description: 'Two power points in the kitchen stopped working after the storm.', suburb: 'Leanyer', address: '4 Demo Street', urgency: 'this_week', photos: ['power-point-1.jpg'], postedHoursAgo: 2 }, phoneOne);
  await createJob({ customerId: customerTwo, category: 'air_conditioning', title: 'Split system leaking water', description: 'Bedroom split system drips water inside when it runs for more than an hour.', suburb: 'Nightcliff', address: '9 Sample Avenue', urgency: 'emergency', photos: ['split-system-1.jpg'], postedHoursAgo: 26 }, phoneTwo);
  await createJob({ customerId: customerTwo, category: 'carpentry', title: 'Sticking front door', description: 'Front door has swollen in the wet season and will not close properly.', suburb: 'Parap', address: '21 Example Road', urgency: 'flexible', photos: ['front-door-1.jpg'], postedHoursAgo: 72 }, phoneTwo);

  // One accepted job with a quote waiting for the customer.
  const tapJob = await createJob({ customerId: customerOne, category: 'plumbing', title: 'Leaking kitchen tap', description: 'Kitchen mixer tap drips constantly and the cupboard underneath is getting wet.', suburb: 'Casuarina', address: '12 Demo Street', urgency: 'this_week', photos: ['kitchen-tap-1.jpg', 'kitchen-tap-2.jpg'], postedHoursAgo: 50 }, phoneOne);
  await acceptAs(plumbingId, tapJob, 46);
  must(await db.from('quotes').insert({ job_id: tapJob, company_id: plumbingId, amount_cents: 18000, notes: 'New mixer cartridge and labour. About an hour on site.', proposed_time: darwinTime(2, 9), created_at: hoursAgo(22) }).select('id'), 'insert quote');

  // One scheduled job with an accepted quote and a short chat.
  const fanJob = await createJob({ customerId: customerOne, category: 'electrical', title: 'Install ceiling fan', description: 'Replace an old ceiling fan in the lounge with a new one I have already bought.', suburb: 'Casuarina', address: '12 Demo Street', urgency: 'flexible', photos: ['ceiling-fan-1.jpg'], postedHoursAgo: 98 }, phoneOne);
  await acceptAs(integratorId, fanJob, 94);
  const fanTime = darwinTime(3, 9);
  must(await db.from('quotes').insert({ job_id: fanJob, company_id: integratorId, amount_cents: 22000, notes: 'Supply of fan by customer. Includes removal of the old unit.', proposed_time: fanTime, status: 'accepted', created_at: hoursAgo(74), responded_at: hoursAgo(49) }).select('id'), 'insert accepted quote');
  must(await db.from('jobs').update({ status: 'scheduled', scheduled_at: fanTime }).eq('id', fanJob).select('id'), 'schedule job');
  // Mirrors respond_to_quote(): the lead is logged when the customer accepts the quote.
  must(await db.from('leads').insert({ job_id: fanJob, company_id: integratorId, created_at: hoursAgo(49) }).select('id'), 'log lead');
  const integratorOwner = must(await db.from('companies').select('owner_id').eq('id', integratorId).single(), 'find owner') as { owner_id: string };
  must(
    await db.from('messages').insert([
      { job_id: fanJob, sender_id: customerOne, body: 'Thanks for the quote. Is there parking out the front?', created_at: hoursAgo(48) },
      { job_id: fanJob, sender_id: integratorOwner.owner_id, body: 'No worries, street parking is fine. See you then.', created_at: hoursAgo(47.5) },
    ]).select('id'),
    'insert messages',
  );

  console.log('Demo data ready.');
  console.log(`  Admin:     ${ADMIN_EMAIL}`);
  COMPANIES.forEach((company) => console.log(`  Company:   ${company.email}  (${company.name})`));
  CUSTOMER_PHONES.forEach((phone) => console.log(`  Customer:  +${phone}  (add as a test number with a fixed code)`));
  console.log('  Password for admin and company logins: the SEED_PASSWORD you set.');
  if (missingPhotos.length > 0) {
    console.log(`  Job photos skipped (not found in supabase/seed-photos): ${missingPhotos.join(', ')}`);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
