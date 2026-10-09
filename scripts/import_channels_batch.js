/**
 * Sharded channel importer -- last 30 long-form uploads per channel.
 *
 * Same pipeline the app already uses (extractor -> rule-based title tagger ->
 * /api/supabase/upload-thumbnail), but the channel list is partitioned into
 * SHARDS so several processes can run at once. Each shard writes its OWN
 * progress file and the shards own DISJOINT channels, so there is no dedupe
 * race between processes.
 *
 * Usage:
 *   SHARD=0 SHARDS=6 node scripts/import_channels_batch.js
 *
 * Insert-new-only: an existing video id is skipped, never overwritten.
 * Resumable: progress is written after every channel.
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { analyzeAndTagTitle } = require('./importer');
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
 * `section` is the heading from the request and is always recorded as a tag.
 * `defaultNiche` is the fallback the rule-based tagger uses when the video
 * title carries no keyword it recognises. Both are constrained to the
 * NicheCategory union in src/lib/types.ts.
 */
const ALL_CHANNELS = [
  // Entertainment / Comedy / Creators
  { name: 'Sidemen', url: 'https://www.youtube.com/@Sidemen', section: 'Entertainment / Comedy / Creators', defaultNiche: 'Entertainment' },
  { name: 'DavidDobrik', url: 'https://www.youtube.com/@DavidDobrik', section: 'Entertainment / Comedy / Creators', defaultNiche: 'Entertainment' },
  { name: 'LizaKoshy', url: 'https://www.youtube.com/@LizaKoshy', section: 'Entertainment / Comedy / Creators', defaultNiche: 'Entertainment' },
  { name: 'Smosh', url: 'https://www.youtube.com/@Smosh', section: 'Entertainment / Comedy / Creators', defaultNiche: 'Entertainment' },
  { name: 'BuzzFeedVideo', url: 'https://www.youtube.com/@BuzzFeedVideo', section: 'Entertainment / Comedy / Creators', defaultNiche: 'Entertainment' },
  { name: 'safiya', url: 'https://www.youtube.com/@safiya', section: 'Entertainment / Comedy / Creators', defaultNiche: 'Entertainment' },
  { name: 'H3Podcast', url: 'https://www.youtube.com/@H3Podcast', section: 'Entertainment / Comedy / Creators', defaultNiche: 'Entertainment' },
  { name: 'jacksfilms', url: 'https://www.youtube.com/@jacksfilms', section: 'Entertainment / Comedy / Creators', defaultNiche: 'Entertainment' },

  // Tech / Programming
  { name: 'JerryRigEverything', url: 'https://www.youtube.com/@JerryRigEverything', section: 'Tech / Programming', defaultNiche: 'Tech' },
  { name: 'iJustine', url: 'https://www.youtube.com/@iJustine', section: 'Tech / Programming', defaultNiche: 'Tech' },
  { name: 'Fireship', url: 'https://www.youtube.com/@Fireship', section: 'Tech / Programming', defaultNiche: 'Tech' },
  { name: 'NetworkChuck', url: 'https://www.youtube.com/@NetworkChuck', section: 'Tech / Programming', defaultNiche: 'Tech' },
  { name: 'TechLinked', url: 'https://www.youtube.com/@TechLinked', section: 'Tech / Programming', defaultNiche: 'Tech' },
  { name: 'ShortCircuit', url: 'https://www.youtube.com/@ShortCircuit', section: 'Tech / Programming', defaultNiche: 'Tech' },
  { name: 'SnazzyLabs', url: 'https://www.youtube.com/@SnazzyLabs', section: 'Tech / Programming', defaultNiche: 'Tech' },
  { name: 'ColdFusion', url: 'https://www.youtube.com/@ColdFusion', section: 'Tech / Programming', defaultNiche: 'Tech' },

  // Science / Education
  { name: '3blue1brown', url: 'https://www.youtube.com/@3blue1brown', section: 'Science / Education', defaultNiche: 'Educational' },
  { name: 'minutephysics', url: 'https://www.youtube.com/@minutephysics', section: 'Science / Education', defaultNiche: 'Educational' },
  { name: 'SmarterEveryDay', url: 'https://www.youtube.com/@SmarterEveryDay', section: 'Science / Education', defaultNiche: 'Educational' },
  { name: 'numberphile', url: 'https://www.youtube.com/@numberphile', section: 'Science / Education', defaultNiche: 'Educational' },
  { name: 'SciShow', url: 'https://www.youtube.com/@SciShow', section: 'Science / Education', defaultNiche: 'Educational' },
  { name: 'AsapSCIENCE', url: 'https://www.youtube.com/@AsapSCIENCE', section: 'Science / Education', defaultNiche: 'Educational' },
  { name: 'NileRed', url: 'https://www.youtube.com/@NileRed', section: 'Science / Education', defaultNiche: 'Educational' },
  { name: 'StuffMadeHere', url: 'https://www.youtube.com/@StuffMadeHere', section: 'Science / Education', defaultNiche: 'Educational' },
  { name: 'tomscott', url: 'https://www.youtube.com/@TomScottGo', section: 'Science / Education', defaultNiche: 'Tech' },
  { name: 'CGPGrey', url: 'https://www.youtube.com/@CGPGrey', section: 'Science / Education', defaultNiche: 'Entertainment' },
  { name: 'crashcourse', url: 'https://www.youtube.com/@crashcourse', section: 'Science / Education', defaultNiche: 'Educational' },
  { name: 'TED', url: 'https://www.youtube.com/@TED', section: 'Science / Education', defaultNiche: 'Educational' },
  { name: 'hubermanlab', url: 'https://www.youtube.com/@hubermanlab', section: 'Science / Education', defaultNiche: 'Educational' },

  // History / Geography / Explainers
  { name: 'OverSimplified', url: 'https://www.youtube.com/@OverSimplified', section: 'History / Geography / Explainers', defaultNiche: 'Educational' },
  { name: 'RealLifeLore', url: 'https://www.youtube.com/@RealLifeLore', section: 'History / Geography / Explainers', defaultNiche: 'Documentary' },
  { name: 'CaspianReport', url: 'https://www.youtube.com/@CaspianReport', section: 'History / Geography / Explainers', defaultNiche: 'Documentary' },
  { name: 'GeographyNow', url: 'https://www.youtube.com/@GeographyNow', section: 'History / Geography / Explainers', defaultNiche: 'Educational' },
  { name: 'TheInfographicsShow', url: 'https://www.youtube.com/@TheInfographicsShow', section: 'History / Geography / Explainers', defaultNiche: 'Educational' },
  { name: 'PolyMatter', url: 'https://www.youtube.com/@PolyMatter', section: 'History / Geography / Explainers', defaultNiche: 'Documentary' },
  { name: 'VisualPolitik', url: 'https://www.youtube.com/@VisualPolitik', section: 'History / Geography / Explainers', defaultNiche: 'Documentary' },

  // Gaming
  { name: 'Dream', url: 'https://www.youtube.com/@Dream', section: 'Gaming', defaultNiche: 'Gaming' },
  { name: 'Technoblade', url: 'https://www.youtube.com/@Technoblade', section: 'Gaming', defaultNiche: 'Gaming' },
  { name: 'DanTDM', url: 'https://www.youtube.com/@DanTDM', section: 'Gaming', defaultNiche: 'Gaming' },
  { name: 'SSundee', url: 'https://www.youtube.com/@SSundee', section: 'Gaming', defaultNiche: 'Gaming' },
  { name: 'CoryxKenshin', url: 'https://www.youtube.com/@CoryxKenshin', section: 'Gaming', defaultNiche: 'Gaming' },
  { name: 'Ninja', url: 'https://www.youtube.com/@Ninja', section: 'Gaming', defaultNiche: 'Gaming' },
  { name: 'shroud', url: 'https://www.youtube.com/@shroud', section: 'Gaming', defaultNiche: 'Gaming' },
  { name: 'GameTheory', url: 'https://www.youtube.com/@GameTheory', section: 'Gaming', defaultNiche: 'Entertainment' },
  { name: 'videogamedunkey', url: 'https://www.youtube.com/@videogamedunkey', section: 'Gaming', defaultNiche: 'Gaming' },
  { name: 'IGN', url: 'https://www.youtube.com/@IGN', section: 'Gaming', defaultNiche: 'Gaming' },
  { name: 'LazarBeam', url: 'https://www.youtube.com/@LazarBeam', section: 'Gaming', defaultNiche: 'Gaming' },

  // Business / Finance / Podcasts
  { name: 'garyvee', url: 'https://www.youtube.com/@garyvee', section: 'Business / Finance / Podcasts', defaultNiche: 'Business' },
  { name: 'TheDiaryOfACEO', url: 'https://www.youtube.com/@TheDiaryOfACEO', section: 'Business / Finance / Podcasts', defaultNiche: 'Business' },
  { name: 'MeetKevin', url: 'https://www.youtube.com/@MeetKevin', section: 'Business / Finance / Podcasts', defaultNiche: 'Business' },
  { name: 'HumphreyYang', url: 'https://www.youtube.com/@HumphreyTalks', section: 'Business / Finance / Podcasts', defaultNiche: 'Business' },
  { name: 'Valuetainment', url: 'https://www.youtube.com/@Valuetainment', section: 'Business / Finance / Podcasts', defaultNiche: 'Business' },
  { name: 'ColinandSamir', url: 'https://www.youtube.com/@ColinandSamir', section: 'Business / Finance / Podcasts', defaultNiche: 'Business' },
  { name: 'ImanGadzhi', url: 'https://www.youtube.com/@ImanGadzhi', section: 'Business / Finance / Podcasts', defaultNiche: 'Business' },
  { name: 'LexFridman', url: 'https://www.youtube.com/@LexFridman', section: 'Business / Finance / Podcasts', defaultNiche: 'Tech' },
  { name: 'PowerfulJRE', url: 'https://www.youtube.com/@joerogan', section: 'Business / Finance / Podcasts', defaultNiche: 'Documentary' },
  { name: 'SamKolder', url: 'https://www.youtube.com/@SamKolder', section: 'Business / Finance / Podcasts', defaultNiche: 'Educational' },

  // Fitness / Wellness
  { name: 'JeremyEthier', url: 'https://www.youtube.com/@JeremyEthier', section: 'Fitness / Wellness', defaultNiche: 'Sports' },
  { name: 'ScottHermanFitness', url: 'https://www.youtube.com/@ScottHermanFitness', section: 'Fitness / Wellness', defaultNiche: 'Sports' },
  { name: 'RenaissancePeriodization', url: 'https://www.youtube.com/@RenaissancePeriodization', section: 'Fitness / Wellness', defaultNiche: 'Sports' },
  { name: 'FitnessFAQs', url: 'https://www.youtube.com/@FitnessFAQs', section: 'Fitness / Wellness', defaultNiche: 'Sports' },
  { name: 'yogawithadriene', url: 'https://www.youtube.com/@yogawithadriene', section: 'Fitness / Wellness', defaultNiche: 'Sports' },
  { name: 'MadFit', url: 'https://www.youtube.com/@MadFit', section: 'Fitness / Wellness', defaultNiche: 'Sports' },
  { name: 'blogilates', url: 'https://www.youtube.com/@blogilates', section: 'Fitness / Wellness', defaultNiche: 'Sports' },

  // Food / Cooking
  { name: 'AdamRagusea', url: 'https://www.youtube.com/@Aragusea', section: 'Food / Cooking', defaultNiche: 'IRL' },
  { name: 'MythicalKitchen', url: 'https://www.youtube.com/@MythicalKitchen', section: 'Food / Cooking', defaultNiche: 'IRL' },
  { name: 'bonappetit', url: 'https://www.youtube.com/@bonappetit', section: 'Food / Cooking', defaultNiche: 'IRL' },
  { name: 'GordonRamsay', url: 'https://www.youtube.com/@GordonRamsay', section: 'Food / Cooking', defaultNiche: 'IRL' },
  { name: 'JamieOliver', url: 'https://www.youtube.com/@JamieOliver', section: 'Food / Cooking', defaultNiche: 'IRL' },
  { name: 'Tasty', url: 'https://www.youtube.com/@TastyFood', section: 'Food / Cooking', defaultNiche: 'IRL' },
  { name: 'RosannaPansino', url: 'https://www.youtube.com/@RosannaPansino', section: 'Food / Cooking', defaultNiche: 'IRL' },
  { name: 'ProHomeCooks', url: 'https://www.youtube.com/@ProHomeCooks', section: 'Food / Cooking', defaultNiche: 'IRL' },
  { name: 'EmmyMadeInJapan', url: 'https://www.youtube.com/@EmmyMakes', section: 'Food / Cooking', defaultNiche: 'IRL' },
  { name: 'SortedFood', url: 'https://www.youtube.com/@SortedFood', section: 'Food / Cooking', defaultNiche: 'IRL' },

  // Cars / Engineering
  { name: 'ChrisFix', url: 'https://www.youtube.com/@ChrisFix', section: 'Cars / Engineering', defaultNiche: 'Tech' },
  { name: 'TopGear', url: 'https://www.youtube.com/@TopGear', section: 'Cars / Engineering', defaultNiche: 'Tech' },
  { name: 'JayLenosGarage', url: 'https://www.youtube.com/@JayLenosGarage', section: 'Cars / Engineering', defaultNiche: 'Tech' },
  { name: 'EngineeringExplained', url: 'https://www.youtube.com/@EngineeringExplained', section: 'Cars / Engineering', defaultNiche: 'Tech' },
  { name: 'ScottyKilmer', url: 'https://www.youtube.com/@ScottyKilmer', section: 'Cars / Engineering', defaultNiche: 'Tech' },
  { name: 'TFLcar', url: 'https://www.youtube.com/@TFLcar', section: 'Cars / Engineering', defaultNiche: 'Tech' },
  { name: 'Hoonigan', url: 'https://www.youtube.com/@Hoonigan', section: 'Cars / Engineering', defaultNiche: 'Tech' },

  // Design / Video / Creative Tools
  { name: 'Piximperfect', url: 'https://www.youtube.com/@Piximperfect', section: 'Design / Video / Creative Tools', defaultNiche: 'Educational' },
  { name: 'blenderguru', url: 'https://www.youtube.com/@blenderguru', section: 'Design / Video / Creative Tools', defaultNiche: 'Tech' },
  { name: 'CorridorCrew', url: 'https://www.youtube.com/@CorridorCrew', section: 'Design / Video / Creative Tools', defaultNiche: 'Tech' },
  { name: 'FilmRiot', url: 'https://www.youtube.com/@FilmRiot', section: 'Design / Video / Creative Tools', defaultNiche: 'Tech' },
  { name: 'DesignCourse', url: 'https://www.youtube.com/@DesignCourse', section: 'Design / Video / Creative Tools', defaultNiche: 'Educational' },
  { name: 'SatoriGraphics', url: 'https://www.youtube.com/@SatoriGraphics', section: 'Design / Video / Creative Tools', defaultNiche: 'Tech' },
  { name: 'TheFutur', url: 'https://www.youtube.com/@TheFutur', section: 'Design / Video / Creative Tools', defaultNiche: 'Business' },

  // YouTube Growth
  { name: 'vidIQ', url: 'https://www.youtube.com/@vidIQ', section: 'YouTube Growth', defaultNiche: 'Educational' },
  { name: 'ThinkMediaTV', url: 'https://www.youtube.com/@ThinkMediaTV', section: 'YouTube Growth', defaultNiche: 'Educational' },
  { name: 'RobertoBlake2', url: 'https://www.youtube.com/@RobertoBlake', section: 'YouTube Growth', defaultNiche: 'Educational' },
  { name: 'NickNimmin', url: 'https://www.youtube.com/@NickNimmin', section: 'YouTube Growth', defaultNiche: 'Educational' },
  { name: 'PaddyGalloway', url: 'https://www.youtube.com/@paddyg', section: 'YouTube Growth', defaultNiche: 'Educational' },

  // True Crime / Mystery / Storytelling
  { name: 'MrBallen', url: 'https://www.youtube.com/@MrBallen', section: 'True Crime / Mystery / Storytelling', defaultNiche: 'Documentary' },
  { name: 'Wendigoon', url: 'https://www.youtube.com/@Wendigoon', section: 'True Crime / Mystery / Storytelling', defaultNiche: 'Documentary' },
  { name: 'BaileySarian', url: 'https://www.youtube.com/@BaileySarian', section: 'True Crime / Mystery / Storytelling', defaultNiche: 'Documentary' },
  { name: 'JCSCriminalPsychology', url: 'https://www.youtube.com/@JCS', section: 'True Crime / Mystery / Storytelling', defaultNiche: 'Documentary' },

  // Animation / Storytelling
  { name: 'JaidenAnimations', url: 'https://www.youtube.com/@JaidenAnimations', section: 'Animation / Storytelling', defaultNiche: 'Entertainment' },
  { name: 'TheOdd1sOut', url: 'https://www.youtube.com/@TheOdd1sOut', section: 'Animation / Storytelling', defaultNiche: 'Entertainment' },
  { name: 'SomeThingElseYT', url: 'https://www.youtube.com/@SomeThingElseYT', section: 'Animation / Storytelling', defaultNiche: 'Entertainment' },
  { name: 'AlanBecker', url: 'https://www.youtube.com/@AlanBecker', section: 'Animation / Storytelling', defaultNiche: 'Entertainment' },

  // Sports
  { name: 'ESPN', url: 'https://www.youtube.com/@ESPN', section: 'Sports', defaultNiche: 'Sports' },
  { name: 'NBA', url: 'https://www.youtube.com/@NBA', section: 'Sports', defaultNiche: 'Sports' },
  { name: 'houseofhighlights', url: 'https://www.youtube.com/@houseofhighlights', section: 'Sports', defaultNiche: 'Sports' },
  { name: 'overtime', url: 'https://www.youtube.com/@overtime', section: 'Sports', defaultNiche: 'Sports' },
  { name: 'UFC', url: 'https://www.youtube.com/@UFC', section: 'Sports', defaultNiche: 'Sports' },
  { name: 'BleacherReport', url: 'https://www.youtube.com/@BleacherReport', section: 'Sports', defaultNiche: 'Sports' },

  // Animals / Nature
  { name: 'thedodo', url: 'https://www.youtube.com/@thedodo', section: 'Animals / Nature', defaultNiche: 'Educational' },
  { name: 'BraveWilderness', url: 'https://www.youtube.com/@bravewilderness', section: 'Animals / Nature', defaultNiche: 'Documentary' },
  { name: 'BBCEarth', url: 'https://www.youtube.com/@BBCEarth', section: 'Animals / Nature', defaultNiche: 'Documentary' },
  { name: 'NatGeoWild', url: 'https://www.youtube.com/@natgeo', section: 'Animals / Nature', defaultNiche: 'Documentary' },

  // Kids / Family
  { name: 'Cocomelon', url: 'https://www.youtube.com/@Cocomelon', section: 'Kids / Family', defaultNiche: 'Entertainment' },
  { name: 'RyansWorld', url: 'https://www.youtube.com/@RyansWorld', section: 'Kids / Family', defaultNiche: 'Entertainment' },
  { name: 'Blippi', url: 'https://www.youtube.com/@Blippi', section: 'Kids / Family', defaultNiche: 'Entertainment' },
  { name: 'LikeNastyaVlog', url: 'https://www.youtube.com/@LikeNastyaOfficial', section: 'Kids / Family', defaultNiche: 'Entertainment' },

  // Music
  { name: 'andrewhuang', url: 'https://www.youtube.com/@andrewhuang', section: 'Music', defaultNiche: 'Entertainment' },
  { name: '12tone', url: 'https://www.youtube.com/@12tone', section: 'Music', defaultNiche: 'Educational' },
  { name: 'ThePianoGuys', url: 'https://www.youtube.com/@ThePianoGuys', section: 'Music', defaultNiche: 'Entertainment' },
  { name: 'Pomplamoose', url: 'https://www.youtube.com/@Pomplamoose', section: 'Music', defaultNiche: 'Entertainment' },

  // Beauty / Fashion
  { name: 'NikkieTutorials', url: 'https://www.youtube.com/@NikkieTutorials', section: 'Beauty / Fashion', defaultNiche: 'IRL' },
  { name: 'jeffreestar', url: 'https://www.youtube.com/@jeffreestar', section: 'Beauty / Fashion', defaultNiche: 'IRL' },
  { name: 'jennim', url: 'https://www.youtube.com/@jennim', section: 'Beauty / Fashion', defaultNiche: 'IRL' },
];

