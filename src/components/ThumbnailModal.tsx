'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Pencil, Check, X as XIcon, Eye, Calendar, ExternalLink, User } from 'lucide-react';
import { IconClose, IconDownload, IconTrash } from './icons/AppIcons';
import { ThumbnailItem } from '../lib/types';
import { getCachedYouTubeDetail, fetchMissingYouTubeDetails } from '../lib/youtubeMetadataCache';

interface ThumbnailModalProps {
  item: ThumbnailItem | null;
  onClose: () => void;
  onDelete?: (item: ThumbnailItem) => void;
  onEditTitle?: (item: ThumbnailItem, title: string) => void;
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
  const [cachedYT, setCachedYT] = useState<ReturnType<typeof getCachedYouTubeDetail>>(null);

  // Reset transient state whenever a new item is selected or closed
  useEffect(() => {
    setIsConfirmingDelete(false);
    setIsEditingTitle(false);
    setDraftTitle('');
    if (item) {
      setCachedYT(getCachedYouTubeDetail(item));
      fetchMissingYouTubeDetails([item]);
    } else {
      setCachedYT(null);
    }
  }, [item]);

  useEffect(() => {
    const handleUpdate = () => {
      if (item) {
        setCachedYT(getCachedYouTubeDetail(item));
      }
    };
    window.addEventListener('thumbfeed_yt_cache_updated', handleUpdate);
    return () => window.removeEventListener('thumbfeed_yt_cache_updated', handleUpdate);
  }, [item]);

  // Close on Escape key. While editing, Escape cancels the edit first.
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

  // Synchronous: the caller drops the tile from state (which unmounts this
  // modal) while the database work continues in the background.
  const handleConfirmDelete = () => {
    if (!item || !onDelete) return;
    onDelete(item);
  };

  const handleSaveTitle = () => {
    if (!item || !onEditTitle) return;
    const next = draftTitle.trim();
    if (next && next !== item.title) {
      onEditTitle(item, next);
    }
    setIsEditingTitle(false);
  };

