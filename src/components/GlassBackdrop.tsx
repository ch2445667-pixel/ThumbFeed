'use client';

import React, { useState, useEffect } from 'react';
import { useAppearance } from '../lib/appearanceContext';
import { getWallpaperPresetById } from '../lib/appearance';
import { sanitizeSafeImageSrc } from '../lib/urlSafety';

/**
 * Full-viewport fixed backdrop sitting behind the floating translucent liquid glass shell.
 * Supports either a curated atmospheric backdrop or a user-provided custom background image,
 * with independent background blur and contrast dimming.
 */
export const GlassBackdrop: React.FC = () => {
  const { settings } = useAppearance();
  const [customImgError, setCustomImgError] = useState(false);

  const safeCustomBg = sanitizeSafeImageSrc(settings.customBgImage);
  const preset = getWallpaperPresetById(settings.wallpaperPreset);

  useEffect(() => {
    setCustomImgError(false);
  }, [safeCustomBg]);

  const showCustomImage = Boolean(safeCustomBg) && !customImgError;

  return (
    <div
      aria-hidden="true"
      data-testid="glass-backdrop"
      className="fixed inset-0 z-0 overflow-hidden pointer-events-none select-none bg-[#040406]"
    >
      {/* Layer 1: Wallpaper Preset or Custom User Image */}
      {showCustomImage ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={safeCustomBg}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => setCustomImgError(true)}
          className="absolute inset-0 h-full w-full object-cover object-center transition-[filter,transform] duration-200 ease-out"
          style={{
            filter: 'blur(var(--bg-blur, 0px))',
            transform: 'scale(var(--bg-scale, 1)) translateZ(0)',
          }}
        />
      ) : (
        <div
          className="absolute inset-0 transition-[filter,transform] duration-300 ease-out"
          style={{
            backgroundImage: preset.backgroundCss,
            filter: 'blur(var(--bg-blur, 0px))',
            transform: 'scale(var(--bg-scale, 1)) translateZ(0)',
          }}
        />
      )}

      {/* Layer 2: Signature diagonal obsidian-to-ember luminous light ribbon for Ember Void */}
      {!showCustomImage && settings.wallpaperPreset === 'ember-void' && (
        <div
          className="absolute inset-0"
          style={{
            filter: 'blur(var(--bg-blur, 0px))',
            transform: 'scale(var(--bg-scale, 1)) translateZ(0)',
          }}
        >
          {/* Sweeping luminous burnt-amber glow on the right half */}
          <div
            className="absolute -top-[18%] -right-[8%] h-[126vh] w-[58vw] rounded-full opacity-90 blur-[78px]"
            style={{
              background:
                'radial-gradient(ellipse at 52% 42%, rgba(250, 126, 26, 0.92) 0%, rgba(210, 78, 12, 0.72) 40%, rgba(132, 22, 16, 0.36) 70%, transparent 90%)',
              transform: 'rotate(-16deg)',
            }}
          />
          {/* Deep velvety crimson inner edge transitioning into pitch black */}
          <div
            className="absolute top-[24%] left-[44%] h-[92vh] w-[30vw] rounded-full opacity-75 blur-[68px]"
            style={{
              background:
                'radial-gradient(ellipse at 50% 50%, rgba(174, 24, 26, 0.78) 0%, rgba(92, 12, 18, 0.42) 52%, transparent 82%)',
              transform: 'rotate(18deg)',
            }}
          />
          {/* Deep pitch-black obsidian mask anchoring the left side cleanly */}
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(108deg, #040406 0%, #040406 36%, rgba(4, 4, 6, 0.86) 46%, rgba(4, 4, 6, 0.14) 60%, transparent 72%)',
            }}
          />
        </div>
      )}

      {/* Soft ambient bokeh blooms for Ocean Bokeh preset */}
      {!showCustomImage && settings.wallpaperPreset === 'ocean-bokeh' && (
        <>
          <div
            className="absolute -top-[12%] -right-[6%] h-[58vh] w-[48vw] rounded-full opacity-60 blur-[74px]"
            style={{
              background:
                'radial-gradient(circle, rgba(72, 198, 224, 0.74) 0%, rgba(22, 112, 138, 0.28) 55%, transparent 78%)',
            }}
          />
          <div
            className="absolute -bottom-[16%] right-[10%] h-[48vh] w-[42vw] rounded-full opacity-45 blur-[82px]"
            style={{
              background:
                'radial-gradient(circle, rgba(24, 128, 152, 0.58) 0%, rgba(8, 52, 68, 0.20) 58%, transparent 80%)',
            }}
          />
        </>
      )}

      {/* Layer 3: Calibrated Dark Contrast Veil so glass typography stays WCAG AA legible */}
      <div
        className="absolute inset-0 transition-colors duration-200"
        style={{
          backgroundColor: 'rgba(3, 3, 5, var(--bg-dim, 0.08))',
        }}
      />

      {/* Layer 4: Subtle edge vignette for optical depth */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(125% 110% at 58% 12%, transparent 50%, rgba(2, 2, 4, 0.44) 100%)',
        }}
      />
    </div>
  );
};

export default GlassBackdrop;
