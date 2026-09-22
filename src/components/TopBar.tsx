'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { LogOut, X, AlertCircle } from 'lucide-react';
import { IconSun, IconMoon } from './icons/AppIcons';
import { getInitialTheme, toggleTheme, subscribeTheme, ThemeMode } from '../lib/theme';
import { useAuth } from '../lib/authContext';

// Authentic 4-color Google G Icon
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

export const TopBar: React.FC = () => {
  const [isVisible, setIsVisible] = useState(true);
  const [isScrolled, setIsScrolled] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>('light');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const lastScrollY = useRef(0);
  const ticking = useRef(false);

  const { user, isAdmin, loading, signingIn, signIn, signOut, error, clearError } = useAuth();

  // Synchronize theme on mount and listen to changes
  useEffect(() => {
    setTheme(getInitialTheme());
    const unsubscribe = subscribeTheme((newTheme) => {
      setTheme(newTheme);
    });
    return unsubscribe;
  }, []);

  // Close account menu on click outside
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

  // Smooth hide on scroll down, show on scroll up with RAF & hysteresis
  useEffect(() => {
    const handleScroll = () => {
      if (!ticking.current) {
        window.requestAnimationFrame(() => {
          const currentScrollY = window.scrollY;
          const delta = currentScrollY - lastScrollY.current;

          setIsScrolled(currentScrollY > 20);

          if (currentScrollY <= 20) {
            setIsVisible(true);
          } else if (delta > 10 && currentScrollY > 70) {
            // Scrolling DOWN -> Hide
            setIsVisible(false);
            setIsMenuOpen(false);
          } else if (delta < -10) {
            // Scrolling UP -> Show
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

  const handleToggleTheme = () => {
    const next = toggleTheme();
    setTheme(next);
  };

  const handleSignOutClick = async () => {
    await signOut();
    setIsMenuOpen(false);
  };

  return (
    <>
      <header
        className={`fixed top-0 inset-x-0 z-30 px-6 sm:px-10 h-16 flex items-center justify-between transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] pointer-events-none ${
          isVisible ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'
        } ${
          isScrolled
            ? 'bg-[#E4E0D3]/85 dark:bg-[#18181b]/90 backdrop-blur-md border-b border-[#401D1A]/10 dark:border-[#E4E0D3]/20 shadow-[0_4px_16px_-4px_rgba(64,29,26,0.06)] dark:shadow-[0_4px_16px_-4px_rgba(0,0,0,0.5)]'
            : 'bg-transparent'
        }`}
      >
        {/* Brand Name */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <span className="font-extrabold text-xl tracking-tight text-[#401D1A] dark:text-[#FFFFFF] select-none">
            Thumb<span className="text-[#401D1A] dark:text-[#E4E0D3]">Feed</span>
          </span>
        </div>

        {/* Right Side: Theme Toggle & Google Auth */}
        <div className="flex items-center gap-2 sm:gap-2.5 pointer-events-auto" ref={menuRef}>
          {/* Dark Mode / Light Mode Toggle Button */}
          <button
            type="button"
            id="theme-toggle-btn"
            onClick={handleToggleTheme}
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            className="w-10 h-10 rounded-[15px] bg-[#FFFFFF] dark:bg-[#27272a] border border-[#401D1A]/20 dark:border-white/10 shadow-xs hover:border-[#401D1A] dark:hover:border-[#E4E0D3] hover:shadow-md hover:shadow-[#401D1A]/10 active:scale-95 transition-all duration-200 flex items-center justify-center p-2 text-[#401D1A] dark:text-[#E4E0D3] group cursor-pointer"
          >
            {theme === 'dark' ? (
              <IconSun className="w-5 h-5 text-[#E4E0D3] group-hover:rotate-45 transition-transform duration-300" />
            ) : (
              <IconMoon className="w-4.5 h-4.5 text-[#401D1A] group-hover:-rotate-12 transition-transform duration-300" />
            )}
          </button>

          {/* If NOT logged in: Direct Google Sign In Button */}
          {!loading && !user && (
            <button
              type="button"
              id="google-signin-btn"
              onClick={() => signIn()}
              disabled={signingIn}
              title="Sign in with Google"
              className="h-10 px-3 sm:px-3.5 rounded-[15px] bg-[#FFFFFF] dark:bg-[#27272a] border border-[#401D1A]/20 dark:border-white/10 shadow-xs hover:border-[#401D1A] dark:hover:border-[#E4E0D3] hover:shadow-md hover:shadow-[#401D1A]/10 active:scale-95 transition-all duration-200 flex items-center gap-2 text-xs font-semibold text-[#401D1A] dark:text-[#FFFFFF] cursor-pointer disabled:opacity-60"
            >
              {signingIn ? (
                <div className="w-4 h-4 border-2 border-[#401D1A] dark:border-white border-t-transparent rounded-full animate-spin shrink-0" />
              ) : (
                <GoogleGIcon className="w-4 h-4 shrink-0" />
              )}
              <span>{signingIn ? 'Signing in...' : 'Sign in'}</span>
            </button>
          )}

          {/* Profile Avatar Button */}
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
              title={user ? `${user.displayName || user.email || 'User'} (Google Account)` : 'Sign in with Google'}
              className="w-10 h-10 rounded-[15px] bg-[#FFFFFF] dark:bg-[#27272a] border border-[#401D1A]/20 dark:border-white/10 shadow-xs hover:border-[#401D1A] dark:hover:border-[#E4E0D3] hover:shadow-md hover:shadow-[#401D1A]/10 active:scale-95 transition-all duration-200 flex items-center justify-center overflow-hidden cursor-pointer relative"
            >
              {user?.photoURL ? (
                /* Authenticated Google Profile Picture */
                <Image
                  src={user.photoURL}
                  alt={user.displayName || 'Google Profile'}
                  width={40}
                  height={40}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover rounded-[13px]"
                />
              ) : user ? (
                /* Authenticated User Initial */
                <span className="font-bold text-sm text-[#401D1A] dark:text-[#E4E0D3]">
                  {(user.displayName || user.email || 'U').charAt(0).toUpperCase()}
                </span>
              ) : (
                /* Unauthenticated Avatar Line Art */
                <div className="p-1.5 w-full h-full flex items-center justify-center">
                  <svg
                    viewBox="0 0 32 32"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-full h-full text-[#401D1A] dark:text-[#E4E0D3] transition-colors"
                  >
                    <path
                      d="M10 13.5C10 9.5 12.5 6.5 16 6.5C19.5 6.5 22 9.5 22 13.5"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                    <path
                      d="M12 13.5H15M17 13.5H20"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                    <path
                      d="M16 13.5V16.5H17"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M14 18.5C14.8 19.5 17.2 19.5 18 18.5"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                    />
                    <path
                      d="M11 14C11 18.2 13.2 21.5 16 21.5C18.8 21.5 21 18.2 21 14"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                    <path
                      d="M14.5 21.5V23.5M17.5 21.5V23.5"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                    />
                    <path
                      d="M7.5 29C8.2 25.5 11.5 23.5 16 23.5C20.5 23.5 23.8 25.5 24.5 29"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                    <circle cx="23" cy="9" r="1.5" fill="#401D1A" className="dark:fill-[#E4E0D3]" />
                  </svg>
                </div>
              )}

              {/* Online / Active Indicator if Signed In */}
              {user && (
                <span className="absolute bottom-1 right-1 w-2.5 h-2.5 bg-emerald-500 border-2 border-white dark:border-[#27272a] rounded-full" />
              )}
            </button>

            {/* User Account Popover Menu */}
            {isMenuOpen && user && (
              <div
                id="account-dropdown-menu"
                className="absolute right-0 mt-2 w-72 p-4 rounded-2xl bg-[#FFFFFF] dark:bg-[#202023] border border-[#401D1A]/15 dark:border-white/10 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150"
              >
                {/* User Header */}
                <div className="flex items-center gap-3 pb-3 border-b border-[#401D1A]/10 dark:border-white/10">
                  {user.photoURL ? (
                    <Image
                      src={user.photoURL}
                      alt={user.displayName || 'Google Profile'}
                      width={44}
                      height={44}
                      referrerPolicy="no-referrer"
                      className="w-11 h-11 rounded-full object-cover border border-[#401D1A]/15 dark:border-white/15 shrink-0"
                    />
                  ) : (
                    <div className="w-11 h-11 rounded-full bg-[#401D1A] dark:bg-[#E4E0D3] text-white dark:text-[#401D1A] flex items-center justify-center font-bold text-base shrink-0">
                      {(user.displayName || user.email || 'U').charAt(0).toUpperCase()}
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-sm text-[#401D1A] dark:text-[#FFFFFF] truncate">
                      {user.displayName || 'Google User'}
                    </p>
                    <p className="text-xs text-[#401D1A]/60 dark:text-[#FFFFFF]/60 truncate">
                      {user.email}
                    </p>
                  </div>
                </div>

                {/* Account Role / Status */}
                {isAdmin ? (
                  <div className="mt-3 py-1.5 px-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-500/20 flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-300">
                    <div className="flex items-center gap-1.5 font-medium">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span>Owner / Admin</span>
                    </div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider bg-emerald-500/10 px-1.5 py-0.5 rounded text-emerald-700 dark:text-emerald-300">
                      Add & Delete Enabled
                    </span>
                  </div>
                ) : (
                  <div className="mt-3 py-1.5 px-2.5 rounded-lg bg-[#E4E0D3]/40 dark:bg-white/5 flex items-center justify-between text-xs text-[#401D1A]/70 dark:text-[#E4E0D3]/70">
                    <div className="flex items-center gap-1.5">
                      <GoogleGIcon className="w-3 h-3 shrink-0" />
                      <span>Viewer</span>
                    </div>
                    <span className="text-[10px] text-[#401D1A]/50 dark:text-[#FFFFFF]/50">
                      Read-only
                    </span>
                  </div>
                )}

                {/* Sign Out Action */}
                <div className="mt-3 pt-2 border-t border-[#401D1A]/10 dark:border-white/10">
                  <button
                    type="button"
                    id="signout-btn"
                    onClick={handleSignOutClick}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Floating Auth Notification / Error Toast if any */}
      {error && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 max-w-md w-full px-4">
          <div className="bg-rose-50 dark:bg-[#2a1717] border border-rose-200 dark:border-rose-900/50 p-3.5 rounded-xl shadow-lg flex items-start gap-3 text-xs text-rose-900 dark:text-rose-200">
            <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-rose-700 dark:text-rose-300">Sign-in Notice</p>
              <p className="mt-0.5 opacity-90">{error}</p>
            </div>
            <button
              type="button"
              onClick={clearError}
              aria-label="Dismiss error"
              className="text-rose-600 dark:text-rose-400 hover:opacity-75 cursor-pointer p-0.5"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
};


