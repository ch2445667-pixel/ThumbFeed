import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { downloadJsonFromR2, uploadJsonToR2, isR2Configured, R2_APP_DATA } from '@/lib/r2';
import {
  requireAdmin,
  verifyCsrfAndJson,
  getClientIp,
  logSecurityEvent,
  safeErrorResponse,
} from '@/lib/serverAuth';
import { checkRateLimit, rateLimitResponse } from '@/lib/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DATA_DIR = path.join(process.cwd(), 'data');
const CATEGORIES_FILE_PATH = path.join(DATA_DIR, 'categories.json');

const DEFAULT_CATEGORIES = [
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

const categoriesPayloadSchema = z.union([
  z.array(z.string().trim().min(1).max(60)).max(120),
  z.object({ categories: z.array(z.string().trim().min(1).max(60)).max(120) }),
]);

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function sanitizeCategories(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const clean: string[] = [];
  for (const item of input.slice(0, 120)) {
    if (typeof item !== 'string') continue;
    const trimmed = item.trim().slice(0, 60);
    if (!trimmed) continue;
    const lower = trimmed.toLowerCase();
    if (lower === 'all' || seen.has(lower)) continue;
    seen.add(lower);
    clean.push(trimmed);
  }
  return clean;
}

function readLocalCategories(): string[] {
  try {
    ensureDataDir();
    if (fs.existsSync(CATEGORIES_FILE_PATH)) {
      const content = fs.readFileSync(CATEGORIES_FILE_PATH, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) return sanitizeCategories(parsed);
    }
  } catch (err) {
    console.warn('Could not read local categories.json:', err);
  }
  return DEFAULT_CATEGORIES;
}

function writeLocalCategories(categories: string[]): void {
  try {
    ensureDataDir();
    fs.writeFileSync(CATEGORIES_FILE_PATH, JSON.stringify(categories, null, 2), 'utf-8');
  } catch (err) {
    console.warn('Could not write local categories.json:', err);
  }
}

export async function GET(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rl = await checkRateLimit({
      key: `categories-get:${ip}`,
      limit: 120,
      windowMs: 60 * 1000,
    });
    if (!rl.allowed) return rateLimitResponse(rl.retryAfterSeconds);

    let categories = readLocalCategories();

    if (isR2Configured()) {
      try {
        const r2Categories = await downloadJsonFromR2<string[]>(R2_APP_DATA.CATEGORIES);
        if (Array.isArray(r2Categories)) {
          categories = sanitizeCategories(r2Categories);
          writeLocalCategories(categories);
        }
      } catch (err) {
        console.warn('Failed to sync categories with Cloudflare R2:', err);
      }
    }

    return NextResponse.json(categories);
  } catch {
    return NextResponse.json(DEFAULT_CATEGORIES);
  }
}

export async function POST(req: NextRequest) {
  try {
    const csrfError = verifyCsrfAndJson(req);
    if (csrfError) return csrfError;

    const authResult = await requireAdmin(req);
    if ('errorResponse' in authResult) return authResult.errorResponse;

    const ip = getClientIp(req);
    const rl = await checkRateLimit({
      key: `categories-post:${authResult.user.uid}`,
      limit: 30,
      windowMs: 60 * 1000,
    });
    if (!rl.allowed) {
      logSecurityEvent('rate_limit_exceeded', { endpoint: '/api/categories', uid: authResult.user.uid, ip });
      return rateLimitResponse(rl.retryAfterSeconds);
    }

    const rawBody = await req.json().catch(() => null);
    const parsed = categoriesPayloadSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Categories array is required' }, { status: 400 });
    }

    const raw = Array.isArray(parsed.data) ? parsed.data : parsed.data.categories;
    const categories = sanitizeCategories(raw);

    writeLocalCategories(categories);

    if (isR2Configured()) {
      await uploadJsonToR2(R2_APP_DATA.CATEGORIES, categories).catch(() => {});
    }

    logSecurityEvent('categories_updated', {
      uid: authResult.user.uid,
      count: categories.length,
      ip,
    });

    return NextResponse.json({ success: true, count: categories.length });
  } catch (err: unknown) {
    return safeErrorResponse(err, 'Failed to save categories');
  }
}
