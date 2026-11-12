import { NextResponse } from 'next/server';
import { getAllGalleryItems } from '../../../../lib/galleryService';
import { INITIAL_POSTERS } from '../../../../lib/posters';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const items = await getAllGalleryItems();
    const posters = [
      ...INITIAL_POSTERS,
      ...items.filter((item) => item.kind === 'poster' || item.niche === 'Cinema')
    ];

    return NextResponse.json({ success: true, count: posters.length, posters });
  } catch (err: unknown) {
    console.error('Posters sync error:', err);
    return NextResponse.json({ error: 'Failed to sync posters' }, { status: 500 });
  }
}