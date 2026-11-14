import { ThumbnailItem } from './types';

/**
 * Robust fingerprint generator to catch duplicate items across YouTube IDs,
 * repeated upload attempts (multiple random suffixes), and raw file names.
 */
export function extractItemFingerprint(item: Partial<ThumbnailItem>): string {
  // 1. Check for 11-char YouTube ID in ID, sourceUrl, imageUrl, or breakdownNotes
  const allText = `${item.id || ''} ${item.sourceUrl || ''} ${item.imageUrl || ''} ${item.breakdownNotes || ''}`;
  const explicitYtMatch = allText.match(/(?:v=|youtu\.be\/|embed\/|\/vi\/|thumb-yt-|yt-vid-|yt-ch-)([a-zA-Z0-9_-]{11})/i);
  if (explicitYtMatch && explicitYtMatch[1] && explicitYtMatch[1].length === 11) {
    return `yt:${explicitYtMatch[1]}`;
  }
  const cleanUrlPath = (item.imageUrl || '').split('?')[0];
  const fnYtMatch = cleanUrlPath.match(/(?:^|\/|_)([A-Za-z0-9-]{11})(?:_[a-z0-9]{4,6})+\.(?:jpg|webp|png)$/i);
  if (fnYtMatch && fnYtMatch[1] && /(?=.*[a-z])(?=.*[A-Z0-9-])/.test(fnYtMatch[1])) {
    return `yt:${fnYtMatch[1]}`;
  }

  // 2. Base filename without small/ prefix and without repeated random upload suffixes
  const imgUrl = (item.imageUrl || '').split('?')[0];
  let filename = imgUrl.split('/').pop() || '';
  try {
    filename = decodeURIComponent(filename);
  } catch {}
  if (filename) {
    const cleanBase = filename
      .toLowerCase()
      .replace(/^small_/, '')
      .replace(/\.(jpg|jpeg|png|webp|gif|avif)$/i, '')
      .replace(/(?:_[a-z0-9]{4,6})+$/, '')
      .replace(/^thumb_\d+_/, '')
      .replace(/^poster_\d+_/, '')
      .trim();
    if (cleanBase.length > 5) {
      return `base:${cleanBase}`;
    }
  }

  // 3. Normalized Title
  if (item.title && item.title.trim().length > 3) {
    const slug = item.title
      .toLowerCase()
      .replace(/^(small|r2)\s+/i, '')
      .replace(/(?:_[a-z0-9]{4,6})+$/i, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
    if (slug.length > 5) {
      return `title:${slug}`;
    }
  }

  return `id:${item.id || imgUrl}`;
}

/**
 * Filter out ghost preview records and collapse duplicate uploads of the same
 * video or image into a single authoritative item.
 */
export function deduplicateThumbnailItems(items: ThumbnailItem[]): ThumbnailItem[] {
  // 1. Remove preview image files that were accidentally indexed
  const nonPreviews = items.filter((it) => {
    if (!it || !it.imageUrl) return false;
    const lowerUrl = it.imageUrl.toLowerCase();
    const lowerId = (it.id || '').toLowerCase();
    if (lowerUrl.includes('/media/small/') || lowerUrl.startsWith('small/') || lowerId.includes('small_')) {
      return false;
    }
    return true;
  });

  // 2. Group by fingerprint
  const groups = new Map<string, ThumbnailItem[]>();
  for (const item of nonPreviews) {
    const fp = extractItemFingerprint(item);
    const existing = groups.get(fp) || [];
    existing.push(item);
    groups.set(fp, existing);
  }

  // 3. For each group, pick the highest-fidelity / richest record
  const deduped: ThumbnailItem[] = [];
  for (const group of groups.values()) {
    if (group.length === 1) {
      deduped.push(group[0]);
      continue;
    }

    group.sort((a, b) => {
      const aIsSynthetic = a.creator === 'Cloudflare R2' || a.id.startsWith('r2-');
      const bIsSynthetic = b.creator === 'Cloudflare R2' || b.id.startsWith('r2-');
      if (!aIsSynthetic && bIsSynthetic) return -1;
      if (aIsSynthetic && !bIsSynthetic) return 1;

      const aScore =
        (a.viewsEstimate ? 3 : 0) +
        (a.creator && a.creator !== 'Cloudflare R2' ? 2 : 0) +
        (a.styles?.length || 0) +
        (a.colors?.length || 0) +
        (a.title.length > 15 ? 1 : 0);

      const bScore =
        (b.viewsEstimate ? 3 : 0) +
        (b.creator && b.creator !== 'Cloudflare R2' ? 2 : 0) +
        (b.styles?.length || 0) +
        (b.colors?.length || 0) +
        (b.title.length > 15 ? 1 : 0);

      return bScore - aScore;
    });

    deduped.push(group[0]);
  }

  return deduped;
}
