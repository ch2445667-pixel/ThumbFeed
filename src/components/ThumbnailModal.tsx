'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Pencil, Check, X as XIcon, Trash2, Download } from 'lucide-react';
import { ThumbnailItem } from '../lib/types';
import { getCachedYouTubeDetail } from '../lib/youtubeMetadataCache';

interface ThumbnailModalProps {
  item: ThumbnailItem | null;
  onClose: () => void;
  onDelete?: (item: ThumbnailItem) => void;
  onEditTitle?: (item: ThumbnailItem, title: string) => void;
}

// Format views: 2488161 -> "2.5M", 48200 -> "48.2K", 950 -> "950"
function formatShortViews(raw?: string): string {
  if (!raw) return '';
  const clean = raw.replace(/views?/i, '').replace(/,/g, '').trim();
  const num = parseFloat(clean);
  if (isNaN(num)) return raw.replace(/views?/i, '').trim();
  if (clean.includes('M') || clean.includes('K') || clean.includes('B')) {
    return clean;
  }
  const f = (v: number, s: string) =>
    (Math.round(v * 10) / 10).toString().replace(/\.0$/, '') + s;
  if (num >= 1e9) return f(num / 1e9, 'B');
  if (num >= 1e6) return f(num / 1e6, 'M');
  if (num >= 1e3) return f(num / 1e3, 'K');
  return String(num);
}

// Relative time formatter
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

