'use client';

import React from 'react';
import { Trash2 } from 'lucide-react';
import { ThumbnailItem } from '../lib/types';
import { getCachedYouTubeDetail } from '../lib/youtubeMetadataCache';

interface ThumbnailCardProps {
  item: ThumbnailItem;
  onInspect: (item: ThumbnailItem) => void;
  onDelete?: (item: ThumbnailItem) => void;
  index?: number;
  showCardInfo?: boolean;
}

function formatTimeAgo(dateStr?: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr).getTime();
    if (isNaN(d)) return '';
    const diff = (Date.now() - d) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}d ago`;
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
}) => {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const cachedYT = mounted ? getCachedYouTubeDetail(item) : null;

  const rawCreator = cachedYT?.creator || item.creator || '';
  const isTanzeeOrUnknown =
    !rawCreator ||
    rawCreator.trim() === '' ||
    rawCreator.toLowerCase().includes('tanzee') ||
    rawCreator.trim() === 'YouTube Creator' ||
    rawCreator.trim() === 'Curated' ||
    rawCreator.trim() === 'Unknown';

  const displayCreator = isTanzeeOrUnknown ? '' : rawCreator.trim();

  const rawTitle = cachedYT?.title || item.title || '';
  const displayTitle =
    rawTitle && rawTitle !== 'YouTube Thumbnail' && rawTitle !== 'Untitled Thumbnail'
      ? rawTitle.replace(/^https?:\/\/(?:www\.)?youtube\.com\/[^\s]+\s*/i, '').trim()
      : displayCreator
        ? `${displayCreator} Thumbnail`
        : '';

  let displayViews = cachedYT?.views || item.viewsEstimate || '';
  if (displayViews && !displayViews.toLowerCase().includes('view')) {
    displayViews = `${displayViews} views`;
  }

  const displayTime =
    cachedYT?.publishedTime ||
    item.publishedTime ||
    formatTimeAgo(item.createdAt);

  // Metadata line matching Image 2 reference: "Channel • 16.4K views • 3mo ago"
  const metaParts: string[] = [];
  if (displayCreator) metaParts.push(displayCreator);
  if (displayViews) metaParts.push(displayViews);
  if (displayTime) metaParts.push(displayTime);
  const metaLine = metaParts.join('  •  ');

  const gridSrc = item.thumbSmallUrl || item.imageUrl;

  return (
    <div
      onClick={() => onInspect(item)}
      suppressHydrationWarning
      className={`group relative w-full cursor-pointer select-none rounded-xl border border-white/[0.08] bg-[#0c0d12] hover:bg-[#11131a] transition-all duration-200 ease-out hover:border-white/[0.20] hover:shadow-[0_12px_28px_-6px_rgba(0,0,0,0.85)] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] ${
        showCardInfo ? 'p-2 flex flex-col' : 'overflow-hidden'
      }`}
    >
      {/* Thumbnail artwork stage (16:9 ratio) */}
      <div
        className={`relative aspect-video w-full overflow-hidden bg-[#050608] ${
          showCardInfo ? 'rounded-lg' : 'rounded-xl'
        }`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={gridSrc}
          alt={displayTitle || item.title}
          className="block h-full w-full object-cover object-center transition-transform duration-300 ease-out group-hover:scale-[1.02]"
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          width={item.width ?? 1280}
          height={item.height ?? 720}
          loading={index < 8 ? 'eager' : 'lazy'}
          decoding="async"
          fetchPriority={index < 4 ? 'high' : 'auto'}
        />

        {/* Subtle hover overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none" />

        {/* Delete (admin / creator only) */}
        {onDelete && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(item);
            }}
            title="Delete thumbnail"
            aria-label="Delete thumbnail"
            className="absolute right-2 top-2 z-10 grid h-7 w-7 place-items-center rounded-md border border-white/10 bg-black/70 backdrop-blur-md text-white/70 opacity-0 transition-all duration-150 hover:bg-red-500 hover:text-white hover:border-transparent group-hover:opacity-100 active:scale-95 shadow-sm"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}

        {/* Category badge overlay on thumbnail when in Image 1 mode (thumbnails only) */}
        {!showCardInfo && item.niche && item.niche !== 'All' && (
          <div className="absolute left-2 bottom-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
            <span className="px-2 py-0.5 rounded-md bg-black/75 backdrop-blur-md border border-white/10 text-[10px] font-medium text-white/90">
              {item.niche}
            </span>
          </div>
        )}
      </div>

      {/* Details / Metadata Footer (Image 2 style) */}
      {showCardInfo && (
        <div className="flex flex-col pt-2.5 pb-1 px-1" suppressHydrationWarning>
          <h4
            title={displayTitle || item.title}
            suppressHydrationWarning
            className="line-clamp-2 text-xs font-semibold leading-snug text-white group-hover:text-white transition-colors"
          >
            {displayTitle || item.title || 'Untitled Thumbnail'}
          </h4>

          {metaLine && (
            <p className="mt-1 text-[11px] text-white/45 truncate font-normal">
              {metaLine}
            </p>
          )}
        </div>
      )}
    </div>
  );
});

ThumbnailCard.displayName = 'ThumbnailCard';

export default ThumbnailCard;
