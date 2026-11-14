'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, FolderArchive } from 'lucide-react';

export default function PinterestGuidePage() {
  return (
    <div className="min-h-screen bg-[#E4E0D3] dark:bg-[#18181b] text-[#401D1A] dark:text-[#E4E0D3] p-4 sm:p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Navigation */}
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm font-medium text-[#401D1A]/70 hover:text-[#401D1A] dark:text-[#E4E0D3]/70 dark:hover:text-[#FFFFFF] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Inspiration Gallery</span>
          </Link>
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[#401D1A]/10 dark:bg-[#E4E0D3]/20 text-[#401D1A] dark:text-[#E4E0D3] border border-[#401D1A]/20 dark:border-[#E4E0D3]/30 flex items-center gap-1.5">
            Pinterest Board Importer
          </span>
        </div>

        {/* Header */}
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#401D1A]/10 dark:bg-[#E4E0D3]/20 text-[#401D1A] dark:text-[#E4E0D3] text-xs font-semibold border border-[#401D1A]/20 dark:border-[#E4E0D3]/30">
            <FolderArchive className="w-3.5 h-3.5" />
            <span>Bulk Migration Helper</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-[#401D1A] dark:text-[#FFFFFF]">
            Import Pinterest Thumbnails into ThumbFeed
          </h1>
          <p className="text-sm text-[#401D1A]/70 dark:text-[#E4E0D3]/70 max-w-2xl leading-relaxed">
            Move your saved Pinterest board images directly into ThumbFeed&apos;s Cloudflare R2 library so you can organise and search them alongside YouTube thumbnails.
          </p>
        </div>

        {/* 3 Step Workflow */}
        <div className="space-y-4">
          <div className="bg-[#FFFFFF] dark:bg-[#401D1A] p-5 rounded-2xl border border-[#401D1A]/15 dark:border-[#E4E0D3]/20 shadow-md space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-[#401D1A] text-[#FFFFFF] dark:bg-[#E4E0D3] dark:text-[#401D1A] text-xs font-bold flex items-center justify-center">1</span>
              <h3 className="font-bold text-sm text-[#401D1A] dark:text-[#FFFFFF]">Copy your public Pinterest Board link or export files</h3>
            </div>
            <p className="text-xs text-[#401D1A]/70 dark:text-[#E4E0D3]/70 pl-8 leading-relaxed">
              Copy a Pinterest board URL from your browser, or export a folder of saved images locally for batch upload.
            </p>
          </div>

          <div className="bg-[#FFFFFF] dark:bg-[#401D1A] p-5 rounded-2xl border border-[#401D1A]/15 dark:border-[#E4E0D3]/20 shadow-md space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-[#401D1A] text-[#FFFFFF] dark:bg-[#E4E0D3] dark:text-[#401D1A] text-xs font-bold flex items-center justify-center">2</span>
              <h3 className="font-bold text-sm text-[#401D1A] dark:text-[#FFFFFF]">Open the ThumbFeed Add Studio</h3>
            </div>
            <p className="text-xs text-[#401D1A]/70 dark:text-[#E4E0D3]/70 pl-8 leading-relaxed">
              As a signed-in administrator, open the full-screen Add Studio from the header, paste your Pinterest board URL or drag-and-drop local images, pick a niche and board, and confirm upload to Cloudflare R2.
            </p>
          </div>

          <div className="bg-[#FFFFFF] dark:bg-[#401D1A] p-5 rounded-2xl border border-[#401D1A]/15 dark:border-[#E4E0D3]/20 shadow-md space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-[#401D1A] text-[#FFFFFF] dark:bg-[#E4E0D3] dark:text-[#401D1A] text-xs font-bold flex items-center justify-center">3</span>
              <h3 className="font-bold text-sm text-[#401D1A] dark:text-[#FFFFFF]">Instant Search &amp; Filter in ThumbFeed</h3>
            </div>
            <p className="text-xs text-[#401D1A]/70 dark:text-[#E4E0D3]/70 pl-8 leading-relaxed">
              Once uploaded, your imported images appear across the gallery immediately with category filters, personal boards, and full-resolution preview.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
