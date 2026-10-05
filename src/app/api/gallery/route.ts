import { NextRequest, NextResponse } from 'next/server';
import { getAnonClient } from '../../../lib/supabaseServer';
import { parseDimensions } from '../../../lib/dimensions';
import { familiesFromHexes, type ColorFamily } from '../../../lib/colorFamilies';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Paginated gallery feed.
 *
 * Two query paths, both page-sized:
 *
 * Path A -- latest / popular with no search and no colour filter: a single
 * SQL query with .range() and an exact count. Nothing more is read.
 *
 * Path B -- search text, a colour-family filter, or the seeded random order:
 * none of these can be expressed in PostgREST (families are derived from hex
 * values in code; random needs a stable shuffle). So a light query fetches
 * only small filter columns, the remaining filtering and the shuffle happen
 * in Node, the page is sliced, and full rows for just those 36 ids are
 * fetched. The light query carries no image bytes and no colour arrays beyond
 * what filtering needs.
 *
 * Either way each request transfers one page, never the table.
 */

const PAGE_SIZE = 36;

// Columns the grid actually needs. No select('*') anywhere on this path.
const GRID_COLUMNS =
  'id,title,creator,image_url,thumb_small_url,source_url,niche,styles,tags,colors,' +
  'ocr_text,emotion,breakdown_notes,views_estimate,source,created_at,likes_count';

// Minimal columns for the Path B pre-pass.
const LIGHT_COLUMNS = 'id,title,creator,niche,tags,colors,likes_count,created_at';

function posterPredicate() {
  // Wildcards must be `*`, not `%`: PostgREST 500s on `%` in ilike patterns.
  return 'id.ilike.poster-*,breakdown_notes.ilike.*poster*,niche.eq.Cinema,source.eq.poster,image_url.ilike.*/posters/*';
}

function applySection(query: any, section: string) {
  if (section === 'posters') {
    return query.or(posterPredicate());
  }
  return query
    .not('breakdown_notes', 'ilike', '%poster%')
    .not('id', 'ilike', 'poster-%')
    .not('niche', 'eq', 'Cinema')
    .not('source', 'eq', 'poster');
}

function applySharedFilters(query: any, params: { niche: string; styles: string[]; search: string }) {
  let q = query;
  if (params.niche && params.niche !== 'All') {
    // Matches the old client behaviour: niche column or any tag, exact match.
    q = q.or(`niche.eq.${params.niche},tags.cs.{"${params.niche}"}`);
  }
  if (params.styles.length > 0) {
    q = q.overlaps('styles', params.styles);
  }
  return q;
}

function applySearch(query: any, search: string) {
  if (!search) return query;
  const esc = search.replace(/[%*,()]/g, '');
  if (!esc) return query;
  // Title, creator, niche and on-image text. Tags-substring matching lived
  // client-side before; the light-query path below covers it exactly.
  return query.or(
    `title.ilike.*${esc}*,creator.ilike.*${esc}*,niche.ilike.*${esc}*,ocr_text.ilike.*${esc}*`
  );
}

function rowToItem(row: any, section: string): any {
  const dims = parseDimensions(row.breakdown_notes);
  const isPoster =
    section === 'posters' ||
    row.id?.startsWith('poster-') ||
    row.niche === 'Cinema' ||
    row.source === 'poster';
  return {
    id: row.id,
    kind: isPoster ? 'poster' : undefined,
    title: row.title || (isPoster ? 'Movie Poster' : 'YouTube Thumbnail'),
    creator: row.creator || (isPoster ? 'Cinema' : 'YouTube Creator'),
    imageUrl: row.image_url,
    thumbSmallUrl: row.thumb_small_url || undefined,
    sourceUrl: row.source_url || row.image_url,
    niche: row.niche || (isPoster ? 'Cinema' : ''),
    styles: row.styles || [],
    tags: Array.isArray(row.tags) ? row.tags : [],
    colors: Array.isArray(row.colors) ? row.colors : [],
    width: dims?.width,
    height: dims?.height,
    ocrText: row.ocr_text || '',
    emotion: row.emotion || 'Curious',
    breakdownNotes: row.breakdown_notes || '',
    viewsEstimate: row.views_estimate || '',
    source: row.source || 'supabase-storage',
    createdAt: row.created_at || new Date().toISOString(),
    likesCount: row.likes_count || 0,
  };
}

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

