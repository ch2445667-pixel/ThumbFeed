import { S3Client, PutObjectCommand, DeleteObjectCommand, HeadBucketCommand } from '@aws-sdk/client-s3';

const accountId = process.env.R2_ACCOUNT_ID || '';
const accessKeyId = process.env.R2_ACCESS_KEY_ID || '';
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || '';
const bucketName = process.env.R2_BUCKET_NAME || '';
const publicUrlBase = (process.env.R2_PUBLIC_URL || '').replace(/\/+$/, '');

export function isR2Configured(): boolean {
  return Boolean(accountId && accessKeyId && secretAccessKey && bucketName);
}

let s3ClientInstance: S3Client | null = null;

export function getR2Client(): S3Client {
  if (!s3ClientInstance) {
    if (!isR2Configured()) {
      throw new Error(
        'Cloudflare R2 is not fully configured. Missing R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, or R2_BUCKET_NAME in environment.'
      );
    }
    s3ClientInstance = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }
  return s3ClientInstance;
}

export function getR2PublicUrl(key: string): string {
  const sanitizedKey = key.replace(/^\/+/, '');
  // If a public domain or r2.dev domain is provided (not the private S3 API endpoint)
  if (publicUrlBase && !publicUrlBase.includes('r2.cloudflarestorage.com')) {
    return `${publicUrlBase}/${sanitizedKey}`;
  }
  // If public access isn't enabled yet or only S3 API endpoint was given,
  // stream through the internal media route so images load without authentication errors
  return `/api/media/${sanitizedKey}`;
}

export async function uploadToR2(params: {
  key: string;
  buffer: Buffer;
  contentType: string;
  cacheControl?: string;
}): Promise<{ key: string; publicUrl: string }> {
  const client = getR2Client();
  const sanitizedKey = params.key.replace(/^\/+/, '');

  await client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: sanitizedKey,
      Body: params.buffer,
      ContentType: params.contentType,
      CacheControl: params.cacheControl || 'public, max-age=31536000, immutable',
    })
  );

  return {
    key: sanitizedKey,
    publicUrl: getR2PublicUrl(sanitizedKey),
  };
}

export async function deleteFromR2(key: string): Promise<boolean> {
  const client = getR2Client();
  const sanitizedKey = key.replace(/^\/+/, '');

  await client.send(
    new DeleteObjectCommand({
      Bucket: bucketName,
      Key: sanitizedKey,
    })
  );

  return true;
}

/**
 * Extract the R2 object key from a full image URL or path.
 */
export function extractR2KeyFromUrl(url: string): string | null {
  if (!url || typeof url !== 'string') return null;

  // 1. If publicUrlBase is configured and URL starts with it
  if (publicUrlBase && url.startsWith(publicUrlBase)) {
    const afterBase = url.slice(publicUrlBase.length).replace(/^\/+/, '');
    return decodeURIComponent(afterBase.split('?')[0]);
  }

  // 2. If it's the internal streaming route /api/media/...
  const apiMediaMatch = url.match(/\/api\/media\/(.+)$/);
  if (apiMediaMatch) {
    return decodeURIComponent(apiMediaMatch[1].split('?')[0]);
  }

  // 3. If it's a pub-*.r2.dev URL
  const r2DevMatch = url.match(/^https?:\/\/[^\/]+\.r2\.dev\/(.+)$/);
  if (r2DevMatch) {
    return decodeURIComponent(r2DevMatch[1].split('?')[0]);
  }

  // 3. If it's direct cloudflarestorage endpoint with bucket
  const cloudflareStorageMatch = url.match(
    /^https?:\/\/[^\/]+\.r2\.cloudflarestorage\.com\/[^\/]+\/(.+)$/
  );
  if (cloudflareStorageMatch) {
    return decodeURIComponent(cloudflareStorageMatch[1].split('?')[0]);
  }

  // 4. If it's a relative path starting with thumbnails/ or posters/ or small/
  if (url.startsWith('posters/') || url.startsWith('small/') || url.startsWith('thumbnails/')) {
    return decodeURIComponent(url.split('?')[0]);
  }

  return null;
}

export async function testR2Connection(): Promise<{ ok: boolean; message?: string }> {
  if (!isR2Configured()) {
    return { ok: false, message: 'Cloudflare R2 environment variables are not set.' };
  }
  try {
    const client = getR2Client();
    await client.send(new HeadBucketCommand({ Bucket: bucketName }));
    return { ok: true, message: `Successfully connected to R2 bucket "${bucketName}".` };
  } catch (err: any) {
    return { ok: false, message: err?.message || String(err) };
  }
}

