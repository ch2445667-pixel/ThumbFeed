import React from 'react';

export interface IconProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
  size?: number | string;
}

/**
 * Modern, Bespoke App Icon Suite
 * Designed with optical balance, smooth geometric curves, and premium line-art aesthetics.
 */

// 1. Sleek Aerodynamic Arrow Up (Back to top)
export const IconArrowUp: React.FC<IconProps> = ({ className = 'w-4 h-4', size, ...props }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    width={size}
    height={size}
    {...props}
  >
    <path d="M12 19V5" />
    <path d="M5.5 11.5L12 5L18.5 11.5" />
  </svg>
);

// 2. Precision Plus (Zoom In & Add)
export const IconPlus: React.FC<IconProps> = ({ className = 'w-4 h-4', size, ...props }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    width={size}
    height={size}
    {...props}
  >
    <path d="M12 5V19" />
    <path d="M5 12H19" />
  </svg>
);

// 3. Precision Minus (Zoom Out)
export const IconMinus: React.FC<IconProps> = ({ className = 'w-4 h-4', size, ...props }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    width={size}
    height={size}
    {...props}
  >
    <path d="M5 12H19" />
  </svg>
);

// 4. Modern Filter (Precision Dual Sliders / Dial Control)
export const IconFilter: React.FC<IconProps> = ({ className = 'w-4 h-4', size, ...props }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.9"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    width={size}
    height={size}
    {...props}
  >
    <path d="M4 7H14" />
    <path d="M18 7H20" />
    <circle cx="16" cy="7" r="2" fill="currentColor" fillOpacity="0.15" />
    <path d="M4 17H6" />
    <path d="M10 17H20" />
    <circle cx="8" cy="17" r="2" fill="currentColor" fillOpacity="0.15" />
  </svg>
);

// 5. Dynamic Interlocking Shuffle Arrows
export const IconShuffle: React.FC<IconProps> = ({ className = 'w-4 h-4', size, ...props }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.9"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    width={size}
    height={size}
    {...props}
  >
    <path d="M3 18H6.5C8 18 9.5 16.5 10.5 15L13.5 9C14.5 7.5 16 6 17.5 6H21" />
    <path d="M17.5 2.5L21 6L17.5 9.5" />
    <path d="M3 6H6.5C7.5 6 8.5 6.8 9.2 7.8" />
    <path d="M14.8 16.2C15.5 17.2 16.5 18 17.5 18H21" />
    <path d="M17.5 14.5L21 18L17.5 21.5" />
  </svg>
);

// 6. Viewfinder Expand / Maximize (Optical corner brackets)
export const IconMaximize: React.FC<IconProps> = ({ className = 'w-4 h-4', size, ...props }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.9"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    width={size}
    height={size}
    {...props}
  >
    <path d="M8.5 3.5H4.5C3.94772 3.5 3.5 3.94772 3.5 4.5V8.5" />
    <path d="M15.5 3.5H19.5C20.0523 3.5 20.5 3.94772 20.5 4.5V8.5" />
    <path d="M8.5 20.5H4.5C3.94772 20.5 3.5 20.0523 3.5 19.5V15.5" />
    <path d="M15.5 20.5H19.5C20.0523 20.5 20.5 20.0523 20.5 19.5V15.5" />
    <circle cx="12" cy="12" r="1.5" fill="currentColor" />
  </svg>
);

// 7. Minimalist Optical Search Lens
export const IconSearch: React.FC<IconProps> = ({ className = 'w-4 h-4', size, ...props }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.9"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    width={size}
    height={size}
    {...props}
  >
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20L16 16" />
    <path d="M8.5 10C8.5 8.6 9.6 7.5 11 7.5" strokeWidth="1.4" strokeOpacity="0.7" />
  </svg>
);

// 8. Refined Smooth Close (X)
export const IconClose: React.FC<IconProps> = ({ className = 'w-4 h-4', size, ...props }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    width={size}
    height={size}
    {...props}
  >
    <path d="M18 6L6 18" />
    <path d="M6 6L18 18" />
  </svg>
);

// 9. Modern Tray Download
export const IconDownload: React.FC<IconProps> = ({ className = 'w-4 h-4', size, ...props }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.9"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    width={size}
    height={size}
    {...props}
  >
    <path d="M12 3.5V14.5" />
    <path d="M7 10L12 15L17 10" />
    <path d="M4 17.5V19C4 19.8284 4.67157 20.5 5.5 20.5H18.5C19.3284 20.5 20 19.8284 20 19V17.5" />
  </svg>
);

// 10. Modern Chronometer Dial (Latest)
export const IconClock: React.FC<IconProps> = ({ className = 'w-4 h-4', size, ...props }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.9"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    width={size}
    height={size}
    {...props}
  >
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7V12L15.5 14" />
    <circle cx="12" cy="12" r="1" fill="currentColor" />
  </svg>
);

