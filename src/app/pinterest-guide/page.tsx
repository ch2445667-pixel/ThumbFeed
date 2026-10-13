'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Sparkles, FolderArchive, Terminal, Check, Copy, FileText, Layers } from 'lucide-react';

export default function PinterestGuidePage() {
  const [copiedCmd, setCopiedCmd] = useState(false);

  const scriptCommand = `python scripts/pinterest_importer.py --folder "C:\\path\\to\\your\\pinterest_thumbnails"`;

  const copyCommand = () => {
    navigator.clipboard.writeText(scriptCommand);
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2000);
  };

  return (
    <div className="min-h-screen bg-canvas text-ink p-4 sm:p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Navigation */}
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm font-medium text-ink-muted hover:text-ink transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Inspiration Gallery</span>
          </Link>
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-surface border border-line text-ink flex items-center gap-1.5">
            Pinterest 1,000+ Importer
          </span>
        </div>

        {/* Header */}
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface border border-line text-ink text-xs font-semibold">
            <FolderArchive className="w-3.5 h-3.5" />
            <span>Bulk Migration Helper</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-ink">
            Import 1,000+ Pinterest Thumbnails into ThumbVault
          </h1>
          <p className="text-sm text-ink-muted max-w-2xl leading-relaxed">
            Move all your saved Pinterest board thumbnails into ThumbVault so you can search them instantly by niche, color, and visual hook.
          </p>
        </div>

        {/* 3 Step Workflow */}
        <div className="space-y-4">
          
          {/* Step 1 */}
          <div className="bg-surface p-5 rounded-2xl border border-line shadow-card space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-accent text-accent-on text-xs font-bold flex items-center justify-center">1</span>
              <h3 className="font-bold text-sm text-ink">Export or Download your Pinterest Board images</h3>
            </div>
            <p className="text-xs text-ink-muted pl-8 leading-relaxed">
              You can export your Pinterest board images in bulk using any free Pinterest image downloader (like WFDownloader, Image Downloader Chrome extension, or Pinterest Board Exporter) into a folder on your computer.
            </p>
          </div>

          {/* Step 2 */}
          <div className="bg-surface p-5 rounded-2xl border border-line shadow-card space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-accent text-accent-on text-xs font-bold flex items-center justify-center">2</span>
              <h3 className="font-bold text-sm text-ink">Run the ThumbVault Bulk Importer Script</h3>
            </div>
            <p className="text-xs text-ink-muted pl-8 leading-relaxed">
              We included an automated Python importer in <code className="text-ink bg-surface-raised px-1 py-0.5 rounded font-mono">scripts/pinterest_importer.py</code> that analyzes each image, automatically extracts dominant colors, detects niches, generates tags, and formats everything into your vault dataset.
            </p>

            <div className="ml-8 p-3 bg-surface-raised border border-line rounded-xl flex items-center justify-between gap-2">
              <code className="text-xs text-ink font-mono flex-1 truncate">
                {scriptCommand}
              </code>
              <button
                onClick={copyCommand}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-accent text-accent-on hover:opacity-90 flex items-center gap-1 transition-colors"
              >
                {copiedCmd ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedCmd ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>

          {/* Step 3 */}
          <div className="bg-surface p-5 rounded-2xl border border-line shadow-card space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-accent text-accent-on text-xs font-bold flex items-center justify-center">3</span>
              <h3 className="font-bold text-sm text-ink">Instant Search & Filter in ThumbVault</h3>
            </div>
            <p className="text-xs text-ink-muted pl-8 leading-relaxed">
              Once imported, open ThumbVault in your browser to instantly search all 1,000+ thumbnails with live filters, moodboards, and full-resolution inspection!
            </p>
          </div>

        </div>

      </div>
    </div>
  );
}
