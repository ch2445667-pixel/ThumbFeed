/**
 * One-time backfill: generate a 400px WebP variant for every image already in
 * the Supabase bucket and record its URL on the row.
 *
 *   node scripts/backfill-small-variants.mjs
 *
 * Safe to re-run. Objects that already exist in `small/` are skipped, so an
 * interrupted run resumes where it stopped. NOTHING in the original bucket is
 * deleted or modified -- this only adds `small/...` objects and writes the new
 * `thumb_small_url` column.
 *
 * Requires the migration in supabase/migrations/001-add-thumb-small-url.sql
 * to have been run first (adds `thumb_small_url`).
 */

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const sharp = require('sharp');

// fileURLToPath, not URL.pathname: the latter leaves %20 in place for
// directories with spaces, which breaks .env discovery on this machine.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

function readEnv(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

const ENV = { ...readEnv(path.join(ROOT, '.env')), ...process.env };

const SUPABASE_URL = ENV.NEXT_PUBLIC_SUPABASE_URL || 'https://xahchsuffmskbgvnxcgs.supabase.co';
const ANON_KEY = ENV.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_QprT-ekIg6xv77IwL9p81g_GR5-tdiy';
const SERVICE_KEY = ENV.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = 'Thumbnails';

if (!SERVICE_KEY) {
  console.error('SUPABASE_SERVICE_ROLE_KEY is required in .env (writes thumb_small_url).');
  process.exit(1);
}

const HEADERS_AUTH = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
};
const HEADERS_JSON = { ...HEADERS_AUTH, 'Content-Type': 'application/json' };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SMALL_WIDTH = 400;
const SMALL_QUALITY = 75;
const CACHE_CONTROL = '31536000';

/** Recursively list every object under a prefix. */
async function listAll(prefix, acc = []) {
  let cursor;
  for (;;) {
    const body = { prefix, limit: 1000 };
    if (cursor) body.cursor = cursor;
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/list/${BUCKET}`, {
      method: 'POST',
      headers: HEADERS_JSON,
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`list ${prefix}: ${res.status} ${await res.text()}`);
    const entries = await res.json();
    if (!Array.isArray(entries) || entries.length === 0) break;

    for (const e of entries) {
      // Folder placeholders have a null id.
      if (e.id === null) {
        await listAll(prefix ? `${prefix}/${e.name}` : e.name, acc);
      } else {
        acc.push({ ...e, path: prefix ? `${prefix}/${e.name}` : e.name });
      }
    }
    if (entries.length < 1000) break;
    cursor = entries[entries.length - 1].id;
  }
  return acc;
}

async function download(objectPath) {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${objectPath}`);
  if (!res.ok) throw new Error(`download ${objectPath}: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function upload(objectPath, buffer, contentType) {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${objectPath}`, {
    method: 'POST',
    headers: {
      ...HEADERS_AUTH,
      'Content-Type': contentType,
      'x-upsert': 'true',
      'Cache-Control': CACHE_CONTROL,
    },
    body: buffer,
  });
  if (!res.ok) throw new Error(`upload ${objectPath}: ${res.status} ${await res.text()}`);
}

