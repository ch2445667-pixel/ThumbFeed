/**
 * Closes the remaining import gaps: Johnny Harris (12) and HimanshuG (39).
 *
 *   node scripts/import-remaining.mjs --dry-run
 *   node scripts/import-remaining.mjs
 *
 * Reads the same channel list as run_batch_import.js, checks what is already
 * in the database per creator, and tops up only the difference. Uploads go
 * through the running Next.js API route so the small WebP variant, colour
 * extraction and dimension capture all happen exactly as they do in the app.
 */

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { fetchDirectChannelVideos } = require('./extractor');
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
// ThumbFeed's dev server runs on 3001 because Uno-Family holds 3000.
const APP_URL = ENV.APP_URL || 'http://localhost:3001';

const CHANNELS = [
  { name: 'Damon Cassidy', count: 100, url: 'https://www.youtube.com/@DamonCassidy', defaultNiche: 'Business' },
  { name: 'Kallaway', count: 93, url: 'https://www.youtube.com/@kallawaymarketing', defaultNiche: 'Business' },
  { name: 'Ryan Trahan', count: 61, url: 'https://www.youtube.com/@ryan', defaultNiche: 'Business' },
  { name: 'MrBeast', count: 60, url: 'https://www.youtube.com/@MrBeast', defaultNiche: 'Entertainment' },
  { name: 'Veritasium', count: 60, url: 'https://www.youtube.com/@veritasium', defaultNiche: 'Educational' },
  { name: 'Ali Abdaal', count: 60, url: 'https://www.youtube.com/@aliabdaal', defaultNiche: 'Educational' },
  { name: 'Johnny Harris', count: 60, url: 'https://www.youtube.com/@johnnyharris', defaultNiche: 'Documentary' },
  { name: 'Mrwhosetheboss', count: 60, url: 'https://www.youtube.com/@Mrwhosetheboss', defaultNiche: 'Tech' },
  { name: 'Mark Tilbury', count: 60, url: 'https://www.youtube.com/@marktilbury', defaultNiche: 'Business' },
  { name: 'Marques Brownlee', count: 59, url: 'https://www.youtube.com/@mkbhd', defaultNiche: 'Tech' },
  { name: 'HimanshuG', count: 55, url: 'https://www.youtube.com/@Hgandotra', defaultNiche: 'Tech' },
  { name: 'Vijay Thakkar', count: 50, url: 'https://www.youtube.com/@VijayThakkar', defaultNiche: 'Educational' },
  { name: 'Tyler Stalman', count: 50, url: 'https://www.youtube.com/@stalman', defaultNiche: 'Tech' },
  { name: 'Search Party (Sam Ellis)', count: 50, url: 'https://www.youtube.com/@samellis', defaultNiche: 'Documentary' },
  { name: 'GEN', count: 50, url: 'https://www.youtube.com/@GEN', defaultNiche: 'Documentary' },
  { name: 'finzar', count: 50, url: 'https://www.youtube.com/@finzar', defaultNiche: 'Educational' },
  { name: 'Zane Hoyer', count: 50, url: 'https://www.youtube.com/@zanehoyer', defaultNiche: 'Educational' },
  { name: 'The Diary Of A CEO', count: 50, url: 'https://www.youtube.com/@TheDiaryOfACEO', defaultNiche: 'Business' },
  { name: 'Raj Shamani', count: 50, url: 'https://www.youtube.com/@rajshamani', defaultNiche: 'Business' },
  { name: 'Fraser Cottrell', count: 50, url: 'https://www.youtube.com/@FraserCottrell', defaultNiche: 'Educational' },
  { name: 'Bloomberg Originals', count: 50, url: 'https://www.youtube.com/@business', defaultNiche: 'Business' },
  { name: 'Design Theory', count: 50, url: 'https://www.youtube.com/@Design.Theory', defaultNiche: 'Educational' },
  { name: 'Colin and Samir', count: 50, url: 'https://www.youtube.com/@ColinandSamir', defaultNiche: 'Business' },
  { name: 'The Science of Products', count: 50, url: 'https://www.youtube.com/@thescienceofproducts', defaultNiche: 'Educational' },
  { name: 'Wes McDowell', count: 50, url: 'https://www.youtube.com/@WesMcDowellInc', defaultNiche: 'Business' },
  { name: 'Chase Chappell', count: 50, url: 'https://www.youtube.com/@ChaseChappell', defaultNiche: 'Business' },
  { name: 'Serrahx', count: 50, url: 'https://www.youtube.com/@serrah', defaultNiche: 'Educational' },
  { name: 'PiXimperfect', count: 50, url: 'https://www.youtube.com/@PiXimperfect', defaultNiche: 'Educational' },
  { name: 'David Heacock', count: 50, url: 'https://www.youtube.com/@davidfilterbuy', defaultNiche: 'Business' },
  { name: 'orenmeetsworld', count: 49, url: 'https://www.youtube.com/@orenmeetsworld', defaultNiche: 'Documentary' },
  { name: 'Brimm.', count: 45, url: 'https://www.youtube.com/@brimm-tv', defaultNiche: 'Documentary' },
  { name: "xkcd's What If?", count: 44, url: 'https://www.youtube.com/@xkcd_whatif', defaultNiche: 'Educational' },
  { name: 'Badis Designs', count: 35, url: 'https://www.youtube.com/@BadisDesigns', defaultNiche: 'Educational' },
  { name: 'Wampus', count: 30, url: 'https://www.youtube.com/@itstheWampus', defaultNiche: 'Gaming' },
  { name: 'Open Residency', count: 30, url: 'https://www.youtube.com/@openresidency', defaultNiche: 'Educational' },
  { name: 'Jay Clouse', count: 30, url: 'https://www.youtube.com/@jay', defaultNiche: 'Business' },
  { name: 'Sweat Equity', count: 30, url: 'https://www.youtube.com/@SweatEquityPodcast', defaultNiche: 'Business' },
  { name: 'Found And Explained', count: 30, url: 'https://www.youtube.com/@FoundAndExplained', defaultNiche: 'Documentary' },
  { name: 'Jon Youshaei', count: 30, url: 'https://www.youtube.com/@youshaei', defaultNiche: 'Business' },
  { name: 'Tim Gabe', count: 30, url: 'https://www.youtube.com/@TimGabe', defaultNiche: 'Educational' },
  { name: 'fern', count: 29, url: 'https://www.youtube.com/@fern-tv', defaultNiche: 'Educational' },
  { name: 'Tim Runia', count: 26, url: 'https://www.youtube.com/@TimRunia', defaultNiche: 'Educational' },
  { name: 'Christophe', count: 21, url: 'https://www.youtube.com/@christophe', defaultNiche: 'Educational' },
  { name: 'Max Fisher', count: 17, url: 'https://www.youtube.com/@maxfisher', defaultNiche: 'Documentary' },
  { name: 'Dill Toma', count: 13, url: 'https://www.youtube.com/@DillToma', defaultNiche: 'Lifestyle' },
  { name: 'Noah Haynes', count: 12, url: 'https://www.youtube.com/@retentionwithnoah', defaultNiche: 'Business' },
  { name: 'Barney Watts', count: 8, url: 'https://www.youtube.com/@barneywattss', defaultNiche: 'Educational' },
  { name: 'Thought Out', count: 1, url: 'https://www.youtube.com/@PaulComan', defaultNiche: 'Educational' },
  { name: 'Solar Sands', count: 1, url: 'https://www.youtube.com/@SolarSands', defaultNiche: 'Educational' },
  { name: 'Pranjal Joshi', count: 1, url: 'https://www.youtube.com/@pranjaljoshiii', defaultNiche: 'Tech' },
  { name: 'HTX Studio', count: 1, url: 'https://www.youtube.com/@HTXStudio', defaultNiche: 'Educational' },
];

