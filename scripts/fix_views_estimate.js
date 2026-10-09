/**
 * Repair pass: collapse the doubled "views" token that older extractor output
 * produced (e.g. "19M views views" -> "19M views").
 *
 * Idempotent -- safe to run repeatedly, and safe once the extractor fix is in.
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xahchsuffmskbgvnxcgs.supabase.co';
const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'sb_publishable_QprT-ekIg6xv77IwL9p81g_GR5-tdiy';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

function normalizeViews(value) {
  if (!value || typeof value !== 'string') return value;
  let out = value.trim();
  // "views views", "view views", repeated any number of times.
  out = out.replace(/\b(views?)\b(\s+\1\b)+/gi, '$1');
  // A leading duplicate such as "views 19M views".
  out = out.replace(/^views?\s+(?=.*\bviews?\b)/i, '');
  return out.trim();
}

async function main() {
  const PAGE = 1000;
  let scanned = 0;
  let fixed = 0;

  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase
      .from('thumbnails')
      .select('id,views_estimate')
      .order('id', { ascending: true })
      .range(offset, offset + PAGE - 1);
    if (error) throw new Error(`Read failed: ${error.message}`);
    const batch = data || [];
    for (const row of batch) {
      scanned++;
      const raw = row.views_estimate;
      const normalized = normalizeViews(raw);
      if (normalized && normalized !== raw) {
        const { error: updErr } = await supabase
          .from('thumbnails')
          .update({ views_estimate: normalized })
          .eq('id', row.id);
        if (updErr) {
          console.warn(`[WARN] ${row.id}: ${updErr.message}`);
        } else {
          fixed++;
          if (fixed <= 10) console.log(`[FIX] ${row.id}: "${raw}" -> "${normalized}"`);
        }
      }
    }
    if (batch.length < PAGE) break;
  }

  console.log(`\nScanned ${scanned} rows, repaired ${fixed} views_estimate values.`);
}

main().catch((err) => {
  console.error('Repair failed:', err);
  process.exit(1);
});