function publicUrl(objectPath) {
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${objectPath.split('/').map(encodeURIComponent).join('/')}`;
}

async function exists(objectPath) {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${objectPath}`, {
    method: 'HEAD',
  });
  return res.status === 200;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const onlyIds = process.argv.includes('--ids')
    ? new Set(process.argv[process.argv.indexOf('--ids') + 1]?.split(',').map((s) => s.trim()).filter(Boolean) || [])
    : null;
  const dryRun = process.argv.includes('--dry-run');

  console.log(`Supabase project : ${SUPABASE_URL}`);
  console.log(`Bucket           : ${BUCKET}`);
  console.log(`Mode             : ${dryRun ? 'DRY RUN (no writes)' : 'live'}`);
  if (onlyIds) console.log(`Restricted to ids: ${[...onlyIds].join(', ')}`);
  console.log('');

  // 1. Which rows still need a small variant?
  const rowsRes = await fetch(`${SUPABASE_URL}/rest/v1/thumbnails?select=id,image_url,thumb_small_url&limit=10000`, {
    headers: { ...HEADERS_AUTH, Prefer: 'count=exact', Range: '0-9999' },
  });
  if (!rowsRes.ok) {
    console.error('Could not read thumbnails table.');
    console.error('If this says thumb_small_url does not exist, run the migration first:');
    console.error('  supabase/migrations/001-add-thumb-small-url.sql');
    process.exit(1);
  }
  const rows = await rowsRes.json();

  const needsWork = rows.filter((r) => r.image_url && !r.thumb_small_url);
  const alreadyDone = rows.filter((r) => r.image_url && r.thumb_small_url);

  console.log(`rows total          : ${rows.length}`);
  console.log(`already have small  : ${alreadyDone.length}`);
  console.log(`need small variant  : ${needsWork.length}`);
  console.log('');

  if (needsWork.length === 0) {
    console.log('Nothing to do. Every row already has a small variant.');
    return;
  }

  // 2. Download, resize, upload, record.
  let uploaded = 0;
  let skipped = 0;
  const failures = [];
  let srcBytes = 0;
  let smallBytes = 0;

  for (let i = 0; i < needsWork.length; i += 1) {
    const row = needsWork[i];
    const label = `[${i + 1}/${needsWork.length}] ${row.id}`;

    if (onlyIds && !onlyIds.has(row.id)) {
      skipped += 1;
      continue;
    }

    try {
      // Derive the bucket-relative object path from the public URL. The public
      // URL repeats the bucket name after /object/public/, so it has to come
      // off too -- otherwise the path becomes Thumbnails/posters/... and the
      // objects land under a stray nested folder.
      const marker = '/storage/v1/object/public/';
      const idx = row.image_url.indexOf(marker);
      if (idx < 0) throw new Error('image_url is not a Supabase storage URL');
      let objectPath = decodeURIComponent(row.image_url.slice(idx + marker.length).split('?')[0]);
      if (objectPath.startsWith(`${BUCKET}/`)) {
        objectPath = objectPath.slice(BUCKET.length + 1);
      }

      const smallPath = `small/${objectPath.replace(/\.[^/.]+$/, '')}.webp`;

      // Resumable: an existing small object means this row is done.
      if (await exists(smallPath)) {
        await patchRow(row.id, { thumb_small_url: publicUrl(smallPath) });
        skipped += 1;
        continue;
      }

      if (dryRun) {
        console.log(`${label} -> would write ${smallPath}`);
        continue;
      }

      const original = await download(objectPath);
      srcBytes += original.length;

      const small = await sharp(original)
        .resize({ width: SMALL_WIDTH, withoutEnlargement: true })
        .webp({ quality: SMALL_QUALITY })
        .toBuffer();
      smallBytes += small.length;

      await upload(smallPath, small, 'image/webp');
      await patchRow(row.id, { thumb_small_url: publicUrl(smallPath) });

      uploaded += 1;
      const pct = original.length > 0 ? Math.round((small.length / original.length) * 100) : 0;
      if (uploaded % 25 === 0 || i === needsWork.length - 1) {
        console.log(`${label} ok (${(original.length / 1024).toFixed(0)}KB -> ${(small.length / 1024).toFixed(1)}KB, ${pct}%)`);
      }
    } catch (err) {
      failures.push({ id: row.id, error: err.message });
      console.error(`${label} FAILED: ${err.message}`);
    }
  }

  console.log('');
  console.log('=== DONE ===');
  console.log(`written : ${uploaded}`);
  console.log(`skipped : ${skipped} (already had a small variant)`);
  console.log(`failed  : ${failures.length}`);
  if (srcBytes > 0) {
    console.log(`original total : ${(srcBytes / 1048576).toFixed(1)} MB`);
    console.log(`small total    : ${(smallBytes / 1048576).toFixed(1)} MB`);
    console.log(`reduction      : ${(100 - (smallBytes / srcBytes) * 100).toFixed(1)}%`);
  }
  if (failures.length > 0) {
    console.log('\nfailures (re-run to retry these):');
    for (const f of failures) console.log(`  ${f.id}: ${f.error}`);
  }
}

async function patchRow(id, patch) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/thumbnails?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: HEADERS_JSON,
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`patch ${id}: ${res.status} ${await res.text()}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});