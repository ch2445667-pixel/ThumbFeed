import { ThumbnailItem, CollectionBoard } from './types';
import { INITIAL_THUMBNAILS } from './mockData';
import { INITIAL_POSTERS } from './posters';
import { supabase, isSupabaseConfigured } from './supabase';

const USER_IMPORTED_KEY = 'thumbvault_user_imported_v1000_wiped';
const THUMBNAILS_KEY = 'thumbvault_thumbnails_v1000_wiped';
const COLLECTIONS_KEY = 'thumbvault_collections_v1000_clean';
const DELETED_KEYS_KEY = 'thumbvault_permanently_deleted_keys_v2';
const POSTERS_KEY = 'thumbfeed_posters_v2';

// Purge any legacy cached thumbnails from previous sessions immediately
if (typeof window !== 'undefined') {
  try {
    const legacyKeys = [
      'thumbvault_thumbnails_v900_clean',
      'thumbvault_user_imported_v4_clean',
      'thumbfeed_thumbnails_v1',
      'thumbfeed_user_imported_v1',
      'thumbfeed_thumbnails',
      'thumbvault_thumbnails'
    ];
    legacyKeys.forEach(k => localStorage.removeItem(k));
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
    keys.forEach(k => {
      if (k) current.add(k);
    });
    localStorage.setItem(DELETED_KEYS_KEY, JSON.stringify(Array.from(current)));
  } catch (e) {
    console.warn('Failed to record deleted key:', e);
  }
}

export const DEFAULT_COLLECTIONS: CollectionBoard[] = [
  {
    id: 'col-1',
    name: '🔥 High CTR Hooks',
    description: 'Thumbnails with bold expressions, curiosity gaps and high engagement',
    thumbnailIds: [],
    createdAt: '2026-08-20',
    colorTheme: '#401D1A'
  },
  {
    id: 'col-2',
    name: '🖤 Dark & Minimalist Tech',
    description: 'Clean Apple-style and sleek documentary lighting references',
    thumbnailIds: [],
    createdAt: '2026-08-20',
    colorTheme: '#E4E0D3'
  }
];

// Map lookup by ID, imageUrl, and filename for instantaneous enriched metadata
const initialMap = new Map<string, ThumbnailItem>();
INITIAL_THUMBNAILS.forEach(item => {
  initialMap.set(item.id, item);
  initialMap.set(item.imageUrl, item);
  // Extract filename from URL
  const filename = decodeURIComponent(item.imageUrl.split('/').pop() || '');
  if (filename) {
    initialMap.set(filename, item);
  }
});

function formatTitleFromFilename(filename: string): string {
  return filename
    .replace(/\.[^/.]+$/, '') // remove extension
    .replace(/^\d+[\.\-_]\s*/, '') // remove leading numbers like '583. ' or '01_'
    .replace(/[_-]+/g, ' ') // replace underscores and hyphens with spaces
    .trim();
}

function getDeterministicLikes(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return (Math.abs(hash) % 80) + 60;
}

