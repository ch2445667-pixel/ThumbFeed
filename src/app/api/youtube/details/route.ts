import { NextRequest, NextResponse } from 'next/server';

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

function formatSubscribers(count: number): string {
  if (isNaN(count) || count < 0) return '';
  if (count >= 1_000_000_000) {
    return `${(count / 1_000_000_000).toFixed(1).replace(/\.0$/, '')}B subs`;
  }
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1).replace(/\.0$/, '')}M subs`;
  }
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(1).replace(/\.0$/, '')}K subs`;
  }
  return `${count} subs`;
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

function formatPublishedDate(dateStr?: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

function normalizeCreatorName(name?: string): string {
  if (!name || !name.trim()) return 'Unknown';
  const clean = name.trim();
  const lower = clean.toLowerCase();
  if (
    lower.includes('tanzee') ||
    lower === 'youtube creator' ||
    lower === 'curated' ||
    lower === 'unknown'
  ) {
    return 'Unknown';
  }
  return clean;
}

export interface VideoDetail {
  videoId: string;
  title?: string;
  creator?: string;
  views?: string;
  viewCountRaw?: number;
  subscribers?: string;
  publishedTime?: string;
  publishedDate?: string;
  channelId?: string;
  thumbnailUrl?: string;
  source?: 'youtube-api-v3' | 'oembed-fallback';
}

/**
 * Fetch video details using YouTube Data API v3 when key is configured.
 */
async function fetchViaYouTubeApiV3(
  videoIds: string[],
  apiKey: string
): Promise<{ resolved: Record<string, VideoDetail>; remainingIds: string[] }> {
  const resolved: Record<string, VideoDetail> = {};
  const remainingIds: string[] = [];

  // YouTube API v3 supports up to 50 IDs per call
  const chunks: string[][] = [];
  for (let i = 0; i < videoIds.length; i += 50) {
    chunks.push(videoIds.slice(i, i + 50));
  }

  for (const chunk of chunks) {
    try {
      const videoEndpoint = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${chunk.join(',')}&key=${apiKey}`;
      const res = await fetch(videoEndpoint, {
        headers: { Accept: 'application/json' },
        next: { revalidate: 3600 },
      });

      if (!res.ok) {
        console.warn(`YouTube API v3 videos endpoint returned status ${res.status}`);
        remainingIds.push(...chunk);
        continue;
      }

      const data = await res.json();
      const items: any[] = Array.isArray(data.items) ? data.items : [];
      const foundIds = new Set<string>();

      // Optional: Fetch channel subscribers for the videos' channels
      const channelIds = Array.from(
        new Set(items.map((it) => it.snippet?.channelId).filter(Boolean))
      );
      const channelSubsMap: Record<string, string> = {};

      if (channelIds.length > 0) {
        try {
          const chanEndpoint = `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${channelIds.slice(0, 50).join(',')}&key=${apiKey}`;
          const chanRes = await fetch(chanEndpoint, {
            headers: { Accept: 'application/json' },
            next: { revalidate: 86400 },
          });
          if (chanRes.ok) {
            const chanData = await chanRes.json();
            for (const chan of chanData.items || []) {
              const subsNum = parseInt(chan.statistics?.subscriberCount, 10);
              if (!isNaN(subsNum)) {
                channelSubsMap[chan.id] = formatSubscribers(subsNum);
              }
            }
          }
        } catch (chanErr) {
          console.warn('YouTube API v3 channel statistics lookup error:', chanErr);
        }
      }

      for (const item of items) {
        const vId = item.id;
        foundIds.add(vId);

        const viewCountNum = parseInt(item.statistics?.viewCount || '', 10);
        const formattedViews = !isNaN(viewCountNum) ? formatViews(viewCountNum) : undefined;
        const publishedIso = item.snippet?.publishedAt;
        const relTime = formatRelativeTime(publishedIso);
        const fullDate = formatPublishedDate(publishedIso);
        const channelId = item.snippet?.channelId;
        const subs = channelId ? channelSubsMap[channelId] : undefined;

        resolved[vId] = {
          videoId: vId,
          title: item.snippet?.title || undefined,
          creator: normalizeCreatorName(item.snippet?.channelTitle),
          views: formattedViews,
          viewCountRaw: !isNaN(viewCountNum) ? viewCountNum : undefined,
          subscribers: subs,
          publishedTime: relTime || fullDate || undefined,
          publishedDate: fullDate || undefined,
          channelId,
          thumbnailUrl:
            item.snippet?.thumbnails?.maxres?.url ||
            item.snippet?.thumbnails?.high?.url ||
            item.snippet?.thumbnails?.standard?.url,
          source: 'youtube-api-v3',
        };
      }

      // Any IDs not found in the official API response fall back to scraping
      for (const id of chunk) {
        if (!foundIds.has(id)) {
          remainingIds.push(id);
        }
      }
    } catch (err) {
      console.warn('YouTube API v3 batch fetch error:', err);
      remainingIds.push(...chunk);
    }
  }

  return { resolved, remainingIds };
}

/**
 * Fallback scraper using oEmbed and watch page metadata when API key is unavailable or quota exhausted.
 */
async function fetchViaFallback(cleanId: string): Promise<VideoDetail | null> {
  let title: string | undefined;
  let creator: string | undefined;
  let views: string | undefined;
  let subscribers: string | undefined;
  let publishedTime: string | undefined;

  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${cleanId}&format=json`;
    const oembedRes = await fetch(oembedUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ThumbFeed/1.0)' },
      next: { revalidate: 86400 },
    });

    if (oembedRes.ok) {
      const data = await oembedRes.json();
      if (data.title && data.title !== 'YouTube') title = data.title;
      if (data.author_name) creator = data.author_name;
    }
  } catch {
    // Ignore oEmbed failure
  }

  try {
    const watchUrl = `https://www.youtube.com/watch?v=${cleanId}`;
    const pageRes = await fetch(watchUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      cache: 'no-store',
    });

    if (pageRes.ok) {
      const html = await pageRes.text();

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
    // Continue
  }

  const normalizedCreator = normalizeCreatorName(creator);

  if (title || normalizedCreator !== 'Unknown' || views) {
    return {
      videoId: cleanId,
      title,
      creator: normalizedCreator,
      views,
      subscribers,
      publishedTime,
      source: 'oembed-fallback',
    };
  }

  return null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawIds: string[] = Array.isArray(body?.videoIds)
      ? body.videoIds
      : typeof body?.videoId === 'string'
        ? [body.videoId]
        : [];

    const videoIds = Array.from(
      new Set(
        rawIds
          .map((id) => id?.trim())
          .filter((id): id is string => Boolean(id && id.length === 11))
      )
    ).slice(0, 50);

    if (videoIds.length === 0) {
      return NextResponse.json({ details: {} });
    }

    const results: Record<string, VideoDetail> = {};
    const apiKey = (process.env.YOUTUBE_API_KEY || process.env.YOUTUBE_DATA_API_KEY || '').trim();

    let idsToFallback = videoIds;

    // 1. Prioritize YouTube Data API v3 if key is configured
    if (apiKey) {
      const { resolved, remainingIds } = await fetchViaYouTubeApiV3(videoIds, apiKey);
      Object.assign(results, resolved);
      idsToFallback = remainingIds;
    }

    // 2. Process any remaining IDs via fallback scraper
    if (idsToFallback.length > 0) {
      await Promise.all(
        idsToFallback.map(async (vid) => {
          const fallbackDetail = await fetchViaFallback(vid);
          if (fallbackDetail) {
            results[vid] = fallbackDetail;
          }
        })
      );
    }

    return NextResponse.json({
      details: results,
      sourceUsed: apiKey ? 'youtube-api-v3' : 'fallback-scraper',
      apiConfigured: Boolean(apiKey),
    });
  } catch (error: any) {
    console.error('YouTube details API error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch details', details: {} },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const singleId = searchParams.get('videoId') || searchParams.get('id');
  const multipleIds = searchParams.get('videoIds');
  const ids: string[] = [];

  if (singleId) ids.push(singleId);
  if (multipleIds) ids.push(...multipleIds.split(',').map((s) => s.trim()));

  const videoIds = Array.from(
    new Set(ids.filter((id) => id && id.length === 11))
  ).slice(0, 50);

  if (videoIds.length === 0) {
    return NextResponse.json({
      details: {},
      message: 'Provide ?videoId=11chars or ?videoIds=id1,id2',
      apiConfigured: Boolean(process.env.YOUTUBE_API_KEY || process.env.YOUTUBE_DATA_API_KEY),
    });
  }

  const results: Record<string, VideoDetail> = {};
  const apiKey = (process.env.YOUTUBE_API_KEY || process.env.YOUTUBE_DATA_API_KEY || '').trim();
  let idsToFallback = videoIds;

  if (apiKey) {
    const { resolved, remainingIds } = await fetchViaYouTubeApiV3(videoIds, apiKey);
    Object.assign(results, resolved);
    idsToFallback = remainingIds;
  }

  if (idsToFallback.length > 0) {
    await Promise.all(
      idsToFallback.map(async (vid) => {
        const fallbackDetail = await fetchViaFallback(vid);
        if (fallbackDetail) {
          results[vid] = fallbackDetail;
        }
      })
    );
  }

  return NextResponse.json({
    details: results,
    sourceUsed: apiKey ? 'youtube-api-v3' : 'fallback-scraper',
    apiConfigured: Boolean(apiKey),
  });
}
