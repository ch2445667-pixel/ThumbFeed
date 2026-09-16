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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, imageUrl } = body;

    if (!id && !imageUrl) {
      return NextResponse.json({ error: 'Thumbnail ID or imageUrl is required' }, { status: 400 });
    }

    const client = getSupabase();
    let dbDeleted = false;
    let storageDeleted = false;
    const errors: string[] = [];

    // 1. Delete from Supabase PostgreSQL table 'thumbnails'
    try {
      if (id) {
        const { error: err1 } = await client.from('thumbnails').delete().eq('id', id);
        if (err1) {
          errors.push(`DB delete by id: ${err1.message}`);
        } else {
          dbDeleted = true;
        }
      }

      if (imageUrl) {
        const { error: err2 } = await client.from('thumbnails').delete().eq('image_url', imageUrl);
        if (err2) {
          errors.push(`DB delete by imageUrl: ${err2.message}`);
        } else {
          dbDeleted = true;
        }
      }
    } catch (dbErr: any) {
      errors.push(`DB error: ${dbErr?.message || String(dbErr)}`);
    }

    // 2. If stored in Supabase Storage 'Thumbnails' bucket, delete the file from the bucket
    if (imageUrl && typeof imageUrl === 'string') {
      try {
        let filename = '';
        if (imageUrl.includes('/Thumbnails/')) {
          const parts = imageUrl.split('/Thumbnails/');
          if (parts[1]) {
            filename = decodeURIComponent(parts[1].split('?')[0]);
          }
        } else if (imageUrl.includes('supabase.co')) {
          const lastPart = imageUrl.split('/').pop()?.split('?')[0];
          if (lastPart) filename = decodeURIComponent(lastPart);
        }

        if (filename) {
          const { error: storageErr } = await client.storage
            .from('Thumbnails')
            .remove([filename]);

          if (storageErr) {
            errors.push(`Storage remove: ${storageErr.message}`);
          } else {
            storageDeleted = true;
          }
        }
      } catch (storageException: any) {
        errors.push(`Storage error: ${storageException?.message || String(storageException)}`);
      }
    }

    return NextResponse.json({
      success: true,
      id,
      imageUrl,
      dbDeleted,
      storageDeleted,
      warnings: errors.length > 0 ? errors : undefined,
      message: 'Thumbnail permanently deleted from database and storage'
    });
  } catch (err: any) {
    console.error('Delete thumbnail error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
