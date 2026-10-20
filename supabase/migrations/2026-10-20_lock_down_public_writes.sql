-- ============================================================================
-- ThumbFeed: stop anonymous writes
-- ============================================================================
--
-- WHY
-- The publishable ("anon") key is public by design: it ships in the browser
-- bundle. The original policies allowed that key to INSERT, UPDATE and DELETE
-- rows and storage objects, so anyone who copied the key out of the page could
-- erase the gallery without ever opening the app. This was confirmed live: an
-- INSERT and a DELETE with the publishable key both succeeded.
--
-- Every write now goes through an owner-only API route that uses the service
-- role key. The service role bypasses row-level security, so these policies do
-- not affect it. Public reading is untouched -- the gallery still works for
-- anonymous visitors.
--
-- READ THIS BEFORE RUNNING
-- 1. Set SUPABASE_SERVICE_ROLE_KEY in the hosting environment, then redeploy.
-- 2. Check that Add, Edit, Delete and "delete category" still work.
-- 3. THEN run this file in the Supabase SQL editor.
--
-- If you run this before step 1, those actions will fail: the app will have no
-- identity that is permitted to write. Nothing is lost; the actions start
-- working again as soon as the key is present.
--
-- Safe to re-run.
-- ============================================================================

begin;

alter table public.thumbnails enable row level security;
alter table public.collections enable row level security;

-- Thumbnails: keep public SELECT, remove public writes.
drop policy if exists "Allow public insert on thumbnails" on public.thumbnails;
drop policy if exists "Allow public update on thumbnails" on public.thumbnails;
drop policy if exists "Allow public delete on thumbnails" on public.thumbnails;

-- Collections: unused by the current UI, but same rule so the table cannot be
-- used as an anonymous scratchpad.
drop policy if exists "Allow public insert on collections" on public.collections;
drop policy if exists "Allow public update on collections" on public.collections;
drop policy if exists "Allow public delete on collections" on public.collections;

-- Storage: images are public to read, as they must be for the gallery to show
-- them. Uploads and deletes become service-role only.
drop policy if exists "Allow public insert on storage objects" on storage.objects;
drop policy if exists "Allow public update on storage objects" on storage.objects;
drop policy if exists "Allow public delete on storage objects" on storage.objects;

commit;
