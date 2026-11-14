import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { extractColorProfile } from '../../../../lib/colorExtract';
import { withDimensions } from '../../../../lib/dimensions';
import { isR2Configured, uploadToR2, deleteFromR2, getR2Config } from '../../../../lib/r2';
import { saveGalleryItems, invalidateGalleryCache } from '../../../../lib/galleryService';
import { ThumbnailItem } from '../../../../lib/types';
import { isSafeExternalHttpUrl } from '../../../../lib/urlSafety';
import {
  requireAdmin,
  verifyCsrfAndJson,
  getClientIp,
  logSecurityEvent,
  safeErrorResponse,
} from '../../../../lib/serverAuth';
import { safeExternalFetch, readResponseBufferWithLimit } from '../../../../lib/ssrfFetch';
import { checkRateLimit, rateLimitResponse } from '../../../../lib/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_UPLOAD_IMAGE_BYTES = 15 * 1024 * 1024; // 15MB cap
const MAX_BATCH_ITEMS = 100;
const ALLOWED_SHARP_FORMATS = new Set(['jpeg', 'png', 'webp', 'gif', 'avif']);

const uploadItemSchema = z.object({
  id: z.string().trim().regex(/^[a-zA-Z0-9_-]{1,128}$/).optional(),
  kind: z.enum(['thumbnail', 'poster']).optional(),
  videoId: z.string().trim().regex(/^[a-zA-Z0-9_-]{1,64}$/).optional(),
  imageUrl: z.string().trim().min(1).max(20 * 1024 * 1024),
  sourceUrl: z.string().trim().max(2048).optional(),
  title: z.string().trim().min(1).max(180).default('Thumbnail'),
  creator: z.string().trim().max(100).optional(),
  niche: z.string().trim().max(60).optional(),
  tags: z.array(z.string().trim().max(60)).max(25).optional(),
  styles: z.array(z.string().trim().max(80)).max(15).optional(),
  views: z.string().trim().max(40).optional(),
  viewsEstimate: z.string().trim().max(40).optional(),
  publishedTime: z.string().trim().max(60).optional(),
});

function sanitizeFilename(title: string, videoId: string): string {
  const cleanTitle = title
    .replace(/[^a-zA-Z0-9_\-\s]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 40);

  const cleanVid = (videoId || 'thumb').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32) || 'thumb';
  const randSuffix = crypto.randomUUID().replace(/-/g, '').slice(0, 8);
  if (cleanTitle) {
    return `${cleanTitle}_${cleanVid}_${randSuffix}.jpg`;
  }
  return `thumb_${cleanVid}_${randSuffix}.jpg`;
}

