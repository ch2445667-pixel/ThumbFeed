-- ==============================================================================
-- THUMBSY / THUMBVAULT - SUPABASE DATABASE SCHEMA (PostgreSQL)
-- Copy and paste this entire script into your Supabase SQL Editor and click RUN
-- ==============================================================================

-- 1. Create Thumbnails Table
CREATE TABLE IF NOT EXISTS public.thumbnails (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  creator TEXT DEFAULT 'YouTube Creator',
  image_url TEXT NOT NULL,
  source_url TEXT,
  niche TEXT NOT NULL,
  styles TEXT[] DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  colors TEXT[] DEFAULT '{}',
  ocr_text TEXT DEFAULT '',
  emotion TEXT DEFAULT 'Curious',
  breakdown_notes TEXT DEFAULT '',
  views_estimate TEXT DEFAULT '1M+',
  source TEXT DEFAULT 'curated',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  likes_count INT DEFAULT 0
);

-- 2. Create Collections / Moodboards Table
CREATE TABLE IF NOT EXISTS public.collections (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  thumbnail_ids TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  color_theme TEXT DEFAULT '#6366f1'
);

-- 3. Enable Row Level Security (RLS) - Public Read, Owner-only Write
--
-- The publishable key is public: it ships in the browser bundle. A policy that
-- lets it write means anyone who copies the key can insert or delete rows
-- without opening the app. Reads stay public because the gallery is a public
-- wall; every mutation goes through an owner-only API route that uses
-- SUPABASE_SERVICE_ROLE_KEY, which bypasses RLS.
-- Existing projects: run supabase/migrations/2026-10-20_lock_down_public_writes.sql
ALTER TABLE public.thumbnails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access on thumbnails"
  ON public.thumbnails FOR SELECT USING (true);

CREATE POLICY "Allow public read access on collections"
  ON public.collections FOR SELECT USING (true);

-- No public INSERT/UPDATE/DELETE policies on either table: writes are
-- service-role only.

-- 4. Enable Row Level Security (RLS) on Storage for public reads only.
DO $$
BEGIN
  -- Storage object read access
  DROP POLICY IF EXISTS "Allow public read access on storage objects" ON storage.objects;
  CREATE POLICY "Allow public read access on storage objects"
    ON storage.objects FOR SELECT USING (true);

  -- No public insert/update/delete: uploads and removals go through the
  -- service role in the API routes.
  DROP POLICY IF EXISTS "Allow public insert on storage objects" ON storage.objects;
  DROP POLICY IF EXISTS "Allow public update on storage objects" ON storage.objects;
  DROP POLICY IF EXISTS "Allow public delete on storage objects" ON storage.objects;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;
