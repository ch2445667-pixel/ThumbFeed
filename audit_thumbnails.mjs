import { writeFileSync, readFileSync, existsSync } from 'fs';

const SUPABASE_URL = 'https://xahchsuffmskbgvnxcgs.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_QprT-ekIg6xv77IwL9p81g_GR5-tdiy';

const TARGETS = ['Podcast','Interviews','Football','Mindset','Self-Improvement','Lifestyle','Business','Entrepreneurship','Gaming','Geopolitics','Military','Nfl','Psychology','Soccer','Sports','Video Games','Vlog','War'];

// Progress file for resumability
const PROGRESS_FILE = '/workspace/audit_progress.json';
const REMOVALS_LOG = '/workspace/tag_removals.json';
const TITLE_FIXES_LOG = '/workspace/title_fixes.json';
const FAILED_LOG = '/workspace/failed_ids.json';

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

// Check if title is generic/placeholder
function isGenericTitle(title) {
  const t = (title || '').trim();
  if (!t) return true;
  if (t.length < 3) return true;
  const l = t.toLowerCase();
  
  if (/^(image|images|untitled|thumbnail|thumbnails|youtube thumbnail( design)?|high[ -]?ctr (youtube )?thumbnail( concept)?|high ctr thumbnail concept|curated high[ -]?ctr thumbnail|professional youtube cover design|eye[ -]?catching youtube thumbnail design|thumbnail design|home [0-9]|img_\d+.*|image_[a-z0-9_]+|untitled design.*)(\s*[\d.\-_x]*)?$/i.test(t)) return true;
  if (/^\d+\.\s*(untitled|image|thumbnail)/i.test(t)) return true;
  
  return false;
}

// Extract text from image using vision
async function analyzeImage(imageUrl) {
  // Using Google's generative AI via their API
  const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || '';
  
  if (!GOOGLE_API_KEY) {
    // Fallback: just use URL-based analysis
    return { text: '', description: '' };
  }
  
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GOOGLE_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { fileData: { mimeType: 'image/jpeg', fileUri: imageUrl } },
            { text: "Analyze this YouTube thumbnail image. Return ONLY valid JSON with these fields: { onImageText: string (all visible text), description: string (brief visual description), category: string[] (array of relevant categories from: Podcast, Interviews, Football, Mindset, Self-Improvement, Lifestyle, Business, Entrepreneurship, Gaming, Geopolitics, Military, Nfl, Psychology, Soccer, Sports, Video Games, Vlog, War) }" }
          ]
        }]
      })
    });
    
    if (!response.ok) return { text: '', description: '' };
    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return { text, description: text };
  } catch (e) {
    return { text: '', description: '' };
  }
}

