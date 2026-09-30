'use client';

import React from 'react';

interface ProgressiveBlurProps {
  direction?: 'top' | 'bottom';
  className?: string;
  height?: string;
  zIndex?: number;
  /** Retained for call-site compatibility. No longer used: the effect is now
   *  a single gradient rather than stacked backdrop filters. */
  maxBlur?: number;
}

/**
 * Soft falloff at the viewport edge.
 *
 * The previous version stacked eight full-width `backdrop-filter: blur()`
 * layers. Because the element is `position: fixed` and sits over scrolling
 * content, the browser had to re-blur the backdrop eight times on every frame
 * of a scroll, which dominated the frame budget and made the grid feel heavy.
 *
 * A single composited gradient is visually near-identical and costs nothing.
 */
export const ProgressiveBlur: React.FC<ProgressiveBlurProps> = ({
  direction = 'bottom',
  className = '',
  height = 'h-14 sm:h-16',
  zIndex = 25,
}) => {
  const isTop = direction === 'top';

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none fixed inset-x-0 ${height} select-none ${className}`}
      style={{
        zIndex,
        top: isTop ? 0 : undefined,
        bottom: isTop ? undefined : 0,
        // Canvas at the very edge, fading to nothing towards the content, so
        // the grid dissolves into the page rather than being covered by a band.
        background: `linear-gradient(to ${isTop ? 'bottom' : 'top'}, var(--canvas) 0%, color-mix(in srgb, var(--canvas) 45%, transparent) 45%, transparent 100%)`,
      }}
    />
  );
};

export default ProgressiveBlur;
