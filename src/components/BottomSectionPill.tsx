'use client';

import React from 'react';
import { createPortal } from 'react-dom';
import { ImageIcon, Film, UploadCloud } from 'lucide-react';
import { SlidingTabs, type SlidingTabItem } from './SlidingTabs';
import type { GallerySection } from '../lib/useGallery';

const SECTIONS: SlidingTabItem<GallerySection>[] = [
  { key: 'thumbnails', label: 'Thumbnails', icon: ImageIcon },
  { key: 'posters', label: 'Posters', icon: Film },
  { key: 'uploads', label: 'My Uploads', icon: UploadCloud },
];

interface BottomSectionPillProps {
  section: GallerySection;
  onChange: (next: GallerySection) => void;
  counts?: Partial<Record<GallerySection, number>>;
}

/**
 * The library switcher, docked at the bottom of the viewport.
 *
 * Portal-rendered because TopBar carries a scroll transform, and a transformed
 * ancestor becomes the containing block for `position: fixed` descendants --
 * that bug previously pushed the colour dialog off-screen.
 *
 * One surface, not two: a single `bg-surface` plate carries a hairline and a
 * two-step shadow. A nested translucent panel inside another one reads as a
 * seam, and blur stacked on blur costs a full-frame composite on every scroll
 * frame for no legibility gain once the plate is opaque.
 *
 * Retreats on scroll down so it never covers the last row, returns on scroll up
 * or at the top. It is a wayfinding control, not a reading control.
 */
export const BottomSectionPill: React.FC<BottomSectionPillProps> = ({
  section,
  onChange,
  counts,
}) => {
  const [mounted, setMounted] = React.useState(false);
  const [retreat, setRetreat] = React.useState(false);
  const lastY = React.useRef(0);
  const ticking = React.useRef(false);

  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    const onScroll = () => {
      if (ticking.current) return;
      ticking.current = true;
      window.requestAnimationFrame(() => {
        const y = window.scrollY;
        const delta = y - lastY.current;
        if (y <= 80) setRetreat(false);
        else if (delta > 8 && y > 200) setRetreat(true);
        else if (delta < -8) setRetreat(false);
        lastY.current = y;
        ticking.current = false;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (!mounted) return null;

  const dock = (
    <div
      className={`pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 transition-all duration-300 ease-fluid motion-reduce:transition-none ${
        retreat
          ? 'translate-y-[calc(100%+1rem)] opacity-0'
          : 'translate-y-0 opacity-100'
      }`}
      // pb-4 clears the safe-area inset on iOS; env() has no effect elsewhere.
      style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
    >
      {/* max-w keeps the plate inside a 320px viewport; overflow-x lets the three
          segments stay legible instead of wrapping into two rows, which would
          break the pill's single-slide geometry. */}
      <div
        className="pointer-events-auto max-w-[calc(100vw-2rem)] overflow-x-auto overflow-y-hidden rounded-lg border border-line bg-surface shadow-elevated scrollbar-none"
        role="group"
        aria-label="Library section"
      >
        <SlidingTabs
          items={SECTIONS}
          value={section}
          onChange={onChange}
          ariaLabel="Section"
          bare
          className="w-max gap-0.5 p-1"
        />
      </div>
    </div>
  );

  return createPortal(dock, document.body);
};

export default BottomSectionPill;