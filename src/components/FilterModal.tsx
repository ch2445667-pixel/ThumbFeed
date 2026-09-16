'use client';

import React from 'react';
import { X, Filter, RotateCcw } from 'lucide-react';
import { NicheCategory, FilterState } from '../lib/types';

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

interface FilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  onReset: () => void;
  filteredCount: number;
}

export const FilterModal: React.FC<FilterModalProps> = ({
  isOpen,
  onClose,
  filters,
  onChange,
  onReset,
  filteredCount
}) => {
  if (!isOpen) return null;

  const handleSelectNiche = (niche: NicheCategory | 'All') => {
    onChange({
      ...filters,
      selectedNiche: niche
    });
  };

  return (
    <div
      id="filter-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
    >
      {/* Click outside to close */}
      <div className="fixed inset-0" onClick={onClose} />

      {/* Compact Popover Card (Not Full Screen) */}
      <div
        id="compact-niche-filter-card"
        className="relative w-full max-w-sm sm:max-w-md bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden z-10 p-5 space-y-4 animate-in zoom-in-95 duration-150"
      >
        {/* Compact Header */}
        <div className="flex items-center justify-between border-b border-border/80 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Filter className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">Filter by Niche</h3>
              <p className="text-[11px] text-gray-400">{filteredCount} thumbnails</p>
            </div>
          </div>

          <button
            id="filter-close-btn"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-surfaceHover transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Niche Selection Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-2 gap-2">
          {NICHES.map((niche) => {
            const isSelected = filters.selectedNiche === niche;
            return (
              <button
                key={niche}
                id={`filter-niche-${niche.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
                onClick={() => handleSelectNiche(niche)}
                className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all text-left ${
                  isSelected
                    ? 'bg-indigo-600 text-white shadow-md font-semibold'
                    : 'bg-background border border-border/70 text-gray-300 hover:text-white hover:bg-surfaceHover hover:border-border'
                }`}
              >
                <span className="truncate">{niche}</span>
                {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white ml-1 shrink-0" />}
              </button>
            );
          })}
        </div>

        {/* Compact Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-border/80">
          <button
            id="filter-reset-btn"
            onClick={onReset}
            className="flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-white transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset</span>
          </button>

          <button
            id="filter-apply-btn"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition-all shadow-sm"
          >
            Apply ({filteredCount})
          </button>
        </div>
      </div>
    </div>
  );
};
