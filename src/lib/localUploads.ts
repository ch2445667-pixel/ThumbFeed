import type { ThumbnailItem } from './types';

/**
 * Local persistence for "My Uploads".
 *
 * The app no longer has a hosted database. Metadata lives in localStorage and
 * the image bytes live in IndexedDB, because a single base64 data URL is
 * routinely larger than the whole localStorage quota and one failed write
 * loses every row. Image URLs in metadata are stored as `local-image:<key>`
 * and resolved to an object URL when the wall is loaded.
 *
 * Everything that talks to storage goes through this module, so swapping in a
 * hosted provider later means replacing this file, not the UI.
 */

const META_KEY = 'thumbfeed_uploads_v1';
const DB_NAME = 'thumbfeed-local';
const DB_VERSION = 2;
const BLOB_STORE = 'upload-images';
const LOCAL_PREFIX = 'local-image:';

/** Fired on window after any write, so open queries can invalidate. */
export const UPLOADS_CHANGED_EVENT = 'thumbfeed:uploads-changed';

/** Object URLs are created once per session and reused across renders. */
const objectUrls = new Map<string, string>();

function openDb(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || typeof indexedDB === 'undefined') {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(BLOB_STORE)) {
        db.createObjectStore(BLOB_STORE);
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      if (db.objectStoreNames.contains(BLOB_STORE)) {
        resolve(db);
        return;
      }
      // The database exists at a version that predates the blob store (an
      // earlier open created it without one). Bump the version once so the
      // upgrade handler can add the store instead of failing every write.
      const nextVersion = db.version + 1;
      db.close();
      const retry = indexedDB.open(DB_NAME, nextVersion);
      retry.onupgradeneeded = () => {
        const upgraded = retry.result;
        if (!upgraded.objectStoreNames.contains(BLOB_STORE)) {
          upgraded.createObjectStore(BLOB_STORE);
        }
      };
      retry.onsuccess = () => resolve(retry.result);
      retry.onerror = () => resolve(null);
    };
    request.onerror = () => resolve(null);
  });
}

