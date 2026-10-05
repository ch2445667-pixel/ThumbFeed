/**
 * Compare what the batch importer was asked for against what is actually in
 * Supabase. Prints per-channel gaps and the missing total.
 *
 *   node scripts/import-gaps.mjs
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

// Same channel list as run_batch_import.js
const CHANNELS = [
  { name: 'Damon Cassidy', count: 100 },
  { name: 'Kallaway', count: 93 },
  { name: 'Ryan Trahan', count: 61 },
  { name: 'MrBeast', count: 60 },
  { name: 'Veritasium', count: 60 },
  { name: 'Ali Abdaal', count: 60 },
  { name: 'Johnny Harris', count: 60 },
  { name: 'Mrwhosetheboss', count: 60 },
  { name: 'Mark Tilbury', count: 60 },
  { name: 'Marques Brownlee', count: 59 },
  { name: 'HimanshuG', count: 55 },
  { name: 'Vijay Thakkar', count: 50 },
  { name: 'Tyler Stalman', count: 50 },
  { name: 'Search Party (Sam Ellis)', count: 50 },
  { name: 'GEN', count: 50 },
  { name: 'finzar', count: 50 },
  { name: 'Zane Hoyer', count: 50 },
  { name: 'The Diary Of A CEO', count: 50 },
  { name: 'Raj Shamani', count: 50 },
  { name: 'Fraser Cottrell', count: 50 },
  { name: 'Bloomberg Originals', count: 50 },
  { name: 'Design Theory', count: 50 },
  { name: 'Colin and Samir', count: 50 },
  { name: 'The Science of Products', count: 50 },
  { name: 'Wes McDowell', count: 50 },
  { name: 'Chase Chappell', count: 50 },
  { name: 'Serrahx', count: 50 },
  { name: 'PiXimperfect', count: 50 },
  { name: 'David Heacock', count: 50 },
  { name: 'orenmeetsworld', count: 49 },
  { name: 'Brimm.', count: 45 },
  { name: "xkcd's What If?", count: 44 },
  { name: 'Badis Designs', count: 35 },
  { name: 'Wampus', count: 30 },
  { name: 'Open Residency', count: 30 },
  { name: 'Jay Clouse', count: 30 },
  { name: 'Sweat Equity', count: 30 },
  { name: 'Found And Explained', count: 30 },
  { name: 'Jon Youshaei', count: 30 },
  { name: 'Tim Gabe', count: 30 },
  { name: 'fern', count: 29 },
  { name: 'Tim Runia', count: 26 },
  { name: 'Christophe', count: 21 },
  { name: 'Max Fisher', count: 17 },
  { name: 'Dill Toma', count: 13 },
  { name: 'Noah Haynes', count: 12 },
  { name: 'Barney Watts', count: 8 },
  { name: 'Thought Out', count: 1 },
  { name: 'Solar Sands', count: 1 },
  { name: 'Pranjal Joshi', count: 1 },
  { name: 'HTX Studio', count: 1 },
];

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
for (const r of rows) byCreator.set(r.creator, (byCreator.get(r.creator) || 0) + 1);

let targetTotal = 0;
let gapTotal = 0;
const gaps = [];
const extra = [];

for (const c of CHANNELS) {
  targetTotal += c.count;
  const have = byCreator.get(c.name) || 0;
  const gap = c.count - have;
  if (gap > 0) {
    gapTotal += gap;
    gaps.push({ name: c.name, have, target: c.count, gap });
  }
}

for (const [name, count] of byCreator) {
  if (!CHANNELS.some((c) => c.name === name)) extra.push({ name, count });
}

console.log(`target total   : ${targetTotal}`);
console.log(`in database    : ${rows.length}`);
console.log(`still to import: ${gapTotal}`);
console.log('');
console.log('CHANNELS WITH A GAP');
for (const g of gaps) console.log(`  ${String(g.have).padStart(4)} / ${String(g.target).padStart(3)}  ${g.name}  (+${g.gap})`);
if (extra.length) {
  console.log('');
  console.log('CREATORS IN DB NOT ON THE LIST');
  for (const e of extra) console.log(`  ${String(e.count).padStart(4)}  ${e.name}`);
}