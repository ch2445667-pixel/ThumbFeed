'use client';

import React from 'react';
import { LayoutGrid, Image as ImageIcon } from 'lucide-react';

interface ViewModeToggleProps {
  isDetail: boolean;
  onToggle: () => void;
  className?: string;
}

export const ViewModeToggle: React.FC<ViewModeToggleProps> = ({
  isDetail,
  onToggle,
  className = '',
}) => {
  return (
    <div
      role="group"
      aria-label="Thumbnail Display Mode"
      className={`relative inline-flex items-center p-1 rounded-2xl bg-[#141215]/80 dark:bg-[#121114]/90 backdrop-blur-md border border-white/10 dark:border-white/10 shadow-[inset_0_1px_2px_rgba(0,0,0,0.6),0_2px_8px_rgba(0,0,0,0.25)] select-none transition-all ${className}`}
    >
      {/* Detail Button */}
      <button
        type="button"
        onClick={() => {
          if (!isDetail) onToggle();
        }}
        className={`relative flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer active:scale-95 ${
          isDetail
            ? 'bg-gradient-to-b from-[#28262C] to-[#1C1A20] text-white shadow-[0_2px_8px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.18)] border border-white/12'
            : 'text-neutral-400 hover:text-neutral-200 bg-transparent border border-transparent'
        }`}
      >
        <LayoutGrid
          className={`w-3.5 h-3.5 sm:w-4 sm:h-4 transition-colors ${
            isDetail ? 'text-[#FF4A4A]' : 'text-neutral-400'
          }`}
        />
        <span>Detail</span>
      </button>

      {/* Gallery Button */}
      <button
        type="button"
        onClick={() => {
          if (isDetail) onToggle();
        }}
        className={`relative flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer active:scale-95 ${
          !isDetail
            ? 'bg-gradient-to-b from-[#28262C] to-[#1C1A20] text-white shadow-[0_2px_8px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.18)] border border-white/12'
            : 'text-neutral-400 hover:text-neutral-200 bg-transparent border border-transparent'
        }`}
      >
        <ImageIcon
          className={`w-3.5 h-3.5 sm:w-4 sm:h-4 transition-colors ${
            !isDetail ? 'text-white' : 'text-neutral-400'
          }`}
        />
        <span>Gallery</span>
      </button>
    </div>
  );
};

export default ViewModeToggle;
