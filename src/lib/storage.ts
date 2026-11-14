import { ThumbnailItem, CollectionBoard } from './types';

const USER_IMPORTED_KEY = 'thumbvault_user_imported_v2000';
const THUMBNAILS_KEY = 'thumbvault_thumbnails_v2000';
const COLLECTIONS_KEY = 'thumbvault_collections_v2000';
const DELETED_KEYS_KEY = 'thumbvault_permanently_deleted_keys_v2';

/**
 * Raw `data:` URLs are megabytes of base64. Writing even a few of them to
 * localStorage blows the ~5MB quota. Only cloud-hosted (http/https) or `/api/media/`
 * URLs may be persisted — data URLs live in memory only until uploaded.
 */
function isCloudPersistable(item: ThumbnailItem): boolean {
  const url = item?.imageUrl || '';
  return url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/api/media/');
}

function stripUndefined<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val !== undefined) clean[key] = val;
  }
  return clean;
}

async function getAuthHeaders(): Promise<Record<string, string> | null> {
  if (typeof window === 'undefined') return null;
  try {
    const { getFirebaseIdToken } = await import('./firebase');
    const token = await getFirebaseIdToken();
    if (!token) return null;
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
  } catch {
    return null;
  }
}

// Purge legacy keys
if (typeof window !== 'undefined') {
  try {
    const legacyKeys = [
      'thumbvault_thumbnails_v1000_wiped',
      'thumbvault_user_imported_v1000_wiped',
      'thumbvault_thumbnails_v900_clean',
      'thumbvault_user_imported_v4_clean',
      'thumbfeed_thumbnails_v1',
      'thumbfeed_user_imported_v1',
      'thumbfeed_thumbnails',
      'thumbvault_thumbnails',
      'thumbfeed_posters_v2',
    ];
    legacyKeys.forEach((k) => localStorage.removeItem(k));
  } catch {}
}

export function getPermanentlyDeletedKeys(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(DELETED_KEYS_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

export function markThumbnailPermanentlyDeleted(keys: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    const current = getPermanentlyDeletedKeys();
    keys.forEach((k) => {
      if (k) current.add(k);
    });
    localStorage.setItem(DELETED_KEYS_KEY, JSON.stringify(Array.from(current)));
  } catch (e) {
    console.warn('Failed to record deleted key:', e);
  }
}

export function unmarkThumbnailPermanentlyDeleted(keys: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    const current = getPermanentlyDeletedKeys();
    let changed = false;
    keys.forEach((k) => {
      if (k && current.delete(k)) changed = true;
    });
    if (changed) {
      localStorage.setItem(DELETED_KEYS_KEY, JSON.stringify(Array.from(current)));
    }
  } catch {}
}

export const DEFAULT_COLLECTIONS: CollectionBoard[] = [];

