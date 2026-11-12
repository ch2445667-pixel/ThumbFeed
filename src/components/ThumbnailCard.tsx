'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Trash2, Bookmark, Check, Plus, Folder, X } from 'lucide-react';
import { ThumbnailItem, CollectionBoard } from '../lib/types';
import { getCachedYouTubeDetail } from '../lib/youtubeMetadataCache';
import { getStoredCollections, toggleThumbnailInCollection, saveCollection } from '../lib/storage';

interface ThumbnailCardProps {
  item: ThumbnailItem;
  onInspect: (item: ThumbnailItem) => void;
  onDelete?: (item: ThumbnailItem) => void;
  index?: number;
  showCardInfo?: boolean;
  collections?: CollectionBoard[];
  onCollectionsChange?: (cols: CollectionBoard[]) => void;
}

function formatTimeAgo(dateStr?: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr).getTime();
    if (isNaN(d)) return '';
    const diff = (Date.now() - d) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}d ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    if (diff < 2592000) return `${Math.floor(diff / 604800)}w ago`;
    if (diff < 31536000) return `${Math.floor(diff / 2592000)}mo ago`;
    return `${Math.floor(diff / 31536000)}y ago`;
  } catch {
    return '';
  }
}

export const ThumbnailCard = React.memo<ThumbnailCardProps>(({
  item,
  onInspect,
  onDelete,
  index = 0,
  showCardInfo = false,
  collections: propCollections,
  onCollectionsChange,
}) => {
  const [mounted, setMounted] = useState(false);
  const [isBoardMenuOpen, setIsBoardMenuOpen] = useState(false);
  const [isCreatingBoard, setIsCreatingBoard] = useState(false);
  const [newBoardName, setNewBoardName] = useState('');
  const [localCollections, setLocalCollections] = useState<CollectionBoard[]>([]);
  const boardMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    if (!propCollections) {
      setLocalCollections(getStoredCollections());
    }
  }, [propCollections]);

  // Click outside to close board menu
  useEffect(() => {
    if (!isBoardMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (boardMenuRef.current && !boardMenuRef.current.contains(e.target as Node)) {
        setIsBoardMenuOpen(false);
        setIsCreatingBoard(false);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [isBoardMenuOpen]);

  const activeCollections = propCollections ?? localCollections;
  const isSavedInAnyBoard = activeCollections.some((b) => b.thumbnailIds.includes(item.id));

  const handleToggleBoard = (boardId: string) => {
    const updated = toggleThumbnailInCollection(boardId, item.id);
    setLocalCollections(updated);
    if (onCollectionsChange) {
      onCollectionsChange(updated);
    }
  };

  const handleCreateAndAddBoard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBoardName.trim()) return;
    const newBoard: CollectionBoard = {
      id: `board-${Date.now()}`,
      name: newBoardName.trim(),
      thumbnailIds: [item.id],
      createdAt: new Date().toISOString(),
    };
    const updated = saveCollection(newBoard);
    setLocalCollections(updated);
    if (onCollectionsChange) {
      onCollectionsChange(updated);
    }
    setNewBoardName('');
    setIsCreatingBoard(false);
  };

  const cachedYT = mounted ? getCachedYouTubeDetail(item) : null;

  const rawCreator = cachedYT?.creator || item.creator || '';
  const isTanzeeOrUnknown =
    !rawCreator ||
    rawCreator.trim() === '' ||
    rawCreator.toLowerCase().includes('tanzee') ||
    rawCreator.trim() === 'YouTube Creator' ||
    rawCreator.trim() === 'Curated' ||
    rawCreator.trim() === 'Unknown';

  const displayCreator = isTanzeeOrUnknown ? '' : rawCreator.trim();

  const rawTitle = cachedYT?.title || item.title || '';
  const displayTitle =
    rawTitle && rawTitle !== 'YouTube Thumbnail' && rawTitle !== 'Untitled Thumbnail'
      ? rawTitle.replace(/^https?:\/\/(?:www\.)?youtube\.com\/[^\s]+\s*/i, '').trim()
      : displayCreator
        ? `${displayCreator} Thumbnail`
        : '';

  let displayViews = cachedYT?.views || item.viewsEstimate || '';
  if (displayViews && !displayViews.toLowerCase().includes('view')) {
    displayViews = `${displayViews} views`;
  }

  const displayTime =
    cachedYT?.publishedTime ||
    item.publishedTime ||
    formatTimeAgo(item.createdAt);

  // Metadata line matching Image 2 reference: "Channel • 16.4K views • 3mo ago"
  const metaParts: string[] = [];
  if (displayCreator) metaParts.push(displayCreator);
  if (displayViews) metaParts.push(displayViews);
  if (displayTime) metaParts.push(displayTime);
  const metaLine = metaParts.join('  •  ');

  const gridSrc = item.thumbSmallUrl || item.imageUrl;

  return (
    <div
      onClick={() => onInspect(item)}
      suppressHydrationWarning
      className={`group relative w-full cursor-pointer select-none rounded-[8px] border border-white/[0.08] bg-[#0c0d12] hover:bg-[#11131a] transition-all duration-200 ease-out hover:border-white/[0.20] hover:shadow-[0_12px_28px_-6px_rgba(0,0,0,0.85)] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] ${
        showCardInfo ? 'p-1.5 sm:p-2 flex flex-col' : 'overflow-hidden'
      }`}
    >
      {/* Thumbnail artwork stage (16:9 ratio) */}
      <div
        className={`relative aspect-video w-full overflow-hidden bg-[#050608] ${
          showCardInfo ? 'rounded-[5px]' : 'rounded-[7px]'
        }`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={gridSrc}
          alt={displayTitle || item.title}
          className="block h-full w-full object-cover object-center transition-transform duration-300 ease-out group-hover:scale-[1.02]"
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          width={item.width ?? 1280}
          height={item.height ?? 720}
          loading={index < 8 ? 'eager' : 'lazy'}
          decoding="async"
          fetchPriority={index < 4 ? 'high' : 'auto'}
        />

        {/* Subtle hover overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none" />

        {/* Hover Save to Board Selector */}
        <div className="absolute left-2 top-2 z-20" ref={boardMenuRef}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsBoardMenuOpen((prev) => !prev);
            }}
            title={isSavedInAnyBoard ? 'Saved in Board' : 'Save to Board'}
            aria-label="Save to Board"
            className={`flex items-center gap-1.5 px-2 py-1 rounded-md border text-[11px] font-medium transition-all duration-150 backdrop-blur-md shadow-md cursor-pointer ${
              isSavedInAnyBoard || isBoardMenuOpen
                ? 'border-white/20 bg-black/85 text-white opacity-100'
                : 'border-white/10 bg-black/70 text-white/80 opacity-0 group-hover:opacity-100 hover:bg-black/90 hover:text-white active:scale-95'
            }`}
          >
            <Bookmark className={`h-3 w-3 ${isSavedInAnyBoard ? 'fill-white text-white' : ''}`} />
            <span>{isSavedInAnyBoard ? 'Saved' : 'Board'}</span>
          </button>

          {/* Board Dropdown Menu */}
          {isBoardMenuOpen && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute left-0 top-8 z-30 w-52 rounded-xl border border-white/15 bg-[#0e1017]/95 backdrop-blur-xl p-2 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
            >
              <div className="flex items-center justify-between px-1.5 pb-1.5 border-b border-white/[0.08] mb-1.5">
                <span className="text-[11px] font-semibold text-white/90">Save to Board</span>
                <button
                  type="button"
                  onClick={() => setIsBoardMenuOpen(false)}
                  className="p-0.5 rounded text-white/40 hover:text-white"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>

              {/* Boards List */}
              <div className="max-h-40 overflow-y-auto space-y-0.5 pr-0.5">
                {activeCollections.length === 0 ? (
                  <div className="px-2 py-2 text-[11px] text-white/40 text-center">
                    No boards created yet
                  </div>
                ) : (
                  activeCollections.map((board) => {
                    const isIncluded = board.thumbnailIds.includes(item.id);
                    return (
                      <button
                        key={board.id}
                        type="button"
                        onClick={() => handleToggleBoard(board.id)}
                        className={`w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors text-left cursor-pointer ${
                          isIncluded
                            ? 'bg-white/10 text-white'
                            : 'text-white/70 hover:text-white hover:bg-white/[0.06]'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Folder className={`w-3.5 h-3.5 shrink-0 ${isIncluded ? 'text-white' : 'text-white/40'}`} />
                          <span className="truncate">{board.name}</span>
                        </div>
                        {isIncluded && <Check className="w-3.5 h-3.5 text-white shrink-0" />}
                      </button>
                    );
                  })
                )}
              </div>

              {/* Quick New Board Form */}
              <div className="pt-1.5 mt-1 border-t border-white/[0.08]">
                {isCreatingBoard ? (
                  <form onSubmit={handleCreateAndAddBoard} className="flex items-center gap-1">
                    <input
                      type="text"
                      value={newBoardName}
                      onChange={(e) => setNewBoardName(e.target.value)}
                      placeholder="Board name..."
                      autoFocus
                      className="w-full rounded-md border border-white/15 bg-white/[0.06] px-2 py-1 text-xs text-white placeholder-white/40 focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={!newBoardName.trim()}
                      className="p-1 rounded bg-white text-black disabled:opacity-40 hover:bg-white/90"
                    >
                      <Check className="w-3 h-3 stroke-[2.5]" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsCreatingBoard(false);
                        setNewBoardName('');
                      }}
                      className="p-1 text-white/40 hover:text-white"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsCreatingBoard(true)}
                    className="w-full flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] text-white/60 hover:text-white hover:bg-white/[0.05] transition-colors cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Create new board</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Delete (admin / creator only) */}
        {onDelete && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(item);
            }}
            title="Delete thumbnail"
            aria-label="Delete thumbnail"
            className="absolute right-2 top-2 z-10 grid h-7 w-7 place-items-center rounded-md border border-white/10 bg-black/70 backdrop-blur-md text-white/70 opacity-0 transition-all duration-150 hover:bg-red-500 hover:text-white hover:border-transparent group-hover:opacity-100 active:scale-95 shadow-sm"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}

        {/* Category badge overlay on thumbnail when in Image 1 mode (thumbnails only) */}
        {!showCardInfo && item.niche && item.niche !== 'All' && (
          <div className="absolute left-2 bottom-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
            <span className="px-2 py-0.5 rounded-md bg-black/75 backdrop-blur-md border border-white/10 text-[10px] font-medium text-white/90">
              {item.niche}
            </span>
          </div>
        )}
      </div>

      {/* Details / Metadata Footer (Image 2 style) */}
      {showCardInfo && (
        <div className="flex flex-col pt-2.5 pb-1 px-1" suppressHydrationWarning>
          <h4
            title={displayTitle || item.title}
            suppressHydrationWarning
            className="line-clamp-2 text-xs font-semibold leading-snug text-white group-hover:text-white transition-colors"
          >
            {displayTitle || item.title || 'Untitled Thumbnail'}
          </h4>

          {metaLine && (
            <p className="mt-1 text-[11px] text-white/45 truncate font-normal">
              {metaLine}
            </p>
          )}
        </div>
      )}
    </div>
  );
});

ThumbnailCard.displayName = 'ThumbnailCard';

export default ThumbnailCard;
