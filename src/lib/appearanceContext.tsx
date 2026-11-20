'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import {
  AppearanceSettings,
  DEFAULT_APPEARANCE,
  GlassStyleId,
  computeGlassCssVariables,
  getGlassStylePresetById,
  loadAppearanceSettings,
  sanitizeAppearanceSettings,
  saveAppearanceSettings,
} from './appearance';

interface AppearanceContextValue {
  settings: AppearanceSettings;
  hydrated: boolean;
  updateSettings: (partial: Partial<AppearanceSettings>) => void;
  selectGlassStyle: (style: GlassStyleId) => void;
  resetAppearance: () => void;
  isAppearanceOpen: boolean;
  setIsAppearanceOpen: (open: boolean) => void;
  storageWarning: string | null;
  clearStorageWarning: () => void;
}

const AppearanceContext = createContext<AppearanceContextValue | null>(null);

function applyCssVariablesToRoot(settings: AppearanceSettings) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const vars = computeGlassCssVariables(settings);
  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(key, value);
  }
  root.setAttribute('data-glass-style', settings.style);
}

export function AppearanceProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppearanceSettings>(DEFAULT_APPEARANCE);
  const [hydrated, setHydrated] = useState(false);
  const [isAppearanceOpen, setIsAppearanceOpen] = useState(false);
  const [storageWarning, setStorageWarning] = useState<string | null>(null);

  // Hydrate saved appearance on mount
  useEffect(() => {
    const loaded = loadAppearanceSettings();
    setSettings(loaded);
    applyCssVariablesToRoot(loaded);
    setHydrated(true);
  }, []);

  // Re-apply CSS custom properties whenever settings change
  useEffect(() => {
    applyCssVariablesToRoot(settings);
  }, [settings]);

  const commit = useCallback((next: AppearanceSettings) => {
    const clean = sanitizeAppearanceSettings(next);
    setSettings(clean);
    const res = saveAppearanceSettings(clean);
    if (!res.ok && res.error) {
      setStorageWarning(res.error);
    } else {
      setStorageWarning(null);
    }
  }, []);

  const updateSettings = useCallback(
    (partial: Partial<AppearanceSettings>) => {
      setSettings((prev) => {
        const clean = sanitizeAppearanceSettings({ ...prev, ...partial });
        const res = saveAppearanceSettings(clean);
        if (!res.ok && res.error) {
          setStorageWarning(res.error);
        } else {
          setStorageWarning(null);
        }
        return clean;
      });
    },
    []
  );

  const selectGlassStyle = useCallback(
    (style: GlassStyleId) => {
      const preset = getGlassStylePresetById(style);
      setSettings((prev) => {
        const clean = sanitizeAppearanceSettings({
          ...prev,
          style,
          glassBlur: preset.defaultBlur,
          glassOpacity: preset.defaultOpacity,
          bgDim: preset.defaultDim,
        });
        const res = saveAppearanceSettings(clean);
        if (!res.ok && res.error) {
          setStorageWarning(res.error);
        } else {
          setStorageWarning(null);
        }
        return clean;
      });
    },
    []
  );

  const resetAppearance = useCallback(() => {
    commit({ ...DEFAULT_APPEARANCE });
  }, [commit]);

  const clearStorageWarning = useCallback(() => setStorageWarning(null), []);

  const value = useMemo<AppearanceContextValue>(
    () => ({
      settings,
      hydrated,
      updateSettings,
      selectGlassStyle,
      resetAppearance,
      isAppearanceOpen,
      setIsAppearanceOpen,
      storageWarning,
      clearStorageWarning,
    }),
    [
      settings,
      hydrated,
      updateSettings,
      selectGlassStyle,
      resetAppearance,
      isAppearanceOpen,
      storageWarning,
      clearStorageWarning,
    ]
  );

  return (
    <AppearanceContext.Provider value={value}>
      {children}
    </AppearanceContext.Provider>
  );
}

export function useAppearance(): AppearanceContextValue {
  const ctx = useContext(AppearanceContext);
  if (!ctx) {
    throw new Error('useAppearance must be used inside AppearanceProvider');
  }
  return ctx;
}
