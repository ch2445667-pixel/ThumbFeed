import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { downloadJsonFromR2, uploadJsonToR2, isR2Configured, R2_APP_DATA } from '@/lib/r2';
import { sanitizeSafeImageSrc } from '@/lib/urlSafety';

const MAX_PROFILE_PHOTO_CHARS = 2 * 1024 * 1024; // 2MB cap for data URLs

interface UserProfile {
  name: string;
  photoURL: string;
  updatedAt?: string;
}

const PROFILE_FILE_PATH = path.join(process.cwd(), 'data', 'user-profile.json');

function ensureDataDir() {
  const dir = path.dirname(PROFILE_FILE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function readLocalProfile(): UserProfile {
  try {
    ensureDataDir();
    if (fs.existsSync(PROFILE_FILE_PATH)) {
      const content = fs.readFileSync(PROFILE_FILE_PATH, 'utf-8');
      return JSON.parse(content);
    }
  } catch (err) {
    console.warn('Could not read local profile:', err);
  }
  return { name: '', photoURL: '' };
}

function writeLocalProfile(profile: UserProfile): void {
  try {
    ensureDataDir();
    fs.writeFileSync(PROFILE_FILE_PATH, JSON.stringify(profile, null, 2), 'utf-8');
  } catch (err) {
    console.warn('Could not write local profile:', err);
  }
}

export async function GET() {
  try {
    let profile = readLocalProfile();

    // If Cloudflare R2 is configured, try pulling the centralized profile
    if (isR2Configured()) {
      try {
        const r2Profile = await downloadJsonFromR2<UserProfile>(R2_APP_DATA.PROFILE);
        if (r2Profile && (r2Profile.name || r2Profile.photoURL)) {
          profile = r2Profile;
          writeLocalProfile(profile);
        } else if (profile.name || profile.photoURL) {
          // If local has profile but R2 doesn't, sync up to R2
          await uploadJsonToR2(R2_APP_DATA.PROFILE, profile).catch(() => {});
        }
      } catch (err) {
        console.warn('Failed to sync profile with Cloudflare R2:', err);
      }
    }

    return NextResponse.json(profile);
  } catch (error) {
    console.error('Failed to read user-profile.json:', error);
    return NextResponse.json({ name: '', photoURL: '' });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawName = typeof body?.name === 'string' ? body.name.trim().slice(0, 80) : '';
    const rawPhoto = typeof body?.photoURL === 'string' ? body.photoURL.trim() : '';

    if (rawPhoto.length > MAX_PROFILE_PHOTO_CHARS) {
      return NextResponse.json(
        { success: false, error: 'Profile image is too large (max 2MB).' },
        { status: 400 }
      );
    }

    const safePhoto = rawPhoto ? sanitizeSafeImageSrc(rawPhoto) : '';
    if (rawPhoto && !safePhoto) {
      return NextResponse.json(
        { success: false, error: 'Invalid profile image URL or format.' },
        { status: 400 }
      );
    }

    const profile: UserProfile = {
      name: rawName,
      photoURL: safePhoto || '',
      updatedAt: new Date().toISOString(),
    };

    // 1. Write locally
    writeLocalProfile(profile);

    // 2. Save directly to Cloudflare R2
    if (isR2Configured()) {
      try {
        await uploadJsonToR2(R2_APP_DATA.PROFILE, profile);
      } catch (err) {
        console.warn('Failed to upload profile to Cloudflare R2:', err);
      }
    }

    return NextResponse.json({ success: true, profile });
  } catch (error) {
    console.error('Failed to write user-profile.json:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save profile' },
      { status: 500 }
    );
  }
}
