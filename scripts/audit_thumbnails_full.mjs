import { writeFileSync, existsSync, readFileSync } from 'fs';

const SUPABASE_URL = 'https://xahchsuffmskbgvnxcgs.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_QprT-ekIg6xv77IwL9p81g_GR5-tdiy';

const PROGRESS_FILE = '/workspace/audit_progress.json';
const REMOVALS_LOG = '/workspace/tag_removals.json';
const TITLE_FIXES_LOG = '/workspace/title_fixes.json';
const FAILED_LOG = '/workspace/failed_ids.json';

// Placeholder title patterns
function isGenericTitle(title) {
  const t = (title || '').trim();
  if (!t) return true;
  if (t.length < 3) return true;
  const l = t.toLowerCase();
  
  // Check for "untitled" in filename pattern like "986. Untitled.jpg"
  if (/^\d+\.\s*untitled/i.test(l)) return true;
  
  const patterns = [
    /^image\d*$/i,
    /^images?$/i,
    /^untitled/i,
    /^thumbnail/i,
    /^thumbnails?$/i,
    /^youtube thumbnail( design)?$/i,
    /^youtube thumbnails?/i,
    /^youtube thumbnail poster/i,
    /^high[ -]?ctr (youtube )?thumbnail( concept)?/i,
    /^high ctr thumbnail concept/i,
    /^curated high[ -]?ctr thumbnail/i,
    /^professional youtube cover design/i,
    /^eye[ -]?catching youtube thumbnail design/i,
    /^thumbnail design$/i,
    /^home \d+$/i,
    /^img_\d+/i,
    /^image_[a-z0-9_]+/i,
    /^untitled design/i,
    /^\d+\.\s*(untitled|image|thumbnail)/i,
    /professional thumbnail design/i,
    /design a mind blowing youtube thumbnail/i,
    /by ankur/i,
    /^image [a-z0-9 ]+$/i,
    /viral thumbnails? in under \d+ minutes/i,
    /masterclass.*\|/i,
    /design for growth with/i
  ];
  
  for (const p of patterns) {
    if (p.test(t)) return true;
  }
  
  return false;
}

async function fetchBatch(offset, limit) {
  const url = `${SUPABASE_URL}/rest/v1/thumbnails?select=id,title,image_url,niche,tags&limit=${limit}&offset=${offset}`;
  const res = await fetch(url, {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
      'Content-Type': 'application/json'
    }
  });
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
  return await res.json();
}

async function updateRow(id, updates) {
  const url = `${SUPABASE_URL}/rest/v1/thumbnails?id=eq.${id}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify(updates)
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Update failed for ${id}: ${res.status} - ${err}`);
  }
  return true;
}

function loadProgress() {
  if (existsSync(PROGRESS_FILE)) {
    return JSON.parse(readFileSync(PROGRESS_FILE, 'utf-8'));
  }
  return { processedIds: [], removals: [], titleFixes: [], failed: [] };
}

