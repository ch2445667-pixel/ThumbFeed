import { NextRequest, NextResponse } from 'next/server';
import { getAnonClient } from '../../../../lib/supabaseServer';
import { COLOR_FAMILY_ORDER, familyOfHex, familiesForItem, type ColorFamily } from '../../../../lib/colorFamilies';

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
    const section = url.searchParams.get('section') === 'posters' ? 'posters' : 'thumbnails';
    const supabase = getAnonClient();

    let query = supabase.from('thumbnails').select('id,niche,tags,colors');
    if (section === 'posters') {
      query = query.or(
        'id.ilike.poster-*,breakdown_notes.ilike.*poster*,niche.eq.Cinema,source.eq.poster,image_url.ilike.*/posters/*'
      );
    } else {
      query = query
        .not('breakdown_notes', 'ilike', '%poster%')
        .not('id', 'ilike', 'poster-%')
        .not('niche', 'eq', 'Cinema')
        .not('source', 'eq', 'poster');
    }

    const { data, error } = await query.limit(5000);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = data || [];
    const nicheCounts: Record<string, number> = { All: rows.length };
    for (const row of rows) {
      const seen = new Set<string>();
      if (row.niche) {
        nicheCounts[row.niche] = (nicheCounts[row.niche] || 0) + 1;
        seen.add((row.niche as string).toLowerCase());
      }
      if (Array.isArray(row.tags)) {
        for (const tag of row.tags) {
          const lower = (tag || '').trim().toLowerCase();
          if (lower && !seen.has(lower)) {
            const key = (tag as string).trim();
            nicheCounts[key] = (nicheCounts[key] || 0) + 1;
            seen.add(lower);
          }
        }
      }
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
