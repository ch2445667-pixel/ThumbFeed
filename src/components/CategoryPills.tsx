'use client';

import React from 'react';
import { NicheCategory } from '../lib/types';

export const CATEGORIES: (NicheCategory | 'All')[] = [
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

interface CategoryPillsProps {
  selectedCategory: NicheCategory | 'All';
  onSelectCategory: (category: NicheCategory | 'All') => void;
  categoryCounts?: Record<string, number>;
}

export const CategoryPills: React.FC<CategoryPillsProps> = ({
  selectedCategory,
  onSelectCategory,
  categoryCounts = {}
}) => {
  return (
    <div className="w-full bg-[#fbfbfb]/90 backdrop-blur-md border-b border-gray-200/70 sticky top-16 z-20 px-6 sm:px-10 py-3">
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth">
        {CATEGORIES.map((cat) => {
          const isSelected = selectedCategory === cat;
          const count = categoryCounts[cat];

          return (
            <button
              key={cat}
              id={`category-pill-${cat.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
              onClick={() => onSelectCategory(cat)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-150 shrink-0 select-none ${
                isSelected
                  ? 'bg-gray-950 text-white shadow-xs scale-[1.02]'
                  : 'bg-white text-gray-600 hover:text-gray-950 border border-gray-200/90 hover:border-gray-300 hover:bg-gray-50/80 shadow-2xs'
              }`}
            >
              <span>{cat}</span>
              {count !== undefined && count > 0 && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-medium ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
