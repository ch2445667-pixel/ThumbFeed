import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { isR2Configured, deleteFromR2, extractR2KeyFromUrl } from '../../../../lib/r2';
import { deleteGalleryItem, invalidateGalleryCache } from '../../../../lib/galleryService';
import { sanitizeMediaKey } from '../../../../lib/urlSafety';
import {
  requireAdmin,
  verifyCsrfAndJson,
  getClientIp,
  logSecurityEvent,
  safeErrorResponse,
} from '../../../../lib/serverAuth';
import { checkRateLimit, rateLimitResponse } from '../../../../lib/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const deleteSchema = z
  .object({
    id: z.string().trim().max(160).optional(),
    imageUrl: z.string().trim().max(2048).optional(),
    r2Key: z.string().trim().max(512).optional(),
  })
  .refine((v) => Boolean(v.id || v.imageUrl || v.r2Key), {
    message: 'Thumbnail ID or imageUrl is required',
  });

export async function POST(req: NextRequest) {
  try {
    const csrfError = verifyCsrfAndJson(req);
    if (csrfError) return csrfError;

    const authResult = await requireAdmin(req);
    if ('errorResponse' in authResult) return authResult.errorResponse;

    const ip = getClientIp(req);
    const rl = await checkRateLimit({
      key: `delete-thumb:${authResult.user.uid}`,
      limit: 60,
      windowMs: 15 * 60 * 1000,
    });
    if (!rl.allowed) {
      logSecurityEvent('rate_limit_exceeded', { endpoint: '/api/thumbnails/delete', uid: authResult.user.uid, ip });
      return rateLimitResponse(rl.retryAfterSeconds);
    }

    const rawBody = await req.json().catch(() => null);
    const parsed = deleteSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Thumbnail ID or imageUrl is required' },
        { status: 400 }
      );
    }

    const { id, imageUrl, r2Key: explicitR2Key } = parsed.data;
    const sanitizedExplicit = explicitR2Key ? sanitizeMediaKey(explicitR2Key) : null;
    if (explicitR2Key && !sanitizedExplicit) {
      return NextResponse.json({ error: 'Invalid media key' }, { status: 400 });
    }

    const r2Key = sanitizedExplicit || (imageUrl ? extractR2KeyFromUrl(imageUrl) : null);

    let galleryDeleted = false;
    let storageDeleted = false;

    const result = await deleteGalleryItem(id, imageUrl, r2Key || undefined);
    galleryDeleted = result.success;
    if (result.storageDeleted) {
      storageDeleted = true;
    }

    if (r2Key && isR2Configured()) {
      const deleted = await deleteFromR2(r2Key);
      if (deleted) storageDeleted = true;
      const base = r2Key.replace(/\.[^/.]+$/, '');
      await deleteFromR2(`small/${base}.webp`).catch(() => {});
      await deleteFromR2(`small/${r2Key}`).catch(() => {});
    }

    invalidateGalleryCache();

    logSecurityEvent('thumbnail_deleted', {
      uid: authResult.user.uid,
      id: id || undefined,
      r2Key: r2Key || undefined,
      storageDeleted,
      ip,
    });

    return NextResponse.json({
      success: true,
      id,
      imageUrl,
      galleryDeleted,
      storageDeleted,
      permanent: true,
      canDeleteStorageObjects: isR2Configured(),
      message: storageDeleted
        ? 'Thumbnail permanently deleted from feed and Cloudflare R2 storage'
        : 'Thumbnail removed from feed',
    });
  } catch (err: unknown) {
    return safeErrorResponse(err, 'Failed to delete thumbnail');
  }
}