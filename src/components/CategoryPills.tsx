'use client';

import React, { useEffect, useState } from 'react';
import { NicheCategory } from '../lib/types';
import { getCustomCategories, subscribeCategories } from '../lib/categories';

export const DEFAULT_CATEGORIES: (NicheCategory | 'All')[] = [
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
  // Built from the facet counts so every category actually in use is offered.
  // Locally added categories are merged in, since nothing assigns those.
  const [categories, setCategories] = useState<string[]>(['All']);

  useEffect(() => {
    const update = () => {
      const fromData = Object.keys(categoryCounts).filter((c) => c !== 'All');
      const merged = [...fromData];
      for (const c of getCustomCategories()) {
        if (!merged.some((m) => m.toLowerCase() === c.toLowerCase())) merged.push(c);
      }
      setCategories(['All', ...merged]);
    };
    update();
    return subscribeCategories(update);
  }, [categoryCounts]);

  return (
    <div className="w-full bg-[#E6E8EC]/90 dark:bg-[#0d0e10]/90 backdrop-blur-md border-b border-[#0d0e10]/10 dark:border-[#E6E8EC]/15 sticky top-16 z-20 px-6 sm:px-10 py-3">
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
                  ? 'bg-[#0d0e10] text-[#E6E8EC] dark:bg-[#E6E8EC] dark:text-[#0d0e10] shadow-xs scale-[1.02]'
                  : 'bg-[#E6E8EC] text-[#0d0e10]/80 hover:text-[#0d0e10] dark:bg-[#0d0e10] dark:text-[#E6E8EC]/80 dark:hover:text-[#E6E8EC] border border-[#0d0e10]/15 dark:border-[#E6E8EC]/20 hover:border-[#0d0e10]/30 shadow-2xs'
              }`}
            >
              <span>{cat}</span>
              {count !== undefined && count > 0 && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-medium ${
                    isSelected ? 'bg-[#E6E8EC]/20 text-[#E6E8EC] dark:bg-black/20 dark:text-[#0d0e10]' : 'bg-[#E6E8EC]/60 dark:bg-[#E6E8EC]/10 text-[#0d0e10]/70 dark:text-[#E6E8EC]/70'
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