export function classifyNicheFromFilename(filename: string): { niche: ThumbnailItem['niche']; tags: string[] } {
  const lower = filename.toLowerCase();
  
  if (
    lower.includes('documentary') || lower.includes('geopolitical') || lower.includes('history') ||
    lower.includes('mystery') || lower.includes('truth') || lower.includes('investigation') ||
    lower.includes('dark reality') || lower.includes('untold story') || lower.includes('crime') ||
    lower.includes('downfall') || lower.includes('conspiracy') || lower.includes('scam')
  ) {
    return { niche: 'Documentary', tags: ['Documentary', 'Deep Dive', 'True Story', 'Investigation', 'Curiosity'] };
  }
  
  if (
    lower.includes('vlog') || lower.includes('lifestyle') || lower.includes('daily') ||
    lower.includes('routine') || lower.includes('day in') || lower.includes('living in') ||
    lower.includes('fashion') || lower.includes('travel') || lower.includes('room') ||
    lower.includes('irl') || lower.includes('outfit')
  ) {
    return { niche: 'IRL', tags: ['IRL', 'Lifestyle', 'Daily Vlog', 'Personal Experience', 'Authentic'] };
  }
  
  if (
    lower.includes('gym') || lower.includes('fitness') || lower.includes('workout') ||
    lower.includes('muscle') || lower.includes('bodybuilding') || lower.includes('physique') ||
    lower.includes('football') || lower.includes('soccer') || lower.includes('racing') ||
    lower.includes('f1') || lower.includes('sports') || lower.includes('athlete') ||
    lower.includes('transformation')
  ) {
    return { niche: 'Sports', tags: ['Sports', 'Workout', 'Bodybuilding', 'Athletics', 'Transformation'] };
  }
  
  if (
    lower.includes('game') || lower.includes('gaming') || lower.includes('minecraft') ||
    lower.includes('roblox') || lower.includes('gta') || lower.includes('stream') ||
    lower.includes('fortnite') || lower.includes('valorant') || lower.includes('pokemon') ||
    lower.includes('playstation') || lower.includes('xbox') || lower.includes('twitch')
  ) {
    return { niche: 'Gaming', tags: ['Gaming', 'YouTube Gaming', 'High Stakes', 'Gameplay'] };
  }
  
  if (
    lower.includes('money') || lower.includes('million') || lower.includes('business') ||
    lower.includes('invest') || lower.includes('finance') || lower.includes('sales') ||
    lower.includes('rich') || lower.includes('dollar') || lower.includes('crypto') ||
    lower.includes('stock') || lower.includes('real estate') || lower.includes('startup') ||
    lower.includes('economy') || lower.includes('wealth') || lower.includes('passive income')
  ) {
    return { niche: 'Business', tags: ['Business', 'Investing', 'Finance', 'Wealth', 'Entrepreneur'] };
  }
  
  if (
    lower.includes('tutorial') || lower.includes('course') || lower.includes('photoshop') ||
    lower.includes('after effects') || lower.includes('guide') || lower.includes('learn') ||
    lower.includes('how to') || lower.includes('editing') || lower.includes('masterclass') ||
    lower.includes('design') || lower.includes('lesson') || lower.includes('explained')
  ) {
    return { niche: 'Educational', tags: ['Educational', 'Tutorial', 'Masterclass', 'Step-by-Step', 'Pro Guide'] };
  }
  
  if (
    lower.includes('mrbeast') || lower.includes('challenge') || lower.includes('viral') ||
    lower.includes('comedy') || lower.includes('prank') || lower.includes('survive') ||
    lower.includes('trapped') || lower.includes('100 days') || lower.includes('$1')
  ) {
    return { niche: 'Entertainment', tags: ['Entertainment', 'Viral Challenge', 'High Energy', 'MrBeast Style'] };
  }
  
  return { niche: 'Tech', tags: ['Tech', 'AI Tools', 'Hardware', 'Software', 'Gadgets'] };
}

export function normalizeItemNiche(item: ThumbnailItem): ThumbnailItem {
  if (item.tags && Array.isArray(item.tags)) {
    return {
      ...item,
      niche: item.niche || ((item.tags[0] || '') as ThumbnailItem['niche'])
    };
  }

  const currentNiche = item.niche as string;
  if (!currentNiche) {
    return {
      ...item,
      tags: []
    };
  }

  const validNiches: ThumbnailItem['niche'][] = [
    'IRL', 'Business', 'Tech', 'Entertainment', 'Gaming', 'Sports', 'Documentary', 'Educational'
  ];

  if (validNiches.includes(item.niche)) {
    return {
      ...item,
      tags: [item.niche]
    };
  }

  // Map legacy category names
  let remappedNiche: ThumbnailItem['niche'] = item.niche;
  if (currentNiche === 'Tech & AI') remappedNiche = 'Tech';
  else if (currentNiche === 'Finance & Business') remappedNiche = 'Business';
  else if (currentNiche === 'Vlogs & Lifestyle') remappedNiche = 'IRL';
  else if (currentNiche === 'Fitness & Health') remappedNiche = 'Sports';
  else if (currentNiche === 'Tutorials & Design') remappedNiche = 'Educational';
  else if (currentNiche === 'Documentary') remappedNiche = 'Documentary';
  else if (currentNiche === 'Gaming') remappedNiche = 'Gaming';
  else if (currentNiche === 'Entertainment') remappedNiche = 'Entertainment';

  return {
    ...item,
    niche: remappedNiche,
    tags: item.tags || (remappedNiche ? [remappedNiche] : [])
  };
}

/**
 * Pure Fisher-Yates shuffle algorithm (only used when explicitly triggered)
 */
export function shuffleThumbnails(items: ThumbnailItem[]): ThumbnailItem[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = arr[i];
    arr[i] = arr[j];
    arr[j] = temp;
  }
  return arr;
}

/**
 * Extracts multiple deduplication keys for a thumbnail item to prevent duplicates
 * across YouTube video IDs, canonical URLs, image sources, and IDs.
 */
