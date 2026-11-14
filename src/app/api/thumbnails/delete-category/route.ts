import { NextRequest, NextResponse } from 'next/server';
import { getAllGalleryItems, deleteGalleryItem, saveGalleryItems, invalidateGalleryCache } from '@/lib/galleryService';
import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ADMIN_EMAILS = ['canonwater2025@gmail.com', 'shivashiva66407@gmail.com'];

function isLocalDevRequest(req: NextRequest): boolean {
  if (process.env.NODE_ENV !== 'development') return false;
  const host = (req.headers.get('host') || '').toLowerCase().split(',')[0].trim();
  return (
    host === 'localhost' ||
    host.startsWith('localhost:') ||
    host === '127.0.0.1' ||
    host.startsWith('127.0.0.1:') ||
    host === '[::1]' ||
    host.startsWith('[::1]:') ||
    host.includes('ais-dev') ||
    host.includes('run.app') ||
    host.includes('ai.studio')
  );
}

async function verifyAdmin(idToken: string): Promise<string | null> {
  if (!idToken) return 'Sign in as the owner to delete a category.';
  try {
    const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
    if (!fs.existsSync(configPath)) return 'Firebase configuration is missing.';
    const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    if (!firebaseConfig?.apiKey) return 'Firebase API key is missing.';

    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseConfig.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      }
    );
    if (!res.ok) return `Sign-in check failed (HTTP ${res.status}). Please sign in again.`;
    const data = await res.json();
    const userRecord = data?.users?.[0];
    const email = (userRecord?.email || '').trim().toLowerCase();
    if (!userRecord?.emailVerified || !ADMIN_EMAILS.some((e) => e.toLowerCase() === email)) {
      return 'Only the owner can delete a category.';
    }
    return null;
  } catch (err) {
    return `Sign-in check could not run: ${err instanceof Error ? err.message : String(err)}`;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { category, idToken } = body || {};

    if (!category || typeof category !== 'string' || !category.trim()) {
      return NextResponse.json({ error: 'A category name is required' }, { status: 400 });
    }
    const name = category.trim();

    const authError = isLocalDevRequest(req) ? null : await verifyAdmin(idToken);
    if (authError) {
      return NextResponse.json({ error: authError }, { status: 403 });
    }

    const allItems = await getAllGalleryItems(true);
    const matches = (t?: string) => (t || '').trim().toLowerCase() === name.toLowerCase();

    const toDelete: typeof allItems = [];
    const toUpdate: typeof allItems = [];

    for (const item of allItems) {
      const nicheMatches = matches(item.niche);
      const tags = Array.isArray(item.tags) ? item.tags : [];
      const tagMatches = tags.some(matches);

      if (!nicheMatches && !tagMatches) continue;

      const remainingTags = tags.filter((t) => !matches(t));
      const hasOtherNiche = !!item.niche && !matches(item.niche);

      if (remainingTags.length === 0 && !hasOtherNiche) {
        toDelete.push(item);
      } else {
        const nextNiche = matches(item.niche)
          ? remainingTags[0] || (hasOtherNiche ? item.niche : '')
          : item.niche;
        toUpdate.push({
          ...item,
          niche: nextNiche as any,
          tags: remainingTags,
        });
      }
    }

    let deleted = 0;
    for (const item of toDelete) {
      const res = await deleteGalleryItem(item.id, item.imageUrl);
      if (res.success) deleted++;
    }

    let stripped = 0;
    if (toUpdate.length > 0) {
      await saveGalleryItems(toUpdate);
      stripped = toUpdate.length;
    }

    // Also remove from categories.json if present
    const DATA_DIR = path.join(process.cwd(), 'data');
    const CAT_FILE = path.join(DATA_DIR, 'categories.json');
    if (fs.existsSync(CAT_FILE)) {
      try {
        const cats: string[] = JSON.parse(fs.readFileSync(CAT_FILE, 'utf-8'));
        if (Array.isArray(cats)) {
          const updatedCats = cats.filter((c) => !matches(c));
          fs.writeFileSync(CAT_FILE, JSON.stringify(updatedCats, null, 2), 'utf-8');
        }
      } catch {}
    }

    invalidateGalleryCache();

    return NextResponse.json({
      success: true,
      category: name,
      removed: deleted,
      strippedFrom: stripped,
      message:
        deleted > 0
          ? `Removed ${deleted} thumbnail${deleted === 1 ? '' : 's'} and stripped "${name}" from ${stripped}.`
          : `Stripped "${name}" from ${stripped} thumbnail${stripped === 1 ? '' : 's'}.`,
    });
  } catch (err: any) {
    console.error('Delete category error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}