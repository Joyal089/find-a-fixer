# Find a Fixer

> **Demo version.** This is a working demo built to show the idea to trade companies and
> early users. It is not a finished product and is not ready for real customers or real
> payments: SMS login uses test numbers, push notifications are switched off, there is no
> pricing or invoicing yet, and all company details and jobs are made-up sample data.

**Find a Fixer** is a mobile marketplace that connects people in Darwin, Australia who need
something fixed with vetted local trade companies: plumbers, electricians, air-conditioning
techs, carpenters, painters, roofers, landscapers and handymen.

## What it is for

Finding a reliable tradie usually means ringing around, repeating the same story, and
waiting for call-backs. Find a Fixer turns that into one short form:

1. **The customer posts the job** with photos or a short video, the suburb and how urgent
   it is. No account to create: confirming a mobile number is enough.
2. **Matching companies see it in their feed.** Only approved companies whose trades and
   service areas fit the job can see it, and the customer's address and phone stay hidden.
3. **A company accepts the job and sends a quote** with a price and a proposed time.
4. **The customer accepts the quote.** Only now does the company see the address and
   phone number, and the job is booked.
5. **Both sides chat in the app**, with photos, until the job is done.

For the trade companies it is a source of local work that already matches their trades and
areas. For the business running it, each accepted quote is logged as a **lead**, which is
what companies will be billed for. An admin page lets the operator approve companies, set
each company's monthly lead limit, handle disputes and export lead counts for invoicing.

## What the demo includes

- Customer app: post a job with photos, see its progress, accept or decline quotes, chat.
- Company app: job feed with photo thumbnails, accept or pass, send quotes, chat, a
  dashboard of leads and jobs waiting on a quote against the monthly limit.
- Admin web page: approve or suspend companies, set lead limits, mark disputed leads as
  "not charged", export monthly lead counts as CSV.
- Live updates between both sides while the app is open.
- Security enforced in the database, not only in the app: row-level security on every
  table, private photo storage, rate limits against spam, and 20 automated tests.

## Tech stack

| Folder      | What it is                                                                 |
| ----------- | -------------------------------------------------------------------------- |
| `mobile/`   | The app. React Native + Expo (SDK 58), one codebase for Android, iOS, web. |
| `supabase/` | Database: tables, row-level security, workflow functions, tests, seed.     |
| `admin/`    | Admin web page (Vite + TypeScript), deployable free on Vercel.             |

Backend: Supabase (Postgres, Auth, Storage, Realtime). Hosting: Vercel for the web builds,
Expo EAS for the Android APK. Everything runs on free tiers.

## Secrets

No keys, passwords or `.env` files are in this repository. Each folder has a
`.env.example` showing which values to fill in locally. The app only ever uses the public
project URL and publishable key; the secret key stays in `supabase/.env` on your own
computer and is used only by the seed script.

## Set up (about 20 minutes, all free tier)

### 1. Supabase project

1. Create a project at supabase.com (region: Sydney).
2. **SQL Editor**: run the five files in `supabase/migrations/` in order (`0001` → `0005`).
   Or, with the Supabase CLI: `npx supabase login`, `npx supabase link`, then
   `npx supabase db push` from the repo root.
3. **Authentication → Sign In / Providers → Phone**: enable it. For the demo, add test
   numbers so no SMS is sent or paid for: `61400000001=123456` and `61400000002=123456`.
   (For real customers later you connect an SMS provider such as Twilio here.)
4. **Authentication → Sign In / Providers → Email**: turn off "Confirm email" for the demo
   so a new partner can register and continue straight away.
5. **Project Settings → API**: copy the project URL, the publishable (anon) key and the
   secret (service role) key.

### 2. Demo data

```bash
cd supabase
npm install
cp .env.example .env      # add URL, secret key, and a SEED_PASSWORD of your choice
npm run seed
```

Creates an admin, 3 approved companies, 2 customers and 5 jobs (3 open, 1 with a quote
waiting, 1 scheduled with chat). The script prints the logins. Re-running it resets the demo.
The seeded jobs get their photos from `supabase/seed-photos/` (CC0 photos from Wikimedia
Commons, listed in `SOURCES.md` there). To use your own, put JPEGs in `supabase/seed-photos/` using the file names
listed against each job in `scripts/seed.ts` (for example `kitchen-tap-1.jpg`); any that are
missing are skipped. The company details in `scripts/seed.ts` are placeholders; edit them to match the real
companies.

### 3. The app

```bash
cd mobile
npm install
cp .env.example .env      # add URL and publishable key only
npx expo start
```

Scan the QR code with **Expo Go** on a phone, or press `w` for the web version.

### 4. Admin page

```bash
cd admin
npm install
cp .env.example .env      # same URL and publishable key
npm run dev
```

To host it: import the repo in Vercel, set **Root Directory** to `admin`, and add the two
`VITE_` variables. Log in with `admin@findafixer.test` and your seed password.

## Running the demo

Use two phones (or one phone and a browser tab).

| Step | Who      | What to do                                                                                   | What to show                                                    |
| ---- | -------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| 1    | Customer | Post a job → mobile `0400 000 001`, code `123456` → fill the form, add photos, post           | Job appears under "My jobs" as **Posted**                       |
| 2    | Company  | "I'm a partner company" → log in as `integrator@findafixer.test` → open the job from the feed | Photos visible; address hidden. Accept (two taps)               |
| 3    | Company  | Send quote: price, day, time                                                                 | Customer's screen updates live; customer taps **Accept quote**  |
| 4    | Both     | Open Messages on each side, send text and a photo                                            | Messages arrive live. Company now sees the address and phone    |
| 5    | Admin    | Admin page → Leads                                                                           | The lead logged when the quote was accepted; export the CSV     |

