/**
 * Server-side dominant-colour extraction.
 *
 * Uses a quantised histogram over a small downscale rather than an AI model:
 * it is deterministic, costs nothing, needs no API key, and runs on the image
 * bytes sharp already holds during upload, so extraction adds no extra fetch.
 *
 * Imports sharp lazily so a missing native binding can never break the route.
 */

import { familiesFromHexes, type ColorFamily } from './colorFamilies';

/** Downscale used for analysis. Small enough to be instant, large enough to be stable. */
const SAMPLE_EDGE = 72;
/** How many dominant colours to keep. */
const DOMINANT_COUNT = 4;
/**
 * Reject a candidate if it sits closer than this (Euclidean RGB) to one
 * already chosen, so we do not return four near-identical shades of blue.
 */
const MIN_DOMINANT_DISTANCE = 42;

export interface ColorProfile {
  /** Dominant hexes, most prominent first. */
  colors: string[];
  /** Up to three families derived from those hexes. */
  families: ColorFamily[];
}

interface Bucket {
  count: number;
  r: number;
  g: number;
  b: number;
}

function toHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.min(255, Math.max(0, Math.round(n)));
  return '#' + [clamp(r), clamp(g), clamp(b)]
    .map((n) => n.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

function distance(a: Bucket, r: number, g: number, b: number): number {
  return Math.sqrt((a.r - r) ** 2 + (a.g - g) ** 2 + (a.b - b) ** 2);
}

/**
 * Area-dominant palette: 4 bits per channel histogram, then greedily take the
 * most populated buckets while enforcing a minimum separation.
 */
export async function extractColorProfile(input: Buffer): Promise<ColorProfile> {
  try {
    const sharpMod: any = await import('sharp').then((m: any) => m.default || m);

    const { data, info } = await sharpMod(input)
      .resize(SAMPLE_EDGE, SAMPLE_EDGE, { fit: 'inside', withoutEnlargement: true })
      .flatten({ background: '#FFFFFF' })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const channels = info.channels || 3;
    const buckets = new Map<number, Bucket>();

    for (let i = 0; i + 2 < data.length; i += channels) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      // Quantise to 16 levels per channel so near-identical pixels merge.
      const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
      const existing = buckets.get(key);
      if (existing) {
        existing.count += 1;
        existing.r += r;
        existing.g += g;
        existing.b += b;
      } else {
        buckets.set(key, { count: 1, r, g, b });
      }
    }

    if (buckets.size === 0) return { colors: [], families: [] };

    const averages = Array.from(buckets.values()).map((bucket) => ({
      count: bucket.count,
      r: bucket.r / bucket.count,
      g: bucket.g / bucket.count,
      b: bucket.b / bucket.count,
    }));

    averages.sort((a, b) => b.count - a.count);

    const picked: typeof averages = [];
    for (const candidate of averages) {
      if (picked.length >= DOMINANT_COUNT) break;
      const tooClose = picked.some((p) => distance(p, candidate.r, candidate.g, candidate.b) < MIN_DOMINANT_DISTANCE);
      if (!tooClose) picked.push(candidate);
    }

    // A flat, single-colour image collapses the histogram to one bucket. Fill
    // the rest from the overall mean so the palette is still meaningful.
    if (picked.length === 0) picked.push(averages[0]);

    const colors = picked.map((c) => toHex(c.r, c.g, c.b));

    return { colors, families: familiesFromHexes(colors) };
  } catch (err) {
    console.warn('Colour extraction note:', err instanceof Error ? err.message : err);
    return { colors: [], families: [] };
  }
}

/**
 * The original four-slot palette (accent / secondary / dark / light) used by
 * the /admin AI tagger. Kept behaviourally identical, just relocated so both
 * callers share one copy of the colour maths.
 */
export async function extractExactPalette(imageBuffer: Buffer): Promise<string[]> {
  try {
    const sharpMod: any = await import('sharp').then((m: any) => m.default || m);
    const { rgbToHsv } = await import('./colorFamilies');

    const { data, info } = await sharpMod(imageBuffer)
      .resize(60, 34, { fit: 'cover' })
      .raw()
      .toBuffer({ resolveWithObject: true });

    const pixels: { r: number; g: number; b: number; h: number; s: number; v: number }[] = [];
    for (let i = 0; i < data.length; i += info.channels) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const { h, s, v } = rgbToHsv(r, g, b);
      pixels.push({ r, g, b, h, s, v });
    }

    if (pixels.length === 0) {
      return ['#FF3366', '#3B82F6', '#0F172A', '#FFFFFF'];
    }

    const saturated = [...pixels].filter((p) => p.s > 0.35 && p.v > 0.25).sort((a, b) => (b.s * b.v) - (a.s * a.v));
    const accent = saturated[0] || pixels[0] || { r: 239, g: 68, b: 68 };

    const darks = [...pixels].filter((p) => p.v < 0.28).sort((a, b) => a.v - b.v);
    const dark = darks[0] || { r: 15, g: 23, b: 42 };

    const lights = [...pixels].filter((p) => p.v > 0.78 && p.s < 0.35).sort((a, b) => b.v - a.v);
    const light = lights[0] || { r: 255, g: 255, b: 255 };

    const colorDistance = (c1: { r: number; g: number; b: number }, c2: { r: number; g: number; b: number }) =>
      Math.sqrt((c1.r - c2.r) ** 2 + (c1.g - c2.g) ** 2 + (c1.b - c2.b) ** 2);

    const secondary = pixels.find((p) => colorDistance(p, accent) > 90 && colorDistance(p, dark) > 70 && colorDistance(p, light) > 70)
      || saturated[Math.min(saturated.length - 1, 12)]
      || pixels[Math.floor(pixels.length / 2)]
      || { r: 59, g: 130, b: 246 };

    return [
      toHex(accent.r, accent.g, accent.b),
      toHex(secondary.r, secondary.g, secondary.b),
      toHex(dark.r, dark.g, dark.b),
      toHex(light.r, light.g, light.b)
    ];
  } catch (err) {
    return ['#FF3366', '#3B82F6', '#0F172A', '#FFFFFF'];
  }
}