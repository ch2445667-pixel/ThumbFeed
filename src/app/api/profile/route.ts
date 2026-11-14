import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { downloadJsonFromR2, uploadJsonToR2, deleteFromR2, isR2Configured, R2_APP_DATA } from '@/lib/r2';
import { sanitizeSafeImageSrc } from '@/lib/urlSafety';
import {
  requireUser,
  isAdminEmail,
  isValidFirebaseUid,
  verifyCsrfAndJson,
  getClientIp,
  logSecurityEvent,
  safeErrorResponse,
} from '@/lib/serverAuth';
import { checkRateLimit, rateLimitResponse } from '@/lib/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_PROFILE_PHOTO_CHARS = 2 * 1024 * 1024;
const DATA_DIR = path.join(process.cwd(), 'data');

interface UserProfile {
  name: string;
  photoURL: string;
  updatedAt?: string;
}

const profileSchema = z.object({
  name: z.string().trim().max(80).default(''),
  photoURL: z.string().trim().max(MAX_PROFILE_PHOTO_CHARS).optional().default(''),
});

function getUserProfileFilePath(uid: string): string {
  if (!isValidFirebaseUid(uid)) throw new Error('Invalid user UID');
  return path.join(DATA_DIR, 'users', uid, 'profile.json');
}

function getUserProfileR2Key(uid: string): string {
  if (!isValidFirebaseUid(uid)) throw new Error('Invalid user UID');
  return `_app_data/users/${uid}/profile.json`;
}

function readJsonSafe<T>(filePath: string): T | null {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
    }
  } catch {}
  return null;
}

function writeUserProfile(uid: string, profile: UserProfile): void {
  const filePath = getUserProfileFilePath(uid);
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, JSON.stringify(profile, null, 2), 'utf-8');
}

export async function GET(req: NextRequest) {
  try {
    const authResult = await requireUser(req);
    if ('errorResponse' in authResult) return authResult.errorResponse;

    const uid = authResult.user.uid;
    const rl = await checkRateLimit({
      key: `profile-get:${uid}`,
      limit: 120,
      windowMs: 60 * 1000,
    });
    if (!rl.allowed) return rateLimitResponse(rl.retryAfterSeconds);

    let profile = readJsonSafe<UserProfile>(getUserProfileFilePath(uid)) || { name: '', photoURL: '' };

    if (isR2Configured()) {
      const r2Key = getUserProfileR2Key(uid);
      const r2Profile = await downloadJsonFromR2<UserProfile>(r2Key);
      if (r2Profile && (r2Profile.name || r2Profile.photoURL)) {
        profile = r2Profile;
        writeUserProfile(uid, profile);
      } else if (!profile.name && !profile.photoURL && isAdminEmail(authResult.user.email)) {
        const legacyR2 = await downloadJsonFromR2<UserProfile>(R2_APP_DATA.PROFILE);
        const legacyLocal = readJsonSafe<UserProfile>(path.join(DATA_DIR, 'user-profile.json'));
        const candidate = (legacyR2 && (legacyR2.name || legacyR2.photoURL)) ? legacyR2 : legacyLocal;
        if (candidate && (candidate.name || candidate.photoURL)) {
          profile = candidate;
          writeUserProfile(uid, profile);
          await uploadJsonToR2(r2Key, profile).catch(() => {});
        }
      } else if (profile.name || profile.photoURL) {
        await uploadJsonToR2(r2Key, profile).catch(() => {});
      }
    }

    return NextResponse.json(profile);
  } catch (err: unknown) {
    return safeErrorResponse(err, 'Failed to read profile');
  }
}

export async function POST(req: NextRequest) {
  try {
    const csrfError = verifyCsrfAndJson(req);
    if (csrfError) return csrfError;

    const authResult = await requireUser(req);
    if ('errorResponse' in authResult) return authResult.errorResponse;

    const uid = authResult.user.uid;
    const ip = getClientIp(req);
    const rl = await checkRateLimit({
      key: `profile-post:${uid}`,
      limit: 30,
      windowMs: 60 * 1000,
    });
    if (!rl.allowed) {
      logSecurityEvent('rate_limit_exceeded', { endpoint: '/api/profile', uid, ip });
      return rateLimitResponse(rl.retryAfterSeconds);
    }

    const rawBody = await req.json().catch(() => null);
    const parsed = profileSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid profile fields or image exceeds 2MB limit.' },
        { status: 400 }
      );
    }

    const rawName = parsed.data.name;
    const rawPhoto = parsed.data.photoURL;
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

    writeUserProfile(uid, profile);

    if (isR2Configured()) {
      await uploadJsonToR2(getUserProfileR2Key(uid), profile).catch(() => {});
    }

    return NextResponse.json({ success: true, profile });
  } catch (err: unknown) {
    return safeErrorResponse(err, 'Failed to save profile');
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const csrfError = verifyCsrfAndJson(req, { requireJson: false });
    if (csrfError) return csrfError;

    const authResult = await requireUser(req);
    if ('errorResponse' in authResult) return authResult.errorResponse;

    const uid = authResult.user.uid;
    const ip = getClientIp(req);
    const rl = await checkRateLimit({
      key: `profile-delete:${uid}`,
      limit: 5,
      windowMs: 60 * 60 * 1000,
    });
    if (!rl.allowed) {
      return rateLimitResponse(rl.retryAfterSeconds);
    }

    const userDir = path.join(DATA_DIR, 'users', uid);
    if (fs.existsSync(userDir)) {
      fs.rmSync(userDir, { recursive: true, force: true });
    }

    if (isR2Configured()) {
      await Promise.all([
        deleteFromR2(`_app_data/users/${uid}/profile.json`).catch(() => false),
        deleteFromR2(`_app_data/users/${uid}/boards.json`).catch(() => false),
      ]);
    }

    logSecurityEvent('user_data_deleted', { uid, ip });

    return NextResponse.json({
      success: true,
      message: 'All personal profile and board data deleted.',
    });
  } catch (err: unknown) {
    return safeErrorResponse(err, 'Failed to delete user profile and data');
  }
}