function saveProgress(progress) {
  writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

// Analyze image URL and filename for tag hints
function analyzeFromUrl(imageUrl, niche, existingTags) {
  const urlLower = imageUrl.toLowerCase();
  const nicheLower = (niche || '').toLowerCase();
  
  const hints = {
    text: '',
    visualHints: [],
    suggestedTags: [],
    isClearContradiction: {}
  };
  
  // Extract filename info
  const filenameMatch = imageUrl.match(/\/([^/]+\.(?:jpg|jpeg|png|webp))/i);
  const filename = filenameMatch ? decodeURIComponent(filenameMatch[1]) : '';
  
  // Tag detection from URL/filename
  const hasPodcast = urlLower.includes('podcast') || urlLower.includes('rogan') || urlLower.includes('fridman') || urlLower.includes('huberman');
  const hasInterview = urlLower.includes('interview') || urlLower.includes('sits down') || urlLower.includes('conversation');
  const hasNfl = urlLower.includes('nfl') || urlLower.includes('super bowl') || urlLower.includes('quarterback') || urlLower.includes('touchdown') || urlLower.includes('chiefs') || urlLower.includes('cowboys') || urlLower.includes('49ers');
  const hasSoccer = urlLower.includes('soccer') || urlLower.includes('premier') || urlLower.includes('champions league') || urlLower.includes('messi') || urlLower.includes('ronaldo') || urlLower.includes('barcelona') || urlLower.includes('real madrid');
  const hasGaming = urlLower.includes('gaming') || urlLower.includes('minecraft') || urlLower.includes('fortnite') || urlLower.includes('gta') || urlLower.includes('valorant');
  const hasBusiness = urlLower.includes('business') || urlLower.includes('money') || urlLower.includes('crypto') || urlLower.includes('trading') || urlLower.includes('finance');
  const hasMindset = urlLower.includes('mindset') || urlLower.includes('motivation') || urlLower.includes('discipline');
  const hasWar = urlLower.includes('war') || urlLower.includes('ww2') || urlLower.includes('world war');
  const hasMilitary = urlLower.includes('military') || urlLower.includes('soldier') || urlLower.includes('troops');
  const hasGeopolitics = urlLower.includes('geopolitic') || urlLower.includes('ukraine') || urlLower.includes('russia') || urlLower.includes('china') || urlLower.includes('putin');
  const hasPsychology = urlLower.includes('psychology') || urlLower.includes('mental') || urlLower.includes('behavior');
  const hasLifestyle = urlLower.includes('lifestyle') || urlLower.includes('fashion') || urlLower.includes('outfit');
  const hasVlog = urlLower.includes('vlog') || urlLower.includes('day in my life') || urlLower.includes('routine');
  const hasEntrepreneurship = urlLower.includes('entrepreneur') || urlLower.includes('startup') || urlLower.includes('founder');
  const hasSelfImprovement = urlLower.includes('self-improvement') || urlLower.includes('self help') || urlLower.includes('glow up');
  const hasSports = urlLower.includes('sports') || urlLower.includes('athlete') || urlLower.includes('ufc') || urlLower.includes('boxing');
  
  if (hasPodcast) hints.suggestedTags.push('Podcast');
  if (hasInterview) hints.suggestedTags.push('Interviews');
  if (hasNfl) { hints.suggestedTags.push('Nfl', 'Football', 'Sports'); }
  if (hasSoccer) { hints.suggestedTags.push('Soccer', 'Sports'); }
  if (hasGaming) { hints.suggestedTags.push('Gaming', 'Video Games'); }
  if (hasBusiness) hints.suggestedTags.push('Business');
  if (hasMindset) hints.suggestedTags.push('Mindset');
  if (hasWar) hints.suggestedTags.push('War');
  if (hasMilitary) hints.suggestedTags.push('Military');
  if (hasGeopolitics) hints.suggestedTags.push('Geopolitics');
  if (hasPsychology) hints.suggestedTags.push('Psychology');
  if (hasLifestyle) hints.suggestedTags.push('Lifestyle');
  if (hasVlog) hints.suggestedTags.push('Vlog');
  if (hasEntrepreneurship) { hints.suggestedTags.push('Entrepreneurship', 'Business'); }
  if (hasSelfImprovement) hints.suggestedTags.push('Self-Improvement');
  if (hasSports && !hints.suggestedTags.includes('Sports')) hints.suggestedTags.push('Sports');
  
  hints.text = filename.replace(/[_-]/g, ' ').replace(/\.[^.]+$/, '');
  
  // Check for contradictions
  const existingTagSet = new Set((existingTags || []).map(t => String(t).toLowerCase()));
  
  // Soccer vs NFL contradiction
  if (existingTagSet.has('soccer') && hasNfl) {
    hints.isClearContradiction.Soccer = 'Image clearly shows NFL/American football content';
  }
  if (existingTagSet.has('nfl') && hasSoccer && !hasNfl) {
    hints.isClearContradiction.Nfl = 'Image clearly shows soccer content, not NFL';
  }
  
  // Podcast contradiction - only if clearly NOT podcast related
  if (existingTagSet.has('podcast') && !hasPodcast && !hasInterview) {
    // Keep it unless there's strong evidence against
  }
  
  // Gaming on business chart contradiction
  if (existingTagSet.has('gaming') && hasBusiness && !hasGaming) {
    hints.isClearContradiction.Gaming = 'Image shows business/finance content with no gaming elements';
  }
  if (existingTagSet.has('video games') && hasBusiness && !hasGaming) {
    hints.isClearContradiction['Video Games'] = 'Image shows business/finance content with no gaming elements';
  }
  
  return hints;
}

// Normalize existing tags
function normalizeExisting(tags) {
  return (tags || []).map(x => {
    if (!x) return x;
    const l = String(x).trim().toLowerCase();
    if (l === 'interview') return 'Interviews';
    if (l === 'interviews') return 'Interviews';
    if (l === 'nfl') return 'Nfl';
    if (l === 'video games' || l === 'videogames' || l === 'video game') return 'Video Games';
    if (l === 'self improvement' || l === 'self-improvement') return 'Self-Improvement';
    if (l === 'vlog' || l === 'vlogs') return 'Vlog';
    return String(x).trim();
  }).filter(Boolean);
}

// Build descriptive title from image URL
function buildTitle(imageUrl, niche, tags) {
  const filenameMatch = imageUrl.match(/\/([^/]+\.(?:jpg|jpeg|png|webp))/i);
  let filename = filenameMatch ? decodeURIComponent(filenameMatch[1]) : '';
  filename = filename.split('?')[0].replace(/\.[a-z0-9]+$/i, '').replace(/^[0-9]+\.\s*/, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  
  // If filename is already descriptive, use it
  if (filename.length >= 8 && !/^(untitled|image|thumbnail|youtube|high ctr|curated|professional|design|home)/i.test(filename)) {
    return filename.slice(0, 90);
  }
  
  // Build from tags and niche
  const meaningful = (tags || []).filter(x => !/^(high ctr|youtube|creator|tanzeelgfx|thumbnail design|visual hook|click magnet)$/i.test(x)).slice(0, 3);
  const topic = meaningful.length ? ' – ' + meaningful.join(' • ') : '';
  return `${(niche || 'Creator').trim()} Thumbnail${topic}`.slice(0, 120);
}

// Main audit function
async function runAudit() {
  console.log('Starting thumbnail audit...');
  
  const progress = loadProgress();
  const processedSet = new Set(progress.processedIds);
  
  let totalProcessed = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;
  let offset = 0;
  const batchSize = 100;
  
  while (true) {
    console.log(`\nFetching batch at offset ${offset}...`);
    let batch;
    try {
      batch = await fetchBatch(offset, batchSize);
    } catch (e) {
      console.error(`Failed to fetch batch at ${offset}:`, e.message);
      offset += batchSize;
      if (offset >= 3500) break;
      continue;
    }
    
    if (batch.length === 0) {
      console.log('No more rows to process.');
      break;
    }
    
    console.log(`Processing ${batch.length} rows...`);
    
    for (const row of batch) {
      if (processedSet.has(row.id)) {
        totalSkipped++;
        continue;
      }
      
      try {
        // Analyze the thumbnail from URL
        const urlAnalysis = analyzeFromUrl(row.image_url, row.niche, row.tags);
        
        // Normalize existing tags
        const normalizedTags = normalizeExisting(row.tags || []);
        const existingTagSet = new Set(normalizedTags.map(t => t.toLowerCase()));
        
        // Determine new tags to add
        const newTags = [];
        for (const tag of urlAnalysis.suggestedTags) {
          const tagLower = tag.toLowerCase();
          if (!existingTagSet.has(tagLower)) {
            newTags.push(tag);
          }
        }
        
        // Check for contradictions (tag removal scenarios)
        const tagsToRemove = [];
        const normalizedTagSet = new Set(normalizedTags);
        
        for (const [tagToRemove, reason] of Object.entries(urlAnalysis.isClearContradiction)) {
          if (normalizedTagSet.has(tagToRemove)) {
            tagsToRemove.push(tagToRemove);
            progress.removals.push({ id: row.id, removed: tagToRemove, reason });
          }
        }
        
        // Apply tag updates
        let finalTags = normalizedTags.filter(t => !tagsToRemove.includes(t));
        
        // Add new tags
        for (const tag of newTags) {
          if (!finalTags.includes(tag)) {
            finalTags.push(tag);
          }
        }
        
        // Handle title updates
        let newTitle = row.title;
        if (isGenericTitle(row.title)) {
          newTitle = buildTitle(row.image_url, row.niche, finalTags);
          if (newTitle !== row.title) {
            progress.titleFixes.push({ id: row.id, oldTitle: row.title, newTitle });
          }
        }
        
        // Update the row if changes were made
        const originalTagsSorted = JSON.stringify((row.tags || []).sort());
        const finalTagsSorted = JSON.stringify(finalTags.sort());
        const needsUpdate = originalTagsSorted !== finalTagsSorted || newTitle !== row.title;
        
        if (needsUpdate) {
          const updates = {};
          if (originalTagsSorted !== finalTagsSorted) {
            updates.tags = finalTags;
          }
          if (newTitle !== row.title) {
            updates.title = newTitle;
          }
          
          if (Object.keys(updates).length > 0) {
            try {
              await updateRow(row.id, updates);
              totalUpdated++;
            } catch (e) {
              console.error(`Failed to update ${row.id}:`, e.message);
              progress.failed.push({ id: row.id, error: e.message });
            }
          }
        }
        
        processedSet.add(row.id);
        totalProcessed++;
        
        // Save progress periodically
        if (totalProcessed % 50 === 0) {
          progress.processedIds = [...processedSet];
          saveProgress(progress);
        }
        
      } catch (e) {
        console.error(`Error processing ${row.id}:`, e.message);
        progress.failed.push({ id: row.id, error: e.message });
        processedSet.add(row.id);
      }
    }
    
    offset += batchSize;
    if (offset >= 3500) break;
    
    // Rate limiting pause
    await new Promise(r => setTimeout(r, 500));
  }
  
  // Final save
  progress.processedIds = [...processedSet];
  saveProgress(progress);
  
  // Write logs
  writeFileSync(REMOVALS_LOG, JSON.stringify(progress.removals, null, 2));
  writeFileSync(TITLE_FIXES_LOG, JSON.stringify(progress.titleFixes, null, 2));
  writeFileSync(FAILED_LOG, JSON.stringify(progress.failed, null, 2));
  
  console.log('\n=== AUDIT COMPLETE ===');
  console.log(`Total processed: ${totalProcessed}`);
  console.log(`Total updated: ${totalUpdated}`);
  console.log(`Total skipped (already processed): ${totalSkipped}`);
  console.log(`Tag removals: ${progress.removals.length}`);
  console.log(`Title fixes: ${progress.titleFixes.length}`);
  console.log(`Failed: ${progress.failed.length}`);
  
  if (progress.removals.length > 0) {
    console.log('\n=== TAG REMOVALS ===');
    console.log(JSON.stringify(progress.removals, null, 2));
  }
  
  if (progress.titleFixes.length > 0) {
    console.log('\n=== SAMPLE TITLE FIXES (first 5) ===');
    console.log(JSON.stringify(progress.titleFixes.slice(0, 5), null, 2));
  }
}

runAudit().catch(console.error);
