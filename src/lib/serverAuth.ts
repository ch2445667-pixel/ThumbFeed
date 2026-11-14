import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import firebaseConfig from '../../firebase-applet-config.json';

export const ADMIN_EMAILS = [
  'canonwater2025@gmail.com',
  'shivashiva66407@gmail.com',
] as const;

const FIREBASE_PROJECT_ID = firebaseConfig.projectId;
const FIREBASE_ISSUER = `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`;
const GOOGLE_CERTS_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'https://localhost:3000',
  'http://127.0.0.1:3000',
  'https://127.0.0.1:3000',
  'https://ais-dev-6c7pcn24erkqeymq42knl2-860898429287.asia-northeast1.run.app',
  'https://ais-pre-6c7pcn24erkqeymq42knl2-860898429287.asia-northeast1.run.app',
];

export interface VerifiedUser {
  uid: string;
  email: string;
  emailVerified: boolean;
  name?: string;
  picture?: string;
}

interface JwtHeader {
  alg?: string;
  kid?: string;
  typ?: string;
}

interface FirebaseJwtPayload {
  iss?: unknown;
  aud?: unknown;
  auth_time?: unknown;
  user_id?: unknown;
  sub?: unknown;
  iat?: unknown;
  exp?: unknown;
  email?: unknown;
  email_verified?: unknown;
  name?: unknown;
  picture?: unknown;
}

let cachedCerts: Record<string, string> = {};
let certsExpireAt = 0;

function base64UrlToBuffer(input: string): Buffer {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = normalized.length % 4;
  const padded = pad ? normalized + '='.repeat(4 - pad) : normalized;
  return Buffer.from(padded, 'base64');
}

function parseMaxAgeSeconds(cacheControl: string | null): number {
  if (!cacheControl) return 300;
  const match = cacheControl.match(/max-age=(\d+)/i);
  if (!match) return 300;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 86400) : 300;
}

