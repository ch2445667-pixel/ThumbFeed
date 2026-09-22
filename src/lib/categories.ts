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
  'Nfl',
  'Psychology',
  'Soccer',
  'Video Games',
  'Vlog',
  'War'
];

const STORAGE_KEY = 'thumbfeed_custom_categories';
const EVENT_NAME = 'thumbfeed_categories_updated';

export function getCustomCategories(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter(item => typeof item === 'string' && item.trim().length > 0);
    }
  } catch (e) {
    console.error('Failed to read custom categories:', e);
  }
  return [];
}

export function getAllCategories(): string[] {
  const custom = getCustomCategories();
  const set = new Set<string>(DEFAULT_CATEGORIES);
  custom.forEach(c => set.add(c.trim()));
  return Array.from(set);
}

export function addCustomCategory(newCategory: string): string[] {
  if (typeof window === 'undefined') return [];
  const clean = newCategory.trim();
  if (!clean) return getCustomCategories();

  // Check if it's already in default or custom
  const existing = getCustomCategories();
  const lower = clean.toLowerCase();
  const alreadyInDefaults = DEFAULT_CATEGORIES.some(c => c.toLowerCase() === lower);
  const alreadyInCustom = existing.some(c => c.toLowerCase() === lower);

  if (alreadyInDefaults || alreadyInCustom) {
    return existing;
  }

  const updated = [...existing, clean];
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: updated }));
  } catch (e) {
    console.error('Failed to save custom category:', e);
  }
  return updated;
}

export function removeCustomCategory(categoryToRemove: string): string[] {
  if (typeof window === 'undefined') return [];
  const existing = getCustomCategories();
  const updated = existing.filter(c => c.toLowerCase() !== categoryToRemove.trim().toLowerCase());
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: updated }));
  } catch (e) {
    console.error('Failed to remove custom category:', e);
  }
  return updated;
}

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
