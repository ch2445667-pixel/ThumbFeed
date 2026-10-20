import { NextRequest, NextResponse } from 'next/server';
import { lookup } from 'node:dns/promises';
import firebaseConfig from '../../firebase-applet-config.json';
import { ADMIN_EMAIL } from './admin';

/**
 * Shared guards for API routes.
 *
 * Every mutating route used to decide for itself whether to check the caller.
 * Only one of them did, so most of the destructive surface was reachable by
 * anyone who read the bundle. The helpers here are the single answer to
 * "may this request do that?".
 */

/**
 * Local-development unlock.
 *
 * Firebase refuses Google sign-in from origins that are not on the project's
 * Authorized domains list, and `localhost` is not on it. The client therefore
 * grants admin through a synthetic LOCAL_DEV_USER, which cannot mint a real ID
 * token. Both halves must agree, so this skips the token check only when the
 * build is a dev build AND the request arrived on a loopback host.
 *
 * The host header is attacker-controlled, so this is not a security boundary
 * by itself -- and it does not need to be: a deployed build never satisfies
 * NODE_ENV === 'development', and a dev server only listens locally.
 */
export function isLocalDevRequest(req: NextRequest): boolean {
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
 * Verify a Firebase ID token against Google's identity service and require
 * that it belongs to the owner account.
 *
 * Only the public web config key is used, which already ships in the client
 * bundle. Returns an error string on failure rather than throwing.
 */
export async function verifyAdminToken(idToken: string): Promise<string | null> {
  if (!idToken) return 'Sign in as the owner to do that.';
  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseConfig.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
        cache: 'no-store',
      }
    );
    if (!res.ok) return `Sign-in check failed (HTTP ${res.status}). Please sign in again.`;
    const data = await res.json();
    const email = String(data?.users?.[0]?.email || '');
    if (email.trim().toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
      return 'Only the owner can do that.';
    }
    return null;
  } catch (err) {
    return `Sign-in check could not run: ${err instanceof Error ? err.message : String(err)}`;
  }
}

/**
 * Returns a 403 response when the caller is not the owner, otherwise null.
 * Accepts the token from `Authorization: Bearer`, `x-admin-token`, or the
 * JSON body.
 */
export async function requireAdmin(
  req: NextRequest,
  bodyToken = ''
): Promise<NextResponse | null> {
  if (isLocalDevRequest(req)) return null;

  const header = req.headers.get('authorization') || '';
  const bearer = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
  const token = bearer || req.headers.get('x-admin-token') || bodyToken || '';
  const error = await verifyAdminToken(token);
  if (error) return NextResponse.json({ error }, { status: 403 });
  return null;
}

/**
 * Small in-memory rate limiter.
 *
 * Best effort: serverless instances do not share the map, so this slows down a
 * single abusive client rather than guaranteeing a global quota. That is still
 * worth having on routes that spend a metered YouTube key or open outbound
 * connections.
 */
type Bucket = { count: number; reset: number };
const buckets = new Map<string, Bucket>();

export function clientIp(req: NextRequest): string {
  const forwarded = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim();
  return forwarded || req.headers.get('x-real-ip') || 'unknown';
}

export function rateLimit(
  req: NextRequest,
  opts: { key: string; limit: number; windowMs: number }
): NextResponse | null {
  const now = Date.now();

  // Drop expired entries so the map cannot grow without bound.
  if (buckets.size > 5000) {
    for (const [key, bucket] of buckets) {
      if (bucket.reset <= now) buckets.delete(key);
    }
  }

  const id = `${opts.key}:${clientIp(req)}`;
  const current = buckets.get(id);
  if (!current || current.reset <= now) {
    buckets.set(id, { count: 1, reset: now + opts.windowMs });
    return null;
  }

  current.count += 1;
  if (current.count <= opts.limit) return null;

  return NextResponse.json(
    { error: 'Too many requests. Please wait a moment and try again.' },
    {
      status: 429,
      headers: { 'Retry-After': String(Math.max(1, Math.ceil((current.reset - now) / 1000))) },
    }
  );
}

