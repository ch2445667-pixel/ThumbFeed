const fs = require('fs');
const path = require('path');
const { analyzeAndTagTitle } = require('./importer');
const { fetchDirectChannelVideos } = require('./extractor');

const CHANNELS = [
  { name: 'Damon Cassidy', count: 100, url: 'https://www.youtube.com/@DamonCassidy', defaultNiche: 'Tech' },
  { name: 'Kallaway', count: 93, url: 'https://www.youtube.com/@kallawaymarketing', defaultNiche: 'Business' },
  { name: 'Ryan Trahan', count: 61, url: 'https://www.youtube.com/@ryan', defaultNiche: 'Entertainment' },
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
  { name: 'xkcd\'s What If?', count: 44, url: 'https://www.youtube.com/@xkcd_whatif', defaultNiche: 'Educational' },
  { name: 'Badis Designs', count: 35, url: 'https://www.youtube.com/@BadisDesigns', defaultNiche: 'Educational' },
  { name: 'Wampus', count: 30, url: 'https://www.youtube.com/@itstheWampus', defaultNiche: 'Gaming' },
  { name: 'Open Residency', count: 30, url: 'https://www.youtube.com/@openresidency', defaultNiche: 'Educational' },
  { name: 'Jay Clouse', count: 30, url: 'https://www.youtube.com/@jay', defaultNiche: 'Business' },
  { name: 'Sweat Equity', count: 30, url: 'https://www.youtube.com/@SweatEquityPodcast', defaultNiche: 'Business' },
  { name: 'Found And Explained', count: 30, url: 'https://www.youtube.com/@FoundAndExplained', defaultNiche: 'Documentary' },
  { name: 'Jon Youshaei', count: 30, url: 'https://www.youtube.com/@youshaei', defaultNiche: 'Business' },
  { name: 'Tim Gabe', count: 30, url: 'https://www.youtube.com/@TimGabe', defaultNiche: 'Educational' },
  { name: 'fern', count: 29, url: 'https://www.youtube.com/@fern-tv', defaultNiche: 'Documentary' },
  { name: 'Tim Runia', count: 26, url: 'https://www.youtube.com/@TimRunia', defaultNiche: 'Educational' },
  { name: 'Christophe', count: 21, url: 'https://www.youtube.com/@christophe', defaultNiche: 'Educational' },
  { name: 'Max Fisher', count: 17, url: 'https://www.youtube.com/@maxfisher', defaultNiche: 'Documentary' },
  { name: 'Dill Toma', count: 13, url: 'https://www.youtube.com/@DillToma', defaultNiche: 'Educational' },
  { name: 'Noah Haynes', count: 12, url: 'https://www.youtube.com/@retentionwithnoah', defaultNiche: 'Educational' },
  { name: 'Barney Watts', count: 8, url: 'https://www.youtube.com/@barneywattss', defaultNiche: 'Educational' },
  { name: 'Thought Out', count: 1, url: 'https://www.youtube.com/@PaulComan', defaultNiche: 'Educational' },
  { name: 'Solar Sands', count: 1, url: 'https://www.youtube.com/@SolarSands', defaultNiche: 'Educational' },
  { name: 'Pranjal Joshi', count: 1, url: 'https://www.youtube.com/@pranjaljoshiii', defaultNiche: 'Tech' },
  { name: 'HTX Studio', count: 1, url: 'https://www.youtube.com/@HTXStudio', defaultNiche: 'Educational' }
];

const PROGRESS_FILE = path.join(__dirname, 'import_progress.json');

function loadProgress() {
  if (fs.existsSync(PROGRESS_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'));
    } catch (e) {
      return {};
    }
  }
  return {};
}

function saveProgress(progress) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2), 'utf-8');
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function extractChannelVideos(channel) {
  try {
    console.log(`\n========================================`);
    console.log(`[EXTRACT] Fetching ${channel.name} (${channel.count} requested)...`);
    const videos = await fetchDirectChannelVideos(channel.url, channel.count);
    console.log(`[SUCCESS] Extracted ${videos.length} videos from ${channel.name}`);
    return videos.slice(0, channel.count);
  } catch (err) {
    console.error(`[ERROR] Extracting ${channel.name}:`, err.message);
    return [];
  }
}

