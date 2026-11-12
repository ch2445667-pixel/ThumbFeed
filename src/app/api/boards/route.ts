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

export async function GET() {
  try {
    let boards = readLocalBoards();

    // If Cloudflare R2 is configured, pull centralized boards
    if (isR2Configured()) {
      try {
        const r2Boards = await downloadJsonFromR2<CollectionBoard[]>(R2_APP_DATA.BOARDS);
        if (Array.isArray(r2Boards) && r2Boards.length > 0) {
          // Merge with local boards if any exist
          const map = new Map<string, CollectionBoard>();
          for (const b of boards) map.set(b.id, b);
          for (const b of r2Boards) map.set(b.id, b);
          boards = Array.from(map.values());
          writeLocalBoards(boards);
        } else if (boards.length > 0) {
          // If local has boards but R2 does not yet, upload to R2
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
    const boards: CollectionBoard[] = Array.isArray(body)
      ? body
      : Array.isArray(body.boards)
        ? body.boards
        : [];

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
