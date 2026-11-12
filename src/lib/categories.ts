'use client';

export const DEFAULT_CATEGORIES: string[] = [
  'IRL',
  'Business',
  'Tech',
  'Entertainment',
  'Gaming',
  'Sports',
  'Documentary',
  'Educational',
  'Podcast',
  'Interviews',
  'Football',
  'Mindset',
  'Self-Improvement',
  'Lifestyle',
  'Entrepreneurship',
  'Geopolitics',
  'Military',
  'Psychology',
  'Soccer',
  'Video Games',
  'Vlog'
];

const ACTIVE_CATEGORIES_KEY = 'thumbfeed_active_categories_v2';
const EVENT_NAME = 'thumbfeed_categories_updated';

export function getAllCategories(): string[] {
  if (typeof window === 'undefined') return DEFAULT_CATEGORIES;
  try {
    const raw = localStorage.getItem(ACTIVE_CATEGORIES_KEY);
    if (!raw) {
      localStorage.setItem(ACTIVE_CATEGORIES_KEY, JSON.stringify(DEFAULT_CATEGORIES));
      return DEFAULT_CATEGORIES;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.filter(item => typeof item === 'string' && item.trim().length > 0);
    }
    return DEFAULT_CATEGORIES;
  } catch (e) {
    console.error('Failed to read categories:', e);
    return DEFAULT_CATEGORIES;
  }
}

export async function syncCategoriesToServer(categories: string[]): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    await fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(categories),
    });
  } catch (err) {
    console.warn('Failed to sync categories to server:', err);
  }
}

export async function syncCategoriesFromServer(): Promise<string[]> {
  if (typeof window === 'undefined') return DEFAULT_CATEGORIES;
  try {
    const res = await fetch('/api/categories');
    if (res.ok) {
      const serverCats = await res.json();
      if (Array.isArray(serverCats) && serverCats.length > 0) {
        localStorage.setItem(ACTIVE_CATEGORIES_KEY, JSON.stringify(serverCats));
        window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: serverCats }));
        return serverCats;
      }
    }
  } catch (err) {
    console.warn('Failed to sync categories from server:', err);
  }
  return getAllCategories();
}

export function addCategory(newCategory: string): string[] {
  if (typeof window === 'undefined') return DEFAULT_CATEGORIES;
  const clean = newCategory.trim();
  if (!clean) return getAllCategories();

  const current = getAllCategories();
  const lower = clean.toLowerCase();
  if (current.some(c => c.toLowerCase() === lower)) {
    return current;
  }

  const updated = [...current, clean];
  try {
    localStorage.setItem(ACTIVE_CATEGORIES_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: updated }));
  } catch (e) {
    console.error('Failed to add category:', e);
  }
  syncCategoriesToServer(updated);
  return updated;
}

export function removeCategory(categoryToRemove: string): string[] {
  if (typeof window === 'undefined') return DEFAULT_CATEGORIES;
  const current = getAllCategories();
  const lower = categoryToRemove.trim().toLowerCase();
  const updated = current.filter(c => c.toLowerCase() !== lower);
  try {
    localStorage.setItem(ACTIVE_CATEGORIES_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: updated }));
  } catch (e) {
    console.error('Failed to remove category:', e);
  }
  syncCategoriesToServer(updated);
  return updated;
}

// Backward-compatible aliases
export const getCustomCategories = getAllCategories;
export const addCustomCategory = addCategory;
export const removeCustomCategory = removeCategory;

export function subscribeCategories(callback: (categories: string[]) => void): () => void {
  if (typeof window === 'undefined') return () => {};

  const handleUpdate = () => {
    callback(getAllCategories());
  };

  window.addEventListener(EVENT_NAME, handleUpdate);
  window.addEventListener('storage', handleUpdate);

  return () => {
    window.removeEventListener(EVENT_NAME, handleUpdate);
    window.removeEventListener('storage', handleUpdate);
  };
}
