import type { ThumbnailItem } from './types';
import { deleteUpload, getUploads, saveUploads, updateUpload } from './localUploads';

/**
 * Local library adapter.
 *
 * This used to mirror everything into Supabase. It no longer talks to any
 * network service: uploads are persisted by `localUploads.ts`, and this module
 * keeps the small API the pages already use.
 */

/**
 * Extracts multiple deduplication keys for an item to prevent duplicates
 * across YouTube video IDs, canonical URLs, image sources, and IDs.
 */
export function extractDedupeKeys(item: {
  id?: string;
  imageUrl?: string;
  sourceUrl?: string;
  videoId?: string;
  title?: string;
}): string[] {
  const keys: string[] = [];
  if (item.id) keys.push(`id:${item.id}`);

  // 1. Direct YouTube 11-char video ID if present
  const directYtId = item.videoId;
  if (directYtId && directYtId.length === 11) {
    keys.push(`yt:${directYtId}`);
  }

  // 2. Scan id, sourceUrl, and imageUrl for any 11-char YouTube video ID
  const scan = `${item.id || ''} ${item.sourceUrl || ''} ${item.imageUrl || ''}`;
  const ytRegex =
    /(?:watch\?(?:.*&)?v=|youtu\.be\/|\/shorts\/|\/vi\/|thumb-yt-|thumb-storage-|ch-yt-|yt-vid-|yt-ch-|yt-|_)([a-zA-Z0-9_-]{11})(?:[_\.\?&\/:]|$)/gi;
  let ytMatch;
  while ((ytMatch = ytRegex.exec(scan)) !== null) {
    const idFound = ytMatch[1];
    if (idFound && idFound.length === 11) {
      keys.push(`yt:${idFound}`);
    }
  }

  // 3. Normalized image URL
  if (item.imageUrl) {
    keys.push(`img:${item.imageUrl.toLowerCase()}`);
    const fname = item.imageUrl.split('/').pop()?.split('?')[0]?.toLowerCase();
    if (fname && fname.length > 5 && !fname.includes('maxresdefault') && !fname.includes('hqdefault')) {
      keys.push(`fname:${fname}`);
    }
  }

  // 4. Normalized source URL
  if (item.sourceUrl && item.sourceUrl.trim()) {
    keys.push(`src:${item.sourceUrl.trim().toLowerCase()}`);
  }

  return keys;
}

/** Every stored upload, resolved to render-ready image URLs. */
export function getStoredThumbnails(): ThumbnailItem[] {
  return getUploads();
}

export async function saveStoredThumbnails(newItems: ThumbnailItem[]): Promise<ThumbnailItem[]> {
  if (!newItems || newItems.length === 0) return getUploads();
  return saveUploads(newItems);
}

export function saveStoredThumbnail(item: ThumbnailItem): Promise<ThumbnailItem[]> {
  return saveStoredThumbnails([item]);
}

export async function updateStoredThumbnail(updatedItem: ThumbnailItem): Promise<ThumbnailItem[]> {
  await updateUpload(updatedItem);
  return getUploads();
}

// Kept for the delete sheet, which still reports whether the image file itself
// could be removed. Locally that is always true once the blob is gone.
export async function deleteStoredThumbnailPermanently(target: {
  id: string;
  imageUrl?: string;
}): Promise<{ items: ThumbnailItem[]; storageRemovalFailed: boolean }> {
  await deleteUpload(target.id);
  return { items: getUploads(), storageRemovalFailed: false };
}
