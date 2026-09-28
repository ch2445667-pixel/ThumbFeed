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

  const handleToggle = (isDark: boolean) => {
    const nextTheme: ThemeMode = isDark ? 'dark' : 'light';
    applyTheme(nextTheme);
    setTheme(nextTheme);
  };

  if (!mounted) {
    return (
      <div className={`h-8 w-14 rounded-full bg-black/5 dark:bg-white/10 animate-pulse ${className}`} />
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
