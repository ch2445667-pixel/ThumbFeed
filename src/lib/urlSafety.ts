/**
 * Pure URL, media key, and Cloudflare R2 input safety helpers.
 * Used across server API routes and client rendering to prevent SSRF,
 * path traversal, internal metadata exposure, and unsafe URL scheme injection.
 */

const ALLOWED_MEDIA_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif',
  '.svg',
  '.avif',
]);

const YOUTUBE_HOSTS = [
  'youtube.com',
  'youtu.be',
  'i.ytimg.com',
  'yt3.ggpht.com',
];

const PINTEREST_HOSTS = [
  'pinterest.com',
  'pin.it',
  'i.pinimg.com',
];

function stripIpv6Brackets(hostname: string): string {
  return hostname.startsWith('[') && hostname.endsWith(']')
    ? hostname.slice(1, -1)
    : hostname;
}

function isIpv4Literal(host: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
}

function isPrivateIpv4(host: string): boolean {
  if (!isIpv4Literal(host)) return false;
  const parts = host.split('.').map((p) => Number(p));
  if (parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true;

  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true; // Cloud metadata / link-local
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a >= 224) return true; // Multicast & reserved
  return false;
}

export function isPrivateOrLoopbackHostname(rawHostname: string): boolean {
  const host = stripIpv6Brackets((rawHostname || '').trim().toLowerCase());
  if (!host) return true;

  if (
    host === 'localhost' ||
    host === 'ip6-localhost' ||
    host === 'metadata.google.internal' ||
    host === 'metadata' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host.endsWith('.home.arpa')
  ) {
    return true;
  }

  // Reject single-label hostnames or integer/hex/octal IPs (e.g. 2130706433, 0x7f000001)
  if (/^\d+$/.test(host) || /^0x[0-9a-f]+$/i.test(host)) {
    return true;
  }
  if (!host.includes('.') && !host.includes(':')) {
    return true;
  }

  if (isPrivateIpv4(host)) return true;

  // IPv6 loopback, unspecified, ULA (fc00::/7), link-local (fe80::/10), IPv4-mapped
  if (host.includes(':')) {
    if (
      host === '::' ||
      host === '::1' ||
      host.startsWith('fc') ||
      host.startsWith('fd') ||
      host.startsWith('fe8') ||
      host.startsWith('fe9') ||
      host.startsWith('fea') ||
      host.startsWith('feb')
    ) {
      return true;
    }
    const v4Mapped = host.match(/::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
    if (v4Mapped && isPrivateIpv4(v4Mapped[1])) {
      return true;
    }
    // Normalized hex representation of ::ffff:127.0.0.1 etc.
    if (host.startsWith('::ffff:')) {
      return true;
    }
  }

  return false;
}

export function isSafeExternalHttpUrl(rawUrl: string): boolean {
  if (!rawUrl || typeof rawUrl !== 'string') return false;
  const trimmed = rawUrl.trim();
  if (trimmed.length > 2048) return false;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
    if (parsed.username || parsed.password) return false;
    if (isPrivateOrLoopbackHostname(parsed.hostname)) return false;
    return true;
  } catch {
    return false;
  }
}

export function isAllowedDomainUrl(rawUrl: string, allowedBaseDomains: string[]): boolean {
  if (!isSafeExternalHttpUrl(rawUrl)) return false;
  try {
    const host = new URL(rawUrl.trim()).hostname.toLowerCase();
    return allowedBaseDomains.some((domain) => {
      const d = domain.toLowerCase();
      return host === d || host.endsWith(`.${d}`);
    });
  } catch {
    return false;
  }
}

export function isSafeYouTubeUrl(rawUrl: string): boolean {
  return isAllowedDomainUrl(rawUrl, YOUTUBE_HOSTS);
}

export function isSafePinterestUrl(rawUrl: string): boolean {
  if (!isSafeExternalHttpUrl(rawUrl)) return false;
  try {
    const host = new URL(rawUrl.trim()).hostname.toLowerCase();
    if (PINTEREST_HOSTS.some((d) => host === d || host.endsWith(`.${d}`))) {
      return true;
    }
    // Support regional Pinterest TLDs like uk.pinterest.com, pinterest.co.uk, pinterest.de
    return /^(?:[a-z0-9-]+\.)?pinterest\.[a-z]{2,}(?:\.[a-z]{2,})?$/.test(host);
  } catch {
    return false;
  }
}

export function sanitizeMediaKey(rawKey: string): string | null {
  if (!rawKey || typeof rawKey !== 'string') return null;

  let decoded = rawKey;
  try {
    decoded = decodeURIComponent(rawKey);
  } catch {
    return null;
  }

  const normalized = decoded.replace(/^\/+/, '').trim();
  if (!normalized || normalized.length > 512) return null;
  if (normalized.includes('\0') || normalized.includes('\\')) return null;

  const segments = normalized.split('/');
  if (segments.some((seg) => !seg || seg === '.' || seg === '..' || seg.includes('..'))) {
    return null;
  }

  // Block internal app metadata files stored in R2
  const lower = normalized.toLowerCase();
  if (
    lower === '_app_data' ||
    lower.startsWith('_app_data/') ||
    lower.includes('/_app_data/') ||
    lower.endsWith('.json') ||
    segments.some((seg) => seg.startsWith('.'))
  ) {
    return null;
  }

  const dotIdx = lower.lastIndexOf('.');
  if (dotIdx === -1) return null;
  const ext = lower.slice(dotIdx);
  if (!ALLOWED_MEDIA_EXTENSIONS.has(ext)) return null;

  return normalized;
}

export function isValidR2AccountId(accountId: string): boolean {
  return typeof accountId === 'string' && /^[a-zA-Z0-9_-]{8,64}$/.test(accountId.trim());
}

export function isValidR2BucketName(bucketName: string): boolean {
  return typeof bucketName === 'string' && /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucketName.trim());
}

export function sanitizeSafeHref(url?: string | null): string | undefined {
  if (!url || typeof url !== 'string') return undefined;
  const trimmed = url.trim();
  if (!trimmed) return undefined;

  if (trimmed.startsWith('/api/media/') || (trimmed.startsWith('/') && !trimmed.startsWith('//'))) {
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString();
    }
  } catch {
    return undefined;
  }
  return undefined;
}

export function sanitizeSafeImageSrc(url?: string | null): string | undefined {
  if (!url || typeof url !== 'string') return undefined;
  const trimmed = url.trim();
  if (!trimmed) return undefined;

  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return trimmed;
  }

  if (/^data:image\/(?:png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$/i.test(trimmed)) {
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString();
    }
  } catch {
    return undefined;
  }
  return undefined;
}
