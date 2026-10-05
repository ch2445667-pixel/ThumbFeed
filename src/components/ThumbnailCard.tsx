'use client';

import React from 'react';
import { IconTrash } from './icons/AppIcons';
import { ThumbnailItem } from '../lib/types';
import { getCachedYouTubeDetail } from '../lib/youtubeMetadataCache';

interface ThumbnailCardProps {
  item: ThumbnailItem;
  onInspect: (item: ThumbnailItem) => void;
  onDelete?: (item: ThumbnailItem) => void;
  index?: number;
  showCardInfo?: boolean;
  // Posters are pure artwork: portrait frame, never a metadata footer.
  poster?: boolean;
}

function formatTimeAgo(dateStr?: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr).getTime();
    if (isNaN(d)) return '';
    const diff = (Date.now() - d) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    if (diff < 2592000) return `${Math.floor(diff / 604800)}w ago`;
    if (diff < 31536000) return `${Math.floor(diff / 2592000)}mo ago`;
    return `${Math.floor(diff / 31536000)}y ago`;
  } catch {
    return '';
  }
}

export const ThumbnailCard = React.memo<ThumbnailCardProps>(({
  item,
  onInspect,
  onDelete,
  index = 0,
  showCardInfo = false,
  poster = false,
}) => {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Native lazy loading is cheaper than a per-card observer: the browser
  // batches visibility tracking internally instead of running one
  // IntersectionObserver per tile.

  const cachedYT = mounted ? getCachedYouTubeDetail(item) : null;

  // Normalize creator: if missing, 'TanzeelGFX', 'tanzeegfx', or 'YouTube Creator', display 'Unknown'
  const rawCreator = cachedYT?.creator || item.creator || '';
  const isTanzeeOrUnknown =
    !rawCreator ||
    rawCreator.trim() === '' ||
    rawCreator.toLowerCase().includes('tanzee') ||
    rawCreator.trim() === 'YouTube Creator' ||
    rawCreator.trim() === 'Curated' ||
    rawCreator.trim() === 'Unknown';

  const displayCreator = isTanzeeOrUnknown ? 'Unknown' : rawCreator.trim();

  // Video title: prioritize real title from YouTube or item
  const rawTitle = cachedYT?.title || item.title || '';
  const displayTitle =
    rawTitle && rawTitle !== 'YouTube Thumbnail' && rawTitle !== 'Untitled Thumbnail'
      ? rawTitle.replace(/^https?:\/\/(?:www\.)?youtube\.com\/[^\s]+\s*/i, '').trim()
      : displayCreator !== 'Unknown'
        ? `${displayCreator} Thumbnail`
        : '';

  // Views information
  let displayViews = cachedYT?.views || item.viewsEstimate || '';
  if (displayViews && !displayViews.toLowerCase().includes('view')) {
    displayViews = `${displayViews} views`;
  }

  // Subscribers count if available
  const displaySubs = cachedYT?.subscribers || item.subscribersCount || '';

  // Published / Upload time
  const displayTime =
    cachedYT?.publishedTime ||
    item.publishedTime ||
    formatTimeAgo(item.createdAt);

  // An unrecognised creator carries no information, so it is dropped rather
  // than repeated as "Unknown" on every tile in the grid.
  const showCreator = displayCreator !== 'Unknown';

  const hasMetadataToShow = Boolean(displayTitle || showCreator || displayViews || displaySubs);

  const shouldRenderFooter = showCardInfo && hasMetadataToShow && !poster;

  // Pinterest-style wall: each poster keeps its own aspect ratio, so the tile
  // reserves its exact box from the dimensions recorded at upload time. The
  // box never changes when the image arrives, which is what stops the masonry
  // from re-balancing mid-scroll. Posters without recorded dimensions fall
  // back to 2:3, which is the standard poster proportion.
  const knownRatio = poster && item.width && item.height ? item.width / item.height : null;
  const posterRatio = knownRatio ?? 2 / 3;
  const frameAspect = poster ? '' : 'aspect-video';
  const frameRatio = poster
    ? { aspectRatio: `${posterRatio}` }
    : { aspectRatio: '16/9' };

  // The wall serves the 400px WebP variant when the backfill (or a new
  // upload) has produced one. The full original is only requested by the
  // inspect modal, so browsing never transfers full-size files. Rows without
  // a small variant still work, just at full size.
  const gridSrc = item.thumbSmallUrl || item.imageUrl;

  return (
    <div
      onClick={() => onInspect(item)}
      suppressHydrationWarning
      className={`group relative w-full cursor-pointer select-none rounded-lg border border-line bg-surface shadow-card transition-[border-color,box-shadow,transform] duration-200 ease-fluid hover:z-10 hover:scale-[1.02] hover:border-line-strong hover:shadow-card-hover active:scale-[0.99] ${
        shouldRenderFooter ? 'p-2 flex flex-col' : 'overflow-hidden'
      }`}
    >
      {/* Artwork stage. Neutral backdrop preserves true color; posters use natural aspect ratio */}
      <div
        className={`thumb-stage relative ${frameAspect} w-full overflow-hidden ${
          shouldRenderFooter ? 'rounded-sm' : poster ? 'rounded-lg' : 'rounded-t-[13px]'
        }`}
        style={frameRatio}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={gridSrc}
          alt={displayTitle || item.title}
          suppressHydrationWarning
          className={`block h-full w-full ${poster ? 'object-contain object-center' : 'object-cover object-center'}`}
          style={{ width: '100%', height: '100%', objectFit: poster ? 'contain' : 'cover' }}
          width={item.width ?? (poster ? 1000 : 1280)}
          height={item.height ?? (poster ? 1500 : 720)}
          loading={index < 8 ? 'eager' : 'lazy'}
          decoding="async"
          fetchPriority={index < 4 ? 'high' : 'auto'}
        />

        {/* Delete (admin only). No hover scrim and no inspect button: the tile
            itself opens the inspection modal, and the artwork is never dimmed. */}
        {onDelete && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(item);
            }}
            title="Delete thumbnail permanently"
            aria-label="Delete thumbnail permanently"
            className="absolute right-2 top-2 z-10 grid h-7 w-7 place-items-center rounded-sm border border-white/15 bg-black/55 text-white opacity-0 transition-opacity duration-200 ease-fluid hover:bg-danger hover:border-transparent focus-visible:opacity-100 group-hover:opacity-100 active:scale-95"
          >
            <IconTrash className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {shouldRenderFooter && (
        <div className="flex flex-col pt-3" suppressHydrationWarning>
          {displayTitle && (
            <h4
              title={displayTitle}
              suppressHydrationWarning
              className="line-clamp-2 text-sm font-semibold leading-snug text-ink"
            >
              {displayTitle}
            </h4>
          )}

          {showCreator && (
            <p
              className="mt-1.5 truncate text-[13px] text-ink-muted"
              title={displayCreator}
            >
              {displayCreator}
            </p>
          )}

          {/* One separator maximum, tabular figures for the numbers to line up
              down the grid. */}
          {(displayViews || displaySubs || displayTime) && (
            <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs text-ink-faint tabular">
              {displaySubs && <span className="truncate">{displaySubs}</span>}
              {displaySubs && (displayViews || displayTime) && (
                <span aria-hidden="true">·</span>
              )}
              {displayViews && <span className="truncate">{displayViews}</span>}
              {(displaySubs || displayViews) && displayTime && (
                <span aria-hidden="true">·</span>
              )}
              {displayTime && <span className="truncate">{displayTime}</span>}
            </p>
          )}
        </div>
      )}
    </div>
  );
});

ThumbnailCard.displayName = 'ThumbnailCard';

export default ThumbnailCard;
