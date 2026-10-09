'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  IconClose,
  IconRotateCcw,
  IconPlus
} from './icons/AppIcons';
import { NicheCategory, FilterState, ThumbnailItem } from '../lib/types';
import { COLOR_FAMILY_ORDER, familiesForItem, familyOfHex, type ColorFamily } from '../lib/colorFamilies';
import {
  getCustomCategories,
  addCustomCategory,
  removeCustomCategory,
  subscribeCategories
} from '../lib/categories';

export interface ColorSwatch {
  hex: string;
  /** How many thumbnails carry this hex within the family. */
  count: number;
}

export interface ColorLibraryEntry {
  family: ColorFamily;
  /** Actual hexes found in the library for this family, most common first. */
  swatches: ColorSwatch[];
  count: number;
}

interface FilterPillBarProps {
  isVisible: boolean;
  filters: FilterState;
  onSelectCategory: (category: NicheCategory | 'All') => void;
  onToggleColor: (family: ColorFamily) => void;
  onResetFilters: () => void;
  onClose: () => void;
  categoryCounts?: Record<string, number>;
  colorLibrary?: ColorLibraryEntry[];
  resultCount?: number;
  // The posters wall has no niche taxonomy, so its category section hides.
  showCategories?: boolean;
}

/**
 * Build one entry per colour family present in the library, each carrying the
 * real extracted hexes ranked by how many items use them. Rendered as a
 * proportional strip so the button shows the palette you actually own.
 */
export function buildColorLibrary(items: ThumbnailItem[]): ColorLibraryEntry[] {
  const byFamily = new Map<ColorFamily, Map<string, number>>();

  items.forEach((item) => {
    const hexes = item.colors || [];
    if (hexes.length === 0) return;
    familiesForItem(item).forEach((family) => {
      // Attribute the swatch that actually reads as this family, not blindly
      // the leading one — an item tagged [Red, Dark] contributes its brown to
      // Red and its black to Dark.
      const hex = hexes.find((h) => familyOfHex(h) === family) ?? hexes[0];
      if (!byFamily.has(family)) byFamily.set(family, new Map());
      const hexCounts = byFamily.get(family)!;
      hexCounts.set(hex, (hexCounts.get(hex) || 0) + 1);
    });
  });

  const entries: ColorLibraryEntry[] = [];
  COLOR_FAMILY_ORDER.forEach((family) => {
    const hexCounts = byFamily.get(family);
    if (!hexCounts || hexCounts.size === 0) return;
    const ranked = Array.from(hexCounts.entries()).sort((a, b) => b[1] - a[1]);
    entries.push({
      family,
      swatches: ranked.slice(0, 4).map(([hex, count]) => ({ hex, count })),
      count: ranked.reduce((sum, [, n]) => sum + n, 0),
    });
  });

  return entries;
}

function PanelSection({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h5 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-faint">
          {title}
        </h5>
        {action}
      </div>
      {children}
    </section>
  );
}