// 11. Momentum Sparkline (Top / Popular)
export const IconTrending: React.FC<IconProps> = ({ className = 'w-4 h-4', size, ...props }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.9"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    width={size}
    height={size}
    {...props}
  >
    <path d="M3.5 17.5L9.5 11.5L14 15.5L20.5 7.5" />
    <path d="M15 7.5H20.5V13" />
  </svg>
);

// 12. Celestial Diamond Sparkles (AI Magic & Shuffle)
export const IconSparkles: React.FC<IconProps> = ({ className = 'w-4 h-4', size, ...props }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    width={size}
    height={size}
    {...props}
  >
    <path d="M12 2.5C12 7.5 14 9.5 19 10C14 10.5 12 12.5 12 17.5C12 12.5 10 10.5 5 10C10 9.5 12 7.5 12 2.5Z" />
    <path d="M18.5 16.5C18.5 18.5 19 19 21 19.5C19 20 18.5 20.5 18.5 22.5C18.5 20.5 18 20 16 19.5C18 19 18.5 18.5 18.5 16.5Z" />
    <circle cx="6.5" cy="18.5" r="1" fill="currentColor" />
  </svg>
);

// 13. Cycle Refresh / Reset (RotateCcw)
export const IconRotateCcw: React.FC<IconProps> = ({ className = 'w-4 h-4', size, ...props }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.9"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    width={size}
    height={size}
    {...props}
  >
    <path d="M3.5 4.5V9.5H8.5" />
    <path d="M4.5 14.5C5.8 18 9.5 20.5 13.5 20C17.5 19.5 20.5 16 20.5 12C20.5 7.5 17 4 12.5 4C8.8 4 5.8 6.2 4.5 9.5" />
  </svg>
);

// 14. Smooth YouTube Play Screen
export const IconYoutube: React.FC<IconProps> = ({ className = 'w-4 h-4', size, ...props }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.9"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    width={size}
    height={size}
    {...props}
  >
    <rect x="2.5" y="4.5" width="19" height="15" rx="4.5" />
    <path d="M10 9L15.5 12L10 15V9Z" fill="currentColor" stroke="none" />
  </svg>
);

// 15. Geometric Cloud Upload
export const IconUploadCloud: React.FC<IconProps> = ({ className = 'w-4 h-4', size, ...props }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.9"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    width={size}
    height={size}
    {...props}
  >
    <path d="M7 16.5C4.5 16.5 2.5 14.5 2.5 12C2.5 9.7 4.2 7.8 6.5 7.5C7.2 4.5 10 2.5 13 2.5C16.8 2.5 19.8 5.2 20.3 9C21.8 9.8 22.5 11.2 22.5 13C22.5 15 21 16.5 19 16.5" />
    <path d="M12 11.5V21.5" />
    <path d="M8.5 15L12 11.5L15.5 15" />
  </svg>
);

// 16. Streamlined Waste Bin (Trash)
export const IconTrash: React.FC<IconProps> = ({ className = 'w-4 h-4', size, ...props }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    width={size}
    height={size}
    {...props}
  >
    <path d="M4 6.5H20" />
    <path d="M9 3.5H15" />
    <path d="M18.5 6.5L17.5 19.5C17.4 20.6 16.5 21.5 15.4 21.5H8.6C7.5 21.5 6.6 20.6 6.5 19.5L5.5 6.5" />
    <path d="M10 11V17" />
    <path d="M14 11V17" />
  </svg>
);

// 17. Rounded Verified Check
export const IconCheck: React.FC<IconProps> = ({ className = 'w-4 h-4', size, ...props }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    width={size}
    height={size}
    {...props}
  >
    <path d="M4.5 12.5L9.5 17.5L19.5 6.5" />
  </svg>
);

// 18. Modern Radial Loader
export const IconSpinner: React.FC<IconProps> = ({ className = 'w-4 h-4', size, ...props }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    className={`animate-spin ${className}`}
    width={size}
    height={size}
    {...props}
  >
    <circle cx="12" cy="12" r="9" strokeOpacity="0.2" />
    <path d="M12 3C16.9706 3 21 7.02944 21 12" />
  </svg>
);

// 19. Precision Horizontal Sliders
export const IconSliders: React.FC<IconProps> = ({ className = 'w-4 h-4', size, ...props }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.9"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    width={size}
    height={size}
    {...props}
  >
    <path d="M4 21V14" />
    <path d="M4 10V3" />
    <path d="M12 21V12" />
    <path d="M12 8V3" />
    <path d="M20 21V16" />
    <path d="M20 12V3" />
    <path d="M1 14H7" />
    <path d="M9 8H15" />
    <path d="M17 16H23" />
  </svg>
);

