'use client';

import React from 'react';
import { IconMaximize, IconTrash } from './icons/AppIcons';
import { ThumbnailItem } from '../lib/types';
import { markImageLoaded } from '../lib/imageCache';

interface ThumbnailCardProps {
  item: ThumbnailItem;
  onInspect: () => void;
  onDelete?: (item: ThumbnailItem) => void;
  index?: number;
}

export const ThumbnailCard: React.FC<ThumbnailCardProps> = ({
  item,
  onInspect,
  onDelete,
  index = 0,
}) => {
  return (
    <div
      onClick={onInspect}
      className="group relative aspect-video w-full rounded-[15px] overflow-hidden bg-slate-200/80 dark:bg-slate-800/80 border border-transparent dark:border-slate-800/60 cursor-pointer shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-card-hover)] hover:-translate-y-1 active:scale-[0.985] transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] gpu-layer thumbnail-card-container select-none"
      style={{ aspectRatio: '16/9', width: '100%', maxWidth: '100%' }}
    >
      {/* 16:9 Thumbnail Image */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={item.imageUrl}
        alt={item.title}
        suppressHydrationWarning
        className="w-full h-full object-cover object-center transform-gpu group-hover:scale-[1.04] transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] block"
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        loading={index < 6 ? 'eager' : 'lazy'}
        decoding="async"
        onLoad={() => {
          markImageLoaded(item.imageUrl);
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
            className="p-1.5 rounded-[8px] bg-white/95 dark:bg-slate-900/95 text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-white dark:hover:bg-slate-800 active:scale-[0.94] backdrop-blur-md shadow-sm border border-slate-200/50 dark:border-slate-700/60 transition-all duration-150 flex items-center justify-center cursor-pointer"
          >
            <IconTrash className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Bottom-Right Expand Icon */}
      <div className="absolute bottom-2.5 right-2.5 z-10 opacity-0 group-hover:opacity-100 transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-y-0 translate-y-1">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onInspect();
          }}
          title="Inspect thumbnail"
          className="p-1.5 rounded-[8px] bg-white/95 dark:bg-slate-900/95 text-slate-900 dark:text-slate-100 hover:text-[#009FDF] dark:hover:text-[#009FDF] hover:bg-white dark:hover:bg-slate-800 active:scale-[0.94] backdrop-blur-md shadow-sm border border-slate-200/50 dark:border-slate-700/60 transition-all duration-150 flex items-center justify-center cursor-pointer"
        >
          <IconMaximize className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};





