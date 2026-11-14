import { NextRequest, NextResponse } from 'next/server';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../../../lib/firestore';
import { updateGalleryItemTitle } from '../../../../lib/galleryService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const id = typeof body?.id === 'string' ? body.id.trim() : undefined;
    const imageUrl = typeof body?.imageUrl === 'string' ? body.imageUrl.trim() : undefined;
    const title = typeof body?.title === 'string' ? body.title.trim().slice(0, 180) : '';

    if ((!id && !imageUrl) || !title) {
      return NextResponse.json(
        { error: 'Valid id or imageUrl and non-empty title are required' },
        { status: 400 }
      );
    }

    const updated = await updateGalleryItemTitle({ id, imageUrl }, title);
    if (!updated) {
      return NextResponse.json({ error: 'Thumbnail not found' }, { status: 404 });
    }

    if (db && updated.id) {
      setDoc(doc(db, 'thumbnails', updated.id), { title: updated.title }, { merge: true }).catch(() => {});
    }

    return NextResponse.json({ success: true, item: updated });
  } catch (err: unknown) {
    console.error('Update thumbnail title error:', err);
    return NextResponse.json({ error: 'Failed to update thumbnail' }, { status: 500 });
  }
}
