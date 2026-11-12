import fs from 'fs';
import path from 'path';
import { collection, getDocs, query, limit } from 'firebase/firestore';
import { db } from './firebase';
import { INITIAL_THUMBNAILS } from './mockData';
import { ThumbnailItem } from './types';
import { parseDimensions } from './dimensions';

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
const CACHE_TTL_MS = 5 * 1000; // 5 seconds cache

export function invalidateGalleryCache() {
  cachedItems = null;
  lastCacheTime = 0;
}

export async function saveGalleryItems(itemsToSave: ThumbnailItem[]): Promise<boolean> {
  const current = readStoredFile();
  const currentMap = new Map<string, ThumbnailItem>(current.map(it => [it.id, it]));

  for (const item of itemsToSave) {
    currentMap.set(item.id, item);
  }

  const updated = Array.from(currentMap.values());
  const ok = writeStoredFile(updated);
  invalidateGalleryCache();
  return ok;
}

export async function deleteGalleryItem(idOrUrl: string): Promise<boolean> {
  const current = readStoredFile();
  const updated = current.filter(it => it.id !== idOrUrl && it.imageUrl !== idOrUrl);
  const ok = writeStoredFile(updated);
  invalidateGalleryCache();
  return ok;
}

export async function getAllGalleryItems(): Promise<ThumbnailItem[]> {
  const now = Date.now();
  if (cachedItems && (now - lastCacheTime) < CACHE_TTL_MS) {
    return cachedItems;
  }

  const itemsMap = new Map<string, ThumbnailItem>();

  // 1. Initial curated thumbnails (if any)
  for (const item of INITIAL_THUMBNAILS) {
    itemsMap.set(item.id, item);
  }

  // 2. Persistent server-stored thumbnails (added by user)
  const fileItems = readStoredFile();
  for (const item of fileItems) {
    itemsMap.set(item.id, item);
  }

  // 3. Firestore thumbnails collection (if available and accessible)
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
    // Firestore sync note - server storage is primary
  }

  cachedItems = Array.from(itemsMap.values());
  lastCacheTime = now;
  return cachedItems;
}
