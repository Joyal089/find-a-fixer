// Runs the real migrations in an in-process Postgres (PGlite) and checks the security
// and workflow rules from the PRD. Run with `npm test` inside /supabase.
import { PGlite } from '@electric-sql/pglite';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { before, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(here, '..', 'migrations');

type Row = Record<string, unknown>;
type Runner = { query: <T = Row>(sql: string, params?: unknown[]) => Promise<{ rows: T[] }> };

let db: PGlite;

/** Runs `fn` as a signed-in API user (or as a signed-out visitor when uid is null). */
async function as<T>(uid: string | null, fn: (q: Runner) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.query(`set local role ${uid ? 'authenticated' : 'anon'}`);
    await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [uid ?? '']);
    return fn(tx as unknown as Runner);
  });
}

async function rejects(promise: Promise<unknown>, pattern: RegExp): Promise<void> {
  await assert.rejects(promise, (error: Error) => pattern.test(error.message));
}

async function newUser(phoneVerified: boolean): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `insert into auth.users (phone, phone_confirmed_at)
     values ($1, $2) returning id`,
    phoneVerified ? [`+614${Math.floor(Math.random() * 1e8)}`, new Date().toISOString()] : [null, null],
  );
  return rows[0]!.id;
}

async function newCompany(trades: string[], areas: string[], approve = true): Promise<{ owner: string; id: string }> {
  const owner = await newUser(false);
  const id = await as(owner, async (q) => {
    const { rows } = await q.query<{ id: string }>(
      `select public.register_company($1, null, 'NT-12345', 'QBE', current_date + 30, $2, $3) as id`,
      [`Co ${owner.slice(0, 6)}`, trades, areas],
    );
    return rows[0]!.id;
  });
  if (approve) await db.query(`update public.companies set status = 'approved' where id = $1`, [id]);
  return { owner, id };
}

type JobInput = { category?: string; suburb?: string; media?: unknown[]; id?: string };

async function postJob(uid: string, input: JobInput = {}): Promise<string> {
  const id = input.id ?? randomUUID();
  await as(uid, (q) =>
    q.query(`select public.post_job($1, $2, 'Leaking tap', 'Kitchen tap drips all night.', $3, '12 Smith St', 'flexible', $4)`, [
      id,
      input.category ?? 'plumbing',
      input.suburb ?? 'Casuarina',
      JSON.stringify(input.media ?? []),
    ]),
  );
  return id;
}

const count = async (uid: string | null, sql: string, params: unknown[] = []): Promise<number> =>
  as(uid, async (q) => (await q.query(sql, params)).rows.length);

before(async () => {
  db = new PGlite();
  await db.exec(readFileSync(join(here, 'stubs.sql'), 'utf8'));
  for (const file of readdirSync(migrationsDir).sort()) {
    await db.exec(readFileSync(join(migrationsDir, file), 'utf8'));
  }
});

describe('posting a job', () => {
  it('requires a verified phone number', async () => {
    const unverified = await newUser(false);
    await rejects(postJob(unverified), /PHONE_NOT_VERIFIED/);
  });

  it('requires sign-in and is closed to signed-out visitors', async () => {
    await rejects(
      as(null, (q) => q.query(`select public.post_job(gen_random_uuid(), 'plumbing', 'abc', 'abcdefghijkl', 'Casuarina', '12 Smith St', 'flexible')`)),
      /permission denied/,
    );
    await rejects(count(null, `select * from public.jobs`), /permission denied/);
  });

  it('validates category, suburb, text lengths and media paths on the server', async () => {
    const customer = await newUser(true);
    await rejects(postJob(customer, { category: 'hacking' }), /INVALID_CATEGORY/);
    await rejects(postJob(customer, { suburb: 'Sydney' }), /INVALID_SUBURB/);
    await rejects(
      as(customer, (q) => q.query(`select public.post_job(gen_random_uuid(), 'plumbing', 'x', 'short', 'Casuarina', '12 Smith St', 'flexible')`)),
      /INVALID_INPUT/,
    );
    const id = randomUUID();
    await rejects(postJob(customer, { id, media: [{ path: `someone-else/${id}/a.jpg`, type: 'photo' }] }), /INVALID_MEDIA/);
    await rejects(postJob(customer, { id, media: [{ path: `${customer}/${id}/a.exe`, type: 'photo' }] }), /INVALID_MEDIA/);
    await postJob(customer, { id, media: [{ path: `${customer}/${id}/a.jpg`, type: 'photo' }] });
    assert.equal(await count(customer, `select * from public.job_media where job_id = $1`, [id]), 1);
  });

  it('rate-limits to 5 jobs an hour', async () => {
    const customer = await newUser(true);
    for (let i = 0; i < 5; i += 1) await postJob(customer);
    await rejects(postJob(customer), /RATE_LIMITED/);
  });
});

