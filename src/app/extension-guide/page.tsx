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
    <div className="min-h-screen bg-background text-gray-100 p-4 sm:p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Navigation */}
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm font-medium text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Inspiration Gallery</span>
          </Link>
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-red-500/10 text-rose-400 border border-rose-500/20 flex items-center gap-1.5">
            <Youtube className="w-3.5 h-3.5" /> 1-Click YouTube Grabber
          </span>
        </div>

        {/* Hero Header */}
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-400 text-xs font-semibold border border-indigo-500/20">
            <Chrome className="w-3.5 h-3.5" />
            <span>ThumbVault Chrome Extension (Manifest V3)</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white">
            1-Click YouTube Thumbnail Grabber
          </h1>
          <p className="text-sm text-gray-400 max-w-2xl leading-relaxed">
            Browse YouTube as normal. Whenever you spot a thumbnail that converts or inspires you, click the ThumbVault extension button to extract its maximum resolution (HD) asset and send it straight into your inspiration gallery with auto-tags.
          </p>
        </div>

        {/* Installation Steps Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          
          <div className="glass-panel p-5 rounded-2xl border border-border space-y-3">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 font-bold text-sm flex items-center justify-center border border-indigo-500/30">
              1
            </div>
            <h3 className="font-bold text-sm text-white">Open Chrome Extensions</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              Open Google Chrome (or Brave / Edge) and navigate to <code className="text-indigo-300 bg-black/40 px-1 py-0.5 rounded">chrome://extensions</code> in your address bar.
            </p>
          </div>

          <div className="glass-panel p-5 rounded-2xl border border-border space-y-3">
            <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 font-bold text-sm flex items-center justify-center border border-purple-500/30">
              2
            </div>
            <h3 className="font-bold text-sm text-white">Enable Developer Mode</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              Toggle the <strong>&quot;Developer mode&quot;</strong> switch located in the top-right corner of the Extensions page.
            </p>
          </div>

          <div className="glass-panel p-5 rounded-2xl border border-border space-y-3">
            <div className="w-8 h-8 rounded-xl bg-pink-500/20 text-pink-400 font-bold text-sm flex items-center justify-center border border-pink-500/30">
              3
            </div>
            <h3 className="font-bold text-sm text-white">Load Unpacked</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              Click the <strong>&quot;Load unpacked&quot;</strong> button and select the <code className="text-indigo-300 bg-black/40 px-1 py-0.5 rounded">extension</code> folder from this project.
            </p>
          </div>

        </div>

        {/* Extension Directory Path Box */}
        <div className="glass-panel p-6 rounded-2xl border border-border space-y-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            Your Local Extension Folder Path
          </h3>
          <p className="text-xs text-gray-400">
            Copy this folder path and paste it into the folder picker when clicking &quot;Load unpacked&quot; in Chrome:
          </p>

          <div className="flex items-center gap-2 p-3 bg-background border border-border rounded-xl">
            <code className="text-xs text-indigo-300 font-mono flex-1 truncate">
              {extensionFolderPath}
            </code>
            <button
              onClick={copyPath}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-1 transition-colors"
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
        <div className="glass-panel p-6 rounded-2xl border border-border space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" />
            How to Grab Thumbnails in 1-Click
          </h3>

          <div className="space-y-3 text-xs text-gray-300">
            <div className="flex items-start gap-3 p-3 bg-surface rounded-xl border border-border/50">
              <span className="w-5 h-5 rounded-full bg-red-500/20 text-red-400 font-bold flex items-center justify-center flex-shrink-0 mt-0.5">A</span>
              <div>
                <strong className="text-white block">Visit any YouTube video:</strong>
                Navigate to any YouTube video watch page (e.g., <code className="text-indigo-300">youtube.com/watch?v=...</code>).
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-surface rounded-xl border border-border/50">
              <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 font-bold flex items-center justify-center flex-shrink-0 mt-0.5">B</span>
              <div>
                <strong className="text-white block">Click the ThumbVault icon in your browser toolbar:</strong>
                The popup will instantly extract the HD thumbnail, YouTube channel name, and video title.
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-surface rounded-xl border border-border/50">
              <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center flex-shrink-0 mt-0.5">C</span>
              <div>
                <strong className="text-white block">Click &quot;Send to ThumbVault&quot;:</strong>
                It immediately sends the thumbnail to your local/cloud inspiration vault and auto-tags it with AI!
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
