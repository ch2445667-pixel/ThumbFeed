'use client';

import React, { useState, useEffect } from 'react';
import { X, Bookmark, Trash2, Download, FolderPlus } from 'lucide-react';
import { ThumbnailItem, CollectionBoard } from '../lib/types';
import { sanitizeSafeImageSrc } from '../lib/urlSafety';

interface MoodboardDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  savedThumbnails: ThumbnailItem[];
  collections: CollectionBoard[];
  activeCollectionId: string;
  onSelectCollection: (id: string) => void;
  onCreateCollection: (name: string, desc: string) => void;
  onDeleteCollection?: (id: string) => void;
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
  onDeleteCollection,
  onRemoveItem,
  onInspectItem
}) => {
  const [showNewBoardInput, setShowNewBoardInput] = useState(false);
  const [newBoardName, setNewBoardName] = useState('');
  const [newBoardDesc, setNewBoardDesc] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const activeCollection = collections.find(c => c.id === activeCollectionId) || collections[0];
  const itemsInActive = savedThumbnails.filter(t =>
    activeCollection ? activeCollection.thumbnailIds.includes(t.id) : false
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
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-[#0e1017] border-l border-white/[0.08] flex flex-col shadow-2xl">
          
          {/* Drawer Header */}
          <div className="p-5 border-b border-white/[0.08] flex items-center justify-between bg-[#0b0c10]">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-white/[0.05] border border-white/10 text-white">
                <Bookmark className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Your Moodboards</h3>
                <p className="text-[11px] text-white/50">Save and organize inspiration boards</p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close Moodboards"
              className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/[0.06] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Collection Selector & New Board Button */}
          <div className="p-4 bg-[#090a0d] border-b border-white/[0.06] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-medium text-white/40 uppercase tracking-wider">Active Board</span>
              <button
                type="button"
                onClick={() => setShowNewBoardInput(!showNewBoardInput)}
                className="flex items-center gap-1 text-xs font-medium text-white/80 hover:text-white transition-colors"
              >
                <FolderPlus className="w-3.5 h-3.5" />
                <span>+ New Board</span>
              </button>
            </div>

            {/* Collections Tabs */}
            {collections.length === 0 && !showNewBoardInput ? (
              <p className="text-xs text-white/40 italic py-1">No custom boards created yet. Click &quot;+ New Board&quot; to create one.</p>
            ) : (
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                {collections.map(col => {
                  const isSelected = col.id === activeCollectionId;
                  return (
                    <button
                      key={col.id}
                      onClick={() => onSelectCollection(col.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                        isSelected
                          ? 'bg-white text-black font-semibold shadow-sm'
                          : 'bg-white/[0.04] border border-white/[0.08] text-white/70 hover:text-white hover:bg-white/[0.08]'
                      }`}
                    >
                      {col.name} ({col.thumbnailIds.length})
                    </button>
                  );
                })}
              </div>
            )}

            {/* Active Board Meta & Delete Option */}
            {activeCollection && onDeleteCollection && (
              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-white/50 truncate">{activeCollection.description || activeCollection.name}</span>
                <button
                  type="button"
                  onClick={() => onDeleteCollection(activeCollection.id)}
                  className="text-[11px] text-white/40 hover:text-red-400 flex items-center gap-1 transition-colors shrink-0 ml-2"
                  title="Delete this board"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Delete Board</span>
                </button>
              </div>
            )}

            {/* Create New Board Form */}
            {showNewBoardInput && (
              <form onSubmit={handleCreateBoard} className="p-3 bg-[#13151f] border border-white/10 rounded-lg space-y-2 animate-in slide-in-from-top-2">
                <input
                  type="text"
                  placeholder="Board Name (e.g., High-CTR Hooks)"
                  value={newBoardName}
                  onChange={(e) => setNewBoardName(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-black/40 border border-white/10 rounded-md text-white focus:outline-none focus:border-white/30 placeholder:text-white/30"
                  autoFocus
                />
                <input
                  type="text"
                  placeholder="Short description (optional)"
                  value={newBoardDesc}
                  onChange={(e) => setNewBoardDesc(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-black/40 border border-white/10 rounded-md text-white focus:outline-none focus:border-white/30 placeholder:text-white/30"
                />
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowNewBoardInput(false)}
                    className="px-2.5 py-1 text-xs text-white/50 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-3 py-1 text-xs font-medium bg-white text-black rounded-md hover:bg-white/90 transition-colors"
                  >
                    Create
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Saved Items List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
            {itemsInActive.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center p-6 text-white/40">
                <Bookmark className="w-10 h-10 text-white/20 mb-3" />
                <p className="text-xs font-medium text-white/70">No thumbnails in this board yet</p>
                <p className="text-[11px] text-white/40 mt-1 max-w-[26ch]">
                  Click thumbnail cards in the gallery to inspect and collect references.
                </p>
              </div>
            ) : (
              itemsInActive.map(item => {
                const safeSrc = sanitizeSafeImageSrc(item.thumbSmallUrl || item.imageUrl);
                return (
                <div
                  key={item.id}
                  className="flex gap-3 p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.15] hover:bg-white/[0.04] transition-all group"
                >
                  <button
                    type="button"
                    onClick={() => onInspectItem(item)}
                    aria-label={`Inspect ${item.title}`}
                    className="relative w-24 aspect-video rounded-md overflow-hidden bg-black/50 cursor-pointer flex-shrink-0 text-left"
                  >
                    {safeSrc && (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={safeSrc}
                        alt={item.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    )}
                  </button>

                  <div className="flex-1 flex flex-col justify-between min-w-0">
                    <div>
                      <button
                        type="button"
                        onClick={() => onInspectItem(item)}
                        className="w-full text-left text-xs font-medium text-white/90 hover:text-white cursor-pointer truncate block"
                      >
                        {item.title}
                      </button>
                      <p className="text-[10px] text-white/45 mt-0.5">{item.niche}</p>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] text-white/40 truncate">{item.creator || 'Creator'}</span>

                      <button
                        type="button"
                        onClick={() => onRemoveItem(item.id)}
                        aria-label={`Remove ${item.title} from board`}
                        className="text-white/40 hover:text-red-400 p-1 transition-colors"
                        title="Remove from board"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
                );
              })
            )}
          </div>

          {/* Drawer Footer Actions */}
          {itemsInActive.length > 0 && (
            <div className="p-4 border-t border-white/[0.08] bg-[#0b0c10] flex gap-2">
              <button
                onClick={handleExportReferences}
                className="w-full py-2.5 px-4 rounded-lg text-xs font-semibold text-black bg-white hover:bg-white/90 flex items-center justify-center gap-2 transition-colors shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Board (.JSON)</span>
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
