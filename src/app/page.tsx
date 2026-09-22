'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { TopBar } from '../components/TopBar';
import { ThumbnailCard } from '../components/ThumbnailCard';
import { FloatingDock } from '../components/FloatingDock';
import { FilterPillBar } from '../components/FilterPillBar';
import { SearchModal } from '../components/SearchModal';
import { AddModal } from '../components/AddModal';
import { ThumbnailModal } from '../components/ThumbnailModal';
import { DeleteConfirmModal } from '../components/DeleteConfirmModal';
import { IconTrash } from '../components/icons/AppIcons';
import { ThumbnailItem, FilterState, NicheCategory } from '../lib/types';
import { INITIAL_THUMBNAILS } from '../lib/mockData';
import { useAuth } from '../lib/authContext';
import {
  saveStoredThumbnail,
  saveStoredThumbnails,
  fetchLiveSupabaseThumbnails,
  getStoredThumbnails,
  deleteStoredThumbnailPermanently
} from '../lib/storage';
import { supabase } from '../lib/supabase';
import { preloadAllThumbnails, prioritizeUpcomingThumbnails } from '../lib/imageCache';

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

export default function HomePage() {
  const { isAdmin } = useAuth();

  // Initialize with deterministic INITIAL_THUMBNAILS for exact SSR & Client hydration parity
  const [thumbnails, setThumbnails] = useState<ThumbnailItem[]>(INITIAL_THUMBNAILS);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  
  // UI Grid Zoom / Columns Slider (Default: 5 columns like in mockup)
  const [columns, setColumns] = useState<number>(5);
  const [shuffleSeed, setShuffleSeed] = useState<number>(42);

  // Modal / Filter Bar States
  const [isFilterBarOpen, setIsFilterBarOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ThumbnailItem | null>(null);
  const [thumbnailToDelete, setThumbnailToDelete] = useState<ThumbnailItem | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [filters, setFilters] = useState<FilterState>({
    searchQuery: '',
    selectedNiche: 'All',
    selectedStyles: [],
    selectedColor: null,
    selectedEmotion: null,
    sortBy: 'latest'
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
            // Check if there are any new items or count changes
            const prevIds = new Set(prev.map(p => p.id));
            const hasNew = loadedThumbs.some(t => !prevIds.has(t.id));
            const countChanged = prev.length !== loadedThumbs.length;

            if (hasNew || countChanged || prev[0]?.id !== loadedThumbs[0]?.id) {
              preloadAllThumbnails(loadedThumbs.slice(0, 40).map(t => t.imageUrl), 40);
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
          .subscribe();
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
    const counts: Record<string, number> = { All: thumbnails.length };
    for (const t of thumbnails) {
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
  }, [thumbnails]);

  // Filtered & Sorted thumbnails
  const filteredThumbnails = useMemo(() => {
    let result = [...thumbnails];

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
  }, [thumbnails, filters, shuffleSeed]);

  // Preload visible & upcoming thumbnail images into memory & browser cache proactively
  useEffect(() => {
    if (filteredThumbnails.length > 0) {
      preloadAllThumbnails(filteredThumbnails.map(t => t.imageUrl), 60);
    }
  }, [filteredThumbnails]);

  // Predictive Ahead-of-Scroll Preloader
  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const scrollY = window.scrollY;
          const viewportHeight = window.innerHeight;
          const totalHeight = document.documentElement.scrollHeight;
          
          if (filteredThumbnails.length > 0) {
            // Calculate approximate visible index based on scroll position
            const scrollFraction = Math.min(Math.max((scrollY + viewportHeight) / totalHeight, 0), 1);
            const approxIndex = Math.floor(scrollFraction * filteredThumbnails.length);
            
            // Prioritize the upcoming 40 thumbnails ahead of the current scroll position
            const upcomingSlice = filteredThumbnails
              .slice(approxIndex, approxIndex + 40)
              .map(t => t.imageUrl);

            if (upcomingSlice.length > 0) {
              prioritizeUpcomingThumbnails(upcomingSlice);
            }
          }

          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [filteredThumbnails]);

  // Shuffle Inspiration - shuffles all items on explicit user button click
  const handleShuffle = () => {
    setFilters(prev => ({ ...prev, sortBy: 'random' }));
    setShuffleSeed(Date.now());
  };

  // Add Thumbnail (Restricted to shivashiva66407@gmail.com)
  const handleAddThumbnail = (item: ThumbnailItem) => {
    if (!isAdmin) return;
    const updated = saveStoredThumbnail(item);
    setThumbnails(updated);
  };

  // Add Multiple Thumbnails in batch (Restricted to shivashiva66407@gmail.com)
  const handleAddMultipleThumbnails = (items: ThumbnailItem[]) => {
    if (!isAdmin) return;
    const updated = saveStoredThumbnails(items);
    setThumbnails(updated);
  };

  // Permanently delete a thumbnail from database & state (Restricted to shivashiva66407@gmail.com)
  const handleDeleteThumbnail = async (item: ThumbnailItem) => {
    if (!isAdmin) return;
    // Optimistically remove from visible state
    setThumbnails(prev => prev.filter(t => t.id !== item.id && t.imageUrl !== item.imageUrl));
    if (selectedItem?.id === item.id || selectedItem?.imageUrl === item.imageUrl) {
      setSelectedItem(null);
    }

    try {
      await deleteStoredThumbnailPermanently(item);
      setToastMessage('Thumbnail permanently deleted from database');
      setTimeout(() => {
        setToastMessage(null);
      }, 3500);
    } catch (err) {
      console.error('Permanent delete failed:', err);
    }
  };

  const hasActiveFilters = 
    Boolean(filters.searchQuery) ||
    filters.selectedNiche !== 'All' ||
    filters.sortBy !== 'latest';

  const resetFilters = () => {
    setFilters({
      searchQuery: '',
      selectedNiche: 'All',
      selectedStyles: [],
      selectedColor: null,
      selectedEmotion: null,
      sortBy: 'latest'
    });
  };

  // Dynamic grid column class based on zoom slider
  const getGridColsClass = () => {
    switch (columns) {
      case 3:
        return 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3';
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
    <div className="min-h-screen bg-[#E4E0D3] dark:bg-[#18181b] text-[#401D1A] dark:text-[#FFFFFF] flex flex-col pt-16 pb-32 transition-colors duration-200">
      
      {/* Top Header - Transparent & Hides on scroll */}
      <TopBar />

      {/* Main Grid Canvas */}
      <main className="flex-1 w-full px-6 sm:px-10 py-6">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-28 text-center animate-fade-blur">
            <div className="w-8 h-8 rounded-full border-3 border-[#401D1A] dark:border-[#E4E0D3] border-t-transparent animate-spin mb-3" />
            <p className="text-xs font-medium text-[#401D1A]/70 dark:text-[#E4E0D3]/70">Loading thumbnails...</p>
          </div>
        ) : filteredThumbnails.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-28 text-center animate-fade-blur">
            <p className="text-sm font-semibold text-[#401D1A] dark:text-[#FFFFFF]">No thumbnails found.</p>
            <button
              onClick={resetFilters}
              className="mt-3 px-4 py-2 rounded-[12px] text-xs font-bold text-[#FFFFFF] bg-[#401D1A] dark:bg-[#E4E0D3] dark:text-[#401D1A] hover:opacity-90 active:scale-[0.97] transition-all shadow-sm cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className={`grid ${getGridColsClass()} gap-4 sm:gap-5`}>
            {filteredThumbnails.map((item, index) => (
              <ThumbnailCard
                key={item.id}
                item={item}
                index={index}
                onInspect={() => setSelectedItem(item)}
                onDelete={isAdmin ? () => setThumbnailToDelete(item) : undefined}
              />
            ))}
          </div>
        )}
      </main>

      {/* Bottom Blur & Overlay Fade Gradient */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed bottom-0 inset-x-0 h-28 sm:h-32 bg-gradient-to-t from-[#E4E0D3] via-[#E4E0D3]/80 to-transparent dark:from-[#18181b] dark:via-[#18181b]/80 dark:to-transparent backdrop-blur-[3px] bottom-fade-mask z-30 transition-colors duration-200"
      />


      {/* Filter Pill Popover - Appears directly above the floating dock only when Filter is clicked */}
      <FilterPillBar
        isVisible={isFilterBarOpen}
        filters={filters}
        onSelectCategory={(cat) => setFilters(prev => ({ ...prev, selectedNiche: cat }))}
        onToggleSort={(sort) => {
          setFilters(prev => ({ ...prev, sortBy: sort }));
          if (sort === 'random') setShuffleSeed(Date.now());
        }}
        onResetFilters={resetFilters}
        onClose={() => setIsFilterBarOpen(false)}
        categoryCounts={categoryCounts}
      />

      {/* Floating Bottom Dock (Dynamic Island) */}
      <FloatingDock
        columns={columns}
        onColumnsChange={setColumns}
        onScrollToTop={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        onToggleFilter={() => setIsFilterBarOpen(prev => !prev)}
        hasActiveFilters={hasActiveFilters}
        onShuffle={handleShuffle}
        onOpenAdd={isAdmin ? () => setIsAddOpen(true) : undefined}
      />

      {/* Search Modal */}
      <SearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        query={filters.searchQuery}
        onQueryChange={(q) => setFilters({ ...filters, searchQuery: q })}
        filteredCount={filteredThumbnails.length}
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

      {/* Thumbnail Inspection Modal - With Download & Permanent Delete Option (Delete only for owner) */}
      <ThumbnailModal
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
        onDelete={isAdmin ? handleDeleteThumbnail : undefined}
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

      {/* Deletion Toast Notification */}
      {toastMessage && (
        <div
          id="deletion-toast-banner"
          className="fixed bottom-24 sm:bottom-28 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-full bg-slate-900/95 dark:bg-slate-100/95 text-white dark:text-slate-900 text-xs font-semibold shadow-xl backdrop-blur-md flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-200"
        >
          <div className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

    </div>
  );
}
