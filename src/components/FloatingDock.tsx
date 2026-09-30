'use client';

import React from 'react';
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

/* Plain buttons with CSS feedback. The previous version wrapped every control
   in framer-motion, which ran JS-driven transforms on each render of a
   component that re-renders with the page. A press scale via CSS costs a
   single composited frame. */
const BTN =
  'grid h-8 w-8 cursor-pointer place-items-center rounded-sm text-accent-on-dim transition-[background-color,color,transform] duration-150 ease-fluid hover:bg-accent-veil hover:text-accent-on active:scale-90 motion-reduce:transition-none motion-reduce:active:scale-100';

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
    <div className="pointer-events-none fixed inset-x-0 bottom-5 z-40 flex justify-center px-4">
      <nav
        aria-label="Gallery controls"
        className="floating-dock animate-fade-blur pointer-events-auto flex select-none items-center gap-1 rounded-lg px-2 py-1.5"
      >
        <button
          onClick={handleScrollToTop}
          title="Back to top"
          aria-label="Back to top"
          className={BTN}
        >
          <IconArrowUp className="h-4 w-4" />
        </button>

        <div className="mx-0.5 h-4 w-px bg-accent-on-line" />

        {/* Zoom. The column count is tabular so it does not jitter as it moves. */}
        <div className="flex items-center gap-1 px-0.5">
          <button
            onClick={() => onColumnsChange(Math.max(3, columns - 1))}
            disabled={columns <= 3}
            aria-label="Fewer columns"
            title="Fewer columns"
            className="grid h-7 w-7 cursor-pointer place-items-center rounded-sm text-accent-on-dim transition-[background-color,color,transform] duration-150 ease-fluid hover:bg-accent-veil hover:text-accent-on active:scale-90 disabled:pointer-events-none disabled:opacity-35 motion-reduce:transition-none"
          >
            <IconPlus className="h-3.5 w-3.5" />
          </button>

          <input
            type="range"
            min="3"
            max="6"
            step="1"
            value={columns}
            onChange={(e) => onColumnsChange(parseInt(e.target.value))}
            className="custom-slider w-16 cursor-pointer sm:w-20"
            title={`${columns} columns`}
            aria-label={`Grid density, ${columns} columns`}
          />

          <button
            onClick={() => onColumnsChange(Math.min(6, columns + 1))}
            disabled={columns >= 6}
            aria-label="More columns"
            title="More columns"
            className="grid h-7 w-7 cursor-pointer place-items-center rounded-sm text-accent-on-dim transition-[background-color,color,transform] duration-150 ease-fluid hover:bg-accent-veil hover:text-accent-on active:scale-90 disabled:pointer-events-none disabled:opacity-35 motion-reduce:transition-none"
          >
            <IconMinus className="h-3.5 w-3.5" />
          </button>

          <span className="mono w-4 text-center text-[11px] text-accent-on-dim">
            {columns}
          </span>
        </div>

        <div className="mx-0.5 h-4 w-px bg-accent-on-line" />

        <button
          onClick={onToggleFilter}
          aria-expanded={hasActiveFilters}
          className={`flex cursor-pointer items-center gap-1.5 rounded-sm px-2.5 py-1.5 text-xs font-medium transition-[background-color,color,transform] duration-150 ease-fluid active:scale-95 motion-reduce:transition-none ${
            hasActiveFilters
              ? 'bg-accent-on text-accent'
              : 'text-accent-on-dim hover:bg-accent-veil hover:text-accent-on'
          }`}
        >
          <IconFilter className="h-3.5 w-3.5" />
          <span>Filter</span>
        </button>

        <button
          onClick={onShuffle}
          title="Shuffle"
          aria-label="Shuffle gallery"
          className={BTN}
        >
          <IconShuffle className="h-4 w-4" />
        </button>

        {onOpenAdd && (
          <button
            onClick={onOpenAdd}
            className="ml-0.5 flex cursor-pointer items-center gap-1.5 rounded-sm bg-accent-on px-3 py-1.5 text-xs font-medium text-accent transition-[opacity,transform] duration-150 ease-fluid hover:opacity-90 active:scale-95 motion-reduce:transition-none"
          >
            <IconPlus className="h-3.5 w-3.5" />
            <span>Add</span>
          </button>
        )}
      </nav>
    </div>
  );
};