describe('who can see what', () => {
  it('customers only see their own jobs', async () => {
    const a = await newUser(true);
    const b = await newUser(true);
    const job = await postJob(a);
    assert.equal(await count(a, `select * from public.jobs where id = $1`, [job]), 1);
    assert.equal(await count(b, `select * from public.jobs where id = $1`, [job]), 0);
    assert.equal(await count(b, `select * from public.job_private where job_id = $1`, [job]), 0);
  });

  it('companies only see open jobs in their trades and areas, once approved', async () => {
    const customer = await newUser(true);
    const job = await postJob(customer, { category: 'plumbing', suburb: 'Casuarina' });
    const match = await newCompany(['plumbing'], ['Casuarina']);
    const wrongTrade = await newCompany(['electrical'], ['Casuarina']);
    const wrongArea = await newCompany(['plumbing'], ['Palmerston']);
    const pending = await newCompany(['plumbing'], ['Casuarina'], false);
    const sql = `select * from public.jobs where id = $1`;
    assert.equal(await count(match.owner, sql, [job]), 1);
    assert.equal(await count(wrongTrade.owner, sql, [job]), 0);
    assert.equal(await count(wrongArea.owner, sql, [job]), 0);
    assert.equal(await count(pending.owner, sql, [job]), 0);
  });

  it('declining a job removes it from that company feed only', async () => {
    const customer = await newUser(true);
    const job = await postJob(customer);
    const one = await newCompany(['plumbing'], ['Casuarina']);
    const two = await newCompany(['plumbing'], ['Casuarina']);
    await as(one.owner, (q) => q.query(`select public.decline_job($1)`, [job]));
    assert.equal(await count(one.owner, `select * from public.jobs where id = $1`, [job]), 0);
    assert.equal(await count(two.owner, `select * from public.jobs where id = $1`, [job]), 1);
  });

  it('nobody can write to tables directly or promote themselves', async () => {
    const customer = await newUser(true);
    const job = await postJob(customer);
    const company = await newCompany(['plumbing'], ['Casuarina']);
    await rejects(as(customer, (q) => q.query(`update public.jobs set status = 'completed' where id = $1`, [job])), /permission denied/);
    await rejects(as(customer, (q) => q.query(`update public.profiles set role = 'admin' where id = $1`, [customer])), /permission denied/);
    await rejects(as(company.owner, (q) => q.query(`insert into public.leads (job_id, company_id) values ($1, $2)`, [job, company.id])), /permission denied/);
    await rejects(as(company.owner, (q) => q.query(`update public.companies set status = 'approved', monthly_lead_limit = 999 where id = $1`, [company.id])), /permission denied/);
    await rejects(as(company.owner, (q) => q.query(`delete from public.leads`)), /permission denied/);
  });
});

describe('accepting a job and logging the lead', () => {
  it('logs exactly one lead the moment a company accepts, and locks others out', async () => {
    const customer = await newUser(true);
    const job = await postJob(customer);
    const first = await newCompany(['plumbing'], ['Casuarina']);
    const second = await newCompany(['plumbing'], ['Casuarina']);

    await as(first.owner, (q) => q.query(`select public.accept_job($1)`, [job]));
    const leads = await db.query<{ company_id: string; counted: boolean }>(`select company_id, counted from public.leads where job_id = $1`, [job]);
    assert.deepEqual(leads.rows, [{ company_id: first.id, counted: true }]);

    await rejects(as(second.owner, (q) => q.query(`select public.accept_job($1)`, [job])), /JOB_TAKEN/);
    assert.equal(await count(second.owner, `select * from public.jobs where id = $1`, [job]), 0);
    assert.equal(await count(second.owner, `select * from public.leads`), 0);
    assert.equal(await count(first.owner, `select * from public.leads where job_id = $1`, [job]), 1);
  });

  it('refuses unapproved companies and jobs outside the company trades', async () => {
    const customer = await newUser(true);
    const job = await postJob(customer);
    const pending = await newCompany(['plumbing'], ['Casuarina'], false);
    const wrongTrade = await newCompany(['electrical'], ['Casuarina']);
    await rejects(as(pending.owner, (q) => q.query(`select public.accept_job($1)`, [job])), /COMPANY_NOT_APPROVED/);
    await rejects(as(wrongTrade.owner, (q) => q.query(`select public.accept_job($1)`, [job])), /JOB_NOT_FOUND/);
    assert.equal((await db.query(`select 1 from public.leads where job_id = $1`, [job])).rows.length, 0);
  });

  it('enforces the monthly lead limit', async () => {
    const company = await newCompany(['plumbing'], ['Casuarina']);
    await db.query(`update public.companies set monthly_lead_limit = 1 where id = $1`, [company.id]);
    const customer = await newUser(true);
    const jobOne = await postJob(customer);
    const jobTwo = await postJob(customer);
    await as(company.owner, (q) => q.query(`select public.accept_job($1)`, [jobOne]));
    await rejects(as(company.owner, (q) => q.query(`select public.accept_job($1)`, [jobTwo])), /LEAD_LIMIT_REACHED/);
  });
});

