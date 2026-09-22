'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Chrome, Download, Check, Sparkles, Youtube, ExternalLink, ShieldCheck, Zap } from 'lucide-react';

export default function ExtensionGuidePage() {
  const [copiedPath, setCopiedPath] = useState(false);

  const extensionFolderPath = `C:\\Users\\ch244\\.gemini\\antigravity\\scratch\\thumbvault\\extension`;

  const copyPath = () => {
    navigator.clipboard.writeText(extensionFolderPath);
    setCopiedPath(true);
    setTimeout(() => setCopiedPath(false), 2000);
  };

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
            <Youtube className="w-3.5 h-3.5" /> 1-Click YouTube Grabber
          </span>
        </div>

        {/* Hero Header */}
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#401D1A]/10 dark:bg-[#E4E0D3]/20 text-[#401D1A] dark:text-[#E4E0D3] text-xs font-semibold border border-[#401D1A]/20 dark:border-[#E4E0D3]/30">
            <Chrome className="w-3.5 h-3.5" />
            <span>ThumbVault Chrome Extension (Manifest V3)</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-[#401D1A] dark:text-[#FFFFFF]">
            1-Click YouTube Thumbnail Grabber
          </h1>
          <p className="text-sm text-[#401D1A]/70 dark:text-[#E4E0D3]/70 max-w-2xl leading-relaxed">
            Browse YouTube as normal. Whenever you spot a thumbnail that converts or inspires you, click the ThumbVault extension button to extract its maximum resolution (HD) asset and send it straight into your inspiration gallery with auto-tags.
          </p>
        </div>

        {/* Installation Steps Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          
          <div className="bg-[#FFFFFF] dark:bg-[#401D1A] p-5 rounded-2xl border border-[#401D1A]/15 dark:border-[#E4E0D3]/20 shadow-md space-y-3">
            <div className="w-8 h-8 rounded-xl bg-[#401D1A]/10 dark:bg-[#E4E0D3]/20 text-[#401D1A] dark:text-[#E4E0D3] font-bold text-sm flex items-center justify-center border border-[#401D1A]/20 dark:border-[#E4E0D3]/30">
              1
            </div>
            <h3 className="font-bold text-sm text-[#401D1A] dark:text-[#FFFFFF]">Open Chrome Extensions</h3>
            <p className="text-xs text-[#401D1A]/70 dark:text-[#E4E0D3]/70 leading-relaxed">
              Open Google Chrome (or Brave / Edge) and navigate to <code className="text-[#401D1A] dark:text-[#E4E0D3] bg-[#E4E0D3]/50 dark:bg-[#FFFFFF]/10 px-1 py-0.5 rounded font-mono">chrome://extensions</code> in your address bar.
            </p>
          </div>

          <div className="bg-[#FFFFFF] dark:bg-[#401D1A] p-5 rounded-2xl border border-[#401D1A]/15 dark:border-[#E4E0D3]/20 shadow-md space-y-3">
            <div className="w-8 h-8 rounded-xl bg-[#401D1A]/10 dark:bg-[#E4E0D3]/20 text-[#401D1A] dark:text-[#E4E0D3] font-bold text-sm flex items-center justify-center border border-[#401D1A]/20 dark:border-[#E4E0D3]/30">
              2
            </div>
            <h3 className="font-bold text-sm text-[#401D1A] dark:text-[#FFFFFF]">Enable Developer Mode</h3>
            <p className="text-xs text-[#401D1A]/70 dark:text-[#E4E0D3]/70 leading-relaxed">
              Toggle the <strong>&quot;Developer mode&quot;</strong> switch located in the top-right corner of the Extensions page.
            </p>
          </div>

          <div className="bg-[#FFFFFF] dark:bg-[#401D1A] p-5 rounded-2xl border border-[#401D1A]/15 dark:border-[#E4E0D3]/20 shadow-md space-y-3">
            <div className="w-8 h-8 rounded-xl bg-[#401D1A]/10 dark:bg-[#E4E0D3]/20 text-[#401D1A] dark:text-[#E4E0D3] font-bold text-sm flex items-center justify-center border border-[#401D1A]/20 dark:border-[#E4E0D3]/30">
              3
            </div>
            <h3 className="font-bold text-sm text-[#401D1A] dark:text-[#FFFFFF]">Load Unpacked</h3>
            <p className="text-xs text-[#401D1A]/70 dark:text-[#E4E0D3]/70 leading-relaxed">
              Click the <strong>&quot;Load unpacked&quot;</strong> button and select the <code className="text-[#401D1A] dark:text-[#E4E0D3] bg-[#E4E0D3]/50 dark:bg-[#FFFFFF]/10 px-1 py-0.5 rounded font-mono">extension</code> folder from this project.
            </p>
          </div>

        </div>

        {/* Extension Directory Path Box */}
        <div className="bg-[#FFFFFF] dark:bg-[#401D1A] p-6 rounded-2xl border border-[#401D1A]/15 dark:border-[#E4E0D3]/20 shadow-md space-y-3">
          <h3 className="text-sm font-bold text-[#401D1A] dark:text-[#FFFFFF] flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#401D1A] dark:text-[#E4E0D3]" />
            Your Local Extension Folder Path
          </h3>
          <p className="text-xs text-[#401D1A]/70 dark:text-[#E4E0D3]/70">
            Copy this folder path and paste it into the folder picker when clicking &quot;Load unpacked&quot; in Chrome:
          </p>

          <div className="flex items-center gap-2 p-3 bg-[#E4E0D3]/30 dark:bg-[#401D1A] border border-[#401D1A]/15 dark:border-[#E4E0D3]/20 rounded-xl">
            <code className="text-xs text-[#401D1A] dark:text-[#E4E0D3] font-mono flex-1 truncate">
              {extensionFolderPath}
            </code>
            <button
              onClick={copyPath}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#401D1A] dark:bg-[#E4E0D3] dark:text-[#401D1A] hover:opacity-90 text-[#FFFFFF] flex items-center gap-1 transition-colors"
            >
              {copiedPath ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Copied!</span>
                </>
              ) : (
                <span>Copy Path</span>
              )}
            </button>
          </div>
        </div>

        {/* How It Works Visual Flow */}
        <div className="bg-[#FFFFFF] dark:bg-[#401D1A] p-6 rounded-2xl border border-[#401D1A]/15 dark:border-[#E4E0D3]/20 shadow-md space-y-4">
          <h3 className="text-sm font-bold text-[#401D1A] dark:text-[#FFFFFF] flex items-center gap-2">
            <Zap className="w-4 h-4 text-[#401D1A] dark:text-[#E4E0D3]" />
            How to Grab Thumbnails in 1-Click
          </h3>

          <div className="space-y-3 text-xs text-[#401D1A]/80 dark:text-[#E4E0D3]/80">
            <div className="flex items-start gap-3 p-3 bg-[#E4E0D3]/20 dark:bg-[#401D1A] rounded-xl border border-[#401D1A]/10 dark:border-[#E4E0D3]/15">
              <span className="w-5 h-5 rounded-full bg-[#401D1A]/10 dark:bg-[#E4E0D3]/20 text-[#401D1A] dark:text-[#E4E0D3] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">A</span>
              <div>
                <strong className="text-[#401D1A] dark:text-[#FFFFFF] block">Visit any YouTube video:</strong>
                Navigate to any YouTube video watch page (e.g., <code className="text-[#401D1A] dark:text-[#E4E0D3]">youtube.com/watch?v=...</code>).
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-[#E4E0D3]/20 dark:bg-[#401D1A] rounded-xl border border-[#401D1A]/10 dark:border-[#E4E0D3]/15">
              <span className="w-5 h-5 rounded-full bg-[#401D1A]/10 dark:bg-[#E4E0D3]/20 text-[#401D1A] dark:text-[#E4E0D3] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">B</span>
              <div>
                <strong className="text-[#401D1A] dark:text-[#FFFFFF] block">Click the ThumbVault icon in your browser toolbar:</strong>
                The popup will instantly extract the HD thumbnail, YouTube channel name, and video title.
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-[#E4E0D3]/20 dark:bg-[#401D1A] rounded-xl border border-[#401D1A]/10 dark:border-[#E4E0D3]/15">
              <span className="w-5 h-5 rounded-full bg-[#401D1A]/10 dark:bg-[#E4E0D3]/20 text-[#401D1A] dark:text-[#E4E0D3] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">C</span>
              <div>
                <strong className="text-[#401D1A] dark:text-[#FFFFFF] block">Click &quot;Send to ThumbVault&quot;:</strong>
                It immediately sends the thumbnail to your local/cloud inspiration vault and auto-tags it with AI!
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
