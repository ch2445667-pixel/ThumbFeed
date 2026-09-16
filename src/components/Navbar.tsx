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
    <header className="sticky top-0 z-40 w-full glass-panel border-b border-border/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-glow group-hover:scale-105 transition-transform">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg tracking-tight text-white">Thumb<span className="text-indigo-400">Vault</span></span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                PRO
              </span>
            </div>
            <p className="text-xs text-gray-400">YouTube Thumbnail Inspiration & AI Tagger</p>
          </div>
        </Link>

        {/* Navigation Actions */}
        <div className="flex items-center gap-3">
          
          {/* Explore / Gallery Link */}
          <Link
            href="/"
            className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-300 hover:text-white hover:bg-surfaceHover transition-colors"
          >
            <Compass className="w-4 h-4 text-indigo-400" />
            <span>Gallery</span>
          </Link>

          {/* Collections / Moodboards Drawer Trigger */}
          <button
            onClick={onOpenMoodboard}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium text-gray-200 bg-surface border border-border hover:border-indigo-500/40 hover:bg-surfaceHover transition-all relative"
          >
            <Bookmark className="w-4 h-4 text-indigo-400" />
            <span>Moodboards</span>
            {savedCount > 0 && (
              <span className="ml-1 px-1.5 py-0.2 text-xs font-semibold rounded-full bg-indigo-600 text-white">
                {savedCount}
              </span>
            )}
          </button>

          {/* Chrome Extension Modal / Link */}
          <Link
            href="/extension-guide"
            className="hidden md:flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-300 hover:text-white hover:bg-surfaceHover transition-colors"
          >
            <Chrome className="w-4 h-4 text-brand-youtube" />
            <span>Chrome Grabber</span>
          </Link>

          {/* Admin Upload / AI Curation Link */}
          <Link
            href="/admin"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-all shadow-md hover:shadow-glow"
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
