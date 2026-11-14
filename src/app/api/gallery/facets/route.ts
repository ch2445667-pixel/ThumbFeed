import { NextRequest, NextResponse } from 'next/server';
import { getAllGalleryItems } from '../../../../lib/galleryService';
import { COLOR_FAMILY_ORDER, familyOfHex, familiesForItem, type ColorFamily } from '../../../../lib/colorFamilies';
import { getClientIp, safeErrorResponse } from '../../../../lib/serverAuth';
import { checkRateLimit, rateLimitResponse } from '../../../../lib/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rl = await checkRateLimit({
      key: `gallery-facets:${ip}`,
      limit: 120,
      windowMs: 60 * 1000,
    });
    if (!rl.allowed) return rateLimitResponse(rl.retryAfterSeconds);

    const rows = await getAllGalleryItems();

    const nicheCounts: Record<string, number> = { All: rows.length };
    for (const row of rows) {
      const seen = new Set<string>();
      if (row.niche) {
        nicheCounts[row.niche] = (nicheCounts[row.niche] || 0) + 1;
        seen.add(row.niche.toLowerCase());
      }
      if (Array.isArray(row.tags)) {
        for (const tag of row.tags) {
          const lower = (tag || '').trim().toLowerCase();
          if (lower && !seen.has(lower)) {
            const key = tag.trim();
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
  } catch (err: unknown) {
    return safeErrorResponse(err, 'Failed to load gallery facets');
  }
}
