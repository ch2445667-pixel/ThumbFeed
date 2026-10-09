/**
 * One-shot channel batch importer (last N long-form uploads per channel).
 *
 * Pipeline is the same one the app already uses:
 *   extractor.fetchDirectChannelVideos()  -> scrape /videos tab, long-form only
 *   importer.analyzeAndTagTitle()         -> rule-based niche/tags from the title
 *   POST /api/supabase/upload-thumbnail   -> store image + small webp + colours,
 *                                            upsert the `thumbnails` row
 *
 * Behaviour agreed with the operator:
 *   - 50 most recent long-form uploads per channel, Shorts excluded
 *   - images go through the full bucket pipeline (original + 400px webp + colours)
 *   - upload date and views are kept in the existing text fields
 *     (views -> views_estimate, publish time -> breakdown_notes "Published: ...")
 *   - the section heading from the request is recorded as an explicit tag
 *   - existing video ids are SKIPPED (insert-new-only), never overwritten
 *
 * Resumable: progress is written after every channel so a re-run continues
 * where it stopped.
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

const PER_CHANNEL = Number(process.env.PER_CHANNEL || 50);
const CHUNK_SIZE = Number(process.env.CHUNK_SIZE || 12);
const STAGGER_MS = Number(process.env.STAGGER_MS || 800);

const PROGRESS_FILE = path.join(__dirname, 'channel_import_progress.json');
const REPORT_FILE = path.join(__dirname, 'channel_import_report.json');

/**
 * Section headings from the request. `defaultNiche` is only a fallback used
 * when the title carries no keyword the rule-based tagger recognises; the
 * section itself is always added to `tags`.
 */
