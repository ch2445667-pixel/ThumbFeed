'use client';

import React from 'react';

interface AppLogoProps {
  className?: string;
  size?: number;
}

export function AppLogo({ className = 'w-7 h-7', size }: AppLogoProps) {
  const style = size ? { width: `${size}px`, height: `${size}px` } : undefined;

  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src="/logo-transparent.svg"
      alt="ThumbFeed"
      className={`object-contain select-none pointer-events-none shrink-0 ${className}`}
      style={style}
      draggable={false}
    />
  );
}
