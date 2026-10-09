/**
 * Probe candidate handles for channels whose handle in the import list 404s.
 *
 * Usage: node scripts/probe_handles.js
 *
 * Prints, per dead channel, the first candidate handle that resolves AND
 * actually yields long-form videos (a 200 on /videos can still parse to zero).
 */

const { fetchDirectChannelVideos } = require('./extractor');

// channel -> candidate handles to try, most likely first.
const CANDIDATES = {
  tomscott: ['TomScottGo', 'TomScott', 'thetomscott'],
  EmmyMadeInJapan: ['EmmyMakesFood', 'EmmyMadeInJapan2', 'EmmyMadeinJapan'],
  RobertoBlake2: ['RobertoBlake', 'BlakeAyres', 'BlakeATC', 'robertoblake'],
  JCSCriminalPsychology: ['JCS', 'CriminalPsychology', 'JCSCriminalPsych'],
  LikeNastyaVlog: ['LikeNastya', 'LikeNastyaOfficial', 'LikeNastyaVlogs'],
  HumphreyYang: ['HumphreyTalks', 'HumphreyYangFinance'],
  SamKolder: ['SamKolder', 'SamKolderGo', 'samkolder'],
  PaddyGalloway: ['PaddyGalloway1', 'paddyg', 'PaddyGalloway2'],
  NatGeoWild: ['NatGeoWild1', 'natgeo'],
  BraveWilderness: ['BraveWilderness1', 'bravewilderness'],
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const resolved = {};
  for (const [channel, handles] of Object.entries(CANDIDATES)) {
    for (const handle of handles) {
      const url = `https://www.youtube.com/@${handle}`;
      try {
        const videos = await fetchDirectChannelVideos(url, 30);
        const n = (videos || []).length;
        console.log(`${channel.padEnd(24)} @${handle.padEnd(22)} -> ${n} videos  ${n > 0 ? 'OK' : 'EMPTY'}`);
        if (n > 0) {
          resolved[channel] = url;
          console.log(`  sample: ${videos[0].title.slice(0, 60)}`);
          break;
        }
      } catch (err) {
        console.log(`${channel.padEnd(24)} @${handle.padEnd(22)} -> FAIL ${err.message.slice(0, 60)}`);
      }
      await sleep(400);
    }
  }
  console.log('\n=== RESOLVED ===');
  console.log(JSON.stringify(resolved, null, 2));
})();