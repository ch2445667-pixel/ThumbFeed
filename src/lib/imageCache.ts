/**
 * High-Performance Image Preloader & In-Memory Cache
 * Proactively preloads and decodes thumbnails ahead of time
 * so scrolling through hundreds of thumbnails is instant with 0 loading delay.
 */

// Global set of URLs that have finished loading & decoding
const LOADED_URLS = new Set<string>();

// In-memory HTMLImageElement cache to prevent garbage collection of decoded bitmaps
const IMAGE_OBJECT_POOL = new Map<string, HTMLImageElement>();

export function isImageLoaded(url: string): boolean {
  if (!url) return false;
  return LOADED_URLS.has(url);
}

export function markImageLoaded(url: string): void {
  if (!url || LOADED_URLS.has(url)) return;
  LOADED_URLS.add(url);
}

/**
 * Preloads a single image and decodes it asynchronously into browser memory
 */
export function preloadSingleImage(url: string, priority: 'high' | 'auto' | 'low' = 'auto'): Promise<void> {
  if (!url || typeof window === 'undefined') return Promise.resolve();
  if (LOADED_URLS.has(url)) return Promise.resolve();

  return new Promise((resolve) => {
    let img = IMAGE_OBJECT_POOL.get(url);
    if (!img) {
      img = new Image();
      img.decoding = 'async';
      IMAGE_OBJECT_POOL.set(url, img);
    }

    if ('fetchPriority' in img) {
      (img as any).fetchPriority = priority;
    }

    const onComplete = () => {
      markImageLoaded(url);
      resolve();
    };

    if (img.complete && img.naturalWidth > 0) {
      onComplete();
      return;
    }

    img.onload = () => {
      if ('decode' in img && typeof img.decode === 'function') {
        img.decode()
          .then(onComplete)
          .catch(onComplete);
      } else {
        onComplete();
      }
    };

    img.onerror = () => {
      markImageLoaded(url);
      resolve();
    };

    if (img.src !== url) {
      img.src = url;
    }
  });
}

/**
 * Rapid Concurrency Worker Pool for preloading all thumbnails
 */
let isPreloadRunning = false;
let preloadQueue: string[] = [];

/**
 * Prioritize a specific list of URLs immediately ahead of scroll position
 */
export function prioritizeUpcomingThumbnails(urls: string[]): void {
  if (typeof window === 'undefined' || !urls || urls.length === 0) return;
  const needed = urls.filter(u => u && !LOADED_URLS.has(u));
  if (needed.length === 0) return;

  // Move these to the front of the queue
  preloadQueue = [...needed, ...preloadQueue.filter(u => !needed.includes(u))];
  
  // Immediately dispatch the top 20 of this urgent batch
  needed.slice(0, 20).forEach(url => {
    preloadSingleImage(url, 'high');
  });

  if (!isPreloadRunning) {
    processPreloadQueue();
  }
}

export function preloadAllThumbnails(urls: string[], initialPriorityCount: number = 100): void {
  if (typeof window === 'undefined' || !urls || urls.length === 0) return;

  // Filter out already loaded
  const pendingUrls = urls.filter(u => u && !LOADED_URLS.has(u));
  if (pendingUrls.length === 0) return;

  // 1. Immediately fire off top visible + multiple screenfuls with high priority
  const prioritySlice = pendingUrls.slice(0, initialPriorityCount);
  prioritySlice.forEach(url => {
    preloadSingleImage(url, 'high');
  });

  // 2. Queue the remaining images for continuous background preloading
  const remaining = pendingUrls.slice(initialPriorityCount);
  for (const u of remaining) {
    if (!preloadQueue.includes(u)) {
      preloadQueue.push(u);
    }
  }

  if (!isPreloadRunning && preloadQueue.length > 0) {
    processPreloadQueue();
  }
}

async function processPreloadQueue() {
  if (isPreloadRunning) return;
  isPreloadRunning = true;
  const CONCURRENCY = 24; // 24 parallel image workers for fast preload

  while (preloadQueue.length > 0) {
    const batch = preloadQueue.splice(0, CONCURRENCY);
    await Promise.all(batch.map(url => preloadSingleImage(url, 'auto')));

    // Brief yield to avoid starving other network tasks
    await new Promise(r => setTimeout(r, 10));
  }

  isPreloadRunning = false;
}