export function classifyNicheFromFilename(filename: string): { niche: ThumbnailItem['niche']; tags: string[] } {
  const lower = filename.toLowerCase();

  if (
    lower.includes('documentary') || lower.includes('geopolitical') || lower.includes('history') ||
    lower.includes('investigation') || lower.includes('cold war') || lower.includes('cia') ||
    lower.includes('kgb') || lower.includes('north korea') || lower.includes('scam') ||
    lower.includes('cult') || lower.includes('conspiracy')
  ) {
    return { niche: 'Documentary', tags: ['Documentary', 'Storytelling', 'Deep Dive', 'Cinematic'] };
  }

  if (
    lower.includes('game') || lower.includes('gaming') || lower.includes('gta') ||
    lower.includes('minecraft') || lower.includes('fortnite') || lower.includes('roblox') ||
    lower.includes('playstation') || lower.includes('xbox') || lower.includes('nintendo') ||
    lower.includes('elden ring') || lower.includes('zelda') || lower.includes('pokemon')
  ) {
    return { niche: 'Gaming', tags: ['Gaming', 'Gameplay', 'High Energy', 'Render'] };
  }

  if (
    lower.includes('tech') || lower.includes('apple') || lower.includes('iphone') ||
    lower.includes('macbook') || lower.includes('software') || lower.includes('hardware') ||
    lower.includes('gpu') || lower.includes('nvidia') || lower.includes('review')
  ) {
    return { niche: 'Tech', tags: ['Tech', 'Gadgets', 'Minimalist', 'Hardware'] };
  }

  if (
    lower.includes('business') || lower.includes('money') || lower.includes('crypto') ||
    lower.includes('bitcoin') || lower.includes('finance') || lower.includes('millionaire') ||
    lower.includes('startup') || lower.includes('rich') || lower.includes('wealth') ||
    lower.includes('invest') || lower.includes('stocks') || lower.includes('passive income')
  ) {
    return { niche: 'Business', tags: ['Business', 'Finance', 'Wealth', 'High CTR'] };
  }

  if (
    lower.includes('podcast') || lower.includes('interview') || lower.includes('episode') ||
    lower.includes('talk') || lower.includes('show') || lower.includes('joe rogan') ||
    lower.includes('huberman') || lower.includes('fridman')
  ) {
    return { niche: 'Podcast', tags: ['Podcast', 'Conversation', 'Longform', 'Studio'] };
  }

  if (
    lower.includes('study') || lower.includes('learn') || lower.includes('how to') ||
    lower.includes('tutorial') || lower.includes('guide') || lower.includes('science') ||
    lower.includes('physics') || lower.includes('math') || lower.includes('explained')
  ) {
    return { niche: 'Educational', tags: ['Educational', 'Explanation', 'Visual Breakdown'] };
  }

  if (
    lower.includes('football') || lower.includes('soccer') || lower.includes('nba') ||
    lower.includes('nfl') || lower.includes('sport') || lower.includes('workout') ||
    lower.includes('fitness') || lower.includes('gym')
  ) {
    return { niche: 'Sports', tags: ['Sports', 'Athletic', 'High Energy'] };
  }

  return { niche: 'Entertainment', tags: ['Entertainment', 'Trending', 'Viral', 'Curated'] };
}

export function normalizeItemNiche(item: ThumbnailItem): ThumbnailItem {
  if (item.niche && item.niche.trim() !== '') return item;
  const inferred = classifyNicheFromFilename(item.imageUrl || item.title);
  return {
    ...item,
    niche: inferred.niche,
    tags: Array.from(new Set([...(item.tags || []), ...inferred.tags]))
  };
}

const GENERIC_THUMBNAIL_BASES = new Set([
  'maxresdefault',
  'sddefault',
  'hqdefault',
  'mqdefault',
  'default',
  'hq720',
  'vi_webp',
  'oar2',
  'thumbnail',
  'thumb',
  'image',
  'poster',
]);

export function extractDedupeKeys(item: {
  id?: string;
  videoId?: string;
  imageUrl?: string;
  sourceUrl?: string;
  url?: string;
  title?: string;
}): string[] {
  const keys: string[] = [];
  if (item.id) keys.push(item.id);
  if (item.videoId && /^[a-zA-Z0-9_-]{11}$/.test(item.videoId)) {
    keys.push(item.videoId);
    keys.push(`yt:${item.videoId}`);
  }
  if (item.imageUrl) {
    keys.push(item.imageUrl);
    const filename = decodeURIComponent(item.imageUrl.split('/').pop()?.split('?')[0] || '');
    if (filename) {
      const cleanBase = filename
        .toLowerCase()
        .replace(/^small_/, '')
        .replace(/\.(jpg|jpeg|png|webp|gif|avif)$/, '')
        .replace(/(?:_[a-z0-9]{4,6})+$/, '');
      if (!GENERIC_THUMBNAIL_BASES.has(cleanBase)) {
        keys.push(filename);
        if (cleanBase.length > 5) keys.push(cleanBase);
      }
    }
    const ytMatch =
      item.imageUrl.match(/(?:\/vi\/|\/vi_webp\/|thumb-yt-|ch-yt-|yt-ch-|yt-vid-)([a-zA-Z0-9_-]{11})/) ||
      item.imageUrl.split('?')[0].match(/(?:^|\/|_)([A-Za-z0-9-]{11})(?:_[a-z0-9]{4,6})+\.(?:jpg|webp|png)$/i);
    if (ytMatch && ytMatch[1] && ytMatch[1].length === 11 && /(?=.*[a-z])(?=.*[A-Z0-9-])/.test(ytMatch[1])) {
      keys.push(ytMatch[1]);
      keys.push(`yt:${ytMatch[1]}`);
    }
  }
  const linkUrl = item.sourceUrl || item.url;
  if (linkUrl) {
    const ytMatch = linkUrl.match(/(?:v=|youtu\.be\/|embed\/|\/vi\/|\/shorts\/|\/live\/)([a-zA-Z0-9_-]{11})/);
    if (ytMatch && ytMatch[1]) {
      keys.push(ytMatch[1]);
      keys.push(`yt:${ytMatch[1]}`);
    }
  }
  return keys;
}