describe('quotes, contact details and chat', () => {
  it('runs Posted → Accepted → Scheduled → Completed and reveals the address only after a quote is accepted', async () => {
    const customer = await newUser(true);
    const outsider = await newUser(true);
    const job = await postJob(customer);
    const company = await newCompany(['plumbing'], ['Casuarina']);
    const rival = await newCompany(['plumbing'], ['Casuarina']);
    const contact = `select * from public.job_private where job_id = $1`;

    assert.equal(await count(company.owner, contact, [job]), 0);
    await rejects(as(company.owner, (q) => q.query(`select public.send_quote($1, 15000, null, now() + interval '2 days')`, [job])), /JOB_NOT_FOUND/);

    await as(company.owner, (q) => q.query(`select public.accept_job($1)`, [job]));
    assert.equal(await count(company.owner, contact, [job]), 0, 'address still hidden after accepting');

    await rejects(as(company.owner, (q) => q.query(`select public.send_quote($1, 15000, null, now() - interval '1 day')`, [job])), /INVALID_TIME/);
    await rejects(as(company.owner, (q) => q.query(`select public.send_quote($1, 5, null, now() + interval '2 days')`, [job])), /INVALID_INPUT/);
    const quoteId = await as(company.owner, async (q) => {
      const { rows } = await q.query<{ id: string }>(`select public.send_quote($1, 15000, 'Parts included', now() + interval '2 days') as id`, [job]);
      return rows[0]!.id;
    });
    await rejects(as(company.owner, (q) => q.query(`select public.send_quote($1, 16000, null, now() + interval '3 days')`, [job])), /QUOTE_PENDING/);

    const quoteSql = `select * from public.quotes where id = $1`;
    assert.equal(await count(customer, quoteSql, [quoteId]), 1);
    assert.equal(await count(outsider, quoteSql, [quoteId]), 0);
    assert.equal(await count(rival.owner, quoteSql, [quoteId]), 0);

    await rejects(as(outsider, (q) => q.query(`select public.respond_to_quote($1, true)`, [quoteId])), /QUOTE_NOT_FOUND/);
    await rejects(as(company.owner, (q) => q.query(`select public.respond_to_quote($1, true)`, [quoteId])), /QUOTE_NOT_FOUND/);
    await rejects(as(company.owner, (q) => q.query(`select public.complete_job($1)`, [job])), /JOB_NOT_COMPLETABLE/);

    await as(customer, (q) => q.query(`select public.respond_to_quote($1, true)`, [quoteId]));
    const scheduled = await db.query<{ status: string; ok: boolean }>(
      `select j.status, j.scheduled_at = q.proposed_time as ok from public.jobs j join public.quotes q on q.job_id = j.id where j.id = $1`,
      [job],
    );
    assert.deepEqual(scheduled.rows, [{ status: 'scheduled', ok: true }]);
    assert.equal(await count(company.owner, contact, [job]), 1, 'address visible once quote accepted');
    assert.equal(await count(rival.owner, contact, [job]), 0);

    await rejects(as(customer, (q) => q.query(`select public.respond_to_quote($1, false)`, [quoteId])), /QUOTE_NOT_OPEN/);
    await as(company.owner, (q) => q.query(`select public.complete_job($1)`, [job]));
    assert.equal((await db.query<{ status: string }>(`select status from public.jobs where id = $1`, [job])).rows[0]!.status, 'completed');
    assert.equal((await db.query(`select 1 from public.leads where job_id = $1`, [job])).rows.length, 1, 'still one lead');
  });

  it('lets a company re-quote after a decline', async () => {
    const customer = await newUser(true);
    const job = await postJob(customer);
    const company = await newCompany(['plumbing'], ['Casuarina']);
    await as(company.owner, (q) => q.query(`select public.accept_job($1)`, [job]));
    const first = await as(company.owner, async (q) => (await q.query<{ id: string }>(`select public.send_quote($1, 20000, null, now() + interval '1 day') as id`, [job])).rows[0]!.id);
    await as(customer, (q) => q.query(`select public.respond_to_quote($1, false)`, [first]));
    await as(company.owner, (q) => q.query(`select public.send_quote($1, 18000, null, now() + interval '1 day')`, [job]));
    assert.equal(await count(customer, `select * from public.quotes where job_id = $1`, [job]), 2);
  });

  it('keeps chat private to the customer and the company on the job', async () => {
    const customer = await newUser(true);
    const outsider = await newUser(true);
    const job = await postJob(customer);
    const company = await newCompany(['plumbing'], ['Casuarina']);
    const rival = await newCompany(['plumbing'], ['Casuarina']);
    const send = (uid: string, sender: string) =>
      as(uid, (q) => q.query(`insert into public.messages (job_id, sender_id, body) values ($1, $2, 'Hello')`, [job, sender]));

    await rejects(send(customer, customer), /row-level security/); // no company yet
    await as(company.owner, (q) => q.query(`select public.accept_job($1)`, [job]));
    await send(customer, customer);
    await send(company.owner, company.owner);
    await rejects(send(outsider, outsider), /row-level security/);
    await rejects(send(rival.owner, rival.owner), /row-level security/);
    await rejects(send(company.owner, customer), /row-level security/); // cannot pose as the customer

    const sql = `select * from public.messages where job_id = $1`;
    assert.equal(await count(customer, sql, [job]), 2);
    assert.equal(await count(company.owner, sql, [job]), 2);
    assert.equal(await count(outsider, sql, [job]), 0);
    assert.equal(await count(rival.owner, sql, [job]), 0);
  });

  it('applies the same rules to stored photos', async () => {
    const customer = await newUser(true);
    const outsider = await newUser(true);
    const job = randomUUID();
    const upload = (uid: string, bucket: string, name: string) =>
      as(uid, (q) => q.query(`insert into storage.objects (bucket_id, name) values ($1, $2)`, [bucket, name]));
    const visible = (uid: string, name: string) => count(uid, `select * from storage.objects where name = $1`, [name]);

    const photo = `${customer}/${job}/a.jpg`;
    await rejects(upload(outsider, 'job-media', photo), /row-level security/);
    await upload(customer, 'job-media', photo);
    await postJob(customer, { id: job, media: [{ path: photo, type: 'photo' }] });
    const company = await newCompany(['plumbing'], ['Casuarina']);
    const wrongTrade = await newCompany(['electrical'], ['Casuarina']);
    assert.equal(await visible(company.owner, photo), 1, 'matching company sees photos before deciding');
    assert.equal(await visible(wrongTrade.owner, photo), 0);
    assert.equal(await visible(outsider, photo), 0);

    const chatPhoto = `${job}/${customer}/b.jpg`;
    await rejects(upload(customer, 'chat-media', chatPhoto), /row-level security/); // chat not open yet
    await as(company.owner, (q) => q.query(`select public.accept_job($1)`, [job]));
    await upload(customer, 'chat-media', chatPhoto);
    await rejects(upload(outsider, 'chat-media', `${job}/${outsider}/c.jpg`), /row-level security/);
    assert.equal(await visible(company.owner, chatPhoto), 1);
    assert.equal(await visible(outsider, chatPhoto), 0);
    assert.equal(await visible(wrongTrade.owner, chatPhoto), 0);
  });
});

