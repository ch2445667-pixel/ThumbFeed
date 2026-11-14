import fs from 'fs';
import path from 'path';
import { collection, getDocs, query, limit, doc, deleteDoc } from 'firebase/firestore';
import { db } from './firestore';
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
import { extractItemFingerprint, deduplicateThumbnailItems } from './thumbnailDedupe';

export { extractItemFingerprint, deduplicateThumbnailItems };

const DATA_DIR = path.join(process.cwd(), 'data');
const THUMBNAILS_FILE = path.join(DATA_DIR, 'thumbnails.json');
const DELETED_FILE = path.join(DATA_DIR, 'deleted.json');

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

function readLocalDeletedKeys(): string[] {
  ensureDataDir();
  try {
    if (fs.existsSync(DELETED_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(DELETED_FILE, 'utf-8'));
      if (Array.isArray(parsed)) return parsed.filter((x): x is string => typeof x === 'string');
    }
  } catch {}
  return [];
}

function writeLocalDeletedKeys(keys: string[]): void {
  ensureDataDir();
  try {
    const trimmed = keys.slice(-5000);
    fs.writeFileSync(DELETED_FILE, JSON.stringify(trimmed, null, 2), 'utf-8');
  } catch (err) {
    console.warn('Could not write deleted.json:', err);
  }
}

async function getDeletedTombstoneSet(): Promise<Set<string>> {
  const set = new Set<string>(readLocalDeletedKeys());
  if (isR2Configured()) {
    try {
      const r2Deleted = await downloadJsonFromR2<string[]>(R2_APP_DATA.DELETED);
      if (Array.isArray(r2Deleted)) {
        for (const k of r2Deleted) {
          if (typeof k === 'string' && k) set.add(k);
        }
      }
    } catch {}
  }
  return set;
}

async function addDeletedTombstones(keys: string[]): Promise<void> {
  const clean = keys.filter(Boolean);
  if (clean.length === 0) return;
  const set = await getDeletedTombstoneSet();
  for (const k of clean) set.add(k);
  const next = Array.from(set);
  writeLocalDeletedKeys(next);
  if (isR2Configured()) {
    uploadJsonToR2(R2_APP_DATA.DELETED, next).catch(() => {});
  }
}

