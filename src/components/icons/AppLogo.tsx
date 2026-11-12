'use client';

import React from 'react';

interface AppLogoProps {
  className?: string;
  size?: number;
}

export function AppLogo({ className = 'w-6 h-6', size }: AppLogoProps) {
  const style = size ? { width: `${size}px`, height: `${size}px` } : undefined;

  return (
    <img
      src="/logo-transparent.svg"
      alt="ThumbFeed"
      className={`object-contain select-none pointer-events-none ${className}`}
      style={style}
      draggable={false}
    />
  );
}
