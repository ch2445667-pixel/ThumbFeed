'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { TopBar } from '../components/TopBar';
import { ThumbnailCard } from '../components/ThumbnailCard';
import { FilterPillBar } from '../components/FilterPillBar';
import { type ColorFamily } from '../lib/colorFamilies';
import { AddModal } from '../components/AddModal';
import { ThumbnailModal } from '../components/ThumbnailModal';
import { DeleteConfirmModal } from '../components/DeleteConfirmModal';
import { IconTrash, IconFilm, IconImage, IconUploadCloud } from '../components/icons/AppIcons';
import { ThumbnailItem, FilterState, NicheCategory } from '../lib/types';
import { ViewModeToggle } from '../components/ViewModeToggle';
import { useAuth } from '../lib/authContext';
import {
  saveStoredThumbnail,
  saveStoredThumbnails,
  getStoredPosters,
  saveStoredPosters,
  persistPosterList,
  deleteStoredThumbnailPermanently,
  updateStoredThumbnail
} from '../lib/storage';
import { useGallery, useGalleryFacets, useInvalidateGallery, GALLERY_PAGE_SIZE, type GalleryPage } from '../lib/useGallery';
import { useQueryClient } from '@tanstack/react-query';

/** Shuffle seed, also sent to the gallery API so server-side random order matches. */
const DEFAULT_SHUFFLE_SEED = 882391;

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

// Tiles per server page. One page is metadata for 36 tiles -- tens of
// kilobytes -- and the infinite query accumulates pages only as the user
// scrolls, so a visit never downloads the table.
const PAGE_SIZE = GALLERY_PAGE_SIZE;

