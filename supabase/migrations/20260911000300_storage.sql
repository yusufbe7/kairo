-- =====================================================================
-- Kairo — private media bucket
-- Objects live at '<workspace_id>/<uuid>.<ext>'. Access is granted by
-- workspace membership; files are served via short-lived signed URLs.
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'media', 'media', false, 209715200,  -- 200 MB (raise together with MEDIA_MAX_BYTES and your Supabase plan limit)
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/quicktime', 'video/webm']
)
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy media_objects_read on storage.objects for select to authenticated
  using (bucket_id = 'media' and exists (
    select 1 from public.workspace_members m
    where m.user_id = auth.uid() and m.workspace_id::text = (storage.foldername(name))[1]));

create policy media_objects_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and exists (
    select 1 from public.workspace_members m join public.roles r on r.key = m.role
    where m.user_id = auth.uid() and m.workspace_id::text = (storage.foldername(name))[1] and r.rank >= 20));

create policy media_objects_delete on storage.objects for delete to authenticated
  using (bucket_id = 'media' and exists (
    select 1 from public.workspace_members m join public.roles r on r.key = m.role
    where m.user_id = auth.uid() and m.workspace_id::text = (storage.foldername(name))[1] and r.rank >= 20));