The job must match the company's trades and areas to show in its feed (Integrator's demo
profile: electrical, air conditioning, handyman in Casuarina, Leanyer, Nightcliff, Rapid
Creek, Darwin City, Parap).

## How it works

- **Sign-up is optional for customers.** There is no customer registration form; confirming
  a mobile number by SMS code is the only step before posting.
- **Job steps:** Posted → Accepted → Scheduled (quote accepted) → Completed.
- **A lead is logged the moment the customer accepts a quote**, in the same database
  transaction (`respond_to_quote` in `0005_lead_on_quote_accept.sql`), so an accepted quote
  cannot exist without its lead. Accepting a job does not create a lead. Admin can mark a
  lead "not charged" after a dispute.
- **Monthly lead limit.** A company cannot accept another job once this month's leads plus
  its accepted jobs still waiting on a quote reach its limit. Leads marked "not charged"
  do not count.
- **Chat opens when a company accepts the job** and stays open from then on.
- **All changes go through server functions.** The app can only read tables directly; it
  cannot write to jobs, quotes or leads except through functions that check who is calling.
- The PRD's `users` table is called `profiles`, because Supabase already has `auth.users`.

## Checks

```bash
cd supabase && npm test         # 20 tests: runs the real migrations in Postgres (PGlite)
cd mobile && npm run typecheck && npm run lint && npm test
cd admin && npm run build
cd supabase && npm run demo     # optional: the whole flow against your own project
```

`npm run demo` signs in as the first demo customer and Integrator Solutions (no secret
key), posts a job, accepts it, quotes, accepts the quote and chats, checking at each step
that the lead appears only when the quote is accepted and the address stays hidden until
then. It needs `SUPABASE_PUBLISHABLE_KEY` in `supabase/.env`. Each run posts a job, so
re-run `npm run seed` afterwards to reset the demo data.

The database tests cover: one user cannot read another's jobs, quotes, chats or photos;
companies only see jobs in their trades and areas; address and phone stay hidden until a
quote is accepted; no lead on accepting a job and exactly one when the quote is accepted;
the monthly limit (leads plus waiting jobs, "not charged" left out); chat photos must sit
in that job's chat folder; rate limits; admin-only functions.

## Security notes (OWASP Mobile Top 10)

| Risk                              | What was done                                                                                                    |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| M1 Improper credential usage      | Only the public URL and publishable key are in the app. The secret key is used only by the seed script and edge function. |
| M3 Insecure authentication/authorisation | Row-level security on every table; role changes and state changes only through server functions; signed-out users have no access. |
| M4 Insufficient input validation  | Lengths, categories, suburbs, amounts, times and file paths are validated in the database, not only in the app. A chat message can only reference a photo in its own job's chat folder. |
| M5 Insecure communication         | All traffic is HTTPS/WSS to Supabase.                                                                             |
| M6 Inadequate privacy controls    | Address and phone are in a separate table, released to the company only after a quote is accepted. Push notifications never include message text. |
| M8 Security misconfiguration      | Storage buckets are private with type and size limits; files are read through one-hour signed links. A job photo is only readable through a job whose customer owns its folder. |
| M9 Insecure data storage          | The login session is kept in the device keychain/keystore (SecureStore), not plain storage.                       |
| Spam / SMS cost abuse             | Job posts limited to 5 an hour and 20 a day per customer in the database. OTP requests are limited by Supabase (Authentication → Rate Limits); lower the SMS limit there before going live. |

Run `npm audit` in each folder before a demo. As of 15 Nov 2026: `admin` and `supabase`
report 0 issues. `mobile` reports 30 moderate/low advisories, all inside Expo's and Jest's
build and test tooling (3 via `minimatch` in Expo's build tools, the rest dev-only). None of
that code ships inside the app. Do not run `npm audit fix --force`: it downgrades Expo to
SDK 52 and breaks the project. They clear as Expo publishes patch releases
(`npx expo install --fix`).

## Known limits of this demo

- **Push notifications do not work in Expo Go** (an Expo restriction). While the app is open,
  both sides update live through realtime. For real push: create a development build
  (`npx eas-cli build --profile development`), then deploy `supabase/functions/push` and add
  the database webhooks described at the top of that file.
- **Android APK:** `cd mobile && npx eas-cli build --platform android --profile preview`.
  The project URL and publishable key for that build are set as Expo environment variables
  (`eas env:create --environment preview`), not in `eas.json`.
- **Web version:** `cd mobile && npx expo export --platform web`, then deploy the `dist`
  folder to Vercel. `mobile/vercel.json` makes direct links such as `/company/feed` work.
- Videos are shown as a tile that opens in the phone's player rather than playing inline.
- Reviews, invoices and subscription tiers have tables but no screens yet (after the demo).
- Suburbs and trades are fixed lists in `0001_schema.sql` and `mobile/src/constants/catalogue.ts`.

## Decisions still open

- Written lead definition. Working rule: customer accepts the quote = lead.
- Per-lead price and subscription tiers. No prices are stored or shown anywhere.
- Default monthly lead limit is 20 per company (a placeholder; change per company in admin).
