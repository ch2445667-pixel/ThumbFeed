/**
 * Identifiers for the user's own uploads.
 *
 * "My Uploads" has to be distinguishable in the database, not just in the UI.
 * A custom upload shares its table with imported rows, so the wall is selected
 * by this id prefix and this source value, and the thumbnails wall excludes
 * both. They live here rather than in a route file because Next route modules
 * may only export request handlers and route config.
 */

export const CUSTOM_ID_PREFIX = 'upload-';
export const CUSTOM_SOURCE = 'custom-upload';

/** PostgREST `or()` predicate that selects only custom uploads. */
export function customUploadPredicate(): string {
  return `id.ilike.${CUSTOM_ID_PREFIX}*,source.eq.${CUSTOM_SOURCE},image_url.ilike.*/uploads/*`;
}

/** Applies the "everything except posters and custom uploads" rule. */
export function excludeOtherWalls<T extends { not: (...args: any[]) => T }>(query: T): T {
  return query
    .not('breakdown_notes', 'ilike', '%poster%')
    .not('id', 'ilike', 'poster-%')
    .not('niche', 'eq', 'Cinema')
    .not('source', 'eq', 'poster')
    .not('id', 'ilike', `${CUSTOM_ID_PREFIX}%`)
    .not('source', 'eq', CUSTOM_SOURCE);
}

export function isCustomUploadRow(row: {
  id?: string | null;
  source?: string | null;
}): boolean {
  return (
    String(row.id || '').startsWith(CUSTOM_ID_PREFIX) || row.source === CUSTOM_SOURCE
  );
}