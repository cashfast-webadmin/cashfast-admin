-- Blog featured images bucket (public read; authenticated upload; path = orgId/filename)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'blog-images',
  'blog-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- RLS: authenticated users can insert/select/update/delete in blog-images (app uses orgId in path)
create policy "Authenticated can insert blog images"
on storage.objects for insert
to authenticated
with check (bucket_id = 'blog-images');

create policy "Public read blog images"
on storage.objects for select
to public
using (bucket_id = 'blog-images');

create policy "Authenticated can update blog images"
on storage.objects for update
to authenticated
using (bucket_id = 'blog-images');

create policy "Authenticated can delete blog images"
on storage.objects for delete
to authenticated
using (bucket_id = 'blog-images');