  return (
    <AnimatePresence>
      {item && (
        <div
          id="thumbnail-modal-overlay"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
        >
          {/* Backdrop click to close */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-md"
            onClick={onClose}
          />

          {/* Modal Dialog Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 8 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            id="thumbnail-modal-content"
            className="relative w-full max-w-4xl bg-surface border border-line rounded-[18px] shadow-elevated overflow-hidden z-10 my-auto flex flex-col p-4 sm:p-6 gap-3 gpu-layer"
          >
            {/* Floating Close & Download Header */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 flex-1 items-center gap-1.5">
                {onEditTitle && isEditingTitle ? (
                  <>
                    <input
                      type="text"
                      value={draftTitle}
                      autoFocus
                      onChange={(e) => setDraftTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveTitle();
                      }}
                      aria-label="Edit video title"
                      maxLength={140}
                      className="min-w-0 flex-1 rounded-[8px] border border-line bg-surface-raised px-2 py-1 text-xs sm:text-sm font-semibold text-ink outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleSaveTitle}
                      title="Save title"
                      aria-label="Save title"
                      className="grid h-7 w-7 shrink-0 cursor-pointer place-items-center rounded-[8px] bg-accent text-on-accent hover:opacity-90 active:scale-95"
                    >
                      <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditingTitle(false)}
                      title="Cancel"
                      aria-label="Cancel editing"
                      className="grid h-7 w-7 shrink-0 cursor-pointer place-items-center rounded-[8px] text-ink-muted hover:bg-surface-raised active:scale-95"
                    >
                      <XIcon className="h-3.5 w-3.5" strokeWidth={2.25} />
                    </button>
                  </>
                ) : (
                  <>
                    <h3 className="truncate text-xs sm:text-sm font-bold text-ink">
                      {item.title}
                    </h3>
                    {onEditTitle && (
                      <button
                        type="button"
                        onClick={() => {
                          setDraftTitle(item.title);
                          setIsEditingTitle(true);
                        }}
                        title="Edit title"
                        aria-label="Edit video title"
                        className="grid h-6 w-6 shrink-0 cursor-pointer place-items-center rounded-[6px] text-ink-faint hover:bg-surface-raised hover:text-ink active:scale-95"
                      >
                        <Pencil className="h-3 w-3" strokeWidth={2} />
                      </button>
                    )}
                  </>
                )}
              </div>

              <div className="flex items-center gap-2">
                <a
                  id="thumbnail-download-btn"
                  href={item.imageUrl}
                  target="_blank"
                  rel="noreferrer"
                  download="thumbnail.jpg"
                  title="Download HD Image"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-xs font-semibold bg-black text-white hover:bg-black/85 shadow-xs active:scale-[0.96] transition-all duration-150 cursor-pointer dark:bg-black dark:text-white dark:border dark:border-white/15"
                >
                  <IconDownload className="w-4 h-4" />
                  <span className="hidden sm:inline">Download</span>
                </a>

                {onDelete && (
                  <button
                    id="thumbnail-delete-btn"
                    type="button"
                    onClick={() => setIsConfirmingDelete(true)}
                    title="Delete permanently from database"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-xs font-semibold text-ink bg-surface-raised hover:bg-surface-sunken border border-line shadow-xs active:scale-[0.96] transition-all duration-150 cursor-pointer"
                  >
                    <IconTrash className="w-4 h-4" />
                    <span className="hidden sm:inline">Delete</span>
                  </button>
                )}

                <button
                  id="thumbnail-close-btn"
                  onClick={onClose}
                  title="Close"
                  className="p-1.5 rounded-[10px] text-ink-muted hover:text-ink bg-surface-raised hover:bg-surface-sunken border border-line active:scale-[0.94] transition-all duration-150 flex items-center justify-center cursor-pointer"
                >
                  <IconClose className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Confirmation Banner for Permanent Deletion */}
            {isConfirmingDelete && (
              <div
                id="delete-confirmation-banner"
                className="p-3 bg-surface-raised border border-line rounded-[12px] flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in slide-in-from-top-1 duration-150"
              >
                <div className="flex items-start sm:items-center gap-2.5">
                  <div className="p-1.5 rounded-full bg-accent/15 text-ink shrink-0">
                    <IconTrash className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-ink">
                      Permanently delete from database?
                    </p>
                    <p className="text-[11px] text-ink-muted">
                      This thumbnail will be erased forever from PostgreSQL database and storage.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsConfirmingDelete(false)}
                    className="px-3 py-1.5 rounded-[8px] text-xs font-semibold text-ink hover:bg-surface-sunken transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    id="confirm-delete-permanent-btn"
                    type="button"
                    onClick={handleConfirmDelete}
                    className="px-3.5 py-1.5 rounded-[8px] text-xs font-bold text-white bg-danger hover:opacity-90 active:scale-95 transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <IconTrash className="w-3.5 h-3.5" />
                    <span>Delete Permanently</span>
                  </button>
                </div>
              </div>
            )}

            {/* Thumbnail / Poster Image View */}
            <div className={`relative w-full rounded-[14px] overflow-hidden bg-stage border border-line shadow-inner flex items-center justify-center ${item.kind === 'poster' ? 'max-h-[78vh] py-1' : 'aspect-video bg-stage'}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.imageUrl}
                alt={item.title || 'Preview'}
                className={`object-contain transition-opacity duration-200 ${item.kind === 'poster' ? 'max-h-[75vh] w-auto max-w-full rounded-lg' : 'w-full h-full'}`}
                onError={(e) => {
                  e.currentTarget.onerror = null;
                }}
              />
            </div>

            {/* Metadata Footer: Channel name with link, Views count, Upload date */}
            {(() => {
              const currentYT = cachedYT || getCachedYouTubeDetail(item);
              const rawCreator = currentYT?.creator || item.creator || '';
              const isTanzeeOrUnknown =
                !rawCreator ||
                rawCreator.trim() === '' ||
                rawCreator.toLowerCase().includes('tanzee') ||
                rawCreator.trim() === 'YouTube Creator' ||
                rawCreator.trim() === 'Unknown';

              const creatorName = isTanzeeOrUnknown ? null : rawCreator;
              const rawViews = currentYT?.views || item.viewsEstimate || '';
              const viewsText = rawViews
                ? rawViews.toLowerCase().includes('view')
                  ? rawViews
                  : `${rawViews} views`
                : null;
              const publishedDate = currentYT?.publishedTime || item.publishedTime || null;
              const subsText = currentYT?.subscribers || item.subscribersCount || null;
              const isYouTube =
                item.sourceUrl &&
                (item.sourceUrl.includes('youtube.com') || item.sourceUrl.includes('youtu.be'));

              if (!creatorName && !viewsText && !publishedDate && !item.sourceUrl) {
                return null;
              }

              return (
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-line text-xs text-ink-muted">
                  <div className="flex flex-wrap items-center gap-2.5">
                    {creatorName && (
                      <div className="flex items-center gap-1.5 font-semibold text-ink">
                        <User className="w-3.5 h-3.5 opacity-70" />
                        <span>{creatorName}</span>
                      </div>
                    )}
                    {subsText && (
                      <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-surface-raised text-[11px] text-ink-muted">
                        <span>{subsText}</span>
                      </div>
                    )}
                    {viewsText && (
                      <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-surface-raised font-medium text-ink">
                        <Eye className="w-3.5 h-3.5 opacity-70" />
                        <span>{viewsText}</span>
                      </div>
                    )}
                    {publishedDate && (
                      <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-surface-raised text-xs text-ink-muted">
                        <Calendar className="w-3.5 h-3.5 opacity-70" />
                        <span>{publishedDate}</span>
                      </div>
                    )}
                  </div>

                  {item.sourceUrl && (
                    <a
                      href={item.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-black text-white hover:bg-black/85 transition-colors text-xs font-semibold shadow-xs ml-auto dark:bg-black dark:text-emerald-300 dark:border dark:border-white/10"
                    >
                      <span>{isYouTube ? 'Watch on YouTube' : 'View Source'}</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              );
            })()}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};