const CHANNELS = [
  // Entertainment
  { name: 'MrBeast', url: 'https://www.youtube.com/@MrBeast', section: 'Entertainment', defaultNiche: 'Entertainment' },
  { name: 'Ryan Trahan', url: 'https://www.youtube.com/@ryan', section: 'Entertainment', defaultNiche: 'Entertainment' },
  { name: 'Dude Perfect', url: 'https://www.youtube.com/@DudePerfect', section: 'Entertainment', defaultNiche: 'Entertainment' },
  { name: 'Beast Philanthropy', url: 'https://www.youtube.com/@beastphilanthropy', section: 'Entertainment', defaultNiche: 'Entertainment' },
  { name: 'Airrack', url: 'https://www.youtube.com/@airrack', section: 'Entertainment', defaultNiche: 'Entertainment' },

  // Tech
  { name: 'MKBHD', url: 'https://www.youtube.com/@mkbhd', section: 'Tech', defaultNiche: 'Tech' },
  { name: 'Mrwhosetheboss', url: 'https://www.youtube.com/@Mrwhosetheboss', section: 'Tech', defaultNiche: 'Tech' },
  { name: 'Linus Tech Tips', url: 'https://www.youtube.com/@LinusTechTips', section: 'Tech', defaultNiche: 'Tech' },
  { name: 'Dave2D', url: 'https://www.youtube.com/@Dave2D', section: 'Tech', defaultNiche: 'Tech' },
  { name: 'Unbox Therapy', url: 'https://www.youtube.com/@unboxtherapy', section: 'Tech', defaultNiche: 'Tech' },

  // Science / Education
  { name: 'Veritasium', url: 'https://www.youtube.com/@veritasium', section: 'Science / Education', defaultNiche: 'Educational' },
  { name: 'Kurzgesagt', url: 'https://www.youtube.com/@kurzgesagt', section: 'Science / Education', defaultNiche: 'Educational' },
  { name: 'Mark Rober', url: 'https://www.youtube.com/@MarkRober', section: 'Science / Education', defaultNiche: 'Educational' },
  { name: 'Vsauce', url: 'https://www.youtube.com/@Vsauce', section: 'Science / Education', defaultNiche: 'Educational' },
  { name: 'Real Engineering', url: 'https://www.youtube.com/@RealEngineering', section: 'Science / Education', defaultNiche: 'Educational' },
  { name: 'Practical Engineering', url: 'https://www.youtube.com/@PracticalEngineeringChannel', section: 'Science / Education', defaultNiche: 'Educational' },

  // Documentary / Explainers
  { name: 'Johnny Harris', url: 'https://www.youtube.com/@johnnyharris', section: 'Documentary / Explainers', defaultNiche: 'Documentary' },
  { name: 'Vox', url: 'https://www.youtube.com/@Vox', section: 'Documentary / Explainers', defaultNiche: 'Documentary' },
  { name: 'Wendover', url: 'https://www.youtube.com/@Wendover', section: 'Documentary / Explainers', defaultNiche: 'Documentary' },
  { name: 'MagnatesMedia', url: 'https://www.youtube.com/@MagnatesMedia', section: 'Documentary / Explainers', defaultNiche: 'Documentary' },
  { name: 'LEMMiNO', url: 'https://www.youtube.com/@LEMMiNO', section: 'Documentary / Explainers', defaultNiche: 'Documentary' },

  // Gaming
  { name: 'Markiplier', url: 'https://www.youtube.com/@markiplier', section: 'Gaming', defaultNiche: 'Gaming' },
  { name: 'Jacksepticeye', url: 'https://www.youtube.com/@jacksepticeye', section: 'Gaming', defaultNiche: 'Gaming' },
  { name: 'PewDiePie', url: 'https://www.youtube.com/@PewDiePie', section: 'Gaming', defaultNiche: 'Gaming' },
  { name: 'Ludwig', url: 'https://www.youtube.com/@ludwig', section: 'Gaming', defaultNiche: 'Gaming' },
  { name: 'Penguinz0', url: 'https://www.youtube.com/@penguinz0', section: 'Gaming', defaultNiche: 'Gaming' },
  { name: 'Mumbo Jumbo', url: 'https://www.youtube.com/@ThatMumboJumbo', section: 'Gaming', defaultNiche: 'Gaming' },

  // Business / Finance / Self-improvement
  { name: 'Alex Hormozi', url: 'https://www.youtube.com/@AlexHormozi', section: 'Business / Finance / Self-improvement', defaultNiche: 'Business' },
  { name: 'Graham Stephan', url: 'https://www.youtube.com/@GrahamStephan', section: 'Business / Finance / Self-improvement', defaultNiche: 'Business' },
  { name: 'Ali Abdaal', url: 'https://www.youtube.com/@aliabdaal', section: 'Business / Finance / Self-improvement', defaultNiche: 'Business' },
  { name: 'Codie Sanchez', url: 'https://www.youtube.com/@CodieSanchezCT', section: 'Business / Finance / Self-improvement', defaultNiche: 'Business' },
  { name: "Matt D'Avella", url: 'https://www.youtube.com/@mattdavella', section: 'Business / Finance / Self-improvement', defaultNiche: 'Business' },
  { name: 'Andrei Jikh', url: 'https://www.youtube.com/@AndreiJikh', section: 'Business / Finance / Self-improvement', defaultNiche: 'Business' },

  // Fitness
  { name: 'Jeff Nippard', url: 'https://www.youtube.com/@JeffNippard', section: 'Fitness', defaultNiche: 'Sports' },
  { name: 'ATHLEAN-X', url: 'https://www.youtube.com/@ATHLEAN-X', section: 'Fitness', defaultNiche: 'Sports' },
  { name: 'Chris Heria', url: 'https://www.youtube.com/@CHRISHERIA', section: 'Fitness', defaultNiche: 'Sports' },
  { name: 'Mind Pump', url: 'https://www.youtube.com/@MindPumpShow', section: 'Fitness', defaultNiche: 'Sports' },

  // Food
  { name: 'Joshua Weissman', url: 'https://www.youtube.com/@JoshuaWeissman', section: 'Food', defaultNiche: 'Lifestyle' },
  { name: 'Nick DiGiovanni', url: 'https://www.youtube.com/@NickDiGiovanni', section: 'Food', defaultNiche: 'Lifestyle' },
  { name: 'Mark Wiens', url: 'https://www.youtube.com/@MarkWiens', section: 'Food', defaultNiche: 'Lifestyle' },
  // Channel is now "Binging with Babish" (formerly Babish Culinary Universe).
  { name: 'Binging with Babish', url: 'https://www.youtube.com/@bingingwithbabish', section: 'Food', defaultNiche: 'Lifestyle' },
  { name: 'Sam The Cooking Guy', url: 'https://www.youtube.com/@SamTheCookingGuy', section: 'Food', defaultNiche: 'Lifestyle' },

  // Cars
  { name: 'Doug DeMuro', url: 'https://www.youtube.com/@DougDeMuro', section: 'Cars', defaultNiche: 'Tech' },
  { name: 'carwow', url: 'https://www.youtube.com/@carwow', section: 'Cars', defaultNiche: 'Tech' },
  { name: 'Donut', url: 'https://www.youtube.com/@Donut', section: 'Cars', defaultNiche: 'Tech' },
  { name: 'Supercar Blondie', url: 'https://www.youtube.com/@SupercarBlondie', section: 'Cars', defaultNiche: 'Tech' },

  // Lifestyle / Vlog / Creative
  { name: 'Casey Neistat', url: 'https://www.youtube.com/@casey', section: 'Lifestyle / Vlog / Creative', defaultNiche: 'IRL' },
  { name: 'emma', url: 'https://www.youtube.com/@emma', section: 'Lifestyle / Vlog / Creative', defaultNiche: 'IRL' },
  { name: 'Peter McKinnon', url: 'https://www.youtube.com/@PeterMcKinnon', section: 'Lifestyle / Vlog / Creative', defaultNiche: 'IRL' },
  { name: 'Zach King', url: 'https://www.youtube.com/@ZachKing', section: 'Lifestyle / Vlog / Creative', defaultNiche: 'IRL' },

  // Commentary / Investigations
  { name: 'coffeezilla', url: 'https://www.youtube.com/@coffeezilla', section: 'Commentary / Investigations', defaultNiche: 'Documentary' },
  { name: 'Philip DeFranco', url: 'https://www.youtube.com/@PhilipDeFranco', section: 'Commentary / Investigations', defaultNiche: 'Documentary' },
  { name: 'Nerdstalgia', url: 'https://www.youtube.com/@Nerdstalgia', section: 'Commentary / Investigations', defaultNiche: 'Documentary' },
  { name: 'Nexpo', url: 'https://www.youtube.com/@NexpoYT', section: 'Commentary / Investigations', defaultNiche: 'Documentary' },

  // Travel
  { name: 'Yes Theory', url: 'https://www.youtube.com/@YesTheory', section: 'Travel', defaultNiche: 'IRL' },
  { name: 'Kara and Nate', url: 'https://www.youtube.com/@KaraandNate', section: 'Travel', defaultNiche: 'IRL' },

  // Music
  { name: 'Rick Beato', url: 'https://www.youtube.com/@RickBeato', section: 'Music', defaultNiche: 'Educational' },
  { name: 'Adam Neely', url: 'https://www.youtube.com/@AdamNeely', section: 'Music', defaultNiche: 'Educational' },

  // DIY / Home
  { name: 'Homemade Modern', url: 'https://www.youtube.com/@HomemadeModern', section: 'DIY / Home', defaultNiche: 'Lifestyle' },
  { name: 'April Wilkerson', url: 'https://www.youtube.com/@AprilWilkerson', section: 'DIY / Home', defaultNiche: 'Lifestyle' },

  // Productivity / Study
  { name: 'Thomas Frank', url: 'https://www.youtube.com/@Thomasfrank', section: 'Productivity / Study', defaultNiche: 'Educational' },
  { name: 'Study With Alex', url: 'https://www.youtube.com/@StudyWithAlex', section: 'Productivity / Study', defaultNiche: 'Educational' },

  // Beauty / Fashion
  { name: 'James Charles', url: 'https://www.youtube.com/@jamescharles', section: 'Beauty / Fashion', defaultNiche: 'Lifestyle' },
  { name: 'Mina Le', url: 'https://www.youtube.com/@MinaLe', section: 'Beauty / Fashion', defaultNiche: 'Lifestyle' },
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function loadProgress() {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'));
    }
  } catch {
    /* corrupt progress file -> start over */
  }
  return { channels: {} };
}

