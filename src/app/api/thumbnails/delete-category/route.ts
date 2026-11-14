import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import { getAllGalleryItems, deleteGalleryItem, saveGalleryItems, invalidateGalleryCache } from '@/lib/galleryService';
import { isR2Configured, uploadJsonToR2, R2_APP_DATA } from '@/lib/r2';
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

const deleteCategorySchema = z.object({
  category: z.string().trim().min(1).max(60),
});

export async function POST(req: NextRequest) {
  try {
    const csrfError = verifyCsrfAndJson(req);
    if (csrfError) return csrfError;

    const authResult = await requireAdmin(req);
    if ('errorResponse' in authResult) return authResult.errorResponse;

    const ip = getClientIp(req);
    const rl = await checkRateLimit({
      key: `delete-category:${authResult.user.uid}`,
      limit: 20,
      windowMs: 15 * 60 * 1000,
    });
    if (!rl.allowed) {
      logSecurityEvent('rate_limit_exceeded', { endpoint: '/api/thumbnails/delete-category', uid: authResult.user.uid, ip });
      return rateLimitResponse(rl.retryAfterSeconds);
    }

    const rawBody = await req.json().catch(() => null);
    const parsed = deleteCategorySchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json({ error: 'A valid category name is required' }, { status: 400 });
    }
    const name = parsed.data.category;

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
          niche: nextNiche,
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

    const DATA_DIR = path.join(process.cwd(), 'data');
    const CAT_FILE = path.join(DATA_DIR, 'categories.json');
    if (fs.existsSync(CAT_FILE)) {
      try {
        const cats: string[] = JSON.parse(fs.readFileSync(CAT_FILE, 'utf-8'));
        if (Array.isArray(cats)) {
          const updatedCats = cats.filter((c) => !matches(c));
          fs.writeFileSync(CAT_FILE, JSON.stringify(updatedCats, null, 2), 'utf-8');
          if (isR2Configured()) {
            await uploadJsonToR2(R2_APP_DATA.CATEGORIES, updatedCats).catch(() => {});
          }
        }
      } catch {}
    }

    invalidateGalleryCache();

    logSecurityEvent('category_deleted', {
      uid: authResult.user.uid,
      category: name,
      removed: deleted,
      strippedFrom: stripped,
      ip,
    });

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
  } catch (err: unknown) {
    return safeErrorResponse(err, 'Failed to delete category');
  }
}