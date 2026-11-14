import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { CollectionBoard } from '@/lib/types';
import { downloadJsonFromR2, uploadJsonToR2, isR2Configured, R2_APP_DATA } from '@/lib/r2';

const DATA_DIR = path.join(process.cwd(), 'data');
const BOARDS_FILE_PATH = path.join(DATA_DIR, 'boards.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readLocalBoards(): CollectionBoard[] {
  try {
    ensureDataDir();
    if (fs.existsSync(BOARDS_FILE_PATH)) {
      const content = fs.readFileSync(BOARDS_FILE_PATH, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.warn('Could not read local boards.json:', err);
  }
  return [];
}

function writeLocalBoards(boards: CollectionBoard[]): void {
  try {
    ensureDataDir();
    fs.writeFileSync(BOARDS_FILE_PATH, JSON.stringify(boards, null, 2), 'utf-8');
  } catch (err) {
    console.warn('Could not write local boards.json:', err);
  }
}

function sanitizeBoards(input: unknown): CollectionBoard[] {
  if (!Array.isArray(input)) return [];
  const clean: CollectionBoard[] = [];
  for (const raw of input.slice(0, 200)) {
    if (!raw || typeof raw !== 'object') continue;
    const obj = raw as Record<string, unknown>;
    const id = typeof obj.id === 'string' ? obj.id.trim().slice(0, 100) : '';
    const name = typeof obj.name === 'string' ? obj.name.trim().slice(0, 120) : '';
    if (!id || !name) continue;
    const description = typeof obj.description === 'string' ? obj.description.trim().slice(0, 500) : undefined;
    const thumbnailIds = Array.isArray(obj.thumbnailIds)
      ? Array.from(new Set(obj.thumbnailIds.filter((x): x is string => typeof x === 'string' && x.trim().length > 0).map(x => x.trim().slice(0, 160)))).slice(0, 2000)
      : [];
    const createdAt = typeof obj.createdAt === 'string' ? obj.createdAt.slice(0, 64) : new Date().toISOString();
    clean.push({ id, name, ...(description ? { description } : {}), thumbnailIds, createdAt });
  }
  return clean;
}

export async function GET() {
  try {
    let boards = readLocalBoards();

    // If Cloudflare R2 is configured, pull centralized boards
    if (isR2Configured()) {
      try {
        const r2Boards = await downloadJsonFromR2<CollectionBoard[]>(R2_APP_DATA.BOARDS);
        if (Array.isArray(r2Boards)) {
          boards = sanitizeBoards(r2Boards);
          writeLocalBoards(boards);
        } else if (boards.length > 0) {
          // Only upload local boards to R2 when _app_data/boards.json does not exist yet
          await uploadJsonToR2(R2_APP_DATA.BOARDS, boards).catch(() => {});
        }
      } catch (err) {
        console.warn('Failed to sync boards with Cloudflare R2:', err);
      }
    }

    return NextResponse.json(boards);
  } catch (error) {
    console.error('Failed to get boards:', error);
    return NextResponse.json([]);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawBoards = Array.isArray(body)
      ? body
      : Array.isArray(body?.boards)
        ? body.boards
        : null;

    if (!rawBoards) {
      return NextResponse.json({ success: false, error: 'Boards array is required' }, { status: 400 });
    }

    const boards = sanitizeBoards(rawBoards);

    // 1. Write to local file
    writeLocalBoards(boards);

    // 2. Upload to Cloudflare R2
    if (isR2Configured()) {
      try {
        await uploadJsonToR2(R2_APP_DATA.BOARDS, boards);
      } catch (err) {
        console.warn('Failed to upload boards to Cloudflare R2:', err);
      }
    }

    return NextResponse.json({ success: true, count: boards.length });
  } catch (error) {
    console.error('Failed to save boards:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save boards' },
      { status: 500 }
    );
  }
}
