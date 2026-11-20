'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Compass,
  Bookmark,
  Plus,
  ChevronLeft,
  Folder,
  Shuffle,
  LogOut,
  LogIn,
  X,
  Check,
  Settings,
  Upload,
  Camera,
  Trash2,
  Layers,
  User as UserIcon,
  RotateCcw,
} from 'lucide-react';
import { useAuth } from '../lib/authContext';
import { useAppearance } from '../lib/appearanceContext';
import { deleteCurrentUserAccount } from '../lib/firebase';
import { CollectionBoard } from '../lib/types';
import { AppLogo } from './icons/AppLogo';
import { GlassAppearanceControls } from './AppearanceSettingsPanel';
import { sanitizeSafeImageSrc } from '../lib/urlSafety';

interface AppSidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  selectedNiche: string;
  onSelectNiche: (niche: string) => void;
  categoryCounts: Record<string, number>;
  collections: CollectionBoard[];
  selectedBoardId?: string | null;
  onSelectBoard?: (boardId: string | null) => void;
  onOpenMoodboard: () => void;
  onOpenAdd?: () => void;
  onShuffle?: () => void;
  categories: string[];
  onAddCategory?: (category: string) => void;
  onRemoveCategory?: (category: string) => void;
  totalThumbnailsCount?: number;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({
  isCollapsed,
  onToggleCollapse,
  selectedNiche,
  onSelectNiche,
  categoryCounts,
  collections,
  selectedBoardId,
  onSelectBoard,
  onOpenMoodboard,
  onOpenAdd,
  onShuffle,
  categories,
  onAddCategory,
  onRemoveCategory,
  totalThumbnailsCount = 0,
  isMobileOpen = false,
  onCloseMobile,
}) => {
  const { user, isAdmin, signingIn, signIn, signOut, getIdToken, error: authError } = useAuth();
  const { resetAppearance } = useAppearance();
  const [mounted, setMounted] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [modalCategoryInput, setModalCategoryInput] = useState('');

  // Unified Settings Drawer state (combines Liquid Glass + Account/Profile/Legal)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'glass' | 'account'>('glass');
  const [customName, setCustomName] = useState('');
  const [customPhoto, setCustomPhoto] = useState('');
  const [editNameInput, setEditNameInput] = useState('');
  const [editPhotoInput, setEditPhotoInput] = useState('');
  const [avatarLoadError, setAvatarLoadError] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSavedMessage, setProfileSavedMessage] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (!user) {
      setCustomName('');
      setCustomPhoto('');
      try {
        localStorage.removeItem('thumbfeed_custom_profile');
      } catch {}
      return;
    }

    let cancelled = false;
    const loadProfile = async () => {
      const token = await getIdToken();
      if (!token || cancelled) return;
      try {
        const res = await fetch('/api/profile', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (cancelled) return;
        if (data && (data.name || data.photoURL)) {
          setCustomName(data.name || '');
          setCustomPhoto(data.photoURL || '');
          try {
            localStorage.setItem(
              'thumbfeed_custom_profile',
              JSON.stringify({ name: data.name || '', photoURL: data.photoURL || '' })
            );
          } catch {}
        }
      } catch {}
    };

    loadProfile();
    window.addEventListener('thumbfeed_r2_synced', loadProfile);
    return () => {
      cancelled = true;
      window.removeEventListener('thumbfeed_r2_synced', loadProfile);
    };
  }, [user, getIdToken]);

  React.useEffect(() => {
    setAvatarLoadError(false);
  }, [customPhoto, user?.photoURL]);

  React.useEffect(() => {
    if (!isSettingsOpen && !isCategoryModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isDeletingAccount) {
        setIsSettingsOpen(false);
        setIsCategoryModalOpen(false);
        setShowDeleteConfirm(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSettingsOpen, isCategoryModalOpen, isDeletingAccount]);

  const handleOpenSettings = (tab: 'glass' | 'account' = 'glass') => {
    setProfileError(null);
    setProfileSavedMessage(null);
    setDeleteError(null);
    setShowDeleteConfirm(false);
    if (user) {
      setEditNameInput(customName || user?.displayName || 'User');
      setEditPhotoInput(customPhoto || user?.photoURL || '');
    }
    setSettingsTab(tab);
    setIsSettingsOpen(true);
    if (onCloseMobile) onCloseMobile();
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setProfileError(null);
    const finalName = editNameInput.trim() || 'User';
    const finalPhoto = editPhotoInput.trim();
    const token = await getIdToken();
    if (!token) {
      setProfileError('Please sign in again to save profile changes.');
      return;
    }
    setCustomName(finalName);
    setCustomPhoto(finalPhoto);
    try {
      localStorage.setItem(
        'thumbfeed_custom_profile',
        JSON.stringify({ name: finalName, photoURL: finalPhoto })
      );
    } catch {}
    try {
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: finalName, photoURL: finalPhoto }),
      });
      if (!res.ok) {
        setProfileError('Could not sync profile changes to the server.');
        return;
      }
    } catch {
      setProfileError('Network error saving profile.');
      return;
    }
    setProfileSavedMessage('Profile saved');
    window.setTimeout(() => setProfileSavedMessage(null), 2400);
  };

  const handleDeleteAccount = async () => {
    setIsDeletingAccount(true);
    setDeleteError(null);
    try {
      await deleteCurrentUserAccount();
      setCustomName('');
      setCustomPhoto('');
      setEditNameInput('');
      setEditPhotoInput('');
      try {
        localStorage.removeItem('thumbfeed_custom_profile');
      } catch {}
      setShowDeleteConfirm(false);
      setIsSettingsOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      setDeleteError(
        msg && msg.includes('reauthenticate')
          ? 'Please complete Google confirmation to delete your account.'
          : 'Could not delete account right now. Please try again.'
      );
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') {
      setProfileError('Please upload a PNG, JPG, or WebP image.');
      e.target.value = '';
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setProfileError('Avatar image must be under 2MB.');
      e.target.value = '';
      return;
    }
    setProfileError(null);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setEditPhotoInput(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCreateCategoryInModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalCategoryInput.trim()) return;
    if (onAddCategory) {
      onAddCategory(modalCategoryInput.trim());
    }
    setModalCategoryInput('');
  };

  // Sort categories by thumbnail count descending (highest at top, lowest at bottom)
  const sortedCategories = React.useMemo(() => {
    return [...categories].sort((a, b) => {
      const countDiff = (categoryCounts[b] ?? 0) - (categoryCounts[a] ?? 0);
      if (countDiff !== 0) return countDiff;
      return a.localeCompare(b);
    });
  }, [categories, categoryCounts]);

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-black/55 backdrop-blur-sm md:hidden animate-in fade-in duration-150"
        />
      )}

      <aside
        className={`fixed top-0 left-0 bottom-0 md:top-2.5 md:left-2.5 md:bottom-2.5 md:rounded-[20px] z-50 md:z-40 flex flex-col glass-sidebar transition-all duration-200 select-none overflow-hidden ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        } ${isCollapsed ? 'md:w-[68px]' : 'md:w-[260px]'} w-[260px]`}
      >
        {/* Top Header / Brand Mark */}
        <div className="h-14 flex items-center justify-between px-3.5 border-b border-white/[0.10]">
          {isCollapsed ? (
            /* When collapsed, clicking the logo expands the sidebar */
            <button
              type="button"
              onClick={onToggleCollapse}
              aria-label="Expand sidebar"
              className="w-full flex items-center justify-center p-1 rounded-lg hover:bg-white/[0.06] transition-colors group"
              title="Click to expand sidebar"
            >
              <AppLogo className="w-8 h-8 group-hover:scale-105 transition-transform" />
            </button>
          ) : (
            <>
              <Link
                href="/"
                className="flex items-center gap-2.5 overflow-hidden transition-opacity"
                title="ThumbFeed Home"
              >
                <AppLogo className="w-7 h-7 shrink-0" />
                <div className="flex flex-col min-w-0">
                  <span className="font-logo font-bold text-lg tracking-tight text-white">
                    ThumbFeed
                  </span>
                </div>
              </Link>

              <button
                type="button"
                onClick={onToggleCollapse}
                aria-label="Collapse sidebar"
                className="p-1 rounded-md text-white/50 hover:text-white hover:bg-white/[0.06] transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </>
          )}
        </div>

        {/* Main Content Area */}
        <div className="flex-1 min-h-0 flex flex-col px-2.5 py-3 gap-3 overflow-hidden">
          
          {/* Top Intact Sections (Explore, Boards) */}
          <div className="shrink-0 space-y-3">
            {/* Primary Navigation: Explore with Small Plus Icon to Add Thumbnails */}
            <nav className="space-y-1">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  data-testid="sidebar-explore-btn"
                  onClick={() => {
                    onSelectNiche('All');
                    if (onSelectBoard) onSelectBoard(null);
                  }}
                  className={`flex-1 flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                    selectedNiche === 'All' && !selectedBoardId
                      ? 'glass-active text-white'
                      : 'border-transparent text-white/70 hover:text-white hover:bg-white/[0.08]'
                  } ${isCollapsed ? 'justify-center' : ''}`}
                  title="Explore Feed"
                >
                  <Compass className="w-4 h-4 shrink-0 text-white/80" />
                  {!isCollapsed && <span className="flex-1 text-left">Explore</span>}
                  {!isCollapsed && totalThumbnailsCount > 0 && (
                    <span className="text-[10px] font-mono tabular-nums text-white/40">
                      {totalThumbnailsCount}
                    </span>
                  )}
                </button>

                {/* Plus Icon to Add Thumbnails next to Explore */}
                {!isCollapsed && onOpenAdd && (
                  <button
                    type="button"
                    onClick={onOpenAdd}
                    className="p-1.5 rounded-lg text-white/45 hover:text-white hover:bg-white/[0.08] transition-colors"
                    title="Add Thumbnails"
                    aria-label="Add Thumbnails"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {isCollapsed && onOpenAdd && (
                <button
                  type="button"
                  onClick={onOpenAdd}
                  className="w-full flex items-center justify-center p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/[0.06] transition-colors mt-0.5"
                  title="Add Thumbnails"
                  aria-label="Add Thumbnails"
                >
                  <Plus className="w-4 h-4" />
                </button>
              )}
            </nav>

            {/* Section: BOARDS (User creates and manages) */}
            {!isCollapsed && (
              <div className="pt-1">
                <div className="flex items-center justify-between px-2.5 mb-1.5">
                  <span className="text-[11px] font-medium tracking-wider text-white/40 uppercase">
                    Boards
                  </span>
                  <button
                    type="button"
                    onClick={onOpenMoodboard}
                    className="p-1 -mr-1 text-white/40 hover:text-white hover:bg-white/[0.05] rounded transition-colors"
                    title="Create New Board"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-0.5">
                  {collections.length === 0 ? (
                    <button
                      type="button"
                      onClick={onOpenMoodboard}
                      className="w-full text-left px-2.5 py-2 rounded-md border border-dashed border-white/10 hover:border-white/20 text-[11px] text-white/40 hover:text-white/70 transition-colors flex items-center gap-2"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Create your first board</span>
                    </button>
                  ) : (
                    collections.map((board) => {
                      const isSelected = selectedBoardId === board.id;
                      return (
                        <button
                          key={board.id}
                          type="button"
                          onClick={() => {
                            if (onSelectBoard) {
                              onSelectBoard(isSelected ? null : board.id);
                            } else {
                              onOpenMoodboard();
                            }
                          }}
                          className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-all group border ${
                            isSelected
                              ? 'glass-active text-white font-medium'
                              : 'border-transparent text-white/70 hover:text-white hover:bg-white/[0.08]'
                          }`}
                          title={board.description || board.name}
                        >
                          <Folder className="w-3.5 h-3.5 text-white/40 group-hover:text-white/70 shrink-0" />
                          <span className="truncate flex-1 text-left">{board.name}</span>
                          <span className="text-[10px] font-mono tabular-nums text-white/30">
                            {board.thumbnailIds?.length || 0}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Section: CATEGORIES (Only this area scrolls, rest of sidebar stays intact) */}
          {!isCollapsed && (
            <div className="flex-1 min-h-0 flex flex-col pt-1">
              <div className="shrink-0 flex items-center justify-between px-2.5 mb-1.5">
                <span className="text-[11px] font-medium tracking-wider text-white/40 uppercase">
                  Categories
                </span>
                {isAdmin && onAddCategory && (
                  <button
                    type="button"
                    onClick={() => setIsCategoryModalOpen(true)}
                    className="p-1 -mr-1 text-white/40 hover:text-white hover:bg-white/[0.05] rounded transition-colors cursor-pointer"
                    title="Manage Categories"
                    aria-label="Manage Categories"
                  >
                    <Settings className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Scrollable Categories List */}
              <div className="flex-1 min-h-0 overflow-y-auto space-y-0.5 pr-1 pb-6 categories-scroll">
                {/* 'All' Category */}
                <button
                  type="button"
                  data-testid="sidebar-all-category-btn"
                  onClick={() => {
                    onSelectNiche('All');
                    if (onSelectBoard) onSelectBoard(null);
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-all border ${
                    selectedNiche === 'All' && !selectedBoardId
                      ? 'bg-white/[0.09] border-white/[0.14] text-white font-medium'
                      : 'border-transparent text-white/65 hover:text-white hover:bg-white/[0.07]'
                  }`}
                >
                  <span className="truncate flex-1 text-left">All</span>
                  {totalThumbnailsCount > 0 && (
                    <span className="text-[10px] font-mono tabular-nums text-white/45">
                      {totalThumbnailsCount}
                    </span>
                  )}
                </button>

                {sortedCategories.map((category) => {
                  const isSelected = selectedNiche === category && !selectedBoardId;
                  const count = categoryCounts[category] ?? 0;
                  return (
                    <div
                      key={category}
                      data-testid="sidebar-category-row"
                      className={`group/item relative flex items-center rounded-lg transition-all border ${
                        isSelected
                          ? 'bg-white/[0.11] border-white/[0.16] text-white font-medium'
                          : 'border-transparent text-white/65 hover:text-white hover:bg-white/[0.07]'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          onSelectNiche(category);
                          if (onSelectBoard) onSelectBoard(null);
                        }}
                        className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 text-xs transition-colors min-w-0"
                      >
                        <span className="truncate flex-1 text-left">{category}</span>
                        {count > 0 && (
                          <span
                            data-testid="sidebar-category-count"
                            className={`text-[10px] font-mono tabular-nums text-white/40 shrink-0 transition-opacity ${
                              onRemoveCategory
                                ? 'group-hover/item:opacity-0 group-focus-within/item:opacity-0'
                                : 'group-hover/item:text-white/60'
                            }`}
                          >
                            {count}
                          </span>
                        )}
                      </button>

                      {/* Delete category button overlaid on hover so count aligns flush right with All */}
                      {onRemoveCategory && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onRemoveCategory(category);
                          }}
                          className="absolute right-1.5 top-1/2 -translate-y-1/2 opacity-0 group-hover/item:opacity-100 focus-visible:opacity-100 p-1 text-white/40 hover:text-red-400 rounded transition-opacity cursor-pointer"
                          title={`Delete ${category}`}
                          aria-label={`Delete ${category}`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>

        {/* Bottom Pinned Footer: Auth, Profile & Unified Settings Button */}
        <div className="shrink-0 border-t border-white/[0.10] p-2.5">
          {mounted && user ? (() => {
            const effectiveName = customName || user.displayName || user.email?.split('@')[0] || 'User';
            const effectivePhoto = sanitizeSafeImageSrc(customPhoto || user.photoURL || '');

            return (
              <div
                className={`flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/[0.07] transition-colors ${
                  isCollapsed ? 'flex-col justify-center gap-1.5 px-0' : ''
                }`}
              >
                <button
                  type="button"
                  onClick={() => handleOpenSettings('account')}
                  className="relative group shrink-0 cursor-pointer"
                  title="Profile & Account Settings"
                  aria-label="Edit profile avatar"
                >
                  {effectivePhoto && !avatarLoadError ? (
                    <img
                      src={effectivePhoto}
                      alt={effectiveName}
                      referrerPolicy="no-referrer"
                      onError={() => setAvatarLoadError(true)}
                      className="w-7 h-7 rounded-full object-cover ring-1 ring-white/25 group-hover:ring-white/60 transition-all"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-white/[0.14] flex items-center justify-center text-white text-[11px] font-bold ring-1 ring-white/25 group-hover:ring-white/60 transition-all">
                      {effectiveName[0]?.toUpperCase() || 'U'}
                    </div>
                  )}
                  <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Camera className="w-3 h-3 text-white" />
                  </div>
                </button>

                {!isCollapsed && (
                  <button
                    type="button"
                    onClick={() => handleOpenSettings('account')}
                    className="flex-1 min-w-0 text-left cursor-pointer"
                    title="Profile & Account Settings"
                  >
                    <div className="text-xs text-white truncate font-medium hover:text-white/85 transition-colors">
                      {effectiveName}
                    </div>
                  </button>
                )}

                <div className={`flex items-center gap-1 ${isCollapsed ? 'flex-col' : ''}`}>
                  <button
                    type="button"
                    data-testid="sidebar-settings-btn"
                    onClick={() => handleOpenSettings('glass')}
                    className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                      isSettingsOpen
                        ? 'glass-active text-white'
                        : 'text-white/60 hover:text-white hover:bg-white/[0.10]'
                    }`}
                    title="Settings (Liquid Glass & Account)"
                    aria-label="Settings"
                  >
                    <Settings className="w-3.5 h-3.5" />
                  </button>
                  {!isCollapsed && (
                    <button
                      type="button"
                      onClick={() => signOut()}
                      className="p-1.5 rounded-lg text-white/55 hover:text-red-300 hover:bg-white/[0.10] transition-colors cursor-pointer"
                      title="Sign out"
                      aria-label="Sign out"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })() : (
            <div className="space-y-1.5">
              <div className={`flex items-center gap-1.5 ${isCollapsed ? 'flex-col' : ''}`}>
                <button
                  type="button"
                  data-testid="sidebar-signin-btn"
                  onClick={() => signIn()}
                  disabled={signingIn}
                  aria-label="Sign in with Google"
                  title="Sign in with Google"
                  className={`flex-1 flex items-center justify-center gap-2 h-9 px-3 rounded-lg glass-control text-xs font-medium text-white transition-all cursor-pointer disabled:opacity-50 ${
                    isCollapsed ? 'w-full px-0' : ''
                  }`}
                >
                  <LogIn className="w-3.5 h-3.5 shrink-0 text-white/85" />
                  {!isCollapsed && <span className="truncate">{signingIn ? 'Signing in...' : 'Sign in with Google'}</span>}
                </button>

                <button
                  type="button"
                  data-testid="sidebar-settings-btn"
                  onClick={() => handleOpenSettings('glass')}
                  aria-label="Settings"
                  title="Settings (Liquid Glass & Background)"
                  className={`h-9 w-9 shrink-0 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                    isCollapsed ? 'w-full' : ''
                  } ${
                    isSettingsOpen
                      ? 'glass-active text-white'
                      : 'glass-control text-white/75 hover:text-white'
                  }`}
                >
                  <Settings className="w-3.5 h-3.5" />
                </button>
              </div>
              {authError && !isCollapsed && (
                <p className="px-1.5 text-[10px] text-red-300 leading-snug">{authError}</p>
              )}
            </div>
          )}
        </div>
      </aside>

      {/* Unified Floating Liquid Glass Settings Drawer (Liquid Glass + Account/Legal) */}
      {isSettingsOpen && (
        <div
          className="fixed inset-0 z-[70] flex justify-end"
          role="dialog"
          aria-modal="true"
          aria-label="Settings"
        >
          {/* Light transparent dismiss layer so the user sees live liquid glass updates behind the drawer */}
          <div
            className="fixed inset-0 bg-black/20 transition-opacity"
            onClick={() => setIsSettingsOpen(false)}
          />

          <div
            onClick={(e) => e.stopPropagation()}
            className="relative z-10 m-2 sm:m-3 w-[calc(100%-16px)] max-w-[400px] h-[calc(100%-16px)] sm:h-[calc(100%-24px)] rounded-[20px] glass-modal flex flex-col overflow-hidden text-white animate-in slide-in-from-top-1 duration-200"
          >
            {/* Unified Header */}
            <div className="shrink-0 px-5 pt-4 pb-3 border-b border-white/[0.10] space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-[10px] glass-control flex items-center justify-center text-white/90 shrink-0">
                    <Settings className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-sm font-semibold tracking-tight text-white truncate">
                      Settings
                    </h2>
                    <p className="text-[11px] text-white/55 truncate">
                      Liquid Glass appearance &amp; account preferences
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(false)}
                  aria-label="Close Settings"
                  className="w-8 h-8 rounded-lg glass-control flex items-center justify-center text-white/65 hover:text-white transition-colors cursor-pointer shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Unified Segmented Tabs */}
              <div
                role="tablist"
                aria-label="Settings sections"
                className="grid grid-cols-2 gap-1 p-1 rounded-[10px] glass-input"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={settingsTab === 'glass'}
                  onClick={() => setSettingsTab('glass')}
                  className={`flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-[7px] text-xs font-medium transition-all cursor-pointer ${
                    settingsTab === 'glass'
                      ? 'glass-active text-white'
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Liquid Glass</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={settingsTab === 'account'}
                  onClick={() => setSettingsTab('account')}
                  className={`flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-[7px] text-xs font-medium transition-all cursor-pointer ${
                    settingsTab === 'account'
                      ? 'glass-active text-white'
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  <UserIcon className="w-3.5 h-3.5" />
                  <span>Account</span>
                </button>
              </div>
            </div>

            {/* Scrollable Tab Body */}
            <div className="flex-1 overflow-y-auto px-5 py-4 categories-scroll">
              {settingsTab === 'glass' ? (
                <GlassAppearanceControls isActive={isSettingsOpen && settingsTab === 'glass'} />
              ) : user ? (
                <div className="space-y-5">
                  <form onSubmit={handleSaveProfile} className="space-y-4">
                    {/* Avatar Preview & Upload */}
                    <div className="flex items-center gap-3">
                      <div className="relative w-14 h-14 rounded-full overflow-hidden bg-white/[0.06] border border-white/15 shrink-0 flex items-center justify-center">
                        {sanitizeSafeImageSrc(editPhotoInput) ? (
                          <img
                            src={sanitizeSafeImageSrc(editPhotoInput)}
                            alt="Avatar Preview"
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-base font-bold text-white/60">
                            {(editNameInput || 'U')[0]?.toUpperCase()}
                          </span>
                        )}
                      </div>

                      <div className="flex-1 space-y-1">
                        <label className="text-[11px] font-medium text-white/70 block">
                          Profile Picture
                        </label>
                        <label className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg glass-control text-white text-xs cursor-pointer transition-colors">
                          <Upload className="w-3 h-3" />
                          <span>Upload image</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleFileUpload}
                            className="hidden"
                          />
                        </label>
                        {editPhotoInput && (
                          <button
                            type="button"
                            onClick={() => setEditPhotoInput('')}
                            className="text-[10px] text-white/45 hover:text-red-400 block transition-colors cursor-pointer"
                          >
                            Remove photo
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Photo URL Input */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-white/70 block">
                        Or paste Image URL
                      </label>
                      <input
                        type="url"
                        value={editPhotoInput}
                        onChange={(e) => setEditPhotoInput(e.target.value)}
                        placeholder="https://example.com/avatar.jpg"
                        className="w-full rounded-[10px] glass-input px-3 py-2 text-xs text-white placeholder-white/35 focus:outline-none"
                      />
                    </div>

                    {/* Name Input */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-white/70 block">
                        Display Name
                      </label>
                      <input
                        type="text"
                        value={editNameInput}
                        onChange={(e) => setEditNameInput(e.target.value)}
                        placeholder="Your Name"
                        maxLength={80}
                        required
                        className="w-full rounded-[10px] glass-input px-3 py-2 text-xs text-white placeholder-white/35 focus:outline-none"
                      />
                    </div>

                    {profileError && (
                      <p className="text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                        {profileError}
                      </p>
                    )}

                    {profileSavedMessage && (
                      <p className="text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2 flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5" />
                        <span>{profileSavedMessage}</span>
                      </p>
                    )}

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="submit"
                        className="px-4 py-1.5 rounded-lg bg-white text-black hover:bg-white/90 text-xs font-semibold transition-colors cursor-pointer"
                      >
                        Save profile
                      </button>
                    </div>
                  </form>

                  {/* About, Privacy & Terms (shown when signed in with Google) */}
                  <div className="pt-4 border-t border-white/[0.10] space-y-2.5">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-white/55 block">
                      App Information &amp; Legal
                    </span>
                    <div className="grid grid-cols-3 gap-2">
                      <Link
                        href="/about"
                        onClick={() => setIsSettingsOpen(false)}
                        className="px-2.5 py-2 rounded-lg glass-control text-center text-xs text-white/85 hover:text-white transition-colors"
                      >
                        About
                      </Link>
                      <Link
                        href="/privacy"
                        onClick={() => setIsSettingsOpen(false)}
                        className="px-2.5 py-2 rounded-lg glass-control text-center text-xs text-white/85 hover:text-white transition-colors"
                      >
                        Privacy
                      </Link>
                      <Link
                        href="/terms"
                        onClick={() => setIsSettingsOpen(false)}
                        className="px-2.5 py-2 rounded-lg glass-control text-center text-xs text-white/85 hover:text-white transition-colors"
                      >
                        Terms
                      </Link>
                    </div>
                  </div>

                  {/* Account Deletion */}
                  <div className="pt-4 border-t border-white/[0.10] space-y-2.5">
                    {!showDeleteConfirm ? (
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] text-white/50">
                          Remove your account &amp; saved boards
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowDeleteConfirm(true)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-300 text-[11px] font-medium transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Delete account</span>
                        </button>
                      </div>
                    ) : (
                      <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/25 space-y-2">
                        <p className="text-[11px] text-red-200 leading-relaxed">
                          This permanently deletes your Google-linked profile, saved boards, and preferences from ThumbFeed.
                        </p>
                        {deleteError && (
                          <p className="text-[11px] text-red-300">{deleteError}</p>
                        )}
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            disabled={isDeletingAccount}
                            onClick={() => setShowDeleteConfirm(false)}
                            className="px-2.5 py-1 rounded-lg text-[11px] text-white/70 hover:text-white cursor-pointer"
                          >
                            Keep account
                          </button>
                          <button
                            type="button"
                            disabled={isDeletingAccount}
                            onClick={handleDeleteAccount}
                            className="px-3 py-1 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-[11px] font-semibold cursor-pointer"
                          >
                            {isDeletingAccount ? 'Deleting...' : 'Permanently delete'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="py-8 px-4 rounded-[14px] glass-card text-center space-y-3">
                  <div className="w-10 h-10 rounded-lg glass-control mx-auto flex items-center justify-center text-white/80">
                    <UserIcon className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold text-white">Sign in to manage account</h3>
                    <p className="text-xs text-white/55 leading-relaxed">
                      Sign in with Google to edit your profile, sync saved boards across devices, and access account settings.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => signIn()}
                    disabled={signingIn}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-white text-black hover:bg-white/90 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    <span>{signingIn ? 'Signing in...' : 'Sign in with Google'}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Unified Footer */}
            <div className="shrink-0 flex items-center justify-between gap-2 px-5 py-3.5 border-t border-white/[0.10]">
              {settingsTab === 'glass' ? (
                <button
                  type="button"
                  onClick={resetAppearance}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white/65 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset defaults</span>
                </button>
              ) : user ? (
                <button
                  type="button"
                  onClick={() => {
                    setIsSettingsOpen(false);
                    signOut();
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-300/80 hover:text-red-200 hover:bg-red-500/10 transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign out</span>
                </button>
              ) : (
                <span className="text-[11px] text-white/45">ThumbFeed</span>
              )}

              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="px-4 py-1.5 rounded-lg bg-white text-black hover:bg-white/90 text-xs font-semibold transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Category Management Modal (Add and Remove any category) */}
      {isCategoryModalOpen && (
        <div
          onClick={() => setIsCategoryModalOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-sm animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-[20px] glass-modal p-5 space-y-4 animate-in zoom-in-95"
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-white/[0.05] border border-white/10 flex items-center justify-center text-white/80">
                  <Settings className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Manage Categories</h3>
                  <p className="text-[11px] text-white/40">Add new categories or delete any category</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCategoryModalOpen(false)}
                aria-label="Close Manage Categories modal"
                className="p-1 text-white/40 hover:text-white rounded transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Add new category form */}
            <form onSubmit={handleCreateCategoryInModal} className="flex gap-2">
              <input
                type="text"
                value={modalCategoryInput}
                onChange={(e) => setModalCategoryInput(e.target.value)}
                placeholder="New category name (e.g. 3D Design, Gaming, Vlog)..."
                className="flex-1 rounded-lg border border-white/15 bg-white/[0.04] px-3 py-2 text-xs text-white placeholder-white/30 focus:border-white/30 focus:outline-none"
              />
              <button
                type="submit"
                disabled={!modalCategoryInput.trim()}
                className="px-3.5 py-2 rounded-lg bg-white text-black hover:bg-white/90 disabled:opacity-40 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Add</span>
              </button>
            </form>

            {/* Categories List with Delete for each */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-medium text-white/40 uppercase tracking-wider px-1">
                <span>All Categories ({categories.length})</span>
              </div>
              <div className="max-h-64 overflow-y-auto space-y-1 pr-1 categories-scroll border border-white/[0.06] rounded-xl p-2 bg-white/[0.02]">
                {categories.map((category) => {
                  const count = categoryCounts[category] ?? 0;
                  return (
                    <div
                      key={category}
                      className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.04] transition-colors group"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-medium text-white truncate">{category}</span>
                        {count > 0 && (
                          <span className="text-[10px] font-mono text-white/40 bg-white/[0.05] px-1.5 py-0.5 rounded">
                            {count} items
                          </span>
                        )}
                      </div>
                      {onRemoveCategory && (
                        <button
                          type="button"
                          onClick={() => onRemoveCategory(category)}
                          className="p-1 rounded text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                          title={`Remove "${category}" category`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-white/[0.06]">
              <button
                type="button"
                onClick={() => setIsCategoryModalOpen(false)}
                className="px-4 py-1.5 rounded-lg bg-white text-black hover:bg-white/90 text-xs font-semibold transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