export function extractDedupeKeys(item: { id?: string; imageUrl?: string; sourceUrl?: string; videoId?: string; title?: string }): string[] {
  const keys: string[] = [];
  if (item.id) keys.push(`id:${item.id}`);

  // 1. Direct YouTube 11-char video ID if present
  const directYtId = item.videoId;
  if (directYtId && directYtId.length === 11) {
    keys.push(`yt:${directYtId}`);
  }

  // 2. Scan id, sourceUrl, and imageUrl for any 11-char YouTube video ID
  const scan = `${item.id || ''} ${item.sourceUrl || ''} ${item.imageUrl || ''}`;
  const ytRegex = /(?:watch\?(?:.*&)?v=|youtu\.be\/|\/shorts\/|\/vi\/|thumb-yt-|thumb-storage-|ch-yt-|yt-vid-|yt-ch-|yt-|_)([a-zA-Z0-9_-]{11})(?:[_\.\?&\/:]|$)/gi;
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

/**
 * Deterministically merge new items without duplicates and without randomizing the feed
 */
export function blendAndDistributeThumbnails(baseList: ThumbnailItem[], newItems: ThumbnailItem[]): ThumbnailItem[] {
  if (!newItems || newItems.length === 0) return baseList;

  // 1. Deduplicate new items among themselves
  const seenKeys = new Set<string>();
  const uniqueNewItems: ThumbnailItem[] = [];

  for (const item of newItems) {
    const keys = extractDedupeKeys(item);
    const isDup = keys.some(k => seenKeys.has(k));
    if (!isDup) {
      keys.forEach(k => seenKeys.add(k));
      uniqueNewItems.push(item);
    }
  }

  // 2. Filter base list to remove any item matching seenKeys
  const filteredBase = baseList.filter(item => {
    const keys = extractDedupeKeys(item);
    return !keys.some(k => seenKeys.has(k));
  });

  // Deterministically place new additions at the front of the feed
  return [...uniqueNewItems, ...filteredBase];
}

/**
 * Get all user imported thumbnails that must NEVER be lost on refresh
 */
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

/**
 * Save user imported thumbnails into the dedicated persistent store with strict deduplication
 */
export function saveUserImportedThumbnails(newItems: ThumbnailItem[]): ThumbnailItem[] {
  if (typeof window === 'undefined') return newItems;
  try {
    const current = getUserImportedThumbnails();
    const seenKeys = new Set<string>();
    const uniqueNew: ThumbnailItem[] = [];

    for (const item of newItems) {
      const keys = extractDedupeKeys(item);
      if (!keys.some(k => seenKeys.has(k))) {
        keys.forEach(k => seenKeys.add(k));
        uniqueNew.push(item);
      }
    }

    const filteredCurrent = current.filter(item => {
      const keys = extractDedupeKeys(item);
      return !keys.some(k => seenKeys.has(k));
    });

    const merged = [...uniqueNew, ...filteredCurrent];
    localStorage.setItem(USER_IMPORTED_KEY, JSON.stringify(merged));
    return merged;
  } catch (e) {
    console.warn('Failed to save user imported thumbnails:', e);
    return newItems;
  }
}

// Fetch live from Supabase Storage Bucket ('Thumbnails') & PostgreSQL database, merging with user imports
export async function fetchLiveSupabaseThumbnails(): Promise<ThumbnailItem[]> {
  const userImports = getUserImportedThumbnails();
  let baseThumbnails: ThumbnailItem[] = [];

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('thumbnails')
        .select('*')
        .not('breakdown_notes', 'ilike', '%poster%')
        .not('id', 'ilike', 'poster-%')
        .not('niche', 'eq', 'Cinema')
        .not('source', 'eq', 'poster')
        .order('created_at', { ascending: false })
        .limit(5000);

      if (!error && data && data.length > 0) {
        baseThumbnails = data.map((row: any) => ({
          id: row.id,
          title: row.title || 'YouTube Thumbnail',
          creator: row.creator && !row.creator.toLowerCase().includes('tanzee') ? row.creator : 'Unknown',
          imageUrl: row.image_url,
          sourceUrl: row.source_url || row.image_url,
          niche: row.niche || '',
          styles: row.styles && row.styles.length > 0 ? row.styles : ['Face Close-up', 'High-Contrast Glow'],
          tags: Array.isArray(row.tags) ? row.tags : (row.niche ? [row.niche] : []),
          colors: row.colors && row.colors.length > 0 ? row.colors : ['#401D1A', '#E4E0D3', '#FFFFFF'],
          ocrText: row.ocr_text || '',
          emotion: row.emotion || 'Curious',
          breakdownNotes: row.breakdown_notes || '',
          viewsEstimate: row.views_estimate || '',
          publishedTime: row.published_time || (row.breakdown_notes?.match(/Published:\s*([^|]+)/i)?.[1]?.trim()) || undefined,
          source: row.source || 'supabase-storage',
          createdAt: row.created_at || new Date().toISOString(),
          likesCount: row.likes_count || 0
        }));
      } else {
        baseThumbnails = [];
      }
    } catch (err) {
      console.warn('Supabase fetch error, using stored dataset:', err);
      baseThumbnails = [];
    }
  }

  // Combine user imported thumbnails blended/distributed across library thumbnails
  const deletedKeys = getPermanentlyDeletedKeys();
  const validBase = baseThumbnails.filter(b => !deletedKeys.has(b.id) && !deletedKeys.has(b.imageUrl));
  const validUserImports = userImports.filter(u => !deletedKeys.has(u.id) && !deletedKeys.has(u.imageUrl));

  // Extract all dedupe keys from valid user imports to strictly prevent duplicate entries
  const userKeys = new Set<string>();
  validUserImports.forEach(u => extractDedupeKeys(u).forEach(k => userKeys.add(k)));
  const filteredBase = validBase.filter(b => !extractDedupeKeys(b).some(k => userKeys.has(k)));
  const combined = validUserImports.length > 0
    ? blendAndDistributeThumbnails(filteredBase, validUserImports)
    : filteredBase;

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(THUMBNAILS_KEY, JSON.stringify(combined));
    } catch (e) {
      console.warn('Could not cache merged thumbnails to localStorage:', e);
    }
  }

  return combined;
}