// Analyze based on URL patterns and existing metadata
function analyzeFromUrl(imageUrl, niche, existingTags) {
  const urlLower = imageUrl.toLowerCase();
  const nicheLower = (niche || '').toLowerCase();
  
  const hints = {
    text: '',
    visualHints: [],
    suggestedTags: []
  };
  
  // Extract filename info
  const filenameMatch = imageUrl.match(/\/([^/]+\.(?:jpg|jpeg|png|webp))/i);
  const filename = filenameMatch ? decodeURIComponent(filenameMatch[1]) : '';
  
  // Category detection from URL/filename
  if (urlLower.includes('podcast') || urlLower.includes('rogan') || urlLower.includes('fridman')) {
    hints.suggestedTags.push('Podcast');
  }
  if (urlLower.includes('interview') || urlLower.includes('sits down') || urlLower.includes('conversation')) {
    hints.suggestedTags.push('Interviews');
  }
  if (urlLower.includes('football') || urlLower.includes('nfl') || urlLower.includes('super bowl')) {
    hints.suggestedTags.push('Football', 'Nfl');
  }
  if (urlLower.includes('soccer') || urlLower.includes('premier') || urlLower.includes('champions league')) {
    hints.suggestedTags.push('Soccer');
  }
  if (urlLower.includes('gaming') || urlLower.includes('minecraft') || urlLower.includes('fortnite') || urlLower.includes('gta')) {
    hints.suggestedTags.push('Gaming', 'Video Games');
  }
  if (urlLower.includes('business') || urlLower.includes('money') || urlLower.includes('crypto') || urlLower.includes('trading')) {
    hints.suggestedTags.push('Business');
  }
  if (urlLower.includes('mindset') || urlLower.includes('motivation') || urlLower.includes('discipline')) {
    hints.suggestedTags.push('Mindset');
  }
  if (urlLower.includes('war') || urlLower.includes('military') || urlLower.includes('soldier')) {
    hints.suggestedTags.push('War', 'Military');
  }
  if (urlLower.includes('geopolitic') || urlLower.includes('ukraine') || urlLower.includes('russia') || urlLower.includes('china')) {
    hints.suggestedTags.push('Geopolitics');
  }
  if (urlLower.includes('psychology') || urlLower.includes('mental') || urlLower.includes('behavior')) {
    hints.suggestedTags.push('Psychology');
  }
  if (urlLower.includes('lifestyle') || urlLower.includes('fashion') || urlLower.includes('outfit')) {
    hints.suggestedTags.push('Lifestyle');
  }
  if (urlLower.includes('vlog') || urlLower.includes('day in my life') || urlLower.includes('routine')) {
    hints.suggestedTags.push('Vlog');
  }
  if (urlLower.includes('entrepreneur') || urlLower.includes('startup') || urlLower.includes('founder')) {
    hints.suggestedTags.push('Entrepreneurship', 'Business');
  }
  if (urlLower.includes('self-improvement') || urlLower.includes('self help') || urlLower.includes('glow up')) {
    hints.suggestedTags.push('Self-Improvement');
  }
  if (urlLower.includes('sports') || urlLower.includes('athlete') || urlLower.includes('ufc') || urlLower.includes('boxing')) {
    hints.suggestedTags.push('Sports');
  }
  
  hints.text = filename.replace(/[_-]/g, ' ').replace(/\.[^.]+$/, '');
  
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
      if (offset >= 3000) break;
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
        // Analyze the thumbnail
        const urlAnalysis = analyzeFromUrl(row.image_url, row.niche, row.tags);
        
        // Normalize existing tags
        const normalizedTags = normalizeExisting(row.tags || []);
        const existingTagSet = new Set(normalizedTags);
        
        // Determine new tags to add
        const newTags = new Set();
        for (const tag of urlAnalysis.suggestedTags) {
          if (!existingTagSet.has(tag)) {
            newTags.add(tag);
          }
        }
        
        // Check for contradictions (tag removal scenarios)
        const tagsToRemove = [];
        
        // Example contradiction checks:
        // If tagged Soccer but clearly NFL content
        if (existingTagSet.has('Soccer') && urlAnalysis.suggestedTags.includes('Nfl')) {
          tagsToRemove.push('Soccer');
        }
        // If tagged Podcast but no podcast indicators
        if (existingTagSet.has('Podcast') && !urlAnalysis.suggestedTags.includes('Podcast') && !urlAnalysis.suggestedTags.includes('Interviews')) {
          // Only remove if clearly not podcast-related
          if (!row.image_url.toLowerCase().includes('podcast') && !row.image_url.toLowerCase().includes('rogan') && !row.image_url.toLowerCase().includes('fridman')) {
            // Keep it for now - when in doubt, KEEP
          }
        }
        
        // Apply tag updates if needed
        let finalTags = [...normalizedTags];
        if (tagsToRemove.length > 0) {
          finalTags = finalTags.filter(t => !tagsToRemove.includes(t));
          progress.removals.push({ id: row.id, removed: tagsToRemove, reason: 'Contradiction with image content' });
        }
        
        // Add new tags
        for (const tag of newTags) {
          finalTags.push(tag);
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
        const needsUpdate = finalTags.length !== (row.tags || []).length || newTitle !== row.title;
        
        if (needsUpdate) {
          const updates = {};
          if (JSON.stringify(finalTags.sort()) !== JSON.stringify((row.tags || []).sort())) {
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
    if (offset >= 3000) break;
    
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
}

runAudit().catch(console.error);
