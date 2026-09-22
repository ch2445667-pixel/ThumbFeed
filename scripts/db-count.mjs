const H = { apikey: 'sb_publishable_QprT-ekIg6xv77IwL9p81g_GR5-tdiy', Authorization: 'Bearer sb_publishable_QprT-ekIg6xv77IwL9p81g_GR5-tdiy' };
let n = 0, from = 0;
const urls = new Set();
while (true) {
  const r = await fetch('https://xahchsuffmskbgvnxcgs.supabase.co/rest/v1/thumbnails?select=image_url&limit=1000&offset=' + from, { headers: H });
  const j = await r.json();
  j.forEach(x => { urls.add((x.image_url || '').trim()); n++; });
  if (j.length < 1000) break;
  from += 1000;
}
console.log('db rows:', n, 'unique urls:', urls.size);
