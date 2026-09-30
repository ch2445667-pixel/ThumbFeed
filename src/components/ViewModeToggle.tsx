'use client';

import React from 'react';
import { LayoutGrid, Images } from 'lucide-react';

interface ViewModeToggleProps {
  isDetail: boolean;
  onToggle: () => void;
  className?: string;
}

export const ViewModeToggle: React.FC<ViewModeToggleProps> = ({
  isDetail,
  onToggle,
  className = '',
}) => {
  return (
    <div
      role="group"
      aria-label="Thumbnail display mode"
      className={`inline-flex items-center gap-0.5 rounded-lg border border-line bg-surface p-0.5 shadow-card ${className}`}
    >
      <button
        type="button"
        onClick={() => {
          if (!isDetail) onToggle();
        }}
        aria-pressed={isDetail}
        className={`flex items-center gap-1.5 rounded-sm px-2.5 py-1.5 text-xs font-medium transition-colors duration-200 ${
          isDetail
            ? 'bg-accent text-accent-on'
            : 'text-ink-muted hover:bg-surface-raised hover:text-ink'
        }`}
      >
        <LayoutGrid className="h-3.5 w-3.5" strokeWidth={1.75} />
        <span>Detail</span>
      </button>

      <button
        type="button"
        onClick={() => {
          if (isDetail) onToggle();
        }}
        aria-pressed={!isDetail}
        className={`flex items-center gap-1.5 rounded-sm px-2.5 py-1.5 text-xs font-medium transition-colors duration-200 ${
          !isDetail
            ? 'bg-accent text-accent-on'
            : 'text-ink-muted hover:bg-surface-raised hover:text-ink'
        }`}
      >
        <Images className="h-3.5 w-3.5" strokeWidth={1.75} />
        <span>Gallery</span>
      </button>
    </div>
  );
};

export default ViewModeToggle;
