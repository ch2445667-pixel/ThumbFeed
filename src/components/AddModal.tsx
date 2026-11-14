'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  IconClose,
  IconSparkles,
  IconYoutube,
  IconUploadCloud,
  IconPlus,
  IconCheck,
  IconTrash,
  IconSpinner,
  IconTag,
  IconPinterest,
  IconClipboardPaste,
  IconImage,
  IconFilm
} from './icons/AppIcons';
import { ThumbnailItem, NicheCategory, CollectionBoard } from '../lib/types';
import { convertToJpg, getYoutubeJpgUrl } from '../lib/imageOptimizer';
import { Cloud, ArrowLeft, Bookmark } from 'lucide-react';
import { CloudflareStorageModal } from './CloudflareStorageModal';
import {
  getAllCategories,
  addCustomCategory,
  subscribeCategories
} from '../lib/categories';
import { extractDedupeKeys, addThumbnailsToBoard } from '../lib/storage';
import { sanitizeSafeImageSrc } from '../lib/urlSafety';
import { formatShortViews } from '../lib/formatViews';
import { useAuth } from '../lib/authContext';

function createRandomSuffix(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().replace(/-/g, '').slice(0, 12);
  }
  return Date.now().toString(36);
}

// Real official Pinterest logo SVG in clean white/currentColor style
const RealPinterestIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M12 0C5.373 0 0 5.372 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738.098.119.112.224.083.345-.09.375-.291 1.199-.334 1.372-.053.224-.174.271-.401.165-1.495-.695-2.43-2.878-2.43-4.632 0-3.774 2.743-7.243 7.906-7.243 4.15 0 7.377 2.957 7.377 6.909 0 4.124-2.599 7.442-6.208 7.442-1.212 0-2.351-.63-2.741-1.375l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12 0-6.628-5.373-12-12-12z" />
  </svg>
);

const RealYoutubeIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
  </svg>
);

const RealUploadIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M7 18a4 4 0 0 1-.5-7.97A6 6 0 0 1 18 9.5 4.5 4.5 0 0 1 17.5 18"/>
    <path d="m9 13 3-3 3 3M12 10v9"/>
  </svg>
);

interface AddModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddThumbnail: (item: ThumbnailItem) => void;
  onAddMultipleThumbnails?: (items: ThumbnailItem[]) => void;
  initialMediaKind?: 'thumbnail' | 'poster';
  collections?: CollectionBoard[];
}

type AddTabMode = 'upload' | 'youtube' | 'pinterest';

type AddMediaKind = 'thumbnail' | 'poster';

interface QueuedImageItem {
  id: string;
  dataUrl: string;
  title: string;
  creator: string;
  niche: NicheCategory;
  tags: string[];
  isOptimizing?: boolean;
}

interface BatchExtractedItem {
  id: string;
  videoId?: string;
  url: string;
  title: string;
  creator: string;
  imageUrl: string;
  niche: NicheCategory;
  tags: string[];
  views?: string;
  publishedTime?: string;
  selected?: boolean;
}