async function fetchGoogleCerts(forceRefresh = false): Promise<Record<string, string>> {
  const now = Date.now();
  if (!forceRefresh && Object.keys(cachedCerts).length > 0 && now < certsExpireAt) {
    return cachedCerts;
  }

  const res = await fetch(GOOGLE_CERTS_URL, {
    cache: 'no-store',
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch Firebase public keys: HTTP ${res.status}`);
  }

  const json = (await res.json()) as Record<string, string>;
  if (!json || typeof json !== 'object' || Object.keys(json).length === 0) {
    throw new Error('Firebase public keys response was empty');
  }

  const maxAge = parseMaxAgeSeconds(res.headers.get('cache-control'));
  cachedCerts = json;
  certsExpireAt = now + maxAge * 1000;
  return cachedCerts;
}

export function isValidFirebaseUid(uid: unknown): uid is string {
  return typeof uid === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(uid);
}

export function isAdminEmail(email?: string | null): boolean {
  if (!email || typeof email !== 'string') return false;
  const lower = email.trim().toLowerCase();
  return ADMIN_EMAILS.some((admin) => admin.toLowerCase() === lower);
}

/**
 * Pure synchronous verifier against a map of X.509 PEM certificates.
 * Exported separately so unit tests can exercise all JWT failure modes without network calls.
 */
export function verifyJwtWithCerts(
  idToken: string,
  certs: Record<string, string>,
  options?: {
    nowSeconds?: number;
    projectId?: string;
  }
): VerifiedUser | null {
  if (!idToken || typeof idToken !== 'string') return null;
  const parts = idToken.trim().split('.');
  if (parts.length !== 3) return null;

  const [headerB64, payloadB64, sigB64] = parts;
  if (!headerB64 || !payloadB64 || !sigB64) return null;

  let header: JwtHeader;
  let payload: FirebaseJwtPayload;
  try {
    header = JSON.parse(base64UrlToBuffer(headerB64).toString('utf-8')) as JwtHeader;
    payload = JSON.parse(base64UrlToBuffer(payloadB64).toString('utf-8')) as FirebaseJwtPayload;
  } catch {
    return null;
  }

  if (header.alg !== 'RS256' || typeof header.kid !== 'string' || !header.kid) {
    return null;
  }

  const certPem = certs[header.kid];
  if (!certPem || typeof certPem !== 'string') {
    return null;
  }

  let signatureValid = false;
  try {
    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(`${headerB64}.${payloadB64}`);
    verifier.end();
    signatureValid = verifier.verify(certPem, base64UrlToBuffer(sigB64));
  } catch {
    return null;
  }

  if (!signatureValid) return null;

  const now = options?.nowSeconds ?? Math.floor(Date.now() / 1000);
  const expectedProjectId = options?.projectId ?? FIREBASE_PROJECT_ID;
  const expectedIssuer = `https://securetoken.google.com/${expectedProjectId}`;

  if (payload.aud !== expectedProjectId) return null;
  if (payload.iss !== expectedIssuer) return null;
  if (!isValidFirebaseUid(payload.sub)) return null;

  const exp = typeof payload.exp === 'number' ? payload.exp : Number.NaN;
  const iat = typeof payload.iat === 'number' ? payload.iat : Number.NaN;
  const authTime = typeof payload.auth_time === 'number' ? payload.auth_time : Number.NaN;

  if (!Number.isFinite(exp) || exp <= now) return null;
  if (!Number.isFinite(iat) || iat > now + 300) return null;
  if (!Number.isFinite(authTime) || authTime > now + 300) return null;

  if (payload.email_verified !== true) return null;
  if (typeof payload.email !== 'string' || !payload.email.includes('@')) return null;

  return {
    uid: payload.sub,
    email: payload.email.trim(),
    emailVerified: true,
    name: typeof payload.name === 'string' ? payload.name : undefined,
    picture: typeof payload.picture === 'string' ? payload.picture : undefined,
  };
}

export async function verifyFirebaseIdToken(idToken: string): Promise<VerifiedUser | null> {
  if (!idToken || typeof idToken !== 'string') return null;

  const trimmed = idToken.trim();
  const parts = trimmed.split('.');
  if (parts.length !== 3) return null;

  let kid = '';
  try {
    const header = JSON.parse(base64UrlToBuffer(parts[0]).toString('utf-8')) as JwtHeader;
    if (header.alg !== 'RS256' || typeof header.kid !== 'string') return null;
    kid = header.kid;
  } catch {
    return null;
  }

  try {
    let certs = await fetchGoogleCerts(false);
    if (!certs[kid]) {
      certs = await fetchGoogleCerts(true);
    }
    return verifyJwtWithCerts(trimmed, certs);
  } catch (err) {
    console.warn('[Auth] Token verification error:', err instanceof Error ? err.message : String(err));
    return null;
  }
}

export function extractBearerToken(req: NextRequest | Request): string | null {
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice('Bearer '.length).trim();
  return token.length > 20 ? token : null;
}

export function getClientIp(req: NextRequest | Request): string {
  const trustProxy = Boolean(process.env.K_SERVICE);
  if (trustProxy) {
    const xff = req.headers.get('x-forwarded-for');
    if (xff) {
      const ips = xff
        .split(',')
        .map((ip) => ip.trim())
        .filter(Boolean);
      // Take rightmost non-private IP to avoid leftmost header spoofing
      for (let i = ips.length - 1; i >= 0; i--) {
        const candidate = ips[i];
        if (
          !/^(10\.|127\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1$|fc|fd|fe80)/i.test(candidate)
        ) {
          return candidate;
        }
      }
      if (ips.length > 0) return ips[ips.length - 1];
    }
    const realIp = req.headers.get('x-real-ip')?.trim();
    if (realIp) return realIp;
  }
  return 'local';
}

export function logSecurityEvent(
  event: string,
  details: Record<string, string | number | boolean | undefined | null>
): void {
  const cleanDetails: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(details)) {
    if (v !== undefined && v !== null) {
      cleanDetails[k] = v;
    }
  }
  console.info(
    JSON.stringify({
      type: 'SECURITY_AUDIT',
      timestamp: new Date().toISOString(),
      event,
      ...cleanDetails,
    })
  );
}

export function getAllowedOrigins(req?: NextRequest | Request): Set<string> {
  const allowed = new Set<string>(DEFAULT_ALLOWED_ORIGINS);

  if (req) {
    const host = (req.headers.get('x-forwarded-host') || req.headers.get('host') || '').trim();
    const proto = (req.headers.get('x-forwarded-proto') || '').trim().toLowerCase();
    if (host && /^[a-zA-Z0-9.:-]+$/.test(host)) {
      if (proto === 'http' || proto === 'https') {
        allowed.add(`${proto}://${host}`);
      } else {
        allowed.add(`https://${host}`);
        allowed.add(`http://${host}`);
      }
    }
  }

  return allowed;
}

export function verifyCsrfAndJson(
  req: NextRequest | Request,
  options?: { requireJson?: boolean }
): NextResponse | null {
  const requireJson = options?.requireJson !== false;

  const secFetchSite = (req.headers.get('sec-fetch-site') || '').trim().toLowerCase();
  if (secFetchSite === 'cross-site') {
    logSecurityEvent('csrf_blocked_cross_site', {
      ip: getClientIp(req),
      path: req.url,
    });
    return NextResponse.json({ error: 'Cross-site request blocked' }, { status: 403 });
  }

  const origin = (req.headers.get('origin') || '').trim().replace(/\/+$/, '');
  if (origin) {
    const allowedOrigins = getAllowedOrigins(req);
    if (!allowedOrigins.has(origin)) {
      logSecurityEvent('csrf_blocked_origin', {
        ip: getClientIp(req),
        origin,
        path: req.url,
      });
      return NextResponse.json({ error: 'Origin not allowed' }, { status: 403 });
    }
  }

  if (requireJson) {
    const contentType = (req.headers.get('content-type') || '').toLowerCase();
    if (!contentType.includes('application/json')) {
      return NextResponse.json(
        { error: 'Content-Type must be application/json' },
        { status: 415 }
      );
    }
  }

  return null;
}

export async function requireUser(
  req: NextRequest | Request
): Promise<{ user: VerifiedUser } | { errorResponse: NextResponse }> {
  const token = extractBearerToken(req);
  if (!token) {
    logSecurityEvent('auth_missing_token', {
      ip: getClientIp(req),
      path: req.url,
    });
    return {
      errorResponse: NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      ),
    };
  }

  const user = await verifyFirebaseIdToken(token);
  if (!user) {
    logSecurityEvent('auth_invalid_token', {
      ip: getClientIp(req),
      path: req.url,
    });
    return {
      errorResponse: NextResponse.json(
        { error: 'Invalid or expired authentication token' },
        { status: 401 }
      ),
    };
  }

  return { user };
}

export async function requireAdmin(
  req: NextRequest | Request
): Promise<{ user: VerifiedUser } | { errorResponse: NextResponse }> {
  const authResult = await requireUser(req);
  if ('errorResponse' in authResult) {
    return authResult;
  }

  if (!isAdminEmail(authResult.user.email)) {
    logSecurityEvent('admin_access_denied', {
      uid: authResult.user.uid,
      email: authResult.user.email,
      ip: getClientIp(req),
      path: req.url,
    });
    return {
      errorResponse: NextResponse.json(
        { error: 'Administrator permission required' },
        { status: 403 }
      ),
    };
  }

  return authResult;
}

export function safeErrorResponse(
  err: unknown,
  publicMessage: string,
  status = 500
): NextResponse {
  console.error(`[API Error ${status}] ${publicMessage}:`, err);
  return NextResponse.json({ error: publicMessage }, { status });
}
