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
  Trash2
} from 'lucide-react';
import { useAuth } from '../lib/authContext';
import { CollectionBoard } from '../lib/types';
import { AppLogo } from './icons/AppLogo';
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
  const { user, isAdmin, signIn, signOut } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [modalCategoryInput, setModalCategoryInput] = useState('');
  
  // Custom user profile state (editable pfp & name stored persistently in server + localStorage)
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customPhoto, setCustomPhoto] = useState('');
  const [editNameInput, setEditNameInput] = useState('');
  const [editPhotoInput, setEditPhotoInput] = useState('');
  const [avatarLoadError, setAvatarLoadError] = useState(false);

  React.useEffect(() => {
    setMounted(true);
    try {
      const saved = localStorage.getItem('thumbfeed_custom_profile');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.name) setCustomName(parsed.name);
        if (parsed.photoURL) setCustomPhoto(parsed.photoURL);
      }
    } catch {}
    const loadProfile = () => {
      fetch('/api/profile')
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && (data.name || data.photoURL)) {
            if (data.name) setCustomName(data.name);
            if (data.photoURL) setCustomPhoto(data.photoURL);
            try {
              localStorage.setItem(
                'thumbfeed_custom_profile',
                JSON.stringify({ name: data.name || '', photoURL: data.photoURL || '' })
              );
            } catch {}
          } else {
            // If server is empty but client has a saved profile, persist it to server immediately
            try {
              const saved = localStorage.getItem('thumbfeed_custom_profile');
              if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed.name || parsed.photoURL) {
                  if (parsed.name) setCustomName(parsed.name);
                  if (parsed.photoURL) setCustomPhoto(parsed.photoURL);
                  fetch('/api/profile', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: parsed.name || '', photoURL: parsed.photoURL || '' }),
                  }).catch(() => {});
                }
              }
            } catch {}
          }
        })
        .catch(() => {});
    };

    loadProfile();

    window.addEventListener('thumbfeed_r2_synced', loadProfile);
    return () => {
      window.removeEventListener('thumbfeed_r2_synced', loadProfile);
    };
  }, []);

  React.useEffect(() => {
    setAvatarLoadError(false);
  }, [customPhoto, user?.photoURL]);

  React.useEffect(() => {
    if (!isEditProfileOpen && !isCategoryModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsEditProfileOpen(false);
        setIsCategoryModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isEditProfileOpen, isCategoryModalOpen]);

  const handleOpenEditProfile = () => {
    setEditNameInput(customName || user?.displayName || 'User');
    setEditPhotoInput(customPhoto || user?.photoURL || '');
    setIsEditProfileOpen(true);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalName = editNameInput.trim() || 'User';
    const finalPhoto = editPhotoInput.trim();
    setCustomName(finalName);
    setCustomPhoto(finalPhoto);
    try {
      localStorage.setItem(
        'thumbfeed_custom_profile',
        JSON.stringify({ name: finalName, photoURL: finalPhoto })
      );
    } catch {}
    try {
      await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: finalName, photoURL: finalPhoto }),
      });
    } catch (err) {
      console.warn('Failed to save profile to server:', err);
    }
    setIsEditProfileOpen(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
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

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm md:hidden animate-in fade-in duration-150"
        />
      )}

      <aside
        className={`fixed top-0 left-0 bottom-0 z-50 md:z-40 flex flex-col bg-[#090a0d] border-r border-white/[0.07] transition-all duration-200 select-none ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        } ${isCollapsed ? 'md:w-[68px]' : 'md:w-[260px]'} w-[260px]`}
      >
        {/* Top Header / Brand Mark */}
        <div className="h-14 flex items-center justify-between px-3.5 border-b border-white/[0.06]">
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
                  onClick={() => {
                    onSelectNiche('All');
                    if (onSelectBoard) onSelectBoard(null);
                  }}
                  className={`flex-1 flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    selectedNiche === 'All' && !selectedBoardId
                      ? 'bg-white/[0.10] text-white shadow-sm'
                      : 'text-white/60 hover:text-white hover:bg-white/[0.04]'
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
                          className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs transition-colors group ${
                            isSelected
                              ? 'bg-white/[0.08] text-white font-medium'
                              : 'text-white/65 hover:text-white hover:bg-white/[0.04]'
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
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(true)}
                  className="p-1 -mr-1 text-white/40 hover:text-white hover:bg-white/[0.05] rounded transition-colors cursor-pointer"
                  title="Manage Categories"
                  aria-label="Manage Categories"
                >
                  <Settings className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Scrollable Categories List */}
              <div className="flex-1 min-h-0 overflow-y-auto space-y-0.5 pr-1 pb-3 categories-scroll">
                {/* 'All' Category */}
                <button
                  type="button"
                  onClick={() => {
                    onSelectNiche('All');
                    if (onSelectBoard) onSelectBoard(null);
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors ${
                    selectedNiche === 'All' && !selectedBoardId
                      ? 'text-white bg-white/[0.08] font-medium'
                      : 'text-white/65 hover:text-white hover:bg-white/[0.04]'
                  }`}
                >
                  <span className="truncate flex-1 text-left">All</span>
                  {totalThumbnailsCount > 0 && (
                    <span className="text-[10px] font-mono tabular-nums text-white/30">
                      {totalThumbnailsCount}
                    </span>
                  )}
                </button>

                {categories.map((category) => {
                  const isSelected = selectedNiche === category && !selectedBoardId;
                  const count = categoryCounts[category] ?? 0;
                  return (
                    <div
                      key={category}
                      className={`group/item flex items-center justify-between rounded-md transition-colors ${
                        isSelected
                          ? 'bg-white/[0.08] text-white font-medium'
                          : 'text-white/65 hover:text-white hover:bg-white/[0.04]'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          onSelectNiche(category);
                          if (onSelectBoard) onSelectBoard(null);
                        }}
                        className="flex-1 flex items-center justify-between px-2.5 py-1.5 text-xs transition-colors truncate"
                      >
                        <span className="truncate flex-1 text-left">{category}</span>
                        {count > 0 && (
                          <span className="text-[10px] font-mono tabular-nums text-white/30 group-hover/item:text-white/50">
                            {count}
                          </span>
                        )}
                      </button>

                      {/* Delete category button on hover */}
                      {onRemoveCategory && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onRemoveCategory(category);
                          }}
                          className="opacity-0 group-hover/item:opacity-100 focus-visible:opacity-100 p-1 mr-1 text-white/30 hover:text-red-400 rounded transition-opacity"
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

        {/* Bottom Pinned Footer: User Profile with Settings */}
        <div className="shrink-0 border-t border-white/[0.06] p-2 space-y-1">
          {mounted && (() => {
            const effectiveName = customName || user?.displayName || user?.email?.split('@')[0] || 'User';
            const effectivePhoto = sanitizeSafeImageSrc(customPhoto || user?.photoURL || '');

            return (
              <div
                className={`flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-white/[0.04] transition-colors ${
                  isCollapsed ? 'justify-center' : ''
                }`}
              >
                <button
                  type="button"
                  onClick={handleOpenEditProfile}
                  className="relative group shrink-0"
                  title="Click to edit avatar"
                  aria-label="Edit profile avatar"
                >
                  {effectivePhoto && !avatarLoadError ? (
                    <img
                      src={effectivePhoto}
                      alt={effectiveName}
                      referrerPolicy="no-referrer"
                      onError={() => setAvatarLoadError(true)}
                      className="w-7 h-7 rounded-full object-cover ring-1 ring-white/20 group-hover:ring-white/50 transition-all"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-white/[0.12] flex items-center justify-center text-white text-[11px] font-bold ring-1 ring-white/20 group-hover:ring-white/50 transition-all">
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
                    onClick={handleOpenEditProfile}
                    className="flex-1 min-w-0 text-left cursor-pointer"
                    title="Click to edit name"
                  >
                    <div className="text-xs text-white truncate font-medium hover:text-white/80 transition-colors">
                      {effectiveName}
                    </div>
                  </button>
                )}

                {!isCollapsed && (
                  <button
                    type="button"
                    onClick={handleOpenEditProfile}
                    className="p-1 rounded-md text-white/40 hover:text-white hover:bg-white/[0.06] transition-colors"
                    title="Edit profile & photo"
                    aria-label="Edit profile and photo"
                  >
                    <Settings className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })()}
        </div>
      </aside>

      {/* Edit Profile Modal */}
      {isEditProfileOpen && (
        <div
          onClick={() => setIsEditProfileOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-xl border border-white/10 bg-[#0e1017] p-5 shadow-2xl space-y-4 animate-in zoom-in-95"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Edit Profile</h3>
              <button
                type="button"
                onClick={() => setIsEditProfileOpen(false)}
                aria-label="Close Edit Profile modal"
                className="p-1 text-white/40 hover:text-white rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              {/* Avatar Preview & Upload */}
              <div className="flex items-center gap-3">
                <div className="relative w-14 h-14 rounded-full overflow-hidden bg-white/[0.06] border border-white/10 shrink-0 flex items-center justify-center">
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
                  <label className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-white text-xs cursor-pointer transition-colors">
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
                      className="text-[10px] text-white/40 hover:text-red-400 block transition-colors"
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
                  className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white placeholder-white/30 focus:border-white/25 focus:outline-none"
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
                  className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white placeholder-white/30 focus:border-white/25 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => setIsEditProfileOpen(false)}
                  className="px-3 py-1.5 rounded-lg text-xs text-white/60 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-white text-black hover:bg-white/90 text-xs font-semibold transition-colors"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Category Management Modal (Add and Remove any category) */}
      {isCategoryModalOpen && (
        <div
          onClick={() => setIsCategoryModalOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0e1017] p-5 shadow-2xl space-y-4 animate-in zoom-in-95"
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
                placeholder="New category name (e.g. 3D Design, AI, Gaming)..."
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
