import { NextRequest, NextResponse } from 'next/server';
import { deleteStorageObjects, getServiceRoleClient, hasServiceRoleKey } from '../../../../lib/supabaseServer';
import firebaseConfig from '../../../../../firebase-applet-config.json';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BUCKET = 'Thumbnails';

/** Kept in sync with ADMIN_EMAIL in lib/authContext. */
const ADMIN_EMAIL = 'shivashiva66407@gmail.com';

/** PostgREST caps a response at max-rows; page rather than trusting one read. */
const PAGE = 1000;

function storagePathFromUrl(imageUrl: string): string {
  if (!imageUrl || typeof imageUrl !== 'string') return '';
  const marker = '/storage/v1/object/public/';
  const publicIdx = imageUrl.indexOf(marker);
  if (publicIdx >= 0) {
    const rest = imageUrl.slice(publicIdx + marker.length);
    const slash = rest.indexOf('/');
    if (slash < 0) return '';
    return decodeURIComponent(rest.slice(slash + 1).split('?')[0]);
  }
  const bucketMarker = `/${BUCKET}/`;
  const idx = imageUrl.indexOf(bucketMarker);
  if (idx >= 0) return decodeURIComponent(imageUrl.slice(idx + bucketMarker.length).split('?')[0]);
  return '';
}

/**
 * Server half of the local-development unlock in lib/authContext.
 *
 * On localhost the client grants admin through a synthetic LOCAL_DEV_USER,
 * because Google sign-in refuses unauthorized origins and the project never
 * listed localhost. That fake user cannot mint a Firebase ID token, so the
 * admin check below would reject every delete on a dev machine even though the
 * UI happily offers the button -- the two halves disagreed about what "admin"
 * means and bulk delete simply never worked locally.
 *
 * This mirrors the client's conditions exactly and fails closed:
 *   - NODE_ENV === 'development'  (false in any `next build` output)
 *   - the request arrived on a loopback host
 * A deployed build satisfies neither, so production keeps the real token check.
 *
 * The host header is attacker-controlled, so this is not a security boundary
 * on its own -- it never needs to be. The dev server only listens on loopback
 * and is not reachable from outside the machine.
 */
function isLocalDevRequest(req: NextRequest): boolean {
  if (process.env.NODE_ENV !== 'development') return false;
  const host = (req.headers.get('host') || '').toLowerCase().split(',')[0].trim();
  return (
    host === 'localhost' ||
    host.startsWith('localhost:') ||
    host === '127.0.0.1' ||
    host.startsWith('127.0.0.1:') ||
    host === '[::1]' ||
    host.startsWith('[::1]:')
  );
}

/**
 * Verify the caller's Firebase ID token server-side.
 *
 * The single-thumbnail delete route has no auth check at all; adding one only to
 * this bulk route would leave the cheaper destructive path open, so this route
 * at least holds a real boundary: the token is checked against Google's
 * identity service and must belong to the admin account. The API key used here
 * is the public web config key, which ships in every client bundle anyway.
 *
 * Returns an error string on failure rather than throwing.
 */
async function verifyAdmin(idToken: string): Promise<string | null> {
  if (!idToken) return 'Sign in as the owner to delete a category.';
  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseConfig.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      }
    );
    if (!res.ok) return `Sign-in check failed (HTTP ${res.status}). Please sign in again.`;
    const data = await res.json();
    const email = data?.users?.[0]?.email || '';
    if (email.trim().toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
      return 'Only the owner can delete a category.';
    }
    return null;
  } catch (err) {
    return `Sign-in check could not run: ${err instanceof Error ? err.message : String(err)}`;
  }
}