export function blendAndDistributeThumbnails(baseList: ThumbnailItem[], userImports: ThumbnailItem[]): ThumbnailItem[] {
  if (!userImports || userImports.length === 0) return baseList;
  if (!baseList || baseList.length === 0) return userImports;

  const seenKeys = new Set<string>();
  const uniqueImports: ThumbnailItem[] = [];
  userImports.forEach((item) => {
    const keys = extractDedupeKeys(item);
    if (!keys.some((k) => seenKeys.has(k))) {
      keys.forEach((k) => seenKeys.add(k));
      uniqueImports.push(item);
    }
  });

  const uniqueBase = baseList.filter((item) => {
    const keys = extractDedupeKeys(item);
    return !keys.some((k) => seenKeys.has(k));
  });

  return [...uniqueImports, ...uniqueBase];
}

export function getUserImportedThumbnails(): ThumbnailItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(USER_IMPORTED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(normalizeItemNiche) : [];
  } catch {
    return [];
  }
}

export function saveUserImportedThumbnails(newItems: ThumbnailItem[]): ThumbnailItem[] {
  if (typeof window === 'undefined') return newItems;
  try {
    const current = getUserImportedThumbnails();
    const merged = blendAndDistributeThumbnails(current, newItems);
    localStorage.setItem(USER_IMPORTED_KEY, JSON.stringify(merged.filter(isCloudPersistable)));
    return merged;
  } catch (e) {
    console.warn('Failed to save user imported thumbnails:', e);
    return newItems;
  }
}

export async function fetchLiveThumbnails(): Promise<ThumbnailItem[]> {
  const userImports = getUserImportedThumbnails();
  let baseThumbnails: ThumbnailItem[] = [];

  try {
    const res = await fetch('/api/gallery?pageSize=100');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.items) && data.items.length > 0) {
        baseThumbnails = data.items;
      }
    }
  } catch (err) {
    console.warn('Gallery endpoint note:', err);
  }

  const deletedKeys = getPermanentlyDeletedKeys();
  const validBase = baseThumbnails.filter((b) => !deletedKeys.has(b.id) && !deletedKeys.has(b.imageUrl));
  const validUserImports = userImports.filter((u) => !deletedKeys.has(u.id) && !deletedKeys.has(u.imageUrl));

  const combined = blendAndDistributeThumbnails(validBase, validUserImports);

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(THUMBNAILS_KEY, JSON.stringify(combined.filter(isCloudPersistable)));
    } catch (e) {
      console.warn('Could not cache merged thumbnails to localStorage:', e);
    }
  }

  return combined;
}

