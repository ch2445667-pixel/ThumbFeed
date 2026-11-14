'use client';

import React, { useRef, useEffect } from 'react';
import {
  Search,
  X,
  ZoomIn,
  ZoomOut,
  Shuffle,
  Menu
} from 'lucide-react';

interface AppHeaderProps {
  query: string;
  onQueryChange: (q: string) => void;
  resultCount: number;
  selectedNiche?: string;
  columns: number;
  onColumnsChange: (cols: number) => void;
  showCardInfo: boolean;
  onToggleCardInfo: (val?: boolean) => void;
  onShuffle?: () => void;
  isSidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  query,
  onQueryChange,
  resultCount,
  selectedNiche = 'All',
  columns,
  onColumnsChange,
  showCardInfo,
  onToggleCardInfo,
  onShuffle,
  isSidebarCollapsed = false,
  onToggleSidebar,
}) => {
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Global Ctrl+K / Cmd+K shortcut to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleZoomIn = () => {
    if (columns > 2) onColumnsChange(columns - 1);
  };

  const handleZoomOut = () => {
    if (columns < 6) onColumnsChange(columns + 1);
  };

  return (
    <header className="sticky top-0 z-30 h-14 bg-[#090a0d]/85 backdrop-blur-md border-b border-white/[0.06] flex items-center justify-between gap-2 px-3 sm:px-6 transition-colors select-none">
      
      {/* Left: Mobile menu button only */}
      <div className="flex items-center gap-2 shrink-0">
        {onToggleSidebar && (
          <button
            type="button"
            onClick={onToggleSidebar}
            aria-label="Toggle sidebar"
            className="p-1.5 rounded-md text-white/60 hover:text-white hover:bg-white/[0.06] transition-colors md:hidden"
          >
            <Menu className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Center: Search Capsule */}
      <div className="flex-1 min-w-0 max-w-md sm:mx-4">
        <div className="relative flex items-center h-9 rounded-lg border border-white/[0.08] bg-white/[0.03] hover:border-white/[0.14] focus-within:border-white/[0.22] focus-within:bg-white/[0.05] transition-all px-2.5 sm:px-3">
          <Search className="w-3.5 h-3.5 text-white/40 shrink-0 mr-2" />
          <input
            ref={searchInputRef}
            type="text"
            role="searchbox"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search topics, creators, hooks..."
            spellCheck={false}
            className="w-full min-w-0 bg-transparent text-xs text-white placeholder:text-white/35 outline-none"
          />

          {query ? (
            <button
              type="button"
              onClick={() => onQueryChange('')}
              aria-label="Clear search"
              className="p-1 rounded text-white/40 hover:text-white transition-colors shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : (
            <kbd className="hidden lg:inline-flex items-center gap-0.5 rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 font-mono text-[10px] text-white/40 shrink-0">
              <span className="text-[9px]">⌘</span>K
            </kbd>
          )}
        </div>
      </div>

      {/* Right: Actions (+ / - Zoom Stepper, Shuffle, Expanding Detail/Gallery Toggle) */}
      <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
        
        {/* Sleek Zoom In / Zoom Out Slider with 14px radius (multi-column grids apply sm+ only) */}
        <div className="hidden sm:flex items-center gap-1.5 sm:gap-2 rounded-[14px] border border-white/[0.08] bg-white/[0.03] px-2.5 h-9 select-none">
          <button
            type="button"
            onClick={handleZoomOut}
            disabled={columns >= 6}
            className="w-5 h-5 flex items-center justify-center text-white/40 hover:text-white disabled:opacity-20 transition-colors cursor-pointer"
            title="Zoom out (more columns)"
            aria-label="Zoom out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>

          <input
            type="range"
            min="2"
            max="6"
            step="1"
            value={8 - columns}
            onChange={(e) => onColumnsChange(8 - Number(e.target.value))}
            className="zoom-range-slider w-16 sm:w-20 h-1 bg-white/10 accent-white rounded-lg cursor-pointer outline-none"
            title={`${columns} columns`}
            aria-label="Adjust zoom slider"
          />

          <button
            type="button"
            onClick={handleZoomIn}
            disabled={columns <= 2}
            className="w-5 h-5 flex items-center justify-center text-white/40 hover:text-white disabled:opacity-20 transition-colors cursor-pointer"
            title="Zoom in (fewer columns)"
            aria-label="Zoom in"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Shuffle Feed Order Button */}
        {onShuffle && (
          <button
            type="button"
            onClick={onShuffle}
            className="h-9 w-9 rounded-[14px] border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.08] hover:border-white/20 text-white/60 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            title="Shuffle Feed Order"
            aria-label="Shuffle feed"
          >
            <Shuffle className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Expanding Toggle (from expanding-toggle.html) */}
        <div className="expanding-toggle">
          {/* Gallery Button (Thumbnail only) */}
          <button
            type="button"
            className={!showCardInfo ? 'active' : ''}
            onClick={() => onToggleCardInfo(false)}
            title="Gallery view (clean thumbnails only)"
          >
            <svg
              className="w-[15px] h-[15px] stroke-current fill-none stroke-[1.7] stroke-linecap-round stroke-linejoin-round shrink-0"
              viewBox="0 0 24 24"
            >
              <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
              <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
              <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
              <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
            </svg>
            <span className="toggle-label font-medium">Gallery</span>
          </button>

          {/* Detail Button (Thumbnail + Title + Channel Info) */}
          <button
            type="button"
            className={showCardInfo ? 'active' : ''}
            onClick={() => onToggleCardInfo(true)}
            title="Detail view (with video titles & creators)"
          >
            <svg
              className="w-[15px] h-[15px] stroke-current fill-none stroke-[1.7] stroke-linecap-round stroke-linejoin-round shrink-0"
              viewBox="0 0 24 24"
            >
              <rect x="3" y="3" width="18" height="18" rx="3" />
              <path d="M12 3v18M3 12h18" />
            </svg>
            <span className="toggle-label font-medium">Detail</span>
          </button>
        </div>

      </div>
    </header>
  );
};