/**
 * Delete every thumbnail carrying a category, then drop the category itself.
 *
 * "Drop the category" has no column of its own: a category is just a value that
 * appears in the tags array (or the niche column), so removing it means
 * stripping it from every row that still holds it rather than deleting a
 * dictionary row. A row left with no other category is removed outright,
 * since a thumbnail with nowhere to belong has no place in the library.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { category, idToken } = body || {};

    if (!category || typeof category !== 'string' || !category.trim()) {
      return NextResponse.json({ error: 'A category name is required' }, { status: 400 });
    }
    const name = category.trim();

    // On a dev machine the caller is the synthetic local-dev admin and holds
    // no real token, so the check is skipped there and only there.
    const authError = isLocalDevRequest(req) ? null : await verifyAdmin(idToken);
    if (authError) {
      return NextResponse.json({ error: authError }, { status: 403 });
    }

    // The service-role client is required to read and strip every row without
    // the publishable key's row limits. Without it we refuse rather than
    // half-delete.
    const client = getServiceRoleClient();
    if (!client) {
      return NextResponse.json(
        {
          error:
            'SUPABASE_SERVICE_ROLE_KEY is not configured, so a bulk delete cannot be done safely.',
        },
        { status: 501 }
      );
    }

    // 1. Collect every row that carries the category, in either the niche
    //    column or the tags array -- the same match the gallery filter uses.
    const rows: Array<{ id: string; tags: string[] | null; niche: string | null; image_url: string }> = [];
    for (let offset = 0; ; offset += PAGE) {
      const { data, error } = await client
        .from('thumbnails')
        .select('id,tags,niche,image_url')
        .or(`niche.eq.${name},tags.cs.{"${name}"}`)
        .range(offset, offset + PAGE - 1);
      if (error) {
        return NextResponse.json({ error: `Read failed: ${error.message}` }, { status: 500 });
      }
      rows.push(...((data as any[]) || []));
      if ((data || []).length < PAGE) break;
    }

    if (rows.length === 0) {
      return NextResponse.json({
        success: true,
        category: name,
        removed: 0,
        strippedFrom: 0,
        message: `No thumbnails carry "${name}".`,
      });
    }

    // 2. Decide per row: strip the tag, or drop the row entirely.
    //
    //    A row whose ONLY category is this one is removed, because a
    //    thumbnail with no category left has no place in the library. That is
    //    the destructive half of the request; a caller who wants to keep the
    //    images can strip the category instead.
    const toDelete: typeof rows = [];
    const toStrip: typeof rows = [];
    const matches = (t: string) => (t || '').trim().toLowerCase() === name.toLowerCase();
    for (const row of rows) {
      const tags = Array.isArray(row.tags) ? row.tags : [];
      const remaining = tags.filter((t) => !matches(t));
      // The niche only keeps the row alive when it holds a *different*
      // category. A niche equal to the deleted category is itself stripped
      // below (falling back to the first surviving tag), so it must not count
      // as a survivor -- otherwise a row whose sole category is this one ends
      // up tagless and nicheless, orphaned in the library instead of removed.
      const nicheKeepsRow = !!row.niche && !matches(row.niche);
      if (remaining.length === 0 && !nicheKeepsRow) {
        toDelete.push(row);
      } else {
        toStrip.push({ ...row, tags: remaining });
      }
    }

    // 3. Strip the category from rows that keep other tags.
    let stripped = 0;
    for (const row of toStrip) {
      const nextNiche = matches(row.niche || '') ? (row.tags?.[0] || '') : row.niche;
      const { error } = await client
        .from('thumbnails')
        .update({ tags: row.tags, niche: nextNiche })
        .eq('id', row.id);
      if (error) {
        return NextResponse.json(
          { error: `Stripping "${name}" from ${row.id} failed: ${error.message}` },
          { status: 500 }
        );
      }
      stripped++;
    }

    // 4. Remove the rows that had nothing else.
    let deleted = 0;
    let storageDeleted = 0;
    let storageSkipped = 0;
    const BATCH = 200;
    for (let i = 0; i < toDelete.length; i += BATCH) {
      const chunk = toDelete.slice(i, i + BATCH);
      const ids = chunk.map((r) => r.id);
      const { error } = await client.from('thumbnails').delete().in('id', ids);
      if (error) {
        return NextResponse.json(
          { error: `Deleting rows failed: ${error.message}` },
          { status: 500 }
        );
      }
      deleted += chunk.length;

      const paths = chunk
        .map((r) => storagePathFromUrl(r.image_url))
        .filter((p) => p.length > 0);
      if (paths.length) {
        const result = await deleteStorageObjects(BUCKET, paths);
        if (result.deleted) storageDeleted += paths.length;
        if (result.skipped) storageSkipped += paths.length;
      }
    }

    return NextResponse.json({
      success: true,
      category: name,
      matched: rows.length,
      removed: deleted,
      strippedFrom: stripped,
      storageDeleted,
      storageSkipped: storageSkipped > 0,
      canDeleteStorageObjects: hasServiceRoleKey(),
      message:
        deleted > 0
          ? `Removed ${deleted} thumbnail${deleted === 1 ? '' : 's'} that had no other category, and stripped "${name}" from ${stripped}.`
          : `Stripped "${name}" from ${stripped} thumbnail${stripped === 1 ? '' : 's'}.`,
    });
  } catch (err: any) {
    console.error('Delete category error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}