export function getStoredThumbnails(): ThumbnailItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const deletedKeys = getPermanentlyDeletedKeys();
    const userImports = getUserImportedThumbnails().filter((u) => !deletedKeys.has(u.id) && !deletedKeys.has(u.imageUrl));
    const raw = localStorage.getItem(THUMBNAILS_KEY);

    let baseList: ThumbnailItem[] = [];
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        baseList = parsed.map(normalizeItemNiche);
      }
    }

    baseList = baseList.filter((b) => !deletedKeys.has(b.id) && !deletedKeys.has(b.imageUrl));

    if (userImports.length === 0) {
      return baseList;
    }

    return blendAndDistributeThumbnails(baseList, userImports);
  } catch {
    return [];
  }
}

export async function deleteStoredThumbnail(target: { id?: string; imageUrl?: string }): Promise<{ items: ThumbnailItem[]; storageRemovalFailed: boolean }> {
  if (typeof window === 'undefined') return { items: [], storageRemovalFailed: false };
  if (!target.id && !target.imageUrl) return { items: getStoredThumbnails(), storageRemovalFailed: false };

  const currentList = getStoredThumbnails();
  const deletedKeys = extractDedupeKeys(target);
  markThumbnailPermanentlyDeleted(deletedKeys);

  const updatedList = currentList.filter((t) => {
    if (target.id && t.id === target.id) return false;
    if (target.imageUrl && t.imageUrl === target.imageUrl) return false;
    return true;
  });

  try {
    localStorage.setItem(THUMBNAILS_KEY, JSON.stringify(updatedList));
  } catch (e) {
    console.warn('LocalStorage delete update warning:', e);
  }

  const userImports = getUserImportedThumbnails();
  const updatedImports = userImports.filter((t) => {
    if (target.id && t.id === target.id) return false;
    if (target.imageUrl && t.imageUrl === target.imageUrl) return false;
    return true;
  });
  try {
    localStorage.setItem(USER_IMPORTED_KEY, JSON.stringify(updatedImports));
  } catch {}

  try {
    const rawCols = localStorage.getItem(COLLECTIONS_KEY);
    if (rawCols) {
      const parsed = JSON.parse(rawCols);
      if (Array.isArray(parsed)) {
        const cleanedCols = parsed.map((col: CollectionBoard) => ({
          ...col,
          thumbnailIds: (col.thumbnailIds || []).filter((id: string) => id !== target.id && id !== target.imageUrl)
        }));
        localStorage.setItem(COLLECTIONS_KEY, JSON.stringify(cleanedCols));
      }
    }
  } catch {}

  let storageRemovalFailed = false;
  try {
    const authHeaders = await getAuthHeaders();
    if (!authHeaders) {
      storageRemovalFailed = true;
    } else {
      const res = await fetch('/api/thumbnails/delete', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          id: target.id,
          imageUrl: target.imageUrl
        })
      });
      if (!res.ok) {
        storageRemovalFailed = true;
      } else {
        const data = await res.json().catch(() => null);
        if (data && data.storageDeleted === false && data.storageSkipped !== true) {
          storageRemovalFailed = true;
        }
      }
    }
  } catch (apiErr) {
    console.warn('Server delete endpoint note:', apiErr);
    storageRemovalFailed = true;
  }

  return { items: updatedList, storageRemovalFailed };
}

export const deleteStoredThumbnailPermanently = deleteStoredThumbnail;

export function updateStoredThumbnail(updatedItem: ThumbnailItem): ThumbnailItem[] {
  if (typeof window === 'undefined') return [];

  const userImports = getUserImportedThumbnails();
  const importIdx = userImports.findIndex((t) => t.id === updatedItem.id || t.imageUrl === updatedItem.imageUrl);
  if (importIdx >= 0) {
    userImports[importIdx] = updatedItem;
    localStorage.setItem(USER_IMPORTED_KEY, JSON.stringify(userImports));
  }

  const list = getStoredThumbnails();
  const updated = list.map((t) => (t.id === updatedItem.id || t.imageUrl === updatedItem.imageUrl ? updatedItem : t));
  localStorage.setItem(THUMBNAILS_KEY, JSON.stringify(updated));

  return updated;
}

