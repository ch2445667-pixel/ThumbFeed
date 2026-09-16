'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  IconFilter,
  IconClose,
  IconRotateCcw,
  IconSparkles,
  IconTrending,
  IconClock,
  IconPlus
} from './icons/AppIcons';
import { NicheCategory, FilterState } from '../lib/types';
import {
  getAllCategories,
  getCustomCategories,
  addCustomCategory,
  removeCustomCategory,
  subscribeCategories
} from '../lib/categories';

interface FilterPillBarProps {
  isVisible: boolean;
  filters: FilterState;
  onSelectCategory: (category: NicheCategory | 'All') => void;
  onToggleSort: (sort: 'latest' | 'popular' | 'random') => void;
  onResetFilters: () => void;
  onClose: () => void;
  categoryCounts?: Record<string, number>;
}

export const FilterPillBar: React.FC<FilterPillBarProps> = ({
  isVisible,
  filters,
  onSelectCategory,
  onToggleSort,
  onResetFilters,
  onClose,
  categoryCounts = {}
}) => {
  const [categories, setCategories] = useState<string[]>(['All', 'IRL', 'Business', 'Tech', 'Entertainment', 'Gaming', 'Sports', 'Documentary', 'Educational']);
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newCatInput, setNewCatInput] = useState('');

  useEffect(() => {
    const update = () => {
      const all = getAllCategories();
      setCategories(['All', ...all]);
      setCustomCategories(getCustomCategories());
    };
    update();
    return subscribeCategories(update);
  }, []);

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newCatInput.trim();
    if (!trimmed) return;
    addCustomCategory(trimmed);
    onSelectCategory(trimmed);
    setNewCatInput('');
    setIsAddingNew(false);
  };

  const handleRemoveCategory = (cat: string, e: React.MouseEvent) => {
    e.stopPropagation();
    removeCustomCategory(cat);
    if (filters.selectedNiche === cat) {
      onSelectCategory('All');
    }
  };

  const hasActiveFilters =
    filters.selectedNiche !== 'All' ||
    (filters.sortBy !== 'latest' && filters.sortBy !== 'random') ||
    Boolean(filters.searchQuery);

  return (
    <AnimatePresence>
      {isVisible && (
        <>
          {/* Invisible Backdrop to easily click anywhere outside to dismiss */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-30 pointer-events-auto"
            onClick={onClose}
          />

          <div className="fixed bottom-[74px] sm:bottom-[80px] inset-x-0 z-40 flex justify-center px-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, y: 14, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.96 }}
              transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
              className="pointer-events-auto bg-white/95 dark:bg-black/95 backdrop-blur-2xl border border-slate-200/80 dark:border-white/15 text-slate-900 dark:text-slate-100 p-4 rounded-[18px] shadow-[0_20px_48px_-8px_rgba(15,23,42,0.25),0_0_0_1px_rgba(0,159,223,0.15)] dark:shadow-[0_20px_48px_-8px_rgba(0,0,0,0.95),0_0_0_1px_rgba(0,159,223,0.3)] max-w-lg w-full space-y-3.5 relative select-none gpu-layer"
            >
              {/* Header Row: Title & Sort Options */}
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/10 pb-2.5">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-[8px] bg-[#009FDF]/10 text-[#009FDF] border border-[#009FDF]/25 flex items-center justify-center">
                    <IconFilter className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 tracking-wide">Filter & Browse</h4>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">Select or create any tag category</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Sort Toggles */}
                  <div className="flex items-center bg-slate-100 dark:bg-zinc-900 p-0.5 rounded-[10px] text-[11px] border border-slate-200/60 dark:border-white/10">
                    <button
                      onClick={() => onToggleSort('latest')}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-[8px] font-medium active:scale-[0.96] transition-all duration-150 cursor-pointer ${
                        filters.sortBy === 'latest'
                          ? 'bg-white dark:bg-zinc-800 text-[#009FDF] dark:text-[#38bdf8] font-bold shadow-xs border border-slate-200/60 dark:border-white/10'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                      }`}
                      title="Sort by latest additions"
                    >
                      <IconClock className="w-3 h-3" />
                      <span>Latest</span>
                    </button>
                    <button
                      onClick={() => onToggleSort('popular')}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-[8px] font-medium active:scale-[0.96] transition-all duration-150 cursor-pointer ${
                        filters.sortBy === 'popular'
                          ? 'bg-white dark:bg-zinc-800 text-[#009FDF] dark:text-[#38bdf8] font-bold shadow-xs border border-slate-200/60 dark:border-white/10'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                      }`}
                      title="Sort by top rated likes"
                    >
                      <IconTrending className="w-3 h-3" />
                      <span>Top</span>
                    </button>
                    <button
                      onClick={() => onToggleSort('random')}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-[8px] font-medium active:scale-[0.96] transition-all duration-150 cursor-pointer ${
                        filters.sortBy === 'random'
                          ? 'bg-white dark:bg-zinc-800 text-[#f76d25] font-bold shadow-xs border border-slate-200/60 dark:border-white/10'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                      }`}
                      title="Random shuffle"
                    >
                      <IconSparkles className="w-3 h-3 text-[#f76d25]" />
                      <span>Shuffle</span>
                    </button>
                  </div>

                  <button
                    onClick={onClose}
                    className="p-1 rounded-[8px] text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-zinc-800 active:scale-[0.92] transition-all duration-150 flex items-center justify-center cursor-pointer"
                    title="Close filter menu"
                  >
                    <IconClose className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Category Pills & Add Category */}
              <div className="flex flex-wrap gap-1.5 pt-0.5 max-h-48 overflow-y-auto pr-1">
                {categories.map((cat) => {
                  const isSelected = filters.selectedNiche === cat;
                  const count = categoryCounts[cat];
                  const isCustom = customCategories.some(c => c.toLowerCase() === cat.toLowerCase());

                  return (
                    <div key={cat} className="relative group inline-flex">
                      <button
                        id={`filter-pill-${cat.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
                        onClick={() => onSelectCategory(cat)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-xs font-semibold whitespace-nowrap active:scale-[0.96] transition-all duration-150 select-none cursor-pointer ${
                          isSelected
                            ? 'bg-[#009FDF] text-white shadow-md shadow-[#009FDF]/25 ring-1 ring-[#009FDF]'
                            : 'bg-slate-100 dark:bg-zinc-900 text-slate-700 dark:text-slate-300 hover:bg-[#009FDF]/10 dark:hover:bg-[#009FDF]/20 hover:text-[#009FDF] dark:hover:text-[#38bdf8] border border-slate-200/50 dark:border-white/10'
                        }`}
                      >
                        <span>{cat}</span>
                        {count !== undefined && count > 0 && (
                          <span
                            className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                              isSelected ? 'bg-white/25 text-white' : 'bg-slate-200 dark:bg-zinc-800 text-slate-600 dark:text-slate-300'
                            }`}
                          >
                            {count}
                          </span>
                        )}
                        {isCustom && (
                          <span
                            onClick={(e) => handleRemoveCategory(cat, e)}
                            title="Remove category"
                            className="ml-0.5 p-0.5 rounded-full hover:bg-black/20 dark:hover:bg-white/20 text-xs font-bold leading-none cursor-pointer"
                          >
                            &times;
                          </span>
                        )}
                      </button>
                    </div>
                  );
                })}

                {/* Add Category Button / Inline Form */}
                {isAddingNew ? (
                  <form onSubmit={handleAddCategory} className="inline-flex items-center gap-1">
                    <input
                      type="text"
                      autoFocus
                      value={newCatInput}
                      onChange={(e) => setNewCatInput(e.target.value)}
                      placeholder="New category..."
                      className="px-2.5 py-1 text-xs rounded-[9px] bg-slate-100 dark:bg-zinc-800 border border-[#009FDF] text-slate-900 dark:text-slate-100 focus:outline-none w-28"
                    />
                    <button
                      type="submit"
                      disabled={!newCatInput.trim()}
                      className="px-2 py-1 text-[11px] font-bold bg-[#009FDF] text-white rounded-[8px] disabled:opacity-50 cursor-pointer"
                    >
                      Add
                    </button>
                    <button
                      type="button"
                      onClick={() => { setIsAddingNew(false); setNewCatInput(''); }}
                      className="px-1.5 py-1 text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                    >
                      &times;
                    </button>
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsAddingNew(true)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-[10px] text-xs font-medium text-[#009FDF] hover:bg-[#009FDF]/10 border border-dashed border-[#009FDF]/40 transition-all cursor-pointer"
                  >
                    <IconPlus className="w-3 h-3" />
                    <span>New Category</span>
                  </button>
                )}
              </div>

              {/* Footer info & Reset button */}
              {hasActiveFilters && (
                <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-white/10 text-xs">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Active: <span className="text-[#009FDF] dark:text-[#38bdf8] font-semibold">{filters.selectedNiche}</span>
                    {filters.sortBy !== 'latest' && filters.sortBy !== 'random' && ` • ${filters.sortBy}`}
                  </span>
                  <button
                    onClick={onResetFilters}
                    className="text-[11px] font-semibold text-[#f76d25] hover:text-[#df5c17] flex items-center gap-1 py-0.5 px-2 rounded-[8px] hover:bg-[#fef1eb] dark:hover:bg-[#f76d25]/10 active:scale-[0.96] transition-all duration-150 cursor-pointer"
                  >
                    <IconRotateCcw className="w-3 h-3" />
                    <span>Reset all</span>
                  </button>
                </div>
              )}

            </motion.div>
          </div>

        </>
      )}
    </AnimatePresence>
  );
};