async function putBlob(key: string, blob: Blob): Promise<void> {
  const db = await openDb();
  if (!db) throw new Error('IndexedDB unavailable');
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(BLOB_STORE, 'readwrite');
      tx.objectStore(BLOB_STORE).put(blob, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

async function getBlob(key: string): Promise<Blob | null> {
  const db = await openDb();
  if (!db) return null;
  try {
    return await new Promise<Blob | null>((resolve) => {
      const tx = db.transaction(BLOB_STORE, 'readonly');
      const req = tx.objectStore(BLOB_STORE).get(key);
      req.onsuccess = () => resolve((req.result as Blob) || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  } finally {
    db.close();
  }
}

async function removeBlob(key: string): Promise<void> {
  const db = await openDb();
  if (!db) return;
  try {
    await new Promise<void>((resolve) => {
      const tx = db.transaction(BLOB_STORE, 'readwrite');
      tx.objectStore(BLOB_STORE).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // The metadata row is removed regardless; a leftover blob is harmless.
  } finally {
    db.close();
  }
}

function localKey(url: string | undefined): string | null {
  return url && url.startsWith(LOCAL_PREFIX) ? url.slice(LOCAL_PREFIX.length) : null;
}

function urlForStored(url: string | undefined): string {
  const key = localKey(url);
  if (!key) return url || '';
  const cached = objectUrls.get(key);
  return cached || '';
}

/** Metadata only: the image bytes stay in IndexedDB. */
export function readUploads(): ThumbnailItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => item && item.id && (item.imageUrl || item.sourceUrl));
  } catch {
    return [];
  }
}

function writeUploads(items: ThumbnailItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(META_KEY, JSON.stringify(items));
  } catch (err) {
    console.warn('Could not save uploads:', err);
  }
  window.dispatchEvent(new Event(UPLOADS_CHANGED_EVENT));
}

function withResolvedUrl(item: ThumbnailItem): ThumbnailItem {
  const resolved = urlForStored(item.imageUrl);
  if (!resolved) return item;
  return { ...item, imageUrl: resolved, sourceUrl: resolved };
}

/** Synchronous read, using whatever object URLs were already resolved. */
export function getUploads(): ThumbnailItem[] {
  return readUploads().map(withResolvedUrl);
}

async function hydrate(item: ThumbnailItem): Promise<ThumbnailItem> {
  const key = localKey(item.imageUrl);
  if (!key) return item;
  let url = objectUrls.get(key);
  if (!url) {
    const blob = await getBlob(key);
    if (!blob) return item;
    url = URL.createObjectURL(blob);
    objectUrls.set(key, url);
  }
  return { ...item, imageUrl: url, sourceUrl: url };
}

/** Every upload with its image ready to render. */
export async function listUploads(): Promise<ThumbnailItem[]> {
  const items = readUploads();
  let migrated = false;
  const resolved: ThumbnailItem[] = [];
  for (const item of items) {
    if ((item.imageUrl || '').startsWith('data:')) {
      resolved.push(await toStored(item));
      migrated = true;
    } else {
      resolved.push(item);
    }
  }
  // Older rows kept their base64 image in localStorage. Move those into
  // IndexedDB once so the metadata stays small.
  if (migrated) writeUploads(resolved);
  return Promise.all(resolved.map(hydrate));
}

/**
 * Decode a data URL without fetch(): fetch() is governed by connect-src, which
 * does not allow data: URLs, so the CSP would reject it in production.
 */
function dataUrlToBlob(dataUrl: string): Blob | null {
  const match = /^data:([^;,]+)?(;base64)?,([\s\S]*)$/.exec(dataUrl);
  if (!match) return null;
  const mime = match[1] || 'application/octet-stream';
  const isBase64 = Boolean(match[2]);
  const data = match[3];
  try {
    if (!isBase64) {
      return new Blob([decodeURIComponent(data)], { type: mime });
    }
    const binary = atob(data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  } catch {
    return null;
  }
}

/**
 * Move any data URL into IndexedDB and leave only a key behind. Remote URLs
 * (YouTube) are kept as-is.
 */
async function toStored(item: ThumbnailItem): Promise<ThumbnailItem> {
  const url = item.imageUrl || '';
  if (!url.startsWith('data:')) return item;
  const blob = dataUrlToBlob(url);
  if (!blob) return item;
  const key = `image-${item.id}`;
  try {
    await putBlob(key, blob);
  } catch (err) {
    // Falling back to the data URL keeps the upload visible; it just costs
    // localStorage space until the next successful write.
    console.warn('Could not store upload image:', err);
    return item;
  }
  const objectUrl = URL.createObjectURL(blob);
  objectUrls.set(key, objectUrl);
  return { ...item, imageUrl: `${LOCAL_PREFIX}${key}`, sourceUrl: `${LOCAL_PREFIX}${key}` };
}

export async function saveUploads(items: ThumbnailItem[]): Promise<ThumbnailItem[]> {
  if (!items || items.length === 0) return getUploads();
  const stored: ThumbnailItem[] = [];
  for (const item of items) stored.push(await toStored(item));

  const byId = new Map(readUploads().map((item) => [item.id, item]));
  for (const item of stored) byId.set(item.id, item);
  const merged = Array.from(byId.values()).sort(
    (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
  );

  writeUploads(merged);
  return merged.map(withResolvedUrl);
}

export async function updateUpload(item: ThumbnailItem): Promise<void> {
  const current = readUploads();
  const index = current.findIndex((row) => row.id === item.id);
  if (index < 0) return;
  const next = [...current];
  // keep the stored image reference unless the caller supplied a new image
  next[index] = {
    ...current[index],
    ...item,
    imageUrl: item.imageUrl || current[index].imageUrl,
    sourceUrl: item.sourceUrl || current[index].sourceUrl,
  };
  writeUploads(next);
}

export async function deleteUpload(id: string): Promise<void> {
  const current = readUploads();
  const target = current.find((item) => item.id === id);
  const key = localKey(target?.imageUrl);
  if (key) {
    const url = objectUrls.get(key);
    if (url) URL.revokeObjectURL(url);
    objectUrls.delete(key);
    await removeBlob(key);
  }
  writeUploads(current.filter((item) => item.id !== id));
}
