'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Pencil, Check, X as XIcon, Trash2, Download, ImageOff } from 'lucide-react';
import { ThumbnailItem } from '../lib/types';
import { getCachedYouTubeDetail, resolveThumbnailDisplayMeta } from '../lib/youtubeMetadataCache';
import { formatShortViews } from '../lib/formatViews';
import { sanitizeSafeHref, sanitizeSafeImageSrc } from '../lib/urlSafety';

interface ThumbnailModalProps {
  item: ThumbnailItem | null;
  onClose: () => void;
  onDelete?: (item: ThumbnailItem) => void;
  onEditTitle?: (item: ThumbnailItem, title: string) => void;
  onEditMetadata?: (
    item: ThumbnailItem,
    updates: { title: string; creator: string; viewsEstimate: string }
  ) => void;
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
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
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
  onEditTitle,
  onEditMetadata,
}) => {
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftCreator, setDraftCreator] = useState('');
  const [draftViews, setDraftViews] = useState('');
  const [downloadFormat, setDownloadFormat] = useState<'jpg' | 'png'>('jpg');
  const [isDownloading, setIsDownloading] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  // Reset transient state whenever a new item is selected or closed
  useEffect(() => {
    setIsConfirmingDelete(false);
    setIsEditingDetails(false);
    setDraftTitle('');
    setDraftCreator('');
    setDraftViews('');
    setImgFailed(false);
  }, [item]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isEditingDetails) {
          setIsEditingDetails(false);
        } else if (isConfirmingDelete) {
          setIsConfirmingDelete(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, isConfirmingDelete, isEditingDetails]);

  if (!item) return null;

  const cachedYT = getCachedYouTubeDetail(item);
  const resolved = resolveThumbnailDisplayMeta(item, cachedYT);
  const displayCreator = resolved.creator || 'Creator';
  const displayTitle =
    resolved.title ||
    (resolved.creator ? `${resolved.creator} Thumbnail` : 'Thumbnail Preview');

  const shortViews = formatShortViews(resolved.views);
  const displayTime = resolved.publishedTime || formatTimeAgo(item.createdAt);

  const isYouTube = Boolean(
    item.sourceUrl &&
      (item.sourceUrl.includes('youtube.com') || item.sourceUrl.includes('youtu.be'))
  );

  const handleConfirmDelete = () => {
    if (!item || !onDelete) return;
    onDelete(item);
    onClose();
  };

  const canEdit = Boolean(onEditMetadata || onEditTitle);

  const handleStartEdit = () => {
    setDraftTitle(resolved.title || item.title || '');
    setDraftCreator(resolved.creator || '');
    setDraftViews(shortViews || resolved.views || '');
    setIsEditingDetails(true);
  };

  const handleSaveDetails = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!item) return;
    const nextTitle = draftTitle.trim() || item.title;
    const nextCreator = draftCreator.trim();
    const rawViews = draftViews.trim();
    const nextViews = rawViews ? formatShortViews(rawViews) || rawViews : '';

    if (onEditMetadata) {
      onEditMetadata(item, {
        title: nextTitle,
        creator: nextCreator,
        viewsEstimate: nextViews,
      });
    } else if (onEditTitle && nextTitle && nextTitle !== item.title) {
      onEditTitle(item, nextTitle);
    }
    setIsEditingDetails(false);
  };

  const previewFormattedViews = formatShortViews(draftViews);

  const handleDownload = async (format: 'jpg' | 'png' = downloadFormat) => {
    const safeImg = sanitizeSafeImageSrc(item?.imageUrl);
    if (!safeImg) return;
    setIsDownloading(true);
    try {
      const cleanName = (displayTitle || 'thumbnail')
        .replace(/[^a-zA-Z0-9_\-\s]/g, '')
        .trim()
        .replace(/\s+/g, '_')
        .slice(0, 50);
      const filename = `${cleanName || 'thumbnail'}.${format}`;

      const res = await fetch(safeImg);
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
      const link = document.createElement('a');
      link.href = safeImg;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } finally {
      setIsDownloading(false);
    }
  };

  const safeModalImg = sanitizeSafeImageSrc(item.imageUrl);
  const safeSourceHref = sanitizeSafeHref(item.sourceUrl);

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
            {!imgFailed && safeModalImg ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={safeModalImg}
                alt={displayTitle}
                referrerPolicy="no-referrer"
                className={`w-full h-full ${item.kind === 'poster' ? 'object-contain max-h-[72vh]' : 'object-cover'}`}
                onError={() => setImgFailed(true)}
              />
            ) : (
              <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 text-white/35">
                <ImageOff className="h-7 w-7" />
                <span className="text-xs">Image preview unavailable</span>
              </div>
            )}
          </div>

          {/* Right: Side Content Panel (.side) */}
          <div className="flex flex-col py-2 px-1 md:py-2 md:pr-3 md:pl-0 min-w-0 h-full">
            {/* Top Bar: Actions & Close Button (.top) */}
            <div className="flex items-center justify-between">
              {/* Optional delete / details edit actions for creators */}
              <div className="flex items-center gap-1">
                {canEdit && !isEditingDetails && (
                  <button
                    type="button"
                    onClick={handleStartEdit}
                    title="Edit details"
                    aria-label="Edit details"
                    className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                )}
                {onDelete && !isConfirmingDelete && (
                  <button
                    type="button"
                    onClick={() => setIsConfirmingDelete(true)}
                    title="Delete thumbnail"
                    aria-label="Delete thumbnail"
                    className="p-1.5 rounded-lg text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
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

            {/* Metadata Display or Inline Edit Form */}
            {isEditingDetails ? (
              <form onSubmit={handleSaveDetails} className="my-4 space-y-2.5">
                <div className="space-y-1">
                  <label htmlFor="modal-edit-title" className="block text-[11px] font-medium text-white/50">
                    Video Title
                  </label>
                  <input
                    id="modal-edit-title"
                    type="text"
                    value={draftTitle}
                    autoFocus
                    required
                    onChange={(e) => setDraftTitle(e.target.value)}
                    placeholder="Video title"
                    maxLength={180}
                    className="w-full rounded-[10px] border border-white/20 bg-white/[0.05] px-2.5 py-1.5 text-xs font-medium text-white placeholder:text-white/30 outline-none focus:border-white/40"
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="modal-edit-creator" className="block text-[11px] font-medium text-white/50">
                    Channel Name
                  </label>
                  <input
                    id="modal-edit-creator"
                    type="text"
                    value={draftCreator}
                    onChange={(e) => setDraftCreator(e.target.value)}
                    placeholder="Channel name"
                    maxLength={100}
                    className="w-full rounded-[10px] border border-white/20 bg-white/[0.05] px-2.5 py-1.5 text-xs font-medium text-white placeholder:text-white/30 outline-none focus:border-white/40"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label htmlFor="modal-edit-views" className="block text-[11px] font-medium text-white/50">
                      Views
                    </label>
                    {previewFormattedViews && (
                      <span className="text-[11px] font-mono tabular-nums text-white/45">
                        {previewFormattedViews} views
                      </span>
                    )}
                  </div>
                  <input
                    id="modal-edit-views"
                    type="text"
                    value={draftViews}
                    onChange={(e) => setDraftViews(e.target.value)}
                    placeholder="e.g. 2.5M or 2500000"
                    maxLength={32}
                    className="w-full rounded-[10px] border border-white/20 bg-white/[0.05] px-2.5 py-1.5 text-xs font-medium text-white placeholder:text-white/30 outline-none focus:border-white/40 tabular-nums"
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="submit"
                    className="flex items-center gap-1 px-3 py-1.5 rounded-[8px] bg-white text-black hover:bg-white/90 text-xs font-semibold cursor-pointer transition-colors"
                  >
                    <Check className="w-3 h-3" /> Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditingDetails(false)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-[8px] text-white/55 hover:text-white hover:bg-white/[0.06] text-xs cursor-pointer transition-colors"
                  >
                    <XIcon className="w-3 h-3" /> Cancel
                  </button>
                </div>
              </form>
            ) : (
              <>
                <h2 className="text-[18px] sm:text-[19px] font-semibold text-[#ededef] tracking-[-0.025em] leading-[1.3] my-6 sm:my-7 break-words">
                  {displayTitle}
                </h2>

                {/* Channel + Views (.who) */}
                <div className="space-y-0.5">
                  <b className="block font-medium text-[13.5px] text-white leading-tight">
                    {displayCreator}
                  </b>
                  {(shortViews || displayTime) && (
                    <small className="block text-[12px] text-[#5a5a62] leading-snug">
                      {shortViews ? (
                        <>
                          <em className="not-italic text-[#8b8b93] font-medium tabular-nums">{shortViews}</em> views
                        </>
                      ) : null}
                      {shortViews && displayTime ? ' · ' : ''}
                      {displayTime && <span>{displayTime}</span>}
                    </small>
                  )}
                </div>

                {/* Category label (clean unboxed text) */}
                {item.niche && item.niche !== 'All' && (
                  <div className="mt-3 text-[11px] font-medium text-white/50">
                    {item.niche}
                  </div>
                )}
              </>
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
              {safeSourceHref ? (
                <a
                  href={safeSourceHref}
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
