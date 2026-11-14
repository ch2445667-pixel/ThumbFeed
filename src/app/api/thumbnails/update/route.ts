import { NextRequest, NextResponse } from 'next/server';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../../../lib/firestore';
import { updateGalleryItemMetadata } from '../../../../lib/galleryService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const id = typeof body?.id === 'string' ? body.id.trim() : undefined;
    const imageUrl = typeof body?.imageUrl === 'string' ? body.imageUrl.trim() : undefined;
    const hasTitle = typeof body?.title === 'string';
    const hasCreator = typeof body?.creator === 'string';
    const hasViews = typeof body?.viewsEstimate === 'string';

    const title = hasTitle ? body.title.trim().slice(0, 180) : undefined;
    const creator = hasCreator ? body.creator.trim().slice(0, 100) : undefined;
    const viewsEstimate = hasViews ? body.viewsEstimate.trim().slice(0, 40) : undefined;

    if ((!id && !imageUrl) || (!hasTitle && !hasCreator && !hasViews)) {
      return NextResponse.json(
        { error: 'Valid id or imageUrl and at least one metadata field are required' },
        { status: 400 }
      );
    }

    if (hasTitle && !title) {
      return NextResponse.json(
        { error: 'Title cannot be empty' },
        { status: 400 }
      );
    }

    const updated = await updateGalleryItemMetadata(
      { id, imageUrl },
      { title, creator, viewsEstimate }
    );
    if (!updated) {
      return NextResponse.json({ error: 'Thumbnail not found' }, { status: 404 });
    }

    if (db && updated.id) {
      setDoc(
        doc(db, 'thumbnails', updated.id),
        {
          id: updated.id,
          title: updated.title,
          imageUrl: updated.imageUrl,
          creator: updated.creator || '',
          viewsEstimate: updated.viewsEstimate || '',
        },
        { merge: true }
      ).catch(() => {});
    }

    return NextResponse.json({ success: true, item: updated });
  } catch (err: unknown) {
    console.error('Update thumbnail metadata error:', err);
    return NextResponse.json({ error: 'Failed to update thumbnail' }, { status: 500 });
  }
}
