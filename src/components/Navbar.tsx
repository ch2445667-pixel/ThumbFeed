'use client';

import React from 'react';
import Link from 'next/link';
import { Sparkles, Bookmark, UploadCloud, Chrome, Compass } from 'lucide-react';

interface NavbarProps {
  savedCount: number;
  onOpenMoodboard: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ savedCount, onOpenMoodboard }) => {
  return (
    <header className="sticky top-0 z-40 w-full glass-panel border-b border-line">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center shadow-elevated group-hover:scale-105 transition-transform">
            <Sparkles className="w-5 h-5 text-accent-on" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg tracking-tight text-ink">Thumb<span className="text-accent">Vault</span></span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-accent-veil text-accent border border-accent">
                PRO
              </span>
            </div>
            <p className="text-xs text-ink-muted">YouTube Thumbnail Inspiration & AI Tagger</p>
          </div>
        </Link>

        {/* Navigation Actions */}
        <div className="flex items-center gap-3">
          
          {/* Explore / Gallery Link */}
          <Link
            href="/"
            className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-ink-muted hover:text-ink hover:bg-surface-raised transition-colors"
          >
            <Compass className="w-4 h-4 text-accent" />
            <span>Gallery</span>
          </Link>

          {/* Collections / Moodboards Drawer Trigger */}
          <button
            onClick={onOpenMoodboard}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium text-ink bg-surface border border-line hover:bg-surface-raised transition-all relative"
          >
            <Bookmark className="w-4 h-4 text-accent" />
            <span>Moodboards</span>
            {savedCount > 0 && (
              <span className="ml-1 px-1.5 py-0.2 text-xs font-semibold rounded-full bg-accent text-accent-on">
                {savedCount}
              </span>
            )}
          </button>

          {/* Chrome Extension Modal / Link */}
          <Link
            href="/extension-guide"
            className="hidden md:flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-ink-muted hover:text-ink hover:bg-surface-raised transition-colors"
          >
            <Chrome className="w-4 h-4 text-accent" />
            <span>Chrome Grabber</span>
          </Link>

          {/* Admin Upload / AI Curation Link */}
          <Link
            href="/admin"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-accent-on bg-accent hover:bg-accent-hover transition-all shadow-md hover:shadow-elevated"
          >
            <UploadCloud className="w-4 h-4" />
            <span className="hidden sm:inline">Add / AI Tagger</span>
            <span className="sm:hidden">Add</span>
          </Link>

        </div>
      </div>
    </header>
  );
};