async function uploadBatch(items) {
  try {
    const res = await fetch('http://localhost:3000/api/supabase/upload-thumbnail', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items })
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn(`[UPLOAD WARN] Batch upload returned HTTP ${res.status}:`, errText.slice(0, 100));
      return false;
    }

    const data = await res.json();
    console.log(`[UPLOAD OK] Saved ${data.count || items.length} thumbnails to Supabase (allDbSaved: ${data.allDbSaved})`);
    return true;
  } catch (err) {
    console.error(`[UPLOAD ERROR]:`, err.message);
    return false;
  }
}

async function processChannel(channel, progress) {
  if (progress[channel.name] && progress[channel.name].completed) {
    console.log(`[SKIP] ${channel.name} already completed (${progress[channel.name].uploadedCount} uploaded).`);
    return progress[channel.name].uploadedCount;
  }

  const videos = await extractChannelVideos(channel);
  if (!videos || videos.length === 0) {
    console.warn(`[SKIP] No videos found for ${channel.name}`);
    return 0;
  }

  console.log(`[TAGGING] Auto-tagging ${videos.length} videos one-by-one according to their titles...`);

  const payloadItems = videos.map(video => {
    const tagInfo = analyzeAndTagTitle(video.title, channel.name, channel.defaultNiche);
    return {
      id: `thumb-yt-${video.videoId}`,
      videoId: video.videoId,
      title: video.title,
      creator: channel.name,
      imageUrl: video.imageUrl || `https://i.ytimg.com/vi/${video.videoId}/maxresdefault.jpg`,
      sourceUrl: video.sourceUrl || `https://www.youtube.com/watch?v=${video.videoId}`,
      niche: tagInfo.niche,
      styles: tagInfo.styles,
      tags: tagInfo.tags,
      emotion: tagInfo.emotion,
      breakdownNotes: tagInfo.breakdownNotes,
      views: video.views,
      publishedTime: video.publishedTime
    };
  });

  // Upload in chunks of 12 for high-throughput batching
  const CHUNK_SIZE = 12;
  let totalUploaded = 0;

  for (let i = 0; i < payloadItems.length; i += CHUNK_SIZE) {
    const chunk = payloadItems.slice(i, i + CHUNK_SIZE);
    console.log(`[UPLOADING] ${channel.name} batch ${Math.floor(i / CHUNK_SIZE) + 1} / ${Math.ceil(payloadItems.length / CHUNK_SIZE)} (${chunk.length} items)...`);
    const ok = await uploadBatch(chunk);
    if (ok) totalUploaded += chunk.length;
    await sleep(50);
  }

  progress[channel.name] = {
    completed: true,
    targetCount: channel.count,
    uploadedCount: totalUploaded,
    timestamp: new Date().toISOString()
  };
  saveProgress(progress);

  console.log(`[COMPLETED] ${channel.name}: ${totalUploaded} / ${channel.count} thumbnails successfully uploaded to Supabase.`);
  return totalUploaded;
}

async function main() {
  console.log(`Starting bulk import of 51 channels into Supabase...`);
  const progress = loadProgress();
  let grandTotal = 0;

  for (let i = 0; i < CHANNELS.length; i++) {
    const channel = CHANNELS[i];
    console.log(`\n>>> Processing Channel ${i + 1} of ${CHANNELS.length}: ${channel.name} (${channel.count} target)`);
    const uploaded = await processChannel(channel, progress);
    grandTotal += uploaded;
    await sleep(500);
  }

  console.log(`\n======================================================`);
  console.log(`ALL 51 CHANNELS PROCESSED! Total thumbnails uploaded: ${grandTotal}`);
  console.log(`======================================================`);
}

main().catch(err => {
  console.error('Fatal import runner error:', err);
  process.exit(1);
});
