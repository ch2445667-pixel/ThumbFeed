import { ThumbnailItem } from './types';

const CACHE_KEY = 'thumbvault_yt_metadata_cache_v2';

export interface CachedYTDetail {
  videoId: string;
  title?: string;
  creator?: string;
  views?: string;
  subscribers?: string;
  publishedTime?: string;
  cachedAt: number;
}

// In-memory cache for fast lookups
const memoryCache = new Map<string, CachedYTDetail>();
let isLoadedFromStorage = false;

function normalizeCreatorName(name?: string): string {
  if (!name || !name.trim()) return 'Unknown';
  const lower = name.toLowerCase().trim();
  if (
    lower.includes('tanzee') ||
    lower === 'youtube creator' ||
    lower === 'curated' ||
    lower === 'unknown'
  ) {
    return 'Unknown';
  }
  return name.trim();
}

function loadFromStorage() {
  if (isLoadedFromStorage || typeof window === 'undefined') return;
  isLoadedFromStorage = true;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      const parsed: Record<string, CachedYTDetail> = JSON.parse(raw);
      for (const [key, val] of Object.entries(parsed)) {
        if (val && val.videoId) {
          val.creator = normalizeCreatorName(val.creator);
          memoryCache.set(key, val);
        }
      }
    }
  } catch (e) {
    console.warn('Failed to load YT metadata cache:', e);
  }
}

function saveToStorage() {
  if (typeof window === 'undefined') return;
  try {
    const obj: Record<string, CachedYTDetail> = {};
    memoryCache.forEach((val, key) => {
      obj[key] = val;
    });
    localStorage.setItem(CACHE_KEY, JSON.stringify(obj));
  } catch (e) {
    console.warn('Failed to save YT metadata cache:', e);
  }
}

/**
 * Extracts an 11-character YouTube video ID from various YouTube URL formats,
 * image URLs (img.youtube.com / i.ytimg.com), or raw item IDs.
 */
export function extractYoutubeVideoId(urlOrStr: string): string | null {
  if (!urlOrStr || typeof urlOrStr !== 'string') return null;

  // Check standard YouTube links or thumbnail image paths
  const match = urlOrStr.match(
    /(?:v=|vi\/|youtu\.be\/|\/shorts\/|\/embed\/|\/live\/|thumb-yt-|ch-yt-|yt-vid-)([a-zA-Z0-9_-]{11})/i
  );
  if (match && match[1]) {
    return match[1];
  }

  // Check direct 11-char ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(urlOrStr.trim())) {
    return urlOrStr.trim();
  }

  return null;
}

// Keep track of IDs currently in-flight to avoid duplicate requests
const inFlightIds = new Set<string>();

/**
 * Proactively fetches YouTube details (title, creator, view count, subs, time) for items
 * that originate from YouTube and are missing channel name or views.
 */
export async function fetchMissingYouTubeDetails(
  items: ThumbnailItem[]
): Promise<Record<string, { title?: string; creator?: string; views?: string; subscribers?: string; publishedTime?: string }>> {
  if (typeof window === 'undefined' || !items || items.length === 0) {
    return {};
  }

  loadFromStorage();

  const missingVideoIds: string[] = [];

  for (const item of items) {
    const vid =
      extractYoutubeVideoId(item.sourceUrl || '') ||
      extractYoutubeVideoId(item.imageUrl || '') ||
      extractYoutubeVideoId(item.id || '');

    if (!vid) continue;

    // Check if we already have it in memory/cache
    const cached = memoryCache.get(vid);
    if (cached) {
      continue;
    }

    if (!inFlightIds.has(vid)) {
      missingVideoIds.push(vid);
      inFlightIds.add(vid);
    }
  }

  if (missingVideoIds.length === 0) {
    const allCached: Record<string, { title?: string; creator?: string; views?: string; subscribers?: string; publishedTime?: string }> = {};
    memoryCache.forEach((v, k) => {
      allCached[k] = {
        title: v.title,
        creator: normalizeCreatorName(v.creator),
        views: v.views,
        subscribers: v.subscribers,
        publishedTime: v.publishedTime,
      };
    });
    return allCached;
  }

  // Fetch up to 30 at a time
  const batch = missingVideoIds.slice(0, 30);

  try {
    const res = await fetch('/api/youtube/details', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoIds: batch }),
    });

    if (res.ok) {
      const data = await res.json();
      const details: Record<
        string,
        { title?: string; creator?: string; views?: string; subscribers?: string; publishedTime?: string }
      > = data.details || {};

      for (const [vid, detail] of Object.entries(details)) {
        if (detail) {
          memoryCache.set(vid, {
            videoId: vid,
            title: detail.title,
            creator: normalizeCreatorName(detail.creator),
            views: detail.views,
            subscribers: detail.subscribers,
            publishedTime: detail.publishedTime,
            cachedAt: Date.now(),
          });
        }
      }
      saveToStorage();
    }
  } catch (err) {
    console.warn('Failed to fetch missing YouTube details:', err);
  } finally {
    batch.forEach((id) => inFlightIds.delete(id));
  }

  const allCached: Record<string, { title?: string; creator?: string; views?: string; subscribers?: string; publishedTime?: string }> = {};
  memoryCache.forEach((v, k) => {
    allCached[k] = {
      title: v.title,
      creator: normalizeCreatorName(v.creator),
      views: v.views,
      subscribers: v.subscribers,
      publishedTime: v.publishedTime,
    };
  });
  return allCached;
}

/**
 * Returns any cached metadata for a given item if available.
 */
export function getCachedYouTubeDetail(
  item: ThumbnailItem
): { title?: string; creator?: string; views?: string; subscribers?: string; publishedTime?: string } | null {
  loadFromStorage();
  const vid =
    extractYoutubeVideoId(item.sourceUrl || '') ||
    extractYoutubeVideoId(item.imageUrl || '') ||
    extractYoutubeVideoId(item.id || '');
  if (!vid) return null;
  const found = memoryCache.get(vid);
  if (!found) return null;
  return {
    ...found,
    creator: normalizeCreatorName(found.creator),
  };
}
