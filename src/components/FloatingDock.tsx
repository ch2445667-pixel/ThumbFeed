'use client';

import React from 'react';
import { motion } from 'framer-motion';
import {
  IconArrowUp,
  IconFilter,
  IconShuffle,
  IconPlus,
  IconMinus
} from './icons/AppIcons';

interface FloatingDockProps {
  columns: number;
  onColumnsChange: (cols: number) => void;
  onScrollToTop?: () => void;
  onToggleFilter: () => void;
  hasActiveFilters: boolean;
  onShuffle: () => void;
  onOpenAdd?: () => void;
}

export const FloatingDock: React.FC<FloatingDockProps> = ({
  columns,
  onColumnsChange,
  onScrollToTop,
  onToggleFilter,
  hasActiveFilters,
  onShuffle,
  onOpenAdd
}) => {
  const handleScrollToTop = () => {
    if (onScrollToTop) {
      onScrollToTop();
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className="fixed bottom-6 inset-x-0 z-40 flex justify-center px-4 pointer-events-none">
      <motion.nav
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        aria-label="Quick actions"
        className="floating-dock pointer-events-auto flex items-center gap-1.5 sm:gap-2.5 px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-[15px] text-white select-none transition-all duration-200"
      >
        {/* 1. Back to Top Trigger */}
        <motion.button
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          onClick={handleScrollToTop}
          title="Back to Top"
          className="p-2 rounded-[10px] text-white/85 hover:text-white hover:bg-white/20 transition-colors flex items-center justify-center cursor-pointer"
        >
          <IconArrowUp className="w-4 h-4" />
        </motion.button>

        {/* Hairline Divider */}
        <div className="w-[0.5px] h-4 bg-white/25 mx-0.5" />

        {/* 2. Grid Size / Columns Zoom Slider */}
        <div className="flex items-center gap-1.5 px-1">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => onColumnsChange(Math.max(3, columns - 1))}
            className="text-white/85 hover:text-white p-1.5 rounded-[8px] hover:bg-white/20 transition-colors flex items-center justify-center cursor-pointer"
            title="Zoom In (Fewer columns)"
          >
            <IconPlus className="w-3.5 h-3.5" />
          </motion.button>

          <input
            type="range"
            min="3"
            max="6"
            step="1"
            value={columns}
            onChange={(e) => onColumnsChange(parseInt(e.target.value))}
            className="custom-slider w-16 sm:w-20 cursor-pointer"
            title={`Display ${columns} columns`}
          />

          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => onColumnsChange(Math.min(6, columns + 1))}
            className="text-white/85 hover:text-white p-1.5 rounded-[8px] hover:bg-white/20 transition-colors flex items-center justify-center cursor-pointer"
            title="Zoom Out (More columns)"
          >
            <IconMinus className="w-3.5 h-3.5" />
          </motion.button>
        </div>

        {/* Hairline Divider */}
        <div className="w-[0.5px] h-4 bg-white/25 mx-0.5" />

        {/* 3. Filter Button */}
        <motion.button
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.95 }}
          onClick={onToggleFilter}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-xs font-semibold transition-colors cursor-pointer ${
            hasActiveFilters
              ? 'bg-[#FFFFFF] text-[#401D1A] shadow-xs'
              : 'text-[#FFFFFF]/90 hover:text-[#FFFFFF] hover:bg-[#FFFFFF]/20'
          }`}
        >
          <IconFilter className="w-3.5 h-3.5" />
          <span>Filter</span>
        </motion.button>

        {/* 4. Shuffle / Randomize Button */}
        <motion.button
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92, rotate: 180 }}
          transition={{ duration: 0.25 }}
          onClick={onShuffle}
          title="Shuffle Inspiration"
          className="p-2 rounded-[10px] text-[#FFFFFF]/85 hover:text-[#FFFFFF] hover:bg-[#FFFFFF]/20 transition-colors flex items-center justify-center cursor-pointer"
        >
          <IconShuffle className="w-4 h-4" />
        </motion.button>

        {/* 5. + Add Button (Only visible when onOpenAdd is provided) */}
        {onOpenAdd && (
          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.95 }}
            onClick={onOpenAdd}
            className="flex items-center gap-1.5 pl-3 pr-4 py-1.5 rounded-[8px] border border-[#401D1A]/20 text-xs font-bold text-[#401D1A] bg-[#FFFFFF] hover:bg-[#E4E0D3] transition-colors shadow-xs cursor-pointer"
          >
            <IconPlus className="w-3.5 h-3.5 text-[#401D1A]" />
            <span>Add</span>
          </motion.button>
        )}
      </motion.nav>
    </div>
  );
};