function extractYoutubeVideoIds(text: string): { id: string; originalUrl: string }[] {
  if (!text || !text.trim()) return [];
  
  const matches: { id: string; originalUrl: string }[] = [];
  const seenIds = new Set<string>();

  // Comprehensive regex matching all YouTube video formats:
  // - youtube.com/watch?v=ID (including ?feature=shared&v=ID, etc.)
  // - youtu.be/ID
  // - youtube.com/embed/ID
  // - youtube.com/shorts/ID
  // - youtube.com/live/ID
  // - youtube.com/v/ID
  // - m.youtube.com, music.youtube.com, www.youtube.com, youtube.com
  const regex = /(?:https?:\/\/)?(?:[a-zA-Z0-9-]+\.)?youtube\.com\/(?:watch\?(?:[^& \n\r"']*[&])?v=|embed\/|shorts\/|live\/|v\/)([a-zA-Z0-9_-]{11})|(?:https?:\/\/)?youtu\.be\/([a-zA-Z0-9_-]{11})/gi;

  let match;
  while ((match = regex.exec(text)) !== null) {
    const videoId = match[1] || match[2];
    if (videoId && videoId.length === 11 && !seenIds.has(videoId)) {
      seenIds.add(videoId);
      matches.push({
        id: videoId,
        originalUrl: `https://www.youtube.com/watch?v=${videoId}`
      });
    }
  }

  // If no standard regex matched, scan space/line-separated tokens
  if (matches.length === 0) {
    const tokens = text.split(/[\s,\n\r\t]+/).map(t => t.trim()).filter(Boolean);
    for (const token of tokens) {
      // Check if the token is literally an 11-char video ID (alphanumeric, -, _)
      if (/^[a-zA-Z0-9_-]{11}$/.test(token) && !token.startsWith('@') && !seenIds.has(token)) {
        seenIds.add(token);
        matches.push({
          id: token,
          originalUrl: `https://www.youtube.com/watch?v=${token}`
        });
        continue;
      }

      const lineMatch = token.match(/(?:v=|\/embed\/|\/shorts\/|\/live\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/i);
      if (lineMatch && lineMatch[1] && !seenIds.has(lineMatch[1])) {
        seenIds.add(lineMatch[1]);
        matches.push({
          id: lineMatch[1],
          originalUrl: `https://www.youtube.com/watch?v=${lineMatch[1]}`
        });
      }
    }
  }

  return matches;
}

function extractSingleYoutubeId(urlOrStr: string): string | null {
  if (!urlOrStr) return null;
  const match = urlOrStr.match(/(?:watch\?(?:.*&)?v=|youtu\.be\/|\/shorts\/|\/live\/|\/embed\/|\/vi\/|thumb-yt-|ch-yt-|yt-)([a-zA-Z0-9_-]{11})/i);
  return match && match[1] ? match[1] : null;
}

function isChannelInput(text: string): boolean {
  const trimmed = text.trim();
  // If there are explicit video links or video IDs, it is NOT a channel input
  const videoMatches = extractYoutubeVideoIds(trimmed);
  if (videoMatches.length > 0) {
    return false;
  }

  return (
    trimmed.startsWith('@') ||
    trimmed.includes('youtube.com/@') ||
    trimmed.includes('youtube.com/channel/') ||
    trimmed.includes('youtube.com/c/') ||
    trimmed.includes('youtube.com/user/') ||
    trimmed.includes('/videos') ||
    (!trimmed.includes('/') && !trimmed.includes('?') && trimmed.length >= 2 && trimmed.length <= 60)
  );
}

function classifyNicheFromTitle(title: string, creator: string = ''): { niche: NicheCategory; tags: string[] } {
  const lower = `${title} ${creator}`.toLowerCase();
  let niche: NicheCategory = 'Tech';
  let tags: string[] = ['YouTube', 'Design', 'High CTR'];

  if (
    lower.includes('documentary') || lower.includes('history') || lower.includes('investigation') ||
    lower.includes('truth') || lower.includes('story') || lower.includes('crime')
  ) {
    niche = 'Documentary';
    tags = ['Documentary', 'Deep Dive', 'True Story'];
  } else if (
    lower.includes('vlog') || lower.includes('lifestyle') || lower.includes('day in') ||
    lower.includes('routine') || lower.includes('irl')
  ) {
    niche = 'IRL';
    tags = ['IRL', 'Lifestyle', 'Vlog'];
  } else if (
    lower.includes('gym') || lower.includes('fitness') || lower.includes('workout') ||
    lower.includes('sports') || lower.includes('athlete')
  ) {
    niche = 'Sports';
    tags = ['Sports', 'Workout', 'Fitness'];
  } else if (
    lower.includes('game') || lower.includes('gaming') || lower.includes('minecraft') ||
    lower.includes('roblox') || lower.includes('gta') || lower.includes('stream')
  ) {
    niche = 'Gaming';
    tags = ['Gaming', 'Gameplay', 'Twitch'];
  } else if (
    lower.includes('money') || lower.includes('business') || lower.includes('finance') ||
    lower.includes('invest') || lower.includes('crypto') || lower.includes('sales')
  ) {
    niche = 'Business';
    tags = ['Business', 'Finance', 'Investing'];
  } else if (
    lower.includes('tutorial') || lower.includes('guide') || lower.includes('learn') ||
    lower.includes('how to') || lower.includes('editing') || lower.includes('photoshop')
  ) {
    niche = 'Educational';
    tags = ['Educational', 'Tutorial', 'Step-by-Step'];
  } else if (
    lower.includes('mrbeast') || lower.includes('challenge') || lower.includes('viral') ||
    lower.includes('prank') || lower.includes('comedy')
  ) {
    niche = 'Entertainment';
    tags = ['Entertainment', 'Viral Challenge', 'High Energy'];
  }

  return { niche, tags };
}

interface UnifiedCategoryBarProps {
  label?: string;
  itemCount: number;
  categories: string[];
  selectedCategories: string[];
  onToggleCategory: (category: string) => void;
  onCategoryCreated: (newCategory: string) => void;
  collections?: CollectionBoard[];
  selectedBoardId?: string;
  onSelectBoard?: (boardId: string) => void;
  hideBoardSelector?: boolean;
}

const UnifiedCategoryBar: React.FC<UnifiedCategoryBarProps> = ({
  label = 'Select categories for all items',
  itemCount,
  categories,
  selectedCategories,
  onToggleCategory,
  onCategoryCreated,
  collections = [],
  selectedBoardId = '',
  onSelectBoard,
  hideBoardSelector = false,
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newCatInput, setNewCatInput] = useState('');

  const handleAdd = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = newCatInput.trim();
    if (!clean) return;

    // Save to shared categories (which auto-adds to filter pills across the app)
    addCustomCategory(clean);
    onCategoryCreated(clean);
    onToggleCategory(clean);
    setNewCatInput('');
    setIsAdding(false);
  };

  return (
    <div className="p-4 bg-[#151821] border border-white/[0.08] rounded-[14px] space-y-2.5 text-white">
      <div className="flex items-center justify-between text-xs flex-wrap gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-semibold text-white/90 text-[11px]">
            {label} ({itemCount} {itemCount === 1 ? 'item' : 'items'}):
          </span>
          {selectedCategories.map(cat => (
            <span
              key={cat}
              className="px-2 py-0.5 rounded-[8px] text-[11px] font-semibold text-black bg-white shadow-xs inline-flex items-center gap-1"
            >
              <span>{cat}</span>
              <button
                type="button"
                onClick={() => onToggleCategory(cat)}
                className="hover:opacity-70 text-black cursor-pointer leading-none text-xs"
                title={`Remove ${cat} from all`}
              >
                ×
              </button>
            </span>
          ))}
          {selectedCategories.length === 0 && (
            <span className="text-[11px] text-white/40 italic">None selected (click a category below to apply)</span>
          )}
        </div>

        {!isAdding && (
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            className="text-[11px] font-semibold text-white/70 hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
          >
            <IconPlus className="w-3 h-3" />
            <span>New Category</span>
          </button>
        )}
      </div>

      {/* Inline Add New Category Box */}
      {isAdding && (
        <form onSubmit={handleAdd} className="flex items-center gap-2 p-2 bg-[#0e0e10] border border-white/10 rounded-[10px]">
          <input
            type="text"
            value={newCatInput}
            onChange={(e) => setNewCatInput(e.target.value)}
            placeholder="Category name (e.g. Finance, Anime)..."
            className="flex-1 bg-transparent text-xs text-white placeholder-white/30 focus:outline-none"
            autoFocus
          />
          <button
            type="submit"
            disabled={!newCatInput.trim()}
            className="px-2.5 py-1 rounded-[8px] bg-white hover:bg-white/90 disabled:opacity-40 text-black font-semibold text-[11px] flex items-center gap-1 cursor-pointer transition-colors"
          >
            <IconCheck className="w-3 h-3" />
            <span>Add</span>
          </button>
          <button
            type="button"
            onClick={() => { setIsAdding(false); setNewCatInput(''); }}
            className="p-1 text-white/40 hover:text-white cursor-pointer"
          >
            <IconClose className="w-3.5 h-3.5" />
          </button>
        </form>
      )}

      {/* Categories from Filters - Click to toggle for all items */}
      <div className="flex flex-wrap items-center gap-1.5">
        {categories.map((cat) => {
          const isSelected = selectedCategories.some(c => c.toLowerCase() === cat.toLowerCase());
          return (
            <button
              key={cat}
              type="button"
              onClick={() => onToggleCategory(cat)}
              className={`px-2.5 py-1 rounded-[8px] text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                isSelected
                  ? 'bg-white text-black font-bold shadow-xs'
                  : 'bg-white/[0.06] hover:bg-white/[0.12] text-white/80 border border-white/10'
              }`}
            >
              <span>{isSelected ? '✓ ' : '+ '}</span>
              <span>{cat}</span>
            </button>
          );
        })}
      </div>

      {/* Target Board selector in Add Options alongside categories */}
      {!hideBoardSelector && collections && collections.length > 0 && (
        <div className="pt-2 border-t border-white/[0.08] space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-white/90 text-[11px] flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-white/60 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/>
              </svg>
              <span>Save to Board:</span>
            </span>
            <span className="text-[11px] text-white/40">
              {selectedBoardId
                ? collections.find(b => b.id === selectedBoardId)?.name || 'Board Selected'
                : 'Feed Only (No Board)'}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => onSelectBoard && onSelectBoard('')}
              className={`px-2.5 py-1 rounded-[8px] text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                !selectedBoardId
                  ? 'bg-white text-black font-bold shadow-xs'
                  : 'bg-white/[0.06] hover:bg-white/[0.12] text-white/80 border border-white/10'
              }`}
            >
              <span>{!selectedBoardId ? '✓ ' : ''}</span>
              <span>Feed only</span>
            </button>
            {collections.map((board) => {
              const isSelected = selectedBoardId === board.id;
              return (
                <button
                  key={board.id}
                  type="button"
                  onClick={() => onSelectBoard && onSelectBoard(board.id)}
                  className={`px-2.5 py-1 rounded-[8px] text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                    isSelected
                      ? 'bg-white text-black font-bold shadow-xs'
                      : 'bg-white/[0.06] hover:bg-white/[0.12] text-white/80 border border-white/10'
                  }`}
                >
                  <span>{isSelected ? '✓ ' : '+ '}</span>
                  <span>{board.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

interface ItemCategoryMultiSelectProps {
  selectedCategories: string[];
  availableCategories: string[];
  onChange: (categories: string[]) => void;
  onCategoryCreated?: (newCategory: string) => void;
}

const ItemCategoryMultiSelect: React.FC<ItemCategoryMultiSelectProps> = ({
  selectedCategories,
  availableCategories,
  onChange,
  onCategoryCreated
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newCatInput, setNewCatInput] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setIsAddingNew(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutside);
      return () => document.removeEventListener('mousedown', handleOutside);
    }
  }, [isOpen]);

  const handleToggle = (cat: string) => {
    const exists = selectedCategories.some(c => c.toLowerCase() === cat.toLowerCase());
    if (exists) {
      onChange(selectedCategories.filter(c => c.toLowerCase() !== cat.toLowerCase()));
    } else {
      onChange([...selectedCategories, cat]);
    }
  };

  const handleRemove = (e: React.MouseEvent, cat: string) => {
    e.stopPropagation();
    onChange(selectedCategories.filter(c => c.toLowerCase() !== cat.toLowerCase()));
  };

  const handleCreateNew = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newCatInput.trim();
    if (!clean) return;
    addCustomCategory(clean);
    if (onCategoryCreated) onCategoryCreated(clean);
    if (!selectedCategories.some(c => c.toLowerCase() === clean.toLowerCase())) {
      onChange([...selectedCategories, clean]);
    }
    setNewCatInput('');
    setIsAddingNew(false);
  };

  const filtered = availableCategories.filter(c =>
    c.toLowerCase().includes(search.toLowerCase().trim())
  );

  return (
    <div ref={containerRef} className="relative flex flex-wrap items-center gap-1.5 w-full">
      {/* Active category chips */}
      {selectedCategories.map(cat => (
        <span
          key={cat}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[6px] text-[11px] font-semibold bg-white text-black shadow-2xs whitespace-nowrap"
        >
          <span>{cat}</span>
          <button
            type="button"
            onClick={(e) => handleRemove(e, cat)}
            className="text-black/70 hover:text-black cursor-pointer leading-none text-xs ml-0.5"
            title={`Remove ${cat}`}
          >
            ×
          </button>
        </span>
      ))}
      {selectedCategories.length === 0 && (
        <span className="text-[11px] text-white/40 italic mr-1">No category</span>
      )}

      {/* Button to open multi-select popover */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="px-2 py-0.5 rounded-[6px] text-[11px] font-semibold bg-white/[0.06] hover:bg-white/[0.12] text-white/85 border border-white/10 flex items-center gap-1 cursor-pointer transition-colors whitespace-nowrap"
      >
        <IconPlus className="w-3 h-3" />
        <span>Category</span>
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div className="absolute left-0 top-full mt-1.5 z-50 w-64 bg-[#151821] border border-white/15 rounded-[12px] shadow-2xl p-2.5 space-y-2 text-white">
          <div className="flex items-center justify-between pb-1.5 border-b border-white/10 text-xs">
            <span className="font-semibold text-white text-[11px]">Select Categories</span>
            <button
              type="button"
              onClick={() => setIsAddingNew(!isAddingNew)}
              className="text-[11px] font-semibold text-white/80 hover:text-white hover:underline cursor-pointer"
            >
              {isAddingNew ? 'Cancel' : '+ New Category'}
            </button>
          </div>

          {isAddingNew && (
            <form onSubmit={handleCreateNew} className="flex items-center gap-1.5 p-1.5 bg-[#090a0d] border border-white/10 rounded-[8px]">
              <input
                type="text"
                value={newCatInput}
                onChange={(e) => setNewCatInput(e.target.value)}
                placeholder="Category name..."
                className="flex-1 bg-transparent text-xs text-white placeholder:text-white/35 focus:outline-none"
                autoFocus
              />
              <button
                type="submit"
                disabled={!newCatInput.trim()}
                className="px-2 py-0.5 rounded-[6px] text-[10px] font-bold bg-white text-black disabled:opacity-40 cursor-pointer"
              >
                Add
              </button>
            </form>
          )}

          <div className="relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search categories..."
              className="w-full px-2.5 py-1 bg-[#090a0d] border border-white/10 rounded-[8px] text-xs text-white placeholder:text-white/35 focus:outline-none focus:border-white/25"
            />
          </div>

          <div className="max-h-40 overflow-y-auto space-y-1 custom-scrollbar pr-0.5">
            {filtered.map(cat => {
              const isSelected = selectedCategories.some(c => c.toLowerCase() === cat.toLowerCase());
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => handleToggle(cat)}
                  className={`w-full flex items-center justify-between px-2 py-1 rounded-[7px] text-xs font-medium cursor-pointer transition-colors text-left ${
                    isSelected
                      ? 'bg-white/15 text-white font-semibold'
                      : 'hover:bg-white/[0.06] text-white/80'
                  }`}
                >
                  <span>{cat}</span>
                  {isSelected && (
                    <span
                      className="w-3.5 h-3.5 rounded flex items-center justify-center bg-white text-black text-[10px] font-bold"
                    >
                      ✓
                    </span>
                  )}
                </button>
              );
            })}
            {filtered.length === 0 && (
              <div className="text-center py-2 text-[11px] text-white/40">
                No matching category found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export const AddModal: React.FC<AddModalProps> = ({
  isOpen,
  onClose,
  onAddThumbnail,
  onAddMultipleThumbnails,
  initialMediaKind = 'thumbnail',
  collections = []
}) => {
  const { getIdToken } = useAuth();
  const [activeTab, setActiveTab] = useState<AddTabMode>('upload');
  const [mediaKind, setMediaKind] = useState<AddMediaKind>('thumbnail');
  const unitWord = 'Thumbnail';
  const [selectedBoardId, setSelectedBoardId] = useState<string>('');
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);

  // Selected Categories per section (supports multiple categories, defaults to none)
  const [uploadCategories, setUploadCategories] = useState<string[]>([]);
  const [youtubeCategories, setYoutubeCategories] = useState<string[]>([]);
  const [pinterestCategories, setPinterestCategories] = useState<string[]>([]);

  // --- Upload / Paste Tab State ---
  const [queuedImages, setQueuedImages] = useState<QueuedImageItem[]>([]);
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- YouTube Tab State ---
  const [youtubeInput, setYoutubeInput] = useState('');
  const [youtubeChannelLimit, setYoutubeChannelLimit] = useState<number>(50);
  const [isYoutubeLoading, setIsYoutubeLoading] = useState(false);
  const [youtubeError, setYoutubeError] = useState('');
  const [youtubeItems, setYoutubeItems] = useState<BatchExtractedItem[]>([]);

  // --- Pinterest Tab State ---
  const [pinterestInput, setPinterestInput] = useState('');
  const [isPinterestLoading, setIsPinterestLoading] = useState(false);
  const [pinterestError, setPinterestError] = useState('');
  const [pinterestItems, setPinterestItems] = useState<BatchExtractedItem[]>([]);

  // --- Uploading to Cloud (Cloudflare R2) State ---
  const [isUploadingToCloud, setIsUploadingToCloud] = useState(false);
  const [uploadStatusText, setUploadStatusText] = useState('');
  const [cloudError, setCloudError] = useState('');

  // --- Cloudflare Storage Status ---
  const [isR2ModalOpen, setIsR2ModalOpen] = useState(false);
  const [r2Configured, setR2Configured] = useState(false);
  const [r2BucketName, setR2BucketName] = useState('');

  const checkR2Status = useCallback(() => {
    getIdToken()
      .then((token) => {
        if (!token) return null;
        return fetch('/api/r2/status', {
          headers: { Authorization: `Bearer ${token}` },
        }).then((res) => (res.ok ? res.json() : null));
      })
      .then((data) => {
        if (!data) return;
        setR2Configured(Boolean(data?.configured));
        setR2BucketName(data?.bucket || '');
      })
      .catch(() => {});
  }, [getIdToken]);

  useEffect(() => {
    if (isOpen) {
      checkR2Status();
    }
  }, [isOpen, checkR2Status]);

  // Subscribe to category updates
  useEffect(() => {
    const update = () => {
      setAvailableCategories(getAllCategories());
    };
    update();
    return subscribeCategories(update);
  }, []);

  // Escape key dismissal (paused while nested R2 modal is open)
  useEffect(() => {
    if (!isOpen || isR2ModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isR2ModalOpen, onClose]);

  // Reset modal state on open/close without re-running on tab change
  useEffect(() => {
    if (isOpen) {
      setMediaKind(initialMediaKind);
      if (initialMediaKind === 'poster') {
        setActiveTab(prev => (prev === 'youtube' ? 'upload' : prev));
      }
    } else {
      setQueuedImages([]);
      setYoutubeInput('');
      setYoutubeItems([]);
      setYoutubeError('');
      setPinterestInput('');
      setPinterestItems([]);
      setPinterestError('');
      setUploadCategories([]);
      setYoutubeCategories([]);
      setPinterestCategories([]);
      setSelectedBoardId('');
      setMediaKind(initialMediaKind);
      setActiveTab('upload');
      setIsUploadingToCloud(false);
      setUploadStatusText('');
      setCloudError('');
    }
  }, [isOpen, initialMediaKind]);

  // Process a File or Blob into a QueuedImageItem
  const processImageFile = useCallback(async (file: File | Blob, customName?: string): Promise<QueuedImageItem | null> => {
    try {
      const isPoster = mediaKind === 'poster';
      // Portraits keep a black matte; thumbnails keep the obsidian matte.
      const jpgDataUrl = await convertToJpg(file, 0.9, 1920, isPoster ? '#000000' : '#090a0d');
      const rawName = (file instanceof File && file.name) ? file.name : (customName || `${unitWord} ${Date.now().toString().slice(-4)}`);
      const cleanTitle = rawName.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ').trim();
      const chosenCategories = [...uploadCategories];

      const prefix = isPoster ? 'poster' : 'img';
      return {
        id: `${prefix}-${createRandomSuffix()}`,
        dataUrl: jpgDataUrl,
        title: cleanTitle || `Curated ${unitWord}`,
        creator: isPoster ? 'Cinema' : 'You',
        niche: (chosenCategories[0] || (isPoster ? 'Cinema' : '')) as NicheCategory,
        tags: chosenCategories.length > 0 ? chosenCategories : (isPoster ? ['Movie Poster', 'Cinema'] : [])
      };
    } catch (err) {
      console.warn('Error converting image:', err);
      return null;
    }
  }, [uploadCategories, unitWord, mediaKind]);

  // Handle multiple files selected via browse or drop
  const handleMultipleFiles = useCallback(async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;
    setIsProcessingFiles(true);

    const newItems: QueuedImageItem[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith('image/')) continue;
      const item = await processImageFile(file);
      if (item) {
        newItems.push(item);
      }
    }

    if (newItems.length > 0) {
      setQueuedImages(prev => [...prev, ...newItems]);
    }
    setIsProcessingFiles(false);
  }, [processImageFile]);

  // Global Clipboard Paste Handler (Ctrl+V / Cmd+V)
  const handlePaste = useCallback(async (e: ClipboardEvent) => {
    if (!isOpen || activeTab !== 'upload') return;

    // Check if pasting into a text input or textarea
    const target = e.target as HTMLElement;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
      // If typing inside an input, only handle image files from clipboard
      const hasImage = Array.from(e.clipboardData?.items || []).some(item => item.type.startsWith('image/'));
      if (!hasImage) return;
    }

    const items = e.clipboardData?.items;
    if (!items || items.length === 0) return;

    const filesToProcess: File[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.indexOf('image') !== -1) {
        const file = item.getAsFile();
        if (file) {
          filesToProcess.push(file);
        }
      }
    }

    if (filesToProcess.length > 0) {
      e.preventDefault();
      setIsProcessingFiles(true);
      const newItems: QueuedImageItem[] = [];
      for (const file of filesToProcess) {
        const processed = await processImageFile(file, `Pasted ${unitWord} ${queuedImages.length + newItems.length + 1}`);
        if (processed) {
          newItems.push(processed);
        }
      }
      if (newItems.length > 0) {
        setQueuedImages(prev => [...prev, ...newItems]);
      }
      setIsProcessingFiles(false);
      return;
    }

    // Check if plain text clipboard has an image URL
    const text = e.clipboardData?.getData('text')?.trim();
    const safeUrl = text ? sanitizeSafeImageSrc(text) : '';
    if (safeUrl) {
      if (safeUrl.match(/\.(jpeg|jpg|png|webp|gif)/i) || safeUrl.includes('i.pinimg.com') || safeUrl.includes('ytimg.com')) {
        e.preventDefault();
        setIsProcessingFiles(true);
        try {
          const res = await fetch(safeUrl);
          const blob = await res.blob();
          const processed = await processImageFile(blob, `Pasted ${unitWord} ${queuedImages.length + 1}`);
          if (processed) {
            setQueuedImages(prev => [...prev, processed]);
          }
        } catch {
          // fallback dataUrl (already sanitized via sanitizeSafeImageSrc)
          const chosenCategories = [...uploadCategories];
          const isPoster = mediaKind === 'poster';
          setQueuedImages(prev => [
            ...prev,
            {
              id: `${isPoster ? 'poster' : 'img'}-${createRandomSuffix()}`,
              dataUrl: safeUrl,
              title: `Pasted ${unitWord} ${prev.length + 1}`,
              creator: isPoster ? 'Cinema' : 'You',
              niche: (chosenCategories[0] || (isPoster ? 'Cinema' : '')) as NicheCategory,
              tags: chosenCategories.length > 0 ? chosenCategories : (isPoster ? ['Movie Poster', 'Cinema'] : [])
            }
          ]);
        } finally {
          setIsProcessingFiles(false);
        }
      }
    }
  }, [isOpen, activeTab, processImageFile, queuedImages.length, uploadCategories, unitWord, mediaKind]);

  // Attach global paste listener
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      handlePaste(e);
    };
    window.addEventListener('paste', onPaste);
    return () => {
      window.removeEventListener('paste', onPaste);
    };
  }, [handlePaste]);

  const [pasteNotice, setPasteNotice] = useState<{ text: string; isError?: boolean } | null>(null);

  // Click handler to paste directly from system clipboard
  const handlePasteButtonClick = async () => {
    setPasteNotice(null);
    setIsProcessingFiles(true);
    try {
      // 1. Try reading rich clipboard items (images from clipboard)
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.read) {
        try {
          const clipboardItems = await navigator.clipboard.read();
          const imageFiles: File[] = [];
          for (const item of clipboardItems) {
            for (const type of item.types) {
              if (type.startsWith('image/')) {
                const blob = await item.getType(type);
                imageFiles.push(new File([blob], `pasted-${Date.now()}-${imageFiles.length + 1}.png`, { type }));
              }
            }
          }
          if (imageFiles.length > 0) {
            await handleMultipleFiles(imageFiles);
            setPasteNotice({ text: `Successfully pasted ${imageFiles.length} image(s)!` });
            setTimeout(() => setPasteNotice(null), 3500);
            setIsProcessingFiles(false);
            return;
          }
        } catch (readErr) {
          console.warn('navigator.clipboard.read() note:', readErr);
        }
      }

      // 2. Try reading clipboard text (image URL or base64 dataUrl)
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.readText) {
        try {
          const text = (await navigator.clipboard.readText()).trim();
          const safeClipboardUrl = text ? sanitizeSafeImageSrc(text) : '';
          if (safeClipboardUrl) {
            try {
              const res = await fetch(safeClipboardUrl);
              const blob = await res.blob();
              const processed = await processImageFile(blob, `Pasted ${unitWord} ${queuedImages.length + 1}`);
              if (processed) {
                setQueuedImages(prev => [...prev, processed]);
                setPasteNotice({ text: 'Pasted image URL added to queue!' });
                setTimeout(() => setPasteNotice(null), 3500);
                setIsProcessingFiles(false);
                return;
              }
            } catch (fetchErr) {
              console.warn('Clipboard image URL fetch failed:', fetchErr);
            }
          }
        } catch (textErr) {
          console.warn('readText note:', textErr);
        }
      }

      setPasteNotice({
        text: 'No image copied yet. Copy an image or screenshot first, then click Paste (or press Ctrl + V)!',
        isError: true
      });
      setTimeout(() => setPasteNotice(null), 4500);
    } catch (err: any) {
      console.warn('Paste button error:', err);
      setPasteNotice({
        text: 'Clipboard permission blocked. Press Ctrl + V (or Cmd + V) to paste directly!',
        isError: true
      });
      setTimeout(() => setPasteNotice(null), 4500);
    } finally {
      setIsProcessingFiles(false);
    }
  };

  // Dropzone drag handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };
  const handleDragLeave = () => {
    setDragOver(false);
  };
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleMultipleFiles(e.dataTransfer.files);
    }
  };

  // Category created in modal - dynamically updates availableCategories
  const handleCategoryCreated = (newCat: string) => {
    setAvailableCategories(prev => {
      const set = new Set([...prev, newCat]);
      return Array.from(set);
    });
  };

  // Section-level category toggling (toggles for the section and syncs across all items)
  const handleToggleUploadCategory = (cat: string) => {
    const exists = uploadCategories.some(c => c.toLowerCase() === cat.toLowerCase());
    const nextCategories = exists
      ? uploadCategories.filter(c => c.toLowerCase() !== cat.toLowerCase())
      : [...uploadCategories, cat];

    setUploadCategories(nextCategories);

    // Apply change to all queued images
    setQueuedImages(prev => prev.map(img => {
      const currentTags = img.tags || [];
      const itemHasCat = currentTags.some(t => t.toLowerCase() === cat.toLowerCase());
      const nextTags = exists
        ? currentTags.filter(t => t.toLowerCase() !== cat.toLowerCase())
        : (itemHasCat ? currentTags : [...currentTags, cat]);
      return {
        ...img,
        niche: (nextTags[0] || '') as NicheCategory,
        tags: nextTags
      };
    }));
  };

  const handleToggleYoutubeCategory = (cat: string) => {
    const exists = youtubeCategories.some(c => c.toLowerCase() === cat.toLowerCase());
    const nextCategories = exists
      ? youtubeCategories.filter(c => c.toLowerCase() !== cat.toLowerCase())
      : [...youtubeCategories, cat];

    setYoutubeCategories(nextCategories);

    // Apply change to all YouTube items
    setYoutubeItems(prev => prev.map(item => {
      const currentTags = item.tags || [];
      const itemHasCat = currentTags.some(t => t.toLowerCase() === cat.toLowerCase());
      const nextTags = exists
        ? currentTags.filter(t => t.toLowerCase() !== cat.toLowerCase())
        : (itemHasCat ? currentTags : [...currentTags, cat]);
      return {
        ...item,
        niche: (nextTags[0] || '') as NicheCategory,
        tags: nextTags
      };
    }));
  };

  const handleTogglePinterestCategory = (cat: string) => {
    const exists = pinterestCategories.some(c => c.toLowerCase() === cat.toLowerCase());
    const nextCategories = exists
      ? pinterestCategories.filter(c => c.toLowerCase() !== cat.toLowerCase())
      : [...pinterestCategories, cat];

    setPinterestCategories(nextCategories);

    // Apply change to all Pinterest items
    setPinterestItems(prev => prev.map(item => {
      const currentTags = item.tags || [];
      const itemHasCat = currentTags.some(t => t.toLowerCase() === cat.toLowerCase());
      const nextTags = exists
        ? currentTags.filter(t => t.toLowerCase() !== cat.toLowerCase())
        : (itemHasCat ? currentTags : [...currentTags, cat]);
      return {
        ...item,
        niche: (nextTags[0] || '') as NicheCategory,
        tags: nextTags
      };
    }));
  };

  // Upload Queued Images to Cloudflare R2 and Save
  const handleUploadQueuedImages = async () => {
    if (queuedImages.length === 0) return;
    setIsUploadingToCloud(true);
    setCloudError('');
    const isPoster = mediaKind === 'poster';
    setUploadStatusText(`Uploading ${queuedImages.length} ${isPoster ? 'posters' : 'thumbnails'} to Cloudflare R2...`);

    let finalItems: ThumbnailItem[] = [];
    let cloudOk = false;
    const payload = queuedImages.map(item => {
      const itemCategories = item.tags || [];
      const assignedId = item.id.startsWith('poster-') ? item.id : (isPoster ? `poster-${item.id}` : item.id);
      return {
        id: assignedId,
        kind: mediaKind,
        imageUrl: item.dataUrl,
        title: item.title || `Curated ${unitWord}`,
        creator: item.creator || (isPoster ? 'Cinema' : 'Creator'),
        niche: (itemCategories[0] || (isPoster ? 'Cinema' : '')) as NicheCategory,
        tags: itemCategories.length > 0 ? itemCategories : (isPoster ? ['Movie Poster', 'Cinema'] : [])
      };
    });

    try {
      const token = await getIdToken();
      if (!token) {
        throw new Error('Admin sign-in is required to upload thumbnails.');
      }
      const res = await fetch('/api/r2/upload-thumbnail', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ items: payload })
      });

      if (res.ok) {
        const data = await res.json();
        const uploadedMap = new Map<string, string>();
        const smallMap = new Map<string, string | undefined>();
        const dimsMap = new Map<string, { width?: number; height?: number }>();
        const colorMap = new Map<string, string[]>();
        let allBucketUploaded = true;
        if (data.items && Array.isArray(data.items)) {
          data.items.forEach((item: any) => {
            const key1 = item.originalId;
            const key2 = item.id;
            if (item.imageUrl) {
              if (key1) uploadedMap.set(key1, item.imageUrl);
              if (key2) uploadedMap.set(key2, item.imageUrl);
            }
            if (item.thumbSmallUrl) {
              if (key1) smallMap.set(key1, item.thumbSmallUrl);
              if (key2) smallMap.set(key2, item.thumbSmallUrl);
            }
            if (item.width || item.height) {
              const d = { width: item.width, height: item.height };
              if (key1) dimsMap.set(key1, d);
              if (key2) dimsMap.set(key2, d);
            }
            if (Array.isArray(item.colors)) {
              if (key1) colorMap.set(key1, item.colors);
              if (key2) colorMap.set(key2, item.colors);
            }
            if (item.uploadedToBucket === false) allBucketUploaded = false;
          });
        }

        if (r2Configured && !allBucketUploaded) {
          cloudOk = false;
          setCloudError(
            (Array.isArray(data.warnings) && data.warnings[0]) ||
              'Cloudflare R2 upload failed for one or more items. Check your R2 configuration and try again.'
          );
        } else {
          cloudOk = true;
          setCloudError('');
        }

        finalItems = queuedImages.map((img, idx) => {
          const itemCategories = img.tags || [];
          const payloadItem = payload[idx];
          const assignedId = data.items?.[idx]?.id || payloadItem?.id || img.id;
          const r2Url = uploadedMap.get(img.id) || uploadedMap.get(payloadItem?.id) || uploadedMap.get(assignedId) || img.dataUrl;
          const smallUrl = smallMap.get(img.id) || smallMap.get(payloadItem?.id) || smallMap.get(assignedId);
          const dims = dimsMap.get(img.id) || dimsMap.get(payloadItem?.id) || dimsMap.get(assignedId);

          return {
            id: assignedId,
            kind: mediaKind,
            title: img.title || `Curated ${unitWord}`,
            creator: img.creator || (isPoster ? 'Cinema' : 'Creator'),
            imageUrl: r2Url,
            thumbSmallUrl: smallUrl,
            sourceUrl: r2Url,
            niche: (itemCategories[0] || (isPoster ? 'Cinema' : '')) as NicheCategory,
            styles: ['Face Close-up', 'High-Contrast Glow'],
            tags: itemCategories.length > 0 ? itemCategories : (isPoster ? ['Movie Poster', 'Cinema'] : []),
            colors: colorMap.get(img.id) ?? colorMap.get(assignedId) ?? [],
            width: dims?.width,
            height: dims?.height,
            ocrText: '',
            emotion: 'Curious',
            breakdownNotes: isPoster ? 'Uploaded movie poster.' : 'Uploaded thumbnail design.',
            source: 'r2-storage',
            createdAt: new Date().toISOString(),
            likesCount: 0
          };
        });
      } else {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || 'Cloudflare R2 upload route returned an error');
      }
    } catch (err: any) {
      console.warn('Fallback to local storage upload:', err);
      if (err?.message) {
        setCloudError(err.message);
      }
      finalItems = queuedImages.map((img, idx) => {
        const itemCategories = img.tags || [];
        const payloadItem = payload[idx];
        const assignedId = payloadItem?.id || img.id;
        return {
          id: assignedId,
          kind: mediaKind,
          title: img.title || `Curated ${unitWord}`,
          creator: img.creator || (isPoster ? 'Cinema' : 'Creator'),
          imageUrl: img.dataUrl,
          sourceUrl: img.dataUrl,
          niche: (itemCategories[0] || (isPoster ? 'Cinema' : '')) as NicheCategory,
          styles: ['Face Close-up', 'High-Contrast Glow'],
          tags: itemCategories.length > 0 ? itemCategories : (isPoster ? ['Movie Poster', 'Cinema'] : []),
          colors: [],
          ocrText: '',
          emotion: 'Curious',
          breakdownNotes: isPoster ? 'Uploaded movie poster.' : 'Uploaded thumbnail design.',
          source: 'r2-storage',
          createdAt: new Date().toISOString(),
          likesCount: 0
        };
      });
    } finally {
      setIsUploadingToCloud(false);
      setUploadStatusText('');
    }

    if (!cloudOk) {
      setCloudError(prev => prev || 'Cloud sync failed — these items are local-only and will disappear on refresh. Check your connection and try again.');
    }

    if (finalItems.length > 0) {
      if (selectedBoardId) {
        addThumbnailsToBoard(selectedBoardId, finalItems.map(item => item.id));
      }
      if (onAddMultipleThumbnails) {
        onAddMultipleThumbnails(finalItems);
      } else {
        finalItems.forEach(item => onAddThumbnail(item));
      }
      // Stay open on sync failure so the warning banner is seen; the user
      // can retry instead of losing the queue.
      if (cloudOk) onClose();
    }
  };

  // --- YouTube Extraction Execution ---
  const handleExtractYoutube = async () => {
    const trimmed = youtubeInput.trim();
    if (!trimmed) {
      setYoutubeError('Please paste YouTube video URL(s) or channel @handle');
      return;
    }
    setYoutubeError('');
    setIsYoutubeLoading(true);
    setYoutubeItems([]);

    try {
      // 1. Check for direct Video link(s) FIRST
      const rawVideoMatches = extractYoutubeVideoIds(trimmed);

      // Deduplicate video links by ID immediately
      const uniqueMap = new Map<string, (typeof rawVideoMatches)[0]>();
      rawVideoMatches.forEach(m => {
        if (!uniqueMap.has(m.id)) uniqueMap.set(m.id, m);
      });
      const videoMatches = Array.from(uniqueMap.values());

      if (videoMatches.length > 0) {
        // Fetch rich YouTube details (views count, date uploaded, channel name, title) via details API
        const videoIds = videoMatches.map(m => m.id);
        let detailsMap: Record<string, any> = {};
        try {
          const token = await getIdToken();
          if (token) {
            const detRes = await fetch('/api/youtube/details', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ videoIds })
            });
            if (detRes.ok) {
              const detData = await detRes.json();
              detailsMap = detData.details || {};
            }
          }
        } catch (detErr) {
          console.warn('YouTube details fetch note:', detErr);
        }

        // Extract all matched video links in parallel with fallback to oEmbed if needed
        const items: BatchExtractedItem[] = await Promise.all(
          videoMatches.map(async (match) => {
            const imgUrl = getYoutubeJpgUrl(match.id);
            const det = detailsMap[match.id];
            let title = det?.title || 'YouTube Thumbnail';
            let creator = det?.creator || 'YouTube Creator';
            let views = det?.views || '';
            let publishedTime = det?.publishedTime || '';

            if (title === 'YouTube Thumbnail' || creator === 'YouTube Creator') {
              try {
                // Try YouTube's official oEmbed endpoint as fallback
                const ytOembedRes = await fetch(
                  `https://www.youtube.com/oembed?url=${encodeURIComponent(match.originalUrl)}&format=json`
                );
                if (ytOembedRes.ok) {
                  const ytData = await ytOembedRes.json();
                  if (ytData.title) title = ytData.title;
                  if (ytData.author_name) creator = ytData.author_name;
                }
              } catch (err) {
                console.warn('oEmbed lookup error for', match.id, err);
              }
            }

            const chosenCategories = [...youtubeCategories];
            return {
              id: `yt-vid-${match.id}`,
              videoId: match.id,
              url: match.originalUrl,
              title,
              creator,
              imageUrl: imgUrl,
              niche: (chosenCategories[0] || '') as NicheCategory,
              tags: [...chosenCategories],
              views,
              publishedTime,
              selected: true
            };
          })
        );

        if (items.length === 0) {
          throw new Error('No thumbnails could be resolved from provided YouTube video links');
        }

        setYoutubeItems(items);
      } else {
        // 2. Channel Bulk Extraction
        const token = await getIdToken();
        if (!token) {
          throw new Error('Admin sign-in is required to extract YouTube channels.');
        }
        const res = await fetch('/api/youtube/channel', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            channelUrl: trimmed,
            limit: youtubeChannelLimit
          })
        });
        const data = await res.json();
        const videoList = data.videos || data.items || [];
        if (!res.ok || !Array.isArray(videoList) || videoList.length === 0) {
          throw new Error(data.error || 'No thumbnails found for this channel');
        }

        // Deduplicate channel video items strictly by videoId
        const seenVideoIds = new Set<string>();
        const chosenCategories = [...youtubeCategories];
        const mapped: BatchExtractedItem[] = [];

        videoList.forEach((it: any, idx: number) => {
          const resolvedVid =
            (typeof it.videoId === 'string' && it.videoId.trim()) ||
            extractSingleYoutubeId(it.sourceUrl || it.imageUrl || it.id || '') ||
            undefined;
          const vId = resolvedVid || `${idx}`;
          if (seenVideoIds.has(vId)) return;
          seenVideoIds.add(vId);

          mapped.push({
            id: `yt-ch-${vId}`,
            videoId: resolvedVid,
            url: it.sourceUrl || (resolvedVid ? `https://www.youtube.com/watch?v=${resolvedVid}` : ''),
            title: it.title || 'YouTube Thumbnail',
            creator: it.creator || data.channel?.name || 'Creator',
            imageUrl: it.imageUrl || (resolvedVid ? getYoutubeJpgUrl(resolvedVid) : ''),
            niche: (chosenCategories[0] || '') as NicheCategory,
            tags: [...chosenCategories],
            views: it.views || '',
            publishedTime: it.publishedTime || '',
            selected: true
          });
        });

        setYoutubeItems(mapped);
      }
    } catch (err: any) {
      setYoutubeError(err.message || 'Failed to extract YouTube thumbnails');
    } finally {
      setIsYoutubeLoading(false);
    }
  };

  // --- Pinterest Extraction Execution ---
  const handleExtractPinterest = async () => {
    const trimmed = pinterestInput.trim();
    if (!trimmed) {
      setPinterestError('Please paste Pinterest pin link(s) or board URL');
      return;
    }
    setPinterestError('');
    setIsPinterestLoading(true);
    setPinterestItems([]);

    try {
      const token = await getIdToken();
      if (!token) {
        throw new Error('Admin sign-in is required to extract Pinterest pins.');
      }
      const res = await fetch('/api/pinterest/extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ text: trimmed })
      });
      const data = await res.json();
      if (!res.ok || !data.items || data.items.length === 0) {
        throw new Error(data.error || 'No Pinterest images found at this link');
      }

      const chosenCategories = [...pinterestCategories];
      const seenUrls = new Set<string>();
      const mapped: BatchExtractedItem[] = [];

      data.items.forEach((pin: any) => {
        const pinKey = pin.imageUrl || pin.url || pin.id;
        if (seenUrls.has(pinKey)) return;
        seenUrls.add(pinKey);

        mapped.push({
          id: `pin-${pin.id}`,
          url: pin.url,
          title: pin.title || 'Pinterest Pin',
          creator: pin.creator || 'Pinterest Curator',
          imageUrl: pin.imageUrl,
          niche: (chosenCategories[0] || '') as NicheCategory,
          tags: [...chosenCategories],
          selected: true
        });
      });

      setPinterestItems(mapped);
    } catch (err: any) {
      setPinterestError(err.message || 'Failed to extract Pinterest pin');
    } finally {
      setIsPinterestLoading(false);
    }
  };

  // Save extracted batch items (YouTube or Pinterest) to Cloudflare R2 and library
  const handleSaveBatchItems = async (items: BatchExtractedItem[]) => {
    const selected = items.filter(i => i.selected !== false);
    if (selected.length === 0) return;

    // Deduplicate selected batch items with extractDedupeKeys
    const seenBatchKeys = new Set<string>();
    const uniqueItems: BatchExtractedItem[] = [];
    selected.forEach(it => {
      const keys = extractDedupeKeys(it);
      if (keys.length === 0 || !keys.some(k => seenBatchKeys.has(k))) {
        keys.forEach(k => seenBatchKeys.add(k));
        uniqueItems.push(it);
      }
    });

    setIsUploadingToCloud(true);
    setCloudError('');
    const isPoster = mediaKind === 'poster';
    const unitLabel = isPoster ? 'posters' : 'thumbnails';
    setUploadStatusText(`Uploading 0/${uniqueItems.length} ${unitLabel}...`);

    let finalThumbnails: ThumbnailItem[] = uniqueItems.map((item) => {
      const chosenCategories = item.tags || [];
      const assignedId = isPoster
        ? `poster-${createRandomSuffix()}`
        : (item.videoId ? `thumb-yt-${item.videoId}` : (item.id || `thumb-ext-${createRandomSuffix()}`));
      return {
        id: assignedId,
        kind: mediaKind,
        title: item.title || (isPoster ? 'Movie Poster' : 'Thumbnail'),
        creator: item.creator || (isPoster ? 'Cinema' : 'Creator'),
        imageUrl: item.imageUrl,
        sourceUrl: item.url,
        niche: (chosenCategories[0] || (isPoster ? 'Cinema' : '')) as NicheCategory,
        styles: ['Face Close-up', 'High-Contrast Glow'],
        tags: chosenCategories.length > 0 ? chosenCategories : (isPoster ? ['Movie Poster', 'Cinema'] : []),
        colors: [],
        ocrText: '',
        emotion: 'Curious',
        breakdownNotes: isPoster ? 'Uploaded movie poster.' : 'Auto-extracted inspiration thumbnail.',
        viewsEstimate: item.views,
        publishedTime: item.publishedTime,
        source: 'r2-storage',
        createdAt: new Date().toISOString(),
        likesCount: 0
      };
    });

    let syncFailed = false;
    try {
      const uploadPayload = uniqueItems.map((item, idx) => {
        const chosenCategories = item.tags || [];
        const assignedId = finalThumbnails[idx].id;
        return {
          id: assignedId,
          kind: mediaKind,
          videoId: item.videoId,
          imageUrl: item.imageUrl,
          sourceUrl: item.url,
          title: item.title || (isPoster ? 'Movie Poster' : 'Thumbnail'),
          creator: item.creator || (isPoster ? 'Cinema' : 'Creator'),
          niche: (chosenCategories[0] || (isPoster ? 'Cinema' : '')) as NicheCategory,
          tags: chosenCategories.length > 0 ? chosenCategories : (isPoster ? ['Movie Poster', 'Cinema'] : []),
          views: item.views,
          viewsEstimate: item.views,
          publishedTime: item.publishedTime
        };
      });

      const map = new Map<string, string>();
      const smallMap = new Map<string, string | undefined>();
      const dimsMap = new Map<string, { width?: number; height?: number }>();
      const colorMap = new Map<string, string[]>();
      let allBucketUploaded = true;
      let firstWarning = '';
      let firstError = '';

      const token = await getIdToken();
      if (!token) {
        throw new Error('Admin sign-in is required to upload thumbnails.');
      }

      const CHUNK_SIZE = 12;
      for (let start = 0; start < uploadPayload.length; start += CHUNK_SIZE) {
        const chunk = uploadPayload.slice(start, start + CHUNK_SIZE);
        const end = Math.min(start + chunk.length, uploadPayload.length);
        setUploadStatusText(`Uploading ${end}/${uploadPayload.length} ${unitLabel}...`);

        const res = await fetch('/api/r2/upload-thumbnail', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ items: chunk })
        });

        if (res.ok) {
          const resData = await res.json();
          if (resData.items && Array.isArray(resData.items)) {
            resData.items.forEach((it: any) => {
              const key1 = it.originalId;
              const key2 = it.id;
              const key3 = it.videoId;
              if (it.imageUrl) {
                if (key1) map.set(key1, it.imageUrl);
                if (key2) map.set(key2, it.imageUrl);
                if (key3) map.set(key3, it.imageUrl);
              }
              if (it.thumbSmallUrl) {
                if (key1) smallMap.set(key1, it.thumbSmallUrl);
                if (key2) smallMap.set(key2, it.thumbSmallUrl);
                if (key3) smallMap.set(key3, it.thumbSmallUrl);
              }
              if (it.width || it.height) {
                const d = { width: it.width, height: it.height };
                if (key1) dimsMap.set(key1, d);
                if (key2) dimsMap.set(key2, d);
                if (key3) dimsMap.set(key3, d);
              }
              if (Array.isArray(it.colors)) {
                if (key1) colorMap.set(key1, it.colors);
                if (key2) colorMap.set(key2, it.colors);
                if (key3) colorMap.set(key3, it.colors);
              }
              if (it.uploadedToBucket === false) allBucketUploaded = false;
            });
          }
          if (!firstWarning && Array.isArray(resData.warnings) && resData.warnings[0]) {
            firstWarning = resData.warnings[0];
          }
        } else {
          const errData = await res.json().catch(() => null);
          if (!firstError) {
            firstError = errData?.error || 'Upload request failed. Please check your network and try again.';
          }
        }
      }

      finalThumbnails = finalThumbnails.map((item, idx) => {
        const vId = uniqueItems[idx]?.videoId;
        const origId = uploadPayload[idx]?.id;
        const r2Url = (vId ? map.get(vId) : null) || map.get(origId) || map.get(item.id) || item.imageUrl;
        const smallUrl = (vId ? smallMap.get(vId) : null) || smallMap.get(origId) || smallMap.get(item.id);
        const dims = (vId ? dimsMap.get(vId) : null) || dimsMap.get(origId) || dimsMap.get(item.id);
        return {
          ...item,
          imageUrl: r2Url,
          thumbSmallUrl: smallUrl,
          width: dims?.width ?? item.width,
          height: dims?.height ?? item.height,
          colors: (vId ? colorMap.get(vId) : null) ?? colorMap.get(origId) ?? colorMap.get(item.id) ?? [],
          viewsEstimate: uniqueItems[idx]?.views || item.viewsEstimate,
          publishedTime: uniqueItems[idx]?.publishedTime || item.publishedTime
        };
      });

      if (firstError) {
        setCloudError(firstError);
        syncFailed = true;
      } else if (r2Configured && !allBucketUploaded) {
        syncFailed = true;
        setCloudError(
          firstWarning ||
            'One or more thumbnails could not be uploaded to Cloudflare R2.'
        );
      } else {
        syncFailed = false;
        setCloudError('');
      }
    } catch (err) {
      console.warn('Batch upload notice:', err);
      setCloudError('Cloud sync failed — these items are local-only and will disappear on refresh. Check your connection and try again.');
      syncFailed = true;
    } finally {
      setIsUploadingToCloud(false);
      setUploadStatusText('');
    }

    if (selectedBoardId) {
      addThumbnailsToBoard(selectedBoardId, finalThumbnails.map(t => t.id));
    }
    if (onAddMultipleThumbnails) {
      onAddMultipleThumbnails(finalThumbnails);
    } else {
      finalThumbnails.forEach(t => onAddThumbnail(t));
    }
    // Stay open when the sync failed so the warning is seen and retry is possible.
    if (!syncFailed) onClose();
  };

  if (!isOpen) return null;

  const isReviewStage =
    (activeTab === 'upload' && queuedImages.length > 0) ||
    (activeTab === 'youtube' && youtubeItems.length > 0) ||
    (activeTab === 'pinterest' && pinterestItems.length > 0);

  const selectedYoutubeCount = youtubeItems.filter(i => i.selected !== false).length;
  const selectedPinterestCount = pinterestItems.filter(i => i.selected !== false).length;
  const activeReviewCount =
    activeTab === 'upload'
      ? queuedImages.length
      : activeTab === 'youtube'
        ? selectedYoutubeCount
        : selectedPinterestCount;

  const activeBoardName = selectedBoardId
    ? collections.find(b => b.id === selectedBoardId)?.name || 'Selected Board'
    : 'Feed only';

  const handleBackFromReview = () => {
    if (isUploadingToCloud) return;
    setCloudError('');
    if (activeTab === 'upload') setQueuedImages([]);
    if (activeTab === 'youtube') setYoutubeItems([]);
    if (activeTab === 'pinterest') setPinterestItems([]);
  };

  const renderBoardPanel = () => (
    <div className="p-4 bg-[#151821] border border-white/[0.08] rounded-[14px] space-y-3 text-white">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="font-semibold text-white/90 text-[11px] flex items-center gap-1.5">
          <Bookmark className="w-3.5 h-3.5 text-white/60 shrink-0" />
          <span>Save to Board</span>
        </span>
        <span className="text-[11px] text-white/50 truncate max-w-[160px]">
          {activeBoardName}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => setSelectedBoardId('')}
          className={`px-2.5 py-1.5 rounded-[8px] text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 whitespace-nowrap ${
            !selectedBoardId
              ? 'bg-white text-black font-bold shadow-xs'
              : 'bg-white/[0.06] hover:bg-white/[0.12] text-white/80 border border-white/10'
          }`}
        >
          <span>{!selectedBoardId ? '✓ ' : ''}</span>
          <span>Feed only</span>
        </button>

        {collections.map((board) => {
          const isSelected = selectedBoardId === board.id;
          return (
            <button
              key={board.id}
              type="button"
              onClick={() => setSelectedBoardId(board.id)}
              className={`px-2.5 py-1.5 rounded-[8px] text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 whitespace-nowrap ${
                isSelected
                  ? 'bg-white text-black font-bold shadow-xs'
                  : 'bg-white/[0.06] hover:bg-white/[0.12] text-white/80 border border-white/10'
              }`}
            >
              <span>{isSelected ? '✓ ' : '+ '}</span>
              <span>{board.name}</span>
            </button>
          );
        })}
      </div>

      {collections.length === 0 && (
        <p className="text-[11px] text-white/40">
          No boards yet — items will be saved directly to your main Feed.
        </p>
      )}
    </div>
  );

  return (
    <>
      <div
        id="add-modal-overlay"
        className={`fixed inset-0 z-50 flex ${
          isReviewStage ? 'items-stretch justify-stretch p-0 bg-[#090a0d]' : 'items-center justify-center p-3 sm:p-5 bg-black/45 backdrop-blur-md'
        } animate-fade-blur`}
      >
      {/* Click outside to close (input modal only) */}
      {!isReviewStage && <div className="fixed inset-0" onClick={onClose} />}

      {/* Always-mounted file input so "Add more" works in both compact & full-screen stages */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*"
        onChange={(e) => {
          if (e.target.files) handleMultipleFiles(e.target.files);
          e.target.value = '';
        }}
        className="hidden"
      />

      {/* Main Container: compact blurred card for URL/dropzone, full-screen studio workspace for confirmation/tags/boards */}
      <div
        id="add-modal-content"
        className={
          isReviewStage
            ? 'relative w-full h-full bg-[#090a0d] z-10 flex flex-col overflow-hidden text-white'
            : 'relative w-full max-w-[540px] bg-[#0e0e10]/90 backdrop-blur-2xl border border-white/[0.08] rounded-[14px] p-3 sm:p-4 shadow-[0_44px_100px_-20px_rgba(0,0,0,0.95)] overflow-hidden z-10 max-h-[92vh] flex flex-col animate-blur-in text-white'
        }
        style={isReviewStage ? undefined : { backdropFilter: 'blur(28px)', WebkitBackdropFilter: 'blur(28px)' }}
      >
        {/* Top Bar */}
        {isReviewStage ? (
          <header className="h-14 sm:h-16 px-4 sm:px-6 border-b border-white/[0.08] bg-[#090a0d] flex items-center justify-between gap-4 shrink-0">
            {/* Left: Back + Review Title + R2 status */}
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={handleBackFromReview}
                disabled={isUploadingToCloud}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-xs font-medium text-white/85 hover:text-white transition-colors cursor-pointer disabled:opacity-40 whitespace-nowrap shrink-0"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>

              <div className="hidden sm:flex items-center gap-2 text-xs min-w-0">
                <span className="font-semibold text-white truncate">Review &amp; Upload</span>
                <span className="text-white/30" aria-hidden="true">·</span>
                <span className="text-white/60 tabular whitespace-nowrap">
                  {activeReviewCount} selected
                </span>
              </div>

              <button
                type="button"
                onClick={() => setIsR2ModalOpen(true)}
                className={`hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-[10px] text-[11px] font-medium transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                  r2Configured
                    ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/25 hover:bg-emerald-500/20'
                    : 'bg-orange-500/10 text-orange-300 border border-orange-500/25 hover:bg-orange-500/20'
                }`}
                title={r2Configured ? `Cloudflare R2 connected (${r2BucketName}) - Click to configure` : 'Connect Cloudflare R2 Storage'}
              >
                <Cloud className="w-3.5 h-3.5 shrink-0" />
                <span>{r2Configured ? 'R2 Storage' : 'Connect R2'}</span>
              </button>
            </div>

            {/* Center: Source Tabs */}
            <div className="inline-flex gap-0.5 p-1 bg-[#151518] rounded-[14px] border border-white/[0.08] shadow-sm shrink-0">
              <button
                type="button"
                id="tab-upload-images"
                onClick={() => setActiveTab('upload')}
                className={`flex items-center rounded-[11px] font-medium text-xs transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'upload'
                    ? 'bg-[#f2f2f3] text-[#0a0a0b] px-3.5 py-1.5 shadow-xs'
                    : 'text-[#8b8b93] hover:text-white px-2.5 py-1.5'
                }`}
              >
                <RealUploadIcon className="w-4 h-4 shrink-0" />
                <span className={`overflow-hidden whitespace-nowrap transition-all duration-300 font-medium ${activeTab === 'upload' ? 'max-w-[90px] ml-1.5 opacity-100' : 'max-w-0 opacity-0'}`}>
                  Upload
                </span>
              </button>

              <button
                type="button"
                id="tab-youtube-import"
                onClick={() => setActiveTab('youtube')}
                className={`flex items-center rounded-[11px] font-medium text-xs transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'youtube'
                    ? 'bg-[#f2f2f3] text-[#0a0a0b] px-3.5 py-1.5 shadow-xs'
                    : 'text-[#8b8b93] hover:text-white px-2.5 py-1.5'
                }`}
              >
                <RealYoutubeIcon className="w-4 h-4 shrink-0" />
                <span className={`overflow-hidden whitespace-nowrap transition-all duration-300 font-medium ${activeTab === 'youtube' ? 'max-w-[90px] ml-1.5 opacity-100' : 'max-w-0 opacity-0'}`}>
                  YouTube
                </span>
              </button>

              <button
                type="button"
                id="tab-pinterest-import"
                onClick={() => setActiveTab('pinterest')}
                className={`flex items-center rounded-[11px] font-medium text-xs transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'pinterest'
                    ? 'bg-[#f2f2f3] text-[#0a0a0b] px-3.5 py-1.5 shadow-xs'
                    : 'text-[#8b8b93] hover:text-white px-2.5 py-1.5'
                }`}
              >
                <RealPinterestIcon className="w-4 h-4 shrink-0" />
                <span className={`overflow-hidden whitespace-nowrap transition-all duration-300 font-medium ${activeTab === 'pinterest' ? 'max-w-[90px] ml-1.5 opacity-100' : 'max-w-0 opacity-0'}`}>
                  Pinterest
                </span>
              </button>
            </div>

            {/* Right: Close */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                id="add-modal-close-btn"
                onClick={onClose}
                aria-label="Close add modal"
                className="w-9 h-9 rounded-[10px] flex items-center justify-center text-white/50 hover:text-white hover:bg-white/[0.08] border border-white/[0.08] transition-colors cursor-pointer"
                title="Close (Esc)"
              >
                <IconClose className="w-4 h-4" />
              </button>
            </div>
          </header>
        ) : (
          <div className="relative flex items-center justify-center mb-3">
            {/* Cloudflare Storage Button on left */}
            <button
              type="button"
              onClick={() => setIsR2ModalOpen(true)}
              className={`absolute left-0 top-1/2 -translate-y-1/2 flex items-center gap-1.5 px-2 py-1 rounded-[10px] text-[11px] font-medium transition-all cursor-pointer ${
                r2Configured
                  ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/25 hover:bg-emerald-500/20'
                  : 'bg-orange-500/10 text-orange-300 border border-orange-500/25 hover:bg-orange-500/20'
              }`}
              title={r2Configured ? `Cloudflare R2 connected (${r2BucketName}) - Click to configure` : 'Connect Cloudflare R2 Storage'}
            >
              <Cloud className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">
                {r2Configured ? 'R2 Storage' : 'Connect R2'}
              </span>
              <span className={`w-1.5 h-1.5 rounded-full ${r2Configured ? 'bg-emerald-400' : 'bg-orange-400'}`} />
            </button>

            <div className="inline-flex gap-0.5 p-1 bg-[#151518]/90 rounded-[14px] border border-white/[0.08] shadow-sm">
              {/* Tab: Upload */}
              <button
                type="button"
                id="tab-upload-images"
                onClick={() => setActiveTab('upload')}
                className={`flex items-center rounded-[11px] font-medium text-xs transition-all cursor-pointer ${
                  activeTab === 'upload'
                    ? 'bg-[#f2f2f3] text-[#0a0a0b] px-3.5 py-2 shadow-xs'
                    : 'text-[#8b8b93] hover:text-white px-2.5 py-2'
                }`}
              >
                <RealUploadIcon className="w-4 h-4 shrink-0" />
                <span
                  className={`overflow-hidden whitespace-nowrap transition-all duration-300 font-medium ${
                    activeTab === 'upload' ? 'max-w-[90px] ml-1.5 opacity-100' : 'max-w-0 opacity-0'
                  }`}
                >
                  Upload
                </span>
                {queuedImages.length > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-blue-600 text-white">
                    {queuedImages.length}
                  </span>
                )}
              </button>

              {/* Tab: YouTube */}
              <button
                type="button"
                id="tab-youtube-import"
                onClick={() => setActiveTab('youtube')}
                className={`flex items-center rounded-[11px] font-medium text-xs transition-all cursor-pointer ${
                  activeTab === 'youtube'
                    ? 'bg-[#f2f2f3] text-[#0a0a0b] px-3.5 py-2 shadow-xs'
                    : 'text-[#8b8b93] hover:text-white px-2.5 py-2'
                }`}
              >
                <RealYoutubeIcon className="w-4 h-4 shrink-0" />
                <span
                  className={`overflow-hidden whitespace-nowrap transition-all duration-300 font-medium ${
                    activeTab === 'youtube' ? 'max-w-[90px] ml-1.5 opacity-100' : 'max-w-0 opacity-0'
                  }`}
                >
                  YouTube
                </span>
              </button>

              {/* Tab: Pinterest with Real Pinterest Logo */}
              <button
                type="button"
                id="tab-pinterest-import"
                onClick={() => setActiveTab('pinterest')}
                className={`flex items-center rounded-[11px] font-medium text-xs transition-all cursor-pointer ${
                  activeTab === 'pinterest'
                    ? 'bg-[#f2f2f3] text-[#0a0a0b] px-3.5 py-2 shadow-xs'
                    : 'text-[#8b8b93] hover:text-white px-2.5 py-2'
                }`}
              >
                <RealPinterestIcon className="w-4 h-4 shrink-0" />
                <span
                  className={`overflow-hidden whitespace-nowrap transition-all duration-300 font-medium ${
                    activeTab === 'pinterest' ? 'max-w-[90px] ml-1.5 opacity-100' : 'max-w-0 opacity-0'
                  }`}
                >
                  Pinterest
                </span>
              </button>
            </div>

            {/* Close button on right */}
            <button
              type="button"
              id="add-modal-close-btn"
              onClick={onClose}
              aria-label="Close add modal"
              className="absolute right-0 top-1/2 -translate-y-1/2 w-8 h-8 rounded-[11px] flex items-center justify-center text-white/40 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
              title="Close"
            >
              <IconClose className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Body */}
        {!isReviewStage ? (
          <div className="flex-1 overflow-y-auto px-0.5 py-1 space-y-3 custom-scrollbar">
            {/* TAB 1: UPLOAD DROPZONE */}
            {activeTab === 'upload' && (
              <div className="space-y-3 animate-in fade-in duration-200">
                {pasteNotice && (
                  <div
                    className={`p-2.5 rounded-[11px] text-xs flex items-center justify-between gap-2 animate-in fade-in slide-in-from-top-1 duration-150 ${
                      pasteNotice.isError
                        ? 'bg-red-500/10 border border-red-500/20 text-red-300'
                        : 'bg-white/[0.05] border border-white/10 text-white'
                    }`}
                  >
                    <span>{pasteNotice.text}</span>
                    <button
                      type="button"
                      onClick={() => setPasteNotice(null)}
                      className="text-white/40 hover:text-white text-sm leading-none"
                    >
                      &times;
                    </button>
                  </div>
                )}

                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`viewfinder-dz relative min-h-[300px] flex flex-col items-center justify-center p-6 text-center cursor-pointer select-none group transition-all ${
                    dragOver ? 'border-white/40 bg-white/[0.08] scale-[0.99]' : ''
                  }`}
                >
                  <i className="viewfinder-corner top-4 left-4 border-t-2 border-l-2 rounded-tl-[8px]" />
                  <i className="viewfinder-corner top-4 right-4 border-t-2 border-r-2 rounded-tr-[8px]" />
                  <i className="viewfinder-corner bottom-4 left-4 border-b-2 border-l-2 rounded-bl-[8px]" />
                  <i className="viewfinder-corner bottom-4 right-4 border-b-2 border-r-2 rounded-br-[8px]" />

                  <div className="w-[54px] h-[54px] rounded-[16px] bg-[#0e0e10] border border-white/14 shadow-[0_10px_24px_-8px_rgba(0,0,0,0.85)] flex items-center justify-center mb-4 group-hover:-translate-y-1 transition-transform duration-300">
                    {isProcessingFiles ? (
                      <IconSpinner className="w-5 h-5 animate-spin text-white" />
                    ) : (
                      <RealUploadIcon className="w-5 h-5 text-white/80 group-hover:text-white transition-colors" />
                    )}
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs text-white/90 font-medium">
                      {isProcessingFiles
                        ? 'Processing and formatting images...'
                        : 'Drop images here, paste from clipboard (Ctrl+V), or click to browse'}
                    </p>
                    <p className="text-xs text-[#8b8b93] font-normal">
                      PNG, JPG, WebP
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: YOUTUBE LINK / CHANNEL INPUT */}
            {activeTab === 'youtube' && (
              <div className="space-y-3 animate-in fade-in duration-200">
                <div className="viewfinder-dz relative min-h-[300px] flex flex-col items-center justify-center p-6 text-center select-none group transition-all">
                  <i className="viewfinder-corner top-4 left-4 border-t-2 border-l-2 rounded-tl-[8px]" />
                  <i className="viewfinder-corner top-4 right-4 border-t-2 border-r-2 rounded-tr-[8px]" />
                  <i className="viewfinder-corner bottom-4 left-4 border-b-2 border-l-2 rounded-bl-[8px]" />
                  <i className="viewfinder-corner bottom-4 right-4 border-b-2 border-r-2 rounded-br-[8px]" />

                  <div className="w-[54px] h-[54px] rounded-[16px] bg-[#0e0e10] border border-white/14 shadow-[0_10px_24px_-8px_rgba(0,0,0,0.85)] flex items-center justify-center mb-3.5 group-hover:-translate-y-1 transition-transform duration-300">
                    <RealYoutubeIcon className="w-6 h-6 text-white" />
                  </div>

                  <p className="text-xs text-white/90 font-medium mb-1">
                    Paste YouTube video links or channel handle (@handle)
                  </p>
                  <p className="text-xs text-[#8b8b93] font-normal mb-3">
                    Supports bulk extraction of thumbnails in maximum resolution
                  </p>

                  <textarea
                    rows={2}
                    value={youtubeInput}
                    onChange={(e) => {
                      setYoutubeInput(e.target.value);
                      setYoutubeError('');
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault();
                        handleExtractYoutube();
                      }
                    }}
                    placeholder="https://youtube.com/watch?v=... or @channel"
                    className="w-full max-w-[420px] px-3.5 py-2.5 bg-[#0e0e10]/90 border border-white/12 rounded-[14px] text-xs text-white placeholder-white/30 focus:outline-none focus:border-white/30 transition-all resize-none shadow-inner"
                  />

                  {isChannelInput(youtubeInput) && (
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-white/50 text-[11px]">Extract count:</span>
                      {[30, 50, 100].map(limit => (
                        <button
                          key={limit}
                          type="button"
                          onClick={() => setYoutubeChannelLimit(limit)}
                          className={`px-2.5 py-0.5 rounded-[8px] text-[11px] font-medium transition-all ${
                            youtubeChannelLimit === limit
                              ? 'bg-white text-black font-semibold'
                              : 'bg-white/[0.06] text-white/60 hover:text-white border border-white/10'
                          }`}
                        >
                          {limit}
                        </button>
                      ))}
                    </div>
                  )}

                  {youtubeError && (
                    <p className="text-xs text-red-400 mt-2 font-medium">
                      {youtubeError}
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={handleExtractYoutube}
                    disabled={isYoutubeLoading || !youtubeInput.trim()}
                    className="mt-3.5 px-5 py-2 rounded-[11px] bg-white text-black font-semibold text-xs hover:bg-white/90 disabled:opacity-40 transition-all shadow-sm flex items-center gap-2 cursor-pointer active:scale-95"
                  >
                    {isYoutubeLoading ? (
                      <>
                        <IconSpinner className="w-3.5 h-3.5 animate-spin" />
                        <span>Extracting...</span>
                      </>
                    ) : (
                      <>
                        <IconSparkles className="w-3.5 h-3.5" />
                        <span>Extract Thumbnails</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* TAB 3: PINTEREST LINK INPUT */}
            {activeTab === 'pinterest' && (
              <div className="space-y-3 animate-in fade-in duration-200">
                <div className="viewfinder-dz relative min-h-[300px] flex flex-col items-center justify-center p-6 text-center select-none group transition-all">
                  <i className="viewfinder-corner top-4 left-4 border-t-2 border-l-2 rounded-tl-[8px]" />
                  <i className="viewfinder-corner top-4 right-4 border-t-2 border-r-2 rounded-tr-[8px]" />
                  <i className="viewfinder-corner bottom-4 left-4 border-b-2 border-l-2 rounded-bl-[8px]" />
                  <i className="viewfinder-corner bottom-4 right-4 border-b-2 border-r-2 rounded-br-[8px]" />

                  <div className="w-[54px] h-[54px] rounded-[16px] bg-[#0e0e10] border border-white/14 shadow-[0_10px_24px_-8px_rgba(0,0,0,0.85)] flex items-center justify-center mb-3.5 group-hover:-translate-y-1 transition-transform duration-300">
                    <RealPinterestIcon className="w-6 h-6 text-white" />
                  </div>

                  <p className="text-xs text-white/90 font-medium mb-1">
                    Paste Pinterest pin links or board URL
                  </p>
                  <p className="text-xs text-[#8b8b93] font-normal mb-3">
                    Extracts high-definition Pinterest images
                  </p>

                  <textarea
                    rows={2}
                    value={pinterestInput}
                    onChange={(e) => {
                      setPinterestInput(e.target.value);
                      setPinterestError('');
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault();
                        handleExtractPinterest();
                      }
                    }}
                    placeholder="https://pinterest.com/pin/... or https://pin.it/..."
                    className="w-full max-w-[420px] px-3.5 py-2.5 bg-[#0e0e10]/90 border border-white/12 rounded-[14px] text-xs text-white placeholder-white/30 focus:outline-none focus:border-white/30 transition-all resize-none shadow-inner"
                  />

                  {pinterestError && (
                    <p className="text-xs text-red-400 mt-2 font-medium">
                      {pinterestError}
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={handleExtractPinterest}
                    disabled={isPinterestLoading || !pinterestInput.trim()}
                    className="mt-3.5 px-5 py-2 rounded-[11px] bg-white text-black font-semibold text-xs hover:bg-white/90 disabled:opacity-40 transition-all shadow-sm flex items-center gap-2 cursor-pointer active:scale-95"
                  >
                    {isPinterestLoading ? (
                      <>
                        <IconSpinner className="w-3.5 h-3.5 animate-spin" />
                        <span>Extracting...</span>
                      </>
                    ) : (
                      <>
                        <IconSparkles className="w-3.5 h-3.5" />
                        <span>Extract Pins</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* ============================================================= */
          /* FULL-SCREEN REVIEW, TAGS, BOARDS & UPLOAD CONFIRMATION WORKSPACE */
          /* ============================================================= */
          <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden animate-in fade-in duration-200">
            {/* LEFT / MAIN MEDIA REVIEW GRID */}
            <div className="flex-1 min-w-0 overflow-y-auto p-4 sm:p-6 bg-[#090a0d] custom-scrollbar">
              {/* Upload Review */}
              {activeTab === 'upload' && queuedImages.length > 0 && (
                <div className="space-y-5">
                  {/* Toolbar */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-white/[0.08]">
                    <div className="flex items-center gap-2.5 text-xs">
                      <span className="font-semibold text-white tabular">
                        {queuedImages.length} {queuedImages.length === 1 ? 'thumbnail' : 'thumbnails'} ready
                      </span>
                      <span className="text-white/30" aria-hidden="true">·</span>
                      <span className="text-white/50">You can paste more (Ctrl+V) or add files</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-3 py-1.5 rounded-[8px] bg-white/[0.06] hover:bg-white/[0.12] text-white border border-white/10 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                      >
                        <IconPlus className="w-3.5 h-3.5" />
                        <span>Add more</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setQueuedImages([])}
                        className="px-3 py-1.5 rounded-[8px] text-white/50 hover:text-white hover:bg-white/[0.06] text-xs font-medium transition-colors cursor-pointer whitespace-nowrap"
                      >
                        Clear all
                      </button>
                    </div>
                  </div>

                  {/* Responsive Cards Grid (single large showcase if 1 item, spacious grid if multiple) */}
                  <div
                    className={
                      queuedImages.length === 1
                        ? 'max-w-3xl mx-auto'
                        : 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4'
                    }
                  >
                    {queuedImages.map((img, index) => (
                      <div
                        key={img.id}
                        className="p-3.5 bg-[#151821] border border-white/[0.08] rounded-[14px] flex flex-col gap-3 group hover:border-white/20 transition-all"
                      >
                        <div className="w-full aspect-video rounded-[10px] overflow-hidden bg-[#050608] relative border border-white/[0.08]">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={sanitizeSafeImageSrc(img.dataUrl)}
                            alt={img.title}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => setQueuedImages(prev => prev.filter((_, i) => i !== index))}
                            className="absolute top-2 right-2 w-7 h-7 rounded-[8px] bg-black/70 hover:bg-red-500/90 text-white/80 hover:text-white border border-white/10 flex items-center justify-center transition-colors cursor-pointer"
                            title="Remove image"
                          >
                            <IconTrash className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="space-y-2.5 flex-1 flex flex-col">
                          <input
                            type="text"
                            value={img.title}
                            onChange={(e) => {
                              const val = e.target.value;
                              setQueuedImages(prev => prev.map((p, i) => i === index ? { ...p, title: val } : p));
                            }}
                            placeholder="Thumbnail Title"
                            className="w-full px-2.5 py-1.5 bg-[#090a0d] border border-white/[0.08] rounded-[8px] text-xs font-medium text-white placeholder:text-white/30 focus:outline-none focus:border-white/25"
                          />

                          <input
                            type="text"
                            value={img.creator}
                            onChange={(e) => {
                              const val = e.target.value;
                              setQueuedImages(prev => prev.map((p, i) => i === index ? { ...p, creator: val } : p));
                            }}
                            placeholder="Channel / Creator Name"
                            className="w-full px-2.5 py-1 bg-[#090a0d] border border-white/[0.08] rounded-[8px] text-[11px] text-white/80 placeholder:text-white/30 focus:outline-none focus:border-white/25"
                          />

                          <div className="pt-0.5">
                            <ItemCategoryMultiSelect
                              selectedCategories={img.tags || []}
                              availableCategories={availableCategories}
                              onChange={(cats) => {
                                setQueuedImages(prev => prev.map((p, i) => i === index ? {
                                  ...p,
                                  niche: (cats[0] || '') as NicheCategory,
                                  tags: cats
                                } : p));
                              }}
                              onCategoryCreated={handleCategoryCreated}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* YouTube Review */}
              {activeTab === 'youtube' && youtubeItems.length > 0 && (
                <div className="space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-white/[0.08]">
                    <div className="flex items-center gap-2.5 text-xs">
                      <span className="font-semibold text-white tabular">
                        Found {youtubeItems.length} {youtubeItems.length === 1 ? 'thumbnail' : 'thumbnails'}
                      </span>
                      <span className="text-white/30" aria-hidden="true">·</span>
                      <span className="text-white/60 tabular">{selectedYoutubeCount} selected for upload</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const allSelected = youtubeItems.every(i => i.selected !== false);
                          setYoutubeItems(prev => prev.map(p => ({ ...p, selected: !allSelected })));
                        }}
                        className="px-3 py-1.5 rounded-[8px] bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-xs font-medium text-white transition-colors cursor-pointer whitespace-nowrap"
                      >
                        {youtubeItems.every(i => i.selected !== false) ? 'Deselect All' : 'Select All'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setYoutubeItems([])}
                        className="px-3 py-1.5 rounded-[8px] text-white/50 hover:text-white hover:bg-white/[0.06] text-xs font-medium transition-colors cursor-pointer whitespace-nowrap"
                      >
                        Reset
                      </button>
                    </div>
                  </div>

                  <div
                    className={
                      youtubeItems.length === 1
                        ? 'max-w-3xl mx-auto'
                        : 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4'
                    }
                  >
                    {youtubeItems.map((item, index) => {
                      const isSelected = item.selected !== false;
                      const formattedViews = item.views ? formatShortViews(item.views) : '';
                      return (
                        <div
                          key={item.id}
                          className={`p-3.5 rounded-[14px] border flex flex-col gap-3 transition-all ${
                            isSelected
                              ? 'bg-[#151821] border-white/[0.12] hover:border-white/25'
                              : 'bg-[#0f1117] border-white/[0.05] opacity-55'
                          }`}
                        >
                          <div
                            className="w-full aspect-video rounded-[10px] overflow-hidden bg-[#050608] relative border border-white/[0.08] cursor-pointer"
                            onClick={() => {
                              setYoutubeItems(prev => prev.map((p, i) => i === index ? { ...p, selected: p.selected === false ? true : false } : p));
                            }}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={sanitizeSafeImageSrc(item.imageUrl)}
                              alt={item.title}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover"
                            />
                            <label
                              className="absolute top-2 left-2 flex items-center justify-center w-6 h-6 rounded-[7px] bg-black/70 border border-white/15 cursor-pointer"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {
                                  setYoutubeItems(prev => prev.map((p, i) => i === index ? { ...p, selected: p.selected === false ? true : false } : p));
                                }}
                                className="rounded accent-white cursor-pointer"
                              />
                            </label>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setYoutubeItems(prev => prev.filter((_, i) => i !== index));
                              }}
                              className="absolute top-2 right-2 w-7 h-7 rounded-[8px] bg-black/70 hover:bg-red-500/90 text-white/80 hover:text-white border border-white/10 flex items-center justify-center transition-colors cursor-pointer"
                              title="Remove"
                            >
                              <IconTrash className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="space-y-2 flex-1 flex flex-col">
                            <input
                              type="text"
                              value={item.title}
                              onChange={(e) => {
                                const val = e.target.value;
                                setYoutubeItems(prev => prev.map((p, i) => i === index ? { ...p, title: val } : p));
                              }}
                              placeholder="Thumbnail Title"
                              className="w-full px-2.5 py-1.5 bg-[#090a0d] border border-white/[0.08] rounded-[8px] text-xs font-medium text-white placeholder:text-white/30 focus:outline-none focus:border-white/25"
                            />

                            <div className="flex items-center justify-between gap-2 text-[11px] text-white/60">
                              <input
                                type="text"
                                value={item.creator}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setYoutubeItems(prev => prev.map((p, i) => i === index ? { ...p, creator: val } : p));
                                }}
                                placeholder="Channel Name"
                                className="flex-1 min-w-0 px-2 py-1 bg-[#090a0d] border border-white/[0.08] rounded-[8px] text-[11px] text-white/85 placeholder:text-white/30 focus:outline-none focus:border-white/25"
                              />
                              {formattedViews && (
                                <span className="tabular shrink-0 text-white/55">
                                  {formattedViews}
                                </span>
                              )}
                            </div>

                            <div className="pt-0.5">
                              <ItemCategoryMultiSelect
                                selectedCategories={item.tags || []}
                                availableCategories={availableCategories}
                                onChange={(cats) => {
                                  setYoutubeItems(prev => prev.map((p, i) => i === index ? {
                                    ...p,
                                    niche: (cats[0] || '') as NicheCategory,
                                    tags: cats
                                  } : p));
                                }}
                                onCategoryCreated={handleCategoryCreated}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Pinterest Review */}
              {activeTab === 'pinterest' && pinterestItems.length > 0 && (
                <div className="space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-white/[0.08]">
                    <div className="flex items-center gap-2.5 text-xs">
                      <span className="font-semibold text-white tabular">
                        Found {pinterestItems.length} Pinterest {pinterestItems.length === 1 ? 'pin' : 'pins'}
                      </span>
                      <span className="text-white/30" aria-hidden="true">·</span>
                      <span className="text-white/60 tabular">{selectedPinterestCount} selected for upload</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const allSelected = pinterestItems.every(i => i.selected !== false);
                          setPinterestItems(prev => prev.map(p => ({ ...p, selected: !allSelected })));
                        }}
                        className="px-3 py-1.5 rounded-[8px] bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-xs font-medium text-white transition-colors cursor-pointer whitespace-nowrap"
                      >
                        {pinterestItems.every(i => i.selected !== false) ? 'Deselect All' : 'Select All'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setPinterestItems([])}
                        className="px-3 py-1.5 rounded-[8px] text-white/50 hover:text-white hover:bg-white/[0.06] text-xs font-medium transition-colors cursor-pointer whitespace-nowrap"
                      >
                        Reset
                      </button>
                    </div>
                  </div>

                  <div
                    className={
                      pinterestItems.length === 1
                        ? 'max-w-3xl mx-auto'
                        : 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4'
                    }
                  >
                    {pinterestItems.map((item, index) => {
                      const isSelected = item.selected !== false;
                      return (
                        <div
                          key={item.id}
                          className={`p-3.5 rounded-[14px] border flex flex-col gap-3 transition-all ${
                            isSelected
                              ? 'bg-[#151821] border-white/[0.12] hover:border-white/25'
                              : 'bg-[#0f1117] border-white/[0.05] opacity-55'
                          }`}
                        >
                          <div
                            className="w-full aspect-video rounded-[10px] overflow-hidden bg-[#050608] relative border border-white/[0.08] cursor-pointer"
                            onClick={() => {
                              setPinterestItems(prev => prev.map((p, i) => i === index ? { ...p, selected: !p.selected } : p));
                            }}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={sanitizeSafeImageSrc(item.imageUrl)}
                              alt={item.title}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover"
                            />
                            <label
                              className="absolute top-2 left-2 flex items-center justify-center w-6 h-6 rounded-[7px] bg-black/70 border border-white/15 cursor-pointer"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {
                                  setPinterestItems(prev => prev.map((p, i) => i === index ? { ...p, selected: !p.selected } : p));
                                }}
                                className="rounded accent-white cursor-pointer"
                              />
                            </label>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPinterestItems(prev => prev.filter((_, i) => i !== index));
                              }}
                              className="absolute top-2 right-2 w-7 h-7 rounded-[8px] bg-black/70 hover:bg-red-500/90 text-white/80 hover:text-white border border-white/10 flex items-center justify-center transition-colors cursor-pointer"
                              title="Remove"
                            >
                              <IconTrash className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="space-y-2 flex-1 flex flex-col">
                            <input
                              type="text"
                              value={item.title}
                              onChange={(e) => {
                                const val = e.target.value;
                                setPinterestItems(prev => prev.map((p, i) => i === index ? { ...p, title: val } : p));
                              }}
                              placeholder="Pin Title"
                              className="w-full px-2.5 py-1.5 bg-[#090a0d] border border-white/[0.08] rounded-[8px] text-xs font-medium text-white placeholder:text-white/30 focus:outline-none focus:border-white/25"
                            />

                            <input
                              type="text"
                              value={item.creator}
                              onChange={(e) => {
                                const val = e.target.value;
                                setPinterestItems(prev => prev.map((p, i) => i === index ? { ...p, creator: val } : p));
                              }}
                              placeholder="Creator"
                              className="w-full px-2.5 py-1 bg-[#090a0d] border border-white/[0.08] rounded-[8px] text-[11px] text-white/85 placeholder:text-white/30 focus:outline-none focus:border-white/25"
                            />

                            <div className="pt-0.5">
                              <ItemCategoryMultiSelect
                                selectedCategories={item.tags || []}
                                availableCategories={availableCategories}
                                onChange={(cats) => {
                                  setPinterestItems(prev => prev.map((p, i) => i === index ? {
                                    ...p,
                                    niche: (cats[0] || '') as NicheCategory,
                                    tags: cats
                                  } : p));
                                }}
                                onCategoryCreated={handleCategoryCreated}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT SIDEBAR: TAGS/CATEGORIES, BOARDS & UPLOAD CONFIRMATION */}
            <aside className="w-full lg:w-[360px] xl:w-[400px] shrink-0 border-t lg:border-t-0 lg:border-l border-white/[0.08] bg-[#0f1117] flex flex-col max-h-[46vh] lg:max-h-none">
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 custom-scrollbar">
                {activeTab === 'upload' && (
                  <UnifiedCategoryBar
                    label="Apply categories to all"
                    itemCount={queuedImages.length}
                    categories={availableCategories}
                    selectedCategories={uploadCategories}
                    onToggleCategory={handleToggleUploadCategory}
                    onCategoryCreated={handleCategoryCreated}
                    hideBoardSelector={true}
                  />
                )}
                {activeTab === 'youtube' && (
                  <UnifiedCategoryBar
                    label="Apply categories to all"
                    itemCount={youtubeItems.length}
                    categories={availableCategories}
                    selectedCategories={youtubeCategories}
                    onToggleCategory={handleToggleYoutubeCategory}
                    onCategoryCreated={handleCategoryCreated}
                    hideBoardSelector={true}
                  />
                )}
                {activeTab === 'pinterest' && (
                  <UnifiedCategoryBar
                    label="Apply categories to all"
                    itemCount={pinterestItems.length}
                    categories={availableCategories}
                    selectedCategories={pinterestCategories}
                    onToggleCategory={handleTogglePinterestCategory}
                    onCategoryCreated={handleCategoryCreated}
                    hideBoardSelector={true}
                  />
                )}

                {renderBoardPanel()}

                {cloudError && (
                  <div className="p-3 bg-red-500/10 border border-red-500/25 text-red-300 rounded-[10px] text-xs">
                    {cloudError}
                  </div>
                )}
              </div>

              {/* Sticky Confirmation Footer */}
              <div className="p-4 sm:p-5 border-t border-white/[0.08] bg-[#0f1117] shrink-0 space-y-3">
                <div className="flex items-center justify-between text-xs text-white/60">
                  <span className="tabular">{activeReviewCount} {activeReviewCount === 1 ? 'item' : 'items'} selected</span>
                  <span className="truncate max-w-[180px]">{activeBoardName}</span>
                </div>

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={handleBackFromReview}
                    disabled={isUploadingToCloud}
                    className="px-4 py-2.5 rounded-[10px] text-xs font-semibold text-white/75 hover:text-white bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 transition-colors cursor-pointer disabled:opacity-40 whitespace-nowrap"
                  >
                    Cancel
                  </button>

                  {activeTab === 'upload' && (
                    <button
                      type="button"
                      id="save-all-queued-images-btn"
                      onClick={handleUploadQueuedImages}
                      disabled={isUploadingToCloud || queuedImages.length === 0}
                      className="flex-1 px-5 py-2.5 rounded-[10px] text-xs font-bold text-black bg-white hover:bg-white/90 active:scale-[0.99] disabled:opacity-40 transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
                    >
                      {isUploadingToCloud ? (
                        <>
                          <IconSpinner className="w-4 h-4 animate-spin" />
                          <span>{uploadStatusText || 'Saving to Cloud...'}</span>
                        </>
                      ) : (
                        <>
                          <IconCheck className="w-4 h-4" />
                          <span>
                            Upload {queuedImages.length} {queuedImages.length === 1 ? unitWord : `${unitWord}s`} to Cloud
                          </span>
                        </>
                      )}
                    </button>
                  )}

                  {activeTab === 'youtube' && (
                    <button
                      type="button"
                      onClick={() => handleSaveBatchItems(youtubeItems)}
                      disabled={isUploadingToCloud || selectedYoutubeCount === 0}
                      className="flex-1 px-5 py-2.5 rounded-[10px] text-xs font-bold text-black bg-white hover:bg-white/90 active:scale-[0.99] disabled:opacity-40 transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
                    >
                      {isUploadingToCloud ? (
                        <>
                          <IconSpinner className="w-4 h-4 animate-spin" />
                          <span>{uploadStatusText || 'Saving...'}</span>
                        </>
                      ) : (
                        <>
                          <IconCheck className="w-4 h-4" />
                          <span>
                            Import {selectedYoutubeCount} {selectedYoutubeCount === 1 ? 'Thumbnail' : 'Thumbnails'}
                          </span>
                        </>
                      )}
                    </button>
                  )}

                  {activeTab === 'pinterest' && (
                    <button
                      type="button"
                      onClick={() => handleSaveBatchItems(pinterestItems)}
                      disabled={isUploadingToCloud || selectedPinterestCount === 0}
                      className="flex-1 px-5 py-2.5 rounded-[10px] text-xs font-bold text-black bg-white hover:bg-white/90 active:scale-[0.99] disabled:opacity-40 transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
                    >
                      {isUploadingToCloud ? (
                        <>
                          <IconSpinner className="w-4 h-4 animate-spin" />
                          <span>{uploadStatusText || 'Saving...'}</span>
                        </>
                      ) : (
                        <>
                          <IconCheck className="w-4 h-4" />
                          <span>
                            Import {selectedPinterestCount} {selectedPinterestCount === 1 ? 'Pin' : 'Pins'}
                          </span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </aside>
          </div>
        )}
      </div>
    </div>

    {/* Cloudflare Storage Setup Modal */}
    <CloudflareStorageModal
      isOpen={isR2ModalOpen}
      onClose={() => {
        setIsR2ModalOpen(false);
        checkR2Status();
      }}
      onConnected={checkR2Status}
    />
  </>
  );
};
