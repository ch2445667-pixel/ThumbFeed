/**
 * Compare the intended assignments (scripts/tagging/tags_*.json) against what
 * is actually in the database, row by row.
 *
 *   node scripts/tag_diff.js
 *
 * The write script reports "0 failed" whenever PostgREST returns no error, but
 * an UPDATE that matches no row is also not an error. This finds the rows that
 * silently did not change.
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

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

(async () => {
  const want = new Map();
  for (const f of fs.readdirSync(DIR).filter((n) => /^tags_\d+\.json$/.test(n))) {
    const raw = fs.readFileSync(path.join(DIR, f), 'utf-8').replace(/^\uFEFF/, '');
    for (const r of JSON.parse(raw)) want.set(String(r.id), r.categories);
  }
  console.log(`intended rows: ${want.size}`);

  let all = [];
  let off = 0;
  while (true) {
    const { data } = await supabase
      .from('thumbnails')
      .select('id,niche,tags,source')
      .range(off, off + 999);
    if (!data || !data.length) break;
    all = all.concat(data);
    off += 999;
    if (data.length < 999) break;
  }
  const isPoster = (r) =>
    String(r.id).startsWith('poster-') || r.niche === 'Cinema' || r.source === 'poster';
  const thumbs = all.filter((r) => !isPoster(r));
  console.log(`db thumbnail rows: ${thumbs.length}`);

  const missingFromDb = [...want.keys()].filter((id) => !all.some((r) => r.id === id));

  let mismatched = [];
  for (const r of thumbs) {
    const expect = want.get(r.id);
    if (!expect) continue;
    const got = Array.isArray(r.tags) ? r.tags : [];
    const a = [...expect].sort().join('|');
    const b = [...got].sort().join('|');
    if (a !== b) mismatched.push({ id: r.id, want: expect, got });
  }

  console.log(`\nids in intent but absent from db: ${missingFromDb.length}`);
  if (missingFromDb.length) console.log('  sample:', missingFromDb.slice(0, 10).join(', '));
  console.log(`rows whose tags do NOT match intent: ${mismatched.length}`);
  for (const m of mismatched.slice(0, 15)) {
    console.log(`  ${m.id}\n    want: ${JSON.stringify(m.want)}\n    got:  ${JSON.stringify(m.got)}`);
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});