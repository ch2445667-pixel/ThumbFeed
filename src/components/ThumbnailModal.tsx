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
            className="relative w-full max-w-4xl bg-[#FFFFFF] dark:bg-[#401D1A] border border-[#401D1A]/15 dark:border-[#E4E0D3]/20 rounded-[18px] shadow-[0_25px_50px_-12px_rgba(64,29,26,0.35)] dark:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.95)] overflow-hidden z-10 my-auto flex flex-col p-4 sm:p-6 gap-3 gpu-layer"
          >
            {/* Floating Close & Download Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 max-w-[65%]">
                <h3 className="text-xs sm:text-sm font-bold text-[#401D1A] dark:text-[#FFFFFF] truncate">
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
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-xs font-semibold bg-[#401D1A] text-[#FFFFFF] dark:bg-[#E4E0D3] dark:text-[#401D1A] hover:opacity-90 shadow-xs active:scale-[0.96] transition-all duration-150 cursor-pointer"
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
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-xs font-semibold text-[#401D1A] dark:text-[#E4E0D3] bg-[#E4E0D3]/40 dark:bg-[#FFFFFF]/10 hover:bg-[#E4E0D3] border border-[#401D1A]/20 dark:border-[#E4E0D3]/30 shadow-xs active:scale-[0.96] transition-all duration-150 cursor-pointer"
                  >
                    <IconTrash className="w-4 h-4" />
                    <span className="hidden sm:inline">Delete</span>
                  </button>
                )}

                <button
                  id="thumbnail-close-btn"
                  onClick={onClose}
                  title="Close"
                  className="p-1.5 rounded-[10px] text-[#401D1A]/70 hover:text-[#401D1A] dark:text-[#E4E0D3]/70 dark:hover:text-[#FFFFFF] bg-[#E4E0D3]/30 dark:bg-[#FFFFFF]/10 hover:bg-[#E4E0D3] dark:hover:bg-[#FFFFFF]/20 border border-[#401D1A]/15 dark:border-[#E4E0D3]/20 active:scale-[0.94] transition-all duration-150 flex items-center justify-center cursor-pointer"
                >
                  <IconClose className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Confirmation Banner for Permanent Deletion */}
            {isConfirmingDelete && (
              <div
                id="delete-confirmation-banner"
                className="p-3 bg-[#E4E0D3]/60 dark:bg-[#401D1A] border border-[#401D1A]/30 dark:border-[#E4E0D3]/30 rounded-[12px] flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in slide-in-from-top-1 duration-150"
              >
                <div className="flex items-start sm:items-center gap-2.5">
                  <div className="p-1.5 rounded-full bg-[#401D1A]/10 dark:bg-[#E4E0D3]/20 text-[#401D1A] dark:text-[#E4E0D3] shrink-0">
                    <IconTrash className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#401D1A] dark:text-[#FFFFFF]">
                      Permanently delete from database?
                    </p>
                    <p className="text-[11px] text-[#401D1A]/80 dark:text-[#E4E0D3]/80">
                      This thumbnail will be erased forever from PostgreSQL database and storage.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={() => setIsConfirmingDelete(false)}
                    className="px-3 py-1.5 rounded-[8px] text-xs font-semibold text-[#401D1A] dark:text-[#E4E0D3] hover:bg-[#E4E0D3]/40 dark:hover:bg-[#FFFFFF]/10 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    id="confirm-delete-permanent-btn"
                    type="button"
                    disabled={isDeleting}
                    onClick={handleConfirmDelete}
                    className="px-3.5 py-1.5 rounded-[8px] text-xs font-bold text-[#FFFFFF] bg-[#401D1A] dark:bg-[#E4E0D3] dark:text-[#401D1A] hover:opacity-90 active:scale-95 disabled:opacity-60 transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
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
            <div className="relative aspect-video w-full rounded-[14px] overflow-hidden bg-[#401D1A] border border-[#401D1A]/20 dark:border-[#E4E0D3]/20 shadow-inner">
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




