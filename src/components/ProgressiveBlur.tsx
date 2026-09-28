'use client';

import React from 'react';

interface ProgressiveBlurProps {
  direction?: 'top' | 'bottom';
  className?: string;
  height?: string;
  zIndex?: number;
  maxBlur?: number;
}

/**
 * Progressive Blur component based on multi-layered backdrop-filter
 * with progressive gradient masks, inspired by native iOS and expo-backdrop.
 * Provides a clean, subtle optical blur falloff without any muddy color overlay.
 */
export const ProgressiveBlur: React.FC<ProgressiveBlurProps> = ({
  direction = 'bottom',
  className = '',
  height = 'h-16 sm:h-20',
  zIndex = 25,
  maxBlur = 10,
}) => {
  // Soft, reduced blur progression curve
  const blurRatios = [0.08, 0.16, 0.28, 0.42, 0.58, 0.74, 0.88, 1.0];
  const masks = [
    [0, 15, 28, 42],
    [15, 28, 42, 55],
    [28, 42, 55, 68],
    [42, 55, 68, 80],
    [55, 68, 80, 90],
    [68, 80, 90, 100],
    [80, 90, 100, 100],
    [90, 100, 100, 100],
  ];

  const layers = blurRatios.map((ratio, i) => ({
    blur: Math.max(0.5, Number((ratio * maxBlur).toFixed(1))),
    mask: masks[i],
  }));

  const dir = direction === 'top' ? 'to top' : 'to bottom';

  return (
    <div
      aria-hidden="true"
      style={{ zIndex }}
      className={`pointer-events-none fixed inset-x-0 ${
        direction === 'top' ? 'top-0' : 'bottom-0'
      } ${height} select-none overflow-hidden ${className}`}
    >
      {layers.map((layer, index) => {
        const [p1, p2, p3, p4] = layer.mask;
        const maskGradient =
          p3 === p4
            ? `linear-gradient(${dir}, rgba(0, 0, 0, 0) ${p1}%, rgba(0, 0, 0, 1) ${p2}%, rgba(0, 0, 0, 1) ${p3}%)`
            : `linear-gradient(${dir}, rgba(0, 0, 0, 0) ${p1}%, rgba(0, 0, 0, 1) ${p2}%, rgba(0, 0, 0, 1) ${p3}%, rgba(0, 0, 0, 0) ${p4}%)`;

        return (
          <div
            key={index}
            className="absolute inset-0 pointer-events-none"
            style={{
              backdropFilter: `blur(${layer.blur}px)`,
              WebkitBackdropFilter: `blur(${layer.blur}px)`,
              maskImage: maskGradient,
              WebkitMaskImage: maskGradient,
            }}
          />
        );
      })}
    </div>
  );
};

export default ProgressiveBlur;
