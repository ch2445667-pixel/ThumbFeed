'use client';

import React from 'react';
import { Search, Sparkles, X, SlidersHorizontal, ArrowUpDown } from 'lucide-react';
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
  { name: 'Deep Mahogany', hex: '#401D1A' },
  { name: 'Warm Cream', hex: '#E4E0D3' },
  { name: 'Pure White', hex: '#FFFFFF' }
];

interface FilterBarProps {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  totalCount: number;
  filteredCount: number;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  filters,
  onChange,
  totalCount,
  filteredCount
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
    filters.selectedColor !== null ||
    filters.selectedEmotion !== null;

  const clearAllFilters = () => {
    onChange({
      searchQuery: '',
      selectedNiche: 'All',
      selectedStyles: [],
      selectedColor: null,
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
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#401D1A]/50 dark:text-[#E4E0D3]/50" />
          <input
            type="text"
            placeholder="Search thumbnails by keyword, creator, hook, or text on image (e.g. 'MrBeast', '$1', 'Minecraft')..."
            value={filters.searchQuery}
            onChange={(e) => onChange({ ...filters, searchQuery: e.target.value })}
            className="w-full pl-10 pr-4 py-2.5 bg-[#FFFFFF] dark:bg-[#401D1A] border border-[#401D1A]/15 dark:border-[#E4E0D3]/20 rounded-xl text-sm text-[#401D1A] dark:text-[#FFFFFF] placeholder-[#401D1A]/50 dark:placeholder-[#E4E0D3]/50 focus:outline-none focus:border-[#401D1A] dark:focus:border-[#E4E0D3] transition-all"
          />
          {filters.searchQuery && (
            <button
              onClick={() => onChange({ ...filters, searchQuery: '' })}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#401D1A]/60 dark:text-[#E4E0D3]/60 hover:text-[#401D1A] dark:hover:text-[#FFFFFF]"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Sort & Count Controls */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <div className="flex items-center gap-1.5 px-3 py-2 bg-[#FFFFFF] dark:bg-[#401D1A] border border-[#401D1A]/15 dark:border-[#E4E0D3]/20 rounded-xl text-xs text-[#401D1A] dark:text-[#E4E0D3]">
            <ArrowUpDown className="w-3.5 h-3.5 text-[#401D1A] dark:text-[#E4E0D3]" />
            <select
              value={filters.sortBy}
              onChange={(e) => onChange({ ...filters, sortBy: e.target.value as any })}
              className="bg-transparent text-[#401D1A] dark:text-[#E4E0D3] focus:outline-none cursor-pointer text-xs"
            >
              <option value="latest" className="bg-[#FFFFFF] dark:bg-[#401D1A] text-[#401D1A] dark:text-[#E4E0D3]">Latest Added</option>
              <option value="popular" className="bg-[#FFFFFF] dark:bg-[#401D1A] text-[#401D1A] dark:text-[#E4E0D3]">Most Liked / Saved</option>
              <option value="random" className="bg-[#FFFFFF] dark:bg-[#401D1A] text-[#401D1A] dark:text-[#E4E0D3]">Inspire Me (Shuffle)</option>
            </select>
          </div>

          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-medium text-[#401D1A] dark:text-[#E4E0D3] bg-[#401D1A]/10 dark:bg-[#E4E0D3]/20 border border-[#401D1A]/20 dark:border-[#E4E0D3]/30 transition-colors"
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
                  ? 'bg-[#401D1A] text-[#FFFFFF] dark:bg-[#E4E0D3] dark:text-[#401D1A] shadow-xs'
                  : 'bg-[#FFFFFF] dark:bg-[#401D1A] text-[#401D1A]/70 dark:text-[#E4E0D3]/70 hover:text-[#401D1A] dark:hover:text-[#FFFFFF] border border-[#401D1A]/15 dark:border-[#E4E0D3]/20'
              }`}
            >
              {niche}
            </button>
          );
        })}
      </div>

      {/* Visual Style & Color Swatches Secondary Row */}
      <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-[#401D1A]/10 dark:border-[#E4E0D3]/15">
        
        <span className="text-xs text-[#401D1A]/70 dark:text-[#E4E0D3]/70 font-medium flex items-center gap-1 mr-1">
          <SlidersHorizontal className="w-3 h-3 text-[#401D1A] dark:text-[#E4E0D3]" />
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
                  ? 'bg-[#401D1A] text-[#FFFFFF] dark:bg-[#E4E0D3] dark:text-[#401D1A] border border-[#401D1A] dark:border-[#E4E0D3]'
                  : 'bg-[#FFFFFF] dark:bg-[#401D1A] text-[#401D1A]/70 dark:text-[#E4E0D3]/70 border border-[#401D1A]/15 dark:border-[#E4E0D3]/20'
              }`}
            >
              {style}
            </button>
          );
        })}

        {/* Color Palette Filter Dots */}
        <div className="flex items-center gap-1.5 ml-auto pl-2 border-l border-[#401D1A]/15 dark:border-[#E4E0D3]/20">
          <span className="text-[11px] text-[#401D1A]/70 dark:text-[#E4E0D3]/70 mr-1 hidden sm:inline">Color:</span>
          {COLOR_PALETTES.map((color) => {
            const isSelected = filters.selectedColor === color.hex;
            return (
              <button
                key={color.hex}
                title={color.name}
                onClick={() => onChange({
                  ...filters,
                  selectedColor: isSelected ? null : color.hex
                })}
                style={{ backgroundColor: color.hex }}
                className={`w-4 h-4 rounded-full border border-[#401D1A]/20 transition-transform ${
                  isSelected ? 'scale-125 ring-2 ring-[#401D1A] dark:ring-[#E4E0D3] ring-offset-2' : 'hover:scale-110 opacity-80 hover:opacity-100'
                }`}
              />
            );
          })}
          {filters.selectedColor && (
            <button
              onClick={() => onChange({ ...filters, selectedColor: null })}
              className="text-[10px] text-[#401D1A]/70 dark:text-[#E4E0D3]/70 hover:text-[#401D1A] dark:hover:text-[#FFFFFF] underline ml-1"
            >
              Clear
            </button>
          )}
        </div>

      </div>

      {/* Result Count Indicator */}
      <div className="flex items-center justify-between text-xs text-[#401D1A]/70 dark:text-[#E4E0D3]/70 pt-1">
        <span>
          Showing <strong className="text-[#401D1A] dark:text-[#FFFFFF]">{filteredCount}</strong> of {totalCount} inspiration thumbnails
        </span>
        {hasActiveFilters && (
          <span className="text-[#401D1A] dark:text-[#E4E0D3] font-medium flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> Filters active
          </span>
        )}
      </div>

    </div>
  );
};
