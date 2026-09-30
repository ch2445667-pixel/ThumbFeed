/**
 * Theme Manager for Light / Dark Mode
 * Controls HTML document class and persists user preference in localStorage.
 */

export type ThemeMode = 'light' | 'dark';

const THEME_STORAGE_KEY = 'thumbfeed_theme';
type ThemeListener = (theme: ThemeMode) => void;
const listeners = new Set<ThemeListener>();

type ViewTransition = { finished: Promise<void>; skipTransition?: () => void };
let activeTransition: ViewTransition | null = null;

// Epoch guard so a stale transition settling (or its safety timeout) cannot
// lift transition suppression out from under a newer swap.
let swapEpoch = 0;

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
  const epoch = ++swapEpoch;
  const release = () => {
    if (epoch === swapEpoch) {
      root.classList.remove('vt-theme-swap');
    }
  };

  // Suppress page transitions while the theme commits (see .vt-theme-swap in
  // globals.css). The class is added first inside commit so the ordering holds
  // no matter when the browser invokes the callback.
  const commit = () => {
    root.classList.add('vt-theme-swap');
    root.classList.toggle('dark', theme === 'dark');
  };

  const reduced =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Avoids animating while a previous transition is still running, which
  // would otherwise queue a second snapshot and visibly stutter.
  if (activeTransition?.skipTransition) {
    try {
      activeTransition.skipTransition();
    } catch {
      /* already settled */
    }
  }

  const startVT = (document as Document & {
    startViewTransition?: (cb: () => void) => {
      finished: Promise<void>;
      skipTransition?: () => void;
    };
  }).startViewTransition;

  if (reduced || typeof startVT !== 'function') {
    commit();
    // Next frame: the commit above is fully applied with transitions
    // suppressed. Releasing synchronously in the same task would let them
    // trigger on the same style change.
    requestAnimationFrame(() => release());
  } else {
    // Snapshots are composited once, so the cost does not scale with element
    // count the way per-element colour transitions did.
    try {
      activeTransition = startVT.call(document, commit) ?? null;
      if (activeTransition) {
        activeTransition.finished
          .catch(() => undefined)
          .finally(() => {
            activeTransition = null;
            release();
          });
        // Safety net: never leave transitions suppressed if the promise never
        // settles.
        window.setTimeout(release, 900);
      } else {
        release();
      }
    } catch {
      commit();
      release();
    }
  }

  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // localStorage might be unavailable in private browsing
  }

  listeners.forEach(fn => fn(theme));
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
