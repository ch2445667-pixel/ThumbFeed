/**
 * Colour family vocabulary and pure colour maths.
 *
 * Deliberately free of any sharp / Node imports so it can be shared by the
 * server upload route, the client filter UI, and localStorage reads without
 * dragging a native module into the browser bundle.
 */

export type ColorFamily =
  | 'Red'
  | 'Orange'
  | 'Yellow'
  | 'Green'
  | 'Teal'
  | 'Blue'
  | 'Purple'
  | 'Pink'
  | 'Monochrome'
  | 'Dark'
  | 'Light';

/** Display order in the filter panel. */
export const COLOR_FAMILY_ORDER: ColorFamily[] = [
  'Monochrome',
  'Red',
  'Orange',
  'Yellow',
  'Green',
  'Teal',
  'Blue',
  'Purple',
  'Pink',
  'Dark',
  'Light',
];

/** Hue bands in degrees. Red wraps around 360 so it is split into two ranges. */
const HUE_BANDS: { name: ColorFamily; from: number; to: number }[] = [
  { name: 'Red', from: 345, to: 360 },
  { name: 'Red', from: 0, to: 15 },
  { name: 'Orange', from: 15, to: 45 },
  { name: 'Yellow', from: 45, to: 70 },
  { name: 'Green', from: 70, to: 160 },
  { name: 'Teal', from: 160, to: 195 },
  { name: 'Blue', from: 195, to: 255 },
  { name: 'Purple', from: 255, to: 290 },
  { name: 'Pink', from: 290, to: 345 },
];

// A colour this desaturated is read as neutral rather than as a hue.
const MONOCHROME_SATURATION = 0.18;
/**
 * A pixel this dark cannot vote for a hue. HSV saturation is meaningless near
 * zero value — #090701 scores 0.89 saturation — so without this gate every
 * near-black thumbnail registers a spurious hue.
 */
const HUE_MIN_VALUE = 0.2;
// Below this value the whole image reads as a dark composition.
const DARK_VALUE = 0.22;
// Above this value, with little saturation, it reads as a light composition.
const LIGHT_VALUE = 0.86;
const LIGHT_SATURATION = 0.35;

export interface Hsv {
  h: number;
  s: number;
  v: number;
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const clean = hex.trim().replace(/^#/, '');
  if (clean.length === 3) {
    const [r, g, b] = clean.split('');
    const r16 = parseInt(r + r, 16);
    const g16 = parseInt(g + g, 16);
    const b16 = parseInt(b + b, 16);
    if ([r16, g16, b16].some(Number.isNaN)) return null;
    return { r: r16, g: g16, b: b16 };
  }
  if (clean.length !== 6) return null;
  const value = parseInt(clean, 16);
  if (Number.isNaN(value)) return null;
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
}

export function rgbToHsv(r: number, g: number, b: number): Hsv {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  if (max !== min) {
    switch (max) {
      case rn: h = (gn - bn) / d + (gn < bn ? 6 : 0); break;
      case gn: h = (bn - rn) / d + 2; break;
      default: h = (rn - gn) / d + 4; break;
    }
    h /= 6;
  }
  return { h: h * 360, s: max === 0 ? 0 : d / max, v: max };
}

export function hexToHsv(hex: string): Hsv | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  return rgbToHsv(rgb.r, rgb.g, rgb.b);
}

function hueFamily(h: number): ColorFamily | null {
  if (h >= 360) h = 0;
  for (const band of HUE_BANDS) {
    if (h >= band.from && h < band.to) return band.name;
  }
  return null;
}

/**
 * Reduce a set of dominant hexes to at most three families, dominant first.
 *
 * Runs identically on the server (right after extraction) and in the browser
 * (when hydrating thumbnails from the database), so a card's family can never
 * disagree with what the filter thinks it is.
 */
export function familiesFromHexes(colors: string[] | undefined | null, limit = 3): ColorFamily[] {
  if (!colors || colors.length === 0) return [];

  const swatches = colors
    .map(hexToHsv)
    .filter((v): v is Hsv => v !== null);
  if (swatches.length === 0) return [];

  const families: ColorFamily[] = [];
  const push = (name: ColorFamily) => {
    if (families.length < limit && !families.includes(name)) families.push(name);
  };

  // Only swatches bright enough to read a hue from may vote, and the overall
  // desaturation test ignores near-black swatches for the same reason.
  const huedSwatches = swatches.filter((c) => c.v >= HUE_MIN_VALUE);

  if (huedSwatches.length === 0) {
    // Nothing bright enough to read a hue: a dark, flat composition.
    push('Dark');
    push('Monochrome');
    return families.slice(0, limit);
  }

  const meanSaturation = huedSwatches.reduce((sum, c) => sum + c.s, 0) / huedSwatches.length;

  // Overall desaturated read takes precedence over any single hue.
  if (meanSaturation < MONOCHROME_SATURATION) {
    push('Monochrome');
  } else {
    for (const swatch of huedSwatches) {
      if (swatch.s < MONOCHROME_SATURATION) continue;
      const name = hueFamily(swatch.h);
      if (name) push(name);
    }
  }

  // Tonal families are added only as accent, never replacing the hue read.
  for (const swatch of swatches) {
    if (families.length >= limit) break;
    if (swatch.v < DARK_VALUE) push('Dark');
  }
  for (const swatch of swatches) {
    if (families.length >= limit) break;
    if (swatch.v > LIGHT_VALUE && swatch.s < LIGHT_SATURATION) push('Light');
  }

  if (families.length === 0) push('Monochrome');
  return families;
}

/**
 * Family of a single swatch, using the same thresholds as familiesFromHexes.
 * Lets callers attribute the right hex to the right family instead of
 * assuming the leading swatch represents all of an item's families.
 */
export function familyOfHex(hex: string): ColorFamily | null {
  const swatch = hexToHsv(hex);
  if (!swatch) return null;
  const { h, s, v } = swatch;
  if (v < HUE_MIN_VALUE) return 'Dark';
  if (s < MONOCHROME_SATURATION) return v > LIGHT_VALUE ? 'Light' : 'Monochrome';
  // Deliberately keyed off HUE_MIN_VALUE, not DARK_VALUE: a dim but clearly
  // brown/red swatch still votes its hue. Using DARK_VALUE here made this
  // disagree with familiesFromHexes, which demotes Dark to a later accent.
  return hueFamily(h);
}

/** Families for a thumbnail, tolerating missing colour data. */
export function familiesForItem(item: { colors?: string[] } | null | undefined): ColorFamily[] {
  if (!item) return [];
  return familiesFromHexes(item.colors);
}