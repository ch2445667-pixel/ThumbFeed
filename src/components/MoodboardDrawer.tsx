'use client';

import React, { useState } from 'react';
import { X, Bookmark, Trash2, Plus, ExternalLink, Download, Sparkles, FolderPlus } from 'lucide-react';
import { ThumbnailItem, CollectionBoard } from '../lib/types';

interface MoodboardDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  savedThumbnails: ThumbnailItem[];
  collections: CollectionBoard[];
  activeCollectionId: string;
  onSelectCollection: (id: string) => void;
  onCreateCollection: (name: string, desc: string) => void;
  onRemoveItem: (id: string) => void;
  onInspectItem: (item: ThumbnailItem) => void;
}

export const MoodboardDrawer: React.FC<MoodboardDrawerProps> = ({
  isOpen,
  onClose,
  savedThumbnails,
  collections,
  activeCollectionId,
  onSelectCollection,
  onCreateCollection,
  onRemoveItem,
  onInspectItem
}) => {
  const [showNewBoardInput, setShowNewBoardInput] = useState(false);
  const [newBoardName, setNewBoardName] = useState('');
  const [newBoardDesc, setNewBoardDesc] = useState('');

  if (!isOpen) return null;

  const activeCollection = collections.find(c => c.id === activeCollectionId) || collections[0];
  const itemsInActive = savedThumbnails.filter(t => 
    activeCollection ? activeCollection.thumbnailIds.includes(t.id) : true
  );

  const handleCreateBoard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBoardName.trim()) return;
    onCreateCollection(newBoardName.trim(), newBoardDesc.trim());
    setNewBoardName('');
    setNewBoardDesc('');
    setShowNewBoardInput(false);
  };

  const handleExportReferences = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(
      JSON.stringify({
        boardName: activeCollection?.name || 'My Moodboard',
        exportedAt: new Date().toISOString(),
        thumbnails: itemsInActive
      }, null, 2)
    );
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `${(activeCollection?.name || 'moodboard').toLowerCase().replace(/\s+/g, '_')}_references.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden animate-in fade-in duration-200">
      
      {/* Click outside backdrop */}
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-[#D6D1BC] dark:bg-[#1E1B1A] border-l border-[#0d0e10]/15 dark:border-[#D6D1BC]/20 flex flex-col shadow-2xl">
          
          {/* Drawer Header */}
          <div className="p-6 border-b border-[#0d0e10]/10 dark:border-[#D6D1BC]/15 flex items-center justify-between bg-[#D6D1BC] dark:bg-[#1E1B1A]">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-[#411C1A]/10 text-[#0d0e10] dark:bg-[#411C1A]/20 dark:text-[#D6D1BC] border border-[#0d0e10]/20 dark:border-[#D6D1BC]/30">
                <Bookmark className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#0d0e10] dark:text-[#D6D1BC]">Your Moodboards</h3>
                <p className="text-xs text-[#0d0e10]/70 dark:text-[#D6D1BC]/70">Save and organize inspiration boards</p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-[#0d0e10]/60 hover:text-[#0d0e10] dark:text-[#D6D1BC]/70 dark:hover:text-[#D6D1BC] hover:bg-[#E4E1D2]/40 dark:hover:bg-[#411C1A]/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Collection Selector & New Board Button */}
          <div className="p-4 bg-[#E4E1D2]/30 dark:bg-[#1E1B1A]/60 border-b border-[#0d0e10]/10 dark:border-[#D6D1BC]/15 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#0d0e10]/70 dark:text-[#D6D1BC]/70 uppercase tracking-wider">Active Board</span>
              <button
                onClick={() => setShowNewBoardInput(!showNewBoardInput)}
                className="flex items-center gap-1 text-xs font-medium text-[#0d0e10] dark:text-[#D6D1BC] hover:underline"
              >
                <FolderPlus className="w-3.5 h-3.5" />
                <span>+ New Board</span>
              </button>
            </div>

            {/* Collections Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-1">
              {collections.map(col => {
                const isSelected = col.id === activeCollectionId;
                return (
                  <button
                    key={col.id}
                    onClick={() => onSelectCollection(col.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                      isSelected
                        ? 'bg-[#411C1A] text-[#0d0e10] dark:bg-[#411C1A] dark:text-[#0d0e10] shadow-sm'
                        : 'bg-[#D6D1BC] dark:bg-[#1E1B1A] border border-[#0d0e10]/15 dark:border-[#D6D1BC]/25 text-[#0d0e10] dark:text-[#D6D1BC] hover:bg-[#E4E1D2]/40'
                    }`}
                  >
                    {col.name} ({col.thumbnailIds.length})
                  </button>
                );
              })}
            </div>

            {/* Create New Board Form */}
            {showNewBoardInput && (
              <form onSubmit={handleCreateBoard} className="p-3 bg-[#D6D1BC] dark:bg-[#1E1B1A] border border-[#0d0e10]/30 dark:border-[#D6D1BC]/30 rounded-xl space-y-2 animate-in slide-in-from-top-2">
                <input
                  type="text"
                  placeholder="Board Name (e.g., Cyberpunk Gaming)"
                  value={newBoardName}
                  onChange={(e) => setNewBoardName(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-[#E4E1D2]/30 dark:bg-[#1E1B1A] border border-[#0d0e10]/20 dark:border-[#D6D1BC]/30 rounded-lg text-[#0d0e10] dark:text-[#D6D1BC] focus:outline-none focus:border-[#0d0e10] dark:focus:border-[#D6D1BC]"
                  autoFocus
                />
                <input
                  type="text"
                  placeholder="Short description (optional)"
                  value={newBoardDesc}
                  onChange={(e) => setNewBoardDesc(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-[#E4E1D2]/30 dark:bg-[#1E1B1A] border border-[#0d0e10]/20 dark:border-[#D6D1BC]/30 rounded-lg text-[#0d0e10] dark:text-[#D6D1BC] focus:outline-none focus:border-[#0d0e10] dark:focus:border-[#D6D1BC]"
                />
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowNewBoardInput(false)}
                    className="px-2.5 py-1 text-xs text-[#0d0e10]/60 hover:text-[#0d0e10] dark:text-[#D6D1BC]/70 dark:hover:text-[#D6D1BC]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-3 py-1 text-xs font-medium bg-[#411C1A] text-[#0d0e10] dark:bg-[#411C1A] dark:text-[#0d0e10] rounded-md hover:opacity-90"
                  >
                    Create
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Saved Items List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {itemsInActive.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center p-6 text-[#0d0e10]/60 dark:text-[#D6D1BC]/60">
                <Bookmark className="w-12 h-12 text-[#0d0e10]/40 dark:text-[#D6D1BC]/40 mb-3 opacity-40" />
                <p className="text-sm font-medium text-[#0d0e10]/80 dark:text-[#D6D1BC]/80">No thumbnails in this board yet</p>
                <p className="text-xs text-[#0d0e10]/60 dark:text-[#D6D1BC]/60 mt-1">
                  Click the bookmark icon on any thumbnail in the gallery to collect design references.
                </p>
              </div>
            ) : (
              itemsInActive.map(item => (
                <div
                  key={item.id}
                  className="flex gap-3 p-2.5 rounded-xl bg-[#D6D1BC] dark:bg-[#1E1B1A] border border-[#0d0e10]/15 dark:border-[#D6D1BC]/20 hover:border-[#0d0e10] dark:hover:border-[#D6D1BC] transition-all group"
                >
                  <div
                    onClick={() => onInspectItem(item)}
                    className="relative w-28 aspect-video rounded-lg overflow-hidden bg-[#411C1A] cursor-pointer flex-shrink-0"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.imageUrl}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                      }}
                    />
                  </div>

                  <div className="flex-1 flex flex-col justify-between min-w-0">
                    <div>
                      <h4
                        onClick={() => onInspectItem(item)}
                        className="text-xs font-semibold text-[#0d0e10] dark:text-[#D6D1BC] hover:underline cursor-pointer truncate"
                      >
                        {item.title}
                      </h4>
                      <p className="text-[11px] text-[#0d0e10]/70 dark:text-[#D6D1BC]/70 mt-0.5">{item.niche}</p>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] text-[#0d0e10]/60 dark:text-[#D6D1BC]/60">{item.creator || 'Creator'}</span>

                      <button
                        onClick={() => onRemoveItem(item.id)}
                        className="text-[#0d0e10]/60 hover:text-[#0d0e10] dark:text-[#D6D1BC]/60 dark:hover:text-[#D6D1BC] p-1 transition-colors"
                        title="Remove from board"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Drawer Footer Actions */}
          {itemsInActive.length > 0 && (
            <div className="p-4 border-t border-[#0d0e10]/10 dark:border-[#D6D1BC]/15 bg-[#D6D1BC] dark:bg-[#1E1B1A] flex gap-2">
              <button
                onClick={handleExportReferences}
                className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold text-[#0d0e10] bg-[#411C1A] dark:bg-[#411C1A] dark:text-[#0d0e10] hover:opacity-90 flex items-center justify-center gap-2 transition-colors shadow-md"
              >
                <Download className="w-4 h-4" />
                <span>Export Board References (.JSON)</span>
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