const dryRun = process.argv.includes('--dry-run');

async function existingIdsByCreator(creator) {
  const ids = new Set();
  for (let from = 0; ; from += 1000) {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/thumbnails?source=eq.supabase-storage&creator=eq.${encodeURIComponent(creator)}` +
        `&select=id&order=id&limit=1000&offset=${from}`,
      { headers: HEADERS }
    );
    if (!res.ok) throw new Error(`${creator}: ${res.status} ${await res.text()}`);
    const batch = await res.json();
    for (const r of batch) ids.add(r.id);
    if (batch.length < 1000) break;
  }
  return ids;
}

async function uploadBatch(items) {
  const res = await fetch(`${APP_URL}/api/supabase/upload-thumbnail`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

// Fail fast with a clear message rather than 51 confusing upload errors.
try {
  const ping = await fetch(`${APP_URL}/api/gallery?section=posters&sort=latest&page=0`);
  if (!ping.ok) throw new Error(`HTTP ${ping.status}`);
  console.log(`app reachable at ${APP_URL}`);
} catch (err) {
  console.error(`Cannot reach the app at ${APP_URL}.`);
  console.error('Start it first:  npm run dev -- -p 3001');
  console.error(`(${err.message})`);
  process.exit(1);
}

console.log(`mode: ${dryRun ? 'DRY RUN' : 'live'}`);
console.log('');

let totalUploaded = 0;

for (const channel of CHANNELS) {
  const have = await existingIdsByCreator(channel.name);
  const gap = channel.count - have.size;
  if (gap <= 0) {
    console.log(`ok   ${channel.name}: ${have.size}/${channel.count}`);
    continue;
  }

  console.log(`GAP  ${channel.name}: ${have.size}/${channel.count} (+${gap})`);

  // Ask for more than the gap so already-imported videos can be skipped in
  // favour of fresh ones. The extractor de-duplicates by video id.
  const videos = await fetchDirectChannelVideos(channel.url, channel.count + 15);
  const fresh = videos.filter((v) => !have.has(`thumb-yt-${v.videoId}`));

  if (fresh.length === 0) {
    console.warn(`     nothing new found for ${channel.name} (source may be exhausted)`);
    continue;
  }
  const batch = fresh.slice(0, gap);
  console.log(`     ${fresh.length} new found, uploading ${batch.length}`);

  if (dryRun) continue;

  const items = batch.map((video) => {
    const tag = analyzeAndTagTitle(video.title, channel.name, channel.defaultNiche);
    return {
      id: `thumb-yt-${video.videoId}`,
      videoId: video.videoId,
      title: video.title,
      creator: channel.name,
      imageUrl: video.imageUrl || `https://i.ytimg.com/vi/${video.videoId}/maxresdefault.jpg`,
      sourceUrl: `https://www.youtube.com/watch?v=${video.videoId}`,
      niche: tag.niche,
      styles: tag.styles,
      tags: tag.tags,
      emotion: tag.emotion,
      breakdownNotes: tag.breakdownNotes,
      views: video.views,
      publishedTime: video.publishedTime,
    };
  });

  const CHUNK = 6;
  for (let i = 0; i < items.length; i += CHUNK) {
    const chunk = items.slice(i, i + CHUNK);
    try {
      const data = await uploadBatch(chunk);
      totalUploaded += chunk.length;
      const dbSaved = data.allDbSaved ? 'all saved' : `${(data.warnings || []).length} warning(s)`;
      console.log(`     uploaded ${Math.min(i + CHUNK, items.length)}/${items.length} (${dbSaved})`);
      if (data.warnings && data.warnings.length > 0) {
        for (const w of data.warnings.slice(0, 3)) console.log(`       ! ${w}`);
      }
    } catch (err) {
      console.error(`     FAILED chunk at ${i}: ${err.message}`);
    }
    await new Promise((r) => setTimeout(r, 250));
  }
}

console.log('');
console.log(`total uploaded this run: ${totalUploaded}`);