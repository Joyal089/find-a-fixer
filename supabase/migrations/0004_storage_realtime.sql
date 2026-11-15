-- Find a Fixer: private storage buckets with type and size limits, and realtime.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  -- Photos and short videos of the job. 50 MB is also the Supabase free-tier ceiling.
  ('job-media', 'job-media', false, 52428800,
   array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime']),
  -- Chat photos are compressed in the app first, so 5 MB is generous.
  ('chat-media', 'chat-media', false, 5242880,
   array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- job-media paths: <customer id>/<job id>/<file>
create policy job_media_upload on storage.objects for insert to authenticated
  with check (
    bucket_id = 'job-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Readable by the uploader, and by anyone who can see the job row (jobs RLS applies
-- inside this sub-query, so the rules stay in one place).
create policy job_media_read on storage.objects for select to authenticated
  using (
    bucket_id = 'job-media'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or exists (
        select 1 from public.jobs j where j.id::text = (storage.foldername(name))[2]
      )
    )
  );

-- chat-media paths: <job id>/<sender id>/<file>
create policy chat_media_upload on storage.objects for insert to authenticated
  with check (
    bucket_id = 'chat-media'
    and (storage.foldername(name))[2] = (select auth.uid())::text
    and public.can_chat(((storage.foldername(name))[1])::uuid)
  );

create policy chat_media_read on storage.objects for select to authenticated
  using (
    bucket_id = 'chat-media'
    and public.is_job_party(((storage.foldername(name))[1])::uuid)
  );

-- Realtime: chat messages, plus job and quote changes so both sides update live.
-- Realtime checks the SELECT policies above before delivering a row to a subscriber.
alter publication supabase_realtime add table public.messages, public.jobs, public.quotes;
