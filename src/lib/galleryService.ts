import fs from 'fs';
import path from 'path';
import { collection, getDocs, query, limit, doc, deleteDoc } from 'firebase/firestore';
import { db } from './firebase';
import { INITIAL_THUMBNAILS } from './mockData';
import { ThumbnailItem } from './types';
import { parseDimensions } from './dimensions';
import {
  downloadJsonFromR2,
  uploadJsonToR2,
  listR2ImageFiles,
  getR2PublicUrl,
  deleteFromR2,
  extractR2KeyFromUrl,
  isR2Configured,
  R2_APP_DATA
} from './r2';

const DATA_DIR = path.join(process.cwd(), 'data');
const THUMBNAILS_FILE = path.join(DATA_DIR, 'thumbnails.json');

function ensureDataDir() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch (err) {
    console.warn('Could not create data dir:', err);
  }
}

function readStoredFile(): ThumbnailItem[] {
  ensureDataDir();
  try {
    if (fs.existsSync(THUMBNAILS_FILE)) {
      const raw = fs.readFileSync(THUMBNAILS_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.warn('Could not read thumbnails.json:', err);
  }
  return [];
}

function writeStoredFile(items: ThumbnailItem[]): boolean {
  ensureDataDir();
  try {
    fs.writeFileSync(THUMBNAILS_FILE, JSON.stringify(items, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('Could not write thumbnails.json:', err);
    return false;
  }
}

let cachedItems: ThumbnailItem[] | null = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 3 * 1000; // 3 seconds cache

export function invalidateGalleryCache() {
  cachedItems = null;
  lastCacheTime = 0;
}

/**
 * Robust fingerprint generator to catch duplicate items across YouTube IDs,
 * upload attempts, and raw file names.
 */
export function extractItemFingerprint(item: Partial<ThumbnailItem>): string {
  // 1. Check for 11-char YouTube ID in ID, sourceUrl, imageUrl, or breakdownNotes
  const allText = `${item.id || ''} ${item.sourceUrl || ''} ${item.imageUrl || ''} ${item.breakdownNotes || ''}`;
  const ytMatch = allText.match(/(?:v=|youtu\.be\/|embed\/|\/vi\/|thumb-yt-)([a-zA-Z0-9_-]{11})/i) ||
                  allText.match(/([a-zA-Z0-9_-]{11})_[a-z0-9]{4,6}\.(jpg|webp|png)/i);
  if (ytMatch && ytMatch[1] && ytMatch[1].length === 11) {
    return `yt:${ytMatch[1]}`;
  }

  // 2. Base filename without small/ prefix and without random 5-char upload suffix
  const imgUrl = (item.imageUrl || '').split('?')[0];
  const filename = decodeURIComponent(imgUrl.split('/').pop() || '');
  if (filename) {
    const cleanBase = filename
      .toLowerCase()
      .replace(/^small_/, '')
      .replace(/\.(jpg|jpeg|png|webp|gif)$/, '')
      .replace(/_[a-z0-9]{4,6}$/, '') // strip upload random suffix e.g. _6xwjz
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
      .replace(/_[a-z0-9]{4,6}$/i, '')
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
  const nonPreviews = items.filter(it => {
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

/**
 * Persist gallery items both locally and to Cloudflare R2 bucket.
 */
export async function saveGalleryItems(itemsToSave: ThumbnailItem[]): Promise<boolean> {
  const current = readStoredFile();
  const combined = deduplicateThumbnailItems([...itemsToSave, ...current]);
  const localOk = writeStoredFile(combined);
  invalidateGalleryCache();

  // Primary Cloud Sync: Write to Cloudflare R2 bucket as _app_data/thumbnails.json
  if (isR2Configured()) {
    try {
      await uploadJsonToR2(R2_APP_DATA.THUMBNAILS, combined);
    } catch (err) {
      console.warn('Failed to sync thumbnails to Cloudflare R2:', err);
    }
  }

  return localOk;
}

/**
 * Delete a thumbnail item from both local storage and Cloudflare R2 bucket.
 */
export async function deleteGalleryItem(
  idOrUrl?: string,
  targetImageUrl?: string,
  targetR2Key?: string
): Promise<{ success: boolean; storageDeleted: boolean; deletedCount: number }> {
  const current = readStoredFile();
  const idToMatch = idOrUrl?.trim();
  const urlToMatch = (targetImageUrl || idOrUrl)?.trim();

  // Generate target fingerprint if possible
  const targetFp = (idToMatch || urlToMatch)
    ? extractItemFingerprint({ id: idToMatch, imageUrl: urlToMatch, sourceUrl: urlToMatch })
    : '';

  // Identify all records that correspond to this thumbnail
  const matchedItems: ThumbnailItem[] = [];
  const remainingItems: ThumbnailItem[] = [];

  for (const it of current) {
    const isIdMatch = idToMatch && (it.id === idToMatch || it.id.includes(idToMatch));
    const isUrlMatch = urlToMatch && (it.imageUrl === urlToMatch || it.sourceUrl === urlToMatch);
    const isFpMatch = targetFp && extractItemFingerprint(it) === targetFp;
    const isKeyMatch = targetR2Key && (
      extractR2KeyFromUrl(it.imageUrl) === targetR2Key ||
      (it.thumbSmallUrl && extractR2KeyFromUrl(it.thumbSmallUrl) === targetR2Key)
    );

    if (isIdMatch || isUrlMatch || isFpMatch || isKeyMatch) {
      matchedItems.push(it);
    } else {
      remainingItems.push(it);
    }
  }

  // Persist updated list locally
  const ok = writeStoredFile(remainingItems);
  invalidateGalleryCache();

  // Collect all R2 keys that need to be permanently deleted from the storage bucket
  const keysToDelete = new Set<string>();

  if (targetR2Key) {
    keysToDelete.add(targetR2Key);
  }
  if (urlToMatch) {
    const k = extractR2KeyFromUrl(urlToMatch);
    if (k) keysToDelete.add(k);
  }

  for (const m of matchedItems) {
    const k1 = extractR2KeyFromUrl(m.imageUrl);
    if (k1) keysToDelete.add(k1);

    if (m.thumbSmallUrl) {
      const k2 = extractR2KeyFromUrl(m.thumbSmallUrl);
      if (k2) keysToDelete.add(k2);
    }

    if (m.sourceUrl) {
      const k3 = extractR2KeyFromUrl(m.sourceUrl);
      if (k3) keysToDelete.add(k3);
    }
  }

  // Also include standard small variant pattern if not already present
  const derivedKeys = Array.from(keysToDelete);
  for (const k of derivedKeys) {
    if (!k.startsWith('small/')) {
      const baseName = k.split('/').pop()?.replace(/\.[^/.]+$/, '');
      if (baseName) {
        keysToDelete.add(`small/${baseName}.webp`);
        keysToDelete.add(`small/${k}`);
      }
    }
  }

  // Permanently delete image files from Cloudflare R2 bucket
  let storageDeleted = false;
  if (isR2Configured() && keysToDelete.size > 0) {
    try {
      for (const key of keysToDelete) {
        const deleted = await deleteFromR2(key);
        if (deleted) storageDeleted = true;
      }
    } catch (err) {
      console.warn('Failed to delete storage objects from Cloudflare R2:', err);
    }
  }

  // Persist the updated authoritative catalog to Cloudflare R2 bucket
  if (isR2Configured()) {
    try {
      await uploadJsonToR2(R2_APP_DATA.THUMBNAILS, remainingItems);
    } catch (err) {
      console.warn('Failed to sync updated catalog to Cloudflare R2:', err);
    }
  }

  // Delete from Firestore if db connection is alive
  if (db) {
    for (const m of matchedItems) {
      if (m.id) {
        try {
          await deleteDoc(doc(db, 'thumbnails', m.id));
        } catch {
          // Ignore if Firestore doc not found
        }
      }
    }
    if (idToMatch) {
      try {
        await deleteDoc(doc(db, 'thumbnails', idToMatch));
      } catch {}
    }
  }

  return {
    success: ok,
    storageDeleted,
    deletedCount: matchedItems.length,
  };
}

/**
 * Reconcile and synchronize all thumbnails from Cloudflare R2 bucket.
 */
export async function syncGalleryWithR2(): Promise<{ totalCount: number; newFromBucket: number }> {
  invalidateGalleryCache();
  const items = await getAllGalleryItems(true);
  return {
    totalCount: items.length,
    newFromBucket: 0,
  };
}

/**
 * Retrieve all thumbnails, automatically pulling from Cloudflare R2 if configured
 * and ensuring zero duplicate thumbnails.
 */
export async function getAllGalleryItems(forceRefresh = false): Promise<ThumbnailItem[]> {
  const now = Date.now();
  if (!forceRefresh && cachedItems && (now - lastCacheTime) < CACHE_TTL_MS) {
    return cachedItems;
  }

  const itemsList: ThumbnailItem[] = [];

  // 1. Initial curated thumbnails (if any)
  for (const item of INITIAL_THUMBNAILS) {
    itemsList.push(item);
  }

  // 2. Local file thumbnails
  const localItems = readStoredFile();
  for (const item of localItems) {
    itemsList.push(item);
  }

  // 3. Centralized Cloudflare R2 Storage (authoritative across any app instance)
  if (isR2Configured()) {
    try {
      // Pull the centralized thumbnails catalog from Cloudflare R2
      const r2Items = await downloadJsonFromR2<ThumbnailItem[]>(R2_APP_DATA.THUMBNAILS);
      if (Array.isArray(r2Items) && r2Items.length > 0) {
        for (const item of r2Items) {
          if (item && item.id && item.imageUrl) {
            itemsList.push(item);
          }
        }
      }

      // Auto-reconcile: Scan bucket for existing images uploaded directly or in previous sessions
      const bucketImages = await listR2ImageFiles();
      if (bucketImages.length > 0) {
        // Collect fingerprints of all items currently known
        const knownFingerprints = new Set<string>();
        const knownKeys = new Set<string>();
        for (const it of itemsList) {
          knownFingerprints.add(extractItemFingerprint(it));
          const k1 = extractR2KeyFromUrl(it.imageUrl);
          if (k1) knownKeys.add(k1);
          if (it.thumbSmallUrl) {
            const k2 = extractR2KeyFromUrl(it.thumbSmallUrl);
            if (k2) knownKeys.add(k2);
          }
        }

        for (const img of bucketImages) {
          // Skip if key already matched
          if (knownKeys.has(img.key)) continue;

          // Skip if this image shares a fingerprint with an already known item
          const syntheticItem: Partial<ThumbnailItem> = {
            id: `r2-${img.key}`,
            imageUrl: getR2PublicUrl(img.key),
            title: img.key,
          };
          const fp = extractItemFingerprint(syntheticItem);
          if (knownFingerprints.has(fp)) continue;

          // Synthesize an item from the untracked R2 image
          const rawFilename = img.key.split('/').pop() || img.key;
          const cleanTitle = rawFilename
            .replace(/\.[^/.]+$/, '')
            .replace(/^thumb_\d+_/i, '')
            .replace(/^poster_\d+_/i, '')
            .replace(/[-_]/g, ' ')
            .trim() || 'Imported R2 Thumbnail';

          const publicUrl = getR2PublicUrl(img.key);
          const syntheticId = `r2-${img.key.replace(/[^a-zA-Z0-9_-]/g, '_')}`;

          const newItem: ThumbnailItem = {
            id: syntheticId,
            title: cleanTitle,
            creator: 'Cloudflare R2',
            imageUrl: publicUrl,
            sourceUrl: publicUrl,
            niche: 'Entertainment',
            styles: ['Minimalist & Clean'],
            tags: ['Cloudflare', 'R2'],
            source: 'r2-storage',
            createdAt: img.lastModified ? img.lastModified.toISOString() : new Date().toISOString(),
            likesCount: 0,
          };

          itemsList.push(newItem);
          knownFingerprints.add(fp);
          knownKeys.add(img.key);
        }
      }
    } catch (err) {
      console.warn('Error syncing with Cloudflare R2 catalog:', err);
    }
  }

  // 4. Firestore thumbnails collection (if available)
  try {
    if (db) {
      const q = query(collection(db, 'thumbnails'), limit(1000));
      const snapshot = await getDocs(q);
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        if (data && data.imageUrl) {
          const dims = parseDimensions(data.breakdownNotes || data.breakdown_notes || '');
          const id = data.id || docSnap.id;
          itemsList.push({
            id,
            kind: data.kind || (data.niche === 'Cinema' ? 'poster' : 'thumbnail'),
            title: data.title || 'YouTube Thumbnail',
            creator: data.creator || 'Creator',
            imageUrl: data.imageUrl || data.image_url,
            thumbSmallUrl: data.thumbSmallUrl || data.thumb_small_url,
            sourceUrl: data.sourceUrl || data.source_url || data.imageUrl || data.image_url,
            niche: data.niche || '',
            styles: Array.isArray(data.styles) ? data.styles : [],
            tags: Array.isArray(data.tags) ? data.tags : (data.niche ? [data.niche] : []),
            colors: Array.isArray(data.colors) ? data.colors : [],
            width: data.width || dims?.width,
            height: data.height || dims?.height,
            ocrText: data.ocrText || data.ocr_text || '',
            emotion: data.emotion || 'Curious',
            breakdownNotes: data.breakdownNotes || data.breakdown_notes || '',
            viewsEstimate: data.viewsEstimate || data.views_estimate || '',
            subscribersCount: data.subscribersCount || '',
            publishedTime: data.publishedTime || data.published_time,
            source: data.source || 'r2-storage',
            createdAt: data.createdAt || data.created_at || new Date().toISOString(),
            likesCount: Number(data.likesCount || data.likes_count || 0)
          });
        }
      });
    }
  } catch (err) {
    // Firestore sync note
  }

  // Deduplicate everything so each thumbnail appears strictly once
  const unifiedDeduped = deduplicateThumbnailItems(itemsList);
  writeStoredFile(unifiedDeduped);

  // Sync cleaned catalog back to Cloudflare R2 so R2 stays deduplicated
  if (isR2Configured()) {
    uploadJsonToR2(R2_APP_DATA.THUMBNAILS, unifiedDeduped).catch(() => {});
  }

  cachedItems = unifiedDeduped;
  lastCacheTime = now;
  return unifiedDeduped;
}
