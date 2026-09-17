'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { IconClose, IconDownload, IconTrash, IconSpinner } from './icons/AppIcons';
import { ThumbnailItem } from '../lib/types';

interface ThumbnailModalProps {
  item: ThumbnailItem | null;
  onClose: () => void;
  onDelete?: (item: ThumbnailItem) => Promise<void> | void;
}

export const ThumbnailModal: React.FC<ThumbnailModalProps> = ({
  item,
  onClose,
  onDelete
}) => {
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Reset confirmation state whenever a new item is selected or closed
  useEffect(() => {
    setIsConfirmingDelete(false);
    setIsDeleting(false);
  }, [item]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isConfirmingDelete) {
          setIsConfirmingDelete(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, isConfirmingDelete]);

  const handleConfirmDelete = async () => {
    if (!item || !onDelete) return;
    setIsDeleting(true);
    try {
      await onDelete(item);
      onClose();
    } catch (err) {
      console.error('Failed to delete thumbnail:', err);
      setIsDeleting(false);
    }
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
            className="relative w-full max-w-4xl bg-white/95 dark:bg-slate-900/95 border border-slate-200/80 dark:border-slate-800 rounded-[18px] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.35)] dark:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.95)] overflow-hidden z-10 my-auto flex flex-col p-4 sm:p-6 gap-3 gpu-layer"
          >
            {/* Floating Close & Download Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 max-w-[65%]">
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                  {item.title}
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <a
                  id="thumbnail-download-btn"
                  href={item.imageUrl}
                  target="_blank"
                  rel="noreferrer"
                  download="thumbnail.jpg"
                  title="Download HD Image"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-xs font-semibold bg-[#009FDF] text-white hover:bg-[#008bc4] shadow-xs active:scale-[0.96] transition-all duration-150 cursor-pointer"
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
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-xs font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/60 border border-red-200/70 dark:border-red-900/50 shadow-xs active:scale-[0.96] transition-all duration-150 cursor-pointer"
                  >
                    <IconTrash className="w-4 h-4" />
                    <span className="hidden sm:inline">Delete</span>
                  </button>
                )}

                <button
                  id="thumbnail-close-btn"
                  onClick={onClose}
                  title="Close"
                  className="p-1.5 rounded-[10px] text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200/70 dark:hover:bg-slate-700 border border-slate-200/60 dark:border-slate-700 active:scale-[0.94] transition-all duration-150 flex items-center justify-center cursor-pointer"
                >
                  <IconClose className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Confirmation Banner for Permanent Deletion */}
            {isConfirmingDelete && (
              <div
                id="delete-confirmation-banner"
                className="p-3 bg-red-50/95 dark:bg-red-950/60 border border-red-200 dark:border-red-900/70 rounded-[12px] flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in slide-in-from-top-1 duration-150"
              >
                <div className="flex items-start sm:items-center gap-2.5">
                  <div className="p-1.5 rounded-full bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 shrink-0">
                    <IconTrash className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-red-900 dark:text-red-200">
                      Permanently delete from database?
                    </p>
                    <p className="text-[11px] text-red-700/80 dark:text-red-300/80">
                      This thumbnail will be erased forever from PostgreSQL database and storage.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={() => setIsConfirmingDelete(false)}
                    className="px-3 py-1.5 rounded-[8px] text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    id="confirm-delete-permanent-btn"
                    type="button"
                    disabled={isDeleting}
                    onClick={handleConfirmDelete}
                    className="px-3.5 py-1.5 rounded-[8px] text-xs font-bold text-white bg-red-600 hover:bg-red-700 active:scale-95 disabled:opacity-60 transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    {isDeleting ? (
                      <>
                        <IconSpinner className="w-3.5 h-3.5 animate-spin text-white" />
                        <span>Deleting...</span>
                      </>
                    ) : (
                      <>
                        <IconTrash className="w-3.5 h-3.5" />
                        <span>Delete Permanently</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Thumbnail Full HD Image View */}
            <div className="relative aspect-video w-full rounded-[14px] overflow-hidden bg-slate-950/90 border border-slate-200 dark:border-slate-800 shadow-inner">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.imageUrl}
                alt={item.title || 'Thumbnail Preview'}
                className="w-full h-full object-contain"
              />
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};




