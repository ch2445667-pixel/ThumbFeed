/**
 * Accurate per-creator counts for imported thumbnails. PostgREST caps a single
 * response at 1000 rows, so this pages with Range headers.
 *
 *   node scripts/count-creators.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
const URL_BASE = ENV.NEXT_PUBLIC_SUPABASE_URL || 'https://xahchsuffmskbgvnxcgs.supabase.co';
const KEY = ENV.SUPABASE_SERVICE_ROLE_KEY;
const HEADERS = { apikey: KEY, Authorization: `Bearer ${KEY}` };

async function fetchAll(query) {
  const rows = [];
  const page = 1000;
  for (let from = 0; ; from += page) {
    const res = await fetch(
      `${URL_BASE}/rest/v1/thumbnails?${query}&select=id,creator&order=id&limit=${page}&offset=${from}`,
      { headers: HEADERS }
    );
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    const batch = await res.json();
    rows.push(...batch);
    if (batch.length < page) break;
  }
  return rows;
}

const rows = await fetchAll('source=eq.supabase-storage');
const byCreator = new Map();
for (const r of rows) {
  const key = r.creator || '(none)';
  byCreator.set(key, (byCreator.get(key) || 0) + 1);
}

const sorted = [...byCreator.entries()].sort((a, b) => b[1] - a[1]);
console.log(`total imported thumbnails: ${rows.length}`);
console.log(`distinct creators        : ${sorted.length}`);
console.log('');
for (const [name, count] of sorted) console.log(`${String(count).padStart(5)}  ${name}`);