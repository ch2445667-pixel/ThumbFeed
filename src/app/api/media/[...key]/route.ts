import { NextRequest, NextResponse } from 'next/server';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getR2Client, isR2Configured, getR2Config } from '../../../../lib/r2';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { key: string[] } }
) {
  if (!isR2Configured()) {
    return new NextResponse('Cloudflare R2 is not configured. Please set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET_NAME.', { status: 503 });
  }

  const keySegments = params.key;
  const keyPath = Array.isArray(keySegments) ? keySegments.join('/') : keySegments;
  if (!keyPath) {
    return new NextResponse('Missing object key', { status: 400 });
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
    if (obj.ContentType) headers.set('Content-Type', obj.ContentType);
    if (obj.ContentLength) headers.set('Content-Length', String(obj.ContentLength));
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
