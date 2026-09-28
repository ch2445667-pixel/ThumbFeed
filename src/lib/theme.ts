/**
 * Theme Manager for Light / Dark Mode
 * Controls HTML document class and persists user preference in localStorage.
 */

export type ThemeMode = 'light' | 'dark';

const THEME_STORAGE_KEY = 'thumbfeed_theme';
type ThemeListener = (theme: ThemeMode) => void;
const listeners = new Set<ThemeListener>();

export function getInitialTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'dark';
  
  const saved = localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode | null;
  if (saved === 'light' || saved === 'dark') {
    return saved;
  }
  
  // Default to pure black dark mode
  return 'dark';
}

export function applyTheme(theme: ThemeMode): void {
  if (typeof document === 'undefined') return;
  
  const root = document.documentElement;
  
  // Enable smooth unified transition for color and background properties
  root.classList.add('theme-transition');

  if (theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
  
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // localStorage might be unavailable in private browsing
  }
  
  listeners.forEach(fn => fn(theme));

  // Remove transition class after completion so interactions stay instantaneous
  window.setTimeout(() => {
    root.classList.remove('theme-transition');
  }, 260);
}

export function toggleTheme(): ThemeMode {
  const current = typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
    ? 'dark'
    : 'light';
  const next: ThemeMode = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  return next;
}

export function subscribeTheme(listener: ThemeListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
