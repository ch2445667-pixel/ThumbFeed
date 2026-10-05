/**
 * Re-tag every imported thumbnail with the improved tagger.
 *
 *   node scripts/retag-existing.mjs --dry-run
 *   node scripts/retag-existing.mjs
 *
 * Only writes niche, tags, styles, emotion and breakdown_notes. Images,
 * URLs, dimensions and colours are never touched. Batched PATCH updates.
 * Safe to re-run.
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
const HEADERS_AUTH = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` };
const HEADERS_JSON = { ...HEADERS_AUTH, 'Content-Type': 'application/json' };

if (!SERVICE_KEY) {
  console.error('SUPABASE_SERVICE_ROLE_KEY is required in .env');
  process.exit(1);
}

const dryRun = process.argv.includes('--dry-run');
const only = process.argv.includes('--only')
  ? process.argv[process.argv.indexOf('--only') + 1]
  : null;

async function fetchAll(query) {
  const rows = [];
  const page = 1000;
  for (let from = 0; ; from += page) {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/thumbnails?${query}&select=id,title,creator,niche,tags,styles,emotion,breakdown_notes&order=id&limit=${page}&offset=${from}`,
      { headers: HEADERS_AUTH }
    );
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    const batch = await res.json();
    rows.push(...batch);
    if (batch.length < page) break;
  }
  return rows;
}

/**
 * breakdown_notes carries the recorded dimensions as a trailing "| WxH" so the
 * masonry grid can reserve the exact box. Rewriting the note would throw that
 * away and make every tile reflow on load, so it is preserved verbatim.
 */
function preserveDimensions(existing, newNote) {
  const m = /\|\s*(\d+)x(\d+)\s*$/.exec(String(existing || ''));
  return m ? `${newNote} | ${m[1]}x${m[2]}` : newNote;
}

const rows = await fetchAll('source=eq.supabase-storage');
const target = only ? rows.filter((r) => r.creator === only) : rows;

console.log(`mode          : ${dryRun ? 'DRY RUN' : 'live'}`);
console.log(`rows to retag : ${target.length}${only ? ` (creator = ${only})` : ''}`);
console.log('');

const stats = { changed: 0, same: 0 };
const nicheBefore = new Map();
const nicheAfter = new Map();
const styleBefore = new Map();
const styleAfter = new Map();

const bump = (map, key) => map.set(key, (map.get(key) || 0) + 1);
const eqArr = (a, b) => JSON.stringify(a || []) === JSON.stringify(b || []);

for (const row of target) {
  const result = analyzeAndTagTitle(row.title, row.creator || '', 'Educational');

  for (const n of row.niche ? [row.niche] : []) bump(nicheBefore, n);
  bump(nicheAfter, result.niche);
  for (const s of row.styles || []) bump(styleBefore, s);
  for (const s of result.styles) bump(styleAfter, s);

  const unchanged =
    row.niche === result.niche &&
    eqArr(row.tags, result.tags) &&
    eqArr(row.styles, result.styles) &&
    row.emotion === result.emotion;
  if (unchanged) {
    stats.same += 1;
    continue;
  }
  stats.changed += 1;

  if (!dryRun) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/thumbnails?id=eq.${encodeURIComponent(row.id)}`, {
      method: 'PATCH',
      headers: HEADERS_JSON,
      body: JSON.stringify({
        niche: result.niche,
        tags: result.tags,
        styles: result.styles,
        emotion: result.emotion,
        breakdown_notes: preserveDimensions(row.breakdown_notes, result.breakdownNotes),
      }),
    });
    if (!res.ok) {
      console.error(`FAILED ${row.id}: ${res.status} ${await res.text()}`);
    }
  }
}

console.log(`unchanged : ${stats.same}`);
console.log(`rewritten : ${stats.changed}`);
console.log('');
console.log('NICHE  before -> after');
const niches = [...new Set([...nicheBefore.keys(), ...nicheAfter.keys()])].sort(
  (a, b) => (nicheAfter.get(b) || 0) - (nicheAfter.get(a) || 0)
);
for (const n of niches) {
  console.log(`  ${String(nicheBefore.get(n) || 0).padStart(5)} -> ${String(nicheAfter.get(n) || 0).padStart(5)}  ${n}`);
}
console.log('');
console.log('STYLE  before -> after');
const styles = [...new Set([...styleBefore.keys(), ...styleAfter.keys()])].sort();
for (const s of styles) {
  console.log(`  ${String(styleBefore.get(s) || 0).padStart(5)} -> ${String(styleAfter.get(s) || 0).padStart(5)}  ${s}`);
}