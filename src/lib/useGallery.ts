'use client';

import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { listUploads, UPLOADS_CHANGED_EVENT } from './localUploads';
import {
  COLOR_FAMILY_ORDER,
  familiesForItem,
  familiesFromHexes,
  familyOfHex,
  type ColorFamily,
} from './colorFamilies';
import type { ThumbnailItem } from './types';
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

/** The library is now a single wall: the user's own uploads. */
export type GallerySection = 'uploads';

interface GalleryKey {
  section: GallerySection;
  search: string;
  niche: string;
  colors: string[];
  sort: string;
  seed: number;
}

/** Counts below this are noise on a category pill. */
const MIN_CATEGORY_ROWS = 2;

function seededShuffle<T>(array: T[], seed: number): T[] {
  const arr = [...array];
  if (arr.length <= 1) return arr;
  let s = (seed || 123456789) >>> 0;
  const random = () => {
    let t = (s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function matchesNiche(item: ThumbnailItem, niche: string): boolean {
  if (!niche || niche === 'All') return true;
  const needle = niche.toLowerCase();
  return (
    String(item.niche || '').toLowerCase() === needle ||
    (Array.isArray(item.tags) && item.tags.some((tag) => String(tag).toLowerCase() === needle))
  );
}

function matchesSearch(item: ThumbnailItem, search: string): boolean {
  const needle = search.toLowerCase();
  return (
    String(item.title || '').toLowerCase().includes(needle) ||
    String(item.creator || '').toLowerCase().includes(needle) ||
    String(item.ocrText || '').toLowerCase().includes(needle) ||
    String(item.niche || '').toLowerCase().includes(needle) ||
    (Array.isArray(item.tags) && item.tags.some((tag) => String(tag).toLowerCase().includes(needle)))
  );
}

function applyFilters(items: ThumbnailItem[], key: GalleryKey): ThumbnailItem[] {
  let result = items;
  if (key.niche && key.niche !== 'All') {
    result = result.filter((item) => matchesNiche(item, key.niche));
  }
  if (key.search) {
    result = result.filter((item) => matchesSearch(item, key.search));
  }
  if (key.colors.length > 0) {
    result = result.filter((item) =>
      familiesFromHexes(Array.isArray(item.colors) ? item.colors : []).some((family) =>
        key.colors.includes(family)
      )
    );
  }
  if (key.sort === 'popular') {
    result = [...result].sort((a, b) => (b.likesCount || 0) - (a.likesCount || 0));
  } else if (key.sort === 'random') {
    result = seededShuffle(result, key.seed);
  } else {
    result = [...result].sort(
      (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );
  }
  return result;
}

async function fetchGalleryPage(key: GalleryKey, page: number): Promise<GalleryPage> {
  const all = await listUploads();
  const filtered = applyFilters(all, key);
  const from = page * GALLERY_PAGE_SIZE;
  return {
    items: filtered.slice(from, from + GALLERY_PAGE_SIZE),
    total: filtered.length,
    page,
    pageSize: GALLERY_PAGE_SIZE,
  };
}

async function fetchFacets(): Promise<GalleryFacets> {
  const items = await listUploads();

  const counts = new Map<string, { label: string; count: number }>();
  const bump = (raw: unknown) => {
    const label = String(raw || '').trim();
    if (!label) return;
    const lower = label.toLowerCase();
    const hit = counts.get(lower);
    if (hit) hit.count += 1;
    else counts.set(lower, { label, count: 1 });
  };
  for (const item of items) {
    const seen = new Set<string>();
    const add = (raw: unknown) => {
      const label = String(raw || '').trim();
      if (!label) return;
      const lower = label.toLowerCase();
      if (seen.has(lower)) return;
      seen.add(lower);
      bump(label);
    };
    add(item.niche);
    if (Array.isArray(item.tags)) item.tags.forEach(add);
  }

  const nicheCounts: Record<string, number> = { All: items.length };
  for (const { label, count } of [...counts.values()].sort((a, b) => b.count - a.count)) {
    if (count < MIN_CATEGORY_ROWS) continue;
    nicheCounts[label] = count;
  }

  const byFamily = new Map<ColorFamily, Map<string, number>>();
  for (const item of items) {
    const hexes = Array.isArray(item.colors) ? item.colors : [];
    if (hexes.length === 0) continue;
    for (const family of familiesForItem({ colors: hexes })) {
      const hex = hexes.find((value) => familyOfHex(value) === family) ?? hexes[0];
      if (!byFamily.has(family)) byFamily.set(family, new Map());
      const familyCounts = byFamily.get(family)!;
      familyCounts.set(hex, (familyCounts.get(hex) || 0) + 1);
    }
  }

  const colorLibrary = COLOR_FAMILY_ORDER.flatMap((family) => {
    const familyCounts = byFamily.get(family);
    if (!familyCounts || familyCounts.size === 0) return [];
    const ranked = Array.from(familyCounts.entries()).sort((a, b) => b[1] - a[1]);
    return [
      {
        family,
        swatches: ranked.slice(0, 4).map(([hex, count]) => ({ hex, count })),
        count: ranked.reduce((sum, [, count]) => sum + count, 0),
      },
    ];
  });

  return { nicheCounts, colorLibrary, total: items.length };
}

/**
 * The gallery's state. Reads the local upload store instead of a server API,
 * so filtering and paging happen in memory over a personal-size library.
 * External changes (another tab, the admin page) invalidate through a window
 * event rather than a database subscription.
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
    staleTime: 30 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 0,
  });

  useEffect(() => {
    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey: ['gallery'] });
      queryClient.invalidateQueries({ queryKey: ['gallery-facets'] });
    };
    window.addEventListener(UPLOADS_CHANGED_EVENT, invalidate);
    return () => window.removeEventListener(UPLOADS_CHANGED_EVENT, invalidate);
  }, [queryClient]);

  return query;
}

export function useGalleryFacets(section: GallerySection) {
  return useQuery({
    queryKey: ['gallery-facets', section],
    queryFn: fetchFacets,
    staleTime: 30 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 0,
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
