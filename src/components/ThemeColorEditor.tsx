'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, RotateCcw, Palette } from 'lucide-react';
import { getInitialTheme, subscribeTheme, ThemeMode } from '../lib/theme';
import {
  MAIN_TOKENS,
  ThemeOverrides,
  getOverrides,
  isValidHex,
  setOverride,
  clearOverride,
  clearAllOverrides,
  applyOverrides,
  hasAnyOverride,
} from '../lib/themeColors';

/**
 * Shown when a token has no user override. These mirror globals.css; they are
 * only display values -- clearing an override always falls back to the
 * stylesheet, never to a hardcoded value here.
 */
const FALLBACK: Record<ThemeMode, Record<string, string>> = {
  light: {
    canvas: '#E6E8EC',
    surface: '#D8DBE0',
    'surface-raised': '#EFF1F4',
    ink: '#0d0e10',
    accent: '#0d0e10',
    'on-accent': '#E6E8EC',
    line: '#0d0e10',
    danger: '#0d0e10',
    stage: '#0d0e10',
  },
  dark: {
    canvas: '#0d0e10',
    surface: '#121316',
    'surface-raised': '#1c1d22',
    ink: '#E6E8EC',
    accent: '#1c1d22',
    'on-accent': '#E6E8EC',
    line: '#E6E8EC',
    danger: '#1c1d22',
    stage: '#060607',
  },
};

export const ThemeColorEditor: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<ThemeMode>('dark');
  const [overrides, setOverridesState] = useState<ThemeOverrides>({ light: {}, dark: {} });
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setMode(getInitialTheme());
    setOverridesState(getOverrides());
    return subscribeTheme(setMode);
  }, []);

  useEffect(() => {
    applyOverrides(overrides);
  }, [overrides]);

  // Escape closes the panel.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const commit = (token: string) => {
    const raw = (drafts[token] ?? '').trim();
    setDrafts((d) => {
      const { [token]: _drop, ...rest } = d;
      return rest;
    });
    if (!raw) {
      clearOverride(mode, token);
    } else if (isValidHex(raw)) {
      setOverride(mode, token, raw);
    } else {
      return; // keep the rejected draft on screen so it can be corrected
    }
    setOverridesState(getOverrides());
  };

  const edit = (token: string, value: string) => {
    setDrafts((d) => ({ ...d, [token]: value }));
  };

  const resetToken = (token: string) => {
    clearOverride(mode, token);
    setOverridesState(getOverrides());
  };

  if (!mounted) return null;

  const current = mode === 'dark' ? overrides.dark : overrides.light;
  const fallback = FALLBACK[mode];
  const dirty = hasAnyOverride(overrides);

  const panel = (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Theme colours"
        className="relative z-10 w-full max-w-sm overflow-hidden rounded-lg border border-line bg-surface shadow-elevated"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
          <h2 className="text-xs font-bold text-ink">Theme colours</h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close"
            className="grid h-7 w-7 place-items-center rounded-md text-ink-faint transition-colors hover:bg-surface-raised hover:text-ink"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Light / dark switch */}
        <div className="flex items-center gap-1 px-4 py-2">
          {(['light', 'dark'] as ThemeMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${
                mode === m
                  ? 'bg-accent text-accent-on'
                  : 'bg-surface-raised text-ink-muted hover:text-ink'
              }`}
            >
              {m}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              clearAllOverrides();
              setOverridesState(getOverrides());
              setDrafts({});
            }}
            disabled={!dirty}
            title="Reset to default colours"
            aria-label="Reset to default colours"
            className="ml-1 grid h-8 w-8 shrink-0 place-items-center rounded-md text-ink-faint transition-colors hover:bg-surface-raised hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Colour rows */}
        <div className="max-h-[46vh] overflow-y-auto px-4 pb-4">
          {MAIN_TOKENS.map((token) => {
            const isDirty = Boolean(current[token.key]);
            const draft = drafts[token.key];
            const value = draft ?? current[token.key] ?? fallback[token.key] ?? '#000000';
            const invalid = Boolean(draft) && !isValidHex(draft);
            return (
              <div
                key={token.key}
                className="flex items-center gap-2 border-t border-line py-2 first:border-t-0"
              >
                <span
                  aria-hidden="true"
                  className="h-5 w-5 shrink-0 rounded-sm border border-line"
                  style={{ backgroundColor: current[token.key] ?? fallback[token.key] }}
                />

                <label
                  htmlFor={`token-${mode}-${token.key}`}
                  className="w-[86px] shrink-0 truncate text-xs text-ink-muted"
                >
                  {token.label}
                </label>

                <input
                  id={`token-${mode}-${token.key}`}
                  type="text"
                  spellCheck={false}
                  value={value}
                  onChange={(e) => edit(token.key, e.target.value)}
                  onBlur={() => commit(token.key)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                  }}
                  className={`mono min-w-0 flex-1 rounded-md border bg-surface-raised px-2 py-1 text-xs text-ink outline-none transition-colors focus:border-accent ${
                    invalid ? 'border-danger' : 'border-line'
                  }`}
                />

                <span className="w-4 shrink-0 text-center">
                  {isDirty && (
                    <button
                      type="button"
                      onClick={() => resetToken(token.key)}
                      aria-label={`Reset ${token.label}`}
                      title="Reset"
                      className="text-ink-faint transition-colors hover:text-ink"
                    >
                      <RotateCcw className="h-3 w-3" />
                    </button>
                  )}
                </span>
              </div>
            );
          })}
          {Object.values(drafts).some((d) => !isValidHex(d || '')) && (
            <p className="border-t border-line pt-2 text-[11px] text-danger">
              Use a hex code like #411C1A
            </p>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      <button
        type="button"
        id="theme-color-editor-btn"
        onClick={() => setOpen((v) => !v)}
        title="Theme colours"
        aria-label="Theme colours"
        className="grid h-[30px] w-[30px] place-items-center rounded-full border border-line bg-surface-raised text-ink transition-colors hover:bg-surface"
      >
        <Palette className="w-4 h-4" />
      </button>

      {/* Portal: TopBar is a transformed ancestor, which would otherwise
          become the containing block for a position:fixed panel. */}
      {open && typeof document !== 'undefined' && createPortal(panel, document.body)}
    </>
  );
};

export default ThemeColorEditor;