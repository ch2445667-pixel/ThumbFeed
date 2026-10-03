import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

let supabaseClient: any = null;

function getSupabase(): any {
  if (!supabaseClient) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xahchsuffmskbgvnxcgs.supabase.co';
    const supabaseKey = 
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      'sb_publishable_QprT-ekIg6xv77IwL9p81g_GR5-tdiy';
    supabaseClient = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false }
    });
  }
  return supabaseClient;
}

interface UploadItemPayload {
  id?: string;
  kind?: 'thumbnail' | 'poster';
  videoId?: string;
  imageUrl: string;
  sourceUrl?: string;
  title: string;
  creator?: string;
  niche?: string;
  tags?: string[];
  styles?: string[];
  views?: string;
  viewsEstimate?: string;
  publishedTime?: string;
}

function sanitizeFilename(title: string, videoId: string): string {
  const cleanTitle = title
    .replace(/[^a-zA-Z0-9_\-\s]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 40);

  const randSuffix = Math.random().toString(36).slice(2, 7);
  if (cleanTitle) {
    return `${cleanTitle}_${videoId}_${randSuffix}.jpg`;
  }
  return `thumb_${videoId}_${randSuffix}.jpg`;
}

async function fetchImageBuffer(imageUrl: string, videoId?: string): Promise<{ buffer: Buffer; contentType: string } | null> {
  if (imageUrl.startsWith('data:image/')) {
    const matches = imageUrl.match(/^data:(image\/[a-zA-Z0-9\+\-\.]+);base64,(.+)$/);
    if (matches) {
      const contentType = matches[1];
      const buffer = Buffer.from(matches[2], 'base64');
      return { buffer, contentType };
    }
  }

  const urlsToTry = [imageUrl];
  if (videoId) {
    urlsToTry.push(`https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`);
    urlsToTry.push(`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`);
  }

  for (const url of urlsToTry) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      if (res.ok) {
        const arrayBuffer = await res.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        if (buffer.length > 2000 || url.includes('hqdefault')) {
          const contentType = res.headers.get('content-type') || 'image/jpeg';
          return { buffer, contentType };
        }
      }
    } catch {
      // try next
    }
  }

  return null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const items: UploadItemPayload[] = Array.isArray(body.items) ? body.items : [body];

    if (items.length === 0) {
      return NextResponse.json({ error: 'No items to upload' }, { status: 400 });
    }

    const uploadedResults: any[] = [];

    for (const item of items) {
      const isPoster = item.kind === 'poster' || item.id?.startsWith('poster-') || item.niche === 'Cinema';
      const vId = item.videoId || item.id?.replace(/^.*-/, '') || (isPoster ? 'poster' : 'thumb');
      const cleanTitle = (item.title || (isPoster ? 'poster' : 'thumb'))
        .replace(/[^a-zA-Z0-9_\-\s]/g, '')
        .trim()
        .replace(/\s+/g, '_')
        .slice(0, 40) || (isPoster ? 'poster' : 'thumb');
      const randSuffix = Math.random().toString(36).slice(2, 7);

      // Store posters under the 'posters/' directory inside the Supabase Storage 'Thumbnails' bucket
      const storagePath = isPoster
        ? `posters/poster_${Date.now()}_${cleanTitle}_${randSuffix}.jpg`
        : sanitizeFilename(item.title || 'Thumbnail', vId);

      let finalPublicUrl = item.imageUrl;
      let uploadSuccess = false;

      try {
        const imageResult = await fetchImageBuffer(item.imageUrl, item.videoId);

        if (imageResult) {
          // Posters use a clean black matte; thumbnails use the brand espresso
          const matteColor = isPoster ? '#000000' : '#401D1A';
          let optimizedJpgBuffer: Buffer = imageResult.buffer;
          try {
            optimizedJpgBuffer = await sharp(imageResult.buffer)
              .flatten({ background: matteColor })
              .jpeg({ quality: 90, mozjpeg: true })
              .toBuffer();
          } catch (sharpErr) {
            console.warn('Sharp JPEG conversion warning:', sharpErr);
          }

          // Upload JPEG to Supabase Storage bucket 'Thumbnails' under posters/ or root
          const client = getSupabase();
          const { error: uploadError } = await client.storage
            .from('Thumbnails')
            .upload(storagePath, optimizedJpgBuffer, {
              contentType: 'image/jpeg',
              upsert: true
            });

          if (!uploadError) {
            const { data: pubData } = client.storage.from('Thumbnails').getPublicUrl(storagePath);
            const supabaseBase = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xahchsuffmskbgvnxcgs.supabase.co';
            finalPublicUrl = pubData?.publicUrl || `${supabaseBase}/storage/v1/object/public/Thumbnails/${storagePath}`;
            uploadSuccess = true;
          } else {
            console.warn('Supabase storage upload note:', uploadError.message);
          }
        }
      } catch (err) {
        console.warn('Image fetch or upload note:', err);
      }

      // Upsert record into Supabase database table 'thumbnails'
      const assignedId = isPoster
        ? (item.id && item.id.startsWith('poster-') ? item.id : `poster-${Date.now()}-${randSuffix}`)
        : (item.id || (item.videoId ? `thumb-yt-${item.videoId}` : `thumb-storage-${vId}`));

      try {
        const viewsValue = item.views || item.viewsEstimate || null;
        const notes = isPoster ? 'Uploaded movie poster.' : (item.publishedTime ? `Published: ${item.publishedTime}` : '');
        const record = {
          id: assignedId,
          title: item.title || (isPoster ? 'Movie Poster' : 'Thumbnail'),
          creator: item.creator || (isPoster ? 'Cinema' : 'YouTube Creator'),
          image_url: finalPublicUrl,
          source_url: item.sourceUrl || finalPublicUrl,
          niche: isPoster ? 'Cinema' : (item.niche || ''),
          styles: item.styles || [],
          tags: item.tags && item.tags.length > 0 ? item.tags : (isPoster ? ['Movie Poster', 'Cinema'] : (item.niche ? [item.niche] : [])),
          views_estimate: viewsValue,
          breakdown_notes: notes,
          source: isPoster ? 'poster' : 'supabase-storage',
          created_at: new Date().toISOString()
        };

        const { error: upsertErr } = await getSupabase().from('thumbnails').upsert(record);
        if (upsertErr) {
          console.warn('Supabase DB upsert warning:', upsertErr.message);
        }
      } catch (dbErr) {
        console.warn('Supabase DB upsert note:', dbErr);
      }

      uploadedResults.push({
        id: assignedId,
        kind: isPoster ? 'poster' : 'thumbnail',
        videoId: item.videoId,
        title: item.title || (isPoster ? 'Movie Poster' : 'Thumbnail'),
        creator: item.creator || (isPoster ? 'Cinema' : 'YouTube Creator'),
        imageUrl: finalPublicUrl,
        sourceUrl: item.sourceUrl || finalPublicUrl,
        niche: isPoster ? 'Cinema' : (item.niche || ''),
        tags: item.tags && item.tags.length > 0 ? item.tags : (isPoster ? ['Movie Poster', 'Cinema'] : []),
        views: item.views || item.viewsEstimate,
        publishedTime: item.publishedTime,
        source: isPoster ? 'poster' : 'supabase-storage',
        uploadedToBucket: uploadSuccess
      });
    }

    return NextResponse.json({
      success: true,
      bucket: 'Thumbnails',
      count: uploadedResults.length,
      items: uploadedResults
    });

  } catch (err: any) {
    console.error('Supabase upload handler error:', err);
    return NextResponse.json({ error: err.message || 'Upload failed' }, { status: 500 });
  }
}
