/**
 * Write the LLM-assigned categories back to Supabase.
 *
 * REPLACES tags and niche outright -- this is the new tagging, not an
 * addition to the old keyword tags.
 *
 *   node scripts/apply_tags.js            # apply everything found
 *   node scripts/apply_tags.js --dry-run  # report only, write nothing
 *
 * Posters are never touched: ids from tags_*.json are thumbnail ids only, and
 * a guard rejects anything that looks like a poster row.
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xahchsuffmskbgvnxcgs.supabase.co';
const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'sb_publishable_QprT-ekIg6xv77IwL9p81g_GR5-tdiy';

const DIR = path.join(__dirname, 'tagging');
const DRY = process.argv.includes('--dry-run');
const BATCH = 200;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

function looksLikePoster(id) {
  return String(id).startsWith('poster-') || /^ch-yt-/.test(String(id)) === false && false;
}

(async () => {
  const files = fs
    .readdirSync(DIR)
    .filter((f) => /^tags_(\d+|uncovered)\.json$/.test(f))
    .sort();

  if (files.length === 0) {
    console.log('no tags_*.json found -- nothing to apply');
    return;
  }

  // Titles come from the batch exports, not from tags_*.json. PostgREST upsert
  // emits INSERT ... ON CONFLICT DO UPDATE, so the insert branch is validated
  // even when every id already exists -- and title is NOT NULL. Sending it
  // makes the payload self-sufficient.
  const titleById = new Map();
  for (const f of fs.readdirSync(DIR).filter((n) => /^batch_\d+\.json$/.test(n))) {
    const b = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf-8'));
    for (const r of b) if (r && r.id) titleById.set(String(r.id), r.title || 'Untitled');
  }
  console.log(`titles loaded: ${titleById.size}`);

  let rows = [];
  let malformed = 0;
  for (const f of files) {
    let parsed;
    try {
      parsed = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf-8'));
    } catch (e) {
      console.log(`SKIP ${f}: unparseable (${e.message.slice(0, 60)})`);
      malformed++;
      continue;
    }
    if (!Array.isArray(parsed)) {
      console.log(`SKIP ${f}: not an array`);
      malformed++;
      continue;
    }
    for (const r of parsed) {
      if (!r || !r.id || !Array.isArray(r.categories)) continue;
      const cats = r.categories
        .map((c) => String(c).trim())
        .filter((c) => c.length > 0 && c.length <= 40);
      if (cats.length === 0) continue;
      rows.push({
        id: String(r.id),
        tags: cats,
        niche: cats[0],
        title: titleById.get(String(r.id)) || 'Untitled',
      });
    }
    console.log(`read ${f}: ${parsed.length} entries`);
  }

  // Dedupe by id, last writer wins.
  const byId = new Map();
  for (const r of rows) byId.set(r.id, r);
  rows = Array.from(byId.values());

  const seenIds = new Set();
  for (const r of rows) {
    if (looksLikePoster(r.id)) {
      console.log(`REFUSING poster-shaped id: ${r.id}`);
      process.exit(1);
    }
    if (seenIds.has(r.id)) {
      console.log(`DUPLICATE id in results: ${r.id}`);
      process.exit(1);
    }
    seenIds.add(r.id);
  }

  const tagCounts = new Map();
  for (const r of rows) for (const c of r.tags) tagCounts.set(c, (tagCounts.get(c) || 0) + 1);

  console.log(`\n${files.length} files, ${malformed} malformed`);
  console.log(`unique rows to apply: ${rows.length}`);
  console.log(`distinct categories: ${tagCounts.size}`);
  const top = [...tagCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25);
  console.log('top categories:');
  for (const [c, n] of top) console.log(`  ${String(n).padStart(5)}  ${c}`);

  const avg = rows.reduce((s, r) => s + r.tags.length, 0) / (rows.length || 1);
  console.log(`avg categories per row: ${avg.toFixed(2)}`);

  if (DRY) {
    console.log('\n--dry-run: nothing written');
    return;
  }

  // UPDATE, not upsert. PostgREST upsert emits INSERT ... ON CONFLICT DO
  // UPDATE, so the insert branch is validated on every row and demands all the
  // NOT NULL columns (title, image_url, ...) that we are not trying to change.
  //
  // Tags differ per row, so there is no set-based UPDATE that can carry them.
  // One scoped UPDATE per id, run through a small concurrency pool.
  const CONCURRENCY = 16;
  let applied = 0;
  let failed = 0;
  let cursor = 0;

  async function worker() {
    while (cursor < rows.length) {
      const r = rows[cursor++];
      const { error } = await supabase
        .from('thumbnails')
        .update({ tags: r.tags, niche: r.niche })
        .eq('id', r.id);
      if (error) {
        failed++;
        console.error(`row ${r.id} failed: ${error.message}`);
      } else {
        applied++;
      }
      if (applied % 200 === 0) process.stdout.write(`\rapplied ${applied}/${rows.length}`);
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  console.log(`\ndone. ${applied} rows updated, ${failed} failed.`);
  if (failed > 0) process.exit(1);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});