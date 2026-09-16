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
            className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-[15px] shadow-[var(--shadow-dock)] overflow-hidden z-10 border border-gray-100 dark:border-slate-800 p-4 sm:p-5 space-y-4 gpu-layer"
          >
            {/* Search Input Bar */}
            <div className="relative flex items-center">
              <IconSearch className="absolute left-4 w-5 h-5 text-[#009FDF]" />
              <input
                ref={inputRef}
                type="text"
                placeholder="Search by topic, creator (MrBeast), hook, or text..."
                value={query}
                onChange={(e) => onQueryChange(e.target.value)}
                className="w-full pl-12 pr-12 py-3.5 bg-slate-50/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 rounded-[12px] text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:bg-white dark:focus:bg-slate-800 focus:border-[#009FDF] focus:ring-2 focus:ring-[#009FDF]/20 transition-all font-medium"
              />
              {query ? (
                <button
                  onClick={() => onQueryChange('')}
                  className="absolute right-4 p-1 rounded-[8px] text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 active:scale-95 transition-all flex items-center justify-center cursor-pointer"
                >
                  <IconClose className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={onClose}
                  className="absolute right-4 px-2 py-0.5 rounded-[6px] text-[11px] font-mono text-slate-400 bg-slate-100 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 cursor-pointer"
                >
                  ESC
                </button>
              )}
            </div>

            {/* Quick Search Chips */}
            <div className="flex items-center gap-2 pt-0.5 px-1 text-xs">
              <span className="text-slate-400 dark:text-slate-500 font-medium shrink-0">Suggestions:</span>
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                {['$1 vs $1,000,000', 'Minecraft', 'Apple', 'Crypto', 'Gymnast'].map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      onQueryChange(s);
                      onClose();
                    }}
                    className="px-2.5 py-1 rounded-[8px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-[#009FDF]/10 dark:hover:bg-[#009FDF]/20 hover:text-[#009FDF] dark:hover:text-[#38bdf8] border border-slate-200/50 dark:border-slate-700 active:scale-[0.96] transition-all whitespace-nowrap font-medium cursor-pointer"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Result Indicator */}
            <div className="flex items-center justify-between pt-2 px-1 text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800">
              <span>{filteredCount} matching thumbnails</span>
              <button
                onClick={onClose}
                className="font-bold text-[#009FDF] hover:text-[#008bc4] active:scale-[0.96] transition-all flex items-center gap-1 cursor-pointer"
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



