/**
 * Audit the LLM-assigned categories against the spec taxonomy.
 *
 *   node scripts/tag_audit.js
 *
 * Reports how many distinct categories exist, how many fall outside the
 * approved taxonomy, and how much tag mass sits outside it -- which is what
 * determines whether the filter list stays usable.
 */

const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, 'tagging');

const SPEC = new Set([
  // pre-existing filter categories
  'IRL','Business','Tech','Entertainment','Gaming','Sports','Documentary',
  'Educational','Podcast','Interviews','Football','Mindset','Self-Improvement',
  'Lifestyle','Entrepreneurship','Geopolitics','Military','Nfl','Psychology',
  'Soccer','Video Games','Vlog','War',
  // additions authorised for this pass
  'Food','Cooking','Cars','Automotive','Aviation','Engineering','Design',
  'Music','Beauty','Fashion','Science','Space','Nature','Animals','True Crime',
  'Mystery','History','Geography','Travel','News','Politics','Art','Animation',
  'Photography','Software','Hardware','AI','Cybersecurity','Crypto',
  'Real Estate','Investing','Economy','Sales','Marketing','Career',
  'Productivity','Study','Language','Fitness','Workout','Nutrition',
  'Mental Health','Family','Kids','Comedy','Challenge','Interview',
  'News Commentary','Consumer','Fashion Design','Home','DIY','Survival',
  'Esports','Tabletop','Movie Review','E-commerce','Language Learning',
]);

const files = fs.readdirSync(DIR).filter((n) => /^tags_\d+\.json$/.test(n));

let rows = [];
for (const f of files) {
  const raw = fs.readFileSync(path.join(DIR, f), 'utf-8').replace(/^\uFEFF/, '');
  rows = rows.concat(JSON.parse(raw));
}

const counts = new Map();
for (const r of rows) {
  for (const c of r.categories || []) counts.set(c, (counts.get(c) || 0) + 1);
}

const off = [...counts.entries()].filter(([c]) => !SPEC.has(c)).sort((a, b) => b[1] - a[1]);
const offMass = off.reduce((a, [, n]) => a + n, 0);
const totalMass = [...counts.values()].reduce((a, b) => a + b, 0);
const once = off.filter(([, n]) => n === 1);

console.log(`files: ${files.length}   rows: ${rows.length}`);
console.log(`distinct categories: ${counts.size}`);
console.log(`in taxonomy: ${counts.size - off.length}   OUTSIDE taxonomy: ${off.length}`);
console.log(`tag slots outside taxonomy: ${offMass} / ${totalMass} (${((offMass / totalMass) * 100).toFixed(1)}%)`);
console.log(`out-of-taxonomy names used exactly once: ${once.length}\n`);
console.log('most common out-of-taxonomy names:');
off.slice(0, 30).forEach(([c, n]) => console.log(`  ${String(n).padStart(4)}  ${c}`));
console.log('\nsample of one-off names (first 40):');
once.slice(0, 40).forEach(([c]) => console.log(`  ${c}`));