'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { LogOut, X, AlertCircle, Search, Info, ShieldCheck, FileText, Minus, Plus, Shuffle, SlidersHorizontal } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import { ThemeColorEditor } from './ThemeColorEditor';
import { useAuth } from '../lib/authContext';

// Google brand mark. Kept as literal brand geometry, not a hand-drawn icon.
const GoogleGIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg viewBox="0 0 24 24" className={className} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      fill="#4285F4"
    />
    <path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      fill="#34A853"
    />
    <path
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      fill="#FBBC05"
    />
    <path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      fill="#EA4335"
    />
  </svg>
);

interface TopBarProps {
  query?: string;
  onQueryChange?: (q: string) => void;
  resultCount?: number;
  columns?: number;
  onColumnsChange?: (cols: number) => void;
  onShuffle?: () => void;
  onToggleFilter?: () => void;
  isFilterOpen?: boolean;
  activeFilterCount?: number;
  onOpenAdd?: () => void;
  section?: 'thumbnails' | 'posters';
}

interface SearchFieldProps {
  id: string;
  query: string;
  onQueryChange: (q: string) => void;
  resultCount: number;
  autoFocus?: boolean;
  onEscape?: () => void;
}

// Single search control used by both the desktop pill and the mobile row, so
// the two can never drift apart visually or behaviourally.
const SearchField: React.FC<SearchFieldProps> = ({
  id,
  query,
  onQueryChange,
  resultCount,
  autoFocus = false,
  onEscape,
}) => (
  <div className="flex h-9 items-center gap-2 rounded-md border border-line bg-surface px-2.5 shadow-card transition-colors duration-200 focus-within:border-line-strong focus-within:bg-surface-raised">
    <Search className="h-3.5 w-3.5 shrink-0 text-ink-faint" strokeWidth={2} />
    <input
      id={id}
      type="text"
      role="searchbox"
      value={query}
      autoFocus={autoFocus}
      onChange={(e) => onQueryChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          if (query) {
            onQueryChange('');
          } else {
            e.currentTarget.blur();
            onEscape?.();
          }
        }
      }}
      placeholder="Search topics, creators, hooks"
      aria-label="Search thumbnails"
      autoComplete="off"
      spellCheck={false}
      className="min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-faint"
    />
    {query ? (
      <span className="flex shrink-0 items-center gap-1.5">
        <span className="text-[11px] text-ink-faint tabular" title={`${resultCount} matching thumbnails`}>
          {resultCount}
        </span>
        <button
          type="button"
          onClick={() => onQueryChange('')}
          aria-label="Clear search"
          className="grid h-5 w-5 cursor-pointer place-items-center rounded-sm text-ink-faint transition-colors hover:bg-surface-sunken hover:text-ink"
        >
          <X className="h-3 w-3" strokeWidth={2.25} />
        </button>
      </span>
    ) : (
      <kbd className="hidden shrink-0 items-center gap-0.5 rounded-sm border border-line bg-surface-sunken px-1.5 py-0.5 font-mono text-[10px] text-ink-faint lg:inline-flex">
        <span>Ctrl</span>
        <span>K</span>
      </kbd>
    )}
  </div>
);

const RESOURCE_LINKS = [
  { href: '/about', label: 'About', Icon: Info },
  { href: '/privacy', label: 'Privacy Policy', Icon: ShieldCheck },
  { href: '/terms', label: 'Terms of Service', Icon: FileText },
];

