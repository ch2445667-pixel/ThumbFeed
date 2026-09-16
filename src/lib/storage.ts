import { ThumbnailItem, CollectionBoard } from './types';
import { INITIAL_THUMBNAILS } from './mockData';
import { supabase, isSupabaseConfigured } from './supabase';

const USER_IMPORTED_KEY = 'thumbvault_user_imported_v3';
const THUMBNAILS_KEY = 'thumbvault_thumbnails_v800_classified';
const COLLECTIONS_KEY = 'thumbvault_collections_v800';
const DELETED_KEYS_KEY = 'thumbvault_permanently_deleted_keys_v1';

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
    thumbnailIds: [INITIAL_THUMBNAILS[0]?.id || 'thumb-1', INITIAL_THUMBNAILS[1]?.id || 'thumb-2', INITIAL_THUMBNAILS[2]?.id || 'thumb-3'],
    createdAt: '2026-08-20',
    colorTheme: '#ef4444'
  },
  {
    id: 'col-2',
    name: '🖤 Dark & Minimalist Tech',
    description: 'Clean Apple-style and sleek documentary lighting references',
    thumbnailIds: [INITIAL_THUMBNAILS[3]?.id || 'thumb-4', INITIAL_THUMBNAILS[4]?.id || 'thumb-5', INITIAL_THUMBNAILS[5]?.id || 'thumb-6'],
    createdAt: '2026-08-20',
    colorTheme: '#6366f1'
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
  const currentNiche = item.niche as string;
  const validNiches: ThumbnailItem['niche'][] = [
    'IRL', 'Business', 'Tech', 'Entertainment', 'Gaming', 'Sports', 'Documentary', 'Educational'
  ];

  if (validNiches.includes(item.niche)) {
    return item;
  }

  // Map previous categories to new categories
  let remappedNiche: ThumbnailItem['niche'] = 'Tech';
  if (currentNiche === 'Tech & AI') remappedNiche = 'Tech';
  else if (currentNiche === 'Finance & Business') remappedNiche = 'Business';
  else if (currentNiche === 'Vlogs & Lifestyle') remappedNiche = 'IRL';
  else if (currentNiche === 'Fitness & Health') remappedNiche = 'Sports';
  else if (currentNiche === 'Tutorials & Design') remappedNiche = 'Educational';
  else if (currentNiche === 'Documentary') remappedNiche = 'Documentary';
  else if (currentNiche === 'Gaming') remappedNiche = 'Gaming';
  else if (currentNiche === 'Entertainment') remappedNiche = 'Entertainment';
  else {
    const meta = classifyNicheFromFilename(item.title + ' ' + item.imageUrl);
    remappedNiche = meta.niche;
  }

  return {
    ...item,
    niche: remappedNiche
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
 * Deterministically merge new items without randomizing the feed
 */
export function blendAndDistributeThumbnails(baseList: ThumbnailItem[], newItems: ThumbnailItem[]): ThumbnailItem[] {
  if (!newItems || newItems.length === 0) return baseList;
  const newKeys = new Set(newItems.map(i => i.id || i.imageUrl));
  const filteredBase = baseList.filter(t => !newKeys.has(t.id) && !newKeys.has(t.imageUrl));
  
  // Deterministically place new additions at the front of the feed
  return [...newItems, ...filteredBase];
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
 * Save user imported thumbnails into the dedicated persistent store
 */
export function saveUserImportedThumbnails(newItems: ThumbnailItem[]): ThumbnailItem[] {
  if (typeof window === 'undefined') return newItems;
  try {
    const current = getUserImportedThumbnails();
    const newKeys = new Set(newItems.map(i => i.id || i.imageUrl));
    const merged = [...newItems, ...current.filter(t => !newKeys.has(t.id) && !newKeys.has(t.imageUrl))];
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
  let baseThumbnails: ThumbnailItem[] = INITIAL_THUMBNAILS;

  if (isSupabaseConfigured && supabase) {
    try {
      // 1. Direct Supabase Storage Bucket Live Sync
      const { data: bucketFiles, error: bucketError } = await supabase.storage
        .from('Thumbnails')
        .list('', {
          limit: 1500,
          offset: 0,
          sortBy: { column: 'created_at', order: 'desc' }
        });

      // Also query the thumbnails table to get rich titles/tags for chrome extension / user uploads
      let dbRecordsMap = new Map<string, any>();
      try {
        const { data: dbRecords } = await supabase
          .from('thumbnails')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(1000);
        if (dbRecords && Array.isArray(dbRecords)) {
          dbRecords.forEach((rec: any) => {
            if (rec.image_url) dbRecordsMap.set(rec.image_url, rec);
            if (rec.id) dbRecordsMap.set(rec.id, rec);
            const fname = decodeURIComponent(rec.image_url.split('/').pop()?.split('?')[0] || '');
            if (fname) dbRecordsMap.set(fname, rec);
          });
        }
      } catch (dbQueryErr) {
        console.warn('DB lookup note:', dbQueryErr);
      }

      if (!bucketError && bucketFiles && bucketFiles.length > 0) {
        // Filter out folders/empty entries and keep valid image files
        const imageFiles = bucketFiles.filter(f => f.name && !f.name.startsWith('.') && /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(f.name));

        if (imageFiles.length > 0) {
          const newlyAdded: ThumbnailItem[] = [];
          const existingLibrary: ThumbnailItem[] = [];

          imageFiles.forEach((file, idx) => {
            const fileName = file.name;
            const decodedName = decodeURIComponent(fileName);
            const { data: pubData } = supabase!.storage.from('Thumbnails').getPublicUrl(fileName);
            const imageUrl = pubData?.publicUrl || `https://xahchsuffmskbgvnxcgs.supabase.co/storage/v1/object/public/Thumbnails/${encodeURIComponent(fileName)}`;

            const dbRec = dbRecordsMap.get(fileName) || dbRecordsMap.get(decodedName) || dbRecordsMap.get(imageUrl) || (file.id ? dbRecordsMap.get(file.id) : undefined);

            // Check if we have pre-enriched metadata for this file in initialMap
            const existing =
              initialMap.get(fileName) ||
              initialMap.get(decodedName) ||
              initialMap.get(imageUrl) ||
              (file.id ? initialMap.get(file.id) : undefined);

            if (existing && !dbRec) {
              existingLibrary.push({
                ...existing,
                id: existing.id || `thumb-${file.id || idx}`,
                imageUrl,
                sourceUrl: existing.sourceUrl || imageUrl,
                createdAt: file.created_at || existing.createdAt
              });
              return;
            }

            // Newly added file in the Supabase bucket (from Chrome Extension or User)!
            const title = dbRec?.title || formatTitleFromFilename(decodedName) || 'YouTube Thumbnail';
            const meta = classifyNicheFromFilename(decodedName);
            const niche = dbRec?.niche || meta.niche;
            const tags = dbRec?.tags && dbRec.tags.length > 0 ? dbRec.tags : meta.tags;

            const newItem: ThumbnailItem = {
              id: dbRec?.id || `thumb-storage-${file.id || idx}-${fileName.replace(/[^a-zA-Z0-9]/g, '')}`,
              title,
              creator: dbRec?.creator || 'TanzeelGFX',
              imageUrl,
              sourceUrl: dbRec?.source_url || imageUrl,
              niche,
              styles: dbRec?.styles || ['High-Contrast Glow', 'Face Close-up'],
              tags,
              colors: dbRec?.colors || ['#FF3366', '#0F172A', '#3B82F6', '#FFFFFF'],
              ocrText: dbRec?.ocr_text || '',
              emotion: dbRec?.emotion || 'Curious',
              breakdownNotes: dbRec?.breakdown_notes || 'Auto-synchronized directly from Supabase Storage bucket.',
              viewsEstimate: dbRec?.views_estimate || '1.2M',
              source: 'supabase-storage',
              createdAt: file.created_at || dbRec?.created_at || new Date().toISOString(),
              likesCount: dbRec?.likes_count || getDeterministicLikes(fileName)
            };

            newlyAdded.push(newItem);
          });

          // Place newly added thumbnails (from Chrome extension or uploads) at top of feed!
          baseThumbnails = [...newlyAdded, ...existingLibrary];
        }
      } else {
        // 2. Database table query fallback
        const { data, error } = await supabase
          .from('thumbnails')
          .select('*')
          .order('id', { ascending: true })
          .limit(1500);

        if (!error && data && data.length > 0) {
          const mapped: ThumbnailItem[] = data.map((row: any) => ({
            id: row.id,
            title: row.title || 'YouTube Thumbnail',
            creator: row.creator || 'TanzeelGFX',
            imageUrl: row.image_url,
            sourceUrl: row.source_url || row.image_url,
            niche: row.niche || 'Tech & AI',
            styles: row.styles && row.styles.length > 0 ? row.styles : ['Face Close-up', 'High-Contrast Glow'],
            tags: row.tags && row.tags.length > 0 ? row.tags : [row.niche || 'Tech & AI', 'YouTube Hook', 'High CTR'],
            colors: row.colors && row.colors.length > 0 ? row.colors : ['#FF3366', '#0F172A', '#FFCC00', '#FFFFFF'],
            ocrText: row.ocr_text || '',
            emotion: row.emotion || 'Curious',
            breakdownNotes: row.breakdown_notes || 'High-CTR YouTube thumbnail design leveraging visual hierarchy.',
            viewsEstimate: row.views_estimate || '1.5M',
            source: row.source || 'supabase-storage',
            createdAt: row.created_at || new Date().toISOString(),
            likesCount: row.likes_count || 100
          }));

          baseThumbnails = mapped;
        }
      }
    } catch (err) {
      console.warn('Supabase fetch error, using stored dataset:', err);
    }
  }

  // Combine user imported thumbnails blended/distributed across library thumbnails
  const deletedKeys = getPermanentlyDeletedKeys();
  const validBase = baseThumbnails.filter(b => !deletedKeys.has(b.id) && !deletedKeys.has(b.imageUrl));
  const validUserImports = userImports.filter(u => !deletedKeys.has(u.id) && !deletedKeys.has(u.imageUrl));

  const userKeys = new Set(validUserImports.map(u => u.id || u.imageUrl));
  const filteredBase = validBase.filter(b => !userKeys.has(b.id) && !userKeys.has(b.imageUrl));
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

    // Blend user imported thumbnails throughout the base library smoothly
    const userKeys = new Set(userImports.map(u => u.id || u.imageUrl));
    const filteredBase = baseList.filter(b => !userKeys.has(b.id) && !userKeys.has(b.imageUrl));
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
      breakdown_notes: item.breakdownNotes,
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
