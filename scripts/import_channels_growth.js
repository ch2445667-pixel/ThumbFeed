/**
 * Sharded importer for the creator-growth / business / marketing / AI / dev
 * channels. Last 30 long-form uploads per channel.
 *
 * Same pipeline as the earlier batch (extractor -> upload route), but the
 * channel list is partitioned into SHARDS so several processes can run at once.
 * Each shard writes its OWN progress file and the shards own DISJOINT channels,
 * so there is no dedupe race between processes.
 *
 * Tags here are only a provisional section label. The real categories are
 * assigned afterwards by reading the title (scripts/tagging + apply_tags.js),
 * which replaces whatever this writes.
 *
 * Usage:
 *   SHARD=0 SHARDS=6 node scripts/import_channels_growth.js
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { fetchDirectChannelVideos } = require('./extractor');

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xahchsuffmskbgvnxcgs.supabase.co';
const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'sb_publishable_QprT-ekIg6xv77IwL9p81g_GR5-tdiy';

const UPLOAD_ENDPOINT =
  process.env.UPLOAD_ENDPOINT || 'http://localhost:3000/api/supabase/upload-thumbnail';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

const PER_CHANNEL = Number(process.env.PER_CHANNEL || 30);
const CHUNK_SIZE = Number(process.env.CHUNK_SIZE || 12);
const STAGGER_MS = Number(process.env.STAGGER_MS || 1200);
const SHARD = Number(process.env.SHARD || 0);
const SHARDS = Number(process.env.SHARDS || 6);

/**
 * `section` becomes a provisional tag only; it is overwritten by the title pass.
 * `defaultNiche` is the fallback niche column value.
 */
