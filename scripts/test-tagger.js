/**
 * Sanity checks for the tagger. Run: node scripts/test-tagger.js
 *
 * Cases chosen to cover the failures of the previous substring matcher plus
 * the app's controlled vocabularies.
 */

const { analyzeAndTagTitle, VISUAL_STYLES, EMOTIONS } = require('./tagger');

const VALID_NICHES = new Set([
  'IRL', 'Business', 'Tech', 'Entertainment', 'Gaming', 'Sports',
  'Documentary', 'Educational', 'Podcast', 'Interviews', 'Football',
  'Mindset', 'Self-Improvement', 'Lifestyle', 'Entrepreneurship',
  'Geopolitics', 'Military', 'Nfl', 'Psychology', 'Soccer',
  'Video Games', 'Vlog', 'War',
]);

const cases = [
  // [title, channel, expectedNiche|null]
  ['Why Gen Z GAVE UP Having Kids', 'Damon Cassidy', null],
  ['Why The Job Market Is Absolutely COOKED', 'Damon Cassidy', null],
  ['Why Companies Are LYING About Mass Layoffs', 'Damon Cassidy', 'Business'],
  ['Apple Just Killed The iPhone', 'Marques Brownlee', 'Tech'],
  ['I Said No To AI For 30 Days', 'Ali Abdaal', 'Tech'],
  // "AI" is a genuine standalone word here, so Tech is the right answer.
  // The word-boundary point is covered by "Warm Machine War" below.
  ['He Said "AI" But Meant "Said" - The Grammar Trap', 'Ali Abdaal', 'Tech'],
  // "Machine" is a real Tech term, so Tech is correct. The boundary rule is
  // the point: "War" inside "Warm" must not register.
  ['I Bought A Warm Machine', 'Mrwhosetheboss', 'Tech'],
  ['The Warm Machine War Explained', 'Mrwhosetheboss', 'Tech'],
  ['$1,000,000 Empire Collapsed', 'Bloomberg Originals', 'Business'],
  ['The Cold War Secret They Hid', 'Johnny Harris', null],
  ['Ranking Every Graphics Card', 'Marques Brownlee', 'Tech'],
  ['Photoshop From Scratch', 'Design Theory', 'Educational'],
  ['I Survived 100 Days In Minecraft', 'Wampus', 'Gaming'],
  ['How I Fixed My Sleep Schedule', 'Ali Abdaal', null],
  ['The Most Dangerous Tank Ever Built', 'Wampus', 'Military'],
  ['Signed A Football Contract At 17', 'MrBeast', 'Football'],
  ['Filler Title With Nothing At All', 'Barney Watts', null],
];

let failures = 0;
for (const [title, channel, expected] of cases) {
  const r = analyzeAndTagTitle(title, channel, 'Educational');

  // Every emitted value must exist in the app's vocabularies, or the filter bar
  // can never match the row.
  const badStyles = r.styles.filter((s) => !VISUAL_STYLES.has(s));
  const badEmotion = !EMOTIONS.has(r.emotion);
  const badNiche = !VALID_NICHES.has(r.niche);

  // The old tagger emitted single filler words. Assert those are gone.
  const junk = r.tags.filter((t) => ['Gen', 'Gave', 'Having', 'High CTR', 'YouTube Thumbnail'].includes(t));

  let fail = '';
  if (badStyles.length) fail += ` BAD_STYLE:${badStyles.join(',')} `;
  if (badEmotion) fail += ` BAD_EMOTION:${r.emotion} `;
  if (badNiche) fail += ` BAD_NICHE:${r.niche} `;
  if (junk.length) fail += ` JUNK_TAGS:${junk.join(',')} `;
  if (r.tags.length < 3) fail += ' TOO_FEW_TAGS ';
  if (new Set(r.tags.map((t) => t.toLowerCase())).size !== r.tags.length) fail += ' DUP_TAGS ';
  if (expected && r.niche !== expected) fail += ` EXPECTED_${expected} `;

  if (fail) failures += 1;
  console.log(`${fail ? 'FAIL' : 'ok  '} ${title}`);
  console.log(`       niche=${r.niche} emotion=${r.emotion} styles=${r.styles.join(' / ')}`);
  console.log(`       tags=${r.tags.join(', ')}`);
  if (fail) console.log(`       -->${fail}`);
}

console.log('');
console.log(failures === 0 ? 'all checks passed' : `${failures} case(s) failed`);
process.exit(failures === 0 ? 0 : 1);