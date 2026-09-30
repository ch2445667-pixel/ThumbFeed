'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { LogOut, X, AlertCircle, UserRound } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import { ViewModeToggle } from './ViewModeToggle';
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
  showCardInfo?: boolean;
  onToggleCardInfo?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({ showCardInfo = false, onToggleCardInfo }) => {
  const [isVisible, setIsVisible] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const lastScrollY = useRef(0);
  const ticking = useRef(false);

  const { user, isAdmin, loading, signingIn, signIn, signOut, error, clearError } = useAuth();

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

        <div className="relative flex h-16 items-center justify-between px-4 sm:px-6 lg:px-10">
          <div className="pointer-events-auto flex items-center gap-2.5">
            <span className="select-none text-lg font-semibold tracking-tight text-ink">
              Thumb<span className="text-ink-muted">Feed</span>
            </span>
          </div>

          <div ref={menuRef} className="pointer-events-auto flex items-center gap-2">
            {onToggleCardInfo && (
              <ViewModeToggle isDetail={!!showCardInfo} onToggle={onToggleCardInfo} />
            )}

            <ThemeToggle />

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

            <div className="relative">
              <button
                type="button"
                id="profile-avatar-btn"
                onClick={() => {
                  if (user) {
                    setIsMenuOpen((prev) => !prev);
                  } else {
                    signIn();
                  }
                }}
                title={user ? (user.displayName || user.email || 'User') : 'Sign in with Google'}
                aria-label={user ? 'Account menu' : 'Sign in with Google'}
                aria-expanded={isMenuOpen}
                className="grid h-9 w-9 place-items-center overflow-hidden rounded-md border border-line bg-surface text-ink-muted shadow-card transition-colors duration-200 hover:border-line-strong hover:bg-surface-raised hover:text-ink active:scale-[0.98]"
              >
                {user?.photoURL ? (
                  <Image
                    src={user.photoURL}
                    alt={user.displayName || 'Google Profile'}
                    width={36}
                    height={36}
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover"
                  />
                ) : user ? (
                  <span className="text-sm font-medium text-ink">
                    {(user.displayName || user.email || 'U').charAt(0).toUpperCase()}
                  </span>
                ) : (
                  <UserRound className="h-4 w-4" strokeWidth={1.75} />
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
                        className="h-10 w-10 shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent text-sm font-medium text-accent-on">
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
          </div>
        </div>
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