export function saveStoredThumbnails(newItems: ThumbnailItem[]): ThumbnailItem[] {
  if (typeof window === 'undefined') return newItems;
  if (!newItems || newItems.length === 0) return getStoredThumbnails();

  const resurrectKeys: string[] = [];
  newItems.forEach((item) => {
    resurrectKeys.push(...extractDedupeKeys(item));
  });
  unmarkThumbnailPermanentlyDeleted(resurrectKeys);

  saveUserImportedThumbnails(newItems);

  const list = getStoredThumbnails();
  const updated = blendAndDistributeThumbnails(list, newItems);

  try {
    localStorage.setItem(THUMBNAILS_KEY, JSON.stringify(updated.filter(isCloudPersistable)));
  } catch (e) {
    console.warn('LocalStorage save quota warning:', e);
  }

  return updated;
}

export function saveStoredThumbnail(item: ThumbnailItem): ThumbnailItem[] {
  return saveStoredThumbnails([item]);
}

export async function syncBoardsToServer(boards: CollectionBoard[]): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const authHeaders = await getAuthHeaders();
    if (!authHeaders) return;
    await fetch('/api/boards', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(boards),
    });
  } catch (err) {
    console.warn('Failed to sync boards to server:', err);
  }
}

export async function syncBoardsFromServer(): Promise<CollectionBoard[]> {
  if (typeof window === 'undefined') return [];
  try {
    const authHeaders = await getAuthHeaders();
    if (!authHeaders) {
      return [];
    }
    const res = await fetch('/api/boards', { headers: { Authorization: authHeaders.Authorization } });
    if (res.ok) {
      const serverBoards = await res.json();
      if (Array.isArray(serverBoards)) {
        const filtered = serverBoards.filter(
          (c) => c.id !== 'col-1' && c.id !== 'col-2'
        );
        localStorage.setItem(COLLECTIONS_KEY, JSON.stringify(filtered));
        return filtered;
      }
    }
  } catch (err) {
    console.warn('Failed to sync boards from server:', err);
  }
  return getStoredCollections();
}

export function clearLocalUserCollections(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(COLLECTIONS_KEY);
  } catch {}
}

export function getStoredCollections(): CollectionBoard[] {
  if (typeof window === 'undefined') return DEFAULT_COLLECTIONS;
  try {
    const raw = localStorage.getItem(COLLECTIONS_KEY);
    if (!raw) {
      localStorage.setItem(COLLECTIONS_KEY, JSON.stringify([]));
      return [];
    }
    const parsed: CollectionBoard[] = JSON.parse(raw);
    const filtered = (Array.isArray(parsed) ? parsed : []).filter(
      (c) => c.id !== 'col-1' && c.id !== 'col-2'
    );
    if (filtered.length !== parsed.length) {
      localStorage.setItem(COLLECTIONS_KEY, JSON.stringify(filtered));
    }
    return filtered;
  } catch {
    return [];
  }
}

export function deleteCollection(collectionId: string): CollectionBoard[] {
  if (typeof window === 'undefined') return [];
  const list = getStoredCollections().filter((c) => c.id !== collectionId);
  try {
    localStorage.setItem(COLLECTIONS_KEY, JSON.stringify(list));
  } catch (e) {
    console.warn('Failed to delete collection from localStorage:', e);
  }
  syncBoardsToServer(list);

  import('./firebase')
    .then(async ({ auth, handleFirestoreError, OperationType }) => {
      if (!auth.currentUser) return;
      const { doc, deleteDoc } = await import('firebase/firestore');
      const { db } = await import('./firestore');
      try {
        await deleteDoc(doc(db, 'collections', collectionId));
      } catch (err) {
        try {
          handleFirestoreError(err, OperationType.DELETE, `collections/${collectionId}`);
        } catch {}
      }
    })
    .catch(() => {});

  return list;
}

