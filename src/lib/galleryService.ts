import fs from 'fs';
import path from 'path';
import { collection, getDocs, query, limit } from 'firebase/firestore';
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
const CACHE_TTL_MS = 4 * 1000; // 4 seconds cache

export function invalidateGalleryCache() {
  cachedItems = null;
  lastCacheTime = 0;
}

/**
 * Persist gallery items both locally and to Cloudflare R2 bucket.
 */
export async function saveGalleryItems(itemsToSave: ThumbnailItem[]): Promise<boolean> {
  const current = readStoredFile();
  const currentMap = new Map<string, ThumbnailItem>(current.map(it => [it.id, it]));

  for (const item of itemsToSave) {
    currentMap.set(item.id, item);
  }

  const updated = Array.from(currentMap.values());
  const localOk = writeStoredFile(updated);
  invalidateGalleryCache();

  // Primary Cloud Sync: Write to Cloudflare R2 bucket as _app_data/thumbnails.json
  if (isR2Configured()) {
    try {
      await uploadJsonToR2(R2_APP_DATA.THUMBNAILS, updated);
    } catch (err) {
      console.warn('Failed to sync thumbnails to Cloudflare R2:', err);
    }
  }

  return localOk;
}

/**
 * Delete a thumbnail item from both local storage and Cloudflare R2.
 */
export async function deleteGalleryItem(idOrUrl: string): Promise<boolean> {
  const current = readStoredFile();
  const toDelete = current.find(it => it.id === idOrUrl || it.imageUrl === idOrUrl);
  const updated = current.filter(it => it.id !== idOrUrl && it.imageUrl !== idOrUrl);
  const ok = writeStoredFile(updated);
  invalidateGalleryCache();

  // Sync deletion to Cloudflare R2
  if (isR2Configured()) {
    try {
      await uploadJsonToR2(R2_APP_DATA.THUMBNAILS, updated);
      if (toDelete) {
        const key = extractR2KeyFromUrl(toDelete.imageUrl);
        if (key) {
          await deleteFromR2(key).catch(() => {});
        }
        if (toDelete.thumbSmallUrl) {
          const smallKey = extractR2KeyFromUrl(toDelete.thumbSmallUrl);
          if (smallKey) {
            await deleteFromR2(smallKey).catch(() => {});
          }
        }
      }
    } catch (err) {
      console.warn('Failed to delete item from Cloudflare R2:', err);
    }
  }

  return ok;
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
 * Retrieve all thumbnails, automatically pulling from Cloudflare R2 if configured.
 */
export async function getAllGalleryItems(forceRefresh = false): Promise<ThumbnailItem[]> {
  const now = Date.now();
  if (!forceRefresh && cachedItems && (now - lastCacheTime) < CACHE_TTL_MS) {
    return cachedItems;
  }

  const itemsMap = new Map<string, ThumbnailItem>();

  // 1. Initial curated thumbnails (if any)
  for (const item of INITIAL_THUMBNAILS) {
    itemsMap.set(item.id, item);
  }

  // 2. Local file thumbnails
  const localItems = readStoredFile();
  for (const item of localItems) {
    itemsMap.set(item.id, item);
  }

  // 3. Centralized Cloudflare R2 Storage (authoritative across any app instance)
  let r2HasCatalog = false;
  let addedFromBucket = 0;

  if (isR2Configured()) {
    try {
      // Pull the centralized thumbnails catalog from Cloudflare R2
      const r2Items = await downloadJsonFromR2<ThumbnailItem[]>(R2_APP_DATA.THUMBNAILS);
      if (Array.isArray(r2Items) && r2Items.length > 0) {
        r2HasCatalog = true;
        for (const item of r2Items) {
          if (item && item.id && item.imageUrl) {
            itemsMap.set(item.id, item);
          }
        }
      }

      // Auto-reconcile: Scan bucket for existing images uploaded directly or in previous sessions
      const bucketImages = await listR2ImageFiles();
      if (bucketImages.length > 0) {
        for (const img of bucketImages) {
          // If this image key is already referenced in an item, skip
          const alreadyExists = Array.from(itemsMap.values()).some(it => {
            const key1 = extractR2KeyFromUrl(it.imageUrl);
            const key2 = it.thumbSmallUrl ? extractR2KeyFromUrl(it.thumbSmallUrl) : null;
            return key1 === img.key || key2 === img.key;
          });

          if (!alreadyExists && !img.key.includes('/small/')) {
            // Synthesize an item from the existing R2 object so it immediately shows in the gallery
            const rawFilename = img.key.split('/').pop() || img.key;
            const cleanTitle = rawFilename
              .replace(/\.[^/.]+$/, '')
              .replace(/^thumb_\d+_/i, '')
              .replace(/^poster_\d+_/i, '')
              .replace(/[-_]/g, ' ')
              .trim() || 'Imported R2 Thumbnail';

            const publicUrl = getR2PublicUrl(img.key);
            const syntheticId = `r2-${img.key.replace(/[^a-zA-Z0-9_-]/g, '_')}`;

            itemsMap.set(syntheticId, {
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
            });
            addedFromBucket++;
          }
        }
      }

      // If R2 was updated or empty, save unified list back to both R2 and local cache
      const unifiedList = Array.from(itemsMap.values());
      writeStoredFile(unifiedList);

      if (!r2HasCatalog || addedFromBucket > 0 || (localItems.length > 0 && !r2HasCatalog)) {
        await uploadJsonToR2(R2_APP_DATA.THUMBNAILS, unifiedList).catch(() => {});
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
          itemsMap.set(id, {
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
    // Firestore sync note - R2 storage is primary
  }

  cachedItems = Array.from(itemsMap.values());
  lastCacheTime = now;
  return cachedItems;
}
