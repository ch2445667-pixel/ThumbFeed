import { sanitizeSafeImageSrc } from './urlSafety';

export type GlassStyleId = 'liquid' | 'clear' | 'frosted' | 'smoked' | 'prism';

export interface AppearanceSettings {
  style: GlassStyleId;
  /** Backdrop blur on UI glass surfaces in px (0 - 48) */
  glassBlur: number;
  /** Glass tint / fill intensity percentage (0 - 100) */
  glassOpacity: number;
  /** Blur applied directly to the background image in px (0 - 32) */
  bgBlur: number;
  /** Contrast-preserving dark veil over background image percentage (0 - 80) */
  bgDim: number;
  /** Selected built-in wallpaper preset id */
  wallpaperPreset: string;
  /** Optional user-supplied custom background image (data URL or https URL) */
  customBgImage: string;
}

export interface GlassStylePreset {
  id: GlassStyleId;
  name: string;
  description: string;
  defaultBlur: number;
  defaultOpacity: number;
  defaultDim: number;
  /** Mini preview styling metadata */
  previewTint: string;
  previewBorder: string;
}

export interface WallpaperPreset {
  id: string;
  name: string;
  subtitle: string;
  /** Rich multi-layer CSS background (gradients only, zero external hosts) */
  backgroundCss: string;
  /** Swatch background for the Settings picker */
  swatchCss: string;
}

export const APPEARANCE_STORAGE_KEY = 'thumbfeed_appearance_v2';

export const GLASS_STYLE_PRESETS: GlassStylePreset[] = [
  {
    id: 'liquid',
    name: 'Liquid Glass',
    description: 'Signature dual black & white specular glass',
    defaultBlur: 24,
    defaultOpacity: 42,
    defaultDim: 8,
    previewTint:
      'linear-gradient(180deg, rgba(255,255,255,0.13) 0%, rgba(255,255,255,0.039) 46%, rgba(0,0,0,0.24) 100%)',
    previewBorder: 'rgba(255, 255, 255, 0.28)',
  },
  {
    id: 'clear',
    name: 'Clear Glass',
    description: 'Ultra-transparent pane with crisp white rim',
    defaultBlur: 12,
    defaultOpacity: 18,
    defaultDim: 6,
    previewTint:
      'linear-gradient(180deg, rgba(255,255,255,0.104) 0%, rgba(255,255,255,0.013) 50%, rgba(0,0,0,0.10) 100%)',
    previewBorder: 'rgba(255, 255, 255, 0.30)',
  },
  {
    id: 'frosted',
    name: 'Frosted',
    description: 'Soft milky white diffusion with deep blur',
    defaultBlur: 36,
    defaultOpacity: 56,
    defaultDim: 12,
    previewTint:
      'linear-gradient(180deg, rgba(255,255,255,0.169) 0%, rgba(220,224,232,0.078) 52%, rgba(16,18,22,0.28) 100%)',
    previewBorder: 'rgba(255, 255, 255, 0.32)',
  },
  {
    id: 'smoked',
    name: 'Smoked',
    description: 'Deep obsidian tint for maximum contrast',
    defaultBlur: 24,
    defaultOpacity: 68,
    defaultDim: 22,
    previewTint:
      'linear-gradient(180deg, rgba(255,255,255,0.059) 0%, rgba(8,8,10,0.58) 46%, rgba(0,0,0,0.78) 100%)',
    previewBorder: 'rgba(255, 255, 255, 0.16)',
  },
  {
    id: 'prism',
    name: 'Crystal Prism',
    description: 'High-contrast luminous glass with bright edge',
    defaultBlur: 18,
    defaultOpacity: 32,
    defaultDim: 8,
    previewTint:
      'linear-gradient(145deg, rgba(255,255,255,0.182) 0%, rgba(255,255,255,0.033) 48%, rgba(0,0,0,0.24) 100%)',
    previewBorder: 'rgba(255, 255, 255, 0.38)',
  },
];

