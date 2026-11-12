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
  Camera
} from 'lucide-react';
import { useAuth } from '../lib/authContext';
import { CollectionBoard } from '../lib/types';
import { AppLogo } from './icons/AppLogo';

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
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  
  // Custom user profile state (editable pfp & name stored in localStorage)
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customPhoto, setCustomPhoto] = useState('');
  const [editNameInput, setEditNameInput] = useState('');
  const [editPhotoInput, setEditPhotoInput] = useState('');

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
  }, []);

  const handleOpenEditProfile = () => {
    setEditNameInput(customName || user?.displayName || 'User');
    setEditPhotoInput(customPhoto || user?.photoURL || '');
    setIsEditProfileOpen(true);
  };

  const handleSaveProfile = (e: React.FormEvent) => {
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

  const handleCreateCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    if (onAddCategory) {
      onAddCategory(newCategoryName.trim());
    }
    setNewCategoryName('');
    setIsAddingCategory(false);
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
          
          {/* Top Intact Sections (Add, Explore, Moodboards, Boards) */}
          <div className="shrink-0 space-y-3">
            {/* Action Button: "+ Add / Import" */}
            {mounted && onOpenAdd && (
              <div>
                <button
                  type="button"
                  onClick={onOpenAdd}
                  className={`w-full flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] hover:border-white/20 text-white font-medium text-xs py-2 transition-all active:scale-[0.98] shadow-sm ${
                    isCollapsed ? 'justify-center px-0' : 'px-3'
                  }`}
                  title="Add or Import Thumbnails"
                >
                  <Plus className="w-4 h-4 text-white/80 shrink-0" />
                  {!isCollapsed && <span>Add / Import</span>}
                </button>
              </div>
            )}

            {/* Primary Navigation: Explore with Small Shuffle Icon */}
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
                    <span className="text-[10px] font-mono text-white/40">
                      {totalThumbnailsCount}
                    </span>
                  )}
                </button>

                {/* Small Shuffle Icon next to Explore */}
                {!isCollapsed && onShuffle && (
                  <button
                    type="button"
                    onClick={onShuffle}
                    className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/[0.06] transition-colors"
                    title="Shuffle Feed Order"
                  >
                    <Shuffle className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={onOpenMoodboard}
                className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-white/60 hover:text-white hover:bg-white/[0.04] transition-colors ${
                  isCollapsed ? 'justify-center' : ''
                }`}
                title="Moodboards & Collections"
              >
                <Bookmark className="w-4 h-4 shrink-0 text-white/80" />
                {!isCollapsed && <span className="flex-1 text-left">Moodboards</span>}
                {!isCollapsed && collections.length > 0 && (
                  <span className="px-1.5 py-0.5 text-[10px] rounded bg-white/10 text-white/70 font-mono">
                    {collections.length}
                  </span>
                )}
              </button>
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
                          <span className="text-[10px] font-mono text-white/30">
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
                  onClick={() => setIsAddingCategory(!isAddingCategory)}
                  className="p-1 -mr-1 text-white/40 hover:text-white hover:bg-white/[0.05] rounded transition-colors"
                  title="Add Category"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Inline input to add category */}
              {isAddingCategory && (
                <form onSubmit={handleCreateCategory} className="shrink-0 px-1 mb-2">
                  <div className="flex items-center gap-1 bg-[#14161f] border border-white/15 rounded-md px-2 py-1">
                    <input
                      type="text"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      placeholder="Category name..."
                      autoFocus
                      className="w-full bg-transparent text-xs text-white placeholder-white/40 focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={!newCategoryName.trim()}
                      className="text-white/70 hover:text-white disabled:opacity-30 p-0.5"
                    >
                      <Check className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingCategory(false);
                        setNewCategoryName('');
                      }}
                      className="text-white/40 hover:text-white/80 p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </form>
              )}

              {/* Scrollable Categories List */}
              <div className="flex-1 min-h-0 overflow-y-auto space-y-0.5 pr-1 categories-scroll">
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
                    <span className="text-[10px] font-mono text-white/30">
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
                          <span className="text-[10px] font-mono text-white/30 group-hover/item:text-white/50">
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
                          className="opacity-0 group-hover/item:opacity-100 p-1 mr-1 text-white/30 hover:text-red-400 rounded transition-opacity"
                          title={`Delete ${category}`}
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
            const effectivePhoto = customPhoto || user?.photoURL || '';

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
                >
                  {effectivePhoto ? (
                    <img
                      src={effectivePhoto}
                      alt={effectiveName}
                      className="w-7 h-7 rounded-full object-cover ring-1 ring-white/20 group-hover:ring-white/50 transition-all"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-[11px] font-bold ring-1 ring-white/20 group-hover:ring-white/50 transition-all">
                      {effectiveName[0]?.toUpperCase() || 'U'}
                    </div>
                  )}
                  <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Camera className="w-3 h-3 text-white" />
                  </div>
                </button>

                {!isCollapsed && (
                  <div
                    onClick={handleOpenEditProfile}
                    className="flex-1 min-w-0 cursor-pointer"
                    title="Click to edit name"
                  >
                    <div className="text-xs text-white truncate font-medium hover:text-white/80 transition-colors">
                      {effectiveName}
                    </div>
                  </div>
                )}

                {!isCollapsed && (
                  <button
                    type="button"
                    onClick={handleOpenEditProfile}
                    className="p-1 rounded-md text-white/40 hover:text-white hover:bg-white/[0.06] transition-colors"
                    title="Edit profile & photo"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-xl border border-white/10 bg-[#0e1017] p-5 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Edit Profile</h3>
              <button
                type="button"
                onClick={() => setIsEditProfileOpen(false)}
                className="p-1 text-white/40 hover:text-white rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              {/* Avatar Preview & Upload */}
              <div className="flex items-center gap-3">
                <div className="relative w-14 h-14 rounded-full overflow-hidden bg-white/[0.06] border border-white/10 shrink-0 flex items-center justify-center">
                  {editPhotoInput ? (
                    <img
                      src={editPhotoInput}
                      alt="Avatar Preview"
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
    </>
  );
};
