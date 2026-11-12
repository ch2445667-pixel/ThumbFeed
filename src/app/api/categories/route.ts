import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { downloadJsonFromR2, uploadJsonToR2, isR2Configured, R2_APP_DATA } from '@/lib/r2';

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

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readLocalCategories(): string[] {
  try {
    ensureDataDir();
    if (fs.existsSync(CATEGORIES_FILE_PATH)) {
      const content = fs.readFileSync(CATEGORIES_FILE_PATH, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
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

export async function GET() {
  try {
    let categories = readLocalCategories();

    // If Cloudflare R2 is configured, pull centralized categories
    if (isR2Configured()) {
      try {
        const r2Categories = await downloadJsonFromR2<string[]>(R2_APP_DATA.CATEGORIES);
        if (Array.isArray(r2Categories) && r2Categories.length > 0) {
          categories = r2Categories;
          writeLocalCategories(categories);
        } else if (categories.length > 0) {
          // Sync default/local categories up to R2
          await uploadJsonToR2(R2_APP_DATA.CATEGORIES, categories).catch(() => {});
        }
      } catch (err) {
        console.warn('Failed to sync categories with Cloudflare R2:', err);
      }
    }

    return NextResponse.json(categories);
  } catch (error) {
    console.error('Failed to get categories:', error);
    return NextResponse.json(DEFAULT_CATEGORIES);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const categories: string[] = Array.isArray(body)
      ? body
      : Array.isArray(body.categories)
        ? body.categories
        : [];

    if (categories.length === 0) {
      return NextResponse.json({ success: false, error: 'Empty categories array' }, { status: 400 });
    }

    // 1. Write to local file
    writeLocalCategories(categories);

    // 2. Upload to Cloudflare R2
    if (isR2Configured()) {
      try {
        await uploadJsonToR2(R2_APP_DATA.CATEGORIES, categories);
      } catch (err) {
        console.warn('Failed to upload categories to Cloudflare R2:', err);
      }
    }

    return NextResponse.json({ success: true, count: categories.length });
  } catch (error) {
    console.error('Failed to save categories:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save categories' },
      { status: 500 }
    );
  }
}