export const WALLPAPER_PRESETS: WallpaperPreset[] = [
  {
    id: 'ember-void',
    name: 'Ember Void',
    subtitle: 'Obsidian to warm amber',
    backgroundCss: [
      'radial-gradient(66% 72% at 86% 36%, rgba(242, 118, 28, 0.88) 0%, rgba(196, 72, 12, 0.68) 38%, rgba(112, 24, 16, 0.32) 66%, transparent 90%)',
      'radial-gradient(52% 62% at 96% 88%, rgba(232, 92, 16, 0.72) 0%, rgba(142, 34, 14, 0.42) 48%, transparent 82%)',
      'radial-gradient(36% 48% at 64% 84%, rgba(164, 24, 28, 0.56) 0%, rgba(68, 10, 14, 0.24) 52%, transparent 80%)',
      'linear-gradient(112deg, #040406 0%, #050507 38%, #0a0506 50%, #3d0c0d 62%, #a83c0c 78%, #d66818 100%)',
    ].join(', '),
    swatchCss:
      'linear-gradient(115deg, #050507 0%, #090506 42%, #7d1814 66%, #e6721c 100%)',
  },
  {
    id: 'ocean-bokeh',
    name: 'Ocean Bokeh',
    subtitle: 'Deep teal luminance',
    backgroundCss: [
      'radial-gradient(62% 58% at 82% 24%, rgba(56, 178, 206, 0.68) 0%, rgba(28, 118, 145, 0.38) 38%, rgba(9, 44, 58, 0.10) 68%, transparent 100%)',
      'radial-gradient(48% 46% at 62% 84%, rgba(20, 108, 128, 0.40) 0%, rgba(6, 32, 42, 0.18) 55%, transparent 100%)',
      'linear-gradient(118deg, #040608 0%, #05090d 42%, #081e28 70%, #11475a 100%)',
    ].join(', '),
    swatchCss:
      'linear-gradient(115deg, #040709 0%, #06141a 44%, #145e74 72%, #3ec1de 100%)',
  },
  {
    id: 'emerald-mist',
    name: 'Emerald Mist',
    subtitle: 'Soft jade aurora',
    backgroundCss: [
      'radial-gradient(60% 58% at 84% 26%, rgba(28, 176, 134, 0.58) 0%, rgba(12, 102, 82, 0.32) 42%, transparent 78%)',
      'radial-gradient(48% 46% at 62% 82%, rgba(16, 118, 102, 0.38) 0%, rgba(6, 48, 44, 0.18) 52%, transparent 85%)',
      'linear-gradient(118deg, #040606 0%, #040b09 44%, #092920 72%, #135946 100%)',
    ].join(', '),
    swatchCss:
      'linear-gradient(115deg, #030605 0%, #051410 44%, #0d5a48 72%, #22c496 100%)',
  },
  {
    id: 'nordic-dusk',
    name: 'Nordic Dusk',
    subtitle: 'Glacier slate glow',
    backgroundCss: [
      'radial-gradient(62% 58% at 84% 24%, rgba(72, 146, 232, 0.60) 0%, rgba(32, 76, 148, 0.34) 44%, transparent 78%)',
      'radial-gradient(48% 46% at 64% 82%, rgba(54, 108, 188, 0.36) 0%, rgba(18, 40, 82, 0.16) 54%, transparent 86%)',
      'linear-gradient(118deg, #040509 0%, #050812 44%, #0d1d3b 72%, #1e4280 100%)',
    ].join(', '),
    swatchCss:
      'linear-gradient(115deg, #04060c 0%, #071022 44%, #1d4382 72%, #569ef0 100%)',
  },
  {
    id: 'crimson-velvet',
    name: 'Crimson Velvet',
    subtitle: 'Editorial rose sweep',
    backgroundCss: [
      'radial-gradient(62% 60% at 84% 28%, rgba(208, 56, 86, 0.62) 0%, rgba(120, 22, 46, 0.36) 44%, transparent 78%)',
      'radial-gradient(48% 48% at 64% 82%, rgba(146, 32, 62, 0.42) 0%, rgba(54, 12, 24, 0.20) 54%, transparent 84%)',
      'linear-gradient(118deg, #050406 0%, #0b0508 44%, #380b18 72%, #7a1732 100%)',
    ].join(', '),
    swatchCss:
      'linear-gradient(115deg, #050406 0%, #14050b 44%, #6e1530 72%, #d43c5e 100%)',
  },
  {
    id: 'silver-studio',
    name: 'Silver Studio',
    subtitle: 'Monochrome chrome light',
    backgroundCss: [
      'radial-gradient(60% 58% at 84% 24%, rgba(210, 218, 230, 0.40) 0%, rgba(98, 108, 124, 0.24) 44%, transparent 78%)',
      'radial-gradient(48% 46% at 64% 84%, rgba(142, 152, 168, 0.24) 0%, rgba(44, 50, 62, 0.14) 52%, transparent 84%)',
      'linear-gradient(118deg, #040507 0%, #07080b 44%, #171a21 72%, #313744 100%)',
    ].join(', '),
    swatchCss:
      'linear-gradient(115deg, #040507 0%, #0c0e13 44%, #3c4352 72%, #b9c4d4 100%)',
  },
  {
    id: 'midnight-indigo',
    name: 'Midnight Slate',
    subtitle: 'Deep twilight blue',
    backgroundCss: [
      'radial-gradient(60% 58% at 84% 24%, rgba(84, 108, 212, 0.56) 0%, rgba(36, 52, 124, 0.30) 44%, transparent 78%)',
      'radial-gradient(48% 48% at 62% 82%, rgba(56, 82, 168, 0.36) 0%, rgba(18, 30, 72, 0.18) 52%, transparent 84%)',
      'linear-gradient(118deg, #040509 0%, #060814 44%, #111b40 72%, #24377a 100%)',
    ].join(', '),
    swatchCss:
      'linear-gradient(115deg, #04050a 0%, #080d22 44%, #243673 72%, #5a7cd4 100%)',
  },
  {
    id: 'pure-obsidian',
    name: 'Obsidian Matte',
    subtitle: 'Minimal pure black',
    backgroundCss: [
      'radial-gradient(58% 50% at 80% 18%, rgba(92, 98, 112, 0.18) 0%, transparent 72%)',
      'linear-gradient(135deg, #040406 0%, #070709 55%, #0c0d11 100%)',
    ].join(', '),
    swatchCss:
      'linear-gradient(115deg, #030305 0%, #0b0c10 55%, #242730 100%)',
  },
];