export const FilterPillBar: React.FC<FilterPillBarProps> = ({
  isVisible,
  filters,
  onSelectCategory,
  onToggleColor,
  onResetFilters,
  onClose,
  categoryCounts = {},
  colorLibrary = [],
  resultCount = 0,
  showCategories = true,
}) => {
  const [categories, setCategories] = useState<string[]>(['All']);
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newCatInput, setNewCatInput] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);

  // Categories come from the facets counts, which are derived from the tags
  // actually in the data. The hardcoded list would hide every category that
  // was not already in it and show ones no thumbnail carries. Locally added
  // categories are merged on top, since nothing assigns those yet.
  useEffect(() => {
    const update = () => {
      const fromData = Object.keys(categoryCounts).filter((c) => c !== 'All');
      const custom = getCustomCategories();
      const merged = [...fromData];
      for (const c of custom) {
        if (!merged.some((m) => m.toLowerCase() === c.toLowerCase())) merged.push(c);
      }
      setCategories(['All', ...merged]);
      setCustomCategories(custom);
    };
    update();
    return subscribeCategories(update);
  }, [categoryCounts]);

  // Dismiss on Escape or outside click while open.
  useEffect(() => {
    if (!isVisible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const onPointer = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onPointer);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onPointer);
    };
  }, [isVisible, onClose]);

  if (!isVisible) return null;

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

  const activeCount =
    (filters.selectedNiche !== 'All' ? 1 : 0) +
    (filters.searchQuery.trim() ? 1 : 0) +
    filters.selectedColors.length +
    (filters.selectedEmotion ? 1 : 0);

  const sortControlClass = (active: boolean) =>
    `flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition-colors duration-150 active:scale-[0.98] ${
      active
        ? 'bg-accent text-accent-on shadow-card'
        : 'text-ink-muted hover:bg-surface-raised hover:text-ink'
    }`;

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Gallery filters"
      className="animate-blur-in fixed right-3 top-[72px] z-40 flex max-h-[calc(100dvh-96px)] w-[min(540px,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-xl border border-line bg-surface-raised shadow-elevated sm:right-6 lg:right-10"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-semibold text-ink">Filters</h4>
          {activeCount > 0 && (
            <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-accent-on tabular">
              {activeCount} active
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {activeCount > 0 && (
            <button
              type="button"
              onClick={onResetFilters}
              className="flex cursor-pointer items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:bg-surface hover:text-ink"
            >
              <IconRotateCcw className="h-3 w-3" />
              <span>Reset</span>
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close filters"
            className="grid h-7 w-7 cursor-pointer place-items-center rounded-md text-ink-muted transition-colors hover:bg-surface hover:text-ink"
          >
            <IconClose className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="space-y-5 overflow-y-auto px-4 py-4">
        {showCategories && (
        <PanelSection
          title="Category"
          action={
            !isAddingNew ? (
              <button
                type="button"
                onClick={() => setIsAddingNew(true)}
                className="flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-ink-muted transition-colors hover:bg-surface hover:text-ink"
              >
                <IconPlus className="h-3 w-3" />
                <span>New</span>
              </button>
            ) : undefined
          }
        >
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => {
              const isSelected = filters.selectedNiche === cat;
              const count = categoryCounts[cat];
              const isCustom = customCategories.some(
                (c) => c.toLowerCase() === cat.toLowerCase()
              );
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => onSelectCategory(cat)}
                  aria-pressed={isSelected}
                  className={`flex cursor-pointer items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors duration-150 active:scale-[0.97] ${
                    isSelected
                      ? 'border-transparent bg-accent text-accent-on shadow-card'
                      : 'border-line bg-surface text-ink-muted hover:border-line-strong hover:text-ink'
                  }`}
                >
                  <span>{cat}</span>
                  {count !== undefined && count > 0 && (
                    <span className="text-[11px] tabular opacity-70">{count}</span>
                  )}
                  {isCustom && (
                    <span
                      role="button"
                      tabIndex={0}
                      aria-label={`Remove ${cat}`}
                      onClick={(e) => handleRemoveCategory(cat, e)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleRemoveCategory(cat, e as unknown as React.MouseEvent);
                        }
                      }}
                      title="Remove category"
                      className="grid h-4 w-4 cursor-pointer place-items-center rounded-full text-xs leading-none opacity-60 hover:bg-black/15 hover:opacity-100 dark:hover:bg-[#E6E8EC]/20"
                    >
                      &times;
                    </span>
                  )}
                </button>
              );
            })}

            {isAddingNew && (
              <form onSubmit={handleAddCategory} className="flex items-center gap-1.5">
                <input
                  type="text"
                  autoFocus
                  value={newCatInput}
                  onChange={(e) => setNewCatInput(e.target.value)}
                  placeholder="Category name"
                  aria-label="New category name"
                  className="h-8 w-32 rounded-md border border-line bg-surface px-2.5 text-xs text-ink outline-none placeholder:text-ink-faint focus:border-line-strong"
                />
                <button
                  type="submit"
                  disabled={!newCatInput.trim()}
                  className="h-8 cursor-pointer rounded-md bg-accent px-2.5 text-xs font-medium text-accent-on transition-opacity hover:opacity-90 disabled:opacity-40"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingNew(false);
                    setNewCatInput('');
                  }}
                  aria-label="Cancel"
                  className="grid h-8 w-8 cursor-pointer place-items-center rounded-md text-ink-muted transition-colors hover:bg-surface hover:text-ink"
                >
                  <IconClose className="h-3.5 w-3.5" />
                </button>
              </form>
            )}
          </div>
        </PanelSection>
        )}

        {colorLibrary.length > 0 && (
        <PanelSection title="Colour">
          <div className="flex flex-wrap gap-2">
            {colorLibrary.map((entry) => {
              const isSelected = filters.selectedColors.includes(entry.family);
              return (
                <button
                  key={entry.family}
                  type="button"
                  onClick={() => onToggleColor(entry.family)}
                  aria-pressed={isSelected}
                  title={`${entry.family} — ${entry.count} ${entry.count === 1 ? 'thumbnail' : 'thumbnails'}`}
                  className={`flex cursor-pointer items-center gap-2 overflow-hidden rounded-md border py-1.5 pl-1.5 pr-2.5 text-xs font-medium transition-colors duration-150 active:scale-[0.97] ${
                    isSelected
                      ? 'border-transparent bg-accent text-accent-on shadow-card'
                      : 'border-line bg-surface text-ink-muted hover:border-line-strong hover:text-ink'
                  }`}
                >
                  {/* Real palette from the library. Each slice is flex-grown by
                      how many thumbnails actually carry that hex. */}
                  <span className="flex h-4 w-9 shrink-0 overflow-hidden rounded-[3px] ring-1 ring-black/10 dark:ring-[#E6E8EC]/15">
                    {entry.swatches.map((swatch) => (
                      <span
                        key={swatch.hex}
                        style={{ backgroundColor: swatch.hex, flexGrow: swatch.count }}
                        className="h-full min-w-[3px]"
                      />
                    ))}
                  </span>
                  <span>{entry.family}</span>
                  <span className="text-[11px] tabular opacity-70">{entry.count}</span>
                </button>
              );
            })}
          </div>
        </PanelSection>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-line bg-surface-raised px-4 py-3">
        <button
          type="button"
          onClick={onClose}
          className="w-full cursor-pointer rounded-md bg-accent py-2.5 text-xs font-semibold text-accent-on transition-opacity duration-200 hover:opacity-90 active:scale-[0.99]"
        >
          Show {resultCount} {resultCount === 1 ? 'result' : 'results'}
        </button>
      </div>
    </div>
  );
};
