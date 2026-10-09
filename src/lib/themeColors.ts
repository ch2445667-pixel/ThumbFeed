/**
 * Runtime theme colour overrides.
 *
 * globals.css defines every colour token once. This module lets a user
 * override the main ones per theme (light / dark) by typing a hex code,
 * without editing CSS.
 *
 * Overrides are written as a <style id="theme-overrides"> block appended to
 * document.head. The panel itself is rendered through a portal, so this
 * block cannot be affected by a transformed ancestor either.
 *
 * Storage: localStorage, key `thumbfeed_theme_overrides`.
 */

'use client';

import { ThemeMode } from './theme';

export interface ThemeOverrides {
  light: Record<string, string>;
  dark: Record<string, string>;
}

const STORAGE_KEY = 'thumbfeed_theme_overrides';
export const STYLE_ID = 'theme-overrides';

/**
 * The colours the UI exposes. Deliberately short: these are the ones that
 * define the look. The finer tokens (ink-2, line-2, the danger ramps) stay
 * in globals.css and are derived by the stylesheet, so changing a main colour
 * keeps a coherent palette instead of leaving half the UI stale.
 */
export const MAIN_TOKENS: Array<{ key: string; label: string }> = [
  { key: 'canvas', label: 'Background' },
  { key: 'surface', label: 'Cards' },
  { key: 'surface-raised', label: 'Inputs & buttons' },
  { key: 'ink', label: 'Text' },
  { key: 'accent', label: 'Accent' },
  { key: 'on-accent', label: 'Text on accent' },
  { key: 'line', label: 'Borders' },
  { key: 'danger', label: 'Danger' },
  { key: 'stage', label: 'Image backdrop' },
];

/**
 * Every token the override loader will accept. Wider than MAIN_TOKENS so a
 * value saved by an older/other build is preserved rather than silently
 * dropped on load.
 */
const ALL_TOKEN_KEYS = [
  ...MAIN_TOKENS.map((t) => t.key),
  'surface-sunken',
  'ink-2',
  'ink-3',
  'accent-hover',
  'focus',
  'danger-soft',
  'danger-line',
  'on-danger',
];

const VALID_KEYS = new Set(ALL_TOKEN_KEYS);

/** Accepts #rgb and #rrggbb only. */
export function isValidHex(value: string): boolean {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim());
}

function cleanMode(mode: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (mode && typeof mode === 'object') {
    for (const [k, v] of Object.entries(mode as Record<string, unknown>)) {
      if (VALID_KEYS.has(k) && typeof v === 'string' && isValidHex(v)) {
        out[k] = v.trim();
      }
    }
  }
  return out;
}

export function getOverrides(): ThemeOverrides {
  if (typeof window === 'undefined') return { light: {}, dark: {} };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { light: {}, dark: {} };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return { light: {}, dark: {} };
    return { light: cleanMode(parsed.light), dark: cleanMode(parsed.dark) };
  } catch {
    return { light: {}, dark: {} };
  }
}

function saveOverrides(next: ThemeOverrides) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* private browsing / quota: overrides last for this session only */
  }
}

function buildCss(overrides: ThemeOverrides): string {
  const parts: string[] = [];
  if (Object.keys(overrides.light).length) {
    const body = Object.entries(overrides.light)
      .map(([k, v]) => `--${k}:${v};`)
      .join('');
    parts.push(`:root{${body}}`);
  }
  if (Object.keys(overrides.dark).length) {
    const body = Object.entries(overrides.dark)
      .map(([k, v]) => `--${k}:${v};`)
      .join('');
    parts.push(`.dark{${body}}`);
  }
  return parts.join('\n');
}

/** Rewrites the override block for both themes. Safe to call any time. */
export function applyOverrides(overrides: ThemeOverrides = getOverrides()) {
  if (typeof document === 'undefined') return;
  let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement('style');
    el.id = STYLE_ID;
    document.head.appendChild(el);
  }
  el.textContent = buildCss(overrides);
}

export function setOverride(mode: ThemeMode, token: string, value: string) {
  if (!VALID_KEYS.has(token)) return;
  if (!isValidHex(value)) return;
  const next = getOverrides();
  next[mode][token] = value.trim();
  saveOverrides(next);
  applyOverrides(next);
}

export function clearOverride(mode: ThemeMode, token: string) {
  const next = getOverrides();
  delete next[mode][token];
  saveOverrides(next);
  applyOverrides(next);
}

export function clearAllOverrides() {
  saveOverrides({ light: {}, dark: {} });
  applyOverrides({ light: {}, dark: {} });
}

export function hasAnyOverride(overrides: ThemeOverrides): boolean {
  return (
    Object.keys(overrides.light).length > 0 ||
    Object.keys(overrides.dark).length > 0
  );
}