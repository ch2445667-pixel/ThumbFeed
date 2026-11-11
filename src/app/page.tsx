'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { TopBar } from '../components/TopBar';
import { ThumbnailCard } from '../components/ThumbnailCard';
import { FilterPillBar } from '../components/FilterPillBar';
import { type ColorFamily } from '../lib/colorFamilies';
import { IconUploadCloud as IconUpload } from '../components/icons/AppIcons';
import { ThumbnailItem, FilterState, NicheCategory } from '../lib/types';
import { useAuth } from '../lib/authContext';
import {
  saveStoredThumbnail,
  saveStoredThumbnails,
  deleteStoredThumbnailPermanently,
  updateStoredThumbnail
} from '../lib/storage';
import { useGallery, useGalleryFacets, useInvalidateGallery, GALLERY_PAGE_SIZE, type GalleryPage, type GallerySection } from '../lib/useGallery';
import { fetchMissingYouTubeDetails } from '../lib/youtubeMetadataCache';
import { useQueryClient } from '@tanstack/react-query';

/**
 * The Add sheet is the single largest component in the app (~2,100 lines) and
 * is opened only by the owner, so shipping it in the first visit's bundle made
 * every anonymous visitor pay for it. Loading it on demand keeps the gallery
 * lean without changing the flow.
 */
const AddModal = dynamic(() => import('../components/AddModal').then((mod) => mod.AddModal), {
  ssr: false,
});

/**
 * Both inspect and delete sheets pull in framer-motion, a large chunk an
 * anonymous visitor who never opens a tile does not need. They load on first
 * use; the click that opens one also starts the fetch.
 */
const ThumbnailModal = dynamic(
  () => import('../components/ThumbnailModal').then((mod) => mod.ThumbnailModal),
  { ssr: false }
);
const DeleteConfirmModal = dynamic(
  () => import('../components/DeleteConfirmModal').then((mod) => mod.DeleteConfirmModal),
  { ssr: false }
);

/** Shuffle seed, so a shuffle is stable for the lifetime of the page. */
const DEFAULT_SHUFFLE_SEED = 882391;

/** The library is a single wall now: the owner's uploads. */
const SECTION: GallerySection = 'uploads';

/** Debounce the search box before it becomes part of the query key, so every
    keystroke does not fire a new request. */
function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

// Tiles per page. Paging keeps the first paint small even when the library
// grows to thousands of uploads.
const PAGE_SIZE = GALLERY_PAGE_SIZE;

