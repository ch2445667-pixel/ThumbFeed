'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { TopBar } from '../components/TopBar';
import { ThumbnailCard } from '../components/ThumbnailCard';
import { FilterPillBar } from '../components/FilterPillBar';
import { AddModal } from '../components/AddModal';
import { ThumbnailModal } from '../components/ThumbnailModal';
import { DeleteConfirmModal } from '../components/DeleteConfirmModal';
import { IconTrash, IconFilm, IconImage } from '../components/icons/AppIcons';
import { ThumbnailItem, FilterState, NicheCategory } from '../lib/types';
import { INITIAL_THUMBNAILS } from '../lib/mockData';
import { INITIAL_POSTERS } from '../lib/posters';
import { ViewModeToggle } from '../components/ViewModeToggle';
import { useAuth } from '../lib/authContext';
import {
  saveStoredThumbnail,
  saveStoredThumbnails,
  fetchLiveSupabaseThumbnails,
  getStoredThumbnails,
  getStoredPosters,
  saveStoredPosters,
  persistPosterList,
  deleteStoredThumbnailPermanently,
  updateStoredThumbnail
} from '../lib/storage';
import { supabase } from '../lib/supabase';

// Deterministic seeded shuffle using Mulberry32 PRNG so order never drifts automatically
function seededShuffle<T>(array: T[], seed: number): T[] {
  const arr = [...array];
  if (arr.length <= 1) return arr;
  let s = (seed || 123456789) >>> 0;
  const random = () => {
    let t = (s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const DEFAULT_SHUFFLE_SEED = 882391;
const SHUFFLED_INITIAL_THUMBNAILS = seededShuffle(INITIAL_THUMBNAILS, DEFAULT_SHUFFLE_SEED);

// How many tiles mount at once. The library holds 1,400+ items; mounting them
// all kept thousands of nodes, images and observers alive, which is what made
// scrolling, filtering and theme switching feel heavy.
const PAGE_SIZE = 60;

export default function HomePage() {
  const { isAdmin } = useAuth();

  // Initialize with pre-shuffled thumbnails for instantaneous shuffled start with zero flash
  const [thumbnails, setThumbnails] = useState<ThumbnailItem[]>(SHUFFLED_INITIAL_THUMBNAILS);
  const [posters, setPosters] = useState<ThumbnailItem[]>(INITIAL_POSTERS);

  // Library section. Posters are a separate wall: portrait artwork, no
  // metadata footers, local-only persistence.
  const [section, setSection] = useState<'thumbnails' | 'posters'>('thumbnails');

  // Grid density is remembered per section. Portraits read better denser.
  const [posterColumns, setPosterColumns] = useState<number>(5);
  
  // UI Grid Zoom / Columns Slider: Default to 3 columns (Maximum zoom with 3 thumbnails on single row)
  const [columns, setColumns] = useState<number>(3);
  const [shuffleSeed, setShuffleSeed] = useState<number>(DEFAULT_SHUFFLE_SEED);

  // Modal / Filter Bar States
  const [isFilterBarOpen, setIsFilterBarOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ThumbnailItem | null>(null);
  const [thumbnailToDelete, setThumbnailToDelete] = useState<ThumbnailItem | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Option state: Toggle thumbnail card metadata footer (channel name, video title, views count)
  const [showCardInfo, setShowCardInfo] = useState<boolean>(true);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('thumbfeed_show_card_info');
      if (stored !== null) {
        setShowCardInfo(stored === 'true');
      }
      const storedCols = localStorage.getItem('thumbfeed_columns');
      if (storedCols) {
        const val = parseInt(storedCols, 10);
        if (val >= 3 && val <= 6) setColumns(val);
      }
      const storedPosterCols = localStorage.getItem('thumbfeed_poster_columns');
      if (storedPosterCols) {
        const val = parseInt(storedPosterCols, 10);
        if (val >= 3 && val <= 6) setPosterColumns(val);
      }
      const storedSection = localStorage.getItem('thumbfeed_section');
      if (storedSection === 'posters' || storedSection === 'thumbnails') {
        setSection(storedSection);
      }
    } catch {}
  }, []);

  // Posters hydrate from their own local collection once.
  useEffect(() => {
    const stored = getStoredPosters();
    if (stored && stored.length > 0) {
      setPosters(stored);
    }
  }, []);

  // Switching walls resets the category scope, which belongs to thumbnails.
  const handleSectionChange = useCallback((next: 'thumbnails' | 'posters') => {
    setSection(next);
    try {
      localStorage.setItem('thumbfeed_section', next);
    } catch {}
    setFilters(prev => ({
      ...prev,
      selectedNiche: 'All',
      selectedStyles: [],
      selectedColor: null,
      selectedEmotion: null,
    }));
  }, []);

  const handleToggleCardInfo = useCallback(() => {
    setShowCardInfo((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('thumbfeed_show_card_info', String(next));
        } catch {}
      }
      return next;
    });
  }, []);

  const handleColumnsChange = useCallback((cols: number) => {
    const val = Math.min(6, Math.max(3, cols));
    setColumns(val);
    try {
      localStorage.setItem('thumbfeed_columns', String(val));
    } catch {}
  }, []);

  const handlePosterColumnsChange = useCallback((cols: number) => {
    const val = Math.min(6, Math.max(3, cols));
    setPosterColumns(val);
    try {
      localStorage.setItem('thumbfeed_poster_columns', String(val));
    } catch {}
  }, []);

  const activeColumns = section === 'posters' ? posterColumns : columns;
  const handleActiveColumnsChange = useCallback((cols: number) => {
    if (section === 'posters') {
      handlePosterColumnsChange(cols);
    } else {
      handleColumnsChange(cols);
    }
  }, [section, handleColumnsChange, handlePosterColumnsChange]);

  // The wall being browsed. Everything below (counts, filters, paging)
  // operates on this list, so both sections share one pipeline.
  const activeItems = section === 'posters' ? posters : thumbnails;

  // Default sort is 'random' (Shuffle) so feed is always dynamically shuffled from start
  const [filters, setFilters] = useState<FilterState>({
    searchQuery: '',
    selectedNiche: 'All',
    selectedStyles: [],
    selectedColor: null,
    selectedEmotion: null,
    sortBy: 'random'
  });

  // Load from local storage and continuously sync live from Supabase (auto-detecting Chrome extension uploads)
  useEffect(() => {
    const stored = getStoredThumbnails();
    if (stored && stored.length > 0) {
      setThumbnails(stored);
    }

    let isMounted = true;
    let isFetching = false;

    async function loadData() {
      if (isFetching) return;
      isFetching = true;
      try {
        const loadedThumbs = await fetchLiveSupabaseThumbnails();
        if (isMounted && loadedThumbs && loadedThumbs.length > 0) {
          setThumbnails(prev => {
            const prevIds = new Set(prev.map(p => p.id));
            const hasNew = loadedThumbs.some(t => !prevIds.has(t.id));
            const countChanged = prev.length !== loadedThumbs.length;

            if (hasNew || countChanged || prev[0]?.id !== loadedThumbs[0]?.id) {
              return loadedThumbs;
            }
            return prev;
          });
        }
      } catch (err) {
        console.warn('Auto-sync Supabase check note:', err);
      } finally {
        isFetching = false;
      }
    }

    // Initial sync on mount
    loadData();

    // Auto-sync polling every 5 seconds to catch background extension uploads
    const pollTimer = setInterval(() => {
      loadData();
    }, 5000);

    // Supabase Realtime channel to get notified immediately when Chrome extension saves a record
    let realtimeChannel: any = null;
    if (supabase) {
      try {
        realtimeChannel = supabase
          .channel('realtime:thumbnails_feed')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'thumbnails' },
            () => {
              loadData();
            }
          )
          .subscribe((status: string, err?: Error) => {
            if (status === 'CHANNEL_ERROR') {
              console.warn('Supabase realtime channel notice:', err?.message || status);
            }
          });
      } catch (e) {
        console.warn('Supabase Realtime not available, falling back to interval:', e);
      }
    }

    // Auto-sync instantly whenever the user focuses the window (e.g. switching from Chrome extension)
    const onWindowFocus = () => {
      loadData();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadData();
      }
    };

    window.addEventListener('focus', onWindowFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      isMounted = false;
      clearInterval(pollTimer);
      if (realtimeChannel && supabase) {
        supabase.removeChannel(realtimeChannel);
      }
      window.removeEventListener('focus', onWindowFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { All: activeItems.length };
    for (const t of activeItems) {
      const seenForThisItem = new Set<string>();
      if (t.niche) {
        counts[t.niche] = (counts[t.niche] || 0) + 1;
        seenForThisItem.add(t.niche.toLowerCase());
      }
      if (t.tags && Array.isArray(t.tags)) {
        for (const tag of t.tags) {
          const lower = tag.trim().toLowerCase();
          if (lower && !seenForThisItem.has(lower)) {
            counts[tag.trim()] = (counts[tag.trim()] || 0) + 1;
            seenForThisItem.add(lower);
          }
        }
      }
    }
    return counts;
  }, [activeItems]);

  // Filtered & Sorted thumbnails
  const filteredThumbnails = useMemo(() => {
    let result = [...activeItems];

    if (filters.searchQuery.trim()) {
      const q = filters.searchQuery.toLowerCase().trim();
      result = result.filter(item =>
        item.title.toLowerCase().includes(q) ||
        (item.creator && item.creator.toLowerCase().includes(q)) ||
        (item.ocrText && item.ocrText.toLowerCase().includes(q)) ||
        item.tags.some(tag => tag.toLowerCase().includes(q)) ||
        item.niche.toLowerCase().includes(q)
      );
    }

    if (filters.selectedNiche !== 'All') {
      const target = filters.selectedNiche.toLowerCase().trim();
      result = result.filter(item =>
        (item.niche && item.niche.toLowerCase().trim() === target) ||
        (item.tags && item.tags.some(tag => tag.toLowerCase().trim() === target))
      );
    }

    if (filters.selectedStyles.length > 0) {
      result = result.filter(item =>
        filters.selectedStyles.some(style => item.styles.includes(style))
      );
    }

    if (filters.selectedColor) {
      const targetColor = filters.selectedColor.toLowerCase();
      result = result.filter(item =>
        item.colors && item.colors.some(c => c.toLowerCase() === targetColor)
      );
    }

    if (filters.sortBy === 'popular') {
      result.sort((a, b) => (b.likesCount || 0) - (a.likesCount || 0));
    } else if (filters.sortBy === 'random') {
      // Deterministic seeded shuffle based on user's shuffleSeed
      return seededShuffle(result, shuffleSeed);
    } else {
      result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    return result;
  }, [activeItems, filters, shuffleSeed]);

  // Only a page of tiles mounts at a time. The order is computed over the
  // full filtered list first, so paging never reshuffles what is on screen.
  const [visibleCount, setVisibleCount] = useState<number>(PAGE_SIZE);

  // Shuffle Inspiration - shuffles all items on explicit user button click
  const handleShuffle = useCallback(() => {
    setFilters(prev => ({ ...prev, sortBy: 'random' }));
    setShuffleSeed(Date.now());
  }, []);

  // Add Thumbnail (Restricted to shivashiva66407@gmail.com)
  const handleAddThumbnail = (item: ThumbnailItem) => {
    if (!isAdmin) return;
    if (item.kind === 'poster') {
      setPosters(saveStoredPosters([item]));
      return;
    }
    const updated = saveStoredThumbnail(item);
    setThumbnails(updated);
  };

  // Add Multiple Thumbnails in batch (Restricted to shivashiva66407@gmail.com)
  const handleAddMultipleThumbnails = (items: ThumbnailItem[]) => {
    if (!isAdmin) return;
    const posterItems = items.filter(i => i.kind === 'poster');
    const thumbItems = items.filter(i => i.kind !== 'poster');
    if (posterItems.length > 0) {
      setPosters(saveStoredPosters(posterItems));
    }
    if (thumbItems.length > 0) {
      const updated = saveStoredThumbnails(thumbItems);
      setThumbnails(updated);
    }
  };

  // Permanently delete a thumbnail. The tile vanishes synchronously and every
  // modal closes at once; the storage, database and bucket deletes run in the
  // background and never block the UI. Only a failure surfaces a message.
  const handleDeleteThumbnail = useCallback((item: ThumbnailItem) => {
    if (!isAdmin) return;
    const matches = (t: ThumbnailItem) => t.id === item.id || t.imageUrl === item.imageUrl;
    setThumbnails(prev => prev.filter(t => !matches(t)));
    setPosters(prev => {
      const next = prev.filter(t => !matches(t));
      if (next.length !== prev.length) persistPosterList(next);
      return next;
    });
    setSelectedItem(prev => (prev && matches(prev) ? null : prev));
    setThumbnailToDelete(null);
    deleteStoredThumbnailPermanently(item).catch((err) => {
      console.error('Permanent delete failed:', err);
      setToastMessage('Delete failed. Check your connection and try again.');
      window.setTimeout(() => setToastMessage(null), 4000);
    });
  }, [isAdmin]);

  // Rename a thumbnail title (admin only). State updates synchronously;
  // persistence to local storage and Supabase is handled inside.
  const handleEditTitle = useCallback((item: ThumbnailItem, title: string) => {
    const next = title.trim();
    if (!next) return;
    const updated = { ...item, title: next };
    const matches = (t: ThumbnailItem) => t.id === item.id || t.imageUrl === item.imageUrl;
    if (item.kind === 'poster') {
      setPosters(prev => {
        const mapped = prev.map(t => (matches(t) ? updated : t));
        persistPosterList(mapped);
        return mapped;
      });
    } else {
      updateStoredThumbnail(updated);
      setThumbnails(prev => prev.map(t => (matches(t) ? updated : t)));
    }
    setSelectedItem(prev => (prev && matches(prev) ? updated : prev));
  }, []);

  const visibleThumbnails = useMemo(
    () => filteredThumbnails.slice(0, visibleCount),
    [filteredThumbnails, visibleCount]
  );

  // Start back at the first page whenever the result set itself changes.
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [filters, shuffleSeed, columns, posterColumns, section, thumbnails.length, posters.length]);

  // Infinite scroll sentinel. One shared observer for the whole grid.
  const loadMoreRef = React.useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (visibleCount >= filteredThumbnails.length) return;
    const el = loadMoreRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisibleCount((c) => Math.min(c + PAGE_SIZE, filteredThumbnails.length));
        }
      },
      { rootMargin: '900px 0px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [visibleCount, filteredThumbnails.length]);

  // Stable identities so React.memo on ThumbnailCard actually holds. Passing
  // inline arrows here used to hand every card a new prop object on each
  // parent render, re-rendering the entire grid every time.
  const handleInspect = useCallback((item: ThumbnailItem) => {
    setSelectedItem(item);
  }, []);

  const handleRequestDelete = useCallback((item: ThumbnailItem) => {
    setThumbnailToDelete(item);
  }, []);

  const activeFilterCount =
    (filters.searchQuery.trim() ? 1 : 0) +
    (filters.selectedNiche !== 'All' ? 1 : 0) +
    filters.selectedStyles.length +
    (filters.selectedColor ? 1 : 0) +
    (filters.selectedEmotion ? 1 : 0);

  const resetFilters = useCallback(() => {
    setFilters({
      searchQuery: '',
      selectedNiche: 'All',
      selectedStyles: [],
      selectedColor: null,
      selectedEmotion: null,
      sortBy: 'random'
    });
  }, []);

  // Dynamic grid column class based on zoom slider (3 columns = Maximum Zoom with 3 thumbnails per row)
  const getGridColsClass = () => {
    switch (activeColumns) {
      case 3:
        return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3';
      case 4:
        return 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4';
      case 6:
        return 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6';
      case 5:
      default:
        return 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5';
    }
  };

  return (
    <div className="flex min-h-[100dvh] flex-col bg-canvas pb-12 text-ink transition-colors duration-200 pt-16">

      {/* Top Header: brand, search, gallery controls, theme, account */}
      <TopBar
        query={filters.searchQuery}
        onQueryChange={(q) => setFilters(prev => ({ ...prev, searchQuery: q }))}
        resultCount={filteredThumbnails.length}
        columns={activeColumns}
        onColumnsChange={handleActiveColumnsChange}
        onShuffle={handleShuffle}
        onToggleFilter={() => setIsFilterBarOpen(prev => !prev)}
        isFilterOpen={isFilterBarOpen}
        activeFilterCount={activeFilterCount}
        onOpenAdd={isAdmin ? () => setIsAddOpen(true) : undefined}
      />

      <main className="mx-auto w-full max-w-[1800px] flex-1 px-4 py-5 sm:px-6 lg:px-8">
        {/* Library section switcher, sort and view controls */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div
            className="flex items-center gap-1 rounded-lg border border-line bg-surface p-1 shadow-card"
            role="tablist"
            aria-label="Library section"
          >
            {(
              [
                { key: 'thumbnails', label: 'Thumbnails', Icon: IconImage },
                { key: 'posters', label: 'Posters', Icon: IconFilm },
              ] as const
            ).map(({ key, label, Icon }) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={section === key}
                onClick={() => handleSectionChange(key)}
                className={`flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors duration-200 active:scale-[0.98] ${
                  section === key
                    ? 'bg-accent text-accent-on shadow-card'
                    : 'text-ink-muted hover:bg-surface-raised hover:text-ink'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{label}</span>
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {section === 'thumbnails' && (
              <ViewModeToggle isDetail={showCardInfo} onToggle={handleToggleCardInfo} />
            )}
          </div>
        </div>

        {filteredThumbnails.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-line bg-surface">
              <IconTrash className="h-4 w-4 text-ink-faint" />
            </div>
            <p className="mt-4 text-sm font-medium text-ink">Nothing matches those filters</p>
            <p className="mt-1 max-w-[34ch] text-sm text-ink-muted">
              Widen the niche or clear the search to see the rest of the gallery.
            </p>
            <button
              onClick={resetFilters}
              className="mt-5 cursor-pointer rounded-md bg-accent px-3.5 py-2 text-xs font-medium text-accent-on transition-opacity duration-200 hover:opacity-90 active:scale-[0.98]"
            >
              Reset filters
            </button>
          </div>
        ) : (
          <>
            <div className={`grid ${getGridColsClass()} gap-3 sm:gap-4`}>
              {visibleThumbnails.map((item, index) => (
                <ThumbnailCard
                  key={item.id}
                  item={item}
                  index={index}
                  poster={section === 'posters'}
                  showCardInfo={section === 'thumbnails' && showCardInfo}
                  onInspect={handleInspect}
                  onDelete={isAdmin ? handleRequestDelete : undefined}
                />
              ))}
            </div>

            {/* Paging footer: infinite scroll with an explicit control. */}
            {visibleCount < filteredThumbnails.length && (
              <div className="mt-8 flex flex-col items-center gap-3">
                <div ref={loadMoreRef} aria-hidden="true" className="h-1 w-full" />
                <button
                  type="button"
                  onClick={() =>
                    setVisibleCount((c) => Math.min(c + PAGE_SIZE, filteredThumbnails.length))
                  }
                  className="cursor-pointer rounded-md border border-line bg-surface px-4 py-2 text-xs font-medium text-ink shadow-card transition-colors duration-200 hover:border-line-strong hover:bg-surface-raised active:scale-[0.98]"
                >
                  Load more
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {/* Filter panel, anchored under the top bar */}
      <FilterPillBar
        isVisible={isFilterBarOpen}
        filters={filters}
        onSelectCategory={(cat) => setFilters(prev => ({ ...prev, selectedNiche: cat }))}
        onResetFilters={resetFilters}
        onClose={() => setIsFilterBarOpen(false)}
        categoryCounts={categoryCounts}
        resultCount={filteredThumbnails.length}
        showCategories={section === 'thumbnails'}
      />

      {/* Add Modal with Automatic Color Palette & Tag Extraction (Only accessible by owner) */}
      {isAdmin && (
        <AddModal
          isOpen={isAddOpen}
          onClose={() => setIsAddOpen(false)}
          onAddThumbnail={handleAddThumbnail}
          onAddMultipleThumbnails={handleAddMultipleThumbnails}
        />
      )}

      {/* Thumbnail Inspection Modal - With Download, Title Edit & Permanent Delete (owner only) */}
      <ThumbnailModal
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
        onDelete={isAdmin ? handleDeleteThumbnail : undefined}
        onEditTitle={isAdmin ? handleEditTitle : undefined}
      />

      {/* Quick Delete Confirmation Modal (Only accessible by owner) */}
      {isAdmin && (
        <DeleteConfirmModal
          item={thumbnailToDelete}
          isOpen={Boolean(thumbnailToDelete)}
          onClose={() => setThumbnailToDelete(null)}
          onConfirm={handleDeleteThumbnail}
        />
      )}

      {/* Delete failures only. Success needs no announcement: the tile is
          simply gone. */}
      {toastMessage && (
        <div
          id="deletion-toast-banner"
          role="alert"
          className="fixed bottom-24 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border border-danger-line bg-danger-soft px-4 py-2 text-xs font-medium text-danger shadow-elevated sm:bottom-28"
        >
          <span>{toastMessage}</span>
        </div>
      )}

    </div>
  );
}