/** True for addresses that must never be reachable from the server. */
export function isPrivateAddress(ip: string): boolean {
  const value = ip.toLowerCase().replace(/^\[|\]$/g, '');

  if (value.includes(':')) {
    // IPv4-mapped IPv6, e.g. ::ffff:127.0.0.1
    const mapped = value.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateAddress(mapped[1]);
    return (
      value === '::' ||
      value === '::1' ||
      value.startsWith('fc') ||
      value.startsWith('fd') ||
      value.startsWith('fe80') ||
      value.startsWith('ff')
    );
  }

  const parts = value.split('.').map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return true;
  }
  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    a >= 224
  );
}

/**
 * Reject URLs that could reach the machine or the private network.
 *
 * Blocks non-HTTP schemes, embedded credentials, loopback/private/link-local
 * addresses (literal or resolved), and anything outside an optional host
 * allowlist. DNS is resolved so a hostname pointing at 127.0.0.1 is refused;
 * the small rebinding window between this check and the fetch is accepted, as
 * the alternative (pinning the resolved IP) breaks TLS SNI.
 */
export async function assertPublicUrl(
  raw: string,
  opts: { allowHosts?: string[] } = {}
): Promise<{ ok: true; url: URL } | { ok: false; reason: string }> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: 'not a valid URL' };
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, reason: 'only http and https URLs are allowed' };
  }
  if (url.username || url.password) {
    return { ok: false, reason: 'URLs with credentials are not allowed' };
  }

  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost')) {
    return { ok: false, reason: 'local hosts are not allowed' };
  }

  if (opts.allowHosts && opts.allowHosts.length > 0) {
    const allowed = opts.allowHosts.some((allowedHost) => {
      const candidate = allowedHost.toLowerCase();
      return host === candidate || host.endsWith(`.${candidate}`);
    });
    if (!allowed) {
      return { ok: false, reason: `host ${host} is not allowed` };
    }
  }

  // Literal IP (IPv4 or bracketed IPv6 already stripped).
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host) || host.includes(':')) {
    if (isPrivateAddress(host)) {
      return { ok: false, reason: 'private addresses are not allowed' };
    }
    return { ok: true, url };
  }

  try {
    const addresses = await lookup(host, { all: true, verbatim: true });
    if (addresses.length === 0) return { ok: false, reason: 'host did not resolve' };
    if (addresses.some((entry) => isPrivateAddress(entry.address))) {
      return { ok: false, reason: 'host resolves to a private address' };
    }
  } catch {
    return { ok: false, reason: 'host could not be resolved' };
  }

  return { ok: true, url };
}

/**
 * Fetch with a timeout and a hard byte cap. Returns null rather than throwing
 * so callers keep their existing "could not fetch" fallbacks.
 */
export async function fetchWithLimit(
  rawUrl: string,
  opts: { timeoutMs?: number; maxBytes?: number; headers?: Record<string, string> } = {}
): Promise<{ buffer: Buffer; contentType: string } | null> {
  const timeoutMs = opts.timeoutMs ?? 15000;
  const maxBytes = opts.maxBytes ?? 20 * 1024 * 1024;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(rawUrl, {
      signal: controller.signal,
      redirect: 'follow',
      cache: 'no-store',
      headers: opts.headers,
    });
    if (!res.ok) return null;

    const declared = Number(res.headers.get('content-length') || 0);
    if (declared > maxBytes) return null;

    const reader = res.body?.getReader();
    if (!reader) return null;

    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        controller.abort();
        return null;
      }
      chunks.push(value);
    }

    return {
      buffer: Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))),
      contentType: res.headers.get('content-type') || '',
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * PostgREST builds filters as a mini-language inside the query string. A value
 * containing a comma, brace, quote or parenthesis can therefore add clauses.
 * Category names are plain words, so anything outside this set is refused.
 */
export function sanitizeFilterValue(value: string, maxLength = 60): string | null {
  const trimmed = String(value ?? '').trim();
  if (!trimmed || trimmed.length > maxLength) return null;
  if (!/^[A-Za-z0-9][A-Za-z0-9 &'._/-]*$/.test(trimmed)) return null;
  return trimmed;
}

/** Never leak internal error text to the browser. */
export function internalError(context: string, err: unknown): NextResponse {
  console.error(`${context}:`, err);
  return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
}
