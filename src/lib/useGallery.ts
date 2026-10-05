'use client';

import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from './supabase';
import type { FilterState, ThumbnailItem } from './types';
import type { ColorLibraryEntry } from '../components/FilterPillBar';

export const GALLERY_PAGE_SIZE = 36;

export interface GalleryPage {
  items: ThumbnailItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface GalleryFacets {
  nicheCounts: Record<string, number>;
  colorLibrary: ColorLibraryEntry[];
  total: number;
}

interface GalleryKey {
  section: 'thumbnails' | 'posters';
  search: string;
  niche: string;
  styles: string[];
  colors: string[];
  sort: string;
  seed: number;
}

function buildParams(key: GalleryKey, page: number): string {
  const params = new URLSearchParams({
    section: key.section,
    search: key.search,
    niche: key.niche,
    styles: key.styles.join(','),
    colors: key.colors.join(','),
    sort: key.sort,
    seed: String(key.seed),
    page: String(page),
  });
  return params.toString();
}

async function fetchGalleryPage(key: GalleryKey, page: number): Promise<GalleryPage> {
  const res = await fetch(`/api/gallery?${buildParams(key, page)}`);
  if (!res.ok) throw new Error(`Gallery request failed: ${res.status}`);
  return res.json();
}

async function fetchFacets(section: 'thumbnails' | 'posters'): Promise<GalleryFacets> {
  const res = await fetch(`/api/gallery/facets?section=${section}`);
  if (!res.ok) throw new Error(`Facets request failed: ${res.status}`);
  return res.json();
}

/**
 * The gallery's server state.
 *
 * Pages of 36 arrive via .range() and accumulate as the user scrolls. A page
 * is metadata for 36 tiles -- tens of kilobytes, not the megabytes the old
 * full-table syncs moved. staleTime keeps a visited filter set from
 * re-downloading for five minutes; refetchOnWindowFocus stays off because a
 * focus event is not new data. Live updates still arrive through the realtime
 * channel below, which invalidates rather than polls.
 */
export function useGallery(key: GalleryKey) {
  const queryClient = useQueryClient();

  const query = useInfiniteQuery({
    queryKey: ['gallery', key],
    queryFn: ({ pageParam = 0 }) => fetchGalleryPage(key, pageParam),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      const loaded = (lastPage.page + 1) * lastPage.pageSize;
      return loaded < lastPage.total ? lastPage.page + 1 : undefined;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 2,
  });

  // Realtime stays: an insert/update/delete anywhere invalidates the feed, so
  // extension uploads and other sessions appear without any polling loop.
  useEffect(() => {
    if (!supabase) return;
    const channel = supabase
      .channel('realtime:gallery_feed')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'thumbnails' }, () => {
        queryClient.invalidateQueries({ queryKey: ['gallery'] });
        queryClient.invalidateQueries({ queryKey: ['gallery-facets'] });
      })
      .subscribe();
    return () => {
      if (supabase) supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return query;
}

export function useGalleryFacets(section: 'thumbnails' | 'posters') {
  return useQuery({
    queryKey: ['gallery-facets', section],
    queryFn: () => fetchFacets(section),
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 1,
  });
}

/** Drop every cached gallery page, e.g. right after an upload lands. */
export function useInvalidateGallery() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ['gallery'] });
    queryClient.invalidateQueries({ queryKey: ['gallery-facets'] });
  };
}
