import dns from 'node:dns';
import net from 'node:net';
import { isPrivateOrLoopbackHostname, isSafeExternalHttpUrl } from './urlSafety';

export interface SafeFetchOptions {
  method?: 'GET' | 'POST';
  body?: string;
  headers?: Record<string, string>;
  allowedUrlCheck?: (url: string) => boolean;
  maxRedirects?: number;
  timeoutMs?: number;
  lookupFn?: (hostname: string) => Promise<Array<{ address: string; family: number }>>;
}

async function defaultDnsLookup(
  hostname: string
): Promise<Array<{ address: string; family: number }>> {
  return dns.promises.lookup(hostname, { all: true, verbatim: true });
}

function stripBrackets(hostname: string): string {
  return hostname.startsWith('[') && hostname.endsWith(']')
    ? hostname.slice(1, -1)
    : hostname;
}

export async function assertResolvedPublicUrl(
  rawUrl: string,
  options?: {
    allowedUrlCheck?: (url: string) => boolean;
    lookupFn?: (hostname: string) => Promise<Array<{ address: string; family: number }>>;
  }
): Promise<URL> {
  if (!isSafeExternalHttpUrl(rawUrl)) {
    throw new Error('Blocked unsafe external URL');
  }

  if (options?.allowedUrlCheck && !options.allowedUrlCheck(rawUrl)) {
    throw new Error('URL host is not in the allowed domain allowlist');
  }

  const parsed = new URL(rawUrl.trim());
  const cleanHost = stripBrackets(parsed.hostname.trim().toLowerCase());

  if (isPrivateOrLoopbackHostname(cleanHost)) {
    throw new Error('Blocked private or loopback hostname');
  }

  // Literal IPs already validated above; non-literal hosts must pass DNS lookup without private records
  if (net.isIP(cleanHost) === 0) {
    const lookup = options?.lookupFn ?? defaultDnsLookup;
    const records = await lookup(cleanHost);
    if (!Array.isArray(records) || records.length === 0) {
      throw new Error('Hostname failed DNS resolution');
    }
    for (const rec of records) {
      if (!rec?.address || isPrivateOrLoopbackHostname(rec.address)) {
        throw new Error('Blocked hostname resolving to a private or loopback IP');
      }
    }
  }

  return parsed;
}

export async function safeExternalFetch(
  rawUrl: string,
  options: SafeFetchOptions = {}
): Promise<Response> {
  const maxRedirects = options.maxRedirects ?? 3;
  const timeoutMs = options.timeoutMs ?? 12000;
  const method = options.method ?? 'GET';

  let currentUrl = rawUrl;
  for (let hop = 0; hop <= maxRedirects; hop++) {
    const validatedUrl = await assertResolvedPublicUrl(currentUrl, {
      allowedUrlCheck: options.allowedUrlCheck,
      lookupFn: options.lookupFn,
    });

    const res = await fetch(validatedUrl.toString(), {
      method,
      body: method === 'POST' ? options.body : undefined,
      headers: options.headers,
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      if (!location) {
        throw new Error('Redirect response missing Location header');
      }
      // Cancel unread body before following next hop
      await res.body?.cancel().catch(() => {});
      const nextUrl = new URL(location, validatedUrl).toString();
      if (hop === maxRedirects) {
        throw new Error('Exceeded maximum safe redirect hops');
      }
      currentUrl = nextUrl;
      continue;
    }

    return res;
  }

  throw new Error('Exceeded maximum safe redirect hops');
}

export async function readResponseBufferWithLimit(
  res: Response,
  maxBytes: number
): Promise<Buffer> {
  const contentLength = res.headers.get('content-length');
  if (contentLength && Number(contentLength) > maxBytes) {
    await res.body?.cancel().catch(() => {});
    throw new Error(`Remote payload exceeds ${maxBytes} bytes`);
  }

  if (!res.body) {
    const ab = await res.arrayBuffer();
    if (ab.byteLength > maxBytes) {
      throw new Error(`Remote payload exceeds ${maxBytes} bytes`);
    }
    return Buffer.from(ab);
  }

  const reader = res.body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => {});
        throw new Error(`Remote payload exceeds ${maxBytes} bytes`);
      }
      chunks.push(Buffer.from(value));
    }
  }

  return Buffer.concat(chunks, total);
}

export async function readResponseTextWithLimit(
  res: Response,
  maxBytes: number
): Promise<string> {
  const buf = await readResponseBufferWithLimit(res, maxBytes);
  return buf.toString('utf-8');
}
