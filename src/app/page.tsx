'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { AppSidebar } from '../components/AppSidebar';
import { AppHeader } from '../components/AppHeader';
import { ThumbnailCard } from '../components/ThumbnailCard';
import { MoodboardDrawer } from '../components/MoodboardDrawer';
import { AddModal } from '../components/AddModal';
import { ThumbnailModal } from '../components/ThumbnailModal';
import { DeleteConfirmModal } from '../components/DeleteConfirmModal';
import { ThumbnailItem, FilterState, CollectionBoard } from '../lib/types';
import { useAuth } from '../lib/authContext';
import {
  saveStoredThumbnail,
  saveStoredThumbnails,
  deleteStoredThumbnailPermanently,
  updateStoredThumbnail,
  getStoredCollections,
  saveCollection,
  deleteCollection,
  toggleThumbnailInCollection,
  syncBoardsFromServer,
  syncBoardsToServer,
  clearLocalUserCollections,
} from '../lib/storage';
import {
  getAllCategories,
  addCategory,
  removeCategory,
  subscribeCategories,
  syncCategoriesFromServer,
} from '../lib/categories';
import { useGallery, useGalleryFacets, useInvalidateGallery, GALLERY_PAGE_SIZE } from '../lib/useGallery';
import { extractItemFingerprint } from '../lib/thumbnailDedupe';
import { formatShortViews } from '../lib/formatViews';
import { updateCachedYouTubeDetail } from '../lib/youtubeMetadataCache';
import { useQueryClient } from '@tanstack/react-query';
import { Compass, Sparkles, X, Plus } from 'lucide-react';

const DEFAULT_SHUFFLE_SEED = 882391;

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