export const DEFAULT_APPEARANCE: AppearanceSettings = {
  style: 'liquid',
  glassBlur: 24,
  glassOpacity: 42,
  bgBlur: 0,
  bgDim: 8,
  wallpaperPreset: 'ember-void',
  customBgImage: '',
};

const VALID_STYLES = new Set<GlassStyleId>([
  'liquid',
  'clear',
  'frosted',
  'smoked',
  'prism',
]);

const VALID_PRESETS = new Set<string>(WALLPAPER_PRESETS.map((p) => p.id));

export function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, Math.round(num)));
}

export function sanitizeAppearanceSettings(raw: unknown): AppearanceSettings {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_APPEARANCE };
  }
  const obj = raw as Record<string, unknown>;

  const style: GlassStyleId =
    typeof obj.style === 'string' && VALID_STYLES.has(obj.style as GlassStyleId)
      ? (obj.style as GlassStyleId)
      : DEFAULT_APPEARANCE.style;

  const wallpaperPreset =
    typeof obj.wallpaperPreset === 'string' && VALID_PRESETS.has(obj.wallpaperPreset)
      ? obj.wallpaperPreset
      : DEFAULT_APPEARANCE.wallpaperPreset;

  const customBgImageRaw = typeof obj.customBgImage === 'string' ? obj.customBgImage.trim() : '';
  const safeCustomBg = customBgImageRaw ? sanitizeSafeImageSrc(customBgImageRaw) || '' : '';

  return {
    style,
    glassBlur: clampNumber(obj.glassBlur, 0, 48, DEFAULT_APPEARANCE.glassBlur),
    glassOpacity: clampNumber(obj.glassOpacity, 0, 100, DEFAULT_APPEARANCE.glassOpacity),
    bgBlur: clampNumber(obj.bgBlur, 0, 32, DEFAULT_APPEARANCE.bgBlur),
    bgDim: clampNumber(obj.bgDim, 0, 80, DEFAULT_APPEARANCE.bgDim),
    wallpaperPreset,
    customBgImage: safeCustomBg,
  };
}