const ALL_CHANNELS = [
  // YouTube / Creator Growth Coaches
  { name: 'VideoCreators', url: 'https://www.youtube.com/@VideoCreators', section: 'YouTube / Creator Growth Coaches', defaultNiche: 'Educational' },
  { name: 'DerralEves', url: 'https://www.youtube.com/@DerralEves', section: 'YouTube / Creator Growth Coaches', defaultNiche: 'Educational' },
  { name: 'SunnyLenarduzzi', url: 'https://www.youtube.com/@SunnyLenarduzzi', section: 'YouTube / Creator Growth Coaches', defaultNiche: 'Educational' },
  { name: 'JennyHoyos', url: 'https://www.youtube.com/@JennyHoyos', section: 'YouTube / Creator Growth Coaches', defaultNiche: 'Educational' },
  { name: 'JayClouse', url: 'https://www.youtube.com/@JayClouse', section: 'YouTube / Creator Growth Coaches', defaultNiche: 'Entertainment' },
  { name: 'TubeBuddy', url: 'https://www.youtube.com/@TubeBuddy', section: 'YouTube / Creator Growth Coaches', defaultNiche: 'Tech' },
  { name: 'MattGrayYT', url: 'https://www.youtube.com/@MattGrayYT', section: 'YouTube / Creator Growth Coaches', defaultNiche: 'Educational' },
  { name: 'VanessaLau', url: 'https://www.youtube.com/@VanessaLau', section: 'YouTube / Creator Growth Coaches', defaultNiche: 'Educational' },
  { name: 'JadeBeason', url: 'https://www.youtube.com/@JadeBeason', section: 'YouTube / Creator Growth Coaches', defaultNiche: 'Educational' },
  { name: 'Kallaway', url: 'https://www.youtube.com/@Kallaway', section: 'YouTube / Creator Growth Coaches', defaultNiche: 'Entertainment' },
  { name: 'MilesBeckler', url: 'https://www.youtube.com/@MilesBeckler', section: 'YouTube / Creator Growth Coaches', defaultNiche: 'Educational' },
  { name: 'DanKoeTalks', url: 'https://www.youtube.com/@DanKoeTalks', section: 'YouTube / Creator Growth Coaches', defaultNiche: 'Entrepreneurship' },
  { name: 'SahilBloom', url: 'https://www.youtube.com/@SahilBloom', section: 'YouTube / Creator Growth Coaches', defaultNiche: 'Business' },

  // Business / Mindset Coaches
  { name: 'LeilaHormozi', url: 'https://www.youtube.com/@LeilaHormozi', section: 'Business / Mindset Coaches', defaultNiche: 'Business' },
  { name: 'DanMartell', url: 'https://www.youtube.com/@DanMartell', section: 'Business / Mindset Coaches', defaultNiche: 'Business' },
  { name: 'LewisHowes', url: 'https://www.youtube.com/@LewisHowes', section: 'Business / Mindset Coaches', defaultNiche: 'Entrepreneurship' },
  { name: 'TomBilyeu', url: 'https://www.youtube.com/@TomBilyeu', section: 'Business / Mindset Coaches', defaultNiche: 'Business' },
  { name: 'BrendonBurchard', url: 'https://www.youtube.com/@BrendonBurchard', section: 'Business / Mindset Coaches', defaultNiche: 'Business' },
  { name: 'melrobbins', url: 'https://www.youtube.com/@melrobbins', section: 'Business / Mindset Coaches', defaultNiche: 'Business' },
  { name: 'AlexCattoni', url: 'https://www.youtube.com/@AlexCattoni', section: 'Business / Mindset Coaches', defaultNiche: 'Business' },
  { name: 'MyFirstMillionPod', url: 'https://www.youtube.com/@MyFirstMillionPod', section: 'Business / Mindset Coaches', defaultNiche: 'Business' },
  { name: 'GregIsenberg', url: 'https://www.youtube.com/@GregIsenberg', section: 'Business / Mindset Coaches', defaultNiche: 'Entrepreneurship' },
  { name: 'StarterStory', url: 'https://www.youtube.com/@StarterStory', section: 'Business / Mindset Coaches', defaultNiche: 'Business' },
  { name: '20VC', url: 'https://www.youtube.com/@20VC', section: 'Business / Mindset Coaches', defaultNiche: 'Business' },
  { name: 'allin', url: 'https://www.youtube.com/@allin', section: 'Business / Mindset Coaches', defaultNiche: 'Tech' },

  // Marketing / SEO
  { name: 'neilpatel', url: 'https://www.youtube.com/@neilpatel', section: 'Marketing / SEO', defaultNiche: 'Marketing' },
  { name: 'AhrefsCom', url: 'https://www.youtube.com/@AhrefsCom', section: 'Marketing / SEO', defaultNiche: 'Marketing' },
  { name: 'HubSpotMarketing', url: 'https://www.youtube.com/@HubSpotMarketing', section: 'Marketing / SEO', defaultNiche: 'Marketing' },
  { name: 'AuthorityHacker', url: 'https://www.youtube.com/@AuthorityHacker', section: 'Marketing / SEO', defaultNiche: 'Marketing' },
  { name: 'IncomeSchool', url: 'https://www.youtube.com/@IncomeSchool', section: 'Marketing / SEO', defaultNiche: 'Business' },
  { name: 'ShopifyEntrepreneurs', url: 'https://www.youtube.com/@Shopify', section: 'Marketing / SEO', defaultNiche: 'Business' },
  { name: 'SemrushOfficial', url: 'https://www.youtube.com/@Semrush', section: 'Marketing / SEO', defaultNiche: 'Marketing' },
  { name: 'Backlinko', url: 'https://www.youtube.com/@Backlinko1', section: 'Marketing / SEO', defaultNiche: 'Marketing' },

  // AI Creators / Educators
  { name: 'mreflow', url: 'https://www.youtube.com/@mreflow', section: 'AI Creators / Educators', defaultNiche: 'AI' },
  { name: 'matthew_berman', url: 'https://www.youtube.com/@matthew_berman', section: 'AI Creators / Educators', defaultNiche: 'AI' },
  { name: 'aiexplained-official', url: 'https://www.youtube.com/@aiexplained-official', section: 'AI Creators / Educators', defaultNiche: 'AI' },
  { name: 'TwoMinutePapers', url: 'https://www.youtube.com/@TwoMinutePapers', section: 'AI Creators / Educators', defaultNiche: 'AI' },
  { name: 'WesRoth', url: 'https://www.youtube.com/@WesRoth', section: 'AI Creators / Educators', defaultNiche: 'AI' },
  { name: 'AIAdvantage', url: 'https://www.youtube.com/@AIAdvantage', section: 'AI Creators / Educators', defaultNiche: 'AI' },
  { name: 'nateherk', url: 'https://www.youtube.com/@nateherk', section: 'AI Creators / Educators', defaultNiche: 'AI' },
  { name: 'LiamOttley', url: 'https://www.youtube.com/@LiamOttley', section: 'AI Creators / Educators', defaultNiche: 'AI' },
  { name: 'AIJasonZ', url: 'https://www.youtube.com/@AIJasonZ', section: 'AI Creators / Educators', defaultNiche: 'AI' },
  { name: 'rileybrown', url: 'https://www.youtube.com/@rileybrown', section: 'AI Creators / Educators', defaultNiche: 'AI' },
  { name: 'nicksaraev', url: 'https://www.youtube.com/@nicksaraev', section: 'AI Creators / Educators', defaultNiche: 'AI' },
  { name: 'daveebbelaar', url: 'https://www.youtube.com/@daveebbelaar', section: 'AI Creators / Educators', defaultNiche: 'AI' },
  { name: 'AndrejKarpathy', url: 'https://www.youtube.com/@AndrejKarpathy', section: 'AI Creators / Educators', defaultNiche: 'AI' },
  { name: 'anthropic-ai', url: 'https://www.youtube.com/@anthropic-ai', section: 'AI Creators / Educators', defaultNiche: 'AI' },
  { name: 'LennysPodcast', url: 'https://www.youtube.com/@LennysPodcast', section: 'AI Creators / Educators', defaultNiche: 'Podcast' },

  // Productivity / Career / Learning
  { name: 'jeffsu', url: 'https://www.youtube.com/@jeffsu', section: 'Productivity / Career / Learning', defaultNiche: 'Productivity' },
  { name: 'TinaHuang1', url: 'https://www.youtube.com/@TinaHuang1', section: 'Productivity / Career / Learning', defaultNiche: 'Career' },
  { name: 'AlexTheAnalyst', url: 'https://www.youtube.com/@AlexTheAnalyst', section: 'Productivity / Career / Learning', defaultNiche: 'Career' },
  { name: 'ycombinator', url: 'https://www.youtube.com/@ycombinator', section: 'Productivity / Career / Learning', defaultNiche: 'Business' },
  { name: 'ProductivityGame', url: 'https://www.youtube.com/@ProductivityGame', section: 'Productivity / Career / Learning', defaultNiche: 'Productivity' },

  // Dev / Coding Educators
  { name: 't3dotgg', url: 'https://www.youtube.com/@t3dotgg', section: 'Dev / Coding Educators', defaultNiche: 'Software' },
  { name: 'ThePrimeagen', url: 'https://www.youtube.com/@ThePrimeagen', section: 'Dev / Coding Educators', defaultNiche: 'Software' },
  { name: 'WebDevSimplified', url: 'https://www.youtube.com/@WebDevSimplified', section: 'Dev / Coding Educators', defaultNiche: 'Software' },
  { name: 'TraversyMedia', url: 'https://www.youtube.com/@TraversyMedia', section: 'Dev / Coding Educators', defaultNiche: 'Software' },
  { name: 'KevinPowell', url: 'https://www.youtube.com/@KevinPowell', section: 'Dev / Coding Educators', defaultNiche: 'Software' },
  { name: 'BenAwad97', url: 'https://www.youtube.com/@BenAwad97', section: 'Dev / Coding Educators', defaultNiche: 'Software' },
  { name: 'freecodecamp', url: 'https://www.youtube.com/@freecodecamp', section: 'Dev / Coding Educators', defaultNiche: 'Software' },
  { name: 'CodeWithHarry', url: 'https://www.youtube.com/@CodeWithHarry', section: 'Dev / Coding Educators', defaultNiche: 'Software' },
];

