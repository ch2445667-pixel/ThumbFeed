'use client';

import React from 'react';
import { Search, Sparkles, X, SlidersHorizontal, ArrowUpDown } from 'lucide-react';
import { ViewModeToggle } from './ViewModeToggle';
import { NicheCategory, VisualStyle, FilterState } from '../lib/types';

const NICHES: (NicheCategory | 'All')[] = [
  'All',
  'IRL',
  'Business',
  'Tech',
  'Entertainment',
  'Gaming',
  'Sports',
  'Documentary',
  'Educational',
  'Podcast',
  'Interviews',
  'Football',
  'Mindset',
  'Self-Improvement',
  'Lifestyle',
  'Entrepreneurship',
  'Geopolitics',
  'Military',
  'Nfl',
  'Psychology',
  'Soccer',
  'Video Games',
  'Vlog',
  'War'
];

const VISUAL_STYLES: VisualStyle[] = [
  'Face Close-up',
  '3D Render / CGI',
  'Illustrated / Anime',
  'Minimalist & Clean',
  'Split Screen / Before-After',
  'Text-Heavy / Typography',
  'No-Text / Visual Hook',
  'High-Contrast Glow'
];

const COLOR_PALETTES = [
  { name: 'Deep Maroon', hex: '#411C1A' },
  { name: 'Warm Beige', hex: '#E4E1D2' },
  { name: 'Pure White', hex: '#FFFFFF' }
];

