'use client';

import React, { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { IconSearch, IconClose } from './icons/AppIcons';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  query: string;
  onQueryChange: (q: string) => void;
  filteredCount: number;
}

export const SearchModal: React.FC<SearchModalProps> = ({
  isOpen,
  onClose,
  query,
  onQueryChange,
  filteredCount
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-md"
            onClick={onClose}
          />

          <motion.div
            initial={{ opacity: 0, y: -16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.96 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-2xl bg-[#FFFFFF] dark:bg-[#401D1A] rounded-[15px] shadow-[var(--shadow-dock)] overflow-hidden z-10 border border-[#401D1A]/15 dark:border-[#E4E0D3]/20 p-4 sm:p-5 space-y-4 gpu-layer"
          >
            {/* Search Input Bar */}
            <div className="relative flex items-center">
              <IconSearch className="absolute left-4 w-5 h-5 text-[#401D1A] dark:text-[#E4E0D3]" />
              <input
                ref={inputRef}
                type="text"
                placeholder="Search by topic, creator (MrBeast), hook, or text..."
                value={query}
                onChange={(e) => onQueryChange(e.target.value)}
                className="w-full pl-12 pr-12 py-3.5 bg-[#E4E0D3]/40 dark:bg-[#401D1A] border border-[#401D1A]/20 dark:border-[#E4E0D3]/30 rounded-[12px] text-sm text-[#401D1A] dark:text-[#FFFFFF] placeholder-[#401D1A]/50 dark:placeholder-[#E4E0D3]/50 focus:outline-none focus:bg-[#FFFFFF] dark:focus:bg-[#401D1A] focus:border-[#401D1A] dark:focus:border-[#E4E0D3] focus:ring-2 focus:ring-[#401D1A]/15 dark:focus:ring-[#E4E0D3]/20 transition-all font-medium"
              />
              {query ? (
                <button
                  onClick={() => onQueryChange('')}
                  className="absolute right-4 p-1 rounded-[8px] text-[#401D1A]/60 hover:text-[#401D1A] dark:text-[#E4E0D3]/70 dark:hover:text-[#FFFFFF] active:scale-95 transition-all flex items-center justify-center cursor-pointer"
                >
                  <IconClose className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={onClose}
                  className="absolute right-4 px-2 py-0.5 rounded-[6px] text-[11px] font-mono text-[#401D1A]/60 dark:text-[#E4E0D3]/70 bg-[#E4E0D3]/50 dark:bg-[#FFFFFF]/10 border border-[#401D1A]/15 dark:border-[#E4E0D3]/25 cursor-pointer"
                >
                  ESC
                </button>
              )}
            </div>

            {/* Quick Search Chips */}
            <div className="flex items-center gap-2 pt-0.5 px-1 text-xs">
              <span className="text-[#401D1A]/70 dark:text-[#E4E0D3]/70 font-medium shrink-0">Suggestions:</span>
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                {['$1 vs $1,000,000', 'Minecraft', 'Apple', 'Crypto', 'Gymnast'].map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      onQueryChange(s);
                      onClose();
                    }}
                    className="px-2.5 py-1 rounded-[8px] bg-[#E4E0D3]/50 dark:bg-[#FFFFFF]/10 text-[#401D1A] dark:text-[#E4E0D3] hover:bg-[#401D1A] hover:text-[#FFFFFF] dark:hover:bg-[#E4E0D3] dark:hover:text-[#401D1A] border border-[#401D1A]/15 dark:border-[#E4E0D3]/25 active:scale-[0.96] transition-all whitespace-nowrap font-medium cursor-pointer"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Result Indicator */}
            <div className="flex items-center justify-between pt-2 px-1 text-xs text-[#401D1A]/70 dark:text-[#E4E0D3]/70 border-t border-[#401D1A]/10 dark:border-[#E4E0D3]/15">
              <span>{filteredCount} matching thumbnails</span>
              <button
                onClick={onClose}
                className="font-bold text-[#401D1A] dark:text-[#E4E0D3] hover:underline active:scale-[0.96] transition-all flex items-center gap-1 cursor-pointer"
              >
                <span>Apply & View Grid</span>
                <span>&rarr;</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};



