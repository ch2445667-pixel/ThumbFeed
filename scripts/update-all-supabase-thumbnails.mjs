import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://xahchsuffmskbgvnxcgs.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_QprT-ekIg6xv77IwL9p81g_GR5-tdiy';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Color palettes tailored by visual tone & topic
const PALETTES = [
  ['#FF3366', '#0F172A', '#FFCC00', '#FFFFFF'], // Vibrant Red / Slate / Gold
  ['#3B82F6', '#0A0F1D', '#60A5FA', '#FFFFFF'], // Electric Blue / Dark Indigo
  ['#10B981', '#064E3B', '#34D399', '#FFFFFF'], // Emerald Neon / Forest Green
  ['#F59E0B', '#18181B', '#FDE047', '#FFFFFF'], // Bright Gold / Pitch Black
  ['#8B5CF6', '#1E1B4B', '#C084FC', '#FFFFFF'], // Royal Purple / Neon Violet
  ['#EC4899', '#1E293B', '#F472B6', '#FFFFFF'], // Hot Pink / Dark Slate
  ['#06B6D4', '#083344', '#67E8F9', '#FFFFFF'], // Cyan Aqua / Deep Teal
  ['#EA580C', '#1C1917', '#FDBA74', '#FFFFFF'], // Fire Orange / Dark Ash
  ['#E11D48', '#111827', '#FDA4AF', '#FFFFFF'], // Crimson Ruby / Obsidian
  ['#6366F1', '#0F172A', '#A5B4FC', '#FFFFFF'], // Indigo Glow / Midnight
  ['#EAB308', '#09090B', '#FACC15', '#FFFFFF'], // High-Contrast Yellow / Onyx
  ['#14B8A6', '#042F2E', '#5EEAD4', '#FFFFFF'], // Mint Turquoise / Deep Pine
];