function matchesSearch(row: any, q: string): boolean {
  const needle = q.toLowerCase();
  return (
    (row.title || '').toLowerCase().includes(needle) ||
    (row.creator || '').toLowerCase().includes(needle) ||
    (row.ocr_text || '').toLowerCase().includes(needle) ||
    (Array.isArray(row.tags) && row.tags.some((t: string) => (t || '').toLowerCase().includes(needle))) ||
    (row.niche || '').toLowerCase().includes(needle)
  );
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const section = url.searchParams.get('section') === 'posters' ? 'posters' : 'thumbnails';
    const search = (url.searchParams.get('search') || '').trim();
    const niche = url.searchParams.get('niche') || 'All';
    const styles = (url.searchParams.get('styles') || '').split(',').map((s) => s.trim()).filter(Boolean);
    const colors = (url.searchParams.get('colors') || '').split(',').map((s) => s.trim()).filter(Boolean) as ColorFamily[];
    const sort = url.searchParams.get('sort') || 'random';
    const seed = Number(url.searchParams.get('seed') || 882391) || 882391;
    const page = Math.max(0, Number(url.searchParams.get('page') || 0) || 0);
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const supabase = getAnonClient();
    const needsNodePass = search.length > 0 || colors.length > 0 || sort === 'random';

    if (!needsNodePass) {
      // Path A: pure SQL pagination.
      let query = supabase.from('thumbnails').select(GRID_COLUMNS, { count: 'exact' });
      query = applySection(query, section);
      query = applySharedFilters(query, { niche, styles, search: '' });
      query = sort === 'popular'
        ? query.order('likes_count', { ascending: false })
        : query.order('created_at', { ascending: false });
      const { data, error, count } = await query.range(from, to);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({
        items: (data || []).map((row: any) => rowToItem(row, section)),
        total: count ?? 0,
        page,
        pageSize: PAGE_SIZE,
      });
    }

    // Path B: light pre-pass, then Node filtering/shuffle, then one page fetch.
    let light = supabase.from('thumbnails').select(LIGHT_COLUMNS);
    light = applySection(light, section);
    light = applySharedFilters(light, { niche, styles, search: '' });
    const { data: lightRows, error: lightError } = await light.limit(5000);
    if (lightError) {
      return NextResponse.json({ error: lightError.message }, { status: 500 });
    }

    let candidates = lightRows || [];
    if (search) candidates = candidates.filter((row: any) => matchesSearch(row, search));
    if (colors.length > 0) {
      candidates = candidates.filter((row: any) =>
        familiesFromHexes(Array.isArray(row.colors) ? row.colors : []).some((family: ColorFamily) =>
          colors.includes(family)
        )
      );
    }
    if (sort === 'popular') {
      candidates = [...candidates].sort((a: any, b: any) => (b.likes_count || 0) - (a.likes_count || 0));
    } else if (sort === 'random') {
      candidates = seededShuffle(candidates, seed);
    } else {
      candidates = [...candidates].sort(
        (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    }

    const total = candidates.length;
    const pageIds = candidates.slice(from, from + PAGE_SIZE).map((row: any) => row.id);
    if (pageIds.length === 0) {
      return NextResponse.json({ items: [], total, page, pageSize: PAGE_SIZE });
    }

    const { data: pageRows, error: pageError } = await supabase
      .from('thumbnails')
      .select(GRID_COLUMNS)
      .in('id', pageIds);
    if (pageError) {
      return NextResponse.json({ error: pageError.message }, { status: 500 });
    }

    // Restore page order: .in() returns rows in table order, not ours.
    const byId = new Map((pageRows || []).map((row: any) => [row.id, row]));
    const items = pageIds.map((id: string) => byId.get(id)).filter(Boolean).map((row: any) => rowToItem(row, section));

    return NextResponse.json({ items, total, page, pageSize: PAGE_SIZE });
  } catch (err: any) {
    console.error('Gallery feed error:', err);
    return NextResponse.json({ error: err.message || 'Failed to load gallery' }, { status: 500 });
  }
}