describe('admin', () => {
  it('only admins can approve companies or read the lead summary', async () => {
    const company = await newCompany(['plumbing'], ['Casuarina'], false);
    await rejects(as(company.owner, (q) => q.query(`select public.admin_set_company_status($1, 'approved')`, [company.id])), /NOT_ADMIN/);
    await rejects(as(company.owner, (q) => q.query(`select * from public.admin_lead_summary(current_date - 30, current_date + 1)`)), /NOT_ADMIN/);

    const admin = await newUser(false);
    await db.query(`update public.profiles set role = 'admin' where id = $1`, [admin]);
    await as(admin, (q) => q.query(`select public.admin_set_company_status($1, 'approved')`, [company.id]));

    const customer = await newUser(true);
    const job = await postJob(customer);
    await as(company.owner, (q) => q.query(`select public.accept_job($1)`, [job]));
    const summary = await as(admin, async (q) =>
      (await q.query<{ leads_total: string; leads_counted: string }>(
        `select leads_total::text, leads_counted::text from public.admin_lead_summary(current_date - 1, current_date + 1) where company_id = $1`,
        [company.id],
      )).rows,
    );
    assert.deepEqual(summary, [{ leads_total: '1', leads_counted: '1' }]);

    const lead = (await db.query<{ id: string }>(`select id from public.leads where job_id = $1`, [job])).rows[0]!.id;
    await as(admin, (q) => q.query(`select public.admin_set_lead_counted($1, false, 'Duplicate job')`, [lead]));
    const after = await as(admin, async (q) =>
      (await q.query<{ leads_counted: string }>(
        `select leads_counted::text from public.admin_lead_summary(current_date - 1, current_date + 1) where company_id = $1`,
        [company.id],
      )).rows,
    );
    assert.deepEqual(after, [{ leads_counted: '0' }]);
  });
});