// Interleaved partition: shard i takes every SHARDS-th channel. This spreads
// each section across all shards so any one shard failing costs a fraction of
// every category rather than several whole categories.
const CHANNELS = ALL_CHANNELS.filter((_, i) => i % SHARDS === SHARD);

const PROGRESS_FILE = path.join(__dirname, `batch_progress_shard${SHARD}.json`);
const REPORT_FILE = path.join(__dirname, `batch_report_shard${SHARD}.json`);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function loadProgress() {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'));
    }
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

function buildTagList(section, tagInfo) {
  const tags = [section, ...(tagInfo.tags || [])];
  const seen = new Set();
  const unique = [];
  for (const tag of tags) {
    const clean = (tag || '').trim();
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(clean);
    if (unique.length >= 8) break;
  }
  return unique;
}

async function uploadBatch(items) {
  const res = await fetch(UPLOAD_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Upload HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

async function processChannel(channel, progress, existing) {
  const prior = progress.channels[channel.name];
  if (prior && prior.completed) {
    console.log(`[SKIP] ${channel.name} already done (${prior.uploaded} uploaded)`);
    return { uploaded: 0, skippedChannel: true, found: prior.found || 0 };
  }

  let videos = [];
  try {
    videos = await fetchDirectChannelVideos(channel.url, PER_CHANNEL);
  } catch (err) {
    console.error(`[ERROR] extract failed ${channel.name}: ${err.message}`);
    return { uploaded: 0, error: err.message, found: 0 };
  }
  videos = (videos || []).slice(0, PER_CHANNEL);
  console.log(`[EXTRACT] ${channel.name}: ${videos.length} videos`);

  if (videos.length === 0) {
    progress.channels[channel.name] = {
      completed: true, found: 0, uploaded: 0,
      note: 'no videos extracted', timestamp: new Date().toISOString(),
    };
    saveProgress(progress);
    return { uploaded: 0, found: 0 };
  }

  const payload = [];
  let skipped = 0;
  for (const video of videos) {
    const videoId = (video.videoId || '').trim();
    if (!videoId || videoId.length !== 11) continue;
    const id = `thumb-yt-${videoId}`;
    const sourceUrl = video.sourceUrl || `https://www.youtube.com/watch?v=${videoId}`;
    if (existing.ids.has(id) || existing.sourceUrls.has(sourceUrl)) { skipped++; continue; }

    const tagInfo = analyzeAndTagTitle(video.title, channel.name, channel.defaultNiche);
    payload.push({
      id,
      videoId,
      title: video.title,
      creator: channel.name,
      imageUrl: video.imageUrl || `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
      sourceUrl,
      niche: tagInfo.niche,
      styles: tagInfo.styles,
      tags: buildTagList(channel.section, tagInfo),
      emotion: tagInfo.emotion,
      breakdownNotes: tagInfo.breakdownNotes,
      views: video.views || '',
      publishedTime: video.publishedTime || '',
    });
  }

  console.log(`[DEDUPE] ${channel.name}: ${skipped} existing, ${payload.length} new`);

  let uploaded = 0;
  const errors = [];
  for (let i = 0; i < payload.length; i += CHUNK_SIZE) {
    const chunk = payload.slice(i, i + CHUNK_SIZE);
    const batchNo = Math.floor(i / CHUNK_SIZE) + 1;
    const batchTotal = Math.ceil(payload.length / CHUNK_SIZE);
    try {
      const result = await uploadBatch(chunk);
      uploaded += result?.count || chunk.length;
      console.log(`[UPLOAD] ${channel.name} ${batchNo}/${batchTotal} -> ${result?.count || chunk.length} saved`);
    } catch (err) {
      console.error(`[UPLOAD ERROR] ${channel.name} ${batchNo}: ${err.message}`);
      errors.push(`batch ${batchNo}: ${err.message}`);
    }
    await sleep(50);
  }

  progress.channels[channel.name] = {
    completed: true,
    section: channel.section,
    found: videos.length,
    skippedExisting: skipped,
    uploaded,
    errors: errors.length ? errors : undefined,
    timestamp: new Date().toISOString(),
  };
  saveProgress(progress);
  console.log(`[DONE] ${channel.name}: ${uploaded} uploaded, ${skipped} skipped`);
  return { uploaded, found: videos.length, skipped };
}

async function main() {
  console.log(`SHARD ${SHARD}/${SHARDS} -> ${CHANNELS.length} channels x ${PER_CHANNEL} videos`);
  console.log(`Upload endpoint: ${UPLOAD_ENDPOINT}`);

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

  let grandUploaded = 0, grandSkipped = 0, grandFound = 0;
  const failures = [];

  for (let i = 0; i < CHANNELS.length; i++) {
    const channel = CHANNELS[i];
    console.log(`\n>>> [${SHARD}] channel ${i + 1}/${CHANNELS.length}: ${channel.name}`);
    try {
      const r = await processChannel(channel, progress, existing);
      grandUploaded += r.uploaded || 0;
      grandSkipped += r.skipped || 0;
      grandFound += r.found || 0;
      if (r.error) failures.push({ channel: channel.name, error: r.error });
    } catch (err) {
      console.error(`[CHANNEL ERROR] ${channel.name}: ${err.message}`);
      failures.push({ channel: channel.name, error: err.message });
    }
    await sleep(STAGGER_MS);
  }

  fs.writeFileSync(REPORT_FILE, JSON.stringify({
    finishedAt: new Date().toISOString(),
    shard: SHARD, shards: SHARDS,
    channels: CHANNELS.length,
    perChannelTarget: PER_CHANNEL,
    videosFound: grandFound,
    newUploaded: grandUploaded,
    skippedExisting: grandSkipped,
    failures,
  }, null, 2), 'utf-8');

  console.log(`\n===== SHARD ${SHARD} DONE. found=${grandFound} uploaded=${grandUploaded} skipped=${grandSkipped}`);
  if (failures.length) {
    console.log(`Failures (${failures.length}):`);
    for (const f of failures) console.log(`  - ${f.channel}: ${f.error}`);
  }
  console.log(`Report: ${REPORT_FILE}`);
}

main().catch((err) => {
  console.error('Fatal importer error:', err);
  process.exit(1);
});