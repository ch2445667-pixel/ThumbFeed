import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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
  videoId?: string;
  imageUrl: string;
  title: string;
  creator?: string;
  niche?: string;
  tags?: string[];
  styles?: string[];
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
      const vId = item.videoId || item.id?.replace(/^.*-/, '') || 'thumb';
      const filename = sanitizeFilename(item.title || 'Thumbnail', vId);

      let finalPublicUrl = item.imageUrl;
      let uploadSuccess = false;

      try {
        const imageResult = await fetchImageBuffer(item.imageUrl, item.videoId);

        if (imageResult) {
          // Attempt upload to Supabase Storage bucket 'Thumbnails'
          const client = getSupabase();
          const { data: uploadData, error: uploadError } = await client.storage
            .from('Thumbnails')
            .upload(filename, imageResult.buffer, {
              contentType: imageResult.contentType || 'image/jpeg',
              upsert: true
            });

          if (!uploadError) {
            const { data: pubData } = client.storage.from('Thumbnails').getPublicUrl(filename);
            finalPublicUrl = pubData?.publicUrl || `${process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xahchsuffmskbgvnxcgs.supabase.co'}/storage/v1/object/public/Thumbnails/${encodeURIComponent(filename)}`;
            uploadSuccess = true;
          } else {
            console.warn('Supabase storage upload note:', uploadError.message);
          }
        }
      } catch (err) {
        console.warn('Image fetch or upload note:', err);
      }

      // Upsert record into Supabase database table 'thumbnails'
      try {
        const record = {
          id: item.id || `thumb-storage-${vId}`,
          title: item.title,
          creator: item.creator || 'YouTube Creator',
          image_url: finalPublicUrl,
          source_url: item.videoId ? `https://www.youtube.com/watch?v=${item.videoId}` : item.imageUrl,
          niche: item.niche || 'Tech & AI',
          styles: item.styles || ['Face Close-up', 'High-Contrast Glow'],
          tags: item.tags || ['YouTube', 'High CTR'],
          source: 'supabase-storage',
          created_at: new Date().toISOString()
        };

        await getSupabase().from('thumbnails').upsert(record);
      } catch (dbErr) {
        console.warn('Supabase DB upsert note:', dbErr);
      }

      uploadedResults.push({
        id: item.id || `thumb-storage-${vId}`,
        videoId: item.videoId,
        title: item.title,
        creator: item.creator,
        imageUrl: finalPublicUrl,
        sourceUrl: item.videoId ? `https://www.youtube.com/watch?v=${item.videoId}` : item.imageUrl,
        niche: item.niche,
        tags: item.tags,
        source: 'supabase-storage',
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