export function getWallpaperPresetById(id: string): WallpaperPreset {
  return WALLPAPER_PRESETS.find((p) => p.id === id) || WALLPAPER_PRESETS[0];
}

export function getGlassStylePresetById(id: GlassStyleId): GlassStylePreset {
  return GLASS_STYLE_PRESETS.find((s) => s.id === id) || GLASS_STYLE_PRESETS[0];
}

function roundAlpha(n: number): string {
  return Math.min(0.96, Math.max(0.01, n)).toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
}

/**
 * Pure function translating AppearanceSettings into directional black-and-white
 * liquid glass CSS custom properties applied on `:root` at 60fps.
 */
export function computeGlassCssVariables(settings: AppearanceSettings): Record<string, string> {
  const s = sanitizeAppearanceSettings(settings);
  const t = s.glassOpacity / 100; // 0..1 user opacity slider
  const blur = s.glassBlur;
  const heavyBlur = Math.min(56, Math.round(blur * 1.35 + 8));
  const bgScale = s.bgBlur > 0 ? (1 + Math.min(0.14, s.bgBlur * 0.0045)).toFixed(4) : '1';

  // Optical profile parameters: neutral obsidian black + crisp pure white gradients
  let saturate = '160%';
  let whiteBoost = 1.0;
  let darkFloor = 1.0;
  let borderAlpha = 0.13 + t * 0.07;
  let borderStrongAlpha = 0.24 + t * 0.10;
  let specularTopAlpha = 0.24;
  let specularBottomAlpha = 0.42;

  let sidebarAlpha = 0.46 + t * 0.34;
  let workspaceAlpha = 0.08 + t * 0.22;
  let headerAlpha = 0.16 + t * 0.30;
  let controlAlpha = 0.16 + t * 0.26;
  let controlHoverAlpha = 0.24 + t * 0.28;
  let cardAlpha = 0.22 + t * 0.34;
  let cardHoverAlpha = 0.30 + t * 0.34;
  let modalAlpha = 0.54 + t * 0.30;
  let popoverAlpha = 0.62 + t * 0.26;
  let pillBgAlpha = 0.20 + t * 0.26;

  if (s.style === 'clear') {
    saturate = '140%';
    whiteBoost = 1.05;
    darkFloor = 0.55;
    borderAlpha = 0.18 + t * 0.08;
    borderStrongAlpha = 0.30 + t * 0.10;
    specularTopAlpha = 0.32;
    specularBottomAlpha = 0.28;
    sidebarAlpha = 0.18 + t * 0.24;
    workspaceAlpha = 0.02 + t * 0.10;
    headerAlpha = 0.05 + t * 0.16;
    controlAlpha = 0.06 + t * 0.14;
    controlHoverAlpha = 0.12 + t * 0.18;
    cardAlpha = 0.08 + t * 0.20;
    cardHoverAlpha = 0.14 + t * 0.24;
    modalAlpha = 0.34 + t * 0.28;
    popoverAlpha = 0.44 + t * 0.28;
    pillBgAlpha = 0.08 + t * 0.16;
  } else if (s.style === 'frosted') {
    saturate = '195%';
    whiteBoost = 1.55;
    darkFloor = 0.85;
    borderAlpha = 0.20 + t * 0.08;
    borderStrongAlpha = 0.34 + t * 0.10;
    specularTopAlpha = 0.36;
    specularBottomAlpha = 0.34;
    sidebarAlpha = 0.36 + t * 0.30;
    workspaceAlpha = 0.10 + t * 0.22;
    headerAlpha = 0.18 + t * 0.28;
    controlAlpha = 0.20 + t * 0.24;
    controlHoverAlpha = 0.28 + t * 0.26;
    cardAlpha = 0.24 + t * 0.30;
    cardHoverAlpha = 0.32 + t * 0.32;
    modalAlpha = 0.50 + t * 0.28;
    popoverAlpha = 0.58 + t * 0.26;
    pillBgAlpha = 0.22 + t * 0.24;
  } else if (s.style === 'smoked') {
    saturate = '125%';
    whiteBoost = 0.55;
    darkFloor = 1.25;
    borderAlpha = 0.10 + t * 0.05;
    borderStrongAlpha = 0.20 + t * 0.08;
    specularTopAlpha = 0.14;
    specularBottomAlpha = 0.58;
    sidebarAlpha = 0.64 + t * 0.26;
    workspaceAlpha = 0.24 + t * 0.30;
    headerAlpha = 0.38 + t * 0.32;
    controlAlpha = 0.34 + t * 0.28;
    controlHoverAlpha = 0.44 + t * 0.28;
    cardAlpha = 0.44 + t * 0.34;
    cardHoverAlpha = 0.54 + t * 0.30;
    modalAlpha = 0.72 + t * 0.20;
    popoverAlpha = 0.78 + t * 0.16;
    pillBgAlpha = 0.40 + t * 0.28;
  } else if (s.style === 'prism') {
    saturate = '215%';
    whiteBoost = 1.45;
    darkFloor = 0.90;
    borderAlpha = 0.22 + t * 0.08;
    borderStrongAlpha = 0.38 + t * 0.10;
    specularTopAlpha = 0.42;
    specularBottomAlpha = 0.46;
    sidebarAlpha = 0.34 + t * 0.30;
    workspaceAlpha = 0.06 + t * 0.16;
    headerAlpha = 0.12 + t * 0.24;
    controlAlpha = 0.14 + t * 0.22;
    controlHoverAlpha = 0.22 + t * 0.26;
    cardAlpha = 0.16 + t * 0.28;
    cardHoverAlpha = 0.24 + t * 0.30;
    modalAlpha = 0.48 + t * 0.28;
    popoverAlpha = 0.56 + t * 0.26;
    pillBgAlpha = 0.16 + t * 0.22;
  }

  // Directional dual black & white liquid glass gradients (CutSheet optical physics):
  // Softened white top catch-light (65% intensity) fading smoothly into deep obsidian shading.
  const WHITE_GLOW_SCALE = 0.65;
  const wTop = (base: number) => roundAlpha(base * whiteBoost * WHITE_GLOW_SCALE);
  const bDeep = (base: number) => roundAlpha(base * darkFloor);

  const sidebarGradient = `linear-gradient(180deg, rgba(255, 255, 255, ${wTop(0.075)}) 0%, rgba(16, 17, 22, ${roundAlpha(sidebarAlpha * 0.85)}) 18%, rgba(8, 8, 11, ${roundAlpha(sidebarAlpha * 1.05)}) 66%, rgba(3, 3, 5, ${roundAlpha(Math.min(0.94, sidebarAlpha * 1.22))}) 100%)`;

  const workspaceGradient = `linear-gradient(180deg, rgba(255, 255, 255, ${wTop(0.045)}) 0%, rgba(8, 8, 11, ${roundAlpha(workspaceAlpha)}) 24%, rgba(4, 4, 6, ${roundAlpha(workspaceAlpha * 1.45)}) 100%)`;

  const headerGradient = `linear-gradient(180deg, rgba(255, 255, 255, ${wTop(0.055)}) 0%, rgba(10, 10, 14, ${roundAlpha(headerAlpha * 0.72)}) 55%, rgba(0, 0, 0, ${roundAlpha(headerAlpha)}) 100%)`;

  const controlGradient = `linear-gradient(180deg, rgba(255, 255, 255, ${wTop(0.16)}) 0%, rgba(255, 255, 255, ${wTop(0.05)}) 46%, rgba(0, 0, 0, ${bDeep(0.18 + t * 0.12)}) 100%)`;

  const controlHoverGradient = `linear-gradient(180deg, rgba(255, 255, 255, ${wTop(0.24)}) 0%, rgba(255, 255, 255, ${wTop(0.09)}) 48%, rgba(0, 0, 0, ${bDeep(0.14 + t * 0.10)}) 100%)`;

  const inputGradient = `linear-gradient(180deg, rgba(0, 0, 0, ${bDeep(0.42 + t * 0.16)}) 0%, rgba(10, 10, 14, ${bDeep(0.26 + t * 0.14)}) 100%)`;

  const cardGradient = `linear-gradient(180deg, rgba(255, 255, 255, ${wTop(0.065)}) 0%, rgba(12, 12, 16, ${roundAlpha(cardAlpha * 0.72)}) 34%, rgba(4, 4, 6, ${roundAlpha(cardAlpha * 1.18)}) 100%)`;

  const cardHoverGradient = `linear-gradient(180deg, rgba(255, 255, 255, ${wTop(0.11)}) 0%, rgba(16, 16, 22, ${roundAlpha(cardHoverAlpha * 0.72)}) 36%, rgba(4, 4, 6, ${roundAlpha(cardHoverAlpha * 1.12)}) 100%)`;

  const activeGradient = `linear-gradient(180deg, rgba(255, 255, 255, ${wTop(0.22)}) 0%, rgba(255, 255, 255, ${wTop(0.10)}) 48%, rgba(0, 0, 0, ${bDeep(0.14)}) 100%)`;

  const modalGradient = `linear-gradient(180deg, rgba(255, 255, 255, ${wTop(0.095)}) 0%, rgba(12, 12, 16, ${roundAlpha(modalAlpha * 0.88)}) 18%, rgba(6, 6, 9, ${roundAlpha(Math.min(0.94, modalAlpha * 1.12))}) 100%)`;

  const popoverGradient = `linear-gradient(180deg, rgba(255, 255, 255, ${wTop(0.10)}) 0%, rgba(12, 12, 16, ${roundAlpha(popoverAlpha * 0.90)}) 22%, rgba(5, 5, 8, ${roundAlpha(Math.min(0.95, popoverAlpha * 1.10))}) 100%)`;

  return {
    '--glass-blur': `${blur}px`,
    '--glass-blur-heavy': `${heavyBlur}px`,
    '--glass-saturate': saturate,

    // Solid fallback rgba tints (kept for semantic clarity & unit assertions)
    '--glass-bg-sidebar': `rgba(10, 10, 14, ${roundAlpha(sidebarAlpha)})`,
    '--glass-bg-workspace': `rgba(8, 8, 12, ${roundAlpha(workspaceAlpha)})`,
    '--glass-bg-header': `rgba(10, 10, 14, ${roundAlpha(headerAlpha)})`,
    '--glass-bg-control': `rgba(18, 18, 24, ${roundAlpha(controlAlpha)})`,
    '--glass-bg-control-hover': `rgba(26, 26, 34, ${roundAlpha(controlHoverAlpha)})`,
    '--glass-bg-card': `rgba(10, 10, 14, ${roundAlpha(cardAlpha)})`,
    '--glass-bg-card-hover': `rgba(16, 16, 22, ${roundAlpha(cardHoverAlpha)})`,
    '--glass-bg-modal': `rgba(10, 10, 14, ${roundAlpha(modalAlpha)})`,
    '--glass-bg-popover': `rgba(10, 10, 14, ${roundAlpha(popoverAlpha)})`,
    '--glass-pill-bg': `rgba(12, 12, 16, ${roundAlpha(pillBgAlpha)})`,

    // Dual black/white directional liquid glass gradients
    '--glass-grad-sidebar': sidebarGradient,
    '--glass-grad-workspace': workspaceGradient,
    '--glass-grad-header': headerGradient,
    '--glass-grad-control': controlGradient,
    '--glass-grad-control-hover': controlHoverGradient,
    '--glass-grad-input': inputGradient,
    '--glass-grad-card': cardGradient,
    '--glass-grad-card-hover': cardHoverGradient,
    '--glass-grad-active': activeGradient,
    '--glass-grad-modal': modalGradient,
    '--glass-grad-popover': popoverGradient,

    '--glass-pill-active-bg': `rgba(255, 255, 255, ${wTop(0.18)})`,
    '--glass-pill-active-border': `rgba(255, 255, 255, ${roundAlpha(borderStrongAlpha)})`,
    '--glass-pill-active-text': '#ffffff',

    '--glass-border': `rgba(255, 255, 255, ${roundAlpha(borderAlpha)})`,
    '--glass-border-strong': `rgba(255, 255, 255, ${roundAlpha(borderStrongAlpha)})`,
    '--glass-specular': `rgba(255, 255, 255, ${roundAlpha(specularTopAlpha * WHITE_GLOW_SCALE)})`,
    '--glass-specular-bottom': `rgba(0, 0, 0, ${roundAlpha(specularBottomAlpha)})`,
    '--glass-sheen': controlGradient,
    '--glass-shadow': '0 14px 40px -12px rgba(0, 0, 0, 0.65)',

    '--bg-blur': `${s.bgBlur}px`,
    '--bg-dim': (s.bgDim / 100).toFixed(2),
    '--bg-scale': bgScale,
  };
}

