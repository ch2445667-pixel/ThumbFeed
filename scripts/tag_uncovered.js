/**
 * Identify thumbnail rows that were NOT covered by the LLM tagging pass --
 * i.e. rows that still carry the old keyword tags and would pollute the
 * category filter.
 *
 *   node scripts/tag_uncovered.js
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
  const covered = new Set();
  for (const f of fs.readdirSync(DIR).filter((n) => /^tags_\d+\.json$/.test(n))) {
    const raw = fs.readFileSync(path.join(DIR, f), 'utf-8').replace(/^\uFEFF/, '');
    for (const r of JSON.parse(raw)) covered.add(String(r.id));
  }

  let all = [];
  let off = 0;
  while (true) {
    const { data } = await supabase
      .from('thumbnails')
      .select('id,niche,tags,source,creator,title')
      .range(off, off + 999);
    if (!data || !data.length) break;
    all = all.concat(data);
    off += 999;
    if (data.length < 999) break;
  }

  const isPoster = (r) =>
    String(r.id).startsWith('poster-') || r.niche === 'Cinema' || r.source === 'poster';
  const thumbs = all.filter((r) => !isPoster(r));
  const uncovered = thumbs.filter((r) => !covered.has(String(r.id)));

  console.log(`thumbnail rows: ${thumbs.length}`);
  console.log(`covered by tagging pass: ${thumbs.length - uncovered.length}`);
  console.log(`NOT covered: ${uncovered.length}`);

  const creators = new Map();
  for (const r of uncovered) creators.set(r.creator, (creators.get(r.creator) || 0) + 1);
  console.log('\ntop creators among uncovered:');
  [...creators.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20).forEach(([c, n]) =>
    console.log(`  ${String(n).padStart(4)}  ${c}`)
  );

  console.log('\nsample uncovered rows:');
  uncovered.slice(0, 12).forEach((r) =>
    console.log(`  ${r.id}  ${String(r.title).slice(0, 60)}  tags=${JSON.stringify(r.tags)}`)
  );

  fs.writeFileSync(
    path.join(DIR, 'uncovered.json'),
    JSON.stringify(uncovered.map((r) => ({ id: r.id, title: r.title || '', creator: r.creator || '' })), null, 0),
    'utf-8'
  );
  console.log('\nwrote scripts/tagging/uncovered.json');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});