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

-- 3. Enable Row Level Security (RLS) - Public Read & Write
ALTER TABLE public.thumbnails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access on thumbnails"
  ON public.thumbnails FOR SELECT USING (true);

CREATE POLICY "Allow public insert on thumbnails"
  ON public.thumbnails FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update on thumbnails"
  ON public.thumbnails FOR UPDATE USING (true);

CREATE POLICY "Allow public delete on thumbnails"
  ON public.thumbnails FOR DELETE USING (true);

CREATE POLICY "Allow public read access on collections"
  ON public.collections FOR SELECT USING (true);

CREATE POLICY "Allow public insert on collections"
  ON public.collections FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update on collections"
  ON public.collections FOR UPDATE USING (true);

CREATE POLICY "Allow public delete on collections"
  ON public.collections FOR DELETE USING (true);
