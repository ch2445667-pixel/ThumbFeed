import { NextRequest, NextResponse } from 'next/server';
import { getAnonClient } from '../../../../lib/supabaseServer';
import { COLOR_FAMILY_ORDER, familyOfHex, familiesForItem, type ColorFamily } from '../../../../lib/colorFamilies';
import { customUploadPredicate, excludeOtherWalls } from '../../../../lib/customUploads';

/**
 * Categories are no longer a fixed list. They are assigned per thumbnail from
 * the video title, so the filter has to offer whatever is actually in use --
 * anything hardcoded here would hide real categories and invent empty ones.
 *
 * A minimum count keeps the bar readable: a category carried by one thumbnail
 * out of ~8k is noise, not a browse axis. The gallery route matches on
 * `niche.eq.X,tags.cs.{"X"}`, so both the column and the tags are folded in,
 * de-duplicated per row so one thumbnail counts once per category.
 */
const MIN_CATEGORY_ROWS = 8;

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Section-level aggregates for the filter panel: niche counts and the colour
 * library (real extracted hexes per family, ranked by usage).
 *
 * Deliberately independent of search/sort/filters, matching the old client
 * behaviour where counts were computed over the whole wall. Small columns
 * only, cached client-side for ten minutes, so this costs one light query per
 * section per session at most.
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const sectionParam = url.searchParams.get('section');
    const section =
      sectionParam === 'posters' ? 'posters' : sectionParam === 'uploads' ? 'uploads' : 'thumbnails';
    const supabase = getAnonClient();

    // PostgREST caps a single response at max-rows (1000 on this project), so
    // a plain .limit(5000) silently returns only the first thousand rows and
    // every count below is wrong. Page through with offset instead.
    //
    // These pages are issued concurrently. Sequential paging cost one full
    // round trip per 1000 rows, which put the thumbnails wall at roughly ten
    // seconds -- long enough that the filter panel opened looking empty. The
    // offsets are disjoint and the ordering is stable, so parallel fetches
    // return exactly the same set of rows as the serial version.
    const PAGE = 1000;
    const MAX_ROWS = 20000;

    const buildQuery = (withCount: boolean) => {
      let query = supabase
        .from('thumbnails')
        .select('id,niche,tags,colors', withCount ? { count: 'exact' } : undefined);
      if (section === 'posters') {
        query = query.or(
          'id.ilike.poster-*,breakdown_notes.ilike.*poster*,niche.eq.Cinema,source.eq.poster,image_url.ilike.*/posters/*'
        );
      } else if (section === 'uploads') {
        query = query.or(customUploadPredicate());
      } else {
        query = excludeOtherWalls(query);
      }
      return query.order('id', { ascending: true });
    };

    // Probe the first page to learn the total, then fetch the rest in parallel.
    const first = await buildQuery(true).range(0, PAGE - 1);
    if (first.error) {
      return NextResponse.json({ error: first.error.message }, { status: 500 });
    }
    const firstBatch = first.data || [];
    const rows: any[] = [...firstBatch];

    if (firstBatch.length === PAGE) {
      const total = first.count ?? MAX_ROWS;
      const pageCount = Math.min(Math.ceil(total / PAGE), Math.ceil(MAX_ROWS / PAGE));
      const offsets: number[] = [];
      for (let i = 1; i < pageCount; i += 1) offsets.push(i * PAGE);
      const rest = await Promise.all(
        offsets.map((offset) => buildQuery(false).range(offset, offset + PAGE - 1))
      );
      for (const res of rest) {
        if (res.error) {
          return NextResponse.json({ error: res.error.message }, { status: 500 });
        }
        rows.push(...(res.data || []));
      }
    }
    // Count every category that appears in niche or in tags. The set is
    // normalised by lowercase so "Football" and "football" are one category,
    // but the first spelling seen is the one shown.
    const rawCounts = new Map<string, { label: string; n: number }>();
    const bump = (label: unknown) => {
      const key = String(label || '').trim();
      if (!key) return;
      const lower = key.toLowerCase();
      const hit = rawCounts.get(lower);
      if (hit) hit.n += 1;
      else rawCounts.set(lower, { label: key, n: 1 });
    };

    for (const row of rows) {
      const seen = new Set<string>();
      const add = (label: unknown) => {
        const key = String(label || '').trim();
        if (!key) return;
        const lower = key.toLowerCase();
        if (seen.has(lower)) return;
        seen.add(lower);
        bump(key);
      };
      add(row.niche);
      if (Array.isArray(row.tags)) for (const tag of row.tags) add(tag);
    }

    const nicheCounts: Record<string, number> = { All: rows.length };
    for (const { label, n } of [...rawCounts.values()].sort((a, b) => b.n - a.n)) {
      if (n < MIN_CATEGORY_ROWS) continue;
      nicheCounts[label] = n;
    }

    const byFamily = new Map<ColorFamily, Map<string, number>>();
    for (const row of rows) {
      const hexes = Array.isArray(row.colors) ? row.colors : [];
      if (hexes.length === 0) continue;
      for (const family of familiesForItem({ colors: hexes })) {
        const hex = hexes.find((h: string) => familyOfHex(h) === family) ?? hexes[0];
        if (!byFamily.has(family)) byFamily.set(family, new Map());
        const counts = byFamily.get(family)!;
        counts.set(hex, (counts.get(hex) || 0) + 1);
      }
    }

    const colorLibrary = COLOR_FAMILY_ORDER.flatMap((family) => {
      const counts = byFamily.get(family);
      if (!counts || counts.size === 0) return [];
      const ranked = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
      return [
        {
          family,
          swatches: ranked.slice(0, 4).map(([hex, count]) => ({ hex, count })),
          count: ranked.reduce((sum, [, n]) => sum + n, 0),
        },
      ];
    });

    return NextResponse.json({ nicheCounts, colorLibrary, total: rows.length });
  } catch (err: any) {
    console.error('Gallery facets error:', err);
    return NextResponse.json({ error: err.message || 'Failed to load facets' }, { status: 500 });
  }
}
