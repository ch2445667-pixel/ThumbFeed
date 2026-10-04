import { NextRequest, NextResponse } from 'next/server';
import { deleteStorageObjects, getAnonClient, hasServiceRoleKey } from '../../../../lib/supabaseServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BUCKET = 'Thumbnails';

/**
 * Turn a public/storage image URL into the bucket-relative object path.
 * Handles the nested `posters/` prefix so posters are not missed.
 */
function storagePathFromUrl(imageUrl: string): string {
  if (!imageUrl || typeof imageUrl !== 'string') return '';

  const marker = '/storage/v1/object/public/';
  const publicIdx = imageUrl.indexOf(marker);
  if (publicIdx >= 0) {
    const rest = imageUrl.slice(publicIdx + marker.length);
    const slash = rest.indexOf('/');
    if (slash < 0) return '';
    // Strip the bucket name, keep any subfolder.
    const afterBucket = rest.slice(slash + 1);
    return decodeURIComponent(afterBucket.split('?')[0]);
  }

  const bucketMarker = `/${BUCKET}/`;
  const idx = imageUrl.indexOf(bucketMarker);
  if (idx >= 0) {
    return decodeURIComponent(imageUrl.slice(idx + bucketMarker.length).split('?')[0]);
  }

  return '';
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, imageUrl } = body;

    if (!id && !imageUrl) {
      return NextResponse.json({ error: 'Thumbnail ID or imageUrl is required' }, { status: 400 });
    }

    const client = getAnonClient();
    const errors: string[] = [];

    // 1. Remove the database record. The publishable key is sufficient here.
    let dbDeleted = false;
    try {
      if (id) {
        const { error } = await client.from('thumbnails').delete().eq('id', id);
        if (error) errors.push(`DB delete by id: ${error.message}`);
        else dbDeleted = true;
      }
      if (imageUrl) {
        const { error } = await client.from('thumbnails').delete().eq('image_url', imageUrl);
        if (error) errors.push(`DB delete by imageUrl: ${error.message}`);
        else dbDeleted = true;
      }
    } catch (dbErr) {
      errors.push(`DB error: ${dbErr instanceof Error ? dbErr.message : String(dbErr)}`);
    }

    // 2. Remove the stored object. Requires the service role key; without it
    //    this is skipped and reported as such instead of faking success.
    let storageDeleted = false;
    let storageSkipped = false;
    let storageReason: string | undefined;

    if (imageUrl) {
      const path = storagePathFromUrl(imageUrl);
      if (!path) {
        storageSkipped = true;
        storageReason = 'image is not a Supabase Storage object';
      } else {
        const result = await deleteStorageObjects(BUCKET, [path]);
        storageDeleted = result.deleted;
        storageSkipped = result.skipped;
        storageReason = result.reason;
        if (result.reason) errors.push(`Storage: ${result.reason}`);
      }
    } else {
      storageSkipped = true;
      storageReason = 'no imageUrl supplied, so no storage object to remove';
    }

    return NextResponse.json({
      success: true,
      id,
      imageUrl,
      dbDeleted,
      storageDeleted,
      storageSkipped,
      storageReason,
      permanent: dbDeleted && storageDeleted,
      canDeleteStorageObjects: hasServiceRoleKey(),
      warnings: errors.length > 0 ? errors : undefined,
      message:
        dbDeleted && storageDeleted
          ? 'Deleted from database and storage'
          : dbDeleted
            ? 'Deleted from database only; the stored file remains in the bucket'
            : 'Delete incomplete',
    });
  } catch (err: any) {
    console.error('Delete thumbnail error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}