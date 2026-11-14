'use client';

import React, { useEffect } from 'react';
import { RotateCcw } from 'lucide-react';

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    const isChunkError =
      error?.name === 'ChunkLoadError' ||
      /Loading chunk .* failed/i.test(error?.message || '');

    if (isChunkError && typeof window !== 'undefined') {
      const key = 'thumbfeed_chunk_reload_attempted';
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, '1');
        window.location.reload();
      }
    }
  }, [error]);

  return (
    <div className="min-h-screen bg-[#090a0d] text-white flex items-center justify-center p-6">
      <div className="max-w-sm w-full rounded-2xl border border-white/10 bg-[#0f1117] p-6 text-center space-y-4 shadow-2xl">
        <h2 className="text-sm font-semibold text-white">Something went wrong</h2>
        <p className="text-xs text-white/55">
          {error?.message || 'An unexpected client error occurred while rendering this view.'}
        </p>
        <div className="flex items-center justify-center gap-2 pt-1">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-xs font-medium text-white transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Try again</span>
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-3.5 py-2 rounded-lg bg-white text-black hover:bg-white/90 text-xs font-semibold transition-colors"
          >
            Reload page
          </button>
        </div>
      </div>
    </div>
  );
}
