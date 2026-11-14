import { NextRequest, NextResponse } from 'next/server';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getR2Client, isR2Configured, getR2Config } from '../../../../lib/r2';
import { sanitizeMediaKey } from '../../../../lib/urlSafety';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { key: string[] } }
) {
  if (!isR2Configured()) {
    return new NextResponse('Cloudflare R2 is not configured.', { status: 503 });
  }

  const keySegments = params.key;
  const rawKeyPath = Array.isArray(keySegments) ? keySegments.join('/') : keySegments;
  const keyPath = sanitizeMediaKey(rawKeyPath);
  if (!keyPath) {
    return new NextResponse('Invalid or forbidden media key', { status: 403 });
  }

  try {
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

    const webStream = typeof (obj.Body as any).transformToWebStream === 'function'
      ? (obj.Body as any).transformToWebStream()
      : (obj.Body as any);

    const headers = new Headers();
    const contentType = obj.ContentType && obj.ContentType.startsWith('image/')
      ? obj.ContentType
      : 'application/octet-stream';
    headers.set('Content-Type', contentType);
    if (obj.ContentLength) headers.set('Content-Length', String(obj.ContentLength));
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');

    return new NextResponse(webStream, {
      status: 200,
      headers,
    });
  } catch (err: any) {
    if (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) {
      return new NextResponse('Image not found in Cloudflare R2', { status: 404 });
    }
    console.error('Error fetching object from Cloudflare R2:', err);
    return new NextResponse('Failed to retrieve image from Cloudflare R2', { status: 500 });
  }
}
