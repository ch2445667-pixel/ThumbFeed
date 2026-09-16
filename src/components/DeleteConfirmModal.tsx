'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { IconTrash, IconClose, IconSpinner } from './icons/AppIcons';
import { ThumbnailItem } from '../lib/types';

interface DeleteConfirmModalProps {
  item: ThumbnailItem | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (item: ThumbnailItem) => Promise<void> | void;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  item,
  isOpen,
  onClose,
  onConfirm
}) => {
  const [isDeleting, setIsDeleting] = useState(false);

  if (!isOpen || !item) return null;

  const handleConfirm = async () => {
    setIsDeleting(true);
    try {
      await onConfirm(item);
      onClose();
    } catch (err) {
      console.error('Delete confirmation error:', err);
    } finally {
      setIsDeleting(false);
    }
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
          onClick={() => !isDeleting && onClose()}
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          id="delete-confirm-dialog"
          className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[20px] shadow-2xl p-5 sm:p-6 flex flex-col gap-4 z-10"
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-full bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 border border-red-200/60 dark:border-red-900/50 shrink-0">
                <IconTrash className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Delete Permanently?
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  This action cannot be undone
                </p>
              </div>
            </div>

            <button
              type="button"
              disabled={isDeleting}
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <IconClose className="w-4 h-4" />
            </button>
          </div>

          {/* Thumbnail preview snippet */}
          <div className="flex items-center gap-3 p-2.5 rounded-[12px] bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60">
            <div className="w-20 aspect-video rounded-[8px] overflow-hidden bg-slate-200 shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.imageUrl}
                alt={item.title}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                {item.title}
              </p>
              <p className="text-[11px] text-slate-400 truncate">
                {item.creator || 'Creator'} • {item.niche}
              </p>
            </div>
          </div>

          {/* Warning text */}
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            Are you sure you want to permanently delete this thumbnail? It will be removed immediately from your database, storage bucket, and feed.
          </p>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              disabled={isDeleting}
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-[10px] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              id="confirm-delete-action-btn"
              type="button"
              disabled={isDeleting}
              onClick={handleConfirm}
              className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 active:scale-[0.97] disabled:opacity-50 rounded-[10px] transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              {isDeleting ? (
                <>
                  <IconSpinner className="w-3.5 h-3.5 animate-spin" />
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
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
