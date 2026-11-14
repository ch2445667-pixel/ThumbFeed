import { NextRequest, NextResponse } from 'next/server';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getR2Client, isR2Configured, getR2Config, extractR2KeyFromUrl } from '../../../../lib/r2';
import { getAllGalleryItems } from '../../../../lib/galleryService';
import { sanitizeMediaKey } from '../../../../lib/urlSafety';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ key: string[] }> }
) {
  if (!isR2Configured()) {
    return new NextResponse('Cloudflare R2 is not configured.', { status: 503 });
  }

  const { key: keySegments } = await params;
  const rawKeyPath = Array.isArray(keySegments) ? keySegments.join('/') : String(keySegments || '');
  const keyPath = sanitizeMediaKey(rawKeyPath);
  if (!keyPath) {
    return new NextResponse('Invalid or forbidden media key', { status: 403 });
  }

  try {
    // Only stream R2 keys that belong to indexed, active gallery items (blocks unindexed/private objects)
    const items = await getAllGalleryItems();
    const allowedKeys = new Set<string>();
    for (const item of items) {
      const k1 = extractR2KeyFromUrl(item.imageUrl);
      if (k1) {
        allowedKeys.add(k1);
        const base = k1.replace(/\.[^/.]+$/, '');
        allowedKeys.add(`small/${base}.webp`);
        allowedKeys.add(`small/${k1}`);
      }
      if (item.thumbSmallUrl) {
        const k2 = extractR2KeyFromUrl(item.thumbSmallUrl);
        if (k2) allowedKeys.add(k2);
      }
    }

    if (!allowedKeys.has(keyPath)) {
      return new NextResponse('Not found', { status: 404 });
    }

    const client = getR2Client();
    const { bucketName } = getR2Config();

    const obj = await client.send(
      new GetObjectCommand({
        Bucket: bucketName,
        Key: keyPath,
      })
    );

    if (!obj.Body) {
      return new NextResponse('Not found', { status: 404 });
    }

    const rawContentType = (obj.ContentType || '').toLowerCase();
    if (!rawContentType.startsWith('image/') || rawContentType.includes('svg')) {
      return new NextResponse('Forbidden media type', { status: 403 });
    }

    const webStream =
      typeof (obj.Body as { transformToWebStream?: () => ReadableStream }).transformToWebStream === 'function'
        ? (obj.Body as { transformToWebStream: () => ReadableStream }).transformToWebStream()
        : (obj.Body as unknown as ReadableStream);

    const headers = new Headers();
    headers.set('Content-Type', rawContentType);
    if (obj.ContentLength) headers.set('Content-Length', String(obj.ContentLength));
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('Content-Security-Policy', "default-src 'none'; sandbox");
    headers.set('Cross-Origin-Resource-Policy', 'same-origin');
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');

    return new NextResponse(webStream, {
      status: 200,
      headers,
    });
  } catch (err: unknown) {
    const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
    if (e?.name === 'NoSuchKey' || e?.$metadata?.httpStatusCode === 404) {
      return new NextResponse('Image not found', { status: 404 });
    }
    console.error('Error fetching object from Cloudflare R2:', err);
    return new NextResponse('Failed to retrieve image', { status: 500 });
  }
}
