-- Find a Fixer: every state change runs here, on the server, in one transaction.
-- Functions raise short error codes (e.g. JOB_TAKEN); the app maps them to friendly text.

create function public.require_user() returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  return v_uid;
end;
$$;

create function public.require_admin() returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'NOT_ADMIN';
  end if;
end;
$$;

-- Start of the current calendar month in Darwin time (billing months follow local time).
create function public.darwin_month_start() returns timestamptz
language sql stable set search_path = '' as $$
  select date_trunc('month', now() at time zone 'Australia/Darwin') at time zone 'Australia/Darwin'
$$;

-- ---------- Customer: post a job ----------
-- The app generates the job id first so photos can upload to <user>/<job>/ before this
-- call; the job, its private details and its media rows are then created together.
create function public.post_job(
  p_id uuid,
  p_category text,
  p_title text,
  p_description text,
  p_suburb text,
  p_address text,
  p_urgency public.job_urgency,
  p_media jsonb default '[]'::jsonb
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := public.require_user();
  v_phone text;
  v_item jsonb;
  v_path text;
  v_type text;
  v_videos integer := 0;
begin
  select u.phone into v_phone
  from auth.users u
  where u.id = v_uid and u.phone_confirmed_at is not null;
  if v_phone is null or v_phone = '' then
    raise exception 'PHONE_NOT_VERIFIED';
  end if;

  if not exists (select 1 from public.profiles where id = v_uid and role = 'customer') then
    raise exception 'ONLY_CUSTOMERS';
  end if;
  if p_id is null then
    raise exception 'INVALID_INPUT';
  end if;
  if not (p_category = any (public.trade_list())) then
    raise exception 'INVALID_CATEGORY';
  end if;
  if not (p_suburb = any (public.suburb_list())) then
    raise exception 'INVALID_SUBURB';
  end if;

  -- Spam guard: 5 jobs an hour, 20 a day per customer.
  if (select count(*) from public.jobs
      where customer_id = v_uid and created_at > now() - interval '1 hour') >= 5
     or (select count(*) from public.jobs
         where customer_id = v_uid and created_at > now() - interval '1 day') >= 20 then
    raise exception 'RATE_LIMITED';
  end if;

  if jsonb_typeof(p_media) <> 'array' or jsonb_array_length(p_media) > 6 then
    raise exception 'INVALID_MEDIA';
  end if;

  insert into public.jobs (id, customer_id, category, title, description, suburb, urgency)
  values (p_id, v_uid, p_category, btrim(p_title), btrim(p_description), p_suburb, p_urgency);

  insert into public.job_private (job_id, address, contact_phone)
  values (p_id, btrim(p_address), v_phone);

  for v_item in select * from jsonb_array_elements(p_media) loop
    v_path := v_item ->> 'path';
    v_type := v_item ->> 'type';
    -- Paths must sit in this user's folder for this job, with an allowed extension.
    if v_path is null
       or v_path !~ ('^' || v_uid::text || '/' || p_id::text || '/[A-Za-z0-9_-]{1,64}\.(jpg|png|webp|mp4|mov)$')
       or v_type not in ('photo', 'video') then
      raise exception 'INVALID_MEDIA';
    end if;
    if v_type = 'video' then
      v_videos := v_videos + 1;
      if v_videos > 2 then
        raise exception 'INVALID_MEDIA';
      end if;
    end if;
    insert into public.job_media (job_id, storage_path, media_type)
    values (p_id, v_path, v_type::public.media_type);
  end loop;

  return p_id;
exception
  when check_violation or not_null_violation or string_data_right_truncation then
    raise exception 'INVALID_INPUT';
  when unique_violation then
    raise exception 'DUPLICATE';
end;
$$;

create function public.cancel_job(p_job_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := public.require_user();
begin
  update public.jobs set status = 'cancelled'
  where id = p_job_id and customer_id = v_uid and status = 'posted';
  if not found then
    -- Once a company has accepted, a lead exists; cancelling then is a dispute for admin.
    raise exception 'JOB_NOT_CANCELLABLE';
  end if;
end;
$$;

-- ---------- Company: register, accept, decline ----------
create function public.register_company(
  p_name text,
  p_abn text,
  p_licence_number text,
  p_insurance_provider text,
  p_insurance_expiry date,
  p_trades text[],
  p_service_areas text[]
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := public.require_user();
  v_id uuid;
begin
  if exists (select 1 from public.profiles where id = v_uid and role = 'admin') then
    raise exception 'INVALID_INPUT';
  end if;
  if exists (select 1 from public.companies where owner_id = v_uid) then
    raise exception 'COMPANY_EXISTS';
  end if;
  if p_trades is null or p_service_areas is null
     or not (p_trades <@ public.trade_list())
     or not (p_service_areas <@ public.suburb_list()) then
    raise exception 'INVALID_INPUT';
  end if;
  if p_insurance_expiry is null or p_insurance_expiry < current_date then
    raise exception 'INSURANCE_EXPIRED';
  end if;

  insert into public.companies
    (owner_id, name, abn, licence_number, insurance_provider, insurance_expiry, trades, service_areas)
  values
    (v_uid, btrim(p_name), nullif(btrim(coalesce(p_abn, '')), ''), btrim(p_licence_number),
     btrim(p_insurance_provider), p_insurance_expiry,
     (select array_agg(distinct t) from unnest(p_trades) t),
     (select array_agg(distinct s) from unnest(p_service_areas) s))
  returning id into v_id;

  update public.profiles set role = 'company', display_name = btrim(p_name) where id = v_uid;
  return v_id;
exception
  when check_violation or not_null_violation then
    raise exception 'INVALID_INPUT';
end;
$$;

-- Accepting a job is the moment a lead is created. Both happen in the same transaction,
-- under a row lock, so two companies can never take the same job and no acceptance can
-- exist without its lead.
create function public.accept_job(p_job_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := public.require_user();
  v_company public.companies%rowtype;
  v_job public.jobs%rowtype;
  v_lead_id uuid;
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

  if (select count(*) from public.leads
      where company_id = v_company.id and created_at >= public.darwin_month_start())
     >= v_company.monthly_lead_limit then
    raise exception 'LEAD_LIMIT_REACHED';
  end if;

  update public.jobs
  set status = 'accepted', company_id = v_company.id, accepted_at = now()
  where id = p_job_id;

  insert into public.leads (job_id, company_id) values (p_job_id, v_company.id)
  returning id into v_lead_id;
  return v_lead_id;
end;
$$;

create function public.decline_job(p_job_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := public.require_user();
  v_company_id uuid;
begin
  select id into v_company_id from public.companies where owner_id = v_uid and status = 'approved';
  if v_company_id is null then
    raise exception 'COMPANY_NOT_APPROVED';
  end if;
  if not exists (
    select 1 from public.jobs j
    where j.id = p_job_id and j.status = 'posted'
      and public.company_matches_job(j.category, j.suburb)
  ) then
    raise exception 'JOB_NOT_FOUND';
  end if;
  insert into public.job_declines (job_id, company_id) values (p_job_id, v_company_id)
  on conflict do nothing;
end;
$$;

-- ---------- Quotes ----------
create function public.send_quote(
  p_job_id uuid,
  p_amount_cents integer,
  p_notes text,
  p_proposed_time timestamptz
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := public.require_user();
  v_company_id uuid;
  v_job public.jobs%rowtype;
  v_id uuid;
begin
  select id into v_company_id from public.companies where owner_id = v_uid;
  select * into v_job from public.jobs where id = p_job_id for update;
  if not found or v_company_id is null or v_job.company_id is distinct from v_company_id then
    raise exception 'JOB_NOT_FOUND';
  end if;
  if v_job.status <> 'accepted' then
    raise exception 'JOB_NOT_QUOTABLE';
  end if;
  if p_proposed_time is null or p_proposed_time <= now()
     or p_proposed_time > now() + interval '90 days' then
    raise exception 'INVALID_TIME';
  end if;

  insert into public.quotes (job_id, company_id, amount_cents, notes, proposed_time)
  values (p_job_id, v_company_id, p_amount_cents, nullif(btrim(coalesce(p_notes, '')), ''), p_proposed_time)
  returning id into v_id;
  return v_id;
exception
  when unique_violation then
    raise exception 'QUOTE_PENDING';
  when check_violation or not_null_violation then
    raise exception 'INVALID_INPUT';
end;
$$;

create function public.respond_to_quote(p_quote_id uuid, p_accept boolean) returns void
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
  else
    -- The job stays with the company, which can send a revised quote.
    update public.quotes set status = 'declined', responded_at = now() where id = p_quote_id;
  end if;
end;
$$;

create function public.complete_job(p_job_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := public.require_user();
begin
  update public.jobs set status = 'completed', completed_at = now()
  where id = p_job_id
    and status = 'scheduled'
    and company_id = (select id from public.companies where owner_id = v_uid);
  if not found then
    raise exception 'JOB_NOT_COMPLETABLE';
  end if;
end;
$$;

-- ---------- Admin ----------
create function public.admin_set_company_status(p_company_id uuid, p_status public.company_status)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.require_admin();
  update public.companies
  set status = p_status,
      approved_at = case when p_status = 'approved' then coalesce(approved_at, now()) else approved_at end
  where id = p_company_id;
  if not found then
    raise exception 'COMPANY_NOT_FOUND';
  end if;
end;
$$;

create function public.admin_set_lead_limit(p_company_id uuid, p_limit integer) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.require_admin();
  if p_limit is null or p_limit < 0 or p_limit > 10000 then
    raise exception 'INVALID_INPUT';
  end if;
  update public.companies set monthly_lead_limit = p_limit where id = p_company_id;
  if not found then
    raise exception 'COMPANY_NOT_FOUND';
  end if;
end;
$$;

create function public.admin_set_lead_counted(p_lead_id uuid, p_counted boolean, p_note text)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.require_admin();
  update public.leads
  set counted = p_counted, admin_note = nullif(left(btrim(coalesce(p_note, '')), 500), '')
  where id = p_lead_id;
  if not found then
    raise exception 'LEAD_NOT_FOUND';
  end if;
end;
$$;

-- Lead counts per company for an invoicing period. Dates are Darwin calendar days, inclusive.
create function public.admin_lead_summary(p_from date, p_to date)
returns table (company_id uuid, company_name text, leads_total bigint, leads_counted bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.require_admin();
  return query
    select c.id, c.name,
           count(l.id),
           count(l.id) filter (where l.counted)
    from public.companies c
    left join public.leads l
      on l.company_id = c.id
     and l.created_at >= (p_from::timestamp at time zone 'Australia/Darwin')
     and l.created_at < ((p_to + 1)::timestamp at time zone 'Australia/Darwin')
    group by c.id, c.name
    order by c.name;
end;
$$;

-- Lock down execution: nothing for signed-out visitors, everything above for signed-in
-- users (each function checks who is calling).
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;
revoke execute on function public.handle_new_user() from authenticated;
