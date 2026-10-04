import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Server-only Supabase clients.
 *
 * The publishable/anon key cannot delete objects from Storage — Supabase
 * rejects it with 403 AccessDenied no matter what the app asks for. True
 * permanent deletion therefore needs the service role key, which must only
 * ever be used inside an API route.
 *
 * With SUPABASE_SERVICE_ROLE_KEY set, privileged operations (storage delete)
 * use it. Without it, those operations report honestly that they were skipped
 * instead of silently reporting success.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xahchsuffmskbgvnxcgs.supabase.co';
const publishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_QprT-ekIg6xv77IwL9p81g_GR5-tdiy';

let privilegedClient: SupabaseClient | null | undefined;

/**
 * Next patches the global fetch with a cache. supabase-js uses fetch
 * internally, so a query can be served from that cache and return stale rows,
 * making a delete appear not to have happened. Forcing no-store on the
 * underlying fetch is the only reliable fix.
 */
const noCacheFetch = (input: RequestInfo | URL, init?: RequestInit) =>
  fetch(input, { ...init, cache: 'no-store' });

/** Service role client, or null when the key is not configured. */
export function getServiceRoleClient(): SupabaseClient | null {
  if (privilegedClient !== undefined) return privilegedClient;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    privilegedClient = null;
    return privilegedClient;
  }
  privilegedClient = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: noCacheFetch },
  });
  return privilegedClient;
}

export function hasServiceRoleKey(): boolean {
  return getServiceRoleClient() !== null;
}

let anonClient: SupabaseClient | null = null;

/** Publishable-key client for read paths that legitimately work without elevation. */
export function getAnonClient(): SupabaseClient {
  if (!anonClient) {
    anonClient = createClient(url, publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: noCacheFetch },
    });
  }
  return anonClient;
}

/**
 * Remove one or more objects from a storage bucket and confirm they are gone.
 *
 * Returns whether the objects are actually absent. Supabase's delete endpoint
 * answers 200 with an empty list when RLS blocks it, so a 2xx alone proves
 * nothing and is verified with a HEAD request against the public URL.
 */
export async function deleteStorageObjects(
  bucket: string,
  paths: string[]
): Promise<{ deleted: boolean; skipped: boolean; reason?: string }> {
  const client = getServiceRoleClient();
  if (!client) {
    return { deleted: false, skipped: true, reason: 'SUPABASE_SERVICE_ROLE_KEY is not configured' };
  }

  const usable = paths.filter((p) => typeof p === 'string' && p.trim().length > 0);
  if (usable.length === 0) {
    return { deleted: false, skipped: true, reason: 'no storage path could be derived from the image URL' };
  }

  const { error } = await client.storage.from(bucket).remove(usable);
  if (error) {
    return { deleted: false, skipped: false, reason: error.message };
  }

  // Verify rather than trust the 2xx.
  for (const path of usable) {
    const check = await fetch(
      `${url}/storage/v1/object/public/${bucket}/${path.split('/').map(encodeURIComponent).join('/')}`,
      { method: 'HEAD', cache: 'no-store' }
    );
    if (check.status === 200) {
      return { deleted: false, skipped: false, reason: `object still present after delete: ${path}` };
    }
  }

  return { deleted: true, skipped: false };
}