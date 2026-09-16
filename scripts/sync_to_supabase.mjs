import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SUPABASE_URL = "https://xahchsuffmskbgvnxcgs.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_QprT-ekIg6xv77IwL9p81g_GR5-tdiy";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function syncToSupabase() {
  const mockDataPath = path.join(__dirname, "..", "src", "lib", "mockData.ts");
  const raw = fs.readFileSync(mockDataPath, 'utf-8');
  
  // Extract JSON array from file
  const jsonMatch = raw.match(/INITIAL_THUMBNAILS:\s*ThumbnailItem\[\]\s*=\s*(\[[\s\S]*?\]);/);
  if (!jsonMatch) {
    console.error("Could not parse thumbnails from mockData.ts");
    return;
  }

  const thumbnails = JSON.parse(jsonMatch[1]);
  console.log(`🚀 Uploading ${thumbnails.length} thumbnails in bulk to your live Supabase database...`);

  const formatted = thumbnails.map(t => ({
    id: t.id,
    title: t.title,
    creator: t.creator || 'TanzeelGFX',
    image_url: t.imageUrl,
    source_url: t.sourceUrl || '',
    niche: t.niche,
    styles: t.styles || [],
    tags: t.tags || [],
    colors: t.colors || [],
    ocr_text: t.ocrText || '',
    emotion: t.emotion || 'Curious',
    breakdown_notes: t.breakdownNotes || '',
    views_estimate: t.viewsEstimate || '1M+',
    source: t.source || 'pinterest',
    likes_count: t.likesCount || 100
  }));

  // Batch insert in chunks of 50
  for (let i = 0; i < formatted.length; i += 50) {
    const chunk = formatted.slice(i, i + 50);
    const { error } = await supabase.from('thumbnails').upsert(chunk, { onConflict: 'id' });
    if (error) {
      console.error('❌ Supabase Upload Error:', error.message);
      console.log('💡 Note: Make sure you ran the SQL Schema in your Supabase SQL Editor.');
      return;
    }
  }

  console.log(`🎉 SUCCESS! All ${thumbnails.length} thumbnails have been uploaded into your Supabase PostgreSQL database!`);
}

syncToSupabase();