export default function HomePage() {
  const { isAdmin } = useAuth();

  // Grid Zoom / Columns Slider: Default to 3 columns (Maximum zoom with 3 thumbnails on single row)
  const [columns, setColumns] = useState<number>(3);
  const [shuffleSeed, setShuffleSeed] = useState<number>(DEFAULT_SHUFFLE_SEED);

  // Modal / Filter Bar States
  const [isFilterBarOpen, setIsFilterBarOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ThumbnailItem | null>(null);
  const [thumbnailToDelete, setThumbnailToDelete] = useState<ThumbnailItem | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    try {
      const storedCols = localStorage.getItem('thumbfeed_columns');
      if (storedCols) {
        const val = parseInt(storedCols, 10);
        if (val >= 3 && val <= 6) setColumns(val);
      }
    } catch {}
  }, []);

  const handleColumnsChange = useCallback((cols: number) => {
    const val = Math.min(6, Math.max(3, cols));
    setColumns(val);
    try {
      localStorage.setItem('thumbfeed_columns', String(val));
    } catch {}
  }, []);

  // Default sort is 'random' (Shuffle) so the wall is always freshly shuffled.
  const [filters, setFilters] = useState<FilterState>({
    searchQuery: '',
    selectedNiche: 'All',
    selectedColors: [],
    selectedEmotion: null,
    sortBy: 'random'
  });

  // Uploads come from the local store. Filtering, sorting and the seeded
  // shuffle run in memory; a filter change costs one pass, not a network trip.
  const debouncedSearch = useDebouncedValue(filters.searchQuery.trim(), 500);
  const galleryKey = useMemo(() => ({
    section: SECTION,
    search: debouncedSearch,
    niche: filters.selectedNiche,
      colors: filters.selectedColors,
    sort: filters.sortBy,
    seed: shuffleSeed,
  }), [debouncedSearch, filters.selectedNiche, filters.selectedColors, filters.sortBy, shuffleSeed]);

  const gallery = useGallery(galleryKey);
  const facetsQuery = useGalleryFacets(SECTION);
  const invalidateGallery = useInvalidateGallery();
  const queryClient = useQueryClient();

  const galleryItems = useMemo(
    () => (gallery.data?.pages || []).flatMap((page) => page.items),
    [gallery.data]
  );
  const galleryTotal = gallery.data?.pages[0]?.total ?? 0;

  const categoryCounts = useMemo(
    () => facetsQuery.data?.nicheCounts ?? { All: 0 },
    [facetsQuery.data]
  );
  const colorLibrary = useMemo(
    () => facetsQuery.data?.colorLibrary ?? [],
    [facetsQuery.data]
  );

  const visibleThumbnails = galleryItems;

  // Proactively fetch YouTube metrics (views, upload date, channel) via YouTube Data API v3
  useEffect(() => {
    if (galleryItems.length > 0) {
      fetchMissingYouTubeDetails(galleryItems);
    }
  }, [galleryItems]);

  // Shuffle Inspiration - shuffles all items on explicit user button click
  const handleShuffle = useCallback(() => {
    setFilters(prev => ({ ...prev, sortBy: 'random' }));
    setShuffleSeed(Date.now());
  }, []);

  // Add an upload (Restricted to the owner account)
  const handleAddThumbnail = async (item: ThumbnailItem) => {
    if (!isAdmin) return;
    await saveStoredThumbnail(item);
    invalidateGallery();
  };

  // Add multiple uploads in batch (Restricted to the owner account)
  const handleAddMultipleThumbnails = async (items: ThumbnailItem[]) => {
    if (!isAdmin) return;
    await saveStoredThumbnails(items);
    invalidateGallery();
  };

  // Permanently delete an upload. The tile vanishes optimistically from every
  // cached page at once and every modal closes; the local store write happens
  // in the background and never blocks the UI.
  const handleDeleteThumbnail = useCallback((item: ThumbnailItem) => {
    if (!isAdmin) return;
    const matches = (t: ThumbnailItem) => t.id === item.id || t.imageUrl === item.imageUrl;
    queryClient.setQueriesData<{ pages: GalleryPage[] }>({ queryKey: ['gallery'] }, (old) => {
      if (!old) return old;
      return {
        ...old,
        pages: old.pages.map((page) => ({
          ...page,
          items: page.items.filter((t) => !matches(t)),
          total: Math.max(0, page.total - page.items.filter((t) => matches(t)).length),
        })),
      };
    });
    setSelectedItem(prev => (prev && matches(prev) ? null : prev));
    setThumbnailToDelete(null);
    deleteStoredThumbnailPermanently(item).catch((err) => {
      console.error('Permanent delete failed:', err);
      setToastMessage('Delete failed. Try again.');
      window.setTimeout(() => setToastMessage(null), 4000);
    });
  }, [isAdmin, queryClient]);

  // Rename an upload title (admin only). The cached pages update
  // optimistically; the local store persists it.
  const handleEditTitle = useCallback((item: ThumbnailItem, title: string) => {
    const next = title.trim();
    if (!next) return;
    const updated = { ...item, title: next };
    const matches = (t: ThumbnailItem) => t.id === item.id || t.imageUrl === item.imageUrl;
    queryClient.setQueriesData<{ pages: GalleryPage[] }>({ queryKey: ['gallery'] }, (old) => {
      if (!old) return old;
      return {
        ...old,
        pages: old.pages.map((page) => ({
          ...page,
          items: page.items.map((t) => (matches(t) ? updated : t)),
        })),
      };
    });
    updateStoredThumbnail(updated).then(() => invalidateGallery());
    setSelectedItem(prev => (prev && matches(prev) ? updated : prev));
  }, [queryClient, invalidateGallery]);

  // Infinite scroll sentinel. One shared observer for the whole grid.
  const loadMoreRef = React.useRef<HTMLDivElement | null>(null);
  // Destructured so the effect depends on stable callbacks rather than the
  // query object, whose identity changes every render.
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = gallery;
  useEffect(() => {
    if (!hasNextPage || isFetchingNextPage) return;
    const el = loadMoreRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          fetchNextPage();
        }
      },
      { rootMargin: '600px 0px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Stable identities so React.memo on ThumbnailCard actually holds.
  const handleInspect = useCallback((item: ThumbnailItem) => {
    setSelectedItem(item);
  }, []);

  const handleRequestDelete = useCallback((item: ThumbnailItem) => {
    setThumbnailToDelete(item);
  }, []);

  const activeFilterCount =
    (filters.searchQuery.trim() ? 1 : 0) +
    (filters.selectedNiche !== 'All' ? 1 : 0) +
        filters.selectedColors.length +
    (filters.selectedEmotion ? 1 : 0);

  const resetFilters = useCallback(() => {
    setFilters({
      searchQuery: '',
      selectedNiche: 'All',
          selectedColors: [],
      selectedEmotion: null,
      sortBy: 'random'
    });
  }, []);

  const handleToggleColor = useCallback((family: ColorFamily) => {
    setFilters((prev) => ({
      ...prev,
      selectedColors: prev.selectedColors.includes(family)
        ? prev.selectedColors.filter((f) => f !== family)
        : [...prev.selectedColors, family]
    }));
  }, []);

  // Dynamic grid column class based on zoom slider (3 columns = Maximum Zoom)
  const getGridColsClass = () => {
    switch (columns) {
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
        resultCount={galleryTotal}
        columns={columns}
        onColumnsChange={handleColumnsChange}
        onShuffle={handleShuffle}
        onToggleFilter={() => setIsFilterBarOpen(prev => !prev)}
        isFilterOpen={isFilterBarOpen}
        activeFilterCount={activeFilterCount}
        onOpenAdd={isAdmin ? () => setIsAddOpen(true) : undefined}
      />

      <main className="mx-auto w-full max-w-[1800px] flex-1 px-4 pb-28 pt-3 sm:px-6 lg:px-8">
        {galleryTotal === 0 && !gallery.isLoading ? (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-line bg-surface">
              <IconUpload className="h-4 w-4 text-ink-faint" />
            </div>
            <p className="mt-4 text-sm font-medium text-ink">No uploads yet</p>
            <p className="mt-1 max-w-[34ch] text-sm text-ink-muted">
              Images you add from the Add button land here.
            </p>
            <button
              onClick={resetFilters}
              className="mt-5 cursor-pointer rounded-md bg-black px-4 py-2 text-xs font-semibold text-white shadow-card transition-opacity duration-200 hover:opacity-90 active:scale-[0.98] dark:bg-black dark:text-white dark:border dark:border-white/15"
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
                  poster={false}
                  // Uploads are a personal image shelf, so they render
                  // image-only: there is no title/creator block to show.
                  showCardInfo={false}
                  onInspect={handleInspect}
                  onDelete={isAdmin ? handleRequestDelete : undefined}
                />
              ))}
            </div>

            {/* Paging footer: infinite scroll with an explicit control. */}
            {gallery.hasNextPage && (
              <div className="mt-8 flex flex-col items-center gap-3">
                <div ref={loadMoreRef} aria-hidden="true" className="h-1 w-full" />
                <button
                  type="button"
                  onClick={() => gallery.fetchNextPage()}
                  disabled={gallery.isFetchingNextPage}
                  className="cursor-pointer rounded-md bg-black px-4 py-2 text-xs font-semibold text-white shadow-card transition-all duration-200 hover:bg-black/85 active:scale-[0.98] disabled:opacity-60 dark:bg-black dark:text-white dark:border dark:border-white/15"
                >
                  {gallery.isFetchingNextPage ? 'Loading…' : 'Load more'}
                </button>
              </div>
            )}
            {gallery.isLoading && visibleThumbnails.length === 0 && (
              <div className="flex justify-center py-24 text-xs text-ink-faint">Loading…</div>
            )}
          </>
        )}
      </main>

      {/* Filter panel, anchored under the top bar */}
      <FilterPillBar
        isVisible={isFilterBarOpen}
        filters={filters}
        onSelectCategory={(cat) => setFilters(prev => ({ ...prev, selectedNiche: cat }))}
        onToggleColor={handleToggleColor}
        onResetFilters={resetFilters}
        onClose={() => setIsFilterBarOpen(false)}
        categoryCounts={categoryCounts}
        colorLibrary={colorLibrary}
        resultCount={galleryTotal}
        isLoadingFacets={facetsQuery.isLoading}
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
