'use client';

import React, { useEffect, useState } from 'react';
import { getInitialTheme, applyTheme, subscribeTheme, ThemeMode } from '../lib/theme';
import { SlateChipSwitch } from './buttons/slate-chip-switch';

interface ThemeToggleProps {
  className?: string;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ className = '' }) => {
  const [theme, setTheme] = useState<ThemeMode>('dark');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setTheme(getInitialTheme());
    return subscribeTheme((next) => {
      setTheme(next);
    });
  }, []);

  // Single state path: applyTheme notifies subscribers synchronously, which
  // drives setTheme. Setting state here as well caused a second render pass
  // on every toggle.
  const handleToggle = (isDark: boolean) => {
    applyTheme(isDark ? 'dark' : 'light');
  };

  if (!mounted) {
    return (
      <div
        aria-hidden="true"
        className={`h-[30px] w-[58px] rounded-full border border-line bg-surface-raised ${className}`}
      />
    );
  }

  return (
    <SlateChipSwitch
      id="theme-toggle-btn"
      checked={theme === 'dark'}
      onCheckedChange={handleToggle}
      label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      className={`text-[16px] sm:text-[17px] ${className}`}
      showIcons={true}
    />
  );
};

export default ThemeToggle;
