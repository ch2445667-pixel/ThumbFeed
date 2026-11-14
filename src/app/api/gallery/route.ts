import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAllGalleryItems } from '../../../lib/galleryService';
import { familiesFromHexes, type ColorFamily } from '../../../lib/colorFamilies';
import { ThumbnailItem } from '../../../lib/types';
import { getClientIp, safeErrorResponse } from '../../../lib/serverAuth';
import { checkRateLimit, rateLimitResponse } from '../../../lib/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEFAULT_PAGE_SIZE = 36;
const MAX_PAGE_SIZE = 100;

const galleryQuerySchema = z.object({
  search: z.string().max(200).optional().default(''),
  niche: z.string().max(80).optional().default('All'),
  styles: z.string().max(500).optional().default(''),
  colors: z.string().max(300).optional().default(''),
  sort: z.enum(['latest', 'popular', 'random']).optional().default('random'),
  seed: z.coerce.number().int().min(1).max(2_147_483_647).optional().default(882391),
  page: z.coerce.number().int().min(0).max(1000).optional().default(0),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).optional().default(DEFAULT_PAGE_SIZE),
});

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
    const ip = getClientIp(req);
    const rl = await checkRateLimit({
      key: `gallery-get:${ip}`,
      limit: 120,
      windowMs: 60 * 1000,
    });
    if (!rl.allowed) return rateLimitResponse(rl.retryAfterSeconds);

    const url = new URL(req.url);
    const parsed = galleryQuerySchema.safeParse({
      search: url.searchParams.get('search') ?? undefined,
      niche: url.searchParams.get('niche') ?? undefined,
      styles: url.searchParams.get('styles') ?? undefined,
      colors: url.searchParams.get('colors') ?? undefined,
      sort: url.searchParams.get('sort') ?? undefined,
      seed: url.searchParams.get('seed') ?? undefined,
      page: url.searchParams.get('page') ?? undefined,
      pageSize: url.searchParams.get('pageSize') ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid gallery query parameters' }, { status: 400 });
    }

    const search = parsed.data.search.trim();
    const niche = parsed.data.niche.trim() || 'All';
    const styles = parsed.data.styles
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 20);
    const colors = parsed.data.colors
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 20) as ColorFamily[];
    const { sort, seed, page, pageSize } = parsed.data;
    const from = page * pageSize;

    const allItems = await getAllGalleryItems();

    let filtered = allItems;
    if (niche && niche !== 'All') {
      const lowerNiche = niche.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          (item.niche || '').toLowerCase() === lowerNiche ||
          (item.tags || []).some((t) => (t || '').toLowerCase() === lowerNiche)
      );
    }

    if (styles.length > 0) {
      filtered = filtered.filter((item) =>
        (item.styles || []).some((st) => styles.includes(st))
      );
    }

    if (search) {
      filtered = filtered.filter((item) => matchesSearch(item, search));
    }

    if (colors.length > 0) {
      filtered = filtered.filter((item) =>
        familiesFromHexes(item.colors || []).some((family) => colors.includes(family))
      );
    }

    if (sort === 'popular') {
      filtered = [...filtered].sort((a, b) => (b.likesCount || 0) - (a.likesCount || 0));
    } else if (sort === 'random') {
      filtered = seededShuffle(filtered, seed);
    } else {
      filtered = [...filtered].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    }

    const total = filtered.length;
    const pageItems = filtered.slice(from, from + pageSize);

    return NextResponse.json({
      items: pageItems,
      total,
      page,
      pageSize,
    });
  } catch (err: unknown) {
    return safeErrorResponse(err, 'Failed to load gallery items');
  }
}
