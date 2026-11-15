-- Find a Fixer: row-level security on every table.
-- Rule of thumb: the app can only READ through these policies. Every state change
-- (post, accept, quote, respond, complete) goes through a function in 0003_workflow.sql.

-- ---------- Helper functions ----------
-- SECURITY DEFINER so policies can look across tables without recursing into each
-- other's policies. Each one only answers a yes/no question about the caller.

create function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles where id = (select auth.uid()) and role = 'admin'
  )
$$;

create function public.my_company_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select id from public.companies where owner_id = (select auth.uid())
$$;

create function public.company_matches_job(p_category text, p_suburb text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.companies c
    where c.owner_id = (select auth.uid())
      and c.status = 'approved'
      and p_category = any (c.trades)
      and p_suburb = any (c.service_areas)
  )
$$;

create function public.is_job_party(p_job_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.jobs j
    where j.id = p_job_id
      and (j.customer_id = (select auth.uid()) or j.company_id = public.my_company_id())
  )
$$;

-- Chat opens once a company has taken the job.
create function public.can_chat(p_job_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.jobs j
    where j.id = p_job_id
      and j.company_id is not null
      and j.status <> 'cancelled'
      and (j.customer_id = (select auth.uid()) or j.company_id = public.my_company_id())
  )
$$;

-- Address and phone: the customer always, the company only after a quote is accepted.
create function public.can_see_job_contact(p_job_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.jobs j
    where j.id = p_job_id
      and (
        j.customer_id = (select auth.uid())
        or (j.company_id = public.my_company_id() and j.status in ('scheduled', 'completed'))
      )
  )
$$;

create function public.is_company_on_my_job(p_company_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.jobs j
    where j.company_id = p_company_id and j.customer_id = (select auth.uid())
  )
$$;

-- ---------- Table privileges ----------
-- Start from nothing, then grant the minimum. Signed-out visitors (anon) get no access.
revoke all on all tables in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;
revoke execute on function public.handle_new_user() from authenticated;

grant select on public.profiles, public.companies, public.jobs, public.job_private,
  public.job_media, public.job_declines, public.quotes, public.messages, public.reviews,
  public.leads, public.invoices, public.push_tokens to authenticated;
grant update (display_name) on public.profiles to authenticated;
grant insert (job_id, sender_id, body, media_path) on public.messages to authenticated;
grant insert (job_id, customer_id, company_id, rating, comment) on public.reviews to authenticated;
grant insert (user_id, token), delete on public.push_tokens to authenticated;

alter table public.profiles enable row level security;
alter table public.companies enable row level security;
alter table public.jobs enable row level security;
alter table public.job_private enable row level security;
alter table public.job_media enable row level security;
alter table public.job_declines enable row level security;
alter table public.quotes enable row level security;
alter table public.messages enable row level security;
alter table public.reviews enable row level security;
alter table public.leads enable row level security;
alter table public.invoices enable row level security;
alter table public.push_tokens enable row level security;

-- ---------- Policies ----------

create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- A company is visible to its owner, to admin, and to customers whose job it took.
create policy companies_select on public.companies for select to authenticated
  using (
    owner_id = (select auth.uid())
    or (select public.is_admin())
    or public.is_company_on_my_job(id)
  );

-- Customers see their own jobs. Companies see jobs they took, plus open jobs in their
-- trades and service areas that they have not declined.
create policy jobs_select on public.jobs for select to authenticated
  using (
    customer_id = (select auth.uid())
    or company_id = (select public.my_company_id())
    or (
      status = 'posted'
      and public.company_matches_job(category, suburb)
      and not exists (
        select 1 from public.job_declines d
        where d.job_id = jobs.id and d.company_id = (select public.my_company_id())
      )
    )
    or (select public.is_admin())
  );

create policy job_private_select on public.job_private for select to authenticated
  using (public.can_see_job_contact(job_id) or (select public.is_admin()));

-- Media follows the job: if you can see the job row, you can see its photos.
create policy job_media_select on public.job_media for select to authenticated
  using (exists (select 1 from public.jobs j where j.id = job_media.job_id));

create policy job_declines_select on public.job_declines for select to authenticated
  using (company_id = (select public.my_company_id()));

create policy quotes_select on public.quotes for select to authenticated
  using (
    company_id = (select public.my_company_id())
    or exists (
      select 1 from public.jobs j
      where j.id = quotes.job_id and j.customer_id = (select auth.uid())
    )
    or (select public.is_admin())
  );

create policy messages_select on public.messages for select to authenticated
  using (public.is_job_party(job_id) or (select public.is_admin()));
create policy messages_insert on public.messages for insert to authenticated
  with check (sender_id = (select auth.uid()) and public.can_chat(job_id));

create policy reviews_select on public.reviews for select to authenticated using (true);
create policy reviews_insert on public.reviews for insert to authenticated
  with check (
    customer_id = (select auth.uid())
    and exists (
      select 1 from public.jobs j
      where j.id = reviews.job_id
        and j.customer_id = (select auth.uid())
        and j.company_id = reviews.company_id
        and j.status = 'completed'
    )
  );

create policy leads_select on public.leads for select to authenticated
  using (company_id = (select public.my_company_id()) or (select public.is_admin()));

create policy invoices_select on public.invoices for select to authenticated
  using (company_id = (select public.my_company_id()) or (select public.is_admin()));

create policy push_tokens_select on public.push_tokens for select to authenticated
  using (user_id = (select auth.uid()));
create policy push_tokens_insert on public.push_tokens for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy push_tokens_delete on public.push_tokens for delete to authenticated
  using (user_id = (select auth.uid()));
