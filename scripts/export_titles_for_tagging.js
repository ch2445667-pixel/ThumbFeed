/**
 * Export every non-poster thumbnail's id/title/creator for LLM categorisation.
 *
 * Posters are excluded on purpose: the poster section filter keys off
 * niche='Cinema' / source='poster', and movie titles carry none of the
 * category vocabulary.
 *
 * Writes scripts/tagging/batch_<n>.json, one file per BATCH_SIZE rows.
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xahchsuffmskbgvnxcgs.supabase.co';
const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'sb_publishable_QprT-ekIg6xv77IwL9p81g_GR5-tdiy';

const BATCH_SIZE = Number(process.env.BATCH_SIZE || 250);
const OUT_DIR = path.join(__dirname, 'tagging');

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const f of fs.readdirSync(OUT_DIR)) {
    if (f.endsWith('.json')) fs.unlinkSync(path.join(OUT_DIR, f));
  }

  let all = [];
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from('thumbnails')
      .select('id,title,creator,niche,source')
      .order('id', { ascending: true })
      .range(offset, offset + 999);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    all = all.concat(data);
    offset += 1000;
    if (data.length < 1000) break;
    process.stdout.write(`fetched ${all.length}\r`);
  }
  console.log(`\ntotal rows: ${all.length}`);

  // Poster test mirrors the gallery route's posterPredicate() exactly, so a
  // row excluded here is a row the poster section would have claimed.
  const isPoster = (r) =>
    String(r.id).startsWith('poster-') ||
    r.niche === 'Cinema' ||
    r.source === 'poster';

  const targets = all.filter((r) => !isPoster(r));
  console.log(`posters skipped: ${all.length - targets.length}`);
  console.log(`thumbnails to tag: ${targets.length}`);

  const batches = [];
  for (let i = 0; i < targets.length; i += BATCH_SIZE) {
    batches.push(targets.slice(i, i + BATCH_SIZE));
  }
  batches.forEach((batch, i) => {
    const file = path.join(OUT_DIR, `batch_${String(i).padStart(3, '0')}.json`);
    fs.writeFileSync(
      file,
      JSON.stringify(
        batch.map((r) => ({ id: r.id, title: r.title || '', creator: r.creator || '' })),
        null,
        0
      ),
      'utf-8'
    );
  });
  console.log(`wrote ${batches.length} batches of <=${BATCH_SIZE} to ${OUT_DIR}`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});