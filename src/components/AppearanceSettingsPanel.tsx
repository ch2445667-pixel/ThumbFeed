'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Upload,
  Link2,
  Trash2,
  Check,
  SlidersHorizontal,
  Image as ImageIcon,
  Loader2,
} from 'lucide-react';
import { useAppearance } from '../lib/appearanceContext';
import {
  GLASS_STYLE_PRESETS,
  WALLPAPER_PRESETS,
  compressBackgroundFile,
  type GlassStyleId,
} from '../lib/appearance';
import { sanitizeSafeImageSrc } from '../lib/urlSafety';

interface GlassAppearanceControlsProps {
  isActive?: boolean;
}

/**
 * Reusable Liquid Glass & Background customization controls rendered inside
 * the unified bottom-sidebar Settings drawer.
 */
export const GlassAppearanceControls: React.FC<GlassAppearanceControlsProps> = ({
  isActive = true,
}) => {
  const {
    settings,
    updateSettings,
    selectGlassStyle,
    storageWarning,
    clearStorageWarning,
  } = useAppearance();

  const [urlInput, setUrlInput] = useState('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isActive) return;
    setUploadError(null);
    if (settings.customBgImage && settings.customBgImage.startsWith('http')) {
      setUrlInput(settings.customBgImage);
    } else {
      setUrlInput('');
    }
  }, [isActive, settings.customBgImage]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setUploadError(null);
    clearStorageWarning();
    setIsProcessingImage(true);
    try {
      const dataUrl = await compressBackgroundFile(file);
      updateSettings({ customBgImage: dataUrl });
      setUrlInput('');
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Failed to load image.');
    } finally {
      setIsProcessingImage(false);
    }
  };

  const handleApplyUrl = (e: React.FormEvent) => {
    e.preventDefault();
    setUploadError(null);
    clearStorageWarning();
    const trimmed = urlInput.trim();
    if (!trimmed) {
      updateSettings({ customBgImage: '' });
      return;
    }
    const safe = sanitizeSafeImageSrc(trimmed);
    if (!safe || (!safe.startsWith('https://') && !safe.startsWith('http://'))) {
      setUploadError('Enter a valid https:// image URL.');
      return;
    }
    updateSettings({ customBgImage: safe });
  };

  const handleRemoveCustomBg = () => {
    setUploadError(null);
    clearStorageWarning();
    setUrlInput('');
    updateSettings({ customBgImage: '' });
  };

  const safeCustomPreview = sanitizeSafeImageSrc(settings.customBgImage);

  return (
    <div className="space-y-6">
      {/* SECTION 1: GLASS STYLE SELECTOR */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-white/55">
            Glass Style
          </h3>
          <span className="text-[11px] font-mono text-white/60">
            {GLASS_STYLE_PRESETS.find((p) => p.id === settings.style)?.name}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {GLASS_STYLE_PRESETS.map((preset, idx) => {
            const isSelected = settings.style === preset.id;
            const isFeatured = idx === 0;
            return (
              <button
                key={preset.id}
                type="button"
                data-testid={`glass-style-${preset.id}`}
                aria-pressed={isSelected}
                onClick={() => selectGlassStyle(preset.id as GlassStyleId)}
                className={`group relative flex flex-col items-start gap-1.5 p-2.5 rounded-[14px] border text-left transition-all cursor-pointer ${
                  isFeatured ? 'col-span-2' : ''
                } ${
                  isSelected
                    ? 'glass-active border-white/40'
                    : 'border-white/[0.10] bg-white/[0.035] hover:bg-white/[0.08] hover:border-white/25'
                }`}
              >
                {/* Mini dual-gradient glass strip over obsidian-to-ember light */}
                <div
                  className="relative w-full h-8 rounded-[9px] overflow-hidden flex items-center justify-between px-2.5"
                  style={{
                    background:
                      'linear-gradient(112deg, #050507 0%, #090506 42%, #7d1814 66%, #e6721c 100%)',
                  }}
                >
                  <div
                    className="w-full h-5 rounded-[7px] flex items-center justify-between px-2"
                    style={{
                      background: preset.previewTint,
                      border: `1px solid ${preset.previewBorder}`,
                      backdropFilter: `blur(${Math.min(14, Math.round(preset.defaultBlur / 2))}px)`,
                      WebkitBackdropFilter: `blur(${Math.min(14, Math.round(preset.defaultBlur / 2))}px)`,
                      boxShadow:
                        'inset 0 1px 0 rgba(255,255,255,0.182), inset 0 -1px 0 rgba(0,0,0,0.35)',
                    }}
                  >
                    <span className="w-2.5 h-2.5 rounded-[4px] bg-white/35" />
                    <span className="w-8 h-1.5 rounded-full bg-white/55" />
                  </div>
                </div>

                <div className="w-full flex items-center justify-between gap-1 pt-0.5">
                  <span className="text-xs font-semibold text-white truncate">
                    {preset.name}
                  </span>
                  {isSelected && (
                    <Check className="w-3.5 h-3.5 text-white shrink-0 stroke-[2.5]" />
                  )}
                </div>
                <p className="text-[10.5px] leading-snug text-white/55 line-clamp-1">
                  {preset.description}
                </p>
              </button>
            );
          })}
        </div>
      </section>

      {/* SECTION 2: BLUR & TRANSLUCENCY SLIDERS */}
      <section className="space-y-3.5 pt-1 border-t border-white/[0.08]">
        <div className="flex items-center gap-1.5 pt-2">
          <SlidersHorizontal className="w-3.5 h-3.5 text-white/60" />
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-white/55">
            Blur &amp; Translucency
          </h3>
        </div>

        {/* Glass Blur */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <label htmlFor="slider-glass-blur" className="text-white/85 font-medium">
              Glass Blur
            </label>
            <span className="font-mono text-[11px] tabular text-white/65">
              {settings.glassBlur}px
            </span>
          </div>
          <input
            id="slider-glass-blur"
            type="range"
            min={0}
            max={48}
            step={1}
            value={settings.glassBlur}
            onChange={(e) => updateSettings({ glassBlur: Number(e.target.value) })}
            className="zoom-range-slider w-full h-1.5 rounded-full bg-white/15 accent-white cursor-pointer"
          />
        </div>

        {/* Glass Opacity / Tint */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <label htmlFor="slider-glass-opacity" className="text-white/85 font-medium">
              Glass Tint &amp; Depth
            </label>
            <span className="font-mono text-[11px] tabular text-white/65">
              {settings.glassOpacity}%
            </span>
          </div>
          <input
            id="slider-glass-opacity"
            type="range"
            min={0}
            max={100}
            step={1}
            value={settings.glassOpacity}
            onChange={(e) => updateSettings({ glassOpacity: Number(e.target.value) })}
            className="zoom-range-slider w-full h-1.5 rounded-full bg-white/15 accent-white cursor-pointer"
          />
        </div>

        {/* Background Softness / Blur */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <label htmlFor="slider-bg-blur" className="text-white/85 font-medium">
              Background Blur
            </label>
            <span className="font-mono text-[11px] tabular text-white/65">
              {settings.bgBlur}px
            </span>
          </div>
          <input
            id="slider-bg-blur"
            type="range"
            min={0}
            max={32}
            step={1}
            value={settings.bgBlur}
            onChange={(e) => updateSettings({ bgBlur: Number(e.target.value) })}
            className="zoom-range-slider w-full h-1.5 rounded-full bg-white/15 accent-white cursor-pointer"
          />
        </div>

        {/* Backdrop Dim */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <label htmlFor="slider-bg-dim" className="text-white/85 font-medium">
              Backdrop Dimming
            </label>
            <span className="font-mono text-[11px] tabular text-white/65">
              {settings.bgDim}%
            </span>
          </div>
          <input
            id="slider-bg-dim"
            type="range"
            min={0}
            max={80}
            step={1}
            value={settings.bgDim}
            onChange={(e) => updateSettings({ bgDim: Number(e.target.value) })}
            className="zoom-range-slider w-full h-1.5 rounded-full bg-white/15 accent-white cursor-pointer"
          />
        </div>
      </section>

      {/* SECTION 3: CUSTOM BACKGROUND IMAGE */}
      <section className="space-y-3 pt-1 border-t border-white/[0.08]">
        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-1.5">
            <ImageIcon className="w-3.5 h-3.5 text-white/60" />
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-white/55">
              Background Image
            </h3>
          </div>

          {safeCustomPreview && (
            <button
              type="button"
              onClick={handleRemoveCustomBg}
              className="inline-flex items-center gap-1 text-[11px] text-white/55 hover:text-red-300 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3 h-3" />
              <span>Remove custom</span>
            </button>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={handleFileChange}
          className="hidden"
        />

        {safeCustomPreview ? (
          <div className="relative rounded-[14px] overflow-hidden border border-white/20 aspect-[16/7] bg-black/40">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={safeCustomPreview}
              alt="Custom background preview"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent flex items-end justify-between p-2.5">
              <span className="text-[11px] font-medium text-white">
                Custom background active
              </span>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessingImage}
                className="px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 backdrop-blur-md border border-white/20 text-[11px] font-medium text-white transition-colors cursor-pointer"
              >
                Replace
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessingImage}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-[12px] border border-dashed border-white/20 hover:border-white/40 bg-white/[0.035] hover:bg-white/[0.08] text-xs font-medium text-white/85 hover:text-white transition-all cursor-pointer disabled:opacity-50"
          >
            {isProcessingImage ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Optimizing image...</span>
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 text-white/75" />
                <span>Upload Background Image (PNG, JPG, WebP)</span>
              </>
            )}
          </button>
        )}

        {/* Direct Image URL Input */}
        <form onSubmit={handleApplyUrl} className="flex items-center gap-1.5">
          <div className="relative flex-1 min-w-0">
            <Link2 className="w-3.5 h-3.5 text-white/40 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="url"
              value={urlInput}
              onChange={(e) => {
                setUrlInput(e.target.value);
                setUploadError(null);
              }}
              placeholder="Or paste https:// image URL..."
              aria-label="Custom background image URL"
              className="w-full pl-8 pr-2.5 py-2 rounded-[10px] glass-input text-xs text-white placeholder:text-white/35 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            className="px-3 py-2 rounded-[10px] bg-white text-black hover:bg-white/90 text-xs font-semibold transition-colors cursor-pointer shrink-0"
          >
            Apply
          </button>
        </form>

        {(uploadError || storageWarning) && (
          <p className="text-[11px] text-red-300 bg-red-500/10 border border-red-500/25 rounded-[10px] px-3 py-2 leading-snug">
            {uploadError || storageWarning}
          </p>
        )}

        {/* Curated Atmospheric Presets */}
        <div className="space-y-2 pt-1">
          <span className="text-[11px] font-medium text-white/55 block">
            Curated Backdrops
          </span>
          <div className="grid grid-cols-2 gap-2">
            {WALLPAPER_PRESETS.map((preset) => {
              const isPresetActive =
                !safeCustomPreview && settings.wallpaperPreset === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  data-testid={`wallpaper-preset-${preset.id}`}
                  aria-pressed={isPresetActive}
                  onClick={() => {
                    setUploadError(null);
                    clearStorageWarning();
                    setUrlInput('');
                    updateSettings({
                      wallpaperPreset: preset.id,
                      customBgImage: '',
                    });
                  }}
                  className={`group flex items-center gap-2.5 p-2 rounded-[12px] border text-left transition-all cursor-pointer ${
                    isPresetActive
                      ? 'glass-active border-white/40'
                      : 'border-white/[0.10] bg-white/[0.035] hover:bg-white/[0.08] hover:border-white/25'
                  }`}
                >
                  <span
                    className="w-8 h-8 rounded-[8px] border border-white/20 shrink-0 shadow-inner"
                    style={{ background: preset.swatchCss }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-[11.5px] font-medium text-white truncate">
                      {preset.name}
                    </div>
                    <div className="text-[10px] text-white/50 truncate">
                      {preset.subtitle}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
};

export default GlassAppearanceControls;
