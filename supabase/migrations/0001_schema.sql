-- Find a Fixer: tables, constraints and indexes.
-- The PRD's "users" table is `profiles` here, because Supabase already owns `auth.users`.

create type public.user_role as enum ('customer', 'company', 'admin');
create type public.company_status as enum ('pending', 'approved', 'suspended');
create type public.job_status as enum ('posted', 'accepted', 'scheduled', 'completed', 'cancelled');
create type public.job_urgency as enum ('emergency', 'this_week', 'flexible');
create type public.quote_status as enum ('pending', 'accepted', 'declined');
create type public.media_type as enum ('photo', 'video');

-- Reference lists. Kept in the database so the server, not the app, decides what is valid.
create function public.trade_list() returns text[]
language sql immutable set search_path = '' as $$
  select array['plumbing', 'electrical', 'construction', 'air_conditioning', 'carpentry',
               'painting', 'roofing', 'landscaping', 'handyman']
$$;

create function public.suburb_list() returns text[]
language sql immutable set search_path = '' as $$
  select array['Darwin City', 'Parap', 'Fannie Bay', 'Stuart Park', 'Nightcliff', 'Rapid Creek',
               'Casuarina', 'Leanyer', 'Karama', 'Malak', 'Marrara', 'Winnellie', 'Berrimah',
               'Palmerston', 'Durack', 'Howard Springs', 'Humpty Doo']
$$;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role not null default 'customer',
  display_name text check (char_length(display_name) between 1 and 80),
  created_at timestamptz not null default now()
);

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 120),
  abn text check (abn ~ '^[0-9]{11}$'),
  licence_number text not null check (char_length(licence_number) between 2 and 60),
  insurance_provider text not null check (char_length(insurance_provider) between 2 and 120),
  insurance_expiry date not null,
  trades text[] not null check (cardinality(trades) between 1 and 12),
  service_areas text[] not null check (cardinality(service_areas) between 1 and 60),
  status public.company_status not null default 'pending',
  monthly_lead_limit integer not null default 20 check (monthly_lead_limit >= 0),
  approved_at timestamptz,
  created_at timestamptz not null default now()
);
create index companies_status_idx on public.companies (status);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles (id) on delete cascade,
  category text not null,
  title text not null check (char_length(title) between 3 and 100),
  description text not null check (char_length(description) between 10 and 2000),
  suburb text not null,
  urgency public.job_urgency not null default 'flexible',
  status public.job_status not null default 'posted',
  company_id uuid references public.companies (id),
  accepted_at timestamptz,
  scheduled_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
-- The job feed filters on status + trade + suburb and sorts newest first.
create index jobs_feed_idx on public.jobs (status, category, suburb, created_at desc);
create index jobs_customer_idx on public.jobs (customer_id, created_at desc);
create index jobs_company_idx on public.jobs (company_id, created_at desc);

-- Street address and phone live apart from `jobs` so row-level security can keep them
-- hidden from the company until a quote is accepted.
create table public.job_private (
  job_id uuid primary key references public.jobs (id) on delete cascade,
  address text not null check (char_length(address) between 5 and 200),
  contact_phone text not null
);

create table public.job_media (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  storage_path text not null unique,
  media_type public.media_type not null,
  created_at timestamptz not null default now()
);
create index job_media_job_idx on public.job_media (job_id);

create table public.job_declines (
  job_id uuid not null references public.jobs (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (job_id, company_id)
);

create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  amount_cents integer not null check (amount_cents between 100 and 10000000),
  notes text check (char_length(notes) <= 1000),
  proposed_time timestamptz not null,
  status public.quote_status not null default 'pending',
  responded_at timestamptz,
  created_at timestamptz not null default now()
);
create index quotes_job_idx on public.quotes (job_id, created_at desc);
-- One open quote per job at a time.
create unique index quotes_one_pending_idx on public.quotes (job_id) where status = 'pending';

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text check (char_length(body) between 1 and 2000),
  media_path text check (char_length(media_path) <= 300),
  created_at timestamptz not null default now(),
  check (body is not null or media_path is not null)
);
create index messages_job_idx on public.messages (job_id, created_at desc);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null unique references public.jobs (id) on delete cascade,
  customer_id uuid not null references public.profiles (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text check (char_length(comment) <= 1000),
  created_at timestamptz not null default now()
);
create index reviews_company_idx on public.reviews (company_id, created_at desc);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  period_start date not null,
  period_end date not null,
  lead_count integer not null check (lead_count >= 0),
  -- Null until pricing is decided (PRD open question).
  amount_cents integer check (amount_cents >= 0),
  status text not null default 'draft' check (status in ('draft', 'sent', 'paid', 'void')),
  created_at timestamptz not null default now(),
  check (period_end >= period_start)
);
create index invoices_company_idx on public.invoices (company_id, period_start desc);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  -- Unique: a job can only ever produce one lead.
  job_id uuid not null unique references public.jobs (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  -- Admin can set this false after a dispute, once the written lead definition exists.
  counted boolean not null default true,
  admin_note text check (char_length(admin_note) <= 500),
  invoice_id uuid references public.invoices (id) on delete set null,
  created_at timestamptz not null default now()
);
create index leads_company_idx on public.leads (company_id, created_at desc);

create table public.push_tokens (
  user_id uuid not null references public.profiles (id) on delete cascade,
  token text not null check (char_length(token) between 10 and 200),
  created_at timestamptz not null default now(),
  primary key (user_id, token)
);

-- Every auth user gets a profile. Role always starts as customer; only server-side
-- functions can change it.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
