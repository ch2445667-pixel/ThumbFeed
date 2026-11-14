import fs from 'fs';
import path from 'path';
import { isR2Configured, downloadJsonFromR2, R2_APP_DATA } from './r2';
import { getAllGalleryItems, invalidateGalleryCache } from './galleryService';
import { CollectionBoard } from './types';

const DATA_DIR = path.join(process.cwd(), 'data');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export async function performFullR2Sync() {
  if (!isR2Configured()) {
    return {
      synced: false,
      reason: 'R2 not configured',
      thumbnailsCount: 0,
      boardsCount: 0,
      categoriesCount: 0,
    };
  }

  ensureDataDir();

  // 1. Sync Thumbnails (reads _app_data/thumbnails.json + scans R2 bucket for images)
  invalidateGalleryCache();
  const items = await getAllGalleryItems(true);

  // 2. Sync Boards
  let boardsCount = 0;
  try {
    const r2Boards = await downloadJsonFromR2<CollectionBoard[]>(R2_APP_DATA.BOARDS);
    if (Array.isArray(r2Boards)) {
      const boardsPath = path.join(DATA_DIR, 'boards.json');
      fs.writeFileSync(boardsPath, JSON.stringify(r2Boards, null, 2), 'utf-8');
      boardsCount = r2Boards.length;
    }
  } catch (err) {
    console.warn('Sync boards error:', err);
  }

  // 3. Sync Categories
  let categoriesCount = 0;
  try {
    const r2Cats = await downloadJsonFromR2<string[]>(R2_APP_DATA.CATEGORIES);
    if (Array.isArray(r2Cats)) {
      const catsPath = path.join(DATA_DIR, 'categories.json');
      fs.writeFileSync(catsPath, JSON.stringify(r2Cats, null, 2), 'utf-8');
      categoriesCount = r2Cats.length;
    }
  } catch (err) {
    console.warn('Sync categories error:', err);
  }

  // 4. Sync Profile
  let profileSynced = false;
  try {
    const r2Profile = await downloadJsonFromR2<{ name: string; photoURL: string }>(R2_APP_DATA.PROFILE);
    if (r2Profile && (r2Profile.name || r2Profile.photoURL)) {
      const profPath = path.join(DATA_DIR, 'user-profile.json');
      fs.writeFileSync(profPath, JSON.stringify(r2Profile, null, 2), 'utf-8');
      profileSynced = true;
    }
  } catch (err) {
    console.warn('Sync profile error:', err);
  }

  return {
    synced: true,
    thumbnailsCount: items.length,
    boardsCount,
    categoriesCount,
    profileSynced,
  };
}
