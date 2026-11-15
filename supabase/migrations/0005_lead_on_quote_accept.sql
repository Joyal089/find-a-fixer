-- Find a Fixer: lead definition and two security tightenings.
--
-- 1. A lead is now created when the customer accepts the quote (respond_to_quote), not
--    when the company accepts the job. accept_job no longer creates one.
-- 2. The monthly limit in accept_job counts this month's charged leads plus the company's
--    accepted jobs still waiting on a quote decision (each of those may become a lead).
--    Leads an admin has marked "not charged" do not count.
-- 3. job-media files are only readable through a job whose customer owns the folder.
-- 4. A chat message can only point at a photo inside that job's own chat folder.
--
-- Chat is unchanged: it still opens when a company accepts the job (can_chat).

-- ---------- Accept a job: no lead yet ----------
-- The return type changes (there is no lead id to return any more), so the function is
-- dropped and recreated rather than replaced.
drop function public.accept_job(uuid);

-- Taking a job happens under row locks, so two companies can never take the same job and
-- one company's accepts are checked against its limit one at a time.
create function public.accept_job(p_job_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := public.require_user();
  v_company public.companies%rowtype;
  v_job public.jobs%rowtype;
  v_leads bigint;
  v_waiting bigint;
begin
  select * into v_company from public.companies where owner_id = v_uid for update;
  if not found or v_company.status <> 'approved' then
    raise exception 'COMPANY_NOT_APPROVED';
  end if;

  select * into v_job from public.jobs where id = p_job_id for update;
  if not found then
    raise exception 'JOB_NOT_FOUND';
  end if;
  if v_job.status <> 'posted' then
    raise exception 'JOB_TAKEN';
  end if;
  if not (v_job.category = any (v_company.trades) and v_job.suburb = any (v_company.service_areas)) then
    raise exception 'JOB_NOT_FOUND';
  end if;

  -- Charged leads logged this Darwin calendar month.
  select count(*) into v_leads
  from public.leads l
  where l.company_id = v_company.id
    and l.counted
    and l.created_at >= public.darwin_month_start();

  -- Jobs this company holds that have no accepted quote yet.
  select count(*) into v_waiting
  from public.jobs j
  where j.company_id = v_company.id
    and j.status = 'accepted'
    and not exists (
      select 1 from public.quotes q where q.job_id = j.id and q.status = 'accepted'
    );

  if v_leads + v_waiting >= v_company.monthly_lead_limit then
    raise exception 'LEAD_LIMIT_REACHED';
  end if;

  update public.jobs
  set status = 'accepted', company_id = v_company.id, accepted_at = now()
  where id = p_job_id;
end;
$$;

-- A recreated function gets default privileges again, so lock it back down.
revoke execute on function public.accept_job(uuid) from public, anon;
grant execute on function public.accept_job(uuid) to authenticated;

-- ---------- Respond to a quote: accepting it creates the lead ----------
-- Scheduling the job and logging the lead happen in the same transaction, so an accepted
-- quote cannot exist without its lead.
create or replace function public.respond_to_quote(p_quote_id uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := public.require_user();
  v_quote public.quotes%rowtype;
  v_job public.jobs%rowtype;
begin
  select * into v_quote from public.quotes where id = p_quote_id for update;
  if not found then
    raise exception 'QUOTE_NOT_FOUND';
  end if;
  select * into v_job from public.jobs where id = v_quote.job_id for update;
  if v_job.customer_id <> v_uid then
    raise exception 'QUOTE_NOT_FOUND';
  end if;
  if v_quote.status <> 'pending' or v_job.status <> 'accepted' then
    raise exception 'QUOTE_NOT_OPEN';
  end if;

  if p_accept then
    update public.quotes set status = 'accepted', responded_at = now() where id = p_quote_id;
    update public.jobs set status = 'scheduled', scheduled_at = v_quote.proposed_time
    where id = v_job.id;
    -- A job that already has a lead from the earlier rule (lead on accept) keeps that one.
    insert into public.leads (job_id, company_id) values (v_job.id, v_quote.company_id)
    on conflict (job_id) do nothing;
  else
    -- The job stays with the company, which can send a revised quote.
    update public.quotes set status = 'declined', responded_at = now() where id = p_quote_id;
  end if;
end;
$$;

-- ---------- Storage: job photos ----------
-- job-media paths are <customer id>/<job id>/<file>. Before, anyone who could see a job
-- could read any file under a folder named after that job, whoever's folder it sat in.
-- Now the first folder must also be that job's customer.
drop policy job_media_read on storage.objects;
create policy job_media_read on storage.objects for select to authenticated
  using (
    bucket_id = 'job-media'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or exists (
        select 1 from public.jobs j
        where j.id::text = (storage.foldername(name))[2]
          and j.customer_id::text = (storage.foldername(name))[1]
      )
    )
  );

-- ---------- Chat: photo paths ----------
-- chat-media paths are <job id>/<sender id>/<file>. A message may only reference a photo
-- in its own job's folder, so it cannot point at another chat's files.
drop policy messages_insert on public.messages;
create policy messages_insert on public.messages for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and public.can_chat(job_id)
    and (
      media_path is null
      or media_path ~ ('^' || job_id::text || '/[0-9a-f-]{36}/[A-Za-z0-9_-]{1,64}\.(jpg|png|webp)$')
    )
  );