export const ThumbnailModal: React.FC<ThumbnailModalProps> = ({
  item,
  onClose,
  onDelete,
  onEditTitle
}) => {
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [downloadFormat, setDownloadFormat] = useState<'jpg' | 'png'>('jpg');
  const [isDownloading, setIsDownloading] = useState(false);

  // Reset transient state whenever a new item is selected or closed
  useEffect(() => {
    setIsConfirmingDelete(false);
    setIsEditingTitle(false);
    setDraftTitle('');
  }, [item]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isEditingTitle) {
          setIsEditingTitle(false);
        } else if (isConfirmingDelete) {
          setIsConfirmingDelete(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, isConfirmingDelete, isEditingTitle]);

  if (!item) return null;

  const cachedYT = getCachedYouTubeDetail(item);
  const rawCreator = cachedYT?.creator || item.creator || '';
  const isTanzeeOrUnknown =
    !rawCreator ||
    rawCreator.trim() === '' ||
    rawCreator.toLowerCase().includes('tanzee') ||
    rawCreator.trim() === 'YouTube Creator' ||
    rawCreator.trim() === 'Curated' ||
    rawCreator.trim() === 'Unknown';
  const displayCreator = isTanzeeOrUnknown ? 'Creator' : rawCreator.trim();

  const rawTitle = cachedYT?.title || item.title || '';
  const displayTitle =
    rawTitle && rawTitle !== 'YouTube Thumbnail' && rawTitle !== 'Untitled Thumbnail'
      ? rawTitle.replace(/^https?:\/\/(?:www\.)?youtube\.com\/[^\s]+\s*/i, '').trim()
      : displayCreator
        ? `${displayCreator} Thumbnail`
        : 'Thumbnail Preview';

  const rawViews = cachedYT?.views || item.viewsEstimate || '';
  const shortViews = formatShortViews(rawViews);

  const displayTime =
    cachedYT?.publishedTime || item.publishedTime || formatTimeAgo(item.createdAt);

  const isYouTube = Boolean(
    item.sourceUrl &&
      (item.sourceUrl.includes('youtube.com') || item.sourceUrl.includes('youtu.be'))
  );

  const handleConfirmDelete = () => {
    if (!item || !onDelete) return;
    onDelete(item);
    onClose();
  };

  const handleSaveTitle = () => {
    if (!item || !onEditTitle) return;
    const next = draftTitle.trim();
    if (next && next !== item.title) {
      onEditTitle(item, next);
    }
    setIsEditingTitle(false);
  };

  const handleDownload = async (format: 'jpg' | 'png' = downloadFormat) => {
    if (!item?.imageUrl) return;
    setIsDownloading(true);
    try {
      const cleanName = (displayTitle || 'thumbnail')
        .replace(/[^a-zA-Z0-9_\-\s]/g, '')
        .trim()
        .replace(/\s+/g, '_')
        .slice(0, 50);
      const filename = `${cleanName || 'thumbnail'}.${format}`;

      const res = await fetch(item.imageUrl);
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      window.URL.revokeObjectURL(blobUrl);
      document.body.removeChild(link);
    } catch {
      window.open(item.imageUrl, '_blank');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
        {/* Backdrop - keeps original app aesthetic with dark backdrop and blur */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 bg-black/85 backdrop-blur-md"
          onClick={onClose}
        />

        {/* Modal Dialog Card (.m)
            Concentric radii matching guide:
            Padding = 12px (--pad)
            Inner image = 12px (--in)
            Outer card = 24px (--out = 12px + 12px)
        */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 10 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full max-w-[960px] bg-[#0e0e10] border border-white/[0.07] rounded-[24px] p-3 shadow-[0_0_0_1px_rgba(255,255,255,0.07),0_44px_100px_-20px_rgba(0,0,0,0.95)] z-10 my-auto grid grid-cols-1 md:grid-cols-[1fr_300px] gap-4 sm:gap-[18px] text-[#ededef]"
        >
          {/* Left: Thumbnail Artwork Stage (.im)
              Aspect-ratio 16/9, inner radius = 12px
          */}
          <div
            className={`relative w-full self-start rounded-[12px] overflow-hidden bg-black border border-white/[0.05] ${
              item.kind === 'poster' ? 'max-h-[75vh] flex items-center justify-center py-1' : 'aspect-video'
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.imageUrl}
              alt={displayTitle}
              className={`w-full h-full ${item.kind === 'poster' ? 'object-contain max-h-[72vh]' : 'object-cover'}`}
              onError={(e) => {
                e.currentTarget.onerror = null;
              }}
            />
          </div>

          {/* Right: Side Content Panel (.side) */}
          <div className="flex flex-col py-2 px-1 md:py-2 md:pr-3 md:pl-0 min-w-0 h-full">
            {/* Top Bar: Actions & Close Button (.top) */}
            <div className="flex items-center justify-between">
              {/* Optional delete / title edit actions for creators */}
              <div className="flex items-center gap-1">
                {onEditTitle && !isEditingTitle && (
                  <button
                    type="button"
                    onClick={() => {
                      setDraftTitle(item.title);
                      setIsEditingTitle(true);
                    }}
                    title="Edit title"
                    className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/[0.06] transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                )}
                {onDelete && !isConfirmingDelete && (
                  <button
                    type="button"
                    onClick={() => setIsConfirmingDelete(true)}
                    title="Delete thumbnail"
                    className="p-1.5 rounded-lg text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Circular Close Button (.xb) */}
              <button
                type="button"
                onClick={onClose}
                title="Close (Esc)"
                aria-label="Close"
                className="w-[30px] h-[30px] rounded-full flex items-center justify-center bg-[#151518] hover:bg-[#1c1c20] border border-white/[0.07] text-[#8b8b93] hover:text-white transition-colors cursor-pointer shrink-0 ml-auto"
              >
                <svg className="w-[14px] h-[14px] stroke-current fill-none stroke-[1.8] stroke-linecap-round stroke-linejoin-round" viewBox="0 0 24 24">
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </div>

            {/* Inline Delete Confirmation Alert */}
            {isConfirmingDelete && (
              <div className="my-2 p-2.5 bg-red-500/10 border border-red-500/30 rounded-[12px] space-y-2 animate-in fade-in duration-150">
                <p className="text-xs font-semibold text-red-200">Permanently delete?</p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsConfirmingDelete(false)}
                    className="flex-1 py-1 rounded-[8px] text-[11px] font-medium text-white/70 hover:bg-white/10"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmDelete}
                    className="flex-1 py-1 rounded-[8px] text-[11px] font-bold text-white bg-red-600 hover:bg-red-500"
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}

            {/* Title Section (.t) */}
            {isEditingTitle ? (
              <div className="my-5 space-y-2">
                <input
                  type="text"
                  value={draftTitle}
                  autoFocus
                  onChange={(e) => setDraftTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveTitle();
                  }}
                  maxLength={160}
                  className="w-full rounded-[10px] border border-white/20 bg-white/[0.05] p-2 text-sm font-semibold text-white outline-none focus:border-white/40"
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSaveTitle}
                    className="flex items-center gap-1 px-3 py-1 rounded-[8px] bg-white text-black text-xs font-semibold"
                  >
                    <Check className="w-3 h-3" /> Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditingTitle(false)}
                    className="px-2.5 py-1 rounded-[8px] text-white/50 hover:text-white text-xs"
                  >
                    <XIcon className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ) : (
              <h2 className="text-[18px] sm:text-[19px] font-semibold text-[#ededef] tracking-[-0.025em] leading-[1.3] my-6 sm:my-7 break-words">
                {displayTitle}
              </h2>
            )}

            {/* Channel + Views (.who) - channel icon removed as requested */}
            <div className="space-y-0.5">
              <b className="block font-medium text-[13.5px] text-white leading-tight">
                {displayCreator}
              </b>
              {(shortViews || displayTime) && (
                <small className="block text-[12px] text-[#5a5a62] leading-snug">
                  {shortViews ? (
                    <>
                      <em className="not-italic text-[#8b8b93] font-medium">{shortViews}</em> views
                    </>
                  ) : null}
                  {shortViews && displayTime ? ' · ' : ''}
                  {displayTime && <span>{displayTime}</span>}
                </small>
              )}
            </div>

            {/* Category badge (subtle) */}
            {item.niche && item.niche !== 'All' && (
              <div className="mt-3">
                <span className="inline-block px-2 py-0.5 rounded-[6px] bg-white/[0.05] border border-white/[0.08] text-[11px] font-medium text-white/70">
                  {item.niche}
                </span>
              </div>
            )}

            {/* Bottom Actions Container (.btns) */}
            <div className="mt-auto pt-7 sm:pt-9 flex flex-col gap-2.5">
              {/* Split Download Button (.split) */}
              <div className="flex rounded-[12px] overflow-hidden bg-[#f2f2f3] text-[#0a0a0b] shadow-sm">
                <button
                  type="button"
                  onClick={() => handleDownload(downloadFormat)}
                  disabled={isDownloading}
                  className="flex-1 flex items-center justify-center gap-2 py-3 px-3.5 font-medium text-[12.5px] hover:bg-white transition-colors cursor-pointer text-black"
                >
                  <Download className="w-4 h-4 shrink-0 stroke-[1.8]" />
                  <span>{isDownloading ? 'Downloading...' : 'Download'}</span>
                </button>

                {/* Format Toggle (.fmt) */}
                <button
                  type="button"
                  onClick={() => setDownloadFormat(prev => (prev === 'jpg' ? 'png' : 'jpg'))}
                  className="flex items-center gap-1.5 px-3 border-l border-black/15 font-mono text-[11px] font-medium text-[#4a4a50] hover:bg-white hover:text-black transition-colors cursor-pointer select-none"
                  title={`Click to switch format (currently ${downloadFormat.toUpperCase()})`}
                >
                  <span>{downloadFormat.toUpperCase()}</span>
                  <svg className="w-3 h-3 stroke-current fill-none stroke-[2] stroke-linecap-round stroke-linejoin-round shrink-0" viewBox="0 0 24 24">
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </button>
              </div>

              {/* Watch on YouTube Ghost Button (.ghost) */}
              {item.sourceUrl ? (
                <a
                  href={item.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 p-3 rounded-[12px] border border-white/[0.14] font-medium text-[12.5px] text-[#8b8b93] hover:text-white hover:bg-white/[0.05] transition-colors cursor-pointer"
                >
                  <svg className="w-4 h-4 stroke-current fill-none stroke-[1.8] stroke-linecap-round stroke-linejoin-round shrink-0" viewBox="0 0 24 24">
                    <rect x="3" y="6" width="18" height="12" rx="3.5" />
                    <path d="m10.5 9.5 4 2.5-4 2.5z" />
                  </svg>
                  <span>{isYouTube ? 'Watch on YouTube' : 'View Source'}</span>
                </a>
              ) : null}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default ThumbnailModal;
