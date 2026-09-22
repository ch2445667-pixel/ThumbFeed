const URL = 'https://xahchsuffmskbgvnxcgs.supabase.co';
const KEY = 'sb_publishable_QprT-ekIg6xv77IwL9p81g_GR5-tdiy';
let all = [];
let offset = 0;
while (true) {
  const r = await fetch(URL + '/storage/v1/object/list/Thumbnails', {
    method: 'POST',
    headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prefix: '', limit: 1000, offset })
  });
  if (!r.ok) { console.log('ERR', r.status, (await r.text()).slice(0, 300)); break; }
  const j = await r.json();
  console.log('batch', offset, j.length);
  all.push(...j);
  if (j.length < 1000) break;
  offset += 1000;
}
console.log('TOTAL bucket objects:', all.length);
const imgs = all.filter(f => f.name && /\.(jpg|jpeg|png|webp|gif)$/i.test(f.name));
console.log('image files:', imgs.length);
import fs from 'fs';
fs.writeFileSync('bucket_list.json', JSON.stringify(all.map(f => f.name)));
