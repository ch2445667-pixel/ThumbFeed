import { NextRequest, NextResponse } from 'next/server';
import { getAnonClient, getServiceRoleClient } from '../../../../lib/supabaseServer';
import { internalError, rateLimit, requireAdmin } from '../../../../lib/apiSecurity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Single write path for thumbnails.
 *
 * The browser used to upsert directly with the publishable key, which meant the
 * public key could write to the table from anywhere -- not just from this app.
 * Sending edits and imports through one owner-only route lets the database
 * refuse anonymous writes entirely (see supabase/migrations).
 */

const MAX_ITEMS = 100;

function text(value: unknown, max: number): string | undefined {
  return typeof value === 'string' ? value.slice(0, max) : undefined;
}

function stringList(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string').slice(0, max);
}

function cleanRecord(raw: unknown, includeColors: boolean): Record<string, unknown> | null {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Record<string, unknown>;

  const id = text(item.id, 200)?.trim();
  const imageUrl = text(item.imageUrl, 2000)?.trim();
  if (!id || !imageUrl) return null;

  const record: Record<string, unknown> = {
    id,
    title: text(item.title, 500)?.trim() || 'Untitled Thumbnail',
    creator: text(item.creator, 200)?.trim() || 'Curated',
    image_url: imageUrl,
    source_url: text(item.sourceUrl, 2000) || null,
    niche: text(item.niche, 80)?.trim() || 'Entertainment',
    tags: stringList(item.tags, 20),
    ocr_text: text(item.ocrText, 5000) || '',
    emotion: text(item.emotion, 80) || 'Curious',
    breakdown_notes: text(item.breakdownNotes, 5000) || '',
    views_estimate: text(item.viewsEstimate, 80) || '',
    source: text(item.source, 80) || 'curated',
    likes_count: Number.isFinite(Number(item.likesCount)) ? Number(item.likesCount) : 0,
  };

  // Colours are normally extracted server-side from the image bytes. Only
  // include them when the caller explicitly owns that value, otherwise an
  // upsert would overwrite the better server-derived palette with an empty one.
  if (includeColors) record.colors = stringList(item.colors, 20);

  return record;
}

export async function POST(req: NextRequest) {
  try {
    const limited = rateLimit(req, { key: 'thumbnails-save', limit: 60, windowMs: 60_000 });
    if (limited) return limited;

    const body = await req.json();
    const rawItems: unknown[] = Array.isArray(body?.items)
      ? body.items
      : body?.item
        ? [body.item]
        : [];

    if (rawItems.length === 0) {
      return NextResponse.json({ error: 'Nothing to save' }, { status: 400 });
    }
    if (rawItems.length > MAX_ITEMS) {
      return NextResponse.json(
        { error: `Too many items at once (maximum ${MAX_ITEMS}).` },
        { status: 413 }
      );
    }

    // Saving writes gallery rows. Owner only.
    const denied = await requireAdmin(
      req,
      typeof body?.idToken === 'string' ? body.idToken : ''
    );
    if (denied) return denied;

    const records = rawItems
      .map((raw: unknown) => cleanRecord(raw, Boolean(body?.includeColors)))
      .filter((record): record is Record<string, unknown> => record !== null);

    if (records.length === 0) {
      return NextResponse.json({ error: 'No valid items to save' }, { status: 400 });
    }

    // Prefer the service role so the database can stop accepting anonymous
    // writes; fall back to the publishable key on a host without the key so
    // today's behaviour keeps working.
    const client = getServiceRoleClient() ?? getAnonClient();
    const { error } = await client.from('thumbnails').upsert(records, { onConflict: 'id' });

    if (error) {
      console.error('Thumbnail save error:', error.message);
      return NextResponse.json({ error: 'Could not save to the gallery.' }, { status: 500 });
    }

    return NextResponse.json({ saved: records.length });
  } catch (err) {
    return internalError('Thumbnail save handler', err);
  }
}
