'use client';

import React from 'react';
import { IconMaximize, IconTrash } from './icons/AppIcons';
import { ThumbnailItem } from '../lib/types';
import { markImageLoaded } from '../lib/imageCache';
import { getCachedYouTubeDetail } from '../lib/youtubeMetadataCache';

interface ThumbnailCardProps {
  item: ThumbnailItem;
  onInspect: () => void;
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
}) => {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

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
      : (displayCreator !== 'Unknown' ? `${displayCreator} Thumbnail` : '');

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

  // Check if there is meaningful metadata to show
  const hasMetadataToShow = Boolean(
    displayTitle ||
    (displayCreator && displayCreator !== 'Unknown') ||
    displayViews ||
    displaySubs
  );

  const shouldRenderFooter = showCardInfo && hasMetadataToShow;

  return (
    <div
      onClick={onInspect}
      suppressHydrationWarning
      className={`group relative w-full cursor-pointer select-none rounded-2xl bg-[#0D0E12] border border-[#202228] shadow-[0_4px_20px_rgba(0,0,0,0.35)] hover:border-[#383A44] hover:shadow-[0_8px_30px_rgba(0,0,0,0.5)] transition-transform duration-150 ease-out hover:scale-[1.015] active:scale-[0.985] ${
        shouldRenderFooter
          ? 'p-2.5 sm:p-3 flex flex-col'
          : 'overflow-hidden aspect-video'
      }`}
      style={!shouldRenderFooter ? { aspectRatio: '16/9', width: '100%', maxWidth: '100%' } : undefined}
    >
      {/* 16:9 Thumbnail Image Container */}
      <div
        className={`relative aspect-video w-full overflow-hidden bg-[#0A0A0C] ${
          shouldRenderFooter ? 'rounded-xl' : 'rounded-none'
        }`}
        style={{ aspectRatio: '16/9' }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.imageUrl}
          alt={displayTitle || item.title}
          suppressHydrationWarning
          className="w-full h-full object-cover object-center block"
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          loading={index < 6 ? 'eager' : 'lazy'}
          decoding="async"
          onLoad={() => {
            markImageLoaded(item.imageUrl);
          }}
          onError={(e) => {
            markImageLoaded(item.imageUrl);
            e.currentTarget.onerror = null;
          }}
        />

        {/* Hover Overlay Dark Gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none" />

        {/* Top-Right Delete Action Button */}
        {onDelete && (
          <div className="absolute top-2.5 right-2.5 z-10 opacity-0 group-hover:opacity-100 transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-y-0 -translate-y-1">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(item);
              }}
              title="Delete thumbnail permanently"
              className="p-1.5 rounded-[8px] bg-[#1A181C]/90 text-white hover:text-red-400 hover:bg-black/90 active:scale-95 backdrop-blur-md shadow-sm border border-white/15 transition-all duration-150 flex items-center justify-center cursor-pointer"
            >
              <IconTrash className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Bottom-Right Expand Icon (only on hover) */}
        <div className="absolute bottom-2.5 right-2.5 z-10 opacity-0 group-hover:opacity-100 transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-y-0 translate-y-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onInspect();
            }}
            title="Inspect thumbnail"
            className="p-1.5 rounded-[8px] bg-[#1A181C]/90 text-white hover:text-white hover:bg-black/90 active:scale-95 backdrop-blur-md shadow-sm border border-white/15 transition-all duration-150 flex items-center justify-center cursor-pointer"
          >
            <IconMaximize className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Card Information Below Thumbnail (Exact match to Image 2 design) */}
      {shouldRenderFooter && (
        <div className="pt-3 pb-0.5 flex flex-col justify-start" suppressHydrationWarning>
          {/* Video Title */}
          {displayTitle && (
            <h4
              title={displayTitle}
              suppressHydrationWarning
              className="font-bold text-sm sm:text-[15px] leading-snug text-white line-clamp-2"
            >
              {displayTitle}
            </h4>
          )}

          {/* Meta line: Channel • Subs • Views • Time */}
          <div className="mt-2 flex items-center flex-wrap gap-y-0.5 text-xs text-[#8E8F99]" suppressHydrationWarning>
            {/* Channel Name */}
            <span
              className="font-medium text-[#C8C8D0] hover:text-white transition-colors truncate max-w-[150px]"
              title={displayCreator}
            >
              {displayCreator}
            </span>

            {/* Middle dot and Subscribers */}
            {displaySubs && (
              <>
                <span className="mx-1.5 text-[#555660]">•</span>
                <span className="truncate">{displaySubs}</span>
              </>
            )}

            {/* Middle dot and Views */}
            {displayViews && (
              <>
                <span className="mx-1.5 text-[#555660]">•</span>
                <span className="truncate">{displayViews}</span>
              </>
            )}

            {/* Middle dot and Published Time */}
            {displayTime && (
              <>
                <span className="mx-1.5 text-[#555660]">•</span>
                <span className="truncate">{displayTime}</span>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

ThumbnailCard.displayName = 'ThumbnailCard';

export default ThumbnailCard;
