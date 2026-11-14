import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { CollectionBoard } from '@/lib/types';
import { downloadJsonFromR2, uploadJsonToR2, isR2Configured, R2_APP_DATA } from '@/lib/r2';
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

const DATA_DIR = path.join(process.cwd(), 'data');

const boardSchema = z.object({
  id: z.string().trim().regex(/^[a-zA-Z0-9_-]{1,128}$/),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional(),
  thumbnailIds: z.array(z.string().trim().min(1).max(160)).max(2000),
  createdAt: z.string().trim().max(64).optional(),
  colorTheme: z.string().trim().max(32).optional(),
});

function getUserBoardsFilePath(uid: string): string {
  if (!isValidFirebaseUid(uid)) throw new Error('Invalid user UID');
  return path.join(DATA_DIR, 'users', uid, 'boards.json');
}

function getUserBoardsR2Key(uid: string): string {
  if (!isValidFirebaseUid(uid)) throw new Error('Invalid user UID');
  return `_app_data/users/${uid}/boards.json`;
}

function readJsonFileSafe<T>(filePath: string): T | null {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
    }
  } catch {}
  return null;
}

function writeUserBoards(uid: string, boards: CollectionBoard[]): void {
  const filePath = getUserBoardsFilePath(uid);
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, JSON.stringify(boards, null, 2), 'utf-8');
}

function sanitizeBoards(input: unknown): CollectionBoard[] {
  if (!Array.isArray(input)) return [];
  const clean: CollectionBoard[] = [];
  for (const raw of input.slice(0, 200)) {
    const parsed = boardSchema.safeParse(raw);
    if (!parsed.success) continue;
    clean.push({
      id: parsed.data.id,
      name: parsed.data.name,
      ...(parsed.data.description ? { description: parsed.data.description } : {}),
      thumbnailIds: Array.from(new Set(parsed.data.thumbnailIds)),
      createdAt: parsed.data.createdAt || new Date().toISOString(),
      ...(parsed.data.colorTheme ? { colorTheme: parsed.data.colorTheme } : {}),
    });
  }
  return clean;
}

export async function GET(req: NextRequest) {
  try {
    const authResult = await requireUser(req);
    if ('errorResponse' in authResult) return authResult.errorResponse;

    const uid = authResult.user.uid;
    const rl = await checkRateLimit({
      key: `boards-get:${uid}`,
      limit: 120,
      windowMs: 60 * 1000,
    });
    if (!rl.allowed) return rateLimitResponse(rl.retryAfterSeconds);

    const filePath = getUserBoardsFilePath(uid);
    const localBoardsRaw = readJsonFileSafe<CollectionBoard[]>(filePath);
    let boards = Array.isArray(localBoardsRaw) ? sanitizeBoards(localBoardsRaw) : [];

    if (isR2Configured()) {
      const r2Key = getUserBoardsR2Key(uid);
      const r2Boards = await downloadJsonFromR2<CollectionBoard[]>(r2Key);
      if (Array.isArray(r2Boards)) {
        boards = sanitizeBoards(r2Boards);
        writeUserBoards(uid, boards);
      } else if (boards.length === 0 && isAdminEmail(authResult.user.email)) {
        // One-time admin continuity fallback from legacy global boards if per-UID storage doesn't exist yet
        const legacyR2 = await downloadJsonFromR2<CollectionBoard[]>(R2_APP_DATA.BOARDS);
        const legacyLocal = readJsonFileSafe<CollectionBoard[]>(path.join(DATA_DIR, 'boards.json'));
        const candidate = Array.isArray(legacyR2) ? legacyR2 : legacyLocal;
        if (Array.isArray(candidate) && candidate.length > 0) {
          boards = sanitizeBoards(candidate);
          writeUserBoards(uid, boards);
          await uploadJsonToR2(r2Key, boards).catch(() => {});
        }
      } else if (boards.length > 0) {
        await uploadJsonToR2(r2Key, boards).catch(() => {});
      }
    } else if (boards.length === 0 && isAdminEmail(authResult.user.email)) {
      const legacyLocal = readJsonFileSafe<CollectionBoard[]>(path.join(DATA_DIR, 'boards.json'));
      if (Array.isArray(legacyLocal) && legacyLocal.length > 0) {
        boards = sanitizeBoards(legacyLocal);
        writeUserBoards(uid, boards);
      }
    }

    return NextResponse.json(boards);
  } catch (err: unknown) {
    return safeErrorResponse(err, 'Failed to load boards');
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
      key: `boards-post:${uid}`,
      limit: 60,
      windowMs: 60 * 1000,
    });
    if (!rl.allowed) {
      logSecurityEvent('rate_limit_exceeded', { endpoint: '/api/boards', uid, ip });
      return rateLimitResponse(rl.retryAfterSeconds);
    }

    const body = await req.json().catch(() => null);
    const rawBoards = Array.isArray(body)
      ? body
      : Array.isArray((body as { boards?: unknown } | null)?.boards)
        ? (body as { boards: unknown[] }).boards
        : null;

    if (!rawBoards) {
      return NextResponse.json({ success: false, error: 'Boards array is required' }, { status: 400 });
    }

    const boards = sanitizeBoards(rawBoards);
    writeUserBoards(uid, boards);

    if (isR2Configured()) {
      await uploadJsonToR2(getUserBoardsR2Key(uid), boards).catch(() => {});
    }

    return NextResponse.json({ success: true, count: boards.length });
  } catch (err: unknown) {
    return safeErrorResponse(err, 'Failed to save boards');
  }
}
