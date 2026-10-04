import { NextResponse } from 'next/server';
import { getAnonClient } from '../../../../lib/supabaseServer';
import { parseDimensions } from '../../../../lib/dimensions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Poster sync.
 *
 * The `thumbnails` table is the single source of truth. Uploads write the row
 * and the file together, so the row always exists for a live poster and never
 * exists for a deleted one.
 *
 * This route previously ALSO scanned the storage bucket (bucket roots plus the
 * `posters/` subfolder, matching any filename containing "poster" or "movie").
 * Because the publishable key cannot delete objects, every deleted poster left
 * an orphaned file behind and that scan resurrected it on the next sync. It
 * also misclassified ordinary thumbnails such as "1050. YouTube_thumbnail_
 * poster_Design.jpg" as movie posters.
 *
 * Scanning storage is therefore gone. Deleting a poster deletes its row, and a
 * row that does not exist can never come back.
 */
export async function GET() {
  try {
    const supabase = getAnonClient();

    // Wildcards must be `*`, not `%`: PostgREST 500s on a `%` inside an
    // ilike pattern, which silently emptied this branch before.
    const { data, error } = await supabase
      .from('thumbnails')
      .select('*')
      .or('id.ilike.poster-*,breakdown_notes.ilike.*poster*,niche.eq.Cinema,source.eq.poster,image_url.ilike.*/posters/*')
      .order('created_at', { ascending: false })
      .limit(1000);

    if (error) {
      console.warn('Poster sync DB error:', error.message);
      return NextResponse.json(
        { success: false, count: 0, posters: [], error: error.message },
        { status: 200 }
      );
    }

    const seenUrls = new Set<string>();
    const posters: any[] = [];

    (data || []).forEach((row: any) => {
      if (!row.image_url || seenUrls.has(row.image_url)) return;
      seenUrls.add(row.image_url);
      const dims = parseDimensions(row.breakdown_notes);
      posters.push({
        id: row.id.startsWith('poster-') ? row.id : `poster-${row.id}`,
        kind: 'poster',
        title: row.title || 'Movie Poster',
        creator: row.creator && row.creator !== 'YouTube Creator' ? row.creator : 'Cinema',
        imageUrl: row.image_url,
        sourceUrl: row.source_url || row.image_url,
        niche: row.niche || 'Cinema',
        styles: row.styles || [],
        tags: Array.isArray(row.tags) && row.tags.length > 0 ? row.tags : ['Movie Poster', 'Cinema'],
        colors: Array.isArray(row.colors) ? row.colors : [],
        width: dims?.width,
        height: dims?.height,
        ocrText: row.ocr_text || '',
        emotion: row.emotion || 'Curious',
        breakdownNotes: row.breakdown_notes || 'Uploaded movie poster.',
        source: 'supabase-storage',
        createdAt: row.created_at || new Date().toISOString(),
        likesCount: row.likes_count || 120,
      });
    });

    return NextResponse.json({ success: true, count: posters.length, posters });
  } catch (err: any) {
    console.error('Posters sync error:', err);
    return NextResponse.json({ error: err.message || 'Failed to sync posters' }, { status: 500 });
  }
}