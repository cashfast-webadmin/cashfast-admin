-- Fix avatars storage RLS: use auth.jwt()->>'sub' per Supabase docs; add SELECT/UPDATE for upsert
drop policy if exists "Users can upload own avatar" on storage.objects;
drop policy if exists "Users can update own avatar" on storage.objects;
drop policy if exists "Users can delete own avatar" on storage.objects;

-- INSERT: first path segment must equal current user's id (from JWT sub)
create policy "Users can upload own avatar"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.jwt()->>'sub')
);

-- SELECT: required for upsert (client reads after upload); allow own folder or owner
create policy "Users can select own avatar"
on storage.objects for select
to authenticated
using (
  bucket_id = 'avatars'
  and (
    (storage.foldername(name))[1] = (select auth.jwt()->>'sub')
    or owner_id = (auth.uid())::text
  )
);

-- UPDATE: for overwrite (upsert)
create policy "Users can update own avatar"
on storage.objects for update
to authenticated
using (
  bucket_id = 'avatars'
  and (
    (storage.foldername(name))[1] = (select auth.jwt()->>'sub')
    or owner_id = (auth.uid())::text
  )
);

-- DELETE: remove own avatar
create policy "Users can delete own avatar"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'avatars'
  and (
    (storage.foldername(name))[1] = (select auth.jwt()->>'sub')
    or owner_id = (auth.uid())::text
  )
);
