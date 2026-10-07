'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { IconTrash, IconClose } from './icons/AppIcons';
import { ThumbnailItem } from '../lib/types';

interface DeleteConfirmModalProps {
  item: ThumbnailItem | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (item: ThumbnailItem) => void;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  item,
  isOpen,
  onClose,
  onConfirm
}) => {
  if (!isOpen || !item) return null;

  // Synchronous: the caller removes the tile from state and closes every
  // modal at once, while the database work continues in the background.
  const handleConfirm = () => {
    onConfirm(item);
  };

  return (
    <AnimatePresence>
      <div
        id="delete-confirm-modal-overlay"
        className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      >
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 bg-black/70 backdrop-blur-xs"
          onClick={onClose}
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          id="delete-confirm-dialog"
          className="relative w-full max-w-md bg-[#D6D1BC] dark:bg-[#1E1B1A] border border-[#0d0e10]/15 dark:border-[#D6D1BC]/20 rounded-[20px] shadow-2xl p-5 sm:p-6 flex flex-col gap-4 z-10"
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-full bg-[#411C1A]/10 dark:bg-[#411C1A]/20 text-[#0d0e10] dark:text-[#D6D1BC] border border-[#0d0e10]/20 dark:border-[#D6D1BC]/30 shrink-0">
                <IconTrash className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#0d0e10] dark:text-[#D6D1BC]">
                  Delete Permanently?
                </h3>
                <p className="text-xs text-[#0d0e10]/70 dark:text-[#D6D1BC]/70">
                  This action cannot be undone
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Cancel delete"
              className="p-1 rounded-lg text-[#0d0e10]/60 hover:text-[#0d0e10] dark:text-[#D6D1BC]/70 dark:hover:text-[#D6D1BC] hover:bg-[#E4E1D2]/30 dark:hover:bg-[#411C1A]/10 transition-colors"
            >
              <IconClose className="w-4 h-4" />
            </button>
          </div>

          {/* Thumbnail preview snippet */}
          <div className="flex items-center gap-3 p-2.5 rounded-[12px] bg-[#E4E1D2]/40 dark:bg-[#1E1B1A] border border-[#0d0e10]/15 dark:border-[#D6D1BC]/25">
            <div className="w-20 aspect-video rounded-[8px] overflow-hidden bg-[#411C1A] shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.imageUrl}
                alt={item.title}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.onerror = null;
                }}
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-[#0d0e10] dark:text-[#D6D1BC] truncate">
                {item.title}
              </p>
              <p className="text-[11px] text-[#0d0e10]/70 dark:text-[#D6D1BC]/70 truncate">
                {item.creator || 'Creator'} • {item.niche}
              </p>
            </div>
          </div>

          {/* Warning text */}
          <p className="text-xs text-[#0d0e10]/80 dark:text-[#D6D1BC]/80 leading-relaxed">
            Are you sure you want to permanently delete this thumbnail? It will be removed immediately from your database, storage bucket, and feed.
          </p>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#0d0e10]/10 dark:border-[#D6D1BC]/15">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-[#0d0e10] dark:text-[#D6D1BC] hover:bg-[#E4E1D2]/40 dark:hover:bg-[#411C1A]/10 rounded-[10px] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              id="confirm-delete-action-btn"
              type="button"
              onClick={handleConfirm}
              className="px-4 py-2 text-xs font-bold text-[#0d0e10] bg-[#411C1A] dark:bg-[#411C1A] dark:text-[#0d0e10] hover:opacity-90 active:scale-[0.97] rounded-[10px] transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <IconTrash className="w-3.5 h-3.5" />
              <span>Delete Permanently</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