export const TopBar: React.FC<TopBarProps> = ({
  query = '',
  onQueryChange,
  resultCount = 0,
  columns = 3,
  onColumnsChange,
  onShuffle,
  onToggleFilter,
  isFilterOpen = false,
  activeFilterCount = 0,
  onOpenAdd,
  section = 'thumbnails',
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const lastScrollY = useRef(0);
  const ticking = useRef(false);

  const { user, isAdmin, loading, signingIn, signIn, signOut, error, clearError } = useAuth();

  const searchEnabled = typeof onQueryChange === 'function';

  // Global Ctrl/Cmd+K focuses search from anywhere on the page.
  useEffect(() => {
    if (!searchEnabled) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (window.innerWidth < 768) {
          setIsMobileSearchOpen(true);
          window.requestAnimationFrame(() => {
            document.getElementById('topbar-search-mobile')?.focus();
          });
        } else {
          document.getElementById('topbar-search')?.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [searchEnabled]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMenuOpen]);

  // Hide on scroll down, reveal on scroll up. rAF-throttled with hysteresis.
  useEffect(() => {
    const handleScroll = () => {
      if (!ticking.current) {
        window.requestAnimationFrame(() => {
          const currentScrollY = window.scrollY;
          const delta = currentScrollY - lastScrollY.current;

          if (currentScrollY <= 20) {
            setIsVisible(true);
          } else if (delta > 10 && currentScrollY > 70) {
            setIsVisible(false);
            setIsMenuOpen(false);
          } else if (delta < -10) {
            setIsVisible(true);
          }

          lastScrollY.current = currentScrollY;
          ticking.current = false;
        });
        ticking.current = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleSignOutClick = async () => {
    await signOut();
    setIsMenuOpen(false);
  };

  return (
    <>
      <header
        className={`pointer-events-none fixed inset-x-0 top-0 z-30 transition-all duration-300 ease-fluid ${
          isVisible ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'
        }`}
      >
        {/* Scrim. The bar is transparent, so without this the wordmark and
            grid collide the moment the page moves. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-canvas via-canvas/85 to-transparent"
        />

        <div className="relative flex h-16 items-center justify-between gap-2 px-4 sm:px-6 lg:px-10">
          <div className="pointer-events-auto flex min-w-0 shrink-0 items-center">
            <span className="font-brand select-none text-[19px] leading-none tracking-tight text-ink">
              Thumb<span className="text-ink-faint">Feed</span>
            </span>
          </div>

          {/* Center search pill on tablet and desktop */}
          {searchEnabled && (
            <div className="pointer-events-auto hidden min-w-0 flex-1 justify-center px-2 md:flex">
              <div className="w-full max-w-md">
                <SearchField
                  id="topbar-search"
                  query={query}
                  onQueryChange={onQueryChange}
                  resultCount={resultCount}
                />
              </div>
            </div>
          )}

          <div ref={menuRef} className="pointer-events-auto flex shrink-0 items-center gap-1.5">
            {/* Mobile search trigger */}
            {searchEnabled && (
              <button
                type="button"
                onClick={() => setIsMobileSearchOpen((v) => !v)}
                aria-label="Search thumbnails"
                aria-expanded={isMobileSearchOpen}
                className="grid h-9 w-9 cursor-pointer place-items-center rounded-md border border-line bg-surface text-ink-muted shadow-card transition-colors duration-200 hover:border-line-strong hover:text-ink md:hidden"
              >
                <Search className="h-4 w-4" strokeWidth={1.75} />
              </button>
            )}

            {/* Grid density stepper. Compact enough to live in the bar. */}
            {onColumnsChange && (
              <div
                className="hidden h-9 items-center gap-0 rounded-md border border-line bg-surface px-1 shadow-card sm:flex"
                role="group"
                aria-label="Grid density"
              >
                <button
                  type="button"
                  onClick={() => onColumnsChange(Math.max(3, columns - 1))}
                  disabled={columns <= 3}
                  aria-label="Fewer columns"
                  className="grid h-7 w-6 cursor-pointer place-items-center rounded-sm text-ink-muted transition-colors hover:bg-surface-raised hover:text-ink disabled:pointer-events-none disabled:opacity-30"
                >
                  <Minus className="h-3.5 w-3.5" strokeWidth={2} />
                </button>
                <span className="mono w-4 text-center text-[11px] text-ink-muted tabular">
                  {columns}
                </span>
                <button
                  type="button"
                  onClick={() => onColumnsChange(Math.min(6, columns + 1))}
                  disabled={columns >= 6}
                  aria-label="More columns"
                  className="grid h-7 w-6 cursor-pointer place-items-center rounded-sm text-ink-muted transition-colors hover:bg-surface-raised hover:text-ink disabled:pointer-events-none disabled:opacity-30"
                >
                  <Plus className="h-3.5 w-3.5" strokeWidth={2} />
                </button>
              </div>
            )}

            {onShuffle && (
              <button
                type="button"
                onClick={onShuffle}
                title="Shuffle gallery"
                aria-label="Shuffle gallery"
                className="hidden h-9 w-9 cursor-pointer place-items-center rounded-md border border-line bg-surface text-ink-muted shadow-card ease-spring transition-all duration-200 hover:border-line-strong hover:text-ink active:scale-[0.9] sm:grid"
              >
                <Shuffle className="h-4 w-4" strokeWidth={1.75} />
              </button>
            )}

            {onToggleFilter && (
              <button
                type="button"
                onClick={onToggleFilter}
                title="Filters"
                aria-label="Open filters"
                aria-expanded={isFilterOpen}
                className="flex h-9 cursor-pointer items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 text-xs font-medium text-ink-muted shadow-card ease-spring transition-all duration-200 hover:border-line-strong hover:bg-surface-raised hover:text-ink active:scale-[0.94] active:shadow-none"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" strokeWidth={1.75} />
                <span className="hidden sm:inline">Filter</span>
                {activeFilterCount > 0 && (
                  <span className="grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-semibold text-accent-on tabular">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            )}

            {onOpenAdd && (
              <button
                type="button"
                onClick={onOpenAdd}
                title={section === 'posters' ? 'Add posters' : 'Add thumbnails'}
                className="flex h-9 cursor-pointer items-center gap-1 rounded-md bg-accent px-2.5 text-xs font-medium text-accent-on shadow-card ease-spring transition-all duration-200 hover:opacity-90 active:scale-[0.94] active:opacity-100"
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={2} />
                <span className="hidden sm:inline">Add</span>
              </button>
            )}

            <ThemeToggle />
            <ThemeColorEditor />

            {!loading && !user && (
              <button
                type="button"
                id="google-signin-btn"
                onClick={() => signIn()}
                disabled={signingIn}
                title="Sign in with Google"
                className="flex h-9 items-center gap-2 rounded-md border border-line bg-surface px-3 text-xs font-medium text-ink shadow-card transition-colors duration-200 hover:border-line-strong hover:bg-surface-raised active:scale-[0.98] disabled:opacity-60"
              >
                {signingIn ? (
                  <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                  <GoogleGIcon className="h-3.5 w-3.5 shrink-0" />
                )}
                <span>{signingIn ? 'Signing in' : 'Sign in'}</span>
              </button>
            )}

            {/* Profile entry appears only after sign-in. Signed-out visitors
                get the Sign in button alone. */}
            {user && (
            <div className="relative">
              <button
                type="button"
                id="profile-avatar-btn"
                onClick={() => setIsMenuOpen((prev) => !prev)}
                title={user.displayName || user.email || 'User'}
                aria-label="Account menu"
                aria-expanded={isMenuOpen}
                className="grid h-9 w-9 place-items-center overflow-hidden rounded-md border border-line bg-surface text-ink-muted shadow-card transition-colors duration-200 hover:border-line-strong hover:bg-surface-raised hover:text-ink active:scale-[0.98]"
              >
                {user.photoURL ? (
                  <Image
                    src={user.photoURL}
                    alt={user.displayName || 'Google Profile'}
                    width={36}
                    height={36}
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-sm font-medium text-ink">
                    {(user.displayName || user.email || 'U').charAt(0).toUpperCase()}
                  </span>
                )}
              </button>

              {isMenuOpen && user && (
                <div
                  id="account-dropdown-menu"
                  className="absolute right-0 z-50 mt-2 w-64 rounded-lg border border-line bg-surface-raised p-3 shadow-elevated"
                >
                  <div className="flex items-center gap-3 pb-3">
                    {user.photoURL ? (
                      <Image
                        src={user.photoURL}
                        alt={user.displayName || 'Google Profile'}
                        width={40}
                        height={40}
                        referrerPolicy="no-referrer"
                        className="h-9 w-9 shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent text-sm font-medium text-accent-on">
                        {(user.displayName || user.email || 'U').charAt(0).toUpperCase()}
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">
                        {user.displayName || 'Google User'}
                      </p>
                      <p className="truncate text-xs text-ink-faint">{user.email}</p>
                    </div>
                  </div>

                  {/* Role is real account state, so it gets a labelled chip
                      rather than an unlaboured green dot. */}
                  <div className="flex items-center justify-between border-t border-line pt-3">
                    <span className="text-xs text-ink-muted">
                      {isAdmin ? 'Owner' : 'Viewer'}
                    </span>
                    <span className="rounded-full border border-line bg-surface px-2 py-0.5 text-[11px] text-ink-faint">
                      {isAdmin ? 'Can edit' : 'Read only'}
                    </span>
                  </div>

                  <nav aria-label="Resources" className="mt-2 border-t border-line pt-2">
                    {RESOURCE_LINKS.map(({ href, label, Icon }) => (
                      <Link
                        key={href}
                        href={href}
                        onClick={() => setIsMenuOpen(false)}
                        className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-xs text-ink-muted transition-colors duration-200 hover:bg-surface hover:text-ink"
                      >
                        <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
                        <span>{label}</span>
                      </Link>
                    ))}
                  </nav>

                  <div className="mt-2 border-t border-line pt-2">
                    <button
                      type="button"
                      id="signout-btn"
                      onClick={handleSignOutClick}
                      className="flex w-full items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-medium text-danger transition-colors duration-200 hover:bg-danger-soft"
                    >
                      <LogOut className="h-3.5 w-3.5" strokeWidth={1.75} />
                      <span>Sign out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
            )}
          </div>
        </div>

        {/* Full-width search row on phones */}
        {searchEnabled && isMobileSearchOpen && (
          <div className="pointer-events-auto relative px-4 pb-3 md:hidden">
            <SearchField
              id="topbar-search-mobile"
              query={query}
              onQueryChange={onQueryChange}
              resultCount={resultCount}
              autoFocus
              onEscape={() => setIsMobileSearchOpen(false)}
            />
          </div>
        )}
      </header>

      {error && (
        <div className="fixed left-1/2 top-20 z-50 w-full max-w-md -translate-x-1/2 px-4">
          <div className="flex items-start gap-3 rounded-md border border-danger-line bg-danger-soft p-3.5 text-xs text-danger shadow-elevated">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} />
            <div className="flex-1">
              <p className="font-medium">Sign-in notice</p>
              <p className="mt-0.5 opacity-90">{error}</p>
            </div>
            <button
              type="button"
              onClick={clearError}
              aria-label="Dismiss error"
              className="cursor-pointer p-0.5 transition-opacity hover:opacity-70"
            >
              <X className="h-4 w-4" strokeWidth={1.75} />
            </button>
          </div>
        </div>
      )}
    </>
  );
};
