'use client';

import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ThumbnailItem } from './types';
import type { ColorLibraryEntry } from '../components/FilterPillBar';
import { getStoredThumbnails } from './storage';

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
  try {
    const res = await fetch(`/api/gallery?${buildParams(key, page)}`);
    if (!res.ok) throw new Error(`Gallery request failed: ${res.status}`);
    const data: GalleryPage = await res.json();
    if ((!data.items || data.items.length === 0) && typeof window !== 'undefined') {
      const local = getStoredThumbnails();
      if (local && local.length > 0) {
        let filtered = local;
        if (key.niche && key.niche !== 'All') {
          filtered = filtered.filter(item => item.niche === key.niche || item.tags?.includes(key.niche));
        }
        if (key.search) {
          const s = key.search.toLowerCase();
          filtered = filtered.filter(item => item.title?.toLowerCase().includes(s) || item.creator?.toLowerCase().includes(s));
        }
        return {
          items: filtered,
          total: filtered.length,
          page: 0,
          pageSize: GALLERY_PAGE_SIZE
        };
      }
    }
    return data;
  } catch {
    if (typeof window !== 'undefined') {
      const local = getStoredThumbnails();
      return {
        items: local,
        total: local.length,
        page: 0,
        pageSize: GALLERY_PAGE_SIZE
      };
    }
    return { items: [], total: 0, page: 0, pageSize: GALLERY_PAGE_SIZE };
  }
}

async function fetchFacets(section: 'thumbnails' | 'posters'): Promise<GalleryFacets> {
  const res = await fetch(`/api/gallery/facets?section=${section}`);
  if (!res.ok) throw new Error(`Facets request failed: ${res.status}`);
  return res.json();
}

/**
 * The gallery's server state.
 *
 * Pages of 36 arrive via pagination and accumulate as the user scrolls.
 */
export function useGallery(key: GalleryKey) {
  return useInfiniteQuery({
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
