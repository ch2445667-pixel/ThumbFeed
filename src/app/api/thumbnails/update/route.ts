import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { updateGalleryItemMetadata } from '../../../../lib/galleryService';
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

const updateSchema = z
  .object({
    id: z.string().trim().max(160).optional(),
    imageUrl: z.string().trim().max(2048).optional(),
    title: z.string().trim().min(1).max(180).optional(),
    creator: z.string().trim().max(100).optional(),
    viewsEstimate: z.string().trim().max(40).optional(),
  })
  .refine((v) => Boolean(v.id || v.imageUrl), {
    message: 'Valid id or imageUrl is required',
  })
  .refine(
    (v) => v.title !== undefined || v.creator !== undefined || v.viewsEstimate !== undefined,
    { message: 'At least one metadata field is required' }
  );

export async function POST(req: NextRequest) {
  try {
    const csrfError = verifyCsrfAndJson(req);
    if (csrfError) return csrfError;

    const authResult = await requireAdmin(req);
    if ('errorResponse' in authResult) return authResult.errorResponse;

    const ip = getClientIp(req);
    const rl = await checkRateLimit({
      key: `update-thumb:${authResult.user.uid}`,
      limit: 60,
      windowMs: 15 * 60 * 1000,
    });
    if (!rl.allowed) {
      logSecurityEvent('rate_limit_exceeded', { endpoint: '/api/thumbnails/update', uid: authResult.user.uid, ip });
      return rateLimitResponse(rl.retryAfterSeconds);
    }

    const rawBody = await req.json().catch(() => null);
    const parsed = updateSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid thumbnail metadata update payload.' },
        { status: 400 }
      );
    }

    const { id, imageUrl, title, creator, viewsEstimate } = parsed.data;
    const updated = await updateGalleryItemMetadata(
      { id, imageUrl },
      { title, creator, viewsEstimate }
    );
    if (!updated) {
      return NextResponse.json({ error: 'Thumbnail not found' }, { status: 404 });
    }

    logSecurityEvent('thumbnail_updated', {
      uid: authResult.user.uid,
      id: updated.id,
      ip,
    });

    return NextResponse.json({ success: true, item: updated });
  } catch (err: unknown) {
    return safeErrorResponse(err, 'Failed to update thumbnail');
  }
}
