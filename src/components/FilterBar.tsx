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
  'Educational'
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
  { name: 'Red', hex: '#ef4444' },
  { name: 'Yellow / Gold', hex: '#eab308' },
  { name: 'Neon Green', hex: '#10b981' },
  { name: 'Cyan / Blue', hex: '#06b6d4' },
  { name: 'Purple / Pink', hex: '#a855f7' },
  { name: 'Dark / Slate', hex: '#0f172a' }
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
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search thumbnails by keyword, creator, hook, or text on image (e.g. 'MrBeast', '$1', 'Minecraft')..."
            value={filters.searchQuery}
            onChange={(e) => onChange({ ...filters, searchQuery: e.target.value })}
            className="w-full pl-10 pr-4 py-2.5 bg-surface border border-border rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
          />
          {filters.searchQuery && (
            <button
              onClick={() => onChange({ ...filters, searchQuery: '' })}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Sort & Count Controls */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <div className="flex items-center gap-1.5 px-3 py-2 bg-surface border border-border rounded-xl text-xs text-gray-300">
            <ArrowUpDown className="w-3.5 h-3.5 text-indigo-400" />
            <select
              value={filters.sortBy}
              onChange={(e) => onChange({ ...filters, sortBy: e.target.value as any })}
              className="bg-transparent text-gray-200 focus:outline-none cursor-pointer text-xs"
            >
              <option value="latest" className="bg-surface text-gray-200">Latest Added</option>
              <option value="popular" className="bg-surface text-gray-200">Most Liked / Saved</option>
              <option value="random" className="bg-surface text-gray-200">Inspire Me (Shuffle)</option>
            </select>
          </div>

          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-medium text-rose-400 hover:bg-rose-500/10 border border-rose-500/20 transition-colors"
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
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                  : 'bg-surface/80 text-gray-400 hover:text-gray-200 hover:bg-surfaceHover border border-border/60'
              }`}
            >
              {niche}
            </button>
          );
        })}
      </div>

      {/* Visual Style & Color Swatches Secondary Row */}
      <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border/40">
        
        <span className="text-xs text-gray-500 font-medium flex items-center gap-1 mr-1">
          <SlidersHorizontal className="w-3 h-3 text-indigo-400" />
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
                  ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                  : 'bg-surface/60 text-gray-400 hover:text-gray-200 border border-border/40 hover:border-gray-700'
              }`}
            >
              {style}
            </button>
          );
        })}

        {/* Color Palette Filter Dots */}
        <div className="flex items-center gap-1.5 ml-auto pl-2 border-l border-border/60">
          <span className="text-[11px] text-gray-500 mr-1 hidden sm:inline">Color:</span>
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
                className={`w-4 h-4 rounded-full transition-transform ${
                  isSelected ? 'scale-125 ring-2 ring-white ring-offset-2 ring-offset-background' : 'hover:scale-110 opacity-80 hover:opacity-100'
                }`}
              />
            );
          })}
          {filters.selectedColor && (
            <button
              onClick={() => onChange({ ...filters, selectedColor: null })}
              className="text-[10px] text-gray-400 hover:text-white underline ml-1"
            >
              Clear
            </button>
          )}
        </div>

      </div>

      {/* Result Count Indicator */}
      <div className="flex items-center justify-between text-xs text-gray-500 pt-1">
        <span>
          Showing <strong className="text-gray-300">{filteredCount}</strong> of {totalCount} inspiration thumbnails
        </span>
        {hasActiveFilters && (
          <span className="text-indigo-400 font-medium flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> Filters active
          </span>
        )}
      </div>

    </div>
  );
};
