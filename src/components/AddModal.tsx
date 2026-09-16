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
  IconImage
} from './icons/AppIcons';
import { ThumbnailItem, NicheCategory } from '../lib/types';
import { convertToJpg, getYoutubeJpgUrl } from '../lib/imageOptimizer';
import {
  getAllCategories,
  addCustomCategory,
  subscribeCategories
} from '../lib/categories';

interface AddModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddThumbnail: (item: ThumbnailItem) => void;
  onAddMultipleThumbnails?: (items: ThumbnailItem[]) => void;
}

type AddTabMode = 'upload' | 'youtube' | 'pinterest';

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
  selected?: boolean;
}

function extractYoutubeVideoIds(text: string): { id: string; originalUrl: string }[] {
  if (!text || !text.trim()) return [];
  const regex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/g;
  const matches: { id: string; originalUrl: string }[] = [];
  const seenIds = new Set<string>();

  let match;
  while ((match = regex.exec(text)) !== null) {
    const videoId = match[1];
    if (videoId && !seenIds.has(videoId)) {
      seenIds.add(videoId);
      matches.push({
        id: videoId,
        originalUrl: match[0].startsWith('http') ? match[0] : `https://${match[0]}`
      });
    }
  }

  if (matches.length === 0) {
    const lines = text.split(/[\n,]+/).map(l => l.trim()).filter(Boolean);
    for (const line of lines) {
      const lineMatch = line.match(/(?:v=|\/embed\/|\/shorts\/|youtu\.be\/|^)([a-zA-Z0-9_-]{11})/);
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

function isChannelInput(text: string): boolean {
  const trimmed = text.trim();
  return (
    trimmed.startsWith('@') ||
    trimmed.includes('youtube.com/@') ||
    trimmed.includes('youtube.com/channel/') ||
    trimmed.includes('youtube.com/c/') ||
    trimmed.includes('youtube.com/user/')
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

export const AddModal: React.FC<AddModalProps> = ({
  isOpen,
  onClose,
  onAddThumbnail,
  onAddMultipleThumbnails
}) => {
  const [activeTab, setActiveTab] = useState<AddTabMode>('upload');
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);

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
    if (!isOpen) {
      setQueuedImages([]);
      setYoutubeInput('');
      setYoutubeItems([]);
      setYoutubeError('');
      setPinterestInput('');
      setPinterestItems([]);
      setPinterestError('');
      setIsUploadingToCloud(false);
      setUploadStatusText('');
    }
  }, [isOpen]);

  // Process a File or Blob into a QueuedImageItem
  const processImageFile = useCallback(async (file: File | Blob, customName?: string): Promise<QueuedImageItem | null> => {
    try {
      const jpgDataUrl = await convertToJpg(file, 0.9);
      const rawName = (file instanceof File && file.name) ? file.name : (customName || `Thumbnail ${Date.now().toString().slice(-4)}`);
      const cleanTitle = rawName.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ').trim();
      const meta = classifyNicheFromTitle(cleanTitle);

      return {
        id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        dataUrl: jpgDataUrl,
        title: cleanTitle || 'Curated Thumbnail',
        creator: 'You',
        niche: meta.niche,
        tags: meta.tags
      };
    } catch (err) {
      console.warn('Error converting image:', err);
      return null;
    }
  }, []);

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
        const processed = await processImageFile(file, `Pasted Thumbnail ${queuedImages.length + newItems.length + 1}`);
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
          const processed = await processImageFile(blob, `Pasted Image ${queuedImages.length + 1}`);
          if (processed) {
            setQueuedImages(prev => [...prev, processed]);
          }
        } catch {
          // fallback dataUrl
          setQueuedImages(prev => [
            ...prev,
            {
              id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              dataUrl: text,
              title: `Pasted Thumbnail ${prev.length + 1}`,
              creator: 'You',
              niche: 'Tech',
              tags: ['High CTR', 'Design']
            }
          ]);
        } finally {
          setIsProcessingFiles(false);
        }
      }
    }
  }, [isOpen, activeTab, processImageFile, queuedImages.length]);

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

  // Batch apply category to all queued images
  const handleApplyCategoryToAllImages = (cat: NicheCategory) => {
    setQueuedImages(prev => prev.map(img => ({
      ...img,
      niche: cat,
      tags: Array.from(new Set([cat, ...img.tags]))
    })));
  };

  // Upload Queued Images to Supabase and Save
  const handleUploadQueuedImages = async () => {
    if (queuedImages.length === 0) return;
    setIsUploadingToCloud(true);
    setUploadStatusText(`Uploading ${queuedImages.length} thumbnails to Supabase...`);

    let finalItems: ThumbnailItem[] = [];

    try {
      const payload = queuedImages.map(item => ({
        id: item.id,
        imageUrl: item.dataUrl,
        title: item.title || 'Curated Thumbnail',
        creator: item.creator || 'Creator',
        niche: item.niche,
        tags: item.tags
      }));

      const res = await fetch('/api/supabase/upload-thumbnail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: payload })
      });

      if (res.ok) {
        const data = await res.json();
        const uploadedMap = new Map<string, string>();
        if (data.items && Array.isArray(data.items)) {
          data.items.forEach((item: any) => {
            if (item.id && item.imageUrl) {
              uploadedMap.set(item.id, item.imageUrl);
            }
          });
        }

        finalItems = queuedImages.map(img => ({
          id: img.id,
          title: img.title || 'Curated Thumbnail',
          creator: img.creator || 'Creator',
          imageUrl: uploadedMap.get(img.id) || img.dataUrl,
          sourceUrl: uploadedMap.get(img.id) || img.dataUrl,
          niche: img.niche,
          styles: ['Face Close-up', 'High-Contrast Glow'],
          tags: img.tags && img.tags.length > 0 ? img.tags : [img.niche, 'Design'],
          colors: [],
          ocrText: '',
          emotion: 'Curious',
          breakdownNotes: 'Uploaded thumbnail design.',
          source: 'supabase-storage',
          createdAt: new Date().toISOString(),
          likesCount: Math.floor(Math.random() * 80) + 40
        }));
      } else {
        throw new Error('Supabase upload route returned non-ok');
      }
    } catch (err) {
      console.warn('Fallback to local storage upload:', err);
      finalItems = queuedImages.map(img => ({
        id: img.id,
        title: img.title || 'Curated Thumbnail',
        creator: img.creator || 'Creator',
        imageUrl: img.dataUrl,
        sourceUrl: img.dataUrl,
        niche: img.niche,
        styles: ['Face Close-up', 'High-Contrast Glow'],
        tags: img.tags && img.tags.length > 0 ? img.tags : [img.niche, 'Design'],
        colors: [],
        ocrText: '',
        emotion: 'Curious',
        breakdownNotes: 'Uploaded thumbnail design.',
        source: 'supabase-storage',
        createdAt: new Date().toISOString(),
        likesCount: Math.floor(Math.random() * 80) + 40
      }));
    } finally {
      setIsUploadingToCloud(false);
      setUploadStatusText('');
    }

    if (finalItems.length > 0) {
      if (onAddMultipleThumbnails) {
        onAddMultipleThumbnails(finalItems);
      } else {
        finalItems.forEach(item => onAddThumbnail(item));
      }
      onClose();
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
      // 1. Channel extraction
      if (isChannelInput(trimmed)) {
        const res = await fetch('/api/youtube/channel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            channelUrl: trimmed,
            limit: youtubeChannelLimit
          })
        });
        const data = await res.json();
        if (!res.ok || !data.items || data.items.length === 0) {
          throw new Error(data.error || 'No thumbnails found for this channel');
        }
        const mapped: BatchExtractedItem[] = data.items.map((it: any, idx: number) => ({
          id: `yt-ch-${it.videoId || idx}`,
          videoId: it.videoId,
          url: `https://www.youtube.com/watch?v=${it.videoId}`,
          title: it.title || 'YouTube Thumbnail',
          creator: it.creator || data.channel?.name || 'Creator',
          imageUrl: it.imageUrl || getYoutubeJpgUrl(it.videoId),
          niche: it.niche || 'Tech',
          tags: it.tags || ['YouTube', 'CTR'],
          selected: true
        }));
        setYoutubeItems(mapped);
      } else {
        // 2. Video links extraction
        const videoMatches = extractYoutubeVideoIds(trimmed);
        if (videoMatches.length === 0) {
          throw new Error('No valid YouTube video links found in input');
        }

        const items: BatchExtractedItem[] = [];
        for (const match of videoMatches) {
          const imgUrl = getYoutubeJpgUrl(match.id);
          let title = 'YouTube Thumbnail';
          let creator = 'YouTube Creator';

          try {
            const oembedRes = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(match.originalUrl)}`);
            if (oembedRes.ok) {
              const odata = await oembedRes.json();
              if (odata.title) title = odata.title;
              if (odata.author_name) creator = odata.author_name;
            }
          } catch {
            // fallback
          }

          const meta = classifyNicheFromTitle(title, creator);
          items.push({
            id: `yt-vid-${match.id}`,
            videoId: match.id,
            url: match.originalUrl,
            title,
            creator,
            imageUrl: imgUrl,
            niche: meta.niche,
            tags: meta.tags,
            selected: true
          });
        }
        setYoutubeItems(items);
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

      const mapped: BatchExtractedItem[] = data.items.map((pin: any) => ({
        id: `pin-${pin.id}`,
        url: pin.url,
        title: pin.title || 'Pinterest Pin',
        creator: pin.creator || 'Pinterest Curator',
        imageUrl: pin.imageUrl,
        niche: (pin.niche as NicheCategory) || 'Tech',
        tags: pin.tags || ['Pinterest', 'Design'],
        selected: true
      }));
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

    setIsUploadingToCloud(true);
    setUploadStatusText(`Saving ${selected.length} thumbnails to cloud...`);

    let finalThumbnails: ThumbnailItem[] = selected.map((item, idx) => ({
      id: `thumb-ext-${Date.now()}-${idx}`,
      title: item.title,
      creator: item.creator,
      imageUrl: item.imageUrl,
      sourceUrl: item.url,
      niche: item.niche,
      styles: ['Face Close-up', 'High-Contrast Glow'],
      tags: item.tags && item.tags.length > 0 ? item.tags : [item.niche, 'Design'],
      colors: [],
      ocrText: '',
      emotion: 'Curious',
      breakdownNotes: 'Auto-extracted inspiration thumbnail.',
      source: 'supabase-storage',
      createdAt: new Date().toISOString(),
      likesCount: Math.floor(Math.random() * 150) + 40
    }));

    try {
      const uploadPayload = selected.map(item => ({
        videoId: item.videoId,
        imageUrl: item.imageUrl,
        title: item.title,
        creator: item.creator,
        niche: item.niche,
        tags: item.tags
      }));

      const res = await fetch('/api/supabase/upload-thumbnail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: uploadPayload })
      });

      if (res.ok) {
        const resData = await res.json();
        if (resData.items && Array.isArray(resData.items)) {
          const map = new Map<string, string>();
          resData.items.forEach((it: any) => {
            if (it.videoId && it.imageUrl) map.set(it.videoId, it.imageUrl);
            if (it.id && it.imageUrl) map.set(it.id, it.imageUrl);
          });

          finalThumbnails = finalThumbnails.map((item, idx) => {
            const vId = selected[idx]?.videoId;
            const supaUrl = (vId ? map.get(vId) : null) || map.get(selected[idx]?.id);
            return {
              ...item,
              imageUrl: supaUrl || item.imageUrl
            };
          });
        }
      }
    } catch (err) {
      console.warn('Supabase batch upload notice:', err);
    } finally {
      setIsUploadingToCloud(false);
      setUploadStatusText('');
    }

    if (onAddMultipleThumbnails) {
      onAddMultipleThumbnails(finalThumbnails);
    } else {
      finalThumbnails.forEach(t => onAddThumbnail(t));
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      id="add-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-fade-blur"
    >
      {/* Click outside to close */}
      <div className="fixed inset-0" onClick={onClose} />

      {/* Main Modal Box - Deep Obsidian Pure Black */}
      <div
        id="add-modal-content"
        className="relative w-full max-w-2xl bg-[#09090b] text-white rounded-[20px] shadow-[0_30px_70px_-15px_rgba(0,0,0,0.95)] border border-zinc-800/80 overflow-hidden z-10 max-h-[92vh] flex flex-col animate-blur-in"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800/80 bg-black/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-[#009FDF]">
              <IconPlus className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-bold text-sm text-white tracking-tight">Add Thumbnails</h2>
              <p className="text-[11px] text-zinc-400">Import from files, clipboard paste, YouTube, or Pinterest</p>
            </div>
          </div>

          <button
            type="button"
            id="add-modal-close-btn"
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800/60 active:scale-95 transition-all cursor-pointer"
            title="Close"
          >
            <IconClose className="w-4 h-4" />
          </button>
        </div>

        {/* Minimalist Tab Switcher */}
        <div className="px-5 pt-3 pb-2 border-b border-zinc-800/60 bg-[#09090b]">
          <div className="flex items-center p-1 bg-zinc-900/90 rounded-xl border border-zinc-800 text-xs font-semibold gap-1">
            <button
              type="button"
              id="tab-upload-images"
              onClick={() => setActiveTab('upload')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg transition-all cursor-pointer ${
                activeTab === 'upload'
                  ? 'bg-zinc-800 text-white shadow-xs font-bold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <IconUploadCloud className="w-3.5 h-3.5 text-[#009FDF]" />
              <span>Upload / Paste</span>
              {queuedImages.length > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-[#009FDF] text-white font-bold">
                  {queuedImages.length}
                </span>
              )}
            </button>

            <button
              type="button"
              id="tab-youtube-import"
              onClick={() => setActiveTab('youtube')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg transition-all cursor-pointer ${
                activeTab === 'youtube'
                  ? 'bg-zinc-800 text-white shadow-xs font-bold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <IconYoutube className="w-3.5 h-3.5 text-red-500" />
              <span>YouTube</span>
            </button>

            <button
              type="button"
              id="tab-pinterest-import"
              onClick={() => setActiveTab('pinterest')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg transition-all cursor-pointer ${
                activeTab === 'pinterest'
                  ? 'bg-zinc-800 text-white shadow-xs font-bold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <IconPinterest className="w-3.5 h-3.5 text-rose-500" />
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
              
              {/* Dropzone & Direct Paste Area */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative flex flex-col items-center justify-center p-6 sm:p-8 rounded-2xl border-2 border-dashed transition-all cursor-pointer text-center group select-none ${
                  dragOver
                    ? 'border-[#009FDF] bg-[#009FDF]/10 scale-[0.99]'
                    : 'border-zinc-800 bg-zinc-950/60 hover:border-zinc-700 hover:bg-zinc-900/40'
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

                <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 text-[#009FDF] flex items-center justify-center mb-3 group-hover:scale-105 group-hover:border-[#009FDF]/40 transition-all shadow-md">
                  {isProcessingFiles ? (
                    <IconSpinner className="w-6 h-6 animate-spin text-[#009FDF]" />
                  ) : (
                    <IconUploadCloud className="w-6 h-6" />
                  )}
                </div>

                <div className="space-y-1">
                  <p className="text-xs sm:text-sm font-bold text-white">
                    {isProcessingFiles
                      ? 'Processing & converting images...'
                      : 'Click to select or drag & drop images'}
                  </p>
                  <p className="text-[11px] text-zinc-400">
                    Supports selecting <span className="text-white font-medium">multiple images</span> at once or pressing{' '}
                    <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-white font-mono text-[10px] font-bold">
                      Ctrl + V
                    </kbd>{' '}
                    to paste from clipboard!
                  </p>
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-900 border border-zinc-800 text-zinc-300">
                    <IconClipboardPaste className="w-3 h-3 text-[#009FDF]" />
                    Paste Supported
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-900 border border-zinc-800 text-zinc-300">
                    <IconImage className="w-3 h-3 text-emerald-400" />
                    Bulk Upload
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-900 border border-zinc-800 text-zinc-300">
                    16:9 Auto-Convert
                  </span>
                </div>
              </div>

              {/* Queued Images List */}
              {queuedImages.length > 0 && (
                <div className="space-y-3 pt-2">
                  {/* Queue Header with Quick Batch Actions */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-zinc-900/70 border border-zinc-800 rounded-xl text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white">
                        {queuedImages.length} {queuedImages.length === 1 ? 'image' : 'images'} ready
                      </span>
                      <span className="text-[11px] text-zinc-500">•</span>
                      <span className="text-[11px] text-zinc-400">You can still paste more or click browse</span>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-[11px] font-semibold flex items-center gap-1 transition-all cursor-pointer"
                      >
                        <IconPlus className="w-3 h-3" />
                        <span>Add more</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setQueuedImages([])}
                        className="px-2 py-1 rounded-lg text-zinc-400 hover:text-red-400 text-[11px] transition-colors cursor-pointer"
                      >
                        Clear all
                      </button>
                    </div>
                  </div>

                  {/* Batch Category Quick Selector */}
                  <div className="flex items-center gap-1.5 flex-wrap p-2.5 bg-zinc-950 border border-zinc-800/80 rounded-xl text-xs">
                    <span className="text-[11px] text-zinc-400 font-medium mr-1 flex items-center gap-1">
                      <IconTag className="w-3 h-3 text-[#009FDF]" />
                      Apply to all:
                    </span>
                    {(availableCategories.length > 0 ? availableCategories : ['Tech', 'Gaming', 'Business', 'IRL', 'Documentary', 'Sports']).slice(0, 7).map(cat => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => handleApplyCategoryToAllImages(cat as NicheCategory)}
                        className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 text-[11px] font-medium transition-all active:scale-95 cursor-pointer"
                      >
                        {cat}
                      </button>
                    ))}
                  </div>

                  {/* Queued Cards Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-72 overflow-y-auto pr-1 custom-scrollbar">
                    {queuedImages.map((img, index) => (
                      <div
                        key={img.id}
                        className="p-2.5 bg-zinc-900/80 border border-zinc-800 rounded-xl flex items-start gap-3 relative group hover:border-zinc-700 transition-all"
                      >
                        {/* Aspect 16:9 Preview */}
                        <div className="w-24 aspect-video rounded-lg overflow-hidden bg-black shrink-0 relative border border-zinc-800">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={img.dataUrl}
                            alt={img.title}
                            className="w-full h-full object-cover"
                          />
                        </div>

                        {/* Title & Category Form */}
                        <div className="flex-1 min-w-0 space-y-1.5">
                          <input
                            type="text"
                            value={img.title}
                            onChange={(e) => {
                              const val = e.target.value;
                              setQueuedImages(prev => prev.map((p, i) => i === index ? { ...p, title: val } : p));
                            }}
                            placeholder="Thumbnail Title"
                            className="w-full px-2 py-1 bg-black border border-zinc-800 rounded-md text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#009FDF]"
                          />

                          <div className="flex items-center gap-1.5">
                            <select
                              value={img.niche}
                              onChange={(e) => {
                                const val = e.target.value as NicheCategory;
                                setQueuedImages(prev => prev.map((p, i) => i === index ? { ...p, niche: val } : p));
                              }}
                              className="px-2 py-0.5 bg-black border border-zinc-800 rounded text-[11px] text-zinc-300 focus:outline-none focus:border-[#009FDF] cursor-pointer"
                            >
                              {(availableCategories.length > 0 ? availableCategories : ['Tech', 'Gaming', 'Business', 'IRL', 'Documentary', 'Sports', 'Educational', 'Entertainment']).map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                              ))}
                            </select>

                            <span className="text-[10px] text-zinc-500 truncate">
                              #{img.niche}
                            </span>
                          </div>
                        </div>

                        {/* Remove item button */}
                        <button
                          type="button"
                          onClick={() => setQueuedImages(prev => prev.filter((_, i) => i !== index))}
                          className="p-1 text-zinc-500 hover:text-red-400 rounded-md transition-colors cursor-pointer"
                          title="Remove image"
                        >
                          <IconTrash className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Bottom Action for Queued Images */}
                  <div className="pt-3 border-t border-zinc-800 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setQueuedImages([])}
                      disabled={isUploadingToCloud}
                      className="px-3.5 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>

                    <button
                      type="button"
                      id="save-all-queued-images-btn"
                      onClick={handleUploadQueuedImages}
                      disabled={isUploadingToCloud || queuedImages.length === 0}
                      className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-[#009FDF] hover:bg-[#008cc4] active:scale-[0.97] disabled:opacity-50 transition-all shadow-md flex items-center gap-2 cursor-pointer"
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
                            Upload {queuedImages.length} {queuedImages.length === 1 ? 'Thumbnail' : 'Thumbnails'} to Cloud
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
          {activeTab === 'youtube' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                  <IconYoutube className="w-4 h-4 text-red-500" />
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
                  className="w-full px-3 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#009FDF] resize-none"
                />

                {/* Channel Limit Selector if channel entered */}
                {isChannelInput(youtubeInput) && (
                  <div className="flex items-center justify-between p-2.5 bg-zinc-900/60 border border-zinc-800 rounded-xl text-xs">
                    <span className="text-zinc-400 font-medium">Channel extract count:</span>
                    <div className="flex items-center gap-1.5">
                      {[30, 50, 100].map(limit => (
                        <button
                          key={limit}
                          type="button"
                          onClick={() => setYoutubeChannelLimit(limit)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                            youtubeChannelLimit === limit
                              ? 'bg-[#009FDF] text-white shadow-xs'
                              : 'bg-zinc-800 text-zinc-400 hover:text-white'
                          }`}
                        >
                          {limit} videos
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between pt-1">
                  <p className="text-[11px] text-zinc-500">
                    Supports bulk extraction of thumbnails in maximum resolution
                  </p>

                  <button
                    type="button"
                    onClick={handleExtractYoutube}
                    disabled={isYoutubeLoading || !youtubeInput.trim()}
                    className="px-4 py-2 rounded-xl bg-[#009FDF] hover:bg-[#008cc4] disabled:opacity-50 text-white font-bold text-xs flex items-center gap-2 shadow-xs transition-all active:scale-95 cursor-pointer"
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
                  <div className="p-3 bg-red-950/40 border border-red-800/60 rounded-xl text-xs text-red-300">
                    {youtubeError}
                  </div>
                )}
              </div>

              {/* YouTube Extracted Result List */}
              {youtubeItems.length > 0 && (
                <div className="space-y-3 pt-2 border-t border-zinc-800">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-white">
                      Found {youtubeItems.length} thumbnails
                    </span>

                    <button
                      type="button"
                      onClick={() => {
                        const allSelected = youtubeItems.every(i => i.selected !== false);
                        setYoutubeItems(prev => prev.map(p => ({ ...p, selected: !allSelected })));
                      }}
                      className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-[11px] font-semibold text-zinc-300 cursor-pointer"
                    >
                      {youtubeItems.every(i => i.selected !== false) ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>

                  <div className="max-h-64 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                    {youtubeItems.map((item, index) => (
                      <div
                        key={item.id}
                        className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all ${
                          item.selected !== false
                            ? 'bg-zinc-900 border-zinc-800'
                            : 'bg-zinc-950/50 border-zinc-900 opacity-50'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setYoutubeItems(prev => prev.map((p, i) => i === index ? { ...p, selected: !p.selected } : p));
                          }}
                          className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border cursor-pointer ${
                            item.selected !== false
                              ? 'bg-[#009FDF] border-[#009FDF] text-white'
                              : 'border-zinc-700 bg-zinc-800'
                          }`}
                        >
                          {item.selected !== false && <IconCheck className="w-3 h-3" />}
                        </button>

                        <div className="w-16 aspect-video rounded-lg overflow-hidden bg-black shrink-0 relative border border-zinc-800">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover" />
                        </div>

                        <div className="flex-1 min-w-0 space-y-0.5">
                          <p className="text-xs font-bold text-white truncate" title={item.title}>
                            {item.title}
                          </p>
                          <div className="flex items-center gap-2 text-[10px] text-zinc-400">
                            <span>{item.creator}</span>
                            <span className="text-[#009FDF] font-medium">#{item.niche}</span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => setYoutubeItems(prev => prev.filter((_, i) => i !== index))}
                          className="p-1 text-zinc-500 hover:text-red-400 transition-colors cursor-pointer"
                          title="Remove"
                        >
                          <IconTrash className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2 border-t border-zinc-800 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setYoutubeItems([])}
                      className="px-3.5 py-2 text-xs text-zinc-400 hover:text-white"
                    >
                      Clear
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSaveBatchItems(youtubeItems)}
                      disabled={isUploadingToCloud || youtubeItems.filter(i => i.selected !== false).length === 0}
                      className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#009FDF] hover:bg-[#008cc4] disabled:opacity-50 transition-all flex items-center gap-2 cursor-pointer shadow-md"
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
                <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                  <IconPinterest className="w-4 h-4 text-rose-500" />
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
                  className="w-full px-3 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#009FDF] resize-none"
                />

                <div className="flex items-center justify-between pt-1">
                  <p className="text-[11px] text-zinc-500">
                    Paste one or multiple Pinterest links to extract high-definition images
                  </p>

                  <button
                    type="button"
                    onClick={handleExtractPinterest}
                    disabled={isPinterestLoading || !pinterestInput.trim()}
                    className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-2 shadow-xs transition-all active:scale-95 cursor-pointer"
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
                  <div className="p-3 bg-red-950/40 border border-red-800/60 rounded-xl text-xs text-red-300">
                    {pinterestError}
                  </div>
                )}
              </div>

              {/* Pinterest Extracted Result List */}
              {pinterestItems.length > 0 && (
                <div className="space-y-3 pt-2 border-t border-zinc-800">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-white">
                      Found {pinterestItems.length} Pinterest pins
                    </span>

                    <button
                      type="button"
                      onClick={() => {
                        const allSelected = pinterestItems.every(i => i.selected !== false);
                        setPinterestItems(prev => prev.map(p => ({ ...p, selected: !allSelected })));
                      }}
                      className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-[11px] font-semibold text-zinc-300 cursor-pointer"
                    >
                      {pinterestItems.every(i => i.selected !== false) ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>

                  <div className="max-h-64 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                    {pinterestItems.map((item, index) => (
                      <div
                        key={item.id}
                        className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all ${
                          item.selected !== false
                            ? 'bg-zinc-900 border-zinc-800'
                            : 'bg-zinc-950/50 border-zinc-900 opacity-50'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setPinterestItems(prev => prev.map((p, i) => i === index ? { ...p, selected: !p.selected } : p));
                          }}
                          className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border cursor-pointer ${
                            item.selected !== false
                              ? 'bg-rose-600 border-rose-600 text-white'
                              : 'border-zinc-700 bg-zinc-800'
                          }`}
                        >
                          {item.selected !== false && <IconCheck className="w-3 h-3" />}
                        </button>

                        <div className="w-16 aspect-video rounded-lg overflow-hidden bg-black shrink-0 relative border border-zinc-800">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover" />
                        </div>

                        <div className="flex-1 min-w-0 space-y-0.5">
                          <p className="text-xs font-bold text-white truncate" title={item.title}>
                            {item.title}
                          </p>
                          <div className="flex items-center gap-2 text-[10px] text-zinc-400">
                            <span>{item.creator}</span>
                            <span className="text-rose-400 font-medium">#{item.niche}</span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => setPinterestItems(prev => prev.filter((_, i) => i !== index))}
                          className="p-1 text-zinc-500 hover:text-red-400 transition-colors cursor-pointer"
                          title="Remove"
                        >
                          <IconTrash className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2 border-t border-zinc-800 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setPinterestItems([])}
                      className="px-3.5 py-2 text-xs text-zinc-400 hover:text-white"
                    >
                      Clear
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSaveBatchItems(pinterestItems)}
                      disabled={isUploadingToCloud || pinterestItems.filter(i => i.selected !== false).length === 0}
                      className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 disabled:opacity-50 transition-all flex items-center gap-2 cursor-pointer shadow-md"
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
                            Import {pinterestItems.filter(i => i.selected !== false).length} Pins
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
