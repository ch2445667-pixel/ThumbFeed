'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Pencil, Check, X as XIcon, Eye, Calendar, ExternalLink, User } from 'lucide-react';
import { IconClose, IconDownload, IconTrash } from './icons/AppIcons';
import { ThumbnailItem } from '../lib/types';

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

  // Reset transient state whenever a new item is selected or closed
  useEffect(() => {
    setIsConfirmingDelete(false);
    setIsEditingTitle(false);
    setDraftTitle('');
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
            className="relative w-full max-w-4xl bg-[#D6D1BC] dark:bg-[#1E1B1A] border border-[#0d0e10]/15 dark:border-[#D6D1BC]/20 rounded-[18px] shadow-[0_25px_50px_-12px_rgba(65,28,26,0.35)] dark:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.95)] overflow-hidden z-10 my-auto flex flex-col p-4 sm:p-6 gap-3 gpu-layer"
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
                      className="min-w-0 flex-1 rounded-[8px] border border-[#0d0e10]/30 dark:border-[#D6D1BC]/40 bg-transparent px-2 py-1 text-xs sm:text-sm font-semibold text-[#0d0e10] dark:text-[#D6D1BC] outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleSaveTitle}
                      title="Save title"
                      aria-label="Save title"
                      className="grid h-7 w-7 shrink-0 cursor-pointer place-items-center rounded-[8px] bg-[#411C1A] text-[#0d0e10] dark:bg-[#411C1A] dark:text-[#0d0e10] hover:opacity-90 active:scale-95"
                    >
                      <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditingTitle(false)}
                      title="Cancel"
                      aria-label="Cancel editing"
                      className="grid h-7 w-7 shrink-0 cursor-pointer place-items-center rounded-[8px] text-[#0d0e10]/70 hover:bg-[#E4E1D2]/40 dark:text-[#D6D1BC]/70 dark:hover:bg-[#411C1A]/10 active:scale-95"
                    >
                      <XIcon className="h-3.5 w-3.5" strokeWidth={2.25} />
                    </button>
                  </>
                ) : (
                  <>
                    <h3 className="truncate text-xs sm:text-sm font-bold text-[#0d0e10] dark:text-[#D6D1BC]">
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
                        className="grid h-6 w-6 shrink-0 cursor-pointer place-items-center rounded-[6px] text-[#0d0e10]/50 hover:bg-[#E4E1D2]/40 hover:text-[#0d0e10] dark:text-[#D6D1BC]/50 dark:hover:bg-[#411C1A]/10 dark:hover:text-[#D6D1BC] active:scale-95"
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
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-xs font-semibold bg-[#411C1A] text-[#0d0e10] dark:bg-[#411C1A] dark:text-[#0d0e10] hover:opacity-90 shadow-xs active:scale-[0.96] transition-all duration-150 cursor-pointer"
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
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-xs font-semibold text-[#0d0e10] dark:text-[#D6D1BC] bg-[#E4E1D2]/40 dark:bg-[#411C1A]/10 hover:bg-[#E4E1D2] border border-[#0d0e10]/20 dark:border-[#D6D1BC]/30 shadow-xs active:scale-[0.96] transition-all duration-150 cursor-pointer"
                  >
                    <IconTrash className="w-4 h-4" />
                    <span className="hidden sm:inline">Delete</span>
                  </button>
                )}

                <button
                  id="thumbnail-close-btn"
                  onClick={onClose}
                  title="Close"
                  className="p-1.5 rounded-[10px] text-[#0d0e10]/70 hover:text-[#0d0e10] dark:text-[#D6D1BC]/70 dark:hover:text-[#D6D1BC] bg-[#E4E1D2]/30 dark:bg-[#411C1A]/10 hover:bg-[#E4E1D2] dark:hover:bg-[#411C1A]/20 border border-[#0d0e10]/15 dark:border-[#D6D1BC]/20 active:scale-[0.94] transition-all duration-150 flex items-center justify-center cursor-pointer"
                >
                  <IconClose className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Confirmation Banner for Permanent Deletion */}
            {isConfirmingDelete && (
              <div
                id="delete-confirmation-banner"
                className="p-3 bg-[#E4E1D2]/60 dark:bg-[#1E1B1A] border border-[#0d0e10]/30 dark:border-[#D6D1BC]/30 rounded-[12px] flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in slide-in-from-top-1 duration-150"
              >
                <div className="flex items-start sm:items-center gap-2.5">
                  <div className="p-1.5 rounded-full bg-[#411C1A]/10 dark:bg-[#411C1A]/20 text-[#0d0e10] dark:text-[#D6D1BC] shrink-0">
                    <IconTrash className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#0d0e10] dark:text-[#D6D1BC]">
                      Permanently delete from database?
                    </p>
                    <p className="text-[11px] text-[#0d0e10]/80 dark:text-[#D6D1BC]/80">
                      This thumbnail will be erased forever from PostgreSQL database and storage.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsConfirmingDelete(false)}
                    className="px-3 py-1.5 rounded-[8px] text-xs font-semibold text-[#0d0e10] dark:text-[#D6D1BC] hover:bg-[#E4E1D2]/40 dark:hover:bg-[#411C1A]/10 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    id="confirm-delete-permanent-btn"
                    type="button"
                    onClick={handleConfirmDelete}
                    className="px-3.5 py-1.5 rounded-[8px] text-xs font-bold text-[#0d0e10] bg-[#411C1A] dark:bg-[#411C1A] dark:text-[#0d0e10] hover:opacity-90 active:scale-95 transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <IconTrash className="w-3.5 h-3.5" />
                    <span>Delete Permanently</span>
                  </button>
                </div>
              </div>
            )}

            {/* Thumbnail / Poster Image View */}
            <div className={`relative w-full rounded-[14px] overflow-hidden bg-[#411C1A]/10 dark:bg-black/60 border border-[#0d0e10]/20 dark:border-[#D6D1BC]/20 shadow-inner flex items-center justify-center ${item.kind === 'poster' ? 'max-h-[78vh] py-1' : 'aspect-video bg-[#411C1A]'}`}>
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
              const isTanzeeOrUnknown =
                !item.creator ||
                item.creator.trim() === '' ||
                item.creator.toLowerCase().includes('tanzee') ||
                item.creator.trim() === 'YouTube Creator' ||
                item.creator.trim() === 'Unknown';

              const creatorName = isTanzeeOrUnknown ? null : item.creator;
              const viewsText = item.viewsEstimate
                ? item.viewsEstimate.toLowerCase().includes('view')
                  ? item.viewsEstimate
                  : `${item.viewsEstimate} views`
                : null;
              const publishedDate = item.publishedTime || null;
              const isYouTube =
                item.sourceUrl &&
                (item.sourceUrl.includes('youtube.com') || item.sourceUrl.includes('youtu.be'));

              if (!creatorName && !viewsText && !publishedDate && !item.sourceUrl) {
                return null;
              }

              return (
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#0d0e10]/10 dark:border-[#D6D1BC]/15 text-xs text-[#0d0e10]/80 dark:text-[#D6D1BC]/80">
                  <div className="flex flex-wrap items-center gap-2.5">
                    {creatorName && (
                      <div className="flex items-center gap-1.5 font-semibold text-[#0d0e10] dark:text-[#D6D1BC]">
                        <User className="w-3.5 h-3.5 opacity-70" />
                        <span>{creatorName}</span>
                      </div>
                    )}
                    {viewsText && (
                      <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#411C1A]/5 dark:bg-[#411C1A]/10 font-medium text-[#0d0e10] dark:text-[#D6D1BC]">
                        <Eye className="w-3.5 h-3.5 opacity-70" />
                        <span>{viewsText}</span>
                      </div>
                    )}
                    {publishedDate && (
                      <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#411C1A]/5 dark:bg-[#411C1A]/10 text-xs">
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
                      className="flex items-center gap-1 text-xs font-semibold text-[#0d0e10] dark:text-[#D6D1BC] hover:underline ml-auto"
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




