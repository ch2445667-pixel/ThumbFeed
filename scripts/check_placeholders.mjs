import { writeFileSync } from 'fs';

const SUPABASE_URL = 'https://xahchsuffmskbgvnxcgs.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_QprT-ekIg6xv77IwL9p81g_GR5-tdiy';

async function checkPlaceholders() {
  let offset = 0;
  const batchSize = 500;
  let totalRows = 0;
  let placeholderCount = 0;
  const placeholders = [];
  
  while (true) {
    const res = await fetch(SUPABASE_URL + '/rest/v1/thumbnails?select=id,title&limit=' + batchSize + '&offset=' + offset, {
      headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY }
    });
    
    if (!res.ok) break;
    
    const data = await res.json();
    if (data.length === 0) break;
    
    totalRows += data.length;
    
    for (const row of data) {
      const t = (row.title || '').trim().toLowerCase();
      if (!t || t.length < 3 || 
          /^(image|untitled|thumbnail|youtube thumbnail|high ctr|curated|professional|eye catching|design|home [0-9]|img_|untitled design)/i.test(t)) {
        placeholderCount++;
        if (placeholders.length < 20) {
          placeholders.push({ id: row.id, title: row.title });
        }
      }
    }
    
    offset += batchSize;
  }
  
  console.log('Total rows:', totalRows);
  console.log('Placeholder titles remaining:', placeholderCount);
  if (placeholders.length > 0) {
    console.log('Sample placeholders:', JSON.stringify(placeholders, null, 2));
  }
}

checkPlaceholders().catch(console.error);
