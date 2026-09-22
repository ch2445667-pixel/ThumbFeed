'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Sparkles, UploadCloud, Youtube, Link as LinkIcon, Check, Plus, Trash2, Eye, Palette, Tag } from 'lucide-react';
import { ThumbnailItem, NicheCategory, VisualStyle } from '../../lib/types';
import { getStoredThumbnails, saveStoredThumbnail } from '../../lib/storage';
import { useAuth, ADMIN_EMAIL } from '../../lib/authContext';

const NICHES: NicheCategory[] = [
  'IRL',
  'Business',
  'Tech',
  'Entertainment',
  'Gaming',
  'Sports',
  'Documentary',
  'Educational'
];

const VISUAL_STYLES: VisualStyle[] = [
  'Face Close-up',
  '3D Render / CGI',
  'Illustrated / Anime',
  'Minimalist & Clean',
  'Split Screen / Before-After',
  'Text-Heavy / Typography',
  'No-Text / Visual Hook',
  'High-Contrast Glow'
];

export default function AdminPage() {
  const { user, isAdmin, loading, signingIn, signIn } = useAuth();
  const [thumbnails, setThumbnails] = useState<ThumbnailItem[]>([]);
  const [inputUrl, setInputUrl] = useState('');
  const [videoTitleInput, setVideoTitleInput] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Form State for new thumbnail
  const [previewImage, setPreviewImage] = useState('');
  const [title, setTitle] = useState('');
  const [creator, setCreator] = useState('');
  const [niche, setNiche] = useState<NicheCategory>('Tech');
  const [selectedStyles, setSelectedStyles] = useState<VisualStyle[]>(['Face Close-up', 'High-Contrast Glow']);
  const [tagsInput, setTagsInput] = useState('High CTR, YouTube Hook, Contrast');
  const [colorsInput, setColorsInput] = useState('#EF4444, #0F172A, #FBBF24, #FFFFFF');
  const [ocrText, setOcrText] = useState('');
  const [breakdownNotes, setBreakdownNotes] = useState('');
  const [viewsEstimate, setViewsEstimate] = useState('1.5M');
  const [emotion, setEmotion] = useState<any>('Shocked');

  useEffect(() => {
    setThumbnails(getStoredThumbnails());
  }, []);

  // Helper to extract YouTube Thumbnail URL from watch URL
  const extractYoutubeThumbnail = (url: string) => {
    let videoId = '';
    const matchWatch = url.match(/(?:v=|\/embed\/|\/shorts\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    if (matchWatch && matchWatch[1]) {
      videoId = matchWatch[1];
      return `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
    }
    return url;
  };

  const handleFetchAndAnalyze = async () => {
    if (!inputUrl.trim()) return;
    setIsAnalyzing(true);

    const resolvedImageUrl = extractYoutubeThumbnail(inputUrl.trim());
    setPreviewImage(resolvedImageUrl);

    try {
      const res = await fetch('/api/ai-tagger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: resolvedImageUrl,
          videoTitle: videoTitleInput.trim()
        })
      });

      const json = await res.json();
      if (json.success && json.data) {
        const d = json.data;
        if (d.title) setTitle(d.title);
        if (d.niche) setNiche(d.niche);
        if (d.styles) setSelectedStyles(d.styles);
        if (d.tags) setTagsInput(d.tags.join(', '));
        if (d.colors) setColorsInput(d.colors.join(', '));
        if (d.ocrText !== undefined) setOcrText(d.ocrText);
        if (d.emotion) setEmotion(d.emotion);
        if (d.breakdownNotes) setBreakdownNotes(d.breakdownNotes);
      }
    } catch (err) {
      console.error('AI Tagger failed:', err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setPreviewImage(base64);
      setTitle(file.name.replace(/\.[^/.]+$/, ""));
    };
    reader.readAsDataURL(file);
  };

  const handleSaveThumbnail = (e: React.FormEvent) => {
    e.preventDefault();
    if (!previewImage) return;

    const parsedColors = colorsInput
      .split(',')
      .map(c => c.trim())
      .filter(c => c.startsWith('#') || c.length >= 4);

    const parsedTags = tagsInput
      .split(',')
      .map(t => t.trim().replace(/^#/, ''))
      .filter(t => t.length > 0);

    const newItem: ThumbnailItem = {
      id: `thumb-${Date.now()}`,
      title: title || 'Curated Thumbnail Inspiration',
      creator: creator || 'YouTube Creator',
      imageUrl: previewImage,
      niche,
      styles: selectedStyles,
      tags: parsedTags.length > 0 ? parsedTags : ['YouTube', 'CTR'],
      colors: parsedColors.length > 0 ? parsedColors : ['#401D1A', '#E4E0D3', '#FFFFFF'],
      ocrText,
      emotion,
      breakdownNotes,
      viewsEstimate,
      source: 'upload',
      createdAt: new Date().toISOString(),
      likesCount: Math.floor(Math.random() * 500) + 100
    };

    const updated = saveStoredThumbnail(newItem);
    setThumbnails(updated);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);

    // Reset Form
    setInputUrl('');
    setVideoTitleInput('');
    setPreviewImage('');
    setTitle('');
    setBreakdownNotes('');
    setOcrText('');
  };

  const handleDeleteThumbnail = (id: string) => {
    if (!isAdmin) return;
    if (!confirm('Are you sure you want to remove this thumbnail?')) return;
    const updated = thumbnails.filter(t => t.id !== id);
    setThumbnails(updated);
    localStorage.setItem('thumbvault_thumbnails', JSON.stringify(updated));
  };

  if (!loading && !isAdmin) {
    return (
      <div className="min-h-screen bg-[#E4E0D3] dark:bg-[#18181b] text-[#401D1A] dark:text-[#E4E0D3] flex items-center justify-center p-4">
        <div className="max-w-md w-full p-6 sm:p-8 rounded-2xl bg-white dark:bg-zinc-900 border border-[#401D1A]/10 dark:border-white/10 shadow-lg text-center space-y-4">
          <div className="w-12 h-12 mx-auto rounded-full bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-lg">
            !
          </div>
          <h2 className="text-xl font-bold text-[#401D1A] dark:text-white">
            Access Restricted
          </h2>
          <p className="text-sm text-[#401D1A]/70 dark:text-zinc-400">
            Adding and deleting thumbnails is restricted exclusively to the owner account ({ADMIN_EMAIL}).
          </p>
          {user ? (
            <p className="text-xs text-[#401D1A]/60 dark:text-zinc-500">
              Currently signed in as: <span className="font-semibold">{user.email}</span>
            </p>
          ) : (
            <button
              onClick={() => signIn()}
              disabled={signingIn}
              className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-[#401D1A] dark:bg-white dark:text-[#401D1A] hover:opacity-90 transition-opacity cursor-pointer flex items-center justify-center gap-2"
            >
              Sign In with Google
            </button>
          )}
          <div className="pt-2 border-t border-[#401D1A]/10 dark:border-white/10">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#401D1A]/70 hover:text-[#401D1A] dark:text-zinc-400 dark:hover:text-white transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Return to Inspiration Gallery</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#E4E0D3] dark:bg-[#18181b] text-[#401D1A] dark:text-[#E4E0D3] p-4 sm:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header Navigation */}
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm font-medium text-[#401D1A]/70 hover:text-[#401D1A] dark:text-[#E4E0D3]/70 dark:hover:text-[#FFFFFF] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Inspiration Gallery</span>
          </Link>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[#401D1A]/10 dark:bg-[#E4E0D3]/20 text-[#401D1A] dark:text-[#E4E0D3] border border-[#401D1A]/20 dark:border-[#E4E0D3]/30">
              Admin & AI Curation Hub
            </span>
          </div>
        </div>

        {/* Title */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#401D1A] dark:text-[#FFFFFF]">
            Add Thumbnail & AI Auto-Tagging Engine
          </h1>
          <p className="text-sm text-[#401D1A]/70 dark:text-[#E4E0D3]/70 mt-1">
            Input a YouTube video URL, image link, or upload an image file. The AI analyzes visual hooks, colors, styles, and text automatically.
          </p>
        </div>

        {/* Ingestion & AI Engine Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column: Input Source & Live AI Tagging */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Input Box */}
            <div className="bg-[#FFFFFF] dark:bg-[#401D1A] p-5 rounded-2xl border border-[#401D1A]/15 dark:border-[#E4E0D3]/20 shadow-md space-y-4">
              <h3 className="text-sm font-bold text-[#401D1A] dark:text-[#FFFFFF] flex items-center gap-2">
                <Youtube className="w-4 h-4 text-[#401D1A] dark:text-[#E4E0D3]" />
                1. Provide Thumbnail Source
              </h3>

              <div className="space-y-3">
                <div>
                  <label className="text-xs text-[#401D1A]/70 dark:text-[#E4E0D3]/70 block mb-1">YouTube Video Link or Image URL</label>
                  <input
                    type="text"
                    placeholder="https://www.youtube.com/watch?v=... or image URL"
                    value={inputUrl}
                    onChange={(e) => setInputUrl(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#E4E0D3]/30 dark:bg-[#401D1A] border border-[#401D1A]/20 dark:border-[#E4E0D3]/30 rounded-xl text-xs text-[#401D1A] dark:text-[#FFFFFF] placeholder-[#401D1A]/50 dark:placeholder-[#E4E0D3]/50 focus:outline-none focus:border-[#401D1A] dark:focus:border-[#E4E0D3]"
                  />
                </div>

                <div>
                  <label className="text-xs text-[#401D1A]/70 dark:text-[#E4E0D3]/70 block mb-1">Video Title / Topic (Optional - helps AI precision)</label>
                  <input
                    type="text"
                    placeholder="e.g. $1 vs $1,000,000 Luxury Island!"
                    value={videoTitleInput}
                    onChange={(e) => setVideoTitleInput(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#E4E0D3]/30 dark:bg-[#401D1A] border border-[#401D1A]/20 dark:border-[#E4E0D3]/30 rounded-xl text-xs text-[#401D1A] dark:text-[#FFFFFF] placeholder-[#401D1A]/50 dark:placeholder-[#E4E0D3]/50 focus:outline-none focus:border-[#401D1A] dark:focus:border-[#E4E0D3]"
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleFetchAndAnalyze}
                    disabled={!inputUrl.trim() || isAnalyzing}
                    className="flex-1 py-2.5 px-4 bg-[#401D1A] dark:bg-[#E4E0D3] dark:text-[#401D1A] hover:opacity-90 disabled:opacity-50 text-[#FFFFFF] rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-md"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>{isAnalyzing ? 'AI Analyzing Thumbnail...' : 'Analyze & Auto-Tag with AI'}</span>
                  </button>
                </div>
              </div>

              {/* Or Drag & Drop Local Image File */}
              <div className="relative pt-2">
                <div className="border-t border-[#401D1A]/10 dark:border-[#E4E0D3]/15 my-3 text-center">
                  <span className="bg-[#FFFFFF] dark:bg-[#401D1A] px-2 text-[10px] text-[#401D1A]/60 dark:text-[#E4E0D3]/60 uppercase tracking-wider relative -top-2">
                    OR UPLOAD DIRECT FILE
                  </span>
                </div>

                <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-[#401D1A]/20 dark:border-[#E4E0D3]/30 rounded-xl cursor-pointer hover:border-[#401D1A] dark:hover:border-[#E4E0D3] hover:bg-[#E4E0D3]/30 dark:hover:bg-[#FFFFFF]/5 transition-all">
                  <UploadCloud className="w-6 h-6 text-[#401D1A]/60 dark:text-[#E4E0D3]/60 mb-1" />
                  <span className="text-xs font-medium text-[#401D1A] dark:text-[#E4E0D3]">Choose thumbnail image (PNG/JPG)</span>
                  <span className="text-[10px] text-[#401D1A]/50 dark:text-[#E4E0D3]/50 mt-0.5">Max 10MB</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {/* Preview Box */}
            {previewImage && (
              <div className="bg-[#FFFFFF] dark:bg-[#401D1A] p-4 rounded-2xl border border-[#401D1A]/15 dark:border-[#E4E0D3]/20 shadow-md space-y-2">
                <span className="text-xs font-semibold text-[#401D1A]/70 dark:text-[#E4E0D3]/70">Thumbnail Preview:</span>
                <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-[#401D1A] border border-[#401D1A]/20 dark:border-[#E4E0D3]/20">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={previewImage} alt="Preview" className="w-full h-full object-cover" />
                </div>
              </div>
            )}

          </div>

          {/* Right Column: Editable Metadata Form */}
          <div className="lg:col-span-7">
            <form onSubmit={handleSaveThumbnail} className="bg-[#FFFFFF] dark:bg-[#401D1A] p-6 rounded-2xl border border-[#401D1A]/15 dark:border-[#E4E0D3]/20 shadow-md space-y-5">
              
              <div className="flex items-center justify-between border-b border-[#401D1A]/10 dark:border-[#E4E0D3]/15 pb-3">
                <h3 className="text-sm font-bold text-[#401D1A] dark:text-[#FFFFFF] flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#401D1A] dark:text-[#E4E0D3]" />
                  2. Review & Refine AI Tags
                </h3>
                {savedSuccess && (
                  <span className="flex items-center gap-1 text-xs font-semibold text-[#401D1A] dark:text-[#E4E0D3] bg-[#E4E0D3]/60 dark:bg-[#FFFFFF]/10 px-2.5 py-1 rounded-lg border border-[#401D1A]/20 dark:border-[#E4E0D3]/30 animate-in fade-in">
                    <Check className="w-3.5 h-3.5" /> Published to Gallery!
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="text-xs text-[#401D1A]/70 dark:text-[#E4E0D3]/70 block mb-1 font-medium">Title / Concept</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. $1 vs $1,000,000 Luxury Island!"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-3.5 py-2 bg-[#E4E0D3]/30 dark:bg-[#401D1A] border border-[#401D1A]/20 dark:border-[#E4E0D3]/30 rounded-xl text-xs text-[#401D1A] dark:text-[#FFFFFF] focus:outline-none focus:border-[#401D1A] dark:focus:border-[#E4E0D3]"
                  />
                </div>

                <div>
                  <label className="text-xs text-[#401D1A]/70 dark:text-[#E4E0D3]/70 block mb-1 font-medium">Creator / Channel Style</label>
                  <input
                    type="text"
                    placeholder="e.g. MrBeast, Ali Abdaal, Vox"
                    value={creator}
                    onChange={(e) => setCreator(e.target.value)}
                    className="w-full px-3.5 py-2 bg-[#E4E0D3]/30 dark:bg-[#401D1A] border border-[#401D1A]/20 dark:border-[#E4E0D3]/30 rounded-xl text-xs text-[#401D1A] dark:text-[#FFFFFF] focus:outline-none focus:border-[#401D1A] dark:focus:border-[#E4E0D3]"
                  />
                </div>

                <div>
                  <label className="text-xs text-[#401D1A]/70 dark:text-[#E4E0D3]/70 block mb-1 font-medium">Niche / Category</label>
                  <select
                    value={niche}
                    onChange={(e) => setNiche(e.target.value as any)}
                    className="w-full px-3.5 py-2 bg-[#E4E0D3]/30 dark:bg-[#401D1A] border border-[#401D1A]/20 dark:border-[#E4E0D3]/30 rounded-xl text-xs text-[#401D1A] dark:text-[#FFFFFF] focus:outline-none focus:border-[#401D1A] dark:focus:border-[#E4E0D3]"
                  >
                    {NICHES.map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="text-xs text-[#401D1A]/70 dark:text-[#E4E0D3]/70 block mb-1 font-medium">Visual Styles (Select multiple)</label>
                  <div className="flex flex-wrap gap-1.5">
                    {VISUAL_STYLES.map(style => {
                      const isSel = selectedStyles.includes(style);
                      return (
                        <button
                          type="button"
                          key={style}
                          onClick={() => {
                            if (isSel) {
                              setSelectedStyles(selectedStyles.filter(s => s !== style));
                            } else {
                              setSelectedStyles([...selectedStyles, style]);
                            }
                          }}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                            isSel
                              ? 'bg-[#401D1A] text-[#FFFFFF] dark:bg-[#E4E0D3] dark:text-[#401D1A]'
                              : 'bg-[#E4E0D3]/40 dark:bg-[#FFFFFF]/10 border border-[#401D1A]/15 dark:border-[#E4E0D3]/20 text-[#401D1A] dark:text-[#E4E0D3] hover:bg-[#E4E0D3]'
                          }`}
                        >
                          {style}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="text-xs text-[#401D1A]/70 dark:text-[#E4E0D3]/70 block mb-1 font-medium">OCR Text on Thumbnail</label>
                  <input
                    type="text"
                    placeholder="e.g. $1 VS $1,000,000"
                    value={ocrText}
                    onChange={(e) => setOcrText(e.target.value)}
                    className="w-full px-3.5 py-2 bg-[#E4E0D3]/30 dark:bg-[#401D1A] border border-[#401D1A]/20 dark:border-[#E4E0D3]/30 rounded-xl text-xs text-[#401D1A] dark:text-[#FFFFFF] focus:outline-none focus:border-[#401D1A] dark:focus:border-[#E4E0D3]"
                  />
                </div>

                <div>
                  <label className="text-xs text-[#401D1A]/70 dark:text-[#E4E0D3]/70 block mb-1 font-medium">Dominant Color Hexes (Comma-separated)</label>
                  <input
                    type="text"
                    placeholder="#401D1A, #E4E0D3, #FFFFFF"
                    value={colorsInput}
                    onChange={(e) => setColorsInput(e.target.value)}
                    className="w-full px-3.5 py-2 bg-[#E4E0D3]/30 dark:bg-[#401D1A] border border-[#401D1A]/20 dark:border-[#E4E0D3]/30 rounded-xl text-xs text-[#401D1A] dark:text-[#FFFFFF] focus:outline-none focus:border-[#401D1A] dark:focus:border-[#E4E0D3] font-mono"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-xs text-[#401D1A]/70 dark:text-[#E4E0D3]/70 block mb-1 font-medium">Search Tags (Comma-separated)</label>
                  <input
                    type="text"
                    placeholder="Gaming, Lava, Day 100, Extreme Contrast"
                    value={tagsInput}
                    onChange={(e) => setTagsInput(e.target.value)}
                    className="w-full px-3.5 py-2 bg-[#E4E0D3]/30 dark:bg-[#401D1A] border border-[#401D1A]/20 dark:border-[#E4E0D3]/30 rounded-xl text-xs text-[#401D1A] dark:text-[#FFFFFF] focus:outline-none focus:border-[#401D1A] dark:focus:border-[#E4E0D3]"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-xs text-[#401D1A]/70 dark:text-[#E4E0D3]/70 block mb-1 font-medium">Why This Thumbnail Works (Breakdown Notes)</label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Clear split-screen dichotomy creates immediate curiosity. Exaggerated facial expression anchors eye gaze."
                    value={breakdownNotes}
                    onChange={(e) => setBreakdownNotes(e.target.value)}
                    className="w-full px-3.5 py-2 bg-[#E4E0D3]/30 dark:bg-[#401D1A] border border-[#401D1A]/20 dark:border-[#E4E0D3]/30 rounded-xl text-xs text-[#401D1A] dark:text-[#FFFFFF] focus:outline-none focus:border-[#401D1A] dark:focus:border-[#E4E0D3]"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-[#401D1A]/10 dark:border-[#E4E0D3]/15 flex justify-end">
                <button
                  type="submit"
                  disabled={!previewImage}
                  className="px-6 py-2.5 rounded-xl text-xs font-semibold text-[#FFFFFF] bg-[#401D1A] dark:bg-[#E4E0D3] dark:text-[#401D1A] hover:opacity-90 disabled:opacity-40 transition-all shadow-md flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Publish to Inspiration Vault</span>
                </button>
              </div>

            </form>
          </div>

        </div>

        {/* Existing Thumbnails Inventory */}
        <div className="bg-[#FFFFFF] dark:bg-[#401D1A] p-6 rounded-2xl border border-[#401D1A]/15 dark:border-[#E4E0D3]/20 shadow-md space-y-4 mt-8">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-[#401D1A] dark:text-[#FFFFFF]">Current Vault Inventory ({thumbnails.length} Thumbnails)</h3>
            <span className="text-xs text-[#401D1A]/70 dark:text-[#E4E0D3]/70">Stored in Local Database</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {thumbnails.map(item => (
              <div key={item.id} className="p-3 rounded-xl bg-[#E4E0D3]/20 dark:bg-[#401D1A] border border-[#401D1A]/15 dark:border-[#E4E0D3]/20 flex flex-col justify-between gap-2">
                <div className="relative aspect-video rounded-lg overflow-hidden bg-[#401D1A]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-[#401D1A] dark:text-[#FFFFFF] truncate">{item.title}</h4>
                  <p className="text-[11px] text-[#401D1A]/70 dark:text-[#E4E0D3]/70 mt-0.5">{item.niche}</p>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-[#401D1A]/10 dark:border-[#E4E0D3]/15">
                  <span className="text-[10px] text-[#401D1A]/60 dark:text-[#E4E0D3]/60">{item.creator || 'Creator'}</span>
                  <button
                    onClick={() => handleDeleteThumbnail(item.id)}
                    className="text-[#401D1A]/60 hover:text-[#401D1A] dark:text-[#E4E0D3]/60 dark:hover:text-[#FFFFFF] p-1 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
