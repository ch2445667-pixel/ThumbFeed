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
    const body = await req.json();
    const videoIds: string[] = Array.isArray(body?.videoIds)
      ? body.videoIds.slice(0, 30) // limit to 30 per batch for speed
      : [];

    if (videoIds.length === 0) {
      return NextResponse.json({ details: {} });
    }

    const results: Record<string, VideoDetail> = {};

    await Promise.all(
      videoIds.map(async (vid) => {
        const cleanId = vid.trim();
        if (!cleanId || cleanId.length !== 11) return;

        let title: string | undefined;
        let creator: string | undefined;
        let views: string | undefined;
        let subscribers: string | undefined;
        let publishedTime: string | undefined;

        try {
          // 1. Fetch official YouTube oEmbed for clean title and channel name
          const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${cleanId}&format=json`;
          const oembedRes = await fetch(oembedUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ThumbFeed/1.0)' },
            next: { revalidate: 86400 } // cache for 24 hours
          });

          if (oembedRes.ok) {
            const data = await oembedRes.json();
            if (data.title && data.title !== 'YouTube') title = data.title;
            if (data.author_name) creator = data.author_name;
          }
        } catch {
          // Ignore oEmbed failure and continue to scrape
        }

        try {
          // 2. Fetch video page HTML to extract viewCount, subs, and date
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

            // Extract view count from meta tag or ytInitialData JSON
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

            // Extract subscribers if available
            const subsMatch = html.match(/"subscriberCountText":\s*\{\s*"simpleText":\s*["']([^"']+)["']/i) ||
                              html.match(/"subscriberCountText":\s*\{\s*"accessibility":\s*\{\s*"accessibilityData":\s*\{\s*"label":\s*["']([^"']+)["']/i);
            if (subsMatch && subsMatch[1]) {
              subscribers = subsMatch[1].replace(/subscribers?/i, 'subs').trim();
            }

            // Extract published / upload time
            const dateMatch = html.match(/"dateText":\s*\{\s*"simpleText":\s*["']([^"']+)["']/i) ||
                              html.match(/"relativeDateText":\s*\{\s*"simpleText":\s*["']([^"']+)["']/i);
            if (dateMatch && dateMatch[1]) {
              publishedTime = dateMatch[1];
            } else {
              const uploadDateMeta = html.match(/itemprop=["']uploadDate["']\s+content=["']([^"']+)["']/i);
              if (uploadDateMeta && uploadDateMeta[1]) {
                publishedTime = formatRelativeTime(uploadDateMeta[1]);
              }
            }

            // Fallback for creator / title if oEmbed didn't provide it
            if (!creator) {
              const authorMatch = html.match(/<link itemprop=["']name["']\s+content=["']([^"']+)["']/i) ||
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

        // Normalize creator if tanzee or missing
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
  } catch (error: any) {
    console.error('YouTube details API error:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch details', details: {} }, { status: 500 });
  }
}
