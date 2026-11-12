import { S3Client, PutObjectCommand, DeleteObjectCommand, HeadBucketCommand, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const R2_CONFIG_FILE = path.join(DATA_DIR, 'r2-config.json');

export const R2_APP_DATA = {
  THUMBNAILS: '_app_data/thumbnails.json',
  BOARDS: '_app_data/boards.json',
  CATEGORIES: '_app_data/categories.json',
  PROFILE: '_app_data/user-profile.json',
};

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  publicUrlBase: string;
  isConfigured: boolean;
}

function loadSavedFileConfig(): Partial<R2Config> {
  try {
    if (fs.existsSync(R2_CONFIG_FILE)) {
      const raw = fs.readFileSync(R2_CONFIG_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (err) {
    // Ignore read errors
  }
  return {};
}

export function saveR2Config(newConfig: {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  publicUrlBase?: string;
}): boolean {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const dataToSave = {
      accountId: (newConfig.accountId || '').trim(),
      accessKeyId: (newConfig.accessKeyId || '').trim(),
      secretAccessKey: (newConfig.secretAccessKey || '').trim(),
      bucketName: (newConfig.bucketName || '').trim(),
      publicUrlBase: (newConfig.publicUrlBase || '').trim().replace(/\/+$/, ''),
    };
    fs.writeFileSync(R2_CONFIG_FILE, JSON.stringify(dataToSave, null, 2), 'utf-8');

    // Also update runtime process.env
    process.env.R2_ACCOUNT_ID = dataToSave.accountId;
    process.env.R2_ACCESS_KEY_ID = dataToSave.accessKeyId;
    process.env.R2_SECRET_ACCESS_KEY = dataToSave.secretAccessKey;
    process.env.R2_BUCKET_NAME = dataToSave.bucketName;
    process.env.R2_PUBLIC_URL = dataToSave.publicUrlBase;

    // Reset client instance
    s3ClientInstance = null;
    lastClientKey = '';

    return true;
  } catch (err) {
    console.error('Failed to save R2 config to data/r2-config.json:', err);
    return false;
  }
}

export function getR2Config(): R2Config {
  const fileConfig = loadSavedFileConfig();

  const accountId = process.env.R2_ACCOUNT_ID || fileConfig.accountId || '';
  const accessKeyId = process.env.R2_ACCESS_KEY_ID || fileConfig.accessKeyId || '';
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || fileConfig.secretAccessKey || '';
  const bucketName = process.env.R2_BUCKET_NAME || fileConfig.bucketName || '';
  const publicUrlBase = (process.env.R2_PUBLIC_URL || fileConfig.publicUrlBase || '').replace(/\/+$/, '');

  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucketName,
    publicUrlBase,
    isConfigured: Boolean(accountId && accessKeyId && secretAccessKey && bucketName),
  };
}

export function isR2Configured(): boolean {
  return getR2Config().isConfigured;
}

let s3ClientInstance: S3Client | null = null;
let lastClientKey: string = '';

export function getR2Client(): S3Client {
  const config = getR2Config();
  if (!config.isConfigured) {
    throw new Error(
      'Cloudflare R2 storage is not configured. Missing R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, or R2_BUCKET_NAME in environment.'
    );
  }

  const clientKey = `${config.accountId}:${config.accessKeyId}`;
  if (!s3ClientInstance || lastClientKey !== clientKey) {
    s3ClientInstance = new S3Client({
      region: 'auto',
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
    lastClientKey = clientKey;
  }
  return s3ClientInstance;
}

export function getR2PublicUrl(key: string): string {
  const sanitizedKey = key.replace(/^\/+/, '');
  const config = getR2Config();

  // If a custom public domain or pub-*.r2.dev domain is provided (not the private S3 API endpoint)
  if (config.publicUrlBase && !config.publicUrlBase.includes('r2.cloudflarestorage.com')) {
    return `${config.publicUrlBase}/${sanitizedKey}`;
  }

  // If public bucket access is not enabled or no custom domain is set,
  // stream seamlessly through the internal Next.js media route so images load without authentication errors
  return `/api/media/${sanitizedKey}`;
}

export async function uploadToR2(params: {
  key: string;
  buffer: Buffer;
  contentType: string;
  cacheControl?: string;
}): Promise<{ key: string; publicUrl: string }> {
  const config = getR2Config();
  const client = getR2Client();
  const sanitizedKey = params.key.replace(/^\/+/, '');

  await client.send(
    new PutObjectCommand({
      Bucket: config.bucketName,
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
  const config = getR2Config();
  const client = getR2Client();
  const sanitizedKey = key.replace(/^\/+/, '');

  await client.send(
    new DeleteObjectCommand({
      Bucket: config.bucketName,
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

  const config = getR2Config();

  // 1. If publicUrlBase is configured and URL starts with it
  if (config.publicUrlBase && url.startsWith(config.publicUrlBase)) {
    const afterBase = url.slice(config.publicUrlBase.length).replace(/^\/+/, '');
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

  // 4. If it's direct cloudflarestorage endpoint with bucket
  const cloudflareStorageMatch = url.match(
    /^https?:\/\/[^\/]+\.r2\.cloudflarestorage\.com\/[^\/]+\/(.+)$/
  );
  if (cloudflareStorageMatch) {
    return decodeURIComponent(cloudflareStorageMatch[1].split('?')[0]);
  }

  // 5. If it's a relative path starting with thumbnails/, posters/, or small/
  if (url.startsWith('posters/') || url.startsWith('small/') || url.startsWith('thumbnails/')) {
    return decodeURIComponent(url.split('?')[0]);
  }

  // 6. If it's a sanitized filename like thumb_*.jpg or poster_*.jpg
  if (url.startsWith('thumb_') || url.startsWith('poster_') || url.includes('/thumb_') || url.includes('/poster_')) {
    const lastPart = url.split('/').pop()?.split('?')[0];
    if (lastPart) return decodeURIComponent(lastPart);
  }

  return null;
}

export async function testR2Connection(customConfig?: {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
}): Promise<{ ok: boolean; message?: string }> {
  const config = customConfig
    ? {
        ...customConfig,
        publicUrlBase: '',
        isConfigured: Boolean(
          customConfig.accountId &&
          customConfig.accessKeyId &&
          customConfig.secretAccessKey &&
          customConfig.bucketName
        )
      }
    : getR2Config();

  if (!config.isConfigured) {
    return { ok: false, message: 'Cloudflare R2 credentials are incomplete.' };
  }

  try {
    const client = new S3Client({
      region: 'auto',
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });

    // Test bucket access
    await client.send(new HeadBucketCommand({ Bucket: config.bucketName }));
    return { ok: true, message: `Successfully connected to Cloudflare R2 bucket "${config.bucketName}".` };
  } catch (err: any) {
    const code = err?.name || err?.Code || '';
    const msg = err?.message || String(err);
    if (code === 'NotFound' || msg.includes('404')) {
      return { ok: false, message: `Bucket "${config.bucketName}" was not found in this Cloudflare account.` };
    }
    if (code === 'InvalidAccessKeyId' || msg.includes('403') || msg.includes('AccessDenied')) {
      return { ok: false, message: 'Authentication failed: check your Access Key ID and Secret Access Key.' };
    }
    return { ok: false, message: msg };
  }
}

/**
 * Download and parse a JSON document directly from the Cloudflare R2 bucket.
 */
export async function downloadJsonFromR2<T = any>(key: string): Promise<T | null> {
  const config = getR2Config();
  if (!config.isConfigured) return null;

  try {
    const client = getR2Client();
    const sanitizedKey = key.replace(/^\/+/, '');
    const res = await client.send(
      new GetObjectCommand({
        Bucket: config.bucketName,
        Key: sanitizedKey,
      })
    );
    if (!res.Body) return null;
    const bodyStr = await res.Body.transformToString();
    return JSON.parse(bodyStr) as T;
  } catch (err: any) {
    const code = err?.name || err?.Code || '';
    if (code === 'NoSuchKey' || err?.$metadata?.httpStatusCode === 404) {
      return null;
    }
    console.warn(`Could not read ${key} from Cloudflare R2:`, err?.message || err);
    return null;
  }
}

/**
 * Upload a JSON document directly into the Cloudflare R2 bucket.
 */
export async function uploadJsonToR2(key: string, data: any): Promise<boolean> {
  const config = getR2Config();
  if (!config.isConfigured) return false;

  try {
    const client = getR2Client();
    const sanitizedKey = key.replace(/^\/+/, '');
    const jsonStr = JSON.stringify(data, null, 2);
    await client.send(
      new PutObjectCommand({
        Bucket: config.bucketName,
        Key: sanitizedKey,
        Body: Buffer.from(jsonStr, 'utf-8'),
        ContentType: 'application/json',
        CacheControl: 'no-cache, no-store, must-revalidate',
      })
    );
    return true;
  } catch (err) {
    console.error(`Failed to upload ${key} to Cloudflare R2:`, err);
    return false;
  }
}

/**
 * List all image files stored in the Cloudflare R2 bucket.
 */
export async function listR2ImageFiles(): Promise<{ key: string; size: number; lastModified?: Date }[]> {
  const config = getR2Config();
  if (!config.isConfigured) return [];

  try {
    const client = getR2Client();
    const results: { key: string; size: number; lastModified?: Date }[] = [];
    let continuationToken: string | undefined;

    do {
      const res = await client.send(
        new ListObjectsV2Command({
          Bucket: config.bucketName,
          ContinuationToken: continuationToken,
          MaxKeys: 1000,
        })
      );

      if (res.Contents) {
        for (const obj of res.Contents) {
          if (!obj.Key) continue;
          const lower = obj.Key.toLowerCase();
          // Exclude internal _app_data metadata files
          if (lower.startsWith('_app_data/')) continue;
          if (
            lower.endsWith('.jpg') ||
            lower.endsWith('.jpeg') ||
            lower.endsWith('.png') ||
            lower.endsWith('.webp') ||
            lower.endsWith('.gif')
          ) {
            results.push({
              key: obj.Key,
              size: obj.Size || 0,
              lastModified: obj.LastModified,
            });
          }
        }
      }
      continuationToken = res.NextContinuationToken;
    } while (continuationToken);

    return results;
  } catch (err) {
    console.warn('Failed to list objects in Cloudflare R2:', err);
    return [];
  }
}

