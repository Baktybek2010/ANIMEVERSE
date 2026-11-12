-- =====================================================================
-- ANIMEVERSE · 0004 · Supabase Storage: бакеты и политики
-- Ограничения размера и MIME-типов действуют на уровне бакета,
-- дополнительно файлы проверяются сервером приложения.
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('avatars',   'avatars',   true, 2097152,  array['image/jpeg', 'image/png', 'image/webp']),
  ('posters',   'posters',   true, 5242880,  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']),
  ('banners',   'banners',   true, 8388608,  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']),
  ('subtitles', 'subtitles', true, 1048576,  array['text/vtt'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Аватары: пользователь управляет только файлами в папке со своим id.
create policy "avatars_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select public.is_active_user())
  );
create policy "avatars_update_own" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "avatars_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "avatars_select_own" on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Медиа каталога: загружает и изменяет только персонал (moderator и выше).
create policy "media_select_staff" on storage.objects
  for select to authenticated
  using (bucket_id in ('posters', 'banners', 'subtitles') and (select public.current_role_level()) >= 50);
create policy "media_insert_staff" on storage.objects
  for insert to authenticated
  with check (bucket_id in ('posters', 'banners', 'subtitles') and (select public.current_role_level()) >= 50);
create policy "media_update_staff" on storage.objects
  for update to authenticated
  using (bucket_id in ('posters', 'banners', 'subtitles') and (select public.current_role_level()) >= 50)
  with check (bucket_id in ('posters', 'banners', 'subtitles') and (select public.current_role_level()) >= 50);
create policy "media_delete_staff" on storage.objects
  for delete to authenticated
  using (bucket_id in ('posters', 'banners', 'subtitles') and (select public.current_role_level()) >= 50);