// 20. Modern Ribbon Bookmark
export const IconBookmark: React.FC<IconProps> = ({ className = 'w-4 h-4', size, ...props }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.9"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    width={size}
    height={size}
    {...props}
  >
    <path d="M19 21L12 16L5 21V5C5 3.89543 5.89543 3 7 3H17C18.1046 3 19 3.89543 19 5V21Z" />
  </svg>
);

// 21. Precision Compass Dial
export const IconCompass: React.FC<IconProps> = ({ className = 'w-4 h-4', size, ...props }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.9"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    width={size}
    height={size}
    {...props}
  >
    <circle cx="12" cy="12" r="9" />
    <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" fill="currentColor" fillOpacity="0.15" />
  </svg>
);

// 22. Radiant Sun (Light Mode indicator / Switch to Light)
export const IconSun: React.FC<IconProps> = ({ className = 'w-4 h-4', size, ...props }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    width={size}
    height={size}
    {...props}
  >
    <circle cx="12" cy="12" r="4.5" fill="currentColor" fillOpacity="0.2" />
    <line x1="12" y1="2" x2="12" y2="4" />
    <line x1="12" y1="20" x2="12" y2="22" />
    <line x1="4.93" y1="4.93" x2="6.34" y2="6.34" />
    <line x1="17.66" y1="17.66" x2="19.07" y2="19.07" />
    <line x1="2" y1="12" x2="4" y2="12" />
    <line x1="20" y1="12" x2="22" y2="12" />
    <line x1="4.93" y1="19.07" x2="6.34" y2="17.66" />
    <line x1="17.66" y1="6.34" x2="19.07" y2="4.93" />
  </svg>
);

// 23. Celestial Crescent Moon (Dark Mode indicator / Switch to Dark)
export const IconMoon: React.FC<IconProps> = ({ className = 'w-4 h-4', size, ...props }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    width={size}
    height={size}
    {...props}
  >
    <path
      d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"
      fill="currentColor"
      fillOpacity="0.2"
    />
  </svg>
);

// 24. Creator Channel / User Profile Icon
export const IconUser: React.FC<IconProps> = ({ className = 'w-4 h-4', size, ...props }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    width={size}
    height={size}
    {...props}
  >
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" fill="currentColor" fillOpacity="0.15" />
  </svg>
);

// 25. Film / Video Tape Icon
export const IconFilm: React.FC<IconProps> = ({ className = 'w-4 h-4', size, ...props }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    width={size}
    height={size}
    {...props}
  >
    <rect x="2" y="4" width="20" height="16" rx="3" />
    <path d="M7 4v16" />
    <path d="M17 4v16" />
    <path d="M2 8h5" />
    <path d="M2 12h5" />
    <path d="M2 16h5" />
    <path d="M17 8h5" />
    <path d="M17 12h5" />
    <path d="M17 16h5" />
  </svg>
);

// 26. Multi-Layer Stack Icon
export const IconLayers: React.FC<IconProps> = ({ className = 'w-4 h-4', size, ...props }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    width={size}
    height={size}
    {...props}
  >
    <polygon points="12 2 2 7 12 12 22 7 12 2" fill="currentColor" fillOpacity="0.15" />
    <polyline points="2 17 12 22 22 17" />
    <polyline points="2 12 12 17 22 12" />
  </svg>
);

// 27. Tag Icon
export const IconTag: React.FC<IconProps> = ({ className = 'w-4 h-4', size, ...props }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    width={size}
    height={size}
    {...props}
  >
    <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z" />
    <path d="M7 7h.01" />
  </svg>
);

// 28. Pinterest Pin Icon
export const IconPinterest: React.FC<IconProps> = ({ className = 'w-4 h-4', size, ...props }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    width={size}
    height={size}
    {...props}
  >
    <path d="M12 0C5.373 0 0 5.372 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738.098.119.112.224.083.345-.09.375-.291 1.199-.334 1.372-.053.224-.174.271-.401.165-1.495-.695-2.43-2.878-2.43-4.632 0-3.774 2.743-7.243 7.906-7.243 4.15 0 7.377 2.957 7.377 6.909 0 4.124-2.599 7.442-6.208 7.442-1.212 0-2.351-.63-2.741-1.375l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12 0-6.628-5.373-12-12-12z" />
  </svg>
);

// 29. Clipboard Paste Icon
export const IconClipboardPaste: React.FC<IconProps> = ({ className = 'w-4 h-4', size, ...props }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    width={size}
    height={size}
    {...props}
  >
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
    <path d="M9 14h6" />
    <path d="M12 11v6" />
  </svg>
);

// 30. Image Icon
export const IconImage: React.FC<IconProps> = ({ className = 'w-4 h-4', size, ...props }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    width={size}
    height={size}
    {...props}
  >
    <rect x="3" y="3" width="18" height="18" rx="3" ry="3" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <polyline points="21 15 16 10 5 21" />
  </svg>
);



