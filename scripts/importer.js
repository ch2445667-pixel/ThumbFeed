const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const sharp = require('sharp');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xahchsuffmskbgvnxcgs.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_QprT-ekIg6xv77IwL9p81g_GR5-tdiy';
const client = createClient(supabaseUrl, supabaseKey);

// High-precision Title Analyzer & Auto-Tagger
function analyzeAndTagTitle(title, channelName = '', defaultNiche = 'Tech') {
  const cleanTitle = (title || '').trim();
  const lower = (cleanTitle + ' ' + channelName).toLowerCase();

  let niche = defaultNiche;
  let emotion = 'Curious';
  const styles = [];

  // Determine Niche
  if (
    lower.includes('documentary') || lower.includes('investigation') || lower.includes('downfall') ||
    lower.includes('secret') || lower.includes('truth about') || lower.includes('geopolitic') ||
    lower.includes('history') || lower.includes('conspiracy') || lower.includes('scandal') ||
    lower.includes('war') || lower.includes('empire') || lower.includes('uncovered') ||
    lower.includes('dark reality') || lower.includes('untold') || lower.includes('inside the')
  ) {
    niche = 'Documentary';
    emotion = 'Mysterious';
  } else if (
    lower.includes('money') || lower.includes('business') || lower.includes('million') ||
    lower.includes('invest') || lower.includes('finance') || lower.includes('marketing') ||
    lower.includes('startup') || lower.includes('saas') || lower.includes('sales') ||
    lower.includes('crypto') || lower.includes('real estate') || lower.includes('dollar') ||
    lower.includes('wealth') || lower.includes('ceo') || lower.includes('agency') ||
    lower.includes('client') || lower.includes('ecommerce') || lower.includes('side hustle') ||
    lower.includes('profitable') || lower.includes('revenue') || lower.includes('billion')
  ) {
    niche = 'Business';
    emotion = 'Confident';
  } else if (
    lower.includes('design') || lower.includes('photoshop') || lower.includes('tutorial') ||
    lower.includes('how to') || lower.includes('science') || lower.includes('physics') ||
    lower.includes('math') || lower.includes('learn') || lower.includes('guide') ||
    lower.includes('explained') || lower.includes('analysis') || lower.includes('theory') ||
    lower.includes('art') || lower.includes('lesson') || lower.includes('course') ||
    lower.includes('masterclass') || lower.includes('step by step') || lower.includes('tips')
  ) {
    niche = 'Educational';
    emotion = 'Curious';
  } else if (
    lower.includes('mrbeast') || lower.includes('challenge') || lower.includes('survive') ||
    lower.includes('prank') || lower.includes('comedy') || lower.includes('100 days') ||
    lower.includes('trapped') || lower.includes('escaped') || lower.includes('$1 vs') ||
    lower.includes('viral') || lower.includes('insane') || lower.includes('extreme') ||
    lower.includes('spent 24') || lower.includes('world record') || lower.includes('stunt')
  ) {
    niche = 'Entertainment';
    emotion = 'Shocked';
  } else if (
    lower.includes('game') || lower.includes('gaming') || lower.includes('minecraft') ||
    lower.includes('roblox') || lower.includes('gta') || lower.includes('gameplay') ||
    lower.includes('playstation') || lower.includes('xbox') || lower.includes('nintendo') ||
    lower.includes('speedrun') || lower.includes('streamer') || lower.includes('hardcore')
  ) {
    niche = 'Gaming';
    emotion = 'Intense';
  } else if (
    lower.includes('gym') || lower.includes('workout') || lower.includes('fitness') ||
    lower.includes('muscle') || lower.includes('physique') || lower.includes('bodybuilding') ||
    lower.includes('sports') || lower.includes('athlete') || lower.includes('football') ||
    lower.includes('soccer') || lower.includes('diet') || lower.includes('exercise')
  ) {
    niche = 'Sports';
    emotion = 'Intense';
  } else if (
    lower.includes('vlog') || lower.includes('day in the life') || lower.includes('routine') ||
    lower.includes('lifestyle') || lower.includes('travel') || lower.includes('living in') ||
    lower.includes('moving to') || lower.includes('apartment tour') || lower.includes('house tour')
  ) {
    niche = 'IRL';
    emotion = 'Happy';
  } else if (
    lower.includes('ai') || lower.includes('tech') || lower.includes('apple') ||
    lower.includes('iphone') || lower.includes('macbook') || lower.includes('gadget') ||
    lower.includes('software') || lower.includes('hardware') || lower.includes('camera') ||
    lower.includes('phone') || lower.includes('review') || lower.includes('laptop') ||
    lower.includes('coding') || lower.includes('developer') || lower.includes('setup')
  ) {
    niche = 'Tech';
    emotion = 'Curious';
  }

  // Styles detection
  if (lower.includes('vs') || lower.includes('versus') || lower.includes('compared') || lower.includes('difference')) {
    styles.push('Split Screen');
  }
  if (lower.includes('why') || lower.includes('how') || lower.includes('secret') || lower.includes('revealed')) {
    styles.push('High-Contrast Glow');
  }
  if (lower.includes('review') || lower.includes('unboxing') || lower.includes('first look')) {
    styles.push('Product Focus');
  }
  if (lower.includes('interview') || lower.includes('podcast') || lower.includes('talks') || lower.includes('ceo')) {
    styles.push('Face Close-up');
  }
  if (styles.length === 0) {
    styles.push('Bold Typography', 'High-Contrast Glow');
  } else if (styles.length === 1) {
    styles.push('Bold Typography');
  }

  // Keywords extraction
  const words = cleanTitle
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !['the', 'and', 'for', 'with', 'from', 'this', 'that', 'your', 'have', 'what', 'they', 'will', 'when', 'about', 'how', 'why', 'are', 'you'].includes(w.toLowerCase()));

  const tagSet = new Set();
  tagSet.add(niche);
  if (channelName) tagSet.add(channelName);

  // Entities detection
  if (lower.includes('apple')) tagSet.add('Apple');
  if (lower.includes('iphone')) tagSet.add('iPhone');
  if (lower.includes('macbook') || lower.includes('mac')) tagSet.add('Mac');
  if (lower.includes('ai') || lower.includes('artificial intelligence') || lower.includes('chatgpt') || lower.includes('gemini') || lower.includes('claude')) tagSet.add('AI');
  if (lower.includes('photoshop')) tagSet.add('Photoshop');
  if (lower.includes('marketing')) tagSet.add('Marketing');
  if (lower.includes('money') || lower.includes('wealth')) tagSet.add('Wealth');
  if (lower.includes('podcast')) tagSet.add('Podcast');
  if (lower.includes('challenge')) tagSet.add('Challenge');
  if (lower.includes('review')) tagSet.add('Review');
  if (lower.includes('tutorial')) tagSet.add('Tutorial');
  if (lower.includes('science') || lower.includes('physics')) tagSet.add('Science');
  if (lower.includes('investing') || lower.includes('stocks')) tagSet.add('Investing');

  for (const w of words) {
    if (tagSet.size >= 7) break;
    const capitalized = w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    tagSet.add(capitalized);
  }

  tagSet.add('High CTR');
  tagSet.add('YouTube Thumbnail');

  const tags = Array.from(tagSet).slice(0, 8);
  const breakdownNotes = `Auto-tagged for "${cleanTitle}". Features high CTR ${niche} visual framing with ${styles.join(' and ')}.`;

  return {
    niche,
    tags,
    styles,
    emotion,
    breakdownNotes
  };
}

module.exports = {
  analyzeAndTagTitle,
  client
};