export default function HomePage() {
  const { user, isAdmin, getIdToken, loading: authLoading } = useAuth();
  const invalidateGallery = useInvalidateGallery();

  // Navigation & View State
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [columns, setColumns] = useState<number>(4);
  const [showCardInfo, setShowCardInfo] = useState<boolean>(false); // default false for Image 1 pure thumbnail look
  const [shuffleSeed, setShuffleSeed] = useState<number>(DEFAULT_SHUFFLE_SEED);

  // Modals & Panels State
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isMoodboardOpen, setIsMoodboardOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ThumbnailItem | null>(null);
  const [thumbnailToDelete, setThumbnailToDelete] = useState<ThumbnailItem | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Collections / Boards State
  const [collections, setCollections] = useState<CollectionBoard[]>([]);
  const [activeCollectionId, setActiveCollectionId] = useState<string>('');
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null);

  // Categories State
  const [categories, setCategories] = useState<string[]>([]);

  // Filters State
  const [filters, setFilters] = useState<FilterState>({
    searchQuery: '',
    selectedNiche: 'All',
    selectedStyles: [],
    selectedColors: [],
    selectedEmotion: null,
    sortBy: 'random'
  });

  const invalidateRef = useRef(invalidateGallery);
  useEffect(() => {
    invalidateRef.current = invalidateGallery;
  }, [invalidateGallery]);

  // Restore stored preferences and sync on mount
  useEffect(() => {
    try {
      const storedCols = localStorage.getItem('thumbfeed_columns');
      if (storedCols) {
        const val = parseInt(storedCols, 10);
        if (val >= 2 && val <= 6) setColumns(val);
      }
      const storedCardInfo = localStorage.getItem('thumbfeed_show_card_info');
      if (storedCardInfo !== null) {
        setShowCardInfo(storedCardInfo === 'true');
      }
      const storedCollapsed = localStorage.getItem('thumbfeed_sidebar_collapsed');
      if (storedCollapsed !== null) {
        setIsSidebarCollapsed(storedCollapsed === 'true');
      }
      setCategories(getAllCategories());
    } catch {}

    syncCategoriesFromServer().then((c) => {
      if (Array.isArray(c)) setCategories(c);
    }).catch(() => {});

    const handleR2Synced = () => {
      syncCategoriesFromServer().then((c) => {
        if (Array.isArray(c)) setCategories(c);
      }).catch(() => {});
      invalidateRef.current();
    };

    window.addEventListener('thumbfeed_r2_synced', handleR2Synced);
    return () => {
      window.removeEventListener('thumbfeed_r2_synced', handleR2Synced);
    };
  }, []);

  // Keep user boards strictly scoped to the signed-in account
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      clearLocalUserCollections();
      setCollections([]);
      setSelectedBoardId(null);
      setActiveCollectionId('');
      return;
    }

    setCollections(getStoredCollections());
    syncBoardsFromServer()
      .then((b) => {
        if (Array.isArray(b)) setCollections(b);
      })
      .catch(() => {});

    const handleR2SyncedBoards = () => {
      syncBoardsFromServer()
        .then((b) => {
          if (Array.isArray(b)) setCollections(b);
        })
        .catch(() => {});
    };
    window.addEventListener('thumbfeed_r2_synced', handleR2SyncedBoards);
    return () => {
      window.removeEventListener('thumbfeed_r2_synced', handleR2SyncedBoards);
    };
  }, [authLoading, user]);

  // Auto-dismiss transient toast notifications
  useEffect(() => {
    if (!toastMessage) return;
    const timer = window.setTimeout(() => setToastMessage(null), 3500);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  // Subscribe to category updates
  useEffect(() => {
    const unsub = subscribeCategories((cats) => setCategories(cats));
    return () => unsub();
  }, []);

  const handleToggleSidebar = useCallback(() => {
    setIsSidebarCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem('thumbfeed_sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
  }, []);

  const handleToggleCardInfo = useCallback((forceVal?: boolean) => {
    setShowCardInfo(prev => {
      const next = typeof forceVal === 'boolean' ? forceVal : !prev;
      try {
        localStorage.setItem('thumbfeed_show_card_info', String(next));
      } catch {}
      return next;
    });
  }, []);

  const handleColumnsChange = useCallback((cols: number) => {
    const val = Math.min(6, Math.max(2, cols));
    setColumns(val);
    try {
      localStorage.setItem('thumbfeed_columns', String(val));
    } catch {}
  }, []);

  const handleShuffle = useCallback(() => {
    setFilters(prev => ({ ...prev, sortBy: 'random' }));
    setShuffleSeed(Date.now());
  }, []);

  // Category Add / Remove
  const handleAddCategory = useCallback((name: string) => {
    const updated = addCategory(name);
    setCategories(updated);
  }, []);

  const handleRemoveCategory = useCallback((name: string) => {
    const updated = removeCategory(name);
    setCategories(updated);
    if (filters.selectedNiche.toLowerCase() === name.toLowerCase()) {
      setFilters(prev => ({ ...prev, selectedNiche: 'All' }));
    }
  }, [filters.selectedNiche]);

  // Server Gallery queries
  const debouncedSearch = useDebouncedValue(filters.searchQuery.trim(), 350);
  const galleryKey = useMemo(() => ({
    section: 'thumbnails' as const,
    search: debouncedSearch,
    niche: filters.selectedNiche,
    styles: filters.selectedStyles,
    colors: filters.selectedColors,
    sort: filters.sortBy,
    seed: shuffleSeed,
  }), [debouncedSearch, filters.selectedNiche, filters.selectedStyles, filters.selectedColors, filters.sortBy, shuffleSeed]);

  const gallery = useGallery(galleryKey);
  const facetsQuery = useGalleryFacets('thumbnails');
  const queryClient = useQueryClient();

  const galleryItems = useMemo(() => {
    const raw = (gallery.data?.pages || []).flatMap((page) => page.items);
    const seenIds = new Set<string>();
    const seenFingerprints = new Set<string>();
    const deduped: ThumbnailItem[] = [];

    for (const item of raw) {
      if (!item || !item.id) continue;
      const fp = extractItemFingerprint(item);

      if (!seenIds.has(item.id) && !seenFingerprints.has(fp)) {
        seenIds.add(item.id);
        seenFingerprints.add(fp);
        deduped.push(item);
      }
    }
    return deduped;
  }, [gallery.data]);
  const galleryTotal = gallery.data?.pages[0]?.total ?? 0;
  const fullLibraryTotal = facetsQuery.data?.total ?? galleryTotal;

  const categoryCounts = useMemo(
    () => facetsQuery.data?.nicheCounts ?? { All: 0 },
    [facetsQuery.data]
  );

  // If a board is selected, filter items to that board
  const displayedItems = useMemo(() => {
    if (!selectedBoardId) return galleryItems;
    const board = collections.find(c => c.id === selectedBoardId);
    if (!board) return galleryItems;
    return galleryItems.filter(item => board.thumbnailIds?.includes(item.id));
  }, [galleryItems, selectedBoardId, collections]);

  const displayedTotal = selectedBoardId ? displayedItems.length : galleryTotal;

  // Infinite scroll
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = gallery;
  useEffect(() => {
    if (!hasNextPage || isFetchingNextPage || selectedBoardId) return;
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
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, selectedBoardId]);

  // Add handlers
  const handleAddThumbnail = (item: ThumbnailItem) => {
    saveStoredThumbnail(item);
    invalidateGallery();
    setCollections(getStoredCollections());
  };

  const handleAddMultipleThumbnails = (items: ThumbnailItem[]) => {
    saveStoredThumbnails(items);
    invalidateGallery();
    setCollections(getStoredCollections());
  };

  const handleDeleteThumbnail = async (item: ThumbnailItem) => {
    // 1. Immediately close modals
    setThumbnailToDelete(null);
    if (selectedItem?.id === item.id || selectedItem?.imageUrl === item.imageUrl) {
      setSelectedItem(null);
    }

    // 2. Optimistically update React Query cache for instant 0ms removal
    queryClient.setQueriesData({ queryKey: ['gallery'] }, (old: any) => {
      if (!old || !old.pages) return old;
      return {
        ...old,
        pages: old.pages.map((p: any) => ({
          ...p,
          items: (p.items || []).filter((it: ThumbnailItem) => {
            if (it.id && item.id && it.id === item.id) return false;
            if (it.imageUrl && item.imageUrl && it.imageUrl === item.imageUrl) return false;
            return true;
          }),
          total: Math.max(0, (p.total || 0) - 1),
        })),
      };
    });

    // 3. Remove from any boards and persist cleaned boards to server/R2
    setCollections(prev => {
      let changed = false;
      const cleaned = prev.map(b => {
        if (!b.thumbnailIds.includes(item.id)) return b;
        changed = true;
        return {
          ...b,
          thumbnailIds: b.thumbnailIds.filter(id => id !== item.id),
        };
      });
      if (changed) {
        syncBoardsToServer(cleaned);
      }
      return cleaned;
    });

    setToastMessage('Thumbnail deleted');

    // 4. Delete permanently from server storage bucket, catalog, and database
    try {
      await deleteStoredThumbnailPermanently({ id: item.id, imageUrl: item.imageUrl });
      invalidateGallery();
    } catch (e) {
      console.warn('Permanent deletion error:', e);
    }
  };

  const handleEditMetadata = async (
    item: ThumbnailItem,
    updates: { title: string; creator: string; viewsEstimate: string }
  ) => {
    const cleanTitle = updates.title.trim().slice(0, 180) || item.title;
    const cleanCreator = updates.creator.trim().slice(0, 100);
    const rawViews = updates.viewsEstimate.trim();
    const cleanViews = rawViews ? formatShortViews(rawViews) || rawViews.slice(0, 32) : '';

    const updated: ThumbnailItem = {
      ...item,
      title: cleanTitle,
      creator: cleanCreator || undefined,
      viewsEstimate: cleanViews || undefined,
    };

    updateCachedYouTubeDetail(updated, {
      title: cleanTitle,
      creator: cleanCreator,
      views: cleanViews,
    });
    updateStoredThumbnail(updated);
    setSelectedItem(updated);

    // Optimistically update React Query gallery cache immediately
    queryClient.setQueriesData({ queryKey: ['gallery'] }, (old: any) => {
      if (!old || !old.pages) return old;
      return {
        ...old,
        pages: old.pages.map((p: any) => ({
          ...p,
          items: (p.items || []).map((it: ThumbnailItem) =>
            it.id === item.id || it.imageUrl === item.imageUrl
              ? {
                  ...it,
                  title: cleanTitle,
                  creator: cleanCreator || undefined,
                  viewsEstimate: cleanViews || undefined,
                }
              : it
          ),
        })),
      };
    });

    try {
      const token = await getIdToken();
      if (!token) {
        setToastMessage('Sign in as admin to sync edits to cloud');
        return;
      }
      const res = await fetch('/api/thumbnails/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          id: item.id,
          imageUrl: item.imageUrl,
          title: cleanTitle,
          creator: cleanCreator,
          viewsEstimate: cleanViews,
        }),
      });
      if (res.ok) {
        setToastMessage('Details updated');
      } else {
        setToastMessage('Updated locally (server sync failed)');
      }
      invalidateGallery();
    } catch (e) {
      console.warn('Failed to persist metadata update:', e);
    }
  };

  // Boards / Collections Handlers
  const handleCreateCollection = (name: string, desc: string) => {
    if (!user) {
      setToastMessage('Sign in with Google to create synced boards.');
      return;
    }
    const newId =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? `board-${crypto.randomUUID().slice(0, 8)}`
        : `board-${Date.now()}`;
    const newBoard: CollectionBoard = {
      id: newId,
      name,
      description: desc,
      thumbnailIds: [],
      createdAt: new Date().toISOString()
    };
    const updated = saveCollection(newBoard);
    setCollections(updated);
    setActiveCollectionId(newBoard.id);
  };

  const handleDeleteCollection = (id: string) => {
    const updated = deleteCollection(id);
    setCollections(updated);
    if (selectedBoardId === id) setSelectedBoardId(null);
    if (activeCollectionId === id) setActiveCollectionId(updated[0]?.id || '');
  };

  const handleRemoveFromCollection = (thumbId: string) => {
    if (!activeCollectionId) return;
    const updated = toggleThumbnailInCollection(activeCollectionId, thumbId);
    setCollections(updated);
  };

  // Dynamic grid class based on columns
  const getGridColsClass = () => {
    switch (columns) {
      case 2:
        return 'grid-cols-1 sm:grid-cols-2';
      case 3:
        return 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3';
      case 4:
        return 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4';
      case 5:
        return 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5';
      case 6:
        return 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6';
      default:
        return 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4';
    }
  };

  const activeBoardObj = selectedBoardId ? collections.find(c => c.id === selectedBoardId) : null;
  const activeFilterNames: string[] = [];
  if (filters.selectedNiche && filters.selectedNiche !== 'All') {
    activeFilterNames.push(filters.selectedNiche);
  }
  if (filters.selectedStyles.length > 0) {
    activeFilterNames.push(...filters.selectedStyles);
  }
  if (filters.selectedColors.length > 0) {
    activeFilterNames.push(...filters.selectedColors);
  }
  if (filters.selectedEmotion) {
    activeFilterNames.push(filters.selectedEmotion);
  }

  const hasActiveContext = Boolean(activeBoardObj || activeFilterNames.length > 0);
  const currentViewTitle = activeBoardObj
    ? activeBoardObj.name
    : activeFilterNames.length > 0
      ? activeFilterNames.join(' · ')
      : 'Explore';

  const handleClearContext = useCallback(() => {
    setSelectedBoardId(null);
    setFilters(prev => ({
      ...prev,
      selectedNiche: 'All',
      selectedStyles: [],
      selectedColors: [],
      selectedEmotion: null,
    }));
  }, []);

  return (
    <div className="min-h-screen bg-[#090a0d] text-white flex select-none overflow-x-hidden">
      
      {/* Sleek Sidebar */}
      <AppSidebar
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={handleToggleSidebar}
        selectedNiche={filters.selectedNiche}
        onSelectNiche={(niche) => {
          setFilters(prev => ({ ...prev, selectedNiche: niche }));
          setSelectedBoardId(null);
        }}
        categoryCounts={categoryCounts}
        collections={collections}
        selectedBoardId={selectedBoardId}
        onSelectBoard={(boardId) => setSelectedBoardId(boardId)}
        onOpenMoodboard={() => {
          if (!user) {
            setToastMessage('Sign in with Google from the sidebar to create and sync boards.');
            return;
          }
          setIsMoodboardOpen(true);
        }}
        onOpenAdd={isAdmin ? () => setIsAddOpen(true) : undefined}
        onShuffle={handleShuffle}
        categories={categories}
        onAddCategory={isAdmin ? handleAddCategory : undefined}
        onRemoveCategory={isAdmin ? handleRemoveCategory : undefined}
        totalThumbnailsCount={fullLibraryTotal}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main Content Pane */}
      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-200 ${
          isSidebarCollapsed ? 'md:ml-[68px]' : 'md:ml-[260px]'
        }`}
      >
        {/* Sleek Obsidian Header */}
        <AppHeader
          query={filters.searchQuery}
          onQueryChange={(q) => setFilters(prev => ({ ...prev, searchQuery: q }))}
          resultCount={displayedTotal}
          selectedNiche={currentViewTitle}
          hasActiveContext={hasActiveContext}
          onClearContext={handleClearContext}
          columns={columns}
          onColumnsChange={handleColumnsChange}
          showCardInfo={showCardInfo}
          onToggleCardInfo={handleToggleCardInfo}
          onShuffle={handleShuffle}
          isSidebarCollapsed={isSidebarCollapsed}
          onToggleSidebar={() => {
            if (window.innerWidth < 768) {
              setIsMobileSidebarOpen(true);
            } else {
              handleToggleSidebar();
            }
          }}
        />

        {/* Gallery Feed Stage */}
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-5">

          {/* Empty State */}
          {displayedItems.length === 0 && !gallery.isLoading ? (
            <div className="flex flex-col items-center justify-center py-24 text-center max-w-sm mx-auto">
              <div className="w-12 h-12 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-center text-white/30 mb-4">
                <Compass className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-medium text-white/80">No thumbnails found</h3>
              <p className="text-xs text-white/40 mt-1">
                {selectedBoardId
                  ? 'This board is empty. Inspect thumbnails in the feed to save them here.'
                  : filters.searchQuery
                    ? 'Try adjusting your search terms.'
                    : 'Get started by uploading or importing YouTube thumbnails.'}
              </p>

              <div className="mt-5 flex gap-2">
                {selectedBoardId ? (
                  <button
                    type="button"
                    onClick={() => setSelectedBoardId(null)}
                    className="px-3.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-xs font-medium text-white transition-colors"
                  >
                    View All Feed
                  </button>
                ) : filters.searchQuery || filters.selectedNiche !== 'All' ? (
                  <button
                    type="button"
                    onClick={() => setFilters(prev => ({ ...prev, searchQuery: '', selectedNiche: 'All' }))}
                    className="px-3.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-xs font-medium text-white transition-colors"
                  >
                    Clear Filters
                  </button>
                ) : isAdmin ? (
                  <button
                    type="button"
                    onClick={() => setIsAddOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white text-black text-xs font-semibold hover:bg-neutral-200 transition-colors shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>Add Thumbnails</span>
                  </button>
                ) : null}
              </div>
            </div>
          ) : (
            <>
              {/* Thumbnail Grid */}
              <div className={`grid ${getGridColsClass()} gap-4 sm:gap-5`}>
                {displayedItems.map((item, index) => (
                  <ThumbnailCard
                    key={item.id}
                    item={item}
                    index={index}
                    showCardInfo={showCardInfo}
                    onInspect={setSelectedItem}
                    onDelete={isAdmin ? setThumbnailToDelete : undefined}
                    collections={collections}
                    onCollectionsChange={setCollections}
                  />
                ))}
              </div>

              {/* Infinite scroll load more */}
              {gallery.hasNextPage && !selectedBoardId && (
                <div className="mt-10 flex flex-col items-center gap-3">
                  <div ref={loadMoreRef} aria-hidden="true" className="h-1 w-full" />
                  <button
                    type="button"
                    onClick={() => gallery.fetchNextPage()}
                    disabled={gallery.isFetchingNextPage}
                    className="px-4 py-2 rounded-lg border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] hover:border-white/20 text-xs font-medium text-white/80 transition-all disabled:opacity-50 active:scale-[0.98]"
                  >
                    {gallery.isFetchingNextPage ? 'Loading…' : 'Load more'}
                  </button>
                </div>
              )}

              {gallery.isLoading && displayedItems.length === 0 && (
                <div className="flex justify-center py-24 text-xs font-mono text-white/30">
                  Loading feed…
                </div>
              )}
            </>
          )}

        </main>
      </div>

      {/* Moodboard Drawer */}
      <MoodboardDrawer
        isOpen={isMoodboardOpen}
        onClose={() => setIsMoodboardOpen(false)}
        savedThumbnails={galleryItems}
        collections={collections}
        activeCollectionId={activeCollectionId || (collections[0]?.id || '')}
        onSelectCollection={setActiveCollectionId}
        onCreateCollection={handleCreateCollection}
        onDeleteCollection={handleDeleteCollection}
        onRemoveItem={handleRemoveFromCollection}
        onInspectItem={setSelectedItem}
      />

      {/* Add Modal (Admin only) */}
      {isAdmin && (
        <AddModal
          isOpen={isAddOpen}
          onClose={() => setIsAddOpen(false)}
          onAddThumbnail={handleAddThumbnail}
          onAddMultipleThumbnails={handleAddMultipleThumbnails}
          collections={collections}
        />
      )}

      {/* Thumbnail Inspection Modal */}
      <ThumbnailModal
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
        onDelete={isAdmin ? handleDeleteThumbnail : undefined}
        onEditMetadata={isAdmin ? handleEditMetadata : undefined}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        item={thumbnailToDelete}
        isOpen={Boolean(thumbnailToDelete)}
        onClose={() => setThumbnailToDelete(null)}
        onConfirm={handleDeleteThumbnail}
      />

      {/* Toast Notification Banner */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-5 right-5 z-50 px-4 py-2.5 rounded-xl bg-[#151821] border border-white/15 text-white text-xs shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-2"
        >
          <span>{toastMessage}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            aria-label="Dismiss notification"
            className="text-white/40 hover:text-white transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

    </div>
  );
}
