import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xahchsuffmskbgvnxcgs.supabase.co';
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_QprT-ekIg6xv77IwL9p81g_GR5-tdiy';
    const supabase = createClient(supabaseUrl, supabaseKey);

    const posters: any[] = [];
    const seenUrls = new Set<string>();

    // 1. Fetch posters from thumbnails table in Supabase
    try {
      const { data: dbData, error: dbErr } = await supabase
        .from('thumbnails')
        .select('*')
        .or('id.ilike.poster-%,breakdown_notes.ilike.%poster%,niche.eq.Cinema,source.eq.poster')
        .order('created_at', { ascending: false })
        .limit(500);

      if (!dbErr && dbData && dbData.length > 0) {
        dbData.forEach((row: any) => {
          if (!seenUrls.has(row.image_url)) {
            seenUrls.add(row.image_url);
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
              colors: row.colors || [],
              ocrText: row.ocr_text || '',
              emotion: row.emotion || 'Curious',
              breakdownNotes: row.breakdown_notes || 'Uploaded movie poster.',
              source: 'supabase-storage',
              createdAt: row.created_at || new Date().toISOString(),
              likesCount: row.likes_count || 120
            });
          }
        });
      }
    } catch (dbErr) {
      console.warn('DB posters error:', dbErr);
    }

    // 2. Fetch posters from Storage buckets ('posters', 'Posters', 'Thumbnails')
    for (const bName of ['posters', 'Posters', 'Thumbnails']) {
      try {
        const { data: files } = await supabase.storage.from(bName).list('', { limit: 200 });
        if (files && files.length > 0) {
          files.forEach((file) => {
            if (file.name && !file.name.startsWith('.')) {
              const isPosterFile = bName.toLowerCase().includes('poster') ||
                                   file.name.toLowerCase().includes('poster') ||
                                   file.name.toLowerCase().includes('movie');
              if (isPosterFile) {
                const { data: pubData } = supabase.storage.from(bName).getPublicUrl(file.name);
                const url = pubData?.publicUrl || `${supabaseUrl}/storage/v1/object/public/${bName}/${encodeURIComponent(file.name)}`;
                if (!seenUrls.has(url)) {
                  seenUrls.add(url);
                  const cleanTitle = file.name.replace(/\.[^/.]+$/, '').replace(/^[0-9]+[.\s_-]*/, '').replace(/[_-]+/g, ' ').trim();
                  posters.push({
                    id: `poster-storage-${bName}-${encodeURIComponent(file.name)}`,
                    kind: 'poster',
                    title: cleanTitle || 'Movie Poster',
                    creator: 'Cinema',
                    imageUrl: url,
                    sourceUrl: url,
                    niche: 'Cinema',
                    styles: [],
                    tags: ['Movie Poster', 'Cinema'],
                    colors: [],
                    ocrText: '',
                    source: 'supabase-storage',
                    createdAt: file.created_at || new Date().toISOString(),
                    likesCount: 150
                  });
                }
              }
            }
          });
        }

        if (bName === 'Thumbnails') {
          const { data: subfiles } = await supabase.storage.from('Thumbnails').list('posters', { limit: 200 });
          if (subfiles && subfiles.length > 0) {
            subfiles.forEach((file) => {
              if (file.name && !file.name.startsWith('.')) {
                const filePath = `posters/${file.name}`;
                const { data: pubData } = supabase.storage.from('Thumbnails').getPublicUrl(filePath);
                const url = pubData?.publicUrl || `${supabaseUrl}/storage/v1/object/public/Thumbnails/${encodeURIComponent(filePath)}`;
                if (!seenUrls.has(url)) {
                  seenUrls.add(url);
                  const cleanTitle = file.name.replace(/\.[^/.]+$/, '').replace(/^[0-9]+[.\s_-]*/, '').replace(/[_-]+/g, ' ').trim();
                  posters.push({
                    id: `poster-storage-sub-${encodeURIComponent(file.name)}`,
                    kind: 'poster',
                    title: cleanTitle || 'Movie Poster',
                    creator: 'Cinema',
                    imageUrl: url,
                    sourceUrl: url,
                    niche: 'Cinema',
                    styles: [],
                    tags: ['Movie Poster', 'Cinema'],
                    colors: [],
                    ocrText: '',
                    source: 'supabase-storage',
                    createdAt: file.created_at || new Date().toISOString(),
                    likesCount: 150
                  });
                }
              }
            });
          }
        }
      } catch (storageErr) {
        console.warn(`Storage list ${bName} error:`, storageErr);
      }
    }

    return NextResponse.json({
      success: true,
      count: posters.length,
      posters
    });
  } catch (err: any) {
    console.error('Posters sync error:', err);
    return NextResponse.json({ error: err.message || 'Failed to sync posters' }, { status: 500 });
  }
}
