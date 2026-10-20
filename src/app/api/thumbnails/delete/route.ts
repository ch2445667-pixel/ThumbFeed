import { NextRequest, NextResponse } from 'next/server';
import {
  deleteStorageObjects,
  getAnonClient,
  getServiceRoleClient,
  hasServiceRoleKey,
} from '../../../../lib/supabaseServer';
import { internalError, rateLimit, requireAdmin } from '../../../../lib/apiSecurity';

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
    const limited = rateLimit(req, { key: 'thumbnails-delete', limit: 120, windowMs: 60_000 });
    if (limited) return limited;

    const body = await req.json().catch(() => ({}));
    const id = typeof body?.id === 'string' ? body.id.trim() : '';
    const imageUrl = typeof body?.imageUrl === 'string' ? body.imageUrl.trim() : '';

    if (!id && !imageUrl) {
      return NextResponse.json({ error: 'Thumbnail ID or imageUrl is required' }, { status: 400 });
    }
    if ((id && id.length > 200) || (imageUrl && imageUrl.length > 2000)) {
      return NextResponse.json({ error: 'Invalid thumbnail reference' }, { status: 400 });
    }

    // Deleting is owner-only. This route previously had no check at all: an id
    // was enough for anyone to erase a thumbnail and its stored file.
    const denied = await requireAdmin(
      req,
      typeof body?.idToken === 'string' ? body.idToken : ''
    );
    if (denied) return denied;

    // Prefer the service role, which bypasses row-level security and is
    // required once anonymous writes are withdrawn. Falling back to the
    // publishable key keeps an environment without the key working exactly as
    // it does today rather than breaking deletes outright.
    const client = getServiceRoleClient() ?? getAnonClient();
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
  } catch (err) {
    return internalError('Delete thumbnail error', err);
  }
}