export default function HomePage() {
  const { isAdmin } = useAuth();

  // The gallery lives on the server now, paged 36 at a time through
  // /api/gallery and cached by React Query. There is no local mirror state:
  // pages accumulate in the query cache, mutations invalidate it, and the
  // realtime channel invalidates on any database change.

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

  const [isSyncingPosters, setIsSyncingPosters] = useState<boolean>(false);

  // Switching walls resets the category scope, which belongs to thumbnails.
  // No explicit sync call: the section is part of the gallery query key, so
  // switching mounts the other wall's cached pages (or fetches page 0 once).
  const handleSectionChange = useCallback((next: 'thumbnails' | 'posters') => {
    setSection(next);
    try {
      localStorage.setItem('thumbfeed_section', next);
    } catch {}
    setFilters(prev => ({
      ...prev,
      selectedNiche: 'All',
      selectedStyles: [],
      selectedColors: [],
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
  // is served by the gallery query keyed on the section, so both walls share
  // one pipeline without a local mirror.

  // Default sort is 'random' (Shuffle) so feed is always dynamically shuffled from start
  const [filters, setFilters] = useState<FilterState>({
    searchQuery: '',
    selectedNiche: 'All',
    selectedStyles: [],
    selectedColors: [],
    selectedEmotion: null,
    sortBy: 'random'
  });

  // The wall is server state now. One infinite query per filter combination,
  // paged 36 rows at a time through /api/gallery. Filtering, sorting and the
  // seeded shuffle all happen server-side, so the client never holds the table
  // and a filter change costs one page, not a full sync.
  //
  // Deliberately gone from the old implementation:
  //  - the 60s poll that re-downloaded the table on a timer;
  //  - the window-focus and visibilitychange handlers that refetched on every
  //    tab switch (a focus event is not new data);
  //  - client-side filtering over a full local mirror.
  // Live updates arrive through the realtime channel in useGallery, which
  // invalidates the query instead of polling.
  const debouncedSearch = useDebouncedValue(filters.searchQuery.trim(), 500);
  const galleryKey = useMemo(() => ({
    section,
    search: debouncedSearch,
    niche: filters.selectedNiche,
    styles: filters.selectedStyles,
    colors: filters.selectedColors,
    sort: filters.sortBy,
    seed: shuffleSeed,
  }), [section, debouncedSearch, filters.selectedNiche, filters.selectedStyles, filters.selectedColors, filters.sortBy, shuffleSeed]);

  const gallery = useGallery(galleryKey);
  const facetsQuery = useGalleryFacets(section);
  const invalidateGallery = useInvalidateGallery();
  const queryClient = useQueryClient();

  const galleryItems = useMemo(
    () => (gallery.data?.pages || []).flatMap((page) => page.items),
    [gallery.data]
  );
  const galleryTotal = gallery.data?.pages[0]?.total ?? 0;

  // Manual sync button: bust the cache. Active queries refetch by themselves.
  const handleSyncPosters = useCallback(async () => {
    setIsSyncingPosters(true);
    try {
      await invalidateGallery();
    } catch (e) {
      console.warn('Error syncing posters:', e);
    } finally {
      setIsSyncingPosters(false);
    }
  }, [invalidateGallery]);

  // Category counts and the colour library arrive with the facets query,
  // computed server-side over the whole wall. The grid pages below never need
  // the full list, so counts no longer require downloading it.
  const categoryCounts = useMemo(
    () => facetsQuery.data?.nicheCounts ?? { All: 0 },
    [facetsQuery.data]
  );
  const colorLibrary = useMemo(
    () => facetsQuery.data?.colorLibrary ?? [],
    [facetsQuery.data]
  );

  // The wall renders the accumulated server pages in order. Filtering, sorting
  // and the seeded shuffle all happened server-side, so there is no second
  // client-side pass and paging can never reshuffle what is on screen.
  const filteredThumbnails = galleryItems;

  // Shuffle Inspiration - shuffles all items on explicit user button click
  const handleShuffle = useCallback(() => {
    setFilters(prev => ({ ...prev, sortBy: 'random' }));
    setShuffleSeed(Date.now());
  }, []);

  // Add Thumbnail (Restricted to shivashiva66407@gmail.com)
  const handleAddThumbnail = (item: ThumbnailItem) => {
    if (!isAdmin) return;
    saveStoredThumbnail(item);
    invalidateGallery();
  };

  // Add Multiple Thumbnails in batch (Restricted to shivashiva66407@gmail.com)
  const handleAddMultipleThumbnails = (items: ThumbnailItem[]) => {
    if (!isAdmin) return;
    const posterItems = items.filter(i => i.kind === 'poster');
    const thumbItems = items.filter(i => i.kind !== 'poster');
    if (posterItems.length > 0) {
      saveStoredPosters(posterItems);
    }
    if (thumbItems.length > 0) {
      saveStoredThumbnails(thumbItems);
    }
    // The rows already exist server-side (the upload route wrote them), so a
    // single invalidation brings them into the feed. No local mirror to update.
    invalidateGallery();
  };

  // Permanently delete a thumbnail. The tile vanishes optimistically from every
  // cached page at once and every modal closes; the storage, database and
  // bucket deletes run in the background and never block the UI. Only a
  // failure surfaces a message.
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
    deleteStoredThumbnailPermanently(item).then((result) => {
      // The tile is already gone from the UI. If the server could not also
      // remove the stored file, say so rather than reporting a clean delete.
      if (result && result.storageRemovalFailed) {
        setToastMessage(
          'Removed from the app, but the file is still in the Supabase bucket. ' +
            'Add SUPABASE_SERVICE_ROLE_KEY to .env to allow permanent file deletion.'
        );
        window.setTimeout(() => setToastMessage(null), 6000);
      }
    }).catch((err) => {
      console.error('Permanent delete failed:', err);
      setToastMessage('Delete failed. Check your connection and try again.');
      window.setTimeout(() => setToastMessage(null), 4000);
    });
  }, [isAdmin, queryClient]);

  // Rename a thumbnail title (admin only). The cached pages update
  // optimistically; the metadata upsert inside persists it server-side.
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
    if (item.kind === 'poster') {
      const currentPosters = getStoredPosters().map((t) => (matches(t) ? updated : t));
      persistPosterList(currentPosters);
    } else {
      updateStoredThumbnail(updated);
    }
    setSelectedItem(prev => (prev && matches(prev) ? updated : prev));
  }, [queryClient]);

  // The wall renders the accumulated pages. Infinite scroll appends the next
  // server page; a filter change swaps the query key, which starts over at
  // page 0 by construction -- no manual page counter to reset.
  const visibleThumbnails = filteredThumbnails;

  // Infinite scroll sentinel. One shared observer for the whole grid.
  const loadMoreRef = React.useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!gallery.hasNextPage || gallery.isFetchingNextPage) return;
    const el = loadMoreRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          gallery.fetchNextPage();
        }
      },
      // Prefetch well ahead so scrolling never visibly stalls. Kept under the
      // browser's own lazy-image threshold so tiles are mounted just before
      // they are needed rather than a full screen early.
      { rootMargin: '600px 0px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [gallery.hasNextPage, gallery.isFetchingNextPage, gallery.fetchNextPage]);

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
    filters.selectedColors.length +
    (filters.selectedEmotion ? 1 : 0);

  const resetFilters = useCallback(() => {
    setFilters({
      searchQuery: '',
      selectedNiche: 'All',
      selectedStyles: [],
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

  // Colour strip data for the filter panel comes from the facets query above.

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

  // Pinterest-style masonry for posters. Safe now that every card reserves its
  // true height from recorded dimensions: the columns re-balance once at
  // layout and never again, because no tile changes size once mounted. With
  // unknown dimensions this was the cause of the flickering, shuffling wall.
  const getPosterColsClass = () => {
    switch (posterColumns) {
      case 3:
        return 'columns-2 sm:columns-2 lg:columns-3';
      case 4:
        return 'columns-2 sm:columns-3 md:columns-3 lg:columns-4';
      case 6:
        return 'columns-2 sm:columns-3 md:columns-4 lg:columns-6';
      case 5:
      default:
        return 'columns-2 sm:columns-3 md:columns-4 lg:columns-5';
    }
  };

  return (
    <div className="flex min-h-[100dvh] flex-col bg-canvas pb-12 text-ink transition-colors duration-200 pt-16">

      {/* Top Header: brand, search, gallery controls, theme, account */}
      <TopBar
        query={filters.searchQuery}
        onQueryChange={(q) => setFilters(prev => ({ ...prev, searchQuery: q }))}
        resultCount={galleryTotal}
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
            {section === 'posters' && (
              <button
                type="button"
                onClick={handleSyncPosters}
                disabled={isSyncingPosters}
                className="flex cursor-pointer items-center gap-1.5 rounded-md border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink shadow-card transition-colors duration-200 hover:border-line-strong hover:bg-surface-raised active:scale-[0.98] disabled:opacity-60"
                title="Import and sync posters from Supabase"
              >
                <IconUploadCloud className={`h-3.5 w-3.5 ${isSyncingPosters ? 'animate-spin' : ''}`} />
                <span>{isSyncingPosters ? 'Syncing...' : 'Sync from Supabase'}</span>
              </button>
            )}
          </div>
        </div>

        {galleryTotal === 0 && !gallery.isLoading ? (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-line bg-surface">
              {section === 'posters' ? (
                <IconFilm className="h-4 w-4 text-ink-faint" />
              ) : (
                <IconImage className="h-4 w-4 text-ink-faint" />
              )}
            </div>
            <p className="mt-4 text-sm font-medium text-ink">
              {section === 'thumbnails' ? 'No thumbnails in vault' : 'No posters found'}
            </p>
            <p className="mt-1 max-w-[34ch] text-sm text-ink-muted">
              {section === 'thumbnails'
                ? 'All previous thumbnails have been cleared. Upload or extract YouTube links to add new thumbnails.'
                : 'No posters match your current search or filters. Sync from Supabase or import new posters.'}
            </p>
            {section === 'posters' ? (
              <button
                onClick={handleSyncPosters}
                disabled={isSyncingPosters}
                className="mt-5 cursor-pointer rounded-md bg-accent px-3.5 py-2 text-xs font-medium text-accent-on transition-opacity duration-200 hover:opacity-90 active:scale-[0.98]"
              >
                {isSyncingPosters ? 'Syncing...' : 'Sync Posters from Supabase'}
              </button>
            ) : (
              <button
                onClick={resetFilters}
                className="mt-5 cursor-pointer rounded-md bg-accent px-3.5 py-2 text-xs font-medium text-accent-on transition-opacity duration-200 hover:opacity-90 active:scale-[0.98]"
              >
                Reset filters
              </button>
            )}
          </div>
        ) : (
          <>
            {section === 'posters' ? (
              <div className={`${getPosterColsClass()} gap-3 sm:gap-4`}>
                {visibleThumbnails.map((item, index) => (
                  <div key={item.id} className="mb-3 break-inside-avoid sm:mb-4">
                    <ThumbnailCard
                      item={item}
                      index={index}
                      poster={true}
                      showCardInfo={false}
                      onInspect={handleInspect}
                      onDelete={isAdmin ? handleRequestDelete : undefined}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className={`grid ${getGridColsClass()} gap-3 sm:gap-4`}>
                {visibleThumbnails.map((item, index) => (
                  <ThumbnailCard
                    key={item.id}
                    item={item}
                    index={index}
                    poster={false}
                    showCardInfo={showCardInfo}
                    onInspect={handleInspect}
                    onDelete={isAdmin ? handleRequestDelete : undefined}
                  />
                ))}
              </div>
            )}

            {/* Paging footer: infinite scroll with an explicit control. */}
            {gallery.hasNextPage && (
              <div className="mt-8 flex flex-col items-center gap-3">
                <div ref={loadMoreRef} aria-hidden="true" className="h-1 w-full" />
                <button
                  type="button"
                  onClick={() => gallery.fetchNextPage()}
                  disabled={gallery.isFetchingNextPage}
                  className="cursor-pointer rounded-md border border-line bg-surface px-4 py-2 text-xs font-medium text-ink shadow-card transition-colors duration-200 hover:border-line-strong hover:bg-surface-raised active:scale-[0.98] disabled:opacity-60"
                >
                  {gallery.isFetchingNextPage ? 'Loading…' : 'Load more'}
                </button>
              </div>
            )}
            {gallery.isLoading && filteredThumbnails.length === 0 && (
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
        colorLibrary={section === 'thumbnails' ? colorLibrary : []}
        resultCount={galleryTotal}
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