export function loadAppearanceSettings(): AppearanceSettings {
  if (typeof window === 'undefined') return { ...DEFAULT_APPEARANCE };
  try {
    const raw = window.localStorage.getItem(APPEARANCE_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_APPEARANCE };
    return sanitizeAppearanceSettings(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_APPEARANCE };
  }
}

export function saveAppearanceSettings(
  settings: AppearanceSettings
): { ok: boolean; error?: string } {
  if (typeof window === 'undefined') return { ok: true };
  try {
    const clean = sanitizeAppearanceSettings(settings);
    window.localStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify(clean));
    return { ok: true };
  } catch {
    return {
      ok: false,
      error:
        'Could not save custom background image (browser storage quota reached). Try a smaller image or paste an image URL.',
    };
  }
}

const ALLOWED_BG_UPLOAD_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
]);

/**
 * Compresses and resizes a user-uploaded background image on the client so it
 * renders smoothly at full HD while fitting comfortably inside localStorage.
 */
export async function compressBackgroundFile(file: File): Promise<string> {
  if (!file || !ALLOWED_BG_UPLOAD_MIME.has(file.type.toLowerCase())) {
    throw new Error('Please upload a PNG, JPG, or WebP image.');
  }
  if (file.size > 12 * 1024 * 1024) {
    throw new Error('Image is too large (max 12 MB).');
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Could not decode image file.'));
      el.src = objectUrl;
    });

    const maxW = 1920;
    const maxH = 1080;
    const scale = Math.min(1, maxW / img.naturalWidth, maxH / img.naturalHeight);
    const width = Math.max(1, Math.round(img.naturalWidth * scale));
    const height = Math.max(1, Math.round(img.naturalHeight * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas is unavailable in this browser.');
    ctx.drawImage(img, 0, 0, width, height);

    let dataUrl = canvas.toDataURL('image/webp', 0.82);
    if (!dataUrl.startsWith('data:image/webp')) {
      dataUrl = canvas.toDataURL('image/jpeg', 0.82);
    }
    if (dataUrl.length > 1_600_000) {
      dataUrl = canvas.toDataURL('image/jpeg', 0.68);
    }

    const safe = sanitizeSafeImageSrc(dataUrl);
    if (!safe) {
      throw new Error('Processed image could not be validated.');
    }
    return safe;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
