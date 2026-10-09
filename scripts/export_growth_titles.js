/**
 * Export the ids/titles/creators of any thumbnails that still carry a
 * provisional section tag, so the title-based tagging pass can cover them.
 *
 *   node scripts/export_growth_titles.js
 *
 * The growth channels are identified by their creator names rather than by a
 * date range, so this picks up exactly the rows that batch imported and nothing
 * already tagged by title.
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
const OUT_DIR = path.join(__dirname, 'tagging_growth');

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

// Must match the `name` field of every channel in import_channels_growth.js.
const CREATORS = [
  'VideoCreators', 'DerralEves', 'SunnyLenarduzzi', 'JennyHoyos', 'JayClouse',
  'TubeBuddy', 'MattGrayYT', 'VanessaLau', 'JadeBeason', 'Kallaway', 'MilesBeckler',
  'DanKoeTalks', 'SahilBloom',
  'LeilaHormozi', 'DanMartell', 'LewisHowes', 'TomBilyeu', 'BrendonBurchard',
  'melrobbins', 'AlexCattoni', 'MyFirstMillionPod', 'GregIsenberg', 'StarterStory',
  '20VC', 'allin',
  'neilpatel', 'AhrefsCom', 'HubSpotMarketing', 'AuthorityHacker', 'IncomeSchool',
  'ShopifyEntrepreneurs', 'SemrushOfficial', 'Backlinko',
  'mreflow', 'matthew_berman', 'aiexplained-official', 'TwoMinutePapers', 'WesRoth',
  'AIAdvantage', 'nateherk', 'LiamOttley', 'AIJasonZ', 'rileybrown', 'nicksaraev',
  'daveebbelaar', 'AndrejKarpathy', 'anthropic-ai', 'LennysPodcast',
  'jeffsu', 'TinaHuang1', 'AlexTheAnalyst', 'ycombinator', 'ProductivityGame',
  't3dotgg', 'ThePrimeagen', 'WebDevSimplified', 'TraversyMedia', 'KevinPowell',
  'BenAwad97', 'freecodecamp', 'CodeWithHarry',
];

const creatorSet = new Set(CREATORS.map((c) => c.toLowerCase()));

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
    if (data.length < 999) break;
  }
  console.log(`total rows: ${all.length}`);

  const isPoster = (r) =>
    String(r.id).startsWith('poster-') || r.niche === 'Cinema' || r.source === 'poster';
  const notCustom = (r) => !String(r.id).startsWith('upload-') && r.source !== 'custom-upload';

  const targets = all.filter(
    (r) => !isPoster(r) && notCustom(r) && creatorSet.has(String(r.creator || '').trim().toLowerCase())
  );

  const creators = new Set(targets.map((r) => r.creator));
  console.log(`posters/uploads skipped: ${all.length - targets.length - targets.length}`);
  console.log(`growth thumbnails to tag: ${targets.length}`);
  console.log(`distinct creators matched: ${creators.size} / ${CREATORS.length}`);
  const missing = CREATORS.filter((c) => !creators.has(c));
  if (missing.length) console.log(`channels with no rows yet: ${missing.join(', ')}`);

  const batches = [];
  for (let i = 0; i < targets.length; i += BATCH_SIZE) {
    batches.push(targets.slice(i, i + BATCH_SIZE));
  }
  batches.forEach((batch, i) => {
    fs.writeFileSync(
      path.join(OUT_DIR, `batch_${String(i).padStart(3, '0')}.json`),
      JSON.stringify(batch.map((r) => ({ id: r.id, title: r.title || '', creator: r.creator || '' })), null, 0),
      'utf-8'
    );
  });
  console.log(`wrote ${batches.length} batches of <=${BATCH_SIZE} to ${OUT_DIR}`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});