async function removeDeletedTombstones(keys: string[]): Promise<void> {
  const toRemove = new Set(keys.filter(Boolean));
  if (toRemove.size === 0) return;
  const set = await getDeletedTombstoneSet();
  let changed = false;
  for (const k of toRemove) {
    if (set.delete(k)) changed = true;
  }
  if (!changed) return;
  const next = Array.from(set);
  writeLocalDeletedKeys(next);
  if (isR2Configured()) {
    uploadJsonToR2(R2_APP_DATA.DELETED, next).catch(() => {});
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
 * Persist gallery items both locally and to Cloudflare R2 bucket.
 */
export async function saveGalleryItems(itemsToSave: ThumbnailItem[]): Promise<boolean> {
  const current = readStoredFile();
  const combined = deduplicateThumbnailItems([...itemsToSave, ...current]);
  const localOk = writeStoredFile(combined);
  invalidateGalleryCache();

  // Clear tombstones if the user explicitly saves/re-uploads these items
  const resurrectKeys: string[] = [];
  for (const it of itemsToSave) {
    if (it.id) resurrectKeys.push(it.id);
    if (it.imageUrl) resurrectKeys.push(it.imageUrl);
    resurrectKeys.push(extractItemFingerprint(it));
  }
  await removeDeletedTombstones(resurrectKeys).catch(() => {});

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

export async function updateGalleryItemTitle(
  target: { id?: string; imageUrl?: string },
  newTitle: string
): Promise<ThumbnailItem | null> {
  const cleanTitle = newTitle.trim().slice(0, 180);
  if (!cleanTitle) return null;

  const current = readStoredFile();
  let updatedRecord: ThumbnailItem | null = null;
  const next = current.map((it) => {
    const matches =
      (target.id && it.id === target.id) ||
      (target.imageUrl && it.imageUrl === target.imageUrl);
    if (matches) {
      updatedRecord = { ...it, title: cleanTitle };
      return updatedRecord;
    }
    return it;
  });

  if (!updatedRecord) {
    // Also check live items from R2 if local cache missed it
    const live = await getAllGalleryItems(true);
    const syncedNext = live.map((it) => {
      const matches =
        (target.id && it.id === target.id) ||
        (target.imageUrl && it.imageUrl === target.imageUrl);
      if (matches) {
        updatedRecord = { ...it, title: cleanTitle };
        return updatedRecord;
      }
      return it;
    });
    if (!updatedRecord) return null;
    writeStoredFile(syncedNext);
    invalidateGalleryCache();
    if (isR2Configured()) {
      await uploadJsonToR2(R2_APP_DATA.THUMBNAILS, syncedNext).catch(() => {});
    }
    return updatedRecord;
  }

  writeStoredFile(next);
  invalidateGalleryCache();
  if (isR2Configured()) {
    try {
      await uploadJsonToR2(R2_APP_DATA.THUMBNAILS, next);
    } catch (err) {
      console.warn('Failed to sync updated title to Cloudflare R2:', err);
    }
  }
  return updatedRecord;
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
    const isIdMatch = Boolean(idToMatch && it.id === idToMatch);
    const isUrlMatch = Boolean(urlToMatch && (it.imageUrl === urlToMatch || it.sourceUrl === urlToMatch));
    const isFpMatch = Boolean(targetFp && extractItemFingerprint(it) === targetFp);
    const isKeyMatch = Boolean(targetR2Key && (
      extractR2KeyFromUrl(it.imageUrl) === targetR2Key ||
      (it.thumbSmallUrl && extractR2KeyFromUrl(it.thumbSmallUrl) === targetR2Key)
    ));

    if (isIdMatch || isUrlMatch || isFpMatch || isKeyMatch) {
      matchedItems.push(it);
    } else {
      remainingItems.push(it);
    }
  }

  // Persist updated list locally & record tombstones so item stays gone
  const ok = writeStoredFile(remainingItems);
  invalidateGalleryCache();

  const tombstoneKeys: string[] = [];
  if (idToMatch) tombstoneKeys.push(idToMatch);
  if (urlToMatch) tombstoneKeys.push(urlToMatch);
  if (targetR2Key) tombstoneKeys.push(targetR2Key);
  if (targetFp) tombstoneKeys.push(targetFp);
  for (const m of matchedItems) {
    if (m.id) tombstoneKeys.push(m.id);
    if (m.imageUrl) tombstoneKeys.push(m.imageUrl);
    tombstoneKeys.push(extractItemFingerprint(m));
    const mk = extractR2KeyFromUrl(m.imageUrl);
    if (mk) tombstoneKeys.push(mk);
  }
  await addDeletedTombstones(tombstoneKeys).catch(() => {});

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
  const tombstones = await getDeletedTombstoneSet();

  const isTombstoned = (it: Partial<ThumbnailItem>, explicitKey?: string): boolean => {
    if (tombstones.size === 0) return false;
    if (it.id && tombstones.has(it.id)) return true;
    if (it.imageUrl && tombstones.has(it.imageUrl)) return true;
    if (explicitKey && tombstones.has(explicitKey)) return true;
    const fp = extractItemFingerprint(it);
    if (fp && tombstones.has(fp)) return true;
    const rk = it.imageUrl ? extractR2KeyFromUrl(it.imageUrl) : null;
    if (rk && tombstones.has(rk)) return true;
    return false;
  };

  // 1. Initial curated thumbnails (if any)
  for (const item of INITIAL_THUMBNAILS) {
    if (!isTombstoned(item)) itemsList.push(item);
  }

  // 2. Local file thumbnails
  const localItems = readStoredFile();
  for (const item of localItems) {
    if (!isTombstoned(item)) itemsList.push(item);
  }

  // 3. Centralized Cloudflare R2 Storage (authoritative across any app instance)
  if (isR2Configured()) {
    try {
      // Pull the centralized thumbnails catalog from Cloudflare R2
      const r2Items = await downloadJsonFromR2<ThumbnailItem[]>(R2_APP_DATA.THUMBNAILS);
      if (Array.isArray(r2Items)) {
        for (const item of r2Items) {
          if (item && item.id && item.imageUrl && !isTombstoned(item)) {
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
          // Skip if key already matched or tombstoned
          if (knownKeys.has(img.key) || tombstones.has(img.key)) continue;

          // Skip if this image shares a fingerprint with an already known or deleted item
          const syntheticItem: Partial<ThumbnailItem> = {
            id: `r2-${img.key}`,
            imageUrl: getR2PublicUrl(img.key),
            title: img.key,
          };
          if (isTombstoned(syntheticItem, img.key)) continue;

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
          const candidate: ThumbnailItem = {
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
          };
          if (!isTombstoned(candidate)) {
            itemsList.push(candidate);
          }
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
