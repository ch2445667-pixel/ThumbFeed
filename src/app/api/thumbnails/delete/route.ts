import { NextRequest, NextResponse } from 'next/server';
import { isR2Configured, deleteFromR2, extractR2KeyFromUrl } from '../../../../lib/r2';
import { db } from '../../../../lib/firebase';
import { doc, deleteDoc } from 'firebase/firestore';
import { invalidateGalleryCache } from '../../../../lib/galleryService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, imageUrl } = body;

    if (!id && !imageUrl) {
      return NextResponse.json({ error: 'Thumbnail ID or imageUrl is required' }, { status: 400 });
    }

    const errors: string[] = [];

    // 1. Remove the document from Firestore database
    let dbDeleted = false;
    try {
      if (db && id) {
        await deleteDoc(doc(db, 'thumbnails', id));
        dbDeleted = true;
      }
    } catch (dbErr) {
      errors.push(`DB error: ${dbErr instanceof Error ? dbErr.message : String(dbErr)}`);
    }

    // 2. Remove the stored object from Cloudflare R2
    let storageDeleted = false;
    let storageSkipped = false;
    let storageReason: string | undefined;

    if (imageUrl) {
      const r2Key = extractR2KeyFromUrl(imageUrl);
      if (r2Key && isR2Configured()) {
        try {
          await deleteFromR2(r2Key);
          storageDeleted = true;
          // Also try deleting small variant if it exists
          try {
            const smallKey = `small/${r2Key.replace(/\.[^/.]+$/, '')}.webp`;
            await deleteFromR2(smallKey);
          } catch {
            // Ignore if small variant wasn't generated or already gone
          }
        } catch (r2Err) {
          storageReason = r2Err instanceof Error ? r2Err.message : String(r2Err);
          errors.push(`R2 delete error: ${storageReason}`);
        }
      } else {
        storageSkipped = true;
        storageReason = 'Image is not a Cloudflare R2 object or R2 is unconfigured';
      }
    } else {
      storageSkipped = true;
      storageReason = 'No imageUrl supplied, so no storage object to remove';
    }

    invalidateGalleryCache();

    return NextResponse.json({
      success: true,
      id,
      imageUrl,
      dbDeleted,
      storageDeleted,
      storageSkipped,
      storageReason,
      permanent: dbDeleted && storageDeleted,
      canDeleteStorageObjects: isR2Configured(),
      warnings: errors.length > 0 ? errors : undefined,
      message:
        dbDeleted && storageDeleted
          ? 'Deleted from database and Cloudflare R2 storage'
          : dbDeleted
            ? 'Deleted from database'
            : 'Delete completed',
    });
  } catch (err: unknown) {
    console.error('Delete thumbnail error:', err);
    return NextResponse.json({ error: (err as any)?.message || 'Internal Server Error' }, { status: 500 });
  }
}