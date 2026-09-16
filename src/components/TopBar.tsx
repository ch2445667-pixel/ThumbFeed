'use client';

import React, { useState, useEffect, useRef } from 'react';
import { IconSun, IconMoon } from './icons/AppIcons';
import { getInitialTheme, toggleTheme, subscribeTheme, ThemeMode } from '../lib/theme';

export const TopBar: React.FC = () => {
  const [isVisible, setIsVisible] = useState(true);
  const [isScrolled, setIsScrolled] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>('light');
  const lastScrollY = useRef(0);
  const ticking = useRef(false);

  // Synchronize theme on mount and listen to changes
  useEffect(() => {
    setTheme(getInitialTheme());
    const unsubscribe = subscribeTheme((newTheme) => {
      setTheme(newTheme);
    });
    return unsubscribe;
  }, []);

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

  return (
    <header
      className={`fixed top-0 inset-x-0 z-30 px-6 sm:px-10 h-16 flex items-center justify-between transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] pointer-events-none ${
        isVisible ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'
      } ${
        isScrolled
          ? 'bg-white/80 dark:bg-[#090d16]/80 backdrop-blur-md border-b border-slate-100/80 dark:border-slate-800/80 shadow-[0_4px_16px_-4px_rgba(15,23,42,0.04)] dark:shadow-[0_4px_16px_-4px_rgba(0,0,0,0.5)]'
          : 'bg-transparent'
      }`}
    >
      {/* Brand Name - Text Only (No dots) */}
      <div className="flex items-center gap-2 pointer-events-auto">
        <span className="font-extrabold text-xl tracking-tight text-slate-900 dark:text-white select-none">
          Thumb<span className="text-[#009FDF]">Feed</span>
        </span>
      </div>

      {/* Right Side: Theme Toggle & Profile Picture */}
      <div className="flex items-center gap-2.5 pointer-events-auto">
        {/* Dark Mode / Light Mode Toggle Button */}
        <button
          type="button"
          id="theme-toggle-btn"
          onClick={handleToggleTheme}
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          aria-label={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          className="w-10 h-10 rounded-[15px] bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs hover:border-[#009FDF] dark:hover:border-[#009FDF] hover:shadow-md hover:shadow-[#009FDF]/10 active:scale-95 transition-all duration-200 flex items-center justify-center p-2 text-slate-700 dark:text-slate-200 hover:text-[#009FDF] dark:hover:text-[#009FDF] group cursor-pointer"
        >
          {theme === 'dark' ? (
            <IconSun className="w-5 h-5 text-amber-400 group-hover:rotate-45 transition-transform duration-300" />
          ) : (
            <IconMoon className="w-4.5 h-4.5 text-slate-700 group-hover:-rotate-12 transition-transform duration-300" />
          )}
        </button>

        {/* Profile Avatar Button */}
        <button
          type="button"
          id="profile-avatar-btn"
          title="User Profile"
          className="w-10 h-10 rounded-[15px] bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs hover:border-[#009FDF] dark:hover:border-[#009FDF] hover:shadow-md hover:shadow-[#009FDF]/10 active:scale-95 transition-all duration-200 flex items-center justify-center p-1.5 overflow-hidden group cursor-pointer"
        >
          {/* Detailed Line Art Avatar */}
          <svg
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="w-full h-full text-slate-700 dark:text-slate-300 group-hover:text-[#009FDF] dark:group-hover:text-[#009FDF] transition-colors"
          >
            {/* Hair / Head Outline */}
            <path
              d="M10 13.5C10 9.5 12.5 6.5 16 6.5C19.5 6.5 22 9.5 22 13.5"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
            {/* Minimalist Glasses / Brow Line */}
            <path
              d="M12 13.5H15M17 13.5H20"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
            {/* Nose line */}
            <path
              d="M16 13.5V16.5H17"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Smile line */}
            <path
              d="M14 18.5C14.8 19.5 17.2 19.5 18 18.5"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
            {/* Jawline / Face Contour */}
            <path
              d="M11 14C11 18.2 13.2 21.5 16 21.5C18.8 21.5 21 18.2 21 14"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
            {/* Neck / Collar Line */}
            <path
              d="M14.5 21.5V23.5M17.5 21.5V23.5"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
            {/* Shoulders / Upper Body */}
            <path
              d="M7.5 29C8.2 25.5 11.5 23.5 16 23.5C20.5 23.5 23.8 25.5 24.5 29"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
            {/* Subtle Brand Accent Accent Pip */}
            <circle cx="23" cy="9" r="1.5" fill="#f76d25" />
          </svg>
        </button>
      </div>
    </header>
  );
};