async function syncSingleCollectionToFirestore(board: CollectionBoard): Promise<void> {
  try {
    const { auth, handleFirestoreError, OperationType } = await import('./firebase');
    const currentUser = auth.currentUser;
    if (!currentUser) return;
    const { doc, getDoc, setDoc, updateDoc, serverTimestamp } = await import('firebase/firestore');
    const { db } = await import('./firestore');
    const ref = doc(db, 'collections', board.id);
    try {
      const snap = await getDoc(ref);
      const cleanPayload = stripUndefined({
        id: board.id.slice(0, 128),
        userId: currentUser.uid.slice(0, 128),
        name: (board.name || 'Untitled Board').slice(0, 120),
        description: (board.description || '').slice(0, 500),
        thumbnailIds: (Array.isArray(board.thumbnailIds) ? board.thumbnailIds : [])
          .filter((id): id is string => typeof id === 'string' && id.length <= 128)
          .slice(0, 2000),
        colorTheme: (board.colorTheme || '').slice(0, 64),
      });
      if (!snap.exists()) {
        await setDoc(ref, {
          ...cleanPayload,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        await updateDoc(ref, {
          name: cleanPayload.name,
          description: cleanPayload.description,
          thumbnailIds: cleanPayload.thumbnailIds,
          colorTheme: cleanPayload.colorTheme,
          updatedAt: serverTimestamp(),
        });
      }
    } catch (err) {
      try {
        handleFirestoreError(err, OperationType.WRITE, `collections/${board.id}`);
      } catch {}
    }
  } catch {}
}

export function addThumbnailsToBoard(collectionId: string, thumbIds: string[]): CollectionBoard[] {
  const uniqueIds = Array.from(new Set(thumbIds.filter(Boolean)));
  if (uniqueIds.length === 0) return getStoredCollections();
  const collections = getStoredCollections();
  const updated = collections.map((c) => {
    if (c.id === collectionId) {
      const existing = new Set(c.thumbnailIds || []);
      const toAdd = uniqueIds.filter((id) => !existing.has(id));
      if (toAdd.length > 0) {
        return { ...c, thumbnailIds: [...(c.thumbnailIds || []), ...toAdd] };
      }
    }
    return c;
  });
  try {
    localStorage.setItem(COLLECTIONS_KEY, JSON.stringify(updated));
  } catch {}
  syncBoardsToServer(updated);
  const target = updated.find((c) => c.id === collectionId);
  if (target) {
    syncSingleCollectionToFirestore(target);
  }
  return updated;
}

export function addThumbnailToBoard(collectionId: string, thumbId: string): CollectionBoard[] {
  return addThumbnailsToBoard(collectionId, [thumbId]);
}

export function saveCollection(collection: CollectionBoard): CollectionBoard[] {
  if (typeof window === 'undefined') return [collection, ...DEFAULT_COLLECTIONS];
  const list = getStoredCollections();
  const existsIndex = list.findIndex((c) => c.id === collection.id);
  let updated: CollectionBoard[];
  if (existsIndex >= 0) {
    updated = [...list];
    updated[existsIndex] = collection;
  } else {
    updated = [collection, ...list];
  }
  localStorage.setItem(COLLECTIONS_KEY, JSON.stringify(updated));
  syncBoardsToServer(updated);
  syncSingleCollectionToFirestore(collection);

  return updated;
}

export function toggleThumbnailInCollection(collectionId: string, thumbId: string): CollectionBoard[] {
  const collections = getStoredCollections();
  const updated = collections.map((c) => {
    if (c.id === collectionId) {
      const exists = c.thumbnailIds.includes(thumbId);
      return {
        ...c,
        thumbnailIds: exists
          ? c.thumbnailIds.filter((id) => id !== thumbId)
          : [...c.thumbnailIds, thumbId]
      };
    }
    return c;
  });
  localStorage.setItem(COLLECTIONS_KEY, JSON.stringify(updated));
  syncBoardsToServer(updated);

  const target = updated.find((c) => c.id === collectionId);
  if (target) {
    syncSingleCollectionToFirestore(target);
  }

  return updated;
}