export function getStoredThumbnails(): ThumbnailItem[] {
  if (typeof window === 'undefined') return INITIAL_THUMBNAILS;
  try {
    const deletedKeys = getPermanentlyDeletedKeys();
    const userImports = getUserImportedThumbnails().filter(u => !deletedKeys.has(u.id) && !deletedKeys.has(u.imageUrl));
    const raw = localStorage.getItem(THUMBNAILS_KEY);
    
    let baseList: ThumbnailItem[] = INITIAL_THUMBNAILS;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        baseList = parsed.map(normalizeItemNiche);
      }
    }

    baseList = baseList.filter(b => !deletedKeys.has(b.id) && !deletedKeys.has(b.imageUrl));

    if (userImports.length === 0) {
      return baseList;
    }

    // Blend user imported thumbnails throughout the base library smoothly with strict deduplication
    const userKeys = new Set<string>();
    userImports.forEach(u => extractDedupeKeys(u).forEach(k => userKeys.add(k)));
    const filteredBase = baseList.filter(b => !extractDedupeKeys(b).some(k => userKeys.has(k)));
    return blendAndDistributeThumbnails(filteredBase, userImports).map(normalizeItemNiche);
  } catch {
    return INITIAL_THUMBNAILS;
  }
}

/**
 * Permanently deletes a thumbnail from all data stores:
 * 1. Supabase PostgreSQL database table ('thumbnails')
 * 2. Supabase Storage bucket ('Thumbnails')
 * 3. Firebase Firestore ('thumbnails' collection)
 * 4. Local persistent storage & caches (and removes from moodboard collections)
 */
