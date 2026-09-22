import fs from 'fs';
import { cleanFilenameTitle } from './tagger-rules.mjs';

const SUPABASE_URL = 'https://xahchsuffmskbgvnxcgs.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_QprT-ekIg6xv77IwL9p81g_GR5-tdiy';
const H = { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + SUPABASE_ANON_KEY, 'Content-Type': 'application/json' };
const DRY = process.argv.includes('--dry');

function titleFromFilename(fname) {
  const cleaned = cleanFilenameTitle(fname);
  if (/^(untitled|image|thumbnail)/i.test(cleaned) || cleaned.length < 5) {
    return cleaned.length >= 5 ? cleaned : 'Extension Capture';
  }
  return cleaned.slice(0, 120);
}

async function run() {
  const bucket = JSON.parse(fs.readFileSync('bucket_list.json', 'utf8'));
  // fresh DB urls
  let all = [];
  let from = 0;
  while (true) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/thumbnails?select=image_url&limit=1000&offset=${from}`, { headers: H });
    const j = await r.json();
    all.push(...j);
    if (j.length < 1000) break;
    from += 1000;
  }
  const dbFiles = new Set(
    all.filter(x => (x.image_url || '').includes('/Thumbnails/'))
      .map(x => { try { return decodeURIComponent(x.image_url.split('/Thumbnails/')[1].split('?')[0]); } catch { return ''; } })
  );
  const orphans = bucket.filter(f => ![...dbFiles].some(d => d === f));
  console.log(`db rows: ${all.length}, bucket files: ${bucket.length}, orphans: ${orphans.length}`);

  if (DRY) {
    orphans.slice(0, 10).forEach(f => console.log(`- ${f.slice(0, 70)} => ${titleFromFilename(f).slice(0, 60)}`));
    return;
  }

  let ok = 0;
  for (const f of orphans) {
    const imageUrl = `${SUPABASE_URL}/storage/v1/object/public/Thumbnails/${encodeURIComponent(f)}`;
    const rec = {
      id: `thumb-orphan-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      title: titleFromFilename(f),
      creator: 'Extension Capture',
      image_url: imageUrl,
      source_url: imageUrl,
      niche: '',
      styles: ['Face Close-up', 'High-Contrast Glow'],
      tags: [],
      colors: ['#401D1A', '#E4E0D3', '#FFFFFF'],
      ocr_text: '',
      emotion: 'Curious',
      breakdown_notes: 'Auto-created for storage file with no DB row; pending vision tagging.',
      views_estimate: '1M+',
      source: 'supabase-storage',
      likes_count: 0
    };
    const r = await fetch(`${SUPABASE_URL}/rest/v1/thumbnails`, {
      method: 'POST', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify(rec)
    });
    if (r.ok) { ok++; console.log(`+ ${f.slice(0, 60)}`); }
    else console.log(`FAIL ${f.slice(0, 60)} ${r.status}`);
    await new Promise(res => setTimeout(res, 150));
  }
  console.log(`inserted ${ok}/${orphans.length}`);
}

run().catch(e => { console.error('FATAL', e); process.exit(1); });
