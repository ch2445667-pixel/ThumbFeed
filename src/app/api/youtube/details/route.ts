import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { isSafeYouTubeUrl } from '@/lib/urlSafety';
import {
  requireAdmin,
  verifyCsrfAndJson,
  getClientIp,
  logSecurityEvent,
  safeErrorResponse,
} from '@/lib/serverAuth';
import { safeExternalFetch, readResponseTextWithLimit } from '@/lib/ssrfFetch';
import { checkRateLimit, rateLimitResponse } from '@/lib/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const detailsSchema = z.object({
  videoIds: z.array(z.string().trim().regex(/^[a-zA-Z0-9_-]{11}$/)).max(30),
});

function formatViews(count: number): string {
  if (isNaN(count) || count < 0) return '';
  if (count >= 1_000_000_000) {
    return `${(count / 1_000_000_000).toFixed(1).replace(/\.0$/, '')}B views`;
  }
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1).replace(/\.0$/, '')}M views`;
  }
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(1).replace(/\.0$/, '')}K views`;
  }
  return `${count} views`;
}

function formatRelativeTime(dateStr?: string): string {
  if (!dateStr) return '';
  try {
    const past = new Date(dateStr).getTime();
    if (isNaN(past)) return '';
    const diffSec = Math.floor((Date.now() - past) / 1000);
    if (diffSec < 60) return 'just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    const diffWeeks = Math.floor(diffDays / 7);
    if (diffWeeks < 5) return `${diffWeeks}w ago`;
    const diffMonths = Math.floor(diffDays / 30);
    if (diffMonths < 12) return `${diffMonths}mo ago`;
    const diffYears = Math.floor(diffDays / 365);
    return `${diffYears}y ago`;
  } catch {
    return '';
  }
}

interface VideoDetail {
  videoId: string;
  title?: string;
  creator?: string;
  views?: string;
  subscribers?: string;
  publishedTime?: string;
}

export async function POST(req: NextRequest) {
  try {
    const csrfError = verifyCsrfAndJson(req);
    if (csrfError) return csrfError;

    const authResult = await requireAdmin(req);
    if ('errorResponse' in authResult) return authResult.errorResponse;

    const ip = getClientIp(req);
    const rl = await checkRateLimit({
      key: `yt-details:${authResult.user.uid}`,
      limit: 60,
      windowMs: 15 * 60 * 1000,
    });
    if (!rl.allowed) {
      logSecurityEvent('rate_limit_exceeded', { endpoint: '/api/youtube/details', uid: authResult.user.uid, ip });
      return rateLimitResponse(rl.retryAfterSeconds);
    }

    const rawBody = await req.json().catch(() => null);
    const parsed = detailsSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid videoIds payload', details: {} }, { status: 400 });
    }

    const videoIds = parsed.data.videoIds;
    if (videoIds.length === 0) {
      return NextResponse.json({ details: {} });
    }

    const results: Record<string, VideoDetail> = {};

    await Promise.all(
      videoIds.map(async (cleanId) => {
        let title: string | undefined;
        let creator: string | undefined;
        let views: string | undefined;
        let subscribers: string | undefined;
        let publishedTime: string | undefined;

        try {
          const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${encodeURIComponent(cleanId)}&format=json`;
          const oembedRes = await safeExternalFetch(oembedUrl, {
            allowedUrlCheck: isSafeYouTubeUrl,
            timeoutMs: 8000,
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ThumbFeed/1.0)' },
          });

          if (oembedRes.ok) {
            const text = await readResponseTextWithLimit(oembedRes, 256 * 1024);
            const data = JSON.parse(text);
            if (data.title && data.title !== 'YouTube') title = data.title;
            if (data.author_name) creator = data.author_name;
          }
        } catch {
          // Ignore oEmbed failure and continue
        }

        try {
          const watchUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(cleanId)}`;
          const pageRes = await safeExternalFetch(watchUrl, {
            allowedUrlCheck: isSafeYouTubeUrl,
            timeoutMs: 8000,
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept-Language': 'en-US,en;q=0.9',
            },
          });

          if (pageRes.ok) {
            const html = await readResponseTextWithLimit(pageRes, 3 * 1024 * 1024);

            const metaCountMatch = html.match(/itemprop=["']interactionCount["']\s+content=["'](\d+)["']/i);
            const jsonCountMatch = html.match(/"viewCount":\s*["'](\d+)["']/i);
            const simpleTextMatch = html.match(/"views":\s*\{\s*"simpleText":\s*["']([^"']+)["']/i);

            if (metaCountMatch && metaCountMatch[1]) {
              views = formatViews(parseInt(metaCountMatch[1], 10));
            } else if (jsonCountMatch && jsonCountMatch[1]) {
              views = formatViews(parseInt(jsonCountMatch[1], 10));
            } else if (simpleTextMatch && simpleTextMatch[1]) {
              views = simpleTextMatch[1];
            }

            const subsMatch =
              html.match(/"subscriberCountText":\s*\{\s*"simpleText":\s*["']([^"']+)["']/i) ||
              html.match(/"subscriberCountText":\s*\{\s*"accessibility":\s*\{\s*"accessibilityData":\s*\{\s*"label":\s*["']([^"']+)["']/i);
            if (subsMatch && subsMatch[1]) {
              subscribers = subsMatch[1].replace(/subscribers?/i, 'subs').trim();
            }

            const dateMatch =
              html.match(/"dateText":\s*\{\s*"simpleText":\s*["']([^"']+)["']/i) ||
              html.match(/"relativeDateText":\s*\{\s*"simpleText":\s*["']([^"']+)["']/i);
            if (dateMatch && dateMatch[1]) {
              publishedTime = dateMatch[1];
            } else {
              const uploadDateMeta = html.match(/itemprop=["']uploadDate["']\s+content=["']([^"']+)["']/i);
              if (uploadDateMeta && uploadDateMeta[1]) {
                publishedTime = formatRelativeTime(uploadDateMeta[1]);
              }
            }

            if (!creator) {
              const authorMatch =
                html.match(/<link itemprop=["']name["']\s+content=["']([^"']+)["']/i) ||
                html.match(/"ownerChannelName":\s*["']([^"']+)["']/i);
              if (authorMatch && authorMatch[1]) creator = authorMatch[1];
            }

            if (!title) {
              const titleMatch = html.match(/<meta property=["']og:title["']\s+content=["']([^"']+)["']/i);
              if (titleMatch && titleMatch[1]) title = titleMatch[1];
            }
          }
        } catch {
          // Continue with whatever metadata was gathered
        }

        if (creator && (creator.toLowerCase().includes('tanzee') || creator.trim() === 'YouTube Creator')) {
          creator = 'Unknown';
        }

        if (title || creator || views) {
          results[cleanId] = {
            videoId: cleanId,
            title,
            creator: creator || 'Unknown',
            views,
            subscribers,
            publishedTime,
          };
        }
      })
    );

    return NextResponse.json({ details: results });
  } catch (error: unknown) {
    return safeErrorResponse(error, 'Failed to fetch YouTube details');
  }
}
