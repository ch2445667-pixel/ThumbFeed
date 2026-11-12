import { NextRequest, NextResponse } from 'next/server';
import { isR2Configured, deleteFromR2, extractR2KeyFromUrl } from '../../../../lib/r2';
import { db } from '../../../../lib/firebase';
import { doc, deleteDoc } from 'firebase/firestore';
import { deleteGalleryItem, invalidateGalleryCache } from '../../../../lib/galleryService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, imageUrl, r2Key: explicitR2Key } = body;

    if (!id && !imageUrl && !explicitR2Key) {
      return NextResponse.json({ error: 'Thumbnail ID or imageUrl is required' }, { status: 400 });
    }

    const errors: string[] = [];
    const r2Key = explicitR2Key || (imageUrl ? extractR2KeyFromUrl(imageUrl) : null);

    // 1. Delete from authoritative local file and Cloudflare R2 catalog & objects
    let galleryDeleted = false;
    let storageDeleted = false;
    try {
      const result = await deleteGalleryItem(id, imageUrl, r2Key || undefined);
      galleryDeleted = result.success;
      if (result.storageDeleted) {
        storageDeleted = true;
      }
    } catch (gErr) {
      errors.push(`Gallery delete error: ${gErr instanceof Error ? gErr.message : String(gErr)}`);
    }

    // 2. Extra guarantee: directly delete the R2 object and small variant if key is known
    if (r2Key && isR2Configured()) {
      try {
        const deleted = await deleteFromR2(r2Key);
        if (deleted) storageDeleted = true;
        // Delete webp small preview variant
        const base = r2Key.replace(/\.[^/.]+$/, '');
        await deleteFromR2(`small/${base}.webp`).catch(() => {});
        await deleteFromR2(`small/${r2Key}`).catch(() => {});
      } catch (r2Err) {
        errors.push(`R2 direct delete error: ${r2Err instanceof Error ? r2Err.message : String(r2Err)}`);
      }
    }

    // 3. Remove document from Firestore database if present
    let dbDeleted = false;
    try {
      if (db && id) {
        await deleteDoc(doc(db, 'thumbnails', id));
        dbDeleted = true;
      }
    } catch (dbErr) {
      errors.push(`DB error: ${dbErr instanceof Error ? dbErr.message : String(dbErr)}`);
    }

    invalidateGalleryCache();

    return NextResponse.json({
      success: true,
      id,
      imageUrl,
      galleryDeleted,
      storageDeleted,
      dbDeleted,
      permanent: true,
      canDeleteStorageObjects: isR2Configured(),
      warnings: errors.length > 0 ? errors : undefined,
      message: storageDeleted
        ? 'Thumbnail permanently deleted from feed and Cloudflare R2 storage'
        : 'Thumbnail removed from feed',
    });
  } catch (err: unknown) {
    console.error('Delete thumbnail error:', err);
    return NextResponse.json({ error: (err as any)?.message || 'Internal Server Error' }, { status: 500 });
  }
}