function saveProgress(progress) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2), 'utf-8');
}

/** Every id / source_url already in the table, so we can skip duplicates. */
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
  const data = await res.json();
  return data;
}

async function processChannel(channel, progress, existing) {
  const prior = progress.channels[channel.name];
  if (prior && prior.completed) {
    console.log(`[SKIP] ${channel.name} already completed (${prior.uploaded} uploaded).`);
    return { uploaded: 0, skippedChannel: true, found: prior.found || 0 };
  }

  console.log(`\n============================================================`);
  console.log(`[CHANNEL] ${channel.name}  <${channel.section}>  target ${PER_CHANNEL}`);

  let videos = [];
  try {
    videos = await fetchDirectChannelVideos(channel.url, PER_CHANNEL);
  } catch (err) {
    console.error(`[ERROR] Extract failed for ${channel.name}: ${err.message}`);
    return { uploaded: 0, error: err.message, found: 0 };
  }
  videos = (videos || []).slice(0, PER_CHANNEL);
  console.log(`[EXTRACT] ${channel.name}: ${videos.length} long-form videos`);

  if (videos.length === 0) {
    progress.channels[channel.name] = {
      completed: true,
      found: 0,
      uploaded: 0,
      note: 'no videos extracted',
      timestamp: new Date().toISOString(),
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
    if (existing.ids.has(id) || existing.sourceUrls.has(sourceUrl)) {
      skipped++;
      continue;
    }

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
      // Kept in the existing text fields by design (no date/views columns).
      views: video.views || '',
      publishedTime: video.publishedTime || '',
    });
  }

  console.log(`[DEDUPE] ${channel.name}: ${skipped} already present, ${payload.length} new to insert`);

  let uploaded = 0;
  const errors = [];
  for (let i = 0; i < payload.length; i += CHUNK_SIZE) {
    const chunk = payload.slice(i, i + CHUNK_SIZE);
    const batchNo = Math.floor(i / CHUNK_SIZE) + 1;
    const batchTotal = Math.ceil(payload.length / CHUNK_SIZE);
    try {
      const result = await uploadBatch(chunk);
      uploaded += result?.count || chunk.length;
      if (result?.warnings?.length) {
        console.warn(`[WARN] ${channel.name} batch ${batchNo}: ${result.warnings.slice(0, 2).join(' | ')}`);
      }
      console.log(`[UPLOAD] ${channel.name} batch ${batchNo}/${batchTotal} -> ${result?.count || chunk.length} saved (allDbSaved=${result?.allDbSaved})`);
    } catch (err) {
      console.error(`[UPLOAD ERROR] ${channel.name} batch ${batchNo}: ${err.message}`);
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

  console.log(`[DONE] ${channel.name}: ${uploaded} uploaded, ${skipped} skipped (already present).`);
  return { uploaded, found: videos.length, skipped };
}

async function main() {
  console.log(`Channel batch import starting. ${CHANNELS.length} channels x ${PER_CHANNEL} videos.`);
  console.log(`Upload endpoint: ${UPLOAD_ENDPOINT}`);

  // Fail fast if the app's upload route is not reachable.
  try {
    const probe = await fetch(UPLOAD_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [] }),
    });
    console.log(`[PROBE] upload endpoint responded HTTP ${probe.status}`);
  } catch (err) {
    console.error(`[FATAL] Upload endpoint unreachable: ${err.message}`);
    console.error('Start the dev server (npm run dev) before running this importer.');
    process.exit(1);
  }

  const progress = loadProgress();
  const existing = await loadExistingIndex();
  console.log(`[INDEX] ${existing.total} existing ids loaded for skip-dedupe.`);

  let grandUploaded = 0;
  let grandSkipped = 0;
  let grandFound = 0;
  const failures = [];

  for (let i = 0; i < CHANNELS.length; i++) {
    const channel = CHANNELS[i];
    console.log(`\n>>> Channel ${i + 1}/${CHANNELS.length}: ${channel.name}`);
    try {
      const result = await processChannel(channel, progress, existing);
      grandUploaded += result.uploaded || 0;
      grandSkipped += result.skipped || 0;
      grandFound += result.found || 0;
      if (result.error) failures.push({ channel: channel.name, error: result.error });
    } catch (err) {
      console.error(`[CHANNEL ERROR] ${channel.name}: ${err.message}`);
      failures.push({ channel: channel.name, error: err.message });
    }
    await sleep(STAGGER_MS);
  }

  const report = {
    finishedAt: new Date().toISOString(),
    channels: CHANNELS.length,
    perChannelTarget: PER_CHANNEL,
    videosFound: grandFound,
    newUploaded: grandUploaded,
    skippedExisting: grandSkipped,
    failures,
  };
  fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2), 'utf-8');

  console.log(`\n============================================================`);
  console.log(`ALL DONE. found=${grandFound} uploaded=${grandUploaded} skippedExisting=${grandSkipped}`);
  console.log(`Report: ${REPORT_FILE}`);
  if (failures.length) {
    console.log(`Failures (${failures.length}):`);
    for (const f of failures) console.log(`  - ${f.channel}: ${f.error}`);
  }
  console.log(`============================================================`);
}

main().catch((err) => {
  console.error('Fatal importer error:', err);
  process.exit(1);
});
