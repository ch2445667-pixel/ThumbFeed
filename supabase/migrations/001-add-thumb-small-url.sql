-- Add grid-sized image URLs for egress reduction.
--
-- HOW TO RUN: Supabase dashboard -> SQL Editor -> paste this file -> Run.
-- It only ADDS a column; nothing existing is modified or deleted.
--
-- The app serves a 400px WebP (`thumb_small_url`) in the grid and loads the
-- full original only when a tile is clicked. Without this column the upload
-- route cannot store the small URL and the grid falls back to full images.

alter table public.thumbnails
  add column if not exists thumb_small_url text default null;

-- Old Supabase image_url values are preserved here if a future migration
-- ever rewrites image_url itself. Nothing writes to it yet.
alter table public.thumbnails
  add column if not exists image_url_backup text default null;
