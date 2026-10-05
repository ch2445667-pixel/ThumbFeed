/**
 * Prints new tags for a random-ish slice of the corpus so the output can be
 * eyeballed for quality before the live rewrite.
 *
 *   node scripts/sample-tags.js [n] [--creator "Name"]
 */

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { analyzeAndTagTitle } = require('./tagger');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

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
const SERVICE_KEY = ENV.SUPABASE_SERVICE_ROLE_KEY;
const HEADERS = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` };

const n = Number(process.argv[2]) || 30;
const creatorIdx = process.argv.indexOf('--creator');
const creator = creatorIdx > -1 ? process.argv[creatorIdx + 1] : null;

const rows = await (
  await fetch(
    `${SUPABASE_URL}/rest/v1/thumbnails?source=eq.supabase-storage&select=title,creator&order=id&limit=5000`,
    { headers: HEADERS }
  )
).json();

const pool = creator ? rows.filter((r) => r.creator === creator) : rows;
// Even stride so the slice spans the whole id range rather than one channel.
const step = Math.max(1, Math.floor(pool.length / n));
for (let i = 0; i < n; i += 1) {
  const row = pool[Math.min(i * step, pool.length - 1)];
  const r = analyzeAndTagTitle(row.title, row.creator || '', 'Educational');
  console.log(`${row.creator}`);
  console.log(`  ${row.title}`);
  console.log(`  -> ${r.niche} | ${r.emotion} | ${r.styles.join(' + ')}`);
  console.log(`  -> ${r.tags.join(', ')}`);
  console.log('');
}