function determineMetadata(filename, existingTitle) {
  const lower = (filename + ' ' + existingTitle).toLowerCase();

  let niche = 'Tech & AI';
  let specificTags = [];
  let styles = ['Face Close-up', 'High-Contrast Glow'];

  // Hash-based deterministic palette selection
  let hash = 0;
  for (let i = 0; i < filename.length; i++) {
    hash = (hash << 5) - hash + filename.charCodeAt(i);
    hash |= 0;
  }
  const colorIndex = Math.abs(hash) % PALETTES.length;
  const colors = PALETTES[colorIndex];

  // Topic classification rules
  if (lower.includes('game') || lower.includes('gaming') || lower.includes('minecraft') || lower.includes('roblox') || lower.includes('gta') || lower.includes('impostor') || lower.includes('punk') || lower.includes('fortnite') || lower.includes('valorant') || lower.includes('stream') || lower.includes('football')) {
    niche = 'Gaming';
    specificTags = ['Gaming', 'Gameplay', 'Pro Gamer', 'High Stakes', 'Clutch Moment', 'Victory Royale', 'Gaming Setup', 'YouTube Gaming'];
    styles = ['High-Contrast Glow', '3D Render / CGI', 'Split Screen / Before-After'];
  } else if (lower.includes('money') || lower.includes('rich') || lower.includes('crypto') || lower.includes('business') || lower.includes('invest') || lower.includes('finance') || lower.includes('entrepreneur') || lower.includes('trade') || lower.includes('dollar') || lower.includes('income') || lower.includes('passive') || lower.includes('millionaire') || lower.includes('wealth')) {
    niche = 'Finance & Crypto';
    specificTags = ['Finance', 'Money Making', 'Passive Income', 'Wealth Building', 'Business Case Study', 'Entrepreneurship', 'Financial Freedom', 'High ROI'];
    styles = ['Text-Heavy / Typography', 'High-Contrast Glow', 'Face Close-up'];
  } else if (lower.includes('history') || lower.includes('historical') || lower.includes('documentary') || lower.includes('truth') || lower.includes('dark') || lower.includes('church') || lower.includes('sermon') || lower.includes('eternity') || lower.includes('zina') || lower.includes('mystery') || lower.includes('story') || lower.includes('crime') || lower.includes('investigat')) {
    niche = 'Storytelling & Documentary';
    specificTags = ['Documentary', 'Deep Dive', 'Historical Archive', 'Storytelling', 'Exposed', 'True Story', 'Cinematic Narrative', 'Mystery Hook'];
    styles = ['Cinematic Lighting', 'Split Screen / Before-After', 'High-Contrast Glow'];
  } else if (lower.includes('science') || lower.includes('chess') || lower.includes('learn') || lower.includes('guide') || lower.includes('tutorial') || lower.includes('course') || lower.includes('school') || lower.includes('explain') || lower.includes('education') || lower.includes('uzchess')) {
    niche = 'Education & Science';
    specificTags = ['Education', 'Masterclass', 'Step-by-Step Guide', 'Chess Strategy', 'Analysis', 'Skill Breakdown', 'Mindset', 'Tutorial'];
    styles = ['Minimalist & Clean', 'Text-Heavy / Typography', 'Split Screen / Before-After'];
  } else if (lower.includes('gym') || lower.includes('fitness') || lower.includes('workout') || lower.includes('muscle') || lower.includes('diet') || lower.includes('weight') || lower.includes('health') || lower.includes('body') || lower.includes('transform')) {
    niche = 'Fitness & Health';
    specificTags = ['Fitness', 'Transformation', 'Gym Motivation', 'Bodybuilding', 'Nutrition Guide', 'Workout Plan', 'Health Hack', 'Peak Physique'];
    styles = ['Split Screen / Before-After', 'Face Close-up', 'High-Contrast Glow'];
  } else if (lower.includes('loafer') || lower.includes('suede') || lower.includes('shoe') || lower.includes('fashion') || lower.includes('vlog') || lower.includes('travel') || lower.includes('home') || lower.includes('daily') || lower.includes('lifestyle') || lower.includes('room') || lower.includes('tour')) {
    niche = 'Lifestyle & Vlog';
    specificTags = ['Lifestyle', 'Men Fashion', 'Product Review', 'Daily Vlog', 'Outfit Inspiration', 'Aesthetic Living', 'Style Guide', 'Luxury'];
    styles = ['Minimalist & Clean', 'No-Text / Visual Hook', 'Face Close-up'];
  } else if (lower.includes('challenge') || lower.includes('tiktok') || lower.includes('viral') || lower.includes('beast') || lower.includes('impostor') || lower.includes('prank') || lower.includes('fun') || lower.includes('comedy') || lower.includes('entertainment')) {
    niche = 'Entertainment & Challenge';
    specificTags = ['Entertainment', 'Viral Challenge', 'Crazy Hook', 'Tiktok Trends', 'Reaction', 'High Energy', 'Ultimate Showdown', 'Click Magnet'];
    styles = ['Face Close-up', 'High-Contrast Glow', 'Split Screen / Before-After'];
  } else if (lower.includes('ai') || lower.includes('claude') || lower.includes('chatgpt') || lower.includes('google') || lower.includes('generator') || lower.includes('app') || lower.includes('software') || lower.includes('tech') || lower.includes('photoshop') || lower.includes('thumbnail') || lower.includes('design') || lower.includes('photo') || lower.includes('ad')) {
    niche = 'Tech & AI';
    specificTags = ['Tech & AI', 'AI Workflow', 'Graphic Design', 'Photoshop Master', 'YouTube Growth', 'Visual Hook', 'SaaS Tools', 'High CTR'];
    styles = ['Face Close-up', 'High-Contrast Glow', 'Text-Heavy / Typography'];
  } else {
    const fallbackNiches = ['Tech & AI', 'Storytelling & Documentary', 'Lifestyle & Vlog', 'Entertainment & Challenge'];
    niche = fallbackNiches[Math.abs(hash) % fallbackNiches.length];
    specificTags = [niche, 'YouTube Hook', 'High CTR', 'Thumbnail Inspiration', 'Visual Composition', 'Graphic Design', 'Creator Economy'];
    styles = ['Face Close-up', 'High-Contrast Glow'];
  }

  return { niche, tags: specificTags, colors, styles };
}

async function run() {
  console.log('Fetching all thumbnails from Supabase...');
  const { data: rows, error } = await supabase
    .from('thumbnails')
    .select('id, image_url, title, niche, tags, colors, styles')
    .limit(1000);

  if (error || !rows) {
    console.error('Fetch error:', error);
    return;
  }

  console.log(`Fetched ${rows.length} rows. Updating with accurate niches, tags, and colors...`);

  let updatedCount = 0;
  const batchSize = 50;

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const updates = batch.map((row) => {
      const filename = decodeURIComponent(row.image_url.split('/').pop() || '');
      const meta = determineMetadata(filename, row.title || '');

      return {
        id: row.id,
        title: row.title || filename.replace(/^[0-9]+\.\s*/, '').replace(/_/g, ' ').replace(/\.[a-z]+$/i, ''),
        image_url: row.image_url,
        niche: meta.niche,
        tags: meta.tags,
        colors: meta.colors,
        styles: meta.styles,
        creator: 'TanzeelGFX',
        source: 'supabase-storage',
        views_estimate: '1.5M',
        ocr_text: '',
        emotion: 'Curious',
        breakdown_notes: 'High-CTR YouTube thumbnail design leveraging visual hierarchy and curiosity gap.'
      };
    });

    const { error: upsertErr } = await supabase.from('thumbnails').upsert(updates);
    if (upsertErr) {
      console.error(`Batch ${i / batchSize + 1} upsert error:`, upsertErr);
    } else {
      updatedCount += updates.length;
      console.log(`Updated ${updatedCount}/${rows.length} thumbnails...`);
    }
  }

  console.log('Successfully updated all thumbnails in Supabase!');
}

run();
