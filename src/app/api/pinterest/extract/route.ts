import { NextRequest, NextResponse } from 'next/server';
import {
  assertPublicUrl,
  internalError,
  rateLimit,
  requireAdmin,
} from '../../../../lib/apiSecurity';

const PINTEREST_HOSTS = ['pinterest.com', 'pin.it', 'pinimg.com'];
const MAX_HTML_BYTES = 2 * 1024 * 1024;

/**
 * Fetch a Pinterest page while staying on Pinterest.
 *
 * Redirects are followed by hand so every hop is re-validated; `redirect:
 * 'follow'` would let a permitted host bounce the server to an internal
 * address after the first check.
 */
async function fetchAllowedHtml(startUrl: string): Promise<{ html: string; finalUrl: string } | null> {
  let current = startUrl;

  for (let hop = 0; hop < 4; hop += 1) {
    const safe = await assertPublicUrl(current, { allowHosts: PINTEREST_HOSTS });
    if (!safe.ok) return null;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const res = await fetch(current, {
        redirect: 'manual',
        signal: controller.signal,
        cache: 'no-store',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });

      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get('location');
        if (!location) return null;
        current = new URL(location, current).toString();
        continue;
      }

      if (!res.ok) return null;
      if (!(res.headers.get('content-type') || '').toLowerCase().includes('text/html')) return null;

      const reader = res.body?.getReader();
      if (!reader) return null;

      const chunks: Uint8Array[] = [];
      let total = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value) continue;
        total += value.byteLength;
        if (total > MAX_HTML_BYTES) {
          controller.abort();
          return null;
        }
        chunks.push(value);
      }

      return { html: Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString('utf8'), finalUrl: current };
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  return null;
}

interface ExtractedPin {
  id: string;
  url: string;
  title: string;
  creator: string;
  imageUrl: string;
  niche: string;
  tags: string[];
}

function cleanPinterestUrl(raw: string): string {
  return raw.replace(/[,;.\)\]]+$/, '').trim();
}

function classifyPinterestNiche(title: string): { niche: string; tags: string[] } {
  const lower = title.toLowerCase();
  if (lower.includes('design') || lower.includes('thumbnail') || lower.includes('graphic') || lower.includes('ui') || lower.includes('art')) {
    return { niche: 'Tech', tags: ['Design', 'Graphics', 'Creative'] };
  }
  if (lower.includes('outfit') || lower.includes('fashion') || lower.includes('aesthetic') || lower.includes('vlog') || lower.includes('lifestyle')) {
    return { niche: 'IRL', tags: ['Aesthetic', 'Fashion', 'Lifestyle'] };
  }
  if (lower.includes('gym') || lower.includes('workout') || lower.includes('fitness') || lower.includes('sport')) {
    return { niche: 'Sports', tags: ['Fitness', 'Workout', 'Sports'] };
  }
  if (lower.includes('money') || lower.includes('business') || lower.includes('finance')) {
    return { niche: 'Business', tags: ['Business', 'Finance', 'Growth'] };
  }
  if (lower.includes('game') || lower.includes('gaming') || lower.includes('anime')) {
    return { niche: 'Gaming', tags: ['Gaming', 'Anime', 'Concept Art'] };
  }
  return { niche: 'Entertainment', tags: ['Pinterest', 'Inspiration', 'Visual Art'] };
}

async function extractSinglePin(targetUrl: string): Promise<ExtractedPin | null> {
  try {
    const page = await fetchAllowedHtml(targetUrl);
    if (!page) return null;
    const html = page.html;
    const finalUrl = page.finalUrl || targetUrl;

    // Extract title
    const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
    let title = titleMatch ? titleMatch[1].replace(/\|\s*Pinterest.*$/i, '').trim() : '';
    if (!title || title.toLowerCase() === 'pinterest') {
      const ogTitle = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']*)["']/i);
      title = ogTitle ? ogTitle[1].replace(/\|\s*Pinterest.*$/i, '').trim() : 'Pinterest Pin';
    }

    // Extract images
    const allImgs = html.match(/https:\/\/i\.pinimg\.com\/[^\s\"\'\\\<\>]+/g) || [];
    const valid: string[] = [];
    const seen = new Set<string>();

    for (const img of allImgs) {
      if (
        img.includes('60x60') ||
        img.includes('75x75') ||
        img.includes('user_avatars') ||
        img.includes('d5/3b/01') ||
        img.includes('30x30')
      ) {
        continue;
      }
      const cleanImg = img.replace(/[\)\}\"\'].*$/, '');
      const hd = cleanImg.replace(/\/(236x|474x|170x|60x60|136x136)\//, '/736x/');
      if (!seen.has(hd)) {
        seen.add(hd);
        valid.push(hd);
      }
    }

    // Prefer originals or 736x
    let bestImage = valid.find(img => img.includes('/originals/')) || valid.find(img => img.includes('/736x/')) || valid[0];

    if (!bestImage) {
      const ogImgMatch = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']*)["']/i);
      if (ogImgMatch && ogImgMatch[1]) {
        bestImage = ogImgMatch[1].replace(/\/(236x|474x|170x)\//, '/736x/');
      }
    }

    if (!bestImage) return null;

    const { niche, tags } = classifyPinterestNiche(title);
    const pinIdMatch = finalUrl.match(/pin\/(\d+)/) || targetUrl.match(/pin\/(\d+)/);
    const id = pinIdMatch ? pinIdMatch[1] : `pin-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    return {
      id,
      url: finalUrl,
      title: title || 'Pinterest Inspiration',
      creator: 'Pinterest Curator',
      imageUrl: bestImage,
      niche,
      tags
    };
  } catch (err) {
    console.warn('Error extracting pin:', targetUrl, err);
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const limited = rateLimit(req, { key: 'pinterest-extract', limit: 20, windowMs: 60_000 });
    if (limited) return limited;

    const body = await req.json();
    const { url, urls, text } = body || {};

    // Only the owner's Add flow uses this endpoint, and it makes outbound
    // requests on the caller's behalf.
    const denied = await requireAdmin(
      req,
      typeof body?.idToken === 'string' ? body.idToken : ''
    );
    if (denied) return denied;

    const candidates: string[] = [];

    if (text && typeof text === 'string') {
      const urlRegex = /https?:\/\/(?:[a-zA-Z0-9-]+\.)?pinterest\.[a-z.]+\/[^\s\"\'\<\>]+|https?:\/\/pin\.it\/[^\s\"\'\<\>]+|https?:\/\/i\.pinimg\.com\/[^\s\"\'\<\>]+/gi;
      const found = text.match(urlRegex) || [];
      candidates.push(...found);
    }

    if (Array.isArray(urls)) {
      candidates.push(...urls.filter((entry): entry is string => typeof entry === 'string'));
    }

    if (url && typeof url === 'string') {
      candidates.push(url);
    }

    const uniqueCleanUrls = Array.from(new Set(candidates.map(cleanPinterestUrl))).filter(u => u.length > 10);

    if (uniqueCleanUrls.length === 0) {
      return NextResponse.json({ error: 'No valid Pinterest URLs found' }, { status: 400 });
    }

    const results: ExtractedPin[] = [];

    for (const targetUrl of uniqueCleanUrls.slice(0, 30)) {
      const pin = await extractSinglePin(targetUrl);
      if (pin) {
        results.push(pin);
      }
    }

    return NextResponse.json({
      success: true,
      count: results.length,
      items: results
    });
  } catch (err) {
    return internalError('Pinterest extract error', err);
  }
}
