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
import { ThumbnailItem, NicheCategory } from '../lib/types';
import { convertToJpg, getYoutubeJpgUrl } from '../lib/imageOptimizer';
import {
  getAllCategories,
  addCustomCategory,
  subscribeCategories
} from '../lib/categories';
import { extractDedupeKeys } from '../lib/storage';

interface AddModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddThumbnail: (item: ThumbnailItem) => void;
  onAddMultipleThumbnails?: (items: ThumbnailItem[]) => void;
  initialMediaKind?: 'thumbnail' | 'poster';
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
}

const UnifiedCategoryBar: React.FC<UnifiedCategoryBarProps> = ({
  label = 'Select categories for all items',
  itemCount,
  categories,
  selectedCategories,
  onToggleCategory,
  onCategoryCreated,
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
    <div className="p-3 bg-surface-raised border border-line rounded-xl space-y-2">
      <div className="flex items-center justify-between text-xs flex-wrap gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-semibold text-ink text-[11px]">
            {label} ({itemCount} {itemCount === 1 ? 'item' : 'items'}):
          </span>
          {selectedCategories.map(cat => (
            <span
              key={cat}
              className="px-2 py-0.5 rounded text-[11px] font-bold text-accent-on bg-accent shadow-xs inline-flex items-center gap-1"
            >
              <span>{cat}</span>
              <button
                type="button"
                onClick={() => onToggleCategory(cat)}
                className="hover:opacity-80 text-accent-on hover:text-accent-on cursor-pointer leading-none text-xs"
                title={`Remove ${cat} from all`}
              >
                ×
              </button>
            </span>
          ))}
          {selectedCategories.length === 0 && (
            <span className="text-[11px] text-ink-faint italic">None selected (click a category below to apply)</span>
          )}
        </div>

        {!isAdding && (
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            className="text-[11px] font-semibold text-ink hover:opacity-80 flex items-center gap-1 cursor-pointer transition-colors"
          >
            <IconPlus className="w-3 h-3" />
            <span>+ New Category</span>
          </button>
        )}
      </div>

      {/* Inline Add New Category Box */}
      {isAdding && (
        <form onSubmit={handleAdd} className="flex items-center gap-2 p-2 bg-surface border border-line rounded-lg">
          <input
            type="text"
            value={newCatInput}
            onChange={(e) => setNewCatInput(e.target.value)}
            placeholder="Category name (e.g. Finance, Anime)..."
            className="flex-1 bg-transparent text-xs text-ink placeholder:text-ink-faint focus:outline-none"
            autoFocus
          />
          <button
            type="submit"
            disabled={!newCatInput.trim()}
            className="px-2.5 py-1 rounded bg-accent hover:opacity-90 disabled:opacity-40 text-accent-on font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-colors"
          >
            <IconCheck className="w-3 h-3" />
            <span>Add to Filters</span>
          </button>
          <button
            type="button"
            onClick={() => { setIsAdding(false); setNewCatInput(''); }}
            className="p-1 text-ink-faint hover:text-ink cursor-pointer"
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
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                isSelected
                  ? 'bg-accent text-accent-on font-bold shadow-xs'
                  : 'bg-surface hover:bg-surface-raised text-ink border border-line'
              }`}
            >
              <span>{isSelected ? '✓ ' : '+ '}</span>
              <span>{cat}</span>
            </button>
          );
        })}
      </div>
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
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-accent text-accent-on shadow-2xs"
        >
          <span>{cat}</span>
          <button
            type="button"
            onClick={(e) => handleRemove(e, cat)}
            className="text-accent-on hover:text-accent-on cursor-pointer leading-none text-xs ml-0.5"
            title={`Remove ${cat}`}
          >
            ×
          </button>
        </span>
      ))}
      {selectedCategories.length === 0 && (
        <span className="text-[11px] text-ink-faint italic mr-1">None</span>
      )}

      {/* Button to open multi-select popover */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="px-2 py-0.5 rounded text-[11px] font-semibold bg-surface hover:bg-surface-raised text-ink hover:text-ink border border-line flex items-center gap-1 cursor-pointer transition-colors"
      >
        <IconPlus className="w-3 h-3" />
        <span>Category</span>
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div className="absolute left-0 top-full mt-1.5 z-50 w-64 bg-surface-raised border border-line rounded-xl shadow-2xl p-2.5 space-y-2">
          <div className="flex items-center justify-between pb-1.5 border-b border-line text-xs">
            <span className="font-bold text-ink text-[11px]">Select Categories</span>
            <button
              type="button"
              onClick={() => setIsAddingNew(!isAddingNew)}
              className="text-[11px] font-semibold text-ink hover:underline cursor-pointer"
            >
              {isAddingNew ? 'Cancel' : '+ New Category'}
            </button>
          </div>

          {isAddingNew && (
            <form onSubmit={handleCreateNew} className="flex items-center gap-1.5 p-1.5 bg-surface border border-line rounded-lg">
              <input
                type="text"
                value={newCatInput}
                onChange={(e) => setNewCatInput(e.target.value)}
                placeholder="Category name..."
                className="flex-1 bg-transparent text-xs text-ink placeholder:text-ink-faint focus:outline-none"
                autoFocus
              />
              <button
                type="submit"
                disabled={!newCatInput.trim()}
                className="px-2 py-0.5 rounded text-[10px] font-bold bg-accent text-accent-on disabled:opacity-40 cursor-pointer"
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
              className="w-full px-2 py-1 bg-surface border border-line rounded-lg text-xs text-ink placeholder:text-ink-faint focus:outline-none focus:border-line-strong"
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
                  className={`w-full flex items-center justify-between px-2 py-1 rounded-md text-xs font-medium cursor-pointer transition-colors text-left ${
                    isSelected
                      ? 'bg-surface text-ink font-semibold'
                      : 'hover:bg-surface-raised text-ink'
                  }`}
                >
                  <span>{cat}</span>
                  {isSelected && (
                    <span
                      className="w-3.5 h-3.5 rounded flex items-center justify-center bg-accent text-accent-on text-[10px]"
                    >
                      ✓
                    </span>
                  )}
                </button>
              );
            })}
            {filtered.length === 0 && (
              <div className="text-center py-2 text-[11px] text-ink-faint">
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
  initialMediaKind = 'thumbnail'
}) => {
  const [activeTab, setActiveTab] = useState<AddTabMode>('upload');
  // What is being added. Posters skip the YouTube tab and land in the
  // posters wall with kind: 'poster' instead of the thumbnails gallery.
  const [mediaKind, setMediaKind] = useState<AddMediaKind>(initialMediaKind);
  // Human word for the media being added, used across button and fallback copy.
  const unitWord = mediaKind === 'poster' ? 'Poster' : 'Thumbnail';
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

  // --- Uploading to Cloud (Supabase) State ---
  const [isUploadingToCloud, setIsUploadingToCloud] = useState(false);
  const [uploadStatusText, setUploadStatusText] = useState('');
  // Set when the bucket/DB sync failed: items on screen are local-only and
  // will not survive a refresh. Shown as a banner above the save buttons.
  const [cloudError, setCloudError] = useState('');

  // Subscribe to category updates
  useEffect(() => {
    const update = () => {
      setAvailableCategories(getAllCategories());
    };
    update();
    return subscribeCategories(update);
  }, []);

  // Reset modal state on open/close
  useEffect(() => {
    if (isOpen) {
      setMediaKind(initialMediaKind);
      if (initialMediaKind === 'poster' && activeTab === 'youtube') {
        setActiveTab('upload');
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
      setMediaKind(initialMediaKind);
      setActiveTab('upload');
      setIsUploadingToCloud(false);
      setUploadStatusText('');
      setCloudError('');
    }
  }, [isOpen, initialMediaKind, activeTab]);

  // Process a File or Blob into a QueuedImageItem
  const processImageFile = useCallback(async (file: File | Blob, customName?: string): Promise<QueuedImageItem | null> => {
    try {
      const isPoster = mediaKind === 'poster';
      // Portraits keep a black matte; thumbnails keep the brand matte.
      const jpgDataUrl = await convertToJpg(file, 0.9, 1920, isPoster ? '#000000' : '#401D1A');
      const rawName = (file instanceof File && file.name) ? file.name : (customName || `${unitWord} ${Date.now().toString().slice(-4)}`);
      const cleanTitle = rawName.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ').trim();
      const chosenCategories = [...uploadCategories];

      const prefix = isPoster ? 'poster' : 'img';
      return {
        id: `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
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
    if (text && (text.startsWith('http://') || text.startsWith('https://') || text.startsWith('data:image/'))) {
      if (text.match(/\.(jpeg|jpg|png|webp|gif)/i) || text.includes('i.pinimg.com') || text.includes('ytimg.com')) {
        e.preventDefault();
        setIsProcessingFiles(true);
        try {
          const res = await fetch(text);
          const blob = await res.blob();
          const processed = await processImageFile(blob, `Pasted ${unitWord} ${queuedImages.length + 1}`);
          if (processed) {
            setQueuedImages(prev => [...prev, processed]);
          }
        } catch {
          // fallback dataUrl
          const chosenCategories = [...uploadCategories];
          const isPoster = mediaKind === 'poster';
          setQueuedImages(prev => [
            ...prev,
            {
              id: `${isPoster ? 'poster' : 'img'}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              dataUrl: text,
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
          if (text) {
            if (text.startsWith('http://') || text.startsWith('https://') || text.startsWith('data:image/')) {
              try {
                const res = await fetch(text);
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

  // Upload Queued Images to Supabase and Save
  const handleUploadQueuedImages = async () => {
    if (queuedImages.length === 0) return;
    setIsUploadingToCloud(true);
    setCloudError('');
    const isPoster = mediaKind === 'poster';
    setUploadStatusText(`Uploading ${queuedImages.length} ${isPoster ? 'posters' : 'thumbnails'} to Supabase...`);

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
      const res = await fetch('/api/supabase/upload-thumbnail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: payload })
      });

      if (res.ok) {
        const data = await res.json();
        const uploadedMap = new Map<string, string>();
        const smallMap = new Map<string, string | undefined>();
        const dimsMap = new Map<string, { width?: number; height?: number }>();
        const colorMap = new Map<string, string[]>();
        let allDbSaved = true;
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
            if (item.dbSaved === false) allDbSaved = false;
          });
        }
        if (data.allDbSaved === false) allDbSaved = false;
        cloudOk = allDbSaved;

        finalItems = queuedImages.map((img, idx) => {
          const itemCategories = img.tags || [];
          const payloadItem = payload[idx];
          const assignedId = data.items?.[idx]?.id || payloadItem?.id || img.id;
          const supaUrl = uploadedMap.get(img.id) || uploadedMap.get(payloadItem?.id) || uploadedMap.get(assignedId) || img.dataUrl;
          const smallUrl = smallMap.get(img.id) || smallMap.get(payloadItem?.id) || smallMap.get(assignedId);
          const dims = dimsMap.get(img.id) || dimsMap.get(payloadItem?.id) || dimsMap.get(assignedId);

          return {
            id: assignedId,
            kind: mediaKind,
            title: img.title || `Curated ${unitWord}`,
            creator: img.creator || (isPoster ? 'Cinema' : 'Creator'),
            imageUrl: supaUrl,
            thumbSmallUrl: smallUrl,
            sourceUrl: supaUrl,
            niche: (itemCategories[0] || (isPoster ? 'Cinema' : '')) as NicheCategory,
            styles: ['Face Close-up', 'High-Contrast Glow'],
            tags: itemCategories.length > 0 ? itemCategories : (isPoster ? ['Movie Poster', 'Cinema'] : []),
            colors: colorMap.get(img.id) ?? colorMap.get(assignedId) ?? [],
            width: dims?.width,
            height: dims?.height,
            ocrText: '',
            emotion: 'Curious',
            breakdownNotes: isPoster ? 'Uploaded movie poster.' : 'Uploaded thumbnail design.',
            source: 'supabase-storage',
            createdAt: new Date().toISOString(),
            likesCount: Math.floor(Math.random() * 80) + 40
          };
        });
      } else {
        throw new Error('Supabase upload route returned non-ok');
      }
    } catch (err) {
      console.warn('Fallback to local storage upload:', err);
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
          source: 'supabase-storage',
          createdAt: new Date().toISOString(),
          likesCount: Math.floor(Math.random() * 80) + 40
        };
      });
    } finally {
      setIsUploadingToCloud(false);
      setUploadStatusText('');
    }

    if (!cloudOk) {
      setCloudError('Cloud sync failed — these items are local-only and will disappear on refresh. Check your connection and try again.');
    }

    if (finalItems.length > 0) {
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
          const detRes = await fetch('/api/youtube/details', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ videoIds })
          });
          if (detRes.ok) {
            const detData = await detRes.json();
            detailsMap = detData.details || {};
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
        const res = await fetch('/api/youtube/channel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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
          const vId = it.videoId || `${idx}`;
          if (seenVideoIds.has(vId)) return;
          seenVideoIds.add(vId);

          mapped.push({
            id: `yt-ch-${vId}`,
            videoId: it.videoId,
            url: it.sourceUrl || `https://www.youtube.com/watch?v=${it.videoId}`,
            title: it.title || 'YouTube Thumbnail',
            creator: it.creator || data.channel?.name || 'Creator',
            imageUrl: it.imageUrl || getYoutubeJpgUrl(it.videoId),
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
      const res = await fetch('/api/pinterest/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

  // Save extracted batch items (YouTube or Pinterest) to Supabase and library
  const handleSaveBatchItems = async (items: BatchExtractedItem[]) => {
    const selected = items.filter(i => i.selected !== false);
    if (selected.length === 0) return;

    // Deduplicate selected batch items with extractDedupeKeys
    const seenBatchKeys = new Set<string>();
    const uniqueItems: BatchExtractedItem[] = [];
    selected.forEach(it => {
      const keys = extractDedupeKeys(it);
      if (!keys.some(k => seenBatchKeys.has(k))) {
        keys.forEach(k => seenBatchKeys.add(k));
        uniqueItems.push(it);
      }
    });

    setIsUploadingToCloud(true);
    setCloudError('');
    const isPoster = mediaKind === 'poster';
    setUploadStatusText(`Saving ${uniqueItems.length} ${isPoster ? 'posters' : 'thumbnails'} to cloud...`);

    let finalThumbnails: ThumbnailItem[] = uniqueItems.map((item, idx) => {
      const chosenCategories = item.tags || [];
      const assignedId = isPoster
        ? `poster-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 7)}`
        : (item.videoId ? `thumb-yt-${item.videoId}` : (item.id || `thumb-ext-${Date.now()}-${idx}`));
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
        source: 'supabase-storage',
        createdAt: new Date().toISOString(),
        likesCount: Math.floor(Math.random() * 150) + 40
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

      const res = await fetch('/api/supabase/upload-thumbnail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: uploadPayload })
      });

      if (res.ok) {
        const resData = await res.json();
        let allDbSaved = true;
        if (resData.allDbSaved === false) allDbSaved = false;
        if (resData.items && Array.isArray(resData.items)) {
          const map = new Map<string, string>();
          const smallMap = new Map<string, string | undefined>();
          const dimsMap = new Map<string, { width?: number; height?: number }>();
          const colorMap = new Map<string, string[]>();
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
            if (it.dbSaved === false) allDbSaved = false;
          });

          finalThumbnails = finalThumbnails.map((item, idx) => {
            const vId = uniqueItems[idx]?.videoId;
            const origId = uploadPayload[idx]?.id;
            const supaUrl = (vId ? map.get(vId) : null) || map.get(origId) || map.get(item.id) || item.imageUrl;
            const smallUrl = (vId ? smallMap.get(vId) : null) || smallMap.get(origId) || smallMap.get(item.id);
            const dims = (vId ? dimsMap.get(vId) : null) || dimsMap.get(origId) || dimsMap.get(item.id);
            return {
              ...item,
              imageUrl: supaUrl,
              thumbSmallUrl: smallUrl,
              width: dims?.width ?? item.width,
              height: dims?.height ?? item.height,
              colors: (vId ? colorMap.get(vId) : null) ?? colorMap.get(origId) ?? colorMap.get(item.id) ?? [],
              viewsEstimate: uniqueItems[idx]?.views || item.viewsEstimate,
              publishedTime: uniqueItems[idx]?.publishedTime || item.publishedTime
            };
          });
        }
        if (!allDbSaved) {
          setCloudError('Cloud database sync failed — these items are local-only and will disappear on refresh. Check your connection and try again.');
          syncFailed = true;
        }
      } else {
        setCloudError('Cloud sync failed — these items are local-only and will disappear on refresh. Check your connection and try again.');
        syncFailed = true;
      }
    } catch (err) {
      console.warn('Supabase batch upload notice:', err);
      setCloudError('Cloud sync failed — these items are local-only and will disappear on refresh. Check your connection and try again.');
      syncFailed = true;
    } finally {
      setIsUploadingToCloud(false);
      setUploadStatusText('');
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

  return (
    <div
      id="add-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-fade-blur"
    >
      {/* Click outside to close */}
      <div className="fixed inset-0" onClick={onClose} />

      {/* Main Modal Box - Clean Multi-surface */}
      <div
        id="add-modal-content"
        className="relative w-full max-w-2xl bg-surface-raised text-ink rounded-xl shadow-elevated border border-line overflow-hidden z-10 max-h-[92vh] flex flex-col animate-blur-in"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-line bg-surface-raised">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-surface border border-line flex items-center justify-center text-ink">
              <IconPlus className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-bold text-sm text-ink tracking-tight">Add {mediaKind === 'poster' ? 'Posters' : 'Thumbnails'}</h2>
              <p className="text-[11px] text-ink-muted">
                {mediaKind === 'poster'
                  ? 'Import movie posters from files, clipboard or Pinterest'
                  : 'Import from files, clipboard paste, YouTube, or Pinterest'}
              </p>
            </div>
          </div>

          <button
            type="button"
            id="add-modal-close-btn"
            onClick={onClose}
            className="p-2 rounded-xl text-ink-faint hover:text-ink dark:hover:text-ink hover:bg-surface-raised active:scale-95 transition-all cursor-pointer"
            title="Close"
          >
            <IconClose className="w-4 h-4" />
          </button>
        </div>

        {/* What is being added */}
        <div className="px-5 pt-3">
          <div
            className="grid grid-cols-2 gap-1 rounded-xl border border-line bg-surface p-1"
            role="tablist"
            aria-label="What are you adding?"
          >
            {(
              [
                { key: 'thumbnail', label: 'Thumbnails', Icon: IconImage },
                { key: 'poster', label: 'Posters', Icon: IconFilm },
              ] as const
            ).map(({ key, label, Icon }) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={mediaKind === key}
                onClick={() => {
                  setMediaKind(key);
                  if (key === 'poster' && activeTab === 'youtube') setActiveTab('upload');
                }}
                className={`flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-semibold transition-all cursor-pointer ${
                  mediaKind === key
                    ? 'bg-accent text-accent-on shadow-xs'
                    : 'text-ink-muted hover:text-ink'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Minimalist Tab Switcher */}
        <div className="px-5 pt-3 pb-2 border-b border-line bg-surface-raised">
          <div className="flex items-center p-1 bg-surface rounded-xl border border-line text-xs font-semibold gap-1">
            <button
              type="button"
              id="tab-upload-images"
              onClick={() => setActiveTab('upload')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg transition-all cursor-pointer ${
                activeTab === 'upload'
                  ? 'bg-accent text-accent-on shadow-xs font-bold'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              <IconUploadCloud className="w-3.5 h-3.5" />
              <span>Upload / Paste</span>
              {queuedImages.length > 0 && (
                <span className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  activeTab === 'upload'
                    ? 'bg-accent-on text-accent'
                    : 'bg-accent text-accent-on'
                }`}>
                  {queuedImages.length}
                </span>
              )}
            </button>

            {/* YouTube has no posters, so this source only applies to thumbnails */}
            {mediaKind === 'thumbnail' && (
            <button
              type="button"
              id="tab-youtube-import"
              onClick={() => setActiveTab('youtube')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg transition-all cursor-pointer ${
                activeTab === 'youtube'
                  ? 'bg-accent text-accent-on shadow-xs font-bold'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              <IconYoutube className="w-3.5 h-3.5" />
              <span>YouTube</span>
            </button>
            )}

            <button
              type="button"
              id="tab-pinterest-import"
              onClick={() => setActiveTab('pinterest')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg transition-all cursor-pointer ${
                activeTab === 'pinterest'
                  ? 'bg-accent text-accent-on shadow-xs font-bold'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              <IconPinterest className="w-3.5 h-3.5" />
              <span>Pinterest</span>
            </button>
          </div>
        </div>

        {/* Modal Body - Scrollable */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 custom-scrollbar">

          {/* ========================================================= */}
          {/* TAB 1: UPLOAD / PASTE SECTION (Single, Bulk & Clipboard) */}
          {/* ========================================================= */}
          {activeTab === 'upload' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              
              {/* Action Buttons: 1-Click Paste & Bulk Select */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  id="paste-image-from-clipboard-btn"
                  onClick={handlePasteButtonClick}
                  disabled={isProcessingFiles}
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-surface-raised hover:bg-surface border border-line hover:border-line-strong text-ink font-semibold text-xs active:scale-[0.98] transition-all cursor-pointer shadow-sm group"
                >
                  <div className="w-6 h-6 rounded-lg bg-surface text-ink-muted group-hover:bg-accent group-hover:text-accent-on flex items-center justify-center transition-colors">
                    <IconClipboardPaste className="w-3.5 h-3.5" />
                  </div>
                  <div className="text-left">
                    <div className="font-bold text-xs text-ink">Paste Thumbnail Image</div>
                    <div className="text-[10px] text-ink-faint font-normal">Click to paste or press Ctrl + V</div>
                  </div>
                </button>

                <button
                  type="button"
                  id="browse-bulk-images-btn"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isProcessingFiles}
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-surface-raised hover:bg-surface border border-line hover:border-line-strong text-ink font-semibold text-xs active:scale-[0.98] transition-all cursor-pointer shadow-sm group"
                >
                  <div className="w-6 h-6 rounded-lg bg-surface text-ink-muted group-hover:bg-accent group-hover:text-accent-on flex items-center justify-center transition-colors">
                    <IconUploadCloud className="w-3.5 h-3.5" />
                  </div>
                  <div className="text-left">
                    <div className="font-bold text-xs text-ink">Browse Images (Bulk)</div>
                    <div className="text-[10px] text-ink-faint font-normal">Select multiple files at once</div>
                  </div>
                </button>
              </div>

              {/* Paste Notice Toast if any */}
              {pasteNotice && (
                <div
                  className={`p-2.5 rounded-xl text-xs flex items-center justify-between gap-2 animate-in fade-in slide-in-from-top-1 duration-150 ${
                    pasteNotice.isError
                      ? 'bg-danger-soft border border-danger-line text-danger'
                      : 'bg-surface border border-line text-ink'
                  }`}
                >
                  <span>{pasteNotice.text}</span>
                  <button
                    type="button"
                    onClick={() => setPasteNotice(null)}
                    className="text-ink-faint hover:text-ink dark:hover:text-ink text-sm leading-none"
                  >
                    &times;
                  </button>
                </div>
              )}

              {/* Dropzone & Drag Area */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative flex flex-col items-center justify-center p-6 sm:p-7 rounded-2xl border-2 border-dashed transition-all cursor-pointer text-center group select-none ${
                  dragOver
                    ? 'border-line-strong bg-surface scale-[0.99]'
                    : 'border-line bg-surface hover:bg-surface-raised hover:border-line-strong dark:bg-surface dark:hover:bg-surface-raised'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={(e) => {
                    if (e.target.files) handleMultipleFiles(e.target.files);
                  }}
                  className="hidden"
                />

                <div className="w-10 h-10 rounded-xl bg-surface-raised border border-line text-ink flex items-center justify-center mb-2.5 group-hover:scale-105 transition-all shadow-sm">
                  {isProcessingFiles ? (
                    <IconSpinner className="w-5 h-5 animate-spin text-ink" />
                  ) : (
                    <IconImage className="w-5 h-5" />
                  )}
                </div>

                <div className="space-y-1">
                  <p className="text-xs font-bold text-ink">
                    {isProcessingFiles
                      ? 'Processing and formatting images...'
                      : 'Or drop image files here directly'}
                  </p>
                  <p className="text-[11px] text-ink-muted">
                    {mediaKind === 'poster'
                      ? 'Keeps the original portrait ratio, compressed for fast loading'
                      : 'Auto-converts PNG / JPG / WebP into standard 16:9 thumbnail format'}
                  </p>
                </div>
              </div>

              {/* Queued Images List */}
              {queuedImages.length > 0 && (
                <div className="space-y-3 pt-2">
                  {/* Queue Header with Quick Batch Actions */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-surface border border-line rounded-xl text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-ink">
                        {queuedImages.length} {queuedImages.length === 1 ? 'image' : 'images'} ready
                      </span>
                      <span className="text-[11px] text-ink-faint">•</span>
                      <span className="text-[11px] text-ink-muted">You can still paste more or click browse</span>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-2.5 py-1 rounded-lg bg-surface-raised hover:bg-surface-raised text-ink border border-line text-[11px] font-semibold flex items-center gap-1 transition-all cursor-pointer"
                      >
                        <IconPlus className="w-3 h-3" />
                        <span>Add more</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setQueuedImages([])}
                        className="px-2 py-1 rounded-lg text-ink-faint hover:text-ink dark:hover:text-ink text-[11px] transition-colors cursor-pointer"
                      >
                        Clear all
                      </button>
                    </div>
                  </div>

                  {/* Single Unified Category Bar for Queued Images */}
                  <UnifiedCategoryBar
                    label="Select category for all images"
                    itemCount={queuedImages.length}
                    categories={availableCategories}
                    selectedCategories={uploadCategories}
                    onToggleCategory={handleToggleUploadCategory}
                    onCategoryCreated={handleCategoryCreated}
                  />

                  {/* Queued Cards Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-72 overflow-y-auto pr-1 custom-scrollbar">
                    {queuedImages.map((img, index) => (
                      <div
                        key={img.id}
                        className="p-3 bg-surface-raised border border-line rounded-xl flex items-start gap-3 relative group hover:border-line-strong transition-all"
                      >
                        {/* Aspect 16:9 Preview */}
                        <div className="w-24 sm:w-28 aspect-video rounded-lg overflow-hidden bg-stage shrink-0 relative border border-line">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={img.dataUrl}
                            alt={img.title}
                            className="w-full h-full object-cover"
                          />
                        </div>

                        {/* Title & Category */}
                        <div className="flex-1 min-w-0 space-y-2">
                          <input
                            type="text"
                            value={img.title}
                            onChange={(e) => {
                              const val = e.target.value;
                              setQueuedImages(prev => prev.map((p, i) => i === index ? { ...p, title: val } : p));
                            }}
                            placeholder="Thumbnail Title"
                            className="w-full px-2 py-1 bg-surface border border-line rounded-md text-xs text-ink placeholder:text-ink-faint focus:outline-none focus:border-line-strong"
                          />

                          <div className="space-y-1">
                            <span className="text-[11px] text-ink-muted font-medium">Categories:</span>
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

                        {/* Remove item button */}
                        <button
                          type="button"
                          onClick={() => setQueuedImages(prev => prev.filter((_, i) => i !== index))}
                          className="p-1 text-ink-faint hover:text-ink dark:hover:text-ink rounded-md transition-colors cursor-pointer"
                          title="Remove image"
                        >
                          <IconTrash className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Bottom Action for Queued Images */}
                  {cloudError && (
                    <div className="p-3 bg-danger-soft border border-danger-line text-danger rounded-xl text-xs">
                      {cloudError}
                    </div>
                  )}
                  <div className="pt-3 border-t border-line flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setQueuedImages([])}
                      disabled={isUploadingToCloud}
                      className="px-3.5 py-2 rounded-xl text-xs font-semibold text-ink-faint hover:text-ink dark:hover:text-ink transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>

                    <button
                      type="button"
                      id="save-all-queued-images-btn"
                      onClick={handleUploadQueuedImages}
                      disabled={isUploadingToCloud || queuedImages.length === 0}
                      className="px-5 py-2.5 rounded-xl text-xs font-bold text-accent-on bg-accent hover:opacity-90 active:scale-[0.97] disabled:opacity-50 transition-all shadow-md flex items-center gap-2 cursor-pointer"
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
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 2: YOUTUBE IMPORT (Single / Multiple Links / Channel) */}
          {/* ========================================================= */}
          {activeTab === 'youtube' && mediaKind === 'thumbnail' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-ink flex items-center gap-1.5">
                  <IconYoutube className="w-4 h-4" />
                  <span>Paste YouTube Video Links or Channel Handle</span>
                </label>

                <textarea
                  rows={3}
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
                  placeholder="Paste one or multiple YouTube URLs (one per line) or channel @handle (e.g. @MrBeast)..."
                  className="w-full px-3 py-2.5 bg-surface-raised border border-line rounded-xl text-xs text-ink placeholder:text-ink-faint focus:outline-none focus:border-line-strong resize-none"
                />

                {/* Channel Limit Selector if channel entered */}
                {isChannelInput(youtubeInput) && (
                  <div className="flex items-center justify-between p-2.5 bg-surface border border-line rounded-xl text-xs">
                    <span className="text-ink-muted font-medium">Channel extract count:</span>
                    <div className="flex items-center gap-1.5">
                      {[30, 50, 100].map(limit => (
                        <button
                          key={limit}
                          type="button"
                          onClick={() => setYoutubeChannelLimit(limit)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                            youtubeChannelLimit === limit
                              ? 'bg-accent text-accent-on shadow-xs'
                              : 'bg-surface-raised text-ink-muted hover:text-ink border border-line'
                          }`}
                        >
                          {limit} videos
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between pt-1">
                  <p className="text-[11px] text-ink-muted">
                    Supports bulk extraction of thumbnails in maximum resolution
                  </p>

                  <button
                    type="button"
                    onClick={handleExtractYoutube}
                    disabled={isYoutubeLoading || !youtubeInput.trim()}
                    className="px-4 py-2 rounded-xl bg-accent text-accent-on hover:opacity-90 disabled:opacity-50 font-bold text-xs flex items-center gap-2 shadow-xs transition-all active:scale-95 cursor-pointer"
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

                {youtubeError && (
                  <div className="p-3 bg-danger-soft border border-danger-line text-danger rounded-xl text-xs">
                    {youtubeError}
                  </div>
                )}
              </div>

              {/* YouTube Extracted Result List */}
              {youtubeItems.length > 0 && (
                <div className="space-y-3 pt-2 border-t border-line">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-ink">
                      Found {youtubeItems.length} thumbnails
                    </span>

                    <button
                      type="button"
                      onClick={() => {
                        const allSelected = youtubeItems.every(i => i.selected !== false);
                        setYoutubeItems(prev => prev.map(p => ({ ...p, selected: !allSelected })));
                      }}
                      className="px-2.5 py-1 bg-surface-raised hover:bg-surface-raised border border-line rounded-lg text-[11px] font-semibold text-ink cursor-pointer"
                    >
                      {youtubeItems.every(i => i.selected !== false) ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>

                  {/* Single Unified Category Bar for YouTube */}
                  <UnifiedCategoryBar
                    label="Select category for all thumbnails"
                    itemCount={youtubeItems.length}
                    categories={availableCategories}
                    selectedCategories={youtubeCategories}
                    onToggleCategory={handleToggleYoutubeCategory}
                    onCategoryCreated={handleCategoryCreated}
                  />

                  {/* YouTube Cards List */}
                  <div className="max-h-72 overflow-y-auto space-y-2.5 pr-1 custom-scrollbar">
                    {youtubeItems.map((item, index) => (
                      <div
                        key={item.id}
                        className={`p-3 rounded-xl border transition-all ${
                          item.selected !== false
                            ? 'bg-surface-raised border-line'
                            : 'bg-surface border-line opacity-50'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <button
                            type="button"
                            onClick={() => {
                              setYoutubeItems(prev => prev.map((p, i) => i === index ? { ...p, selected: !p.selected } : p));
                            }}
                            className={`w-4 h-4 mt-1 rounded flex items-center justify-center shrink-0 border cursor-pointer ${
                              item.selected !== false
                                ? 'bg-accent border-accent text-accent-on'
                                : 'border-line bg-surface-raised'
                            }`}
                          >
                            {item.selected !== false && <IconCheck className="w-3 h-3" />}
                          </button>

                          <div className="w-24 sm:w-28 aspect-video rounded-lg overflow-hidden bg-stage shrink-0 relative border border-line">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover" />
                          </div>

                          <div className="flex-1 min-w-0 space-y-2">
                            <input
                              type="text"
                              value={item.title}
                              onChange={(e) => {
                                const val = e.target.value;
                                setYoutubeItems(prev => prev.map((p, i) => i === index ? { ...p, title: val } : p));
                              }}
                              placeholder="Thumbnail Title"
                              className="w-full px-2 py-1 bg-surface border border-line rounded-md text-xs text-ink placeholder:text-ink-faint focus:outline-none focus:border-line-strong"
                            />

                              <div className="space-y-1">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-[11px] text-ink-muted font-medium">Categories:</span>
                                  <span
                                    className="text-[10px] text-ink-faint truncate max-w-[220px]"
                                    title={`${item.creator}${item.views ? ` • ${item.views}` : ''}${item.publishedTime ? ` • ${item.publishedTime}` : ''}`}
                                  >
                                    • {item.creator}{item.views ? ` • ${item.views}` : ''}{item.publishedTime ? ` • ${item.publishedTime}` : ''}
                                  </span>
                                </div>
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

                          <button
                            type="button"
                            onClick={() => setYoutubeItems(prev => prev.filter((_, i) => i !== index))}
                            className="p-1 text-ink-faint hover:text-ink dark:hover:text-ink transition-colors cursor-pointer"
                            title="Remove"
                          >
                            <IconTrash className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {cloudError && (
                    <div className="p-3 bg-danger-soft border border-danger-line text-danger rounded-xl text-xs">
                      {cloudError}
                    </div>
                  )}
                  <div className="pt-2 border-t border-line flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setYoutubeItems([])}
                      className="px-3.5 py-2 text-xs text-ink-faint hover:text-ink dark:hover:text-ink"
                    >
                      Clear
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSaveBatchItems(youtubeItems)}
                      disabled={isUploadingToCloud || youtubeItems.filter(i => i.selected !== false).length === 0}
                      className="px-4 py-2 rounded-xl text-xs font-bold text-accent-on bg-accent hover:opacity-90 disabled:opacity-50 transition-all flex items-center gap-2 cursor-pointer shadow-md"
                    >
                      {isUploadingToCloud ? (
                        <>
                          <IconSpinner className="w-4 h-4 animate-spin" />
                          <span>Saving...</span>
                        </>
                      ) : (
                        <>
                          <IconCheck className="w-4 h-4" />
                          <span>
                            Import {youtubeItems.filter(i => i.selected !== false).length} Thumbnails
                          </span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 3: PINTEREST IMPORT (Just link & multiple links at once) */}
          {/* ========================================================= */}
          {activeTab === 'pinterest' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-ink flex items-center gap-1.5">
                  <IconPinterest className="w-4 h-4" />
                  <span>Paste Pinterest Pin Links or Board URL</span>
                </label>

                <textarea
                  rows={3}
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
                  placeholder="Paste Pinterest links (e.g. https://pin.it/4k6G4P6 or https://www.pinterest.com/pin/515873332295753837/)..."
                  className="w-full px-3 py-2.5 bg-surface-raised border border-line rounded-xl text-xs text-ink placeholder:text-ink-faint focus:outline-none focus:border-line-strong resize-none"
                />

                <div className="flex items-center justify-between pt-1">
                  <p className="text-[11px] text-ink-muted">
                    Paste one or multiple Pinterest links to extract high-definition images
                  </p>

                  <button
                    type="button"
                    onClick={handleExtractPinterest}
                    disabled={isPinterestLoading || !pinterestInput.trim()}
                    className="px-4 py-2 rounded-xl bg-accent text-accent-on hover:opacity-90 disabled:opacity-50 font-bold text-xs flex items-center gap-2 shadow-xs transition-all active:scale-95 cursor-pointer"
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

                {pinterestError && (
                  <div className="p-3 bg-danger-soft border border-danger-line text-danger rounded-xl text-xs">
                    {pinterestError}
                  </div>
                )}
              </div>

              {/* Pinterest Extracted Result List */}
              {pinterestItems.length > 0 && (
                <div className="space-y-3 pt-2 border-t border-line">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-ink">
                      Found {pinterestItems.length} Pinterest pins
                    </span>

                    <button
                      type="button"
                      onClick={() => {
                        const allSelected = pinterestItems.every(i => i.selected !== false);
                        setPinterestItems(prev => prev.map(p => ({ ...p, selected: !allSelected })));
                      }}
                      className="px-2.5 py-1 bg-surface-raised hover:bg-surface-raised border border-line rounded-lg text-[11px] font-semibold text-ink cursor-pointer"
                    >
                      {pinterestItems.every(i => i.selected !== false) ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>

                  {/* Single Unified Category Bar for Pinterest */}
                  <UnifiedCategoryBar
                    label="Select category for all pins"
                    itemCount={pinterestItems.length}
                    categories={availableCategories}
                    selectedCategories={pinterestCategories}
                    onToggleCategory={handleTogglePinterestCategory}
                    onCategoryCreated={handleCategoryCreated}
                  />

                  {/* Pinterest Cards List */}
                  <div className="max-h-72 overflow-y-auto space-y-2.5 pr-1 custom-scrollbar">
                    {pinterestItems.map((item, index) => (
                      <div
                        key={item.id}
                        className={`p-3 rounded-xl border transition-all ${
                          item.selected !== false
                            ? 'bg-surface-raised border-line'
                            : 'bg-surface border-line opacity-50'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <button
                            type="button"
                            onClick={() => {
                              setPinterestItems(prev => prev.map((p, i) => i === index ? { ...p, selected: !p.selected } : p));
                            }}
                            className={`w-4 h-4 mt-1 rounded flex items-center justify-center shrink-0 border cursor-pointer ${
                              item.selected !== false
                                ? 'bg-accent border-accent text-accent-on'
                                : 'border-line bg-surface-raised'
                            }`}
                          >
                            {item.selected !== false && <IconCheck className="w-3 h-3" />}
                          </button>

                          <div className="w-24 sm:w-28 aspect-video rounded-lg overflow-hidden bg-stage shrink-0 relative border border-line">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover" />
                          </div>

                          <div className="flex-1 min-w-0 space-y-2">
                            <input
                              type="text"
                              value={item.title}
                              onChange={(e) => {
                                const val = e.target.value;
                                setPinterestItems(prev => prev.map((p, i) => i === index ? { ...p, title: val } : p));
                              }}
                              placeholder="Pin Title"
                              className="w-full px-2 py-1 bg-surface border border-line rounded-md text-xs text-ink placeholder:text-ink-faint focus:outline-none focus:border-line-strong"
                            />

                            <div className="space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] text-ink-muted font-medium">Categories:</span>
                                <span className="text-[10px] text-ink-faint truncate max-w-[140px]">
                                  • {item.creator}
                                </span>
                              </div>
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

                          <button
                            type="button"
                            onClick={() => setPinterestItems(prev => prev.filter((_, i) => i !== index))}
                            className="p-1 text-ink-faint hover:text-ink dark:hover:text-ink transition-colors cursor-pointer"
                            title="Remove"
                          >
                            <IconTrash className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {cloudError && (
                    <div className="p-3 bg-danger-soft border border-danger-line text-danger rounded-xl text-xs">
                      {cloudError}
                    </div>
                  )}
                  <div className="pt-2 border-t border-line flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setPinterestItems([])}
                      className="px-3.5 py-2 text-xs text-ink-faint hover:text-ink dark:hover:text-ink"
                    >
                      Clear
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSaveBatchItems(pinterestItems)}
                      disabled={isUploadingToCloud || pinterestItems.filter(i => i.selected !== false).length === 0}
                      className="px-4 py-2 rounded-xl text-xs font-bold text-accent-on bg-accent hover:opacity-90 disabled:opacity-50 transition-all flex items-center gap-2 cursor-pointer shadow-md"
                    >
                      {isUploadingToCloud ? (
                        <>
                          <IconSpinner className="w-4 h-4 animate-spin" />
                          <span>Saving...</span>
                        </>
                      ) : (
                        <>
                          <IconCheck className="w-4 h-4" />
                          <span>
                            Import {pinterestItems.filter(i => i.selected !== false).length} {mediaKind === 'poster' ? 'Posters' : 'Pins'}
                          </span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
