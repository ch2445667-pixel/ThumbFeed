/**
 * Write the growth-channel categories back to Supabase.
 *
 * Replaces tags and niche outright -- same rule as the main tagging pass.
 * Scoped to scripts/tagging_growth/ and to rows whose creator is one of the
 * growth channels, so it cannot touch an id from the earlier corpus.
 *
 *   node scripts/apply_tags_growth.js            # apply
 *   node scripts/apply_tags_growth.js --dry-run  # report only
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xahchsuffmskbgvnxcgs.supabase.co';
const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'sb_publishable_QprT-ekIg6xv77IwL9p81g_GR5-tdiy';

const DIR = path.join(__dirname, 'tagging_growth');
const DRY = process.argv.includes('--dry-run');
const CONCURRENCY = 16;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

function readJson(f) {
  const raw = fs.readFileSync(path.join(DIR, f), 'utf-8').replace(/^\uFEFF/, '');
  return JSON.parse(raw);
}

(async () => {
  const tagFiles = fs.readdirSync(DIR).filter((f) => /^tags_\d+\.json$/.test(f)).sort();
  if (tagFiles.length === 0) {
    console.log('no tags_*.json found');
    return;
  }

  // The batch files are the source of truth for which ids may be touched.
  const allowed = new Set();
  for (const f of fs.readdirSync(DIR).filter((n) => /^batch_\d+\.json$/.test(n))) {
    for (const r of readJson(f)) if (r && r.id) allowed.add(String(r.id));
  }
  console.log(`ids eligible for update: ${allowed.size}`);

  const byId = new Map();
  const seen = new Set();
  const problems = [];
  for (const f of tagFiles) {
    const parsed = readJson(f);
    console.log(`read ${f}: ${parsed.length} entries`);
    for (const r of parsed) {
      if (!r || !r.id || !Array.isArray(r.categories)) continue;
      const id = String(r.id);
      if (!allowed.has(id)) {
        problems.push(`NOT IN BATCH: ${id}`);
        continue;
      }
      if (seen.has(id)) {
        problems.push(`DUPLICATE: ${id}`);
        continue;
      }
      const cats = r.categories.map((c) => String(c).trim()).filter((c) => c && c.length <= 40);
      if (cats.length === 0) continue;
      seen.add(id);
      byId.set(id, { tags: cats, niche: cats[0] });
    }
  }

  const rows = [...byId.values()].map((v, i) => ({ id: [...byId.keys()][i], ...v }));
  const tagCounts = new Map();
  for (const r of rows) for (const c of r.tags) tagCounts.set(c, (tagCounts.get(c) || 0) + 1);

  console.log(`\n${tagFiles.length} files, ${problems.length} problems`);
  if (problems.length) problems.slice(0, 10).forEach((p) => console.log('  ' + p));
  console.log(`rows to apply: ${rows.length}`);
  console.log(`distinct categories: ${tagCounts.size}`);
  console.log(
    `avg categories per row: ${(rows.reduce((s, r) => s + r.tags.length, 0) / (rows.length || 1)).toFixed(2)}`
  );
  console.log('top categories:');
  [...tagCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30).forEach(([c, n]) =>
    console.log(`  ${String(n).padStart(5)}  ${c}`)
  );

  if (DRY) {
    console.log('\n--dry-run: nothing written');
    return;
  }

  let cursor = 0, applied = 0, failed = 0;
  async function worker() {
    while (cursor < rows.length) {
      const r = rows[cursor++];
      const { error } = await supabase
        .from('thumbnails')
        .update({ tags: r.tags, niche: r.niche })
        .eq('id', r.id);
      if (error) {
        failed++;
        console.error(`row ${r.id}: ${error.message}`);
      } else {
        applied++;
      }
      if (applied % 200 === 0) process.stdout.write(`\rapplied ${applied}/${rows.length}`);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  console.log(`\ndone. ${applied} updated, ${failed} failed.`);
  if (failed > 0) process.exit(1);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});