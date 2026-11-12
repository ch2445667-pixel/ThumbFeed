import { NextRequest, NextResponse } from 'next/server';
import { getAllGalleryItems } from '../../../lib/galleryService';
import { familiesFromHexes, type ColorFamily } from '../../../lib/colorFamilies';
import { ThumbnailItem } from '../../../lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PAGE_SIZE = 36;

/** Deterministic shuffle shared with the client so page order is stable. */
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
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function matchesSearch(item: ThumbnailItem, q: string): boolean {
  const needle = q.toLowerCase();
  return (
    (item.title || '').toLowerCase().includes(needle) ||
    (item.creator || '').toLowerCase().includes(needle) ||
    (item.ocrText || '').toLowerCase().includes(needle) ||
    (Array.isArray(item.tags) && item.tags.some((t: string) => (t || '').toLowerCase().includes(needle))) ||
    (item.niche || '').toLowerCase().includes(needle)
  );
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const search = (url.searchParams.get('search') || '').trim();
    const niche = url.searchParams.get('niche') || 'All';
    const styles = (url.searchParams.get('styles') || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const colors = (url.searchParams.get('colors') || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean) as ColorFamily[];
    const sort = url.searchParams.get('sort') || 'random';
    const seed = Number(url.searchParams.get('seed') || 882391) || 882391;
    const page = Math.max(0, Number(url.searchParams.get('page') || 0) || 0);
    const from = page * PAGE_SIZE;

    const allItems = await getAllGalleryItems();

    // 1. Filter by niche
    let filtered = allItems;
    if (niche && niche !== 'All') {
      const lowerNiche = niche.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          (item.niche || '').toLowerCase() === lowerNiche ||
          (item.tags || []).some((t) => (t || '').toLowerCase() === lowerNiche)
      );
    }

    // 2. Filter by styles
    if (styles.length > 0) {
      filtered = filtered.filter((item) =>
        (item.styles || []).some((st) => styles.includes(st))
      );
    }

    // 3. Filter by search query
    if (search) {
      filtered = filtered.filter((item) => matchesSearch(item, search));
    }

    // 4. Filter by color families
    if (colors.length > 0) {
      filtered = filtered.filter((item) =>
        familiesFromHexes(item.colors || []).some((family) => colors.includes(family))
      );
    }

    // 5. Sort
    if (sort === 'popular') {
      filtered = [...filtered].sort((a, b) => (b.likesCount || 0) - (a.likesCount || 0));
    } else if (sort === 'random') {
      filtered = seededShuffle(filtered, seed);
    } else {
      // Latest
      filtered = [...filtered].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    }

    const total = filtered.length;
    const pageItems = filtered.slice(from, from + PAGE_SIZE);

    return NextResponse.json({
      items: pageItems,
      total,
      page,
      pageSize: PAGE_SIZE,
    });
  } catch (err: unknown) {
    console.error('Gallery feed error:', err);
    return NextResponse.json({ items: [], total: 0, page: 0, pageSize: PAGE_SIZE });
  }
}