export async function deleteStoredThumbnailPermanently(target: { id: string; imageUrl?: string }): Promise<ThumbnailItem[]> {
  const keysToMark: string[] = [target.id];
  if (target.imageUrl) {
    keysToMark.push(target.imageUrl);
    const filename = decodeURIComponent(target.imageUrl.split('/').pop()?.split('?')[0] || '');
    if (filename) keysToMark.push(filename);
  }

  // 1. Mark in permanent deleted set so it is never re-hydrated
  markThumbnailPermanentlyDeleted(keysToMark);

  // 2. Remove from user imported store
  if (typeof window !== 'undefined') {
    try {
      const userImports = getUserImportedThumbnails();
      const filteredImports = userImports.filter(t => t.id !== target.id && (!target.imageUrl || t.imageUrl !== target.imageUrl));
      localStorage.setItem(USER_IMPORTED_KEY, JSON.stringify(filteredImports));
    } catch (e) {
      console.warn('Error clearing user imports:', e);
    }
  }

  // 3. Remove from cached thumbnails list
  let updatedList: ThumbnailItem[] = [];
  if (typeof window !== 'undefined') {
    try {
      const current = getStoredThumbnails();
      updatedList = current.filter(t => t.id !== target.id && (!target.imageUrl || t.imageUrl !== target.imageUrl));
      localStorage.setItem(THUMBNAILS_KEY, JSON.stringify(updatedList));
    } catch (e) {
      console.warn('Error clearing cached thumbnails:', e);
    }
  }

  // 4. Clean up any moodboard collections referencing this thumbnail
  if (typeof window !== 'undefined') {
    try {
      const collections = getStoredCollections();
      let collectionsChanged = false;
      const updatedCollections = collections.map(c => {
        if (c.thumbnailIds.includes(target.id)) {
          collectionsChanged = true;
          return {
            ...c,
            thumbnailIds: c.thumbnailIds.filter(id => id !== target.id)
          };
        }
        return c;
      });
      if (collectionsChanged) {
        localStorage.setItem(COLLECTIONS_KEY, JSON.stringify(updatedCollections));
      }
    } catch (e) {
      console.warn('Error cleaning collection references:', e);
    }
  }

  // 5. Delete from backend database and storage via API route
  try {
    await fetch('/api/thumbnails/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: target.id,
        imageUrl: target.imageUrl
      })
    });
  } catch (apiErr) {
    console.warn('Server delete endpoint note:', apiErr);
  }

  // 6. Direct client-side Supabase delete (for immediate synchronization)
  if (isSupabaseConfigured && supabase) {
    try {
      if (target.id) {
        await supabase.from('thumbnails').delete().eq('id', target.id);
      }
      if (target.imageUrl) {
        await supabase.from('thumbnails').delete().eq('image_url', target.imageUrl);
        let filename = '';
        if (target.imageUrl.includes('/Thumbnails/')) {
          filename = decodeURIComponent(target.imageUrl.split('/Thumbnails/')[1]?.split('?')[0] || '');
        } else if (target.imageUrl.includes('supabase.co')) {
          filename = decodeURIComponent(target.imageUrl.split('/').pop()?.split('?')[0] || '');
        }
        if (filename) {
          await supabase.storage.from('Thumbnails').remove([filename]);
        }
      }
    } catch (sbErr) {
      console.warn('Direct Supabase delete note:', sbErr);
    }
  }

  // 7. Delete from Firebase Firestore if doc exists
  try {
    const { doc, deleteDoc } = await import('firebase/firestore');
    const { db } = await import('./firebase');
    if (db && target.id) {
      await deleteDoc(doc(db, 'thumbnails', target.id)).catch(() => {});
    }
  } catch {
    // Ignore if not present in firestore
  }

  return updatedList;
}

export function updateStoredThumbnail(updatedItem: ThumbnailItem): ThumbnailItem[] {
  if (typeof window === 'undefined') return INITIAL_THUMBNAILS;
  
  // Update in user imports if present
  const userImports = getUserImportedThumbnails();
  const importIdx = userImports.findIndex(t => t.id === updatedItem.id || t.imageUrl === updatedItem.imageUrl);
  if (importIdx >= 0) {
    userImports[importIdx] = updatedItem;
    localStorage.setItem(USER_IMPORTED_KEY, JSON.stringify(userImports));
  }

  const list = getStoredThumbnails();
  const updated = list.map(t => (t.id === updatedItem.id || t.imageUrl === updatedItem.imageUrl ? updatedItem : t));
  localStorage.setItem(THUMBNAILS_KEY, JSON.stringify(updated));

  if (isSupabaseConfigured && supabase) {
    supabase.from('thumbnails').upsert({
      id: updatedItem.id,
      title: updatedItem.title,
      creator: updatedItem.creator,
      image_url: updatedItem.imageUrl,
      source_url: updatedItem.sourceUrl,
      niche: updatedItem.niche,
      styles: updatedItem.styles,
      tags: updatedItem.tags,
      colors: updatedItem.colors,
      ocr_text: updatedItem.ocrText,
      emotion: updatedItem.emotion,
      breakdown_notes: updatedItem.breakdownNotes,
      views_estimate: updatedItem.viewsEstimate,
      source: updatedItem.source,
      likes_count: updatedItem.likesCount || 0
    }).then(({ error }) => {
      if (error) console.warn('Supabase thumbnail update error:', error.message);
    });
  }

  return updated;
}

