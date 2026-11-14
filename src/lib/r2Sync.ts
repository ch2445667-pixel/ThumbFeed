import fs from 'fs';
import path from 'path';
import { isR2Configured, downloadJsonFromR2, R2_APP_DATA } from './r2';
import { getAllGalleryItems, invalidateGalleryCache } from './galleryService';
import { CollectionBoard } from './types';
import { isValidFirebaseUid } from './serverAuth';

const DATA_DIR = path.join(process.cwd(), 'data');

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export async function performFullR2Sync(uid?: string) {
  if (!isR2Configured()) {
    return {
      synced: false,
      reason: 'R2 not configured',
      thumbnailsCount: 0,
      boardsCount: 0,
      categoriesCount: 0,
      profileSynced: false,
    };
  }

  ensureDir(DATA_DIR);

  // 1. Sync shared Thumbnails (reads _app_data/thumbnails.json + scans R2 bucket for images)
  invalidateGalleryCache();
  const items = await getAllGalleryItems(true);

  // 2. Sync shared Categories
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

  // 3. Sync per-user Boards & Profile (only when a valid authenticated UID is supplied)
  let boardsCount = 0;
  let profileSynced = false;
  if (uid && isValidFirebaseUid(uid)) {
    const userDir = path.join(DATA_DIR, 'users', uid);
    ensureDir(userDir);

    try {
      const r2Boards = await downloadJsonFromR2<CollectionBoard[]>(`_app_data/users/${uid}/boards.json`);
      if (Array.isArray(r2Boards)) {
        fs.writeFileSync(path.join(userDir, 'boards.json'), JSON.stringify(r2Boards, null, 2), 'utf-8');
        boardsCount = r2Boards.length;
      }
    } catch (err) {
      console.warn('Sync user boards error:', err);
    }

    try {
      const r2Profile = await downloadJsonFromR2<{ name: string; photoURL: string }>(`_app_data/users/${uid}/profile.json`);
      if (r2Profile && (r2Profile.name || r2Profile.photoURL)) {
        fs.writeFileSync(path.join(userDir, 'profile.json'), JSON.stringify(r2Profile, null, 2), 'utf-8');
        profileSynced = true;
      }
    } catch (err) {
      console.warn('Sync user profile error:', err);
    }
  }

  return {
    synced: true,
    thumbnailsCount: items.length,
    boardsCount,
    categoriesCount,
    profileSynced,
  };
}