async function fetchImageBuffer(imageUrl: string, videoId?: string): Promise<Buffer | null> {
  if (imageUrl.startsWith('data:image/')) {
    const matches = imageUrl.match(/^data:(image\/(?:png|jpeg|jpg|webp|gif));base64,([A-Za-z0-9+/=]+)$/i);
    if (matches && matches[2].length <= MAX_UPLOAD_IMAGE_BYTES * 1.4) {
      const buffer = Buffer.from(matches[2], 'base64');
      if (buffer.length > 0 && buffer.length <= MAX_UPLOAD_IMAGE_BYTES) {
        return buffer;
      }
    }
    return null;
  }

  const urlsToTry: string[] = [];
  const pushUrl = (u: string) => {
    if (u && !urlsToTry.includes(u)) urlsToTry.push(u);
  };
  if (isSafeExternalHttpUrl(imageUrl)) {
    pushUrl(imageUrl);
  }
  const cleanVid = videoId?.replace(/[^a-zA-Z0-9_-]/g, '');
  if (cleanVid && cleanVid.length === 11) {
    pushUrl(`https://i.ytimg.com/vi/${cleanVid}/maxresdefault.jpg`);
    pushUrl(`https://i.ytimg.com/vi/${cleanVid}/sddefault.jpg`);
    pushUrl(`https://i.ytimg.com/vi/${cleanVid}/hqdefault.jpg`);
  }

  for (const url of urlsToTry) {
    try {
      const res = await safeExternalFetch(url, {
        timeoutMs: 12000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      if (res.ok) {
        if (res.url && !isSafeExternalHttpUrl(res.url)) continue;
        const contentType = (res.headers.get('content-type') || '').toLowerCase();
        if (!contentType.startsWith('image/') || contentType.includes('svg')) continue;
        const buffer = await readResponseBufferWithLimit(res, MAX_UPLOAD_IMAGE_BYTES);
        if (buffer.length > 2000 || url.includes('hqdefault')) {
          return buffer;
        }
      }
    } catch {
      // try next URL
    }
  }

  return null;
}

async function decodeAndOptimizeImage(input: Buffer, isPoster: boolean): Promise<{
  optimizedJpg: Buffer;
  smallWebp: Buffer | null;
  width?: number;
  height?: number;
}> {
  const sharpMod: any = await import('sharp').then((m: any) => m.default || m);
  const meta = await sharpMod(input).metadata();
  if (!meta?.format || !ALLOWED_SHARP_FORMATS.has(String(meta.format).toLowerCase())) {
    throw new Error('Unsupported or invalid image payload');
  }

  const matteColor = isPoster ? '#000000' : '#090a0d';
  const maxSide = isPoster ? 1000 : 1280;

  const optimizedJpg = await sharpMod(input)
    .resize({ width: maxSide, height: maxSide, fit: 'inside', withoutEnlargement: true })
    .flatten({ background: matteColor })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();

  let smallWebp: Buffer | null = null;
  try {
    smallWebp = await sharpMod(input)
      .resize({ width: 400, withoutEnlargement: true })
      .webp({ quality: 75 })
      .toBuffer();
  } catch {
    smallWebp = null;
  }

  return {
    optimizedJpg,
    smallWebp,
    width: meta.width,
    height: meta.height,
  };
}

export async function POST(req: NextRequest) {
  try {
    const csrfError = verifyCsrfAndJson(req);
    if (csrfError) return csrfError;

    const authResult = await requireAdmin(req);
    if ('errorResponse' in authResult) return authResult.errorResponse;

    const ip = getClientIp(req);
    const rl = await checkRateLimit({
      key: `upload-thumb:${authResult.user.uid}`,
      limit: 40,
      windowMs: 15 * 60 * 1000,
    });
    if (!rl.allowed) {
      logSecurityEvent('rate_limit_exceeded', { endpoint: '/api/r2/upload-thumbnail', uid: authResult.user.uid, ip });
      return rateLimitResponse(rl.retryAfterSeconds);
    }

    const rawBody = await req.json().catch(() => null);
    if (!rawBody || typeof rawBody !== 'object') {
      return NextResponse.json({ error: 'Invalid JSON request body' }, { status: 400 });
    }

    const candidateItems = Array.isArray((rawBody as { items?: unknown }).items)
      ? (rawBody as { items: unknown[] }).items.slice(0, MAX_BATCH_ITEMS)
      : [rawBody];

    if (candidateItems.length === 0) {
      return NextResponse.json({ error: 'No items to upload' }, { status: 400 });
    }

    const validatedItems: z.infer<typeof uploadItemSchema>[] = [];
    for (const rawItem of candidateItems) {
      const parsed = uploadItemSchema.safeParse(rawItem);
      if (!parsed.success) {
        return NextResponse.json(
          { error: 'One or more thumbnail payloads contain invalid fields.' },
          { status: 400 }
        );
      }
      validatedItems.push(parsed.data);
    }

    const r2Ready = isR2Configured();
    const r2Config = getR2Config();
    const uploadedResults: Record<string, unknown>[] = [];
    const itemsToPersist: ThumbnailItem[] = [];
    const uploadedR2Keys: string[] = [];
    const warnings: string[] = [];

    const CONCURRENCY = 4;
    for (let i = 0; i < validatedItems.length; i += CONCURRENCY) {
      const chunk = validatedItems.slice(i, i + CONCURRENCY);
      await Promise.all(
        chunk.map(async (item) => {
          try {
            const isPoster = item.kind === 'poster' || Boolean(item.id?.startsWith('poster-')) || item.niche === 'Cinema';
            const vId = item.videoId || item.id?.replace(/^.*-/, '') || (isPoster ? 'poster' : 'thumb');
            const cleanTitle = (item.title || (isPoster ? 'poster' : 'thumb'))
              .replace(/[^a-zA-Z0-9_\-\s]/g, '')
              .trim()
              .replace(/\s+/g, '_')
              .slice(0, 40) || (isPoster ? 'poster' : 'thumb');
            const randSuffix = crypto.randomUUID().replace(/-/g, '').slice(0, 8);

            const storagePath = isPoster
              ? `posters/poster_${cleanTitle}_${randSuffix}.jpg`
              : sanitizeFilename(item.title || 'Thumbnail', vId);

            let finalPublicUrl = isSafeExternalHttpUrl(item.imageUrl) ? item.imageUrl : '';
            let thumbSmallUrl: string | null = null;
            let uploadSuccess = false;
            let colors: string[] = [];
            let colorFamilies: string[] = [];
            let dimensions: { width: number; height: number } | null = null;

            const rawBuffer = await fetchImageBuffer(item.imageUrl, item.videoId);
            if (!rawBuffer) {
              warnings.push(`Skipped "${item.title || vId}": image could not be fetched or exceeded 15MB limit.`);
              return;
            }

            const decoded = await decodeAndOptimizeImage(rawBuffer, isPoster);
            if (decoded.width && decoded.height) {
              dimensions = { width: decoded.width, height: decoded.height };
            }

            if (!isPoster) {
              const profile = await extractColorProfile(rawBuffer);
              colors = profile.colors;
              colorFamilies = profile.families;
            }

            if (r2Ready) {
              const r2Result = await uploadToR2({
                key: storagePath,
                buffer: decoded.optimizedJpg,
                contentType: 'image/jpeg',
                cacheControl: 'public, max-age=31536000, immutable',
              });
              finalPublicUrl = r2Result.publicUrl;
              uploadedR2Keys.push(r2Result.key);
              uploadSuccess = true;

              if (decoded.smallWebp) {
                try {
                  const smallPath = `small/${storagePath.replace(/\.[^/.]+$/, '')}.webp`;
                  const r2SmallResult = await uploadToR2({
                    key: smallPath,
                    buffer: decoded.smallWebp,
                    contentType: 'image/webp',
                    cacheControl: 'public, max-age=31536000, immutable',
                  });
                  thumbSmallUrl = r2SmallResult.publicUrl;
                  uploadedR2Keys.push(r2SmallResult.key);
                } catch {
                  warnings.push(`Small preview upload failed for "${item.title || vId}".`);
                }
              }
            } else if (!finalPublicUrl) {
              warnings.push(`Cloud storage is not connected for uploaded file "${item.title || vId}".`);
              return;
            }

            const assignedId = isPoster
              ? (item.id && item.id.startsWith('poster-') ? item.id : `poster-${randSuffix}`)
              : (item.videoId ? `thumb-yt-${item.videoId}` : (item.id || `thumb-${randSuffix}`));

            const viewsValue = item.views || item.viewsEstimate || undefined;
            const baseNote = isPoster ? 'Uploaded movie poster.' : (item.publishedTime ? `Published: ${item.publishedTime}` : '');
            const notes = withDimensions(baseNote, dimensions?.width, dimensions?.height);
            const safeSource = item.sourceUrl && isSafeExternalHttpUrl(item.sourceUrl) ? item.sourceUrl : finalPublicUrl;

            const record: ThumbnailItem = {
              id: assignedId,
              kind: isPoster ? 'poster' : 'thumbnail',
              title: item.title || (isPoster ? 'Movie Poster' : 'Thumbnail'),
              creator: item.creator || (isPoster ? 'Cinema' : 'YouTube Creator'),
              imageUrl: finalPublicUrl,
              sourceUrl: safeSource,
              niche: isPoster ? 'Cinema' : (item.niche || ''),
              styles: (item.styles && item.styles.length > 0 ? item.styles : ['Face Close-up', 'High-Contrast Glow']) as ThumbnailItem['styles'],
              tags: item.tags && item.tags.length > 0 ? item.tags : (isPoster ? ['Movie Poster', 'Cinema'] : (item.niche ? [item.niche] : [])),
              colors,
              thumbSmallUrl: thumbSmallUrl || undefined,
              width: dimensions?.width,
              height: dimensions?.height,
              viewsEstimate: viewsValue,
              breakdownNotes: notes,
              source: 'r2-storage',
              createdAt: new Date().toISOString()
            };

            const cleanRecord = Object.fromEntries(
              Object.entries(record).filter(([, value]) => value !== undefined)
            ) as ThumbnailItem;

            itemsToPersist.push(cleanRecord);

            uploadedResults.push({
              id: assignedId,
              originalId: item.id,
              kind: isPoster ? 'poster' : 'thumbnail',
              videoId: item.videoId,
              title: record.title,
              creator: record.creator,
              sourceUrl: record.sourceUrl,
              niche: record.niche,
              tags: record.tags,
              views: viewsValue,
              publishedTime: item.publishedTime,
              source: 'r2-storage',
              uploadedToBucket: uploadSuccess,
              imageUrl: finalPublicUrl,
              thumbSmallUrl,
              colors,
              colorFamilies,
              width: dimensions?.width,
              height: dimensions?.height,
              dbSaved: true
            });
          } catch (itemErr) {
            warnings.push(`Rejected "${item.title || 'item'}": ${itemErr instanceof Error ? itemErr.message : 'invalid image'}`);
          }
        })
      );
    }

    if (itemsToPersist.length > 0) {
      const persisted = await saveGalleryItems(itemsToPersist);
      if (!persisted) {
        // Compensating rollback of orphaned R2 objects on catalog write failure
        await Promise.all(uploadedR2Keys.map((k) => deleteFromR2(k).catch(() => false)));
        logSecurityEvent('upload_catalog_rollback', {
          uid: authResult.user.uid,
          rolledBackKeys: uploadedR2Keys.length,
        });
        return NextResponse.json(
          { error: 'Failed to persist catalog metadata. Uploaded objects were rolled back.' },
          { status: 500 }
        );
      }
    }

    invalidateGalleryCache();

    logSecurityEvent('thumbnails_uploaded', {
      uid: authResult.user.uid,
      count: itemsToPersist.length,
      warningsCount: warnings.length,
      ip,
    });

    return NextResponse.json({
      success: itemsToPersist.length > 0,
      bucket: r2Ready ? r2Config.bucketName : 'local-storage',
      storageProvider: r2Ready ? 'cloudflare-r2' : 'server-storage',
      count: uploadedResults.length,
      allDbSaved: itemsToPersist.length > 0,
      warnings: warnings.length > 0 ? warnings : undefined,
      items: uploadedResults
    });
  } catch (err: unknown) {
    return safeErrorResponse(err, 'Failed to process thumbnail upload');
  }
}