interface FilterBarProps {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  totalCount: number;
  filteredCount: number;
  showCardInfo?: boolean;
  onToggleCardInfo?: () => void;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  filters,
  onChange,
  totalCount,
  filteredCount,
  showCardInfo = false,
  onToggleCardInfo
}) => {
  const toggleStyle = (style: VisualStyle) => {
    const exists = filters.selectedStyles.includes(style);
    const updated = exists
      ? filters.selectedStyles.filter(s => s !== style)
      : [...filters.selectedStyles, style];
    onChange({ ...filters, selectedStyles: updated });
  };

  const hasActiveFilters = 
    filters.searchQuery !== '' ||
    filters.selectedNiche !== 'All' ||
    filters.selectedStyles.length > 0 ||
    filters.selectedColors.length > 0 ||
    filters.selectedEmotion !== null;

  const clearAllFilters = () => {
    onChange({
      searchQuery: '',
      selectedNiche: 'All',
      selectedStyles: [],
      selectedColors: [],
      selectedEmotion: null,
      sortBy: 'latest'
    });
  };

  return (
    <div className="w-full space-y-4">
      
      {/* Top Bar: Search Input + Sorting */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        
        {/* Live Search Box */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#0d0e10]/50 dark:text-[#D6D1BC]/50" />
          <input
            type="text"
            placeholder="Search thumbnails by keyword, creator, hook, or text on image (e.g. 'MrBeast', '$1', 'Minecraft')..."
            value={filters.searchQuery}
            onChange={(e) => onChange({ ...filters, searchQuery: e.target.value })}
            className="w-full pl-10 pr-4 py-2.5 bg-[#D6D1BC] dark:bg-[#1E1B1A] border border-[#0d0e10]/15 dark:border-[#D6D1BC]/20 rounded-xl text-sm text-[#0d0e10] dark:text-[#D6D1BC] placeholder-[#0d0e10]/50 dark:placeholder-[#D6D1BC]/50 focus:outline-none focus:border-[#0d0e10] dark:focus:border-[#D6D1BC] transition-all"
          />
          {filters.searchQuery && (
            <button
              onClick={() => onChange({ ...filters, searchQuery: '' })}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#0d0e10]/60 dark:text-[#D6D1BC]/60 hover:text-[#0d0e10] dark:hover:text-[#D6D1BC]"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Sort & Count Controls */}
        <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
          {/* View Mode Toggle: Detail vs Gallery (Exact replica of Image 1) */}
          {onToggleCardInfo && (
            <ViewModeToggle
              isDetail={!!showCardInfo}
              onToggle={onToggleCardInfo}
            />
          )}

          <div className="flex items-center gap-1.5 px-3 py-2 bg-[#D6D1BC] dark:bg-[#1E1B1A] border border-[#0d0e10]/15 dark:border-[#D6D1BC]/20 rounded-xl text-xs text-[#0d0e10] dark:text-[#D6D1BC]">
            <ArrowUpDown className="w-3.5 h-3.5 text-[#0d0e10] dark:text-[#D6D1BC]" />
            <select
              value={filters.sortBy}
              onChange={(e) => onChange({ ...filters, sortBy: e.target.value as any })}
              className="bg-transparent text-[#0d0e10] dark:text-[#D6D1BC] focus:outline-none cursor-pointer text-xs"
            >
              <option value="latest" className="bg-[#D6D1BC] dark:bg-[#1E1B1A] text-[#0d0e10] dark:text-[#D6D1BC]">Latest Added</option>
              <option value="popular" className="bg-[#D6D1BC] dark:bg-[#1E1B1A] text-[#0d0e10] dark:text-[#D6D1BC]">Most Liked / Saved</option>
              <option value="random" className="bg-[#D6D1BC] dark:bg-[#1E1B1A] text-[#0d0e10] dark:text-[#D6D1BC]">Inspire Me (Shuffle)</option>
            </select>
          </div>

          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-medium text-[#0d0e10] dark:text-[#D6D1BC] bg-[#411C1A]/10 dark:bg-[#411C1A]/20 border border-[#0d0e10]/20 dark:border-[#D6D1BC]/30 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Niche Tabs Horizontal Scroll */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {NICHES.map((niche) => {
          const isActive = filters.selectedNiche === niche;
          return (
            <button
              key={niche}
              onClick={() => onChange({ ...filters, selectedNiche: niche })}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all duration-200 ${
                isActive
                  ? 'bg-[#411C1A] text-[#0d0e10] dark:bg-[#411C1A] dark:text-[#0d0e10] shadow-xs'
                  : 'bg-[#D6D1BC] dark:bg-[#1E1B1A] text-[#0d0e10]/70 dark:text-[#D6D1BC]/70 hover:text-[#0d0e10] dark:hover:text-[#D6D1BC] border border-[#0d0e10]/15 dark:border-[#D6D1BC]/20'
              }`}
            >
              {niche}
            </button>
          );
        })}
      </div>

      {/* Visual Style & Color Swatches Secondary Row */}
      <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-[#0d0e10]/10 dark:border-[#D6D1BC]/15">
        
        <span className="text-xs text-[#0d0e10]/70 dark:text-[#D6D1BC]/70 font-medium flex items-center gap-1 mr-1">
          <SlidersHorizontal className="w-3 h-3 text-[#0d0e10] dark:text-[#D6D1BC]" />
          Style:
        </span>

        {/* Visual Style Pills */}
        {VISUAL_STYLES.map((style) => {
          const isSelected = filters.selectedStyles.includes(style);
          return (
            <button
              key={style}
              onClick={() => toggleStyle(style)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                isSelected
                  ? 'bg-[#411C1A] text-[#0d0e10] dark:bg-[#411C1A] dark:text-[#0d0e10] border border-[#0d0e10] dark:border-[#D6D1BC]'
                  : 'bg-[#D6D1BC] dark:bg-[#1E1B1A] text-[#0d0e10]/70 dark:text-[#D6D1BC]/70 border border-[#0d0e10]/15 dark:border-[#D6D1BC]/20'
              }`}
            >
              {style}
            </button>
          );
        })}

        {/* Color Palette Filter Dots */}
        <div className="flex items-center gap-1.5 ml-auto pl-2 border-l border-[#0d0e10]/15 dark:border-[#D6D1BC]/20">
          <span className="text-[11px] text-[#0d0e10]/70 dark:text-[#D6D1BC]/70 mr-1 hidden sm:inline">Color:</span>
          {COLOR_PALETTES.map((color) => {
            const isSelected = filters.selectedColors.includes(color.hex);
            return (
              <button
                key={color.hex}
                title={color.name}
                onClick={() => onChange({
                  ...filters,
                  selectedColors: isSelected
                    ? filters.selectedColors.filter((c) => c !== color.hex)
                    : [...filters.selectedColors, color.hex]
                })}
                style={{ backgroundColor: color.hex }}
                className={`w-4 h-4 rounded-full border border-[#0d0e10]/20 transition-transform ${
                  isSelected ? 'scale-125 ring-2 ring-[#411C1A] dark:ring-[#411C1A] ring-offset-2' : 'hover:scale-110 opacity-80 hover:opacity-100'
                }`}
              />
            );
          })}
          {filters.selectedColors.length > 0 && (
            <button
              onClick={() => onChange({ ...filters, selectedColors: [] })}
              className="text-[10px] text-[#0d0e10]/70 dark:text-[#D6D1BC]/70 hover:text-[#0d0e10] dark:hover:text-[#D6D1BC] underline ml-1"
            >
              Clear
            </button>
          )}
        </div>

      </div>

      {/* Result Count Indicator */}
      <div className="flex items-center justify-between text-xs text-[#0d0e10]/70 dark:text-[#D6D1BC]/70 pt-1">
        <span>
          Showing <strong className="text-[#0d0e10] dark:text-[#D6D1BC]">{filteredCount}</strong> of {totalCount} inspiration thumbnails
        </span>
        {hasActiveFilters && (
          <span className="text-[#0d0e10] dark:text-[#D6D1BC] font-medium flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> Filters active
          </span>
        )}
      </div>

    </div>
  );
};