export function saveStoredThumbnails(newItems: ThumbnailItem[]): ThumbnailItem[] {
  if (typeof window === 'undefined') return newItems;
  if (!newItems || newItems.length === 0) return getStoredThumbnails();

  // Save to persistent user imported list
  saveUserImportedThumbnails(newItems);

  const list = getStoredThumbnails();
  const updated = blendAndDistributeThumbnails(list, newItems);
  
  try {
    localStorage.setItem(THUMBNAILS_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn('LocalStorage save quota warning:', e);
  }

  // Sync to Supabase in batch if available
  if (isSupabaseConfigured && supabase && newItems.length > 0) {
    const records = newItems.map(item => ({
      id: item.id,
      title: item.title,
      creator: item.creator,
      image_url: item.imageUrl,
      source_url: item.sourceUrl,
      niche: item.niche,
      styles: item.styles,
      tags: item.tags,
      colors: item.colors,
      ocr_text: item.ocrText,
      emotion: item.emotion,
      breakdown_notes: item.publishedTime ? `Published: ${item.publishedTime}${item.breakdownNotes ? ` | ${item.breakdownNotes}` : ''}` : (item.breakdownNotes || ''),
      views_estimate: item.viewsEstimate,
      source: item.source,
      likes_count: item.likesCount || 0
    }));

    supabase.from('thumbnails').upsert(records).then(({ error }) => {
      if (error) console.warn('Supabase bulk thumbnail sync error:', error.message);
    });
  }

  return updated;
}

export function saveStoredThumbnail(item: ThumbnailItem): ThumbnailItem[] {
  return saveStoredThumbnails([item]);
}

export function getStoredPosters(): ThumbnailItem[] {
  if (typeof window === 'undefined') return INITIAL_POSTERS;
  try {
    const raw = localStorage.getItem(POSTERS_KEY);
    if (!raw) return INITIAL_POSTERS;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return INITIAL_POSTERS;
    return parsed.filter((p) => p && p.id && p.imageUrl).map(p => ({ ...p, kind: 'poster' as const }));
  } catch {
    return INITIAL_POSTERS;
  }
}

/**
 * Fetch posters live from Supabase (Database table + Storage buckets)
 */
export async function fetchLiveSupabasePosters(): Promise<ThumbnailItem[]> {
  const localPosters = getStoredPosters();
  const dbPosters: ThumbnailItem[] = [];
  const storagePosters: ThumbnailItem[] = [];

  const client = supabase;
  if (isSupabaseConfigured && client) {
    try {
      // 1. Fetch posters from Supabase PostgreSQL database table
      const { data: dbData, error: dbErr } = await client
        .from('thumbnails')
        .select('*')
        .or('id.ilike.poster-%,breakdown_notes.ilike.%poster%,niche.eq.Cinema,source.eq.poster,image_url.ilike.%/posters/%')
        .order('created_at', { ascending: false })
        .limit(1000);

      if (!dbErr && dbData && dbData.length > 0) {
        dbData.forEach((row: any) => {
          dbPosters.push({
            id: row.id.startsWith('poster-') ? row.id : `poster-${row.id}`,
            kind: 'poster',
            title: row.title || 'Movie Poster',
            creator: row.creator && row.creator !== 'YouTube Creator' ? row.creator : 'Cinema',
            imageUrl: row.image_url,
            sourceUrl: row.source_url || row.image_url,
            niche: row.niche || 'Cinema',
            styles: row.styles || [],
            tags: Array.isArray(row.tags) && row.tags.length > 0 ? row.tags : ['Movie Poster', 'Cinema'],
            colors: row.colors || [],
            ocrText: row.ocr_text || '',
            emotion: row.emotion || 'Curious',
            breakdownNotes: row.breakdown_notes || 'Uploaded movie poster.',
            source: 'supabase-storage',
            createdAt: row.created_at || new Date().toISOString(),
            likesCount: row.likes_count || 120
          });
        });
      }

      // 2. Fetch posters from Supabase Storage buckets ('posters', 'Posters', 'Thumbnails')
      const bucketsToCheck = ['posters', 'Posters', 'Thumbnails'];
      for (const bName of bucketsToCheck) {
        try {
          const { data: files } = await client.storage.from(bName).list('', { limit: 200 });
          if (files && files.length > 0) {
            files.forEach((file) => {
              if (file.name && !file.name.startsWith('.')) {
                const isExplicitPoster = bName.toLowerCase().includes('poster') ||
                                         file.name.toLowerCase().includes('poster') ||
                                         file.name.toLowerCase().includes('movie');
                if (isExplicitPoster) {
                  const { data: pubData } = client.storage.from(bName).getPublicUrl(file.name);
                  const url = pubData?.publicUrl || `${process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xahchsuffmskbgvnxcgs.supabase.co'}/storage/v1/object/public/${bName}/${encodeURIComponent(file.name)}`;
                  const cleanTitle = file.name.replace(/\.[^/.]+$/, '').replace(/^poster[_-]/i, '').replace(/^[0-9]+[.\s_-]*/, '').replace(/[_-]+/g, ' ').trim();
                  storagePosters.push({
                    id: `poster-storage-${bName}-${encodeURIComponent(file.name)}`,
                    kind: 'poster',
                    title: cleanTitle || 'Movie Poster',
                    creator: 'Cinema',
                    imageUrl: url,
                    sourceUrl: url,
                    niche: 'Cinema',
                    styles: [],
                    tags: ['Movie Poster', 'Cinema'],
                    colors: [],
                    ocrText: '',
                    source: 'supabase-storage',
                    createdAt: file.created_at || new Date().toISOString(),
                    likesCount: 150
                  });
                }
              }
            });
          }

          // Check subfolder posters/ inside Thumbnails bucket
          if (bName === 'Thumbnails') {
            const { data: subfiles } = await client.storage.from('Thumbnails').list('posters', { limit: 300 });
            if (subfiles && subfiles.length > 0) {
              subfiles.forEach((file) => {
                if (file.name && !file.name.startsWith('.')) {
                  const filePath = `posters/${file.name}`;
                  const { data: pubData } = client.storage.from('Thumbnails').getPublicUrl(filePath);
                  const url = pubData?.publicUrl || `${process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xahchsuffmskbgvnxcgs.supabase.co'}/storage/v1/object/public/Thumbnails/${filePath}`;
                  const cleanTitle = file.name.replace(/\.[^/.]+$/, '').replace(/^poster[_-]/i, '').replace(/^[0-9]+[.\s_-]*/, '').replace(/[_-]+/g, ' ').trim();
                  storagePosters.push({
                    id: `poster-storage-sub-${encodeURIComponent(file.name)}`,
                    kind: 'poster',
                    title: cleanTitle || 'Movie Poster',
                    creator: 'Cinema',
                    imageUrl: url,
                    sourceUrl: url,
                    niche: 'Cinema',
                    styles: [],
                    tags: ['Movie Poster', 'Cinema'],
                    colors: [],
                    ocrText: '',
                    source: 'supabase-storage',
                    createdAt: file.created_at || new Date().toISOString(),
                    likesCount: 150
                  });
                }
              });
            }
          }
        } catch {}
      }

      // Merge all Supabase posters with local and initial posters
      const allSupabase = [...dbPosters, ...storagePosters];
      const basePool = localPosters.length > 0 ? localPosters : INITIAL_POSTERS;
      const seenUrls = new Set<string>();
      const combined: ThumbnailItem[] = [];

      allSupabase.forEach(p => {
        if (!seenUrls.has(p.imageUrl)) {
          seenUrls.add(p.imageUrl);
          combined.push(p);
        }
      });

      basePool.forEach(p => {
        if (!seenUrls.has(p.imageUrl)) {
          seenUrls.add(p.imageUrl);
          combined.push(p);
        }
      });

      persistPosterList(combined);
      return combined;
    } catch (err) {
      console.warn('Error fetching live Supabase posters:', err);
    }
  }

  return localPosters.length > 0 ? localPosters : INITIAL_POSTERS;
}

export function saveStoredPosters(newItems: ThumbnailItem[]): ThumbnailItem[] {
  if (typeof window === 'undefined') return newItems;
  const withKind = newItems.map((t) => ({
    ...t,
    kind: 'poster' as const,
    id: t.id.startsWith('poster-') ? t.id : `poster-${t.id}`
  }));
  const current = getStoredPosters();
  const seen = new Set(current.map((t) => t.id));
  const fresh = withKind.filter((t) => !seen.has(t.id));
  const merged = [...fresh, ...current];
  persistPosterList(merged);

  // Automatically ensure poster images are uploaded to Supabase Storage and records upserted to DB
  const client = supabase;
  if (isSupabaseConfigured && client && fresh.length > 0) {
    fresh.forEach(async (item) => {
      let finalUrl = item.imageUrl;

      // If poster imageUrl is a base64 dataUrl, immediately upload to Supabase Storage in posters/
      if (item.imageUrl.startsWith('data:')) {
        try {
          const byteString = atob(item.imageUrl.split(',')[1]);
          const mimeMatch = item.imageUrl.split(',')[0].match(/:(.*?);/);
          const mimeString = mimeMatch ? mimeMatch[1] : 'image/jpeg';
          const ab = new ArrayBuffer(byteString.length);
          const ia = new Uint8Array(ab);
          for (let i = 0; i < byteString.length; i++) {
            ia[i] = byteString.charCodeAt(i);
          }
          const blob = new Blob([ab], { type: mimeString });
          const rand = Math.random().toString(36).slice(2, 7);
          const clean = (item.title || 'poster').replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 30);
          const storagePath = `posters/poster_${Date.now()}_${clean}_${rand}.jpg`;

          const { error: upErr } = await client.storage
            .from('Thumbnails')
            .upload(storagePath, blob, { contentType: 'image/jpeg', upsert: true });

          if (!upErr) {
            const { data: pubData } = client.storage.from('Thumbnails').getPublicUrl(storagePath);
            if (pubData?.publicUrl) {
              finalUrl = pubData.publicUrl;
              item.imageUrl = finalUrl;
              item.sourceUrl = finalUrl;
              const currentPosters = getStoredPosters();
              const updatedList = currentPosters.map(p => p.id === item.id ? { ...p, imageUrl: finalUrl, sourceUrl: finalUrl } : p);
              persistPosterList(updatedList);
            }
          }
        } catch (e) {
          console.warn('Background poster storage upload error:', e);
        }
      }

      // Upsert into Supabase database table 'thumbnails'
      try {
        const assignedId = item.id.startsWith('poster-') ? item.id : `poster-${item.id}`;
        await client.from('thumbnails').upsert({
          id: assignedId,
          title: item.title || 'Movie Poster',
          creator: item.creator || 'Cinema',
          image_url: finalUrl,
          source_url: finalUrl,
          niche: item.niche || 'Cinema',
          styles: item.styles || [],
          tags: item.tags && item.tags.length > 0 ? item.tags : ['Movie Poster', 'Cinema'],
          colors: item.colors || [],
          ocr_text: item.ocrText || '',
          emotion: item.emotion || 'Curious',
          breakdown_notes: item.breakdownNotes || 'Uploaded movie poster.',
          source: 'poster',
          likes_count: item.likesCount || 120,
          created_at: item.createdAt || new Date().toISOString()
        });
      } catch (upsertErr) {
        console.warn('Supabase DB poster upsert warning:', upsertErr);
      }
    });
  }

  return merged;
}