// Interleaved partition so every section is spread across all shards: one shard
// failing costs a fraction of each category instead of several whole ones.
const CHANNELS = ALL_CHANNELS.filter((_, i) => i % SHARDS === SHARD);

const PROGRESS_FILE = path.join(__dirname, `growth_progress_shard${SHARD}.json`);
const REPORT_FILE = path.join(__dirname, `growth_report_shard${SHARD}.json`);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function loadProgress() {
  try {
    if (fs.existsSync(PROGRESS_FILE)) return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'));
  } catch {
    /* corrupt -> start over */
  }
  return { channels: {} };
}

function saveProgress(p) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(p, null, 2), 'utf-8');
}

async function loadExistingIndex() {
  const ids = new Set();
  const sourceUrls = new Set();
  const PAGE = 1000;
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase
      .from('thumbnails')
      .select('id,source_url')
      .order('id', { ascending: true })
      .range(offset, offset + PAGE - 1);
    if (error) throw new Error(`Reading existing rows failed: ${error.message}`);
    const batch = data || [];
    for (const row of batch) {
      if (row.id) ids.add(row.id);
      if (row.source_url) sourceUrls.add(row.source_url);
    }
    if (batch.length < PAGE) break;
  }
  return { ids, sourceUrls, total: ids.size };
}

