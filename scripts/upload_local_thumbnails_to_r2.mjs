import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs';
import path from 'path';

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;
const R2_PUBLIC_URL = (process.env.R2_PUBLIC_URL || '').replace(/\/+$/, '');

if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) {
  console.error('Missing required Cloudflare R2 environment variables: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME');
  process.exit(1);
}

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

function getPublicUrl(key) {
  if (R2_PUBLIC_URL && !R2_PUBLIC_URL.includes('r2.cloudflarestorage.com')) {
    return `${R2_PUBLIC_URL}/${key}`;
  }
  return `/api/media/${key}`;
}

async function uploadLocalFolder(folderPath) {
  if (!fs.existsSync(folderPath)) {
    console.error(`Folder "${folderPath}" not found.`);
    return;
  }

  const files = fs.readdirSync(folderPath).filter(f => /\.(jpe?g|png|webp|avif)$/i.test(f));
  console.log(`Found ${files.length} images to upload to Cloudflare R2 bucket "${R2_BUCKET_NAME}"...`);

  let count = 0;
  for (const file of files) {
    const fullPath = path.join(folderPath, file);
    const buffer = fs.readFileSync(fullPath);
    const key = `thumbnails/${Date.now()}_${file.replace(/[^a-zA-Z0-9_\-\.]/g, '_')}`;

    try {
      await s3.send(new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
        Body: buffer,
        ContentType: file.endsWith('.png') ? 'image/png' : (file.endsWith('.webp') ? 'image/webp' : 'image/jpeg'),
        CacheControl: 'public, max-age=31536000, immutable',
      }));

      const publicUrl = getPublicUrl(key);
      count++;
      console.log(`[${count}/${files.length}] Uploaded: ${file} -> ${publicUrl}`);
    } catch (err) {
      console.error(`Error uploading ${file}:`, err.message);
    }
  }

  console.log(`Finished uploading ${count} images to Cloudflare R2!`);
}

const targetFolder = process.argv[2] || './thumbnails';
uploadLocalFolder(targetFolder);
