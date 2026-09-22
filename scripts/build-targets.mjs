import fs from 'fs';
import { isGenericTitle } from './tagger-rules.mjs';

const H = { apikey: 'sb_publishable_QprT-ekIg6xv77IwL9p81g_GR5-tdiy', Authorization: 'Bearer sb_publishable_QprT-ekIg6xv77IwL9p81g_GR5-tdiy' };
const URL = 'https://xahchsuffmskbgvnxcgs.supabase.co';

let all = [];
let from = 0;
while (true) {
  const r = await fetch(`${URL}/rest/v1/thumbnails?select=id,title,image_url,tags&order=id.asc&limit=1000&offset=${from}`, { headers: H });
  if (!r.ok) throw new Error('fetch ' + r.status);
  const j = await r.json();
  all.push(...j);
  if (j.length < 1000) break;
  from += 1000;
}
console.log('total rows:', all.length);
// Untitled/generic (never had a real title) OR auto-fallback titles from the earlier text bulk pass ("Niche Thumbnail – ...")
const targets = all.filter(x => isGenericTitle(x.title, x.image_url) || /Thumbnail – /.test(x.title || ''));
console.log('generic/missing-title rows:', targets.length);
const yt = targets.filter(x => (x.image_url || '').includes('ytimg.com')).length;
const stor = targets.filter(x => (x.image_url || '').includes('/Thumbnails/')).length;
console.log(`of those: ytimg=${yt} storage=${stor} other=${targets.length - yt - stor}`);
const freq = {};
targets.forEach(x => { const t = (x.title || '').trim() || '(empty)'; freq[t] = (freq[t] || 0) + 1; });
console.log('top generic titles:', Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 8));
fs.writeFileSync('vision_targets.json', JSON.stringify(targets.map(x => x.id)));
console.log('wrote vision_targets.json');
