/**
 * Image dimension encoding.
 *
 * Pinterest-style masonry only avoids layout shift when the exact height of
 * every tile is known before the image loads. Without that, each arriving image
 * changes its tile's height and the column layout re-balances, which is what
 * made the posters wall flicker and shuffle.
 *
 * Dimensions ride along in `breakdown_notes` as a trailing `| WxH` token so no
 * schema migration is required. The table already stores a free-text note
 * there, nothing parses it, and the posters wall hides the colour filter so
 * the alternative TEXT[] columns are not free either. Replace this with real
 * `width` / `height` columns when a migration is convenient.
 */

const TOKEN = /(\d{2,5})\s*[x×]\s*(\d{2,5})\s*$/;

export function encodeDimensions(width: number, height: number): string {
  return `${Math.round(width)}x${Math.round(height)}`;
}

/** Pull a `| WxH` token back out of a note string, if present. */
export function parseDimensions(notes: string | null | undefined): { width: number; height: number } | null {
  if (!notes) return null;
  const match = notes.match(TOKEN);
  if (!match) return null;
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!width || !height) return null;
  return { width, height };
}

/**
 * Append dimensions to a note, replacing any token already present so repeated
 * upserts do not stack duplicates.
 */
export function withDimensions(notes: string, width?: number, height?: number): string {
  const base = notes.replace(new RegExp(`\\s*\\|\\s*${TOKEN.source}\\s*$`), '').trim();
  if (!width || !height) return base;
  const token = encodeDimensions(width, height);
  return base ? `${base} | ${token}` : token;
}