export function persistPosterList(list: ThumbnailItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(POSTERS_KEY, JSON.stringify(list));
  } catch (e) {
    console.warn('LocalStorage poster save warning:', e);
  }
}

export function getStoredCollections(): CollectionBoard[] {
  if (typeof window === 'undefined') return DEFAULT_COLLECTIONS;
  try {
    const raw = localStorage.getItem(COLLECTIONS_KEY);
    if (!raw) {
      localStorage.setItem(COLLECTIONS_KEY, JSON.stringify(DEFAULT_COLLECTIONS));
      return DEFAULT_COLLECTIONS;
    }
    return JSON.parse(raw);
  } catch {
    return DEFAULT_COLLECTIONS;
  }
}

export function saveCollection(collection: CollectionBoard): CollectionBoard[] {
  if (typeof window === 'undefined') return [collection, ...DEFAULT_COLLECTIONS];
  const list = getStoredCollections();
  const existsIndex = list.findIndex(c => c.id === collection.id);
  let updated: CollectionBoard[];
  if (existsIndex >= 0) {
    updated = [...list];
    updated[existsIndex] = collection;
  } else {
    updated = [collection, ...list];
  }
  localStorage.setItem(COLLECTIONS_KEY, JSON.stringify(updated));

  if (isSupabaseConfigured && supabase) {
    supabase.from('collections').upsert({
      id: collection.id,
      name: collection.name,
      description: collection.description,
      thumbnail_ids: collection.thumbnailIds,
      color_theme: collection.colorTheme
    }).then(({ error }) => {
      if (error) console.warn('Supabase collection sync error:', error.message);
    });
  }

  return updated;
}

export function toggleThumbnailInCollection(collectionId: string, thumbId: string): CollectionBoard[] {
  const collections = getStoredCollections();
  const updated = collections.map(c => {
    if (c.id === collectionId) {
      const exists = c.thumbnailIds.includes(thumbId);
      return {
        ...c,
        thumbnailIds: exists
          ? c.thumbnailIds.filter(id => id !== thumbId)
          : [...c.thumbnailIds, thumbId]
      };
    }
    return c;
  });
  localStorage.setItem(COLLECTIONS_KEY, JSON.stringify(updated));

  const target = updated.find(c => c.id === collectionId);
  if (target && isSupabaseConfigured && supabase) {
    supabase.from('collections').upsert({
      id: target.id,
      name: target.name,
      description: target.description,
      thumbnail_ids: target.thumbnailIds,
      color_theme: target.colorTheme
    }).then(({ error }) => {
      if (error) console.warn('Supabase toggle sync error:', error.message);
    });
  }

  return updated;
}