async function uploadBatch(items) {
  const res = await fetch(UPLOAD_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
  });
  if (!res.ok) throw new Error(`Upload HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

async function processChannel(channel, progress, existing) {
  const prior = progress.channels[channel.name];
  if (prior && prior.completed) {
    console.log(`[SKIP] ${channel.name} already done (${prior.uploaded} uploaded)`);
    return { uploaded: 0, skippedChannel: true };
  }

  let videos = [];
  try {
    videos = await fetchDirectChannelVideos(channel.url, PER_CHANNEL);
  } catch (err) {
    console.error(`[ERROR] extract failed ${channel.name}: ${err.message}`);
    return { uploaded: 0, error: err.message };
  }
  videos = (videos || []).slice(0, PER_CHANNEL);
  console.log(`[EXTRACT] ${channel.name}: ${videos.length} videos`);

  if (videos.length === 0) {
    progress.channels[channel.name] = {
      completed: true, found: 0, uploaded: 0,
      note: 'no videos extracted', timestamp: new Date().toISOString(),
    };
    saveProgress(progress);
    return { uploaded: 0 };
  }

  const payload = [];
  let skipped = 0;
  for (const video of videos) {
    const videoId = (video.videoId || '').trim();
    if (!videoId || videoId.length !== 11) continue;
    const id = `thumb-yt-${videoId}`;
    const sourceUrl = video.sourceUrl || `https://www.youtube.com/watch?v=${videoId}`;
    if (existing.ids.has(id) || existing.sourceUrls.has(sourceUrl)) { skipped++; continue; }
    payload.push({
      id,
      videoId,
      title: video.title,
      creator: channel.name,
      imageUrl: video.imageUrl || `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
      sourceUrl,
      niche: channel.defaultNiche,
      // Provisional only. The title-based pass overwrites tags wholesale.
      tags: [channel.section],
      views: video.views || '',
      publishedTime: video.publishedTime || '',
    });
  }

  console.log(`[DEDUPE] ${channel.name}: ${skipped} existing, ${payload.length} new`);

  let uploaded = 0;
  const errors = [];
  for (let i = 0; i < payload.length; i += CHUNK_SIZE) {
    const chunk = payload.slice(i, i + CHUNK_SIZE);
    try {
      const result = await uploadBatch(chunk);
      uploaded += result?.count || chunk.length;
      console.log(`[UPLOAD] ${channel.name} ${Math.floor(i / CHUNK_SIZE) + 1}/${Math.ceil(payload.length / CHUNK_SIZE)} -> ${result?.count || chunk.length}`);
    } catch (err) {
      console.error(`[UPLOAD ERROR] ${channel.name}: ${err.message}`);
      errors.push(err.message);
    }
    await sleep(50);
  }

  progress.channels[channel.name] = {
    completed: true, section: channel.section, found: videos.length,
    skippedExisting: skipped, uploaded, errors: errors.length ? errors : undefined,
    timestamp: new Date().toISOString(),
  };
  saveProgress(progress);
  console.log(`[DONE] ${channel.name}: ${uploaded} uploaded, ${skipped} skipped`);
  return { uploaded, skipped };
}

(async () => {
  console.log(`SHARD ${SHARD}/${SHARDS} -> ${CHANNELS.length} channels x ${PER_CHANNEL}`);

  try {
    const probe = await fetch(UPLOAD_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [] }),
    });
    console.log(`[PROBE] upload endpoint HTTP ${probe.status}`);
  } catch (err) {
    console.error(`[FATAL] upload endpoint unreachable: ${err.message}`);
    process.exit(1);
  }

  const progress = loadProgress();
  const existing = await loadExistingIndex();
  console.log(`[INDEX] ${existing.total} existing ids`);

  let grandUploaded = 0, grandSkipped = 0;
  const failures = [];

  for (let i = 0; i < CHANNELS.length; i++) {
    const channel = CHANNELS[i];
    console.log(`\n>>> [${SHARD}] channel ${i + 1}/${CHANNELS.length}: ${channel.name}`);
    try {
      const r = await processChannel(channel, progress, existing);
      grandUploaded += r.uploaded || 0;
      grandSkipped += r.skipped || 0;
      if (r.error) failures.push({ channel: channel.name, error: r.error });
    } catch (err) {
      console.error(`[CHANNEL ERROR] ${channel.name}: ${err.message}`);
      failures.push({ channel: channel.name, error: err.message });
    }
    await sleep(STAGGER_MS);
  }

  fs.writeFileSync(REPORT_FILE, JSON.stringify({
    finishedAt: new Date().toISOString(),
    shard: SHARD, shards: SHARDS, channels: CHANNELS.length,
    perChannelTarget: PER_CHANNEL, newUploaded: grandUploaded,
    skippedExisting: grandSkipped, failures,
  }, null, 2), 'utf-8');

  console.log(`\n===== SHARD ${SHARD} DONE. uploaded=${grandUploaded} skipped=${grandSkipped}`);
  if (failures.length) {
    console.log(`Failures (${failures.length}):`);
    for (const f of failures) console.log(`  - ${f.channel}: ${f.error}`);
  }
})().catch((err) => {
  console.error('Fatal importer error:', err);
  process.exit(1);
});