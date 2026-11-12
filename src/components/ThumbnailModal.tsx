'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Pencil, Check, X as XIcon, Eye, Calendar, ExternalLink, User, Download, Trash2, X } from 'lucide-react';
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

  if (!item) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 bg-black/85 backdrop-blur-md"
          onClick={onClose}
        />

        {/* Modal Dialog Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 8 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full max-w-4xl bg-[#0f1117] border border-white/[0.08] rounded-2xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.95)] overflow-hidden z-10 my-auto flex flex-col p-4 sm:p-5 gap-3"
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-3">
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
                    aria-label="Edit title"
                    maxLength={140}
                    className="min-w-0 flex-1 rounded-lg border border-white/20 bg-white/[0.04] px-2.5 py-1 text-xs sm:text-sm font-semibold text-white outline-none focus:border-white/40"
                  />
                  <button
                    type="button"
                    onClick={handleSaveTitle}
                    title="Save title"
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white text-black hover:bg-white/90 active:scale-95 transition-colors"
                  >
                    <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditingTitle(false)}
                    title="Cancel"
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-white/50 hover:bg-white/10 active:scale-95 transition-colors"
                  >
                    <XIcon className="h-3.5 w-3.5" strokeWidth={2} />
                  </button>
                </>
              ) : (
                <>
                  <h3 className="truncate text-xs sm:text-sm font-semibold text-white/95">
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
                      className="p-1 rounded-md text-white/40 hover:text-white hover:bg-white/[0.06] transition-colors"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                  )}
                </>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <a
                href={item.imageUrl}
                target="_blank"
                rel="noreferrer"
                download="thumbnail.jpg"
                title="Download HD Image"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white text-black hover:bg-white/90 shadow-sm active:scale-[0.98] transition-all"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Download</span>
              </a>

              {onDelete && (
                <button
                  type="button"
                  onClick={() => setIsConfirmingDelete(true)}
                  title="Delete permanently"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white/80 bg-white/[0.06] hover:bg-red-500 hover:text-white border border-white/[0.08] active:scale-[0.98] transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Delete</span>
                </button>
              )}

              <button
                onClick={onClose}
                title="Close"
                className="p-1.5 rounded-lg text-white/40 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Delete Confirmation Alert */}
          {isConfirmingDelete && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in duration-150">
              <div className="flex items-start sm:items-center gap-2.5">
                <div className="p-1.5 rounded-full bg-red-500/20 text-red-300 shrink-0">
                  <Trash2 className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-red-200">
                    Permanently delete from feed & storage?
                  </p>
                  <p className="text-[11px] text-red-300/80">
                    This file and its preview will be permanently removed.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                <button
                  type="button"
                  onClick={() => setIsConfirmingDelete(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-white/70 hover:bg-white/10 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-bold text-white bg-red-600 hover:bg-red-500 transition-colors shadow-sm flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
              </div>
            </div>
          )}

          {/* Thumbnail / Poster Image View */}
          <div className={`relative w-full rounded-xl overflow-hidden bg-black/60 border border-white/[0.08] flex items-center justify-center ${item.kind === 'poster' ? 'max-h-[75vh] py-1' : 'aspect-video'}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.imageUrl}
              alt={item.title || 'Preview'}
              className={`object-contain transition-opacity duration-200 ${item.kind === 'poster' ? 'max-h-[72vh] w-auto max-w-full rounded-lg' : 'w-full h-full'}`}
              onError={(e) => {
                e.currentTarget.onerror = null;
              }}
            />
          </div>

          {/* Metadata Footer */}
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
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2.5 border-t border-white/[0.06] text-xs text-white/60">
                <div className="flex flex-wrap items-center gap-2.5">
                  {creatorName && (
                    <div className="flex items-center gap-1.5 font-medium text-white/90">
                      <User className="w-3.5 h-3.5 text-white/40" />
                      <span>{creatorName}</span>
                    </div>
                  )}
                  {viewsText && (
                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/[0.04] text-[11px] font-mono text-white/80">
                      <Eye className="w-3 h-3 text-white/40" />
                      <span>{viewsText}</span>
                    </div>
                  )}
                  {publishedDate && (
                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/[0.04] text-[11px] text-white/60">
                      <Calendar className="w-3 h-3 text-white/40" />
                      <span>{publishedDate}</span>
                    </div>
                  )}
                </div>

                {item.sourceUrl && (
                  <a
                    href={item.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors ml-auto"
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
    </AnimatePresence>
  );
};

export default ThumbnailModal;
