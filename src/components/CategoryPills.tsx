'use client';

import React, { useEffect, useState } from 'react';
import { NicheCategory } from '../lib/types';
import { getAllCategories, subscribeCategories } from '../lib/categories';

export const DEFAULT_CATEGORIES: (NicheCategory | 'All')[] = [
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
  const [categories, setCategories] = useState<string[]>(['All', ...getAllCategories()]);

  useEffect(() => {
    const update = (cats: string[]) => {
      const set = new Set<string>(['All', ...cats]);
      setCategories(Array.from(set));
    };
    update(getAllCategories());
    return subscribeCategories(update);
  }, []);

  return (
    <div className="w-full bg-[#E4E0D3]/90 dark:bg-[#401D1A]/90 backdrop-blur-md border-b border-[#401D1A]/10 dark:border-[#E4E0D3]/15 sticky top-16 z-20 px-6 sm:px-10 py-3">
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth">
        {categories.map((cat) => {
          const isSelected = selectedCategory === cat;
          const count = categoryCounts[cat];

          return (
            <button
              key={cat}
              id={`category-pill-${cat.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
              onClick={() => onSelectCategory(cat as NicheCategory | 'All')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-150 shrink-0 select-none cursor-pointer ${
                isSelected
                  ? 'bg-[#401D1A] text-[#FFFFFF] dark:bg-[#E4E0D3] dark:text-[#401D1A] shadow-xs scale-[1.02]'
                  : 'bg-[#FFFFFF] text-[#401D1A]/80 hover:text-[#401D1A] dark:bg-[#401D1A] dark:text-[#E4E0D3]/80 dark:hover:text-[#FFFFFF] border border-[#401D1A]/15 dark:border-[#E4E0D3]/20 hover:border-[#401D1A]/30 shadow-2xs'
              }`}
            >
              <span>{cat}</span>
              {count !== undefined && count > 0 && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-medium ${
                    isSelected ? 'bg-white/20 text-white dark:bg-black/20 dark:text-[#401D1A]' : 'bg-[#E4E0D3]/60 dark:bg-[#FFFFFF]/10 text-[#401D1A]/70 dark:text-[#E4E0D3]/70'
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
