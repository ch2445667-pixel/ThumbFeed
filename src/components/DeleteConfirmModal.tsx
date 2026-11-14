'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ImageOff } from 'lucide-react';
import { IconTrash, IconClose } from './icons/AppIcons';
import { ThumbnailItem } from '../lib/types';
import { sanitizeSafeImageSrc } from '../lib/urlSafety';

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
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [item?.id, item?.imageUrl]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !item) return null;

  const safeImgSrc = sanitizeSafeImageSrc(item.imageUrl);

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
          className="relative w-full max-w-md bg-[#12131a] border border-white/10 rounded-[16px] shadow-2xl p-5 sm:p-6 flex flex-col gap-4 z-10 text-white"
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/30 shrink-0">
                <IconTrash className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  Delete Permanently?
                </h3>
                <p className="text-xs text-white/60">
                  This action cannot be undone
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Cancel delete"
              className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <IconClose className="w-4 h-4" />
            </button>
          </div>

          {/* Thumbnail preview snippet */}
          <div className="flex items-center gap-3 p-2.5 rounded-[12px] bg-white/[0.04] border border-white/10">
            <div className="w-20 aspect-video rounded-[8px] overflow-hidden bg-black/40 shrink-0 border border-white/5 flex items-center justify-center">
              {safeImgSrc && !imgFailed ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={safeImgSrc}
                  alt={item.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                  onError={() => setImgFailed(true)}
                />
              ) : (
                <ImageOff className="w-4 h-4 text-white/30" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-white truncate">
                {item.title}
              </p>
              <p className="text-[11px] text-white/60 truncate">
                {item.creator || 'Creator'} • {item.niche}
              </p>
            </div>
          </div>

          {/* Warning text */}
          <p className="text-xs text-white/70 leading-relaxed">
            Are you sure you want to permanently delete this thumbnail? It will be removed immediately from your database, Cloudflare storage bucket, and feed.
          </p>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-white/70 hover:text-white hover:bg-white/10 rounded-[10px] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              id="confirm-delete-action-btn"
              type="button"
              onClick={handleConfirm}
              className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-500 active:scale-[0.97] rounded-[10px] transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
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
