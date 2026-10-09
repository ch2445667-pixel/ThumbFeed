'use client';

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

export interface SlidingTabItem<T extends string> {
  key: T;
  label: string;
  icon?: React.ComponentType<{ className?: string } & Record<string, unknown>>;
}

interface SlidingTabsProps<T extends string> {
  items: SlidingTabItem<T>[];
  value: T;
  onChange: (key: T) => void;
  role?: 'tablist' | 'group';
  ariaLabel: string;
  className?: string;
  /**
   * Draw no container chrome (border, surface, padding, shadow) so the control
   * can sit inside a dock that already provides them. Not done with className
   * overrides: Tailwind resolves conflicting utilities by stylesheet order, not
   * by the order they appear in the attribute, so `rounded-full` would lose to
   * `rounded-lg` unpredictably.
   */
  bare?: boolean;
}

/**
 * Segmented control whose active state is a single pill that SLIDES between
 * segments instead of each segment repainting itself.
 *
 * Why: switching `bg-accent` per button cross-fades two backgrounds, so the
 * eye sees a colour change rather than one object moving. A shared indicator
 * that translates gives the change direction and continuity.
 *
 * The pill's position is measured from the DOM (offsetLeft/offsetWidth) rather
 * than assumed, so it stays correct with responsive label and icon changes.
 * Motion uses the app's spring curve, which overshoots slightly and settles --
 * that overshoot is what reads as tactile.
 */
export function SlidingTabs<T extends string>({
  items,
  value,
  onChange,
  role = 'group',
  ariaLabel,
  className = '',
  bare = false,
}: SlidingTabsProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pill, setPill] = useState<{ left: number; width: number } | null>(null);
  // The pill is not rendered until it has been measured. Rendering it earlier
  // means it mounts at width 0 and then transitions, so the control appears to
  // grow open on every mount instead of sliding only in response to a click.
  const [ready, setReady] = useState(false);

  const measure = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const active = container.querySelector<HTMLElement>(`[data-tab-key="${CSS.escape(value)}"]`);
    if (!active) return;
    setPill({ left: active.offsetLeft, width: active.offsetWidth });
    // Measured in a layout effect, so this is set before the browser paints.
    setReady(true);
  }, [value]);

  useLayoutEffect(() => {
    measure();
  }, [measure]);

  useEffect(() => {
    // Re-measure after fonts settle, since a webfont swap changes widths.
    const t = window.setTimeout(measure, 60);
    window.addEventListener('resize', measure);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('resize', measure);
    };
  }, [measure]);

  const isTablist = role === 'tablist';

  return (
    <div
      ref={containerRef}
      role={role}
      aria-label={ariaLabel}
      className={
        bare
          ? `relative inline-flex items-center ${className || 'gap-0.5 p-1'}`
          : `relative inline-flex items-center rounded-lg border border-line bg-surface p-[3px] shadow-card ${className}`
      }
    >
      {/* The sliding pill. Pointer-events-none so it never eats a click. */}
      {pill && ready && (
        <span
          aria-hidden="true"
          data-sliding-pill=""
          className={`pointer-events-none absolute rounded-md bg-accent shadow-card ease-spring transition-all duration-300 motion-reduce:transition-none ${
            bare ? 'top-1 bottom-1' : 'top-[3px] bottom-[3px]'
          }`}
          style={{ left: pill.left, width: pill.width }}
        />
      )}

      {items.map(({ key, label, icon: Icon }) => {
        const isActive = value === key;
        return (
          <button
            key={key}
            type="button"
            data-tab-key={key}
            role={isTablist ? 'tab' : undefined}
            aria-selected={isTablist ? isActive : undefined}
            aria-pressed={isTablist ? undefined : isActive}
            onClick={() => onChange(key)}
            className={`relative z-10 flex cursor-pointer items-center gap-1.5 rounded-md px-3 ${
              bare ? 'py-2' : 'py-1.5'
            } text-xs font-medium ease-spring transition-[color,transform] duration-200 active:scale-[0.96] motion-reduce:transition-none ${
              isActive ? 'text-accent-on' : 'text-ink-muted hover:text-ink'
            }`}
          >
            {Icon && (
              <Icon
                className={`h-3.5 w-3.5 shrink-0 ease-spring transition-transform duration-300 motion-reduce:transition-none ${
                  isActive ? 'scale-100' : 'scale-90 opacity-70'
                }`}
                strokeWidth={1.75}
              />
            )}
            <span className="whitespace-nowrap">{label}</span>
          </button>
        );
      })}
    </div>
  );
}

export default SlidingTabs;