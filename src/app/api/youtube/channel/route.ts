import { NextRequest, NextResponse } from 'next/server';
import { NicheCategory } from '@/lib/types';
import { GoogleGenAI } from '@google/genai';

interface ExtractedChannelVideo {
  id: string;
  videoId: string;
  title: string;
  creator: string;
  imageUrl: string;
  sourceUrl: string;
  niche: NicheCategory;
  tags: string[];
  views?: string;
  publishedTime?: string;
}

function classifyNicheFromTitle(title: string, channelName: string = ''): { niche: NicheCategory; tags: string[] } {
  const lower = `${title} ${channelName}`.toLowerCase();
  let niche: NicheCategory = 'Tech';
  let tags: string[] = ['YouTube Thumbnail', 'High CTR', 'Creator'];

  if (
    lower.includes('documentary') || lower.includes('geopolitical') || lower.includes('history') ||
    lower.includes('mystery') || lower.includes('truth') || lower.includes('investigation') ||
    lower.includes('dark reality') || lower.includes('secret') || lower.includes('scam') ||
    lower.includes('downfall') || lower.includes('conspiracy')
  ) {
    niche = 'Documentary';
    tags = ['Documentary', 'Deep Dive', 'True Story', 'Investigation', 'Curiosity'];
  } else if (
    lower.includes('vlog') || lower.includes('lifestyle') || lower.includes('daily') ||
    lower.includes('routine') || lower.includes('day in') || lower.includes('living in') ||
    lower.includes('fashion') || lower.includes('travel') || lower.includes('room tour') ||
    lower.includes('irl')
  ) {
    niche = 'IRL';
    tags = ['IRL', 'Lifestyle', 'Daily Vlog', 'Personal Experience', 'Authentic'];
  } else if (
    lower.includes('gym') || lower.includes('fitness') || lower.includes('workout') ||
    lower.includes('muscle') || lower.includes('bodybuilding') || lower.includes('physique') ||
    lower.includes('football') || lower.includes('soccer') || lower.includes('racing') ||
    lower.includes('f1') || lower.includes('sports') || lower.includes('athlete') ||
    lower.includes('transformation')
  ) {
    niche = 'Sports';
    tags = ['Sports', 'Workout', 'Bodybuilding', 'Athletics', 'Transformation'];
  } else if (
    lower.includes('game') || lower.includes('gaming') || lower.includes('minecraft') ||
    lower.includes('roblox') || lower.includes('gta') || lower.includes('stream') ||
    lower.includes('fortnite') || lower.includes('valorant') || lower.includes('pokemon') ||
    lower.includes('playstation') || lower.includes('xbox') || lower.includes('twitch')
  ) {
    niche = 'Gaming';
    tags = ['Gaming', 'Gameplay', 'High Stakes', 'YouTube Gaming', 'Victory Royale'];
  } else if (
    lower.includes('money') || lower.includes('million') || lower.includes('business') ||
    lower.includes('invest') || lower.includes('finance') || lower.includes('sales') ||
    lower.includes('rich') || lower.includes('dollar') || lower.includes('crypto') ||
    lower.includes('stock') || lower.includes('real estate') || lower.includes('startup') ||
    lower.includes('economy') || lower.includes('wealth')
  ) {
    niche = 'Business';
    tags = ['Business', 'Entrepreneur', 'Finance Growth', 'Investing', 'Passive Income'];
  } else if (
    lower.includes('tutorial') || lower.includes('course') || lower.includes('photoshop') ||
    lower.includes('after effects') || lower.includes('guide') || lower.includes('learn') ||
    lower.includes('how to') || lower.includes('editing') || lower.includes('masterclass') ||
    lower.includes('design') || lower.includes('lesson')
  ) {
    niche = 'Educational';
    tags = ['Educational', 'Tutorial', 'Masterclass', 'Step-by-Step', 'Pro Tips'];
  } else if (
    lower.includes('mrbeast') || lower.includes('challenge') || lower.includes('viral') ||
    lower.includes('prank') || lower.includes('comedy') || lower.includes('survive') ||
    lower.includes('trapped') || lower.includes('last to') || lower.includes('$1') ||
    lower.includes('extreme') || lower.includes('100 days')
  ) {
    niche = 'Entertainment';
    tags = ['Entertainment', 'Viral Challenge', 'MrBeast Style', 'High Energy', 'Click Magnet'];
  } else if (
    lower.includes('ai') || lower.includes('tech') || lower.includes('apple') ||
    lower.includes('iphone') || lower.includes('macbook') || lower.includes('coding') ||
    lower.includes('hardware') || lower.includes('gadgets') || lower.includes('software') ||
    lower.includes('mkbhd')
  ) {
    niche = 'Tech';
    tags = ['Tech', 'AI Tools', 'Hardware', 'Software', 'Gadgets'];
  }

  return { niche, tags };
}

// Check if a node is Shorts / Reel
function isShorts(node: any): boolean {
  if (!node) return true;

  // 1. ContentType check in lockupViewModel
  if (node.contentType && (node.contentType.includes('SHORT') || node.contentType.includes('REEL'))) {
    return true;
  }

  // 2. Navigation endpoint check
  const navUrl = node.navigationEndpoint?.commandMetadata?.webCommandMetadata?.url || 
                 node.rendererContext?.commandContext?.onTap?.innertubeCommand?.commandMetadata?.webCommandMetadata?.url || '';
  if (navUrl.includes('/shorts/')) return true;

  // 3. Overlay badge check
  if (Array.isArray(node.thumbnailOverlays)) {
    for (const overlay of node.thumbnailOverlays) {
      const timeRenderer = overlay.thumbnailOverlayTimeStatusRenderer;
      if (timeRenderer) {
        if (timeRenderer.style === 'SHORTS') return true;
        const text = timeRenderer.text?.accessibility?.accessibilityData?.label || '';
        if (text.toLowerCase().includes('short') || text.toLowerCase().includes('reel')) return true;
      }
    }
  }

  // 4. Title hashtag check
  const title = (
    node.title?.runs?.[0]?.text ||
    node.title?.simpleText ||
    node.metadata?.lockupMetadataViewModel?.title?.content ||
    ''
  ).toLowerCase();

  if (title.includes('#shorts') || title.includes('#short') || title.includes('#reels')) {
    return true;
  }

  if (node.reelItemRenderer || node.shortsLockupViewModel) {
    return true;
  }

  return false;
}

// Find richGrid continuation token in YouTube data object
function findContinuationToken(obj: any): string | null {
  if (!obj || typeof obj !== 'object') return null;

  if (obj.continuationItemRenderer?.continuationEndpoint?.continuationCommand?.token) {
    return obj.continuationItemRenderer.continuationEndpoint.continuationCommand.token;
  }
  if (obj.continuationEndpoint?.continuationCommand?.token) {
    return obj.continuationEndpoint.continuationCommand.token;
  }
  if (obj.continuationCommand?.token) {
    return obj.continuationCommand.token;
  }

  if (Array.isArray(obj)) {
    for (const item of obj) {
      const token = findContinuationToken(item);
      if (token) return token;
    }
  } else {
    for (const key of Object.keys(obj)) {
      if (key === 'trackingParams' || key === 'accessibility') continue;
      const token = findContinuationToken(obj[key]);
      if (token) return token;
    }
  }

  return null;
}

// Extract long-form video items from both modern lockupViewModel and legacy videoRenderers
function extractAllVideos(obj: any, channelFallbackName: string, seenIds: Set<string>, list: ExtractedChannelVideo[] = []): ExtractedChannelVideo[] {
  if (!obj || typeof obj !== 'object') return list;

  // 1. Modern YouTube lockupViewModel (2024 - 2026+)
  if (obj.lockupViewModel) {
    const l = obj.lockupViewModel;
    if (!isShorts(l)) {
      const vId = l.contentId || l.rendererContext?.commandContext?.onTap?.innertubeCommand?.watchEndpoint?.videoId;
      if (vId && vId.length === 11 && !seenIds.has(vId)) {
        seenIds.add(vId);
        const titleText = l.metadata?.lockupMetadataViewModel?.title?.content || 'YouTube Video';
        
        let viewsText = '';
        let publishedText = '';
        const metadataRows = l.metadata?.lockupMetadataViewModel?.metadata?.contentMetadataViewModel?.metadataRows;
        if (Array.isArray(metadataRows)) {
          for (const row of metadataRows) {
            if (Array.isArray(row.metadataParts)) {
              for (const part of row.metadataParts) {
                const txt = part.text?.content || '';
                if (txt.toLowerCase().includes('view')) {
                  viewsText = txt;
                } else if (txt.toLowerCase().includes('ago') || txt.toLowerCase().includes('stream')) {
                  publishedText = txt;
                }
              }
            }
          }
        }

        const { niche, tags } = classifyNicheFromTitle(titleText, channelFallbackName);

        list.push({
          id: `ch-yt-${vId}`,
          videoId: vId,
          title: titleText,
          creator: channelFallbackName || 'YouTube Creator',
          imageUrl: `https://i.ytimg.com/vi/${vId}/maxresdefault.jpg`,
          sourceUrl: `https://www.youtube.com/watch?v=${vId}`,
          niche,
          tags,
          views: viewsText,
          publishedTime: publishedText
        });
      }
    }
    return list;
  }

  // 2. Legacy videoRenderer / gridVideoRenderer / compactVideoRenderer
  const renderer = obj.videoRenderer || obj.gridVideoRenderer || obj.compactVideoRenderer;
  if (renderer) {
    if (!isShorts(renderer)) {
      const vId = renderer.videoId;
      if (vId && vId.length === 11 && !seenIds.has(vId)) {
        seenIds.add(vId);
        const titleText = renderer.title?.runs?.[0]?.text || renderer.title?.simpleText || 'YouTube Video';
        const ownerName = renderer.ownerText?.runs?.[0]?.text || renderer.shortBylineText?.runs?.[0]?.text || channelFallbackName;
        const viewText = renderer.viewCountText?.simpleText || renderer.viewCountText?.runs?.map((r: any) => r.text).join('') || '';
        const published = renderer.publishedTimeText?.simpleText || '';

        const { niche, tags } = classifyNicheFromTitle(titleText, ownerName);

        list.push({
          id: `ch-yt-${vId}`,
          videoId: vId,
          title: titleText,
          creator: ownerName || 'YouTube Creator',
          imageUrl: `https://i.ytimg.com/vi/${vId}/maxresdefault.jpg`,
          sourceUrl: `https://www.youtube.com/watch?v=${vId}`,
          niche,
          tags,
          views: viewText,
          publishedTime: published
        });
      }
    }
    return list;
  }

  if (Array.isArray(obj)) {
    for (const item of obj) {
      extractAllVideos(item, channelFallbackName, seenIds, list);
    }
  } else {
    for (const key of Object.keys(obj)) {
      if (key === 'trackingParams' || key === 'accessibility') continue;
      extractAllVideos(obj[key], channelFallbackName, seenIds, list);
    }
  }

  return list;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { channelUrl, limit = 60 } = body;

    const requestedLimit = Math.min(Math.max(Number(limit) || 60, 10), 100);

    if (!channelUrl || typeof channelUrl !== 'string') {
      return NextResponse.json({ error: 'Channel URL or handle is required' }, { status: 400 });
    }

    let input = channelUrl.trim();

    // Check if input is actually a single video URL
    const singleVideoMatch = input.match(/(?:watch\?(?:.*&)?v=|youtu\.be\/|\/shorts\/|\/embed\/|\/live\/)([a-zA-Z0-9_-]{11})/i);
    if (singleVideoMatch && singleVideoMatch[1]) {
      const vId = singleVideoMatch[1];
      let videoTitle = 'YouTube Video';
      let authorName = 'YouTube Creator';
      let thumbUrl = `https://i.ytimg.com/vi/${vId}/maxresdefault.jpg`;

      try {
        const oembedRes = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${vId}&format=json`);
        if (oembedRes.ok) {
          const odata = await oembedRes.json();
          if (odata.title) videoTitle = odata.title;
          if (odata.author_name) authorName = odata.author_name;
          if (odata.thumbnail_url) thumbUrl = odata.thumbnail_url;
        }
      } catch (directVidErr) {
        console.warn('Single video oEmbed in channel route error:', directVidErr);
      }

      const { niche, tags } = classifyNicheFromTitle(videoTitle, authorName);
      const singleItem: ExtractedChannelVideo = {
        id: `ch-yt-${vId}`,
        videoId: vId,
        title: videoTitle,
        creator: authorName,
        imageUrl: thumbUrl,
        sourceUrl: `https://www.youtube.com/watch?v=${vId}`,
        niche,
        tags
      };

      return NextResponse.json({
        success: true,
        channel: {
          name: authorName,
          avatar: `https://i.ytimg.com/vi/${vId}/hqdefault.jpg`,
          url: `https://www.youtube.com/watch?v=${vId}`
        },
        count: 1,
        requestedLimit,
        videos: [singleItem],
        items: [singleItem]
      });
    }
    
    // Normalize channel URL
    let targetUrl = input;
    if (input.startsWith('@')) {
      targetUrl = `https://www.youtube.com/${input}/videos`;
    } else if (!input.startsWith('http')) {
      if (input.includes('youtube.com/')) {
        targetUrl = `https://${input}`;
      } else {
        targetUrl = `https://www.youtube.com/@${input.replace(/^@/, '')}/videos`;
      }
    }

    // Force /videos tab to specifically get long-form videos
    if (targetUrl.includes('youtube.com/')) {
      targetUrl = targetUrl.replace(/\/shorts\/?$/, '/videos')
                           .replace(/\/featured\/?$/, '/videos')
                           .replace(/\/streams\/?$/, '/videos');
      if (!targetUrl.endsWith('/videos')) {
        targetUrl = targetUrl.replace(/\/+$/, '') + '/videos';
      }
    }

    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1',
    };

    let html = '';
    try {
      const res = await fetch(targetUrl, {
        headers,
        cache: 'no-store'
      });
      if (res.ok) {
        html = await res.text();
      }
    } catch (e) {
      console.error('Fetch channel page error:', e);
    }

    let extractedVideos: ExtractedChannelVideo[] = [];
    const seenVideoIds = new Set<string>();

    let channelTitle = '';
    let channelAvatar = '';
    let channelId = '';
    let innertubeApiKey = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';
    let clientVersion = '2.20260820.08.00';
    let continuationToken: string | null = null;

    if (html) {
      // Extract channel name & avatar & channel ID
      const titleMatch = html.match(/<meta property="og:title" content="([^"]+)">/) || html.match(/<title>([^<]+)<\/title>/);
      if (titleMatch && titleMatch[1]) {
        channelTitle = titleMatch[1].replace(' - YouTube', '').trim();
      }

      const avatarMatch = html.match(/<meta property="og:image" content="([^"]+)">/);
      if (avatarMatch && avatarMatch[1]) {
        channelAvatar = avatarMatch[1];
      }

      const channelIdMatch = html.match(/channel_id=([a-zA-Z0-9_-]{24})/) || html.match(/browse_id=([a-zA-Z0-9_-]{24})/);
      if (channelIdMatch && channelIdMatch[1]) {
        channelId = channelIdMatch[1];
      }

      // Extract INNERTUBE_API_KEY & client version
      const apiKeyMatch = html.match(/"INNERTUBE_API_KEY":"([^"]+)"/);
      if (apiKeyMatch && apiKeyMatch[1]) {
        innertubeApiKey = apiKeyMatch[1];
      }

      const clientVerMatch = html.match(/"INNERTUBE_CONTEXT_CLIENT_VERSION":"([^"]+)"/) || html.match(/"cver":"([^"]+)"/);
      if (clientVerMatch && clientVerMatch[1]) {
        clientVersion = clientVerMatch[1];
      }

      // Extract ytInitialData
      const ytDataMatch = html.match(/var ytInitialData\s*=\s*(\{[\s\S]+?\});<\/script>/) ||
                          html.match(/ytInitialData\s*=\s*(\{[\s\S]+?\});/);

      if (ytDataMatch && ytDataMatch[1]) {
        try {
          const ytData = JSON.parse(ytDataMatch[1]);
          
          // Extract page 1 videos
          extractAllVideos(ytData, channelTitle || input, seenVideoIds, extractedVideos);

          // Get continuation token for pagination past 30 items
          continuationToken = findContinuationToken(ytData);
        } catch (err) {
          console.warn('Failed to parse ytInitialData JSON:', err);
        }
      }

      // --- PAGINATION LOOP: Fetch next pages via YouTube Innertube API up to requestedLimit ---
      let paginationAttempts = 0;
      const maxPages = Math.ceil(requestedLimit / 25) + 3;

      while (
        extractedVideos.length < requestedLimit &&
        continuationToken &&
        innertubeApiKey &&
        paginationAttempts < maxPages
      ) {
        paginationAttempts++;
        try {
          const browseUrl = `https://www.youtube.com/youtubei/v1/browse?key=${innertubeApiKey}`;
          const browseRes = await fetch(browseUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': headers['User-Agent'],
              'Accept-Language': headers['Accept-Language'],
            },
            body: JSON.stringify({
              context: {
                client: {
                  clientName: 'WEB',
                  clientVersion: clientVersion,
                  hl: 'en',
                  gl: 'US'
                }
              },
              continuation: continuationToken
            })
          });

          if (!browseRes.ok) break;
          const browseData = await browseRes.json();

          // Extract videos from continuation response
          extractAllVideos(browseData, channelTitle || input, seenVideoIds, extractedVideos);

          // Find next continuation token
          continuationToken = findContinuationToken(browseData);
        } catch (pageErr) {
          console.warn('Innertube continuation fetch error:', pageErr);
          break;
        }
      }
    }

    // Secondary RSS Fallback if scraped list is empty (e.g. if bot-blocked on some regions)
    if (extractedVideos.length === 0 && channelId) {
      try {
        const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
        const rssRes = await fetch(rssUrl, { cache: 'no-store' });
        if (rssRes.ok) {
          const xml = await rssRes.text();
          const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
          let entryMatch;
          while ((entryMatch = entryRegex.exec(xml)) !== null && extractedVideos.length < requestedLimit) {
            const entryStr = entryMatch[1];
            const vIdMatch = entryStr.match(/<yt:videoId>(.*?)<\/yt:videoId>/);
            const titleMatch = entryStr.match(/<title>(.*?)<\/title>/);
            const authorMatch = entryStr.match(/<name>(.*?)<\/name>/);
            const pubMatch = entryStr.match(/<published>(.*?)<\/published>/);

            if (vIdMatch && vIdMatch[1]) {
              const vId = vIdMatch[1];
              const title = titleMatch ? titleMatch[1] : 'YouTube Video';
              const author = authorMatch ? authorMatch[1] : channelTitle || input;
              if (!seenVideoIds.has(vId) && !title.toLowerCase().includes('#short')) {
                seenVideoIds.add(vId);
                const { niche, tags } = classifyNicheFromTitle(title, author);
                extractedVideos.push({
                  id: `ch-yt-${vId}`,
                  videoId: vId,
                  title,
                  creator: author,
                  imageUrl: `https://i.ytimg.com/vi/${vId}/maxresdefault.jpg`,
                  sourceUrl: `https://www.youtube.com/watch?v=${vId}`,
                  niche,
                  tags,
                  publishedTime: pubMatch ? pubMatch[1].slice(0, 10) : ''
                });
              }
            }
          }
        }
      } catch (rssErr) {
        console.warn('RSS fallback error:', rssErr);
      }
    }

    // Tertiary AI Grounding Fallback if needed
    if (extractedVideos.length === 0 && process.env.GEMINI_API_KEY) {
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const prompt = `Find 30 to ${requestedLimit} recent regular long-form YouTube video uploads (NOT shorts, NOT reels) for the channel: "${input}".
Return a strict JSON array of objects with keys: "videoId" (exact 11-char YouTube ID), "title", "creator", "niche".`;

        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
          }
        });

        if (response && response.text) {
          const parsed = JSON.parse(response.text);
          if (Array.isArray(parsed)) {
            for (const item of parsed) {
              let vId = item.videoId || '';
              if (vId.includes('v=')) {
                vId = vId.split('v=')[1].slice(0, 11);
              } else if (vId.includes('youtu.be/')) {
                vId = vId.split('youtu.be/')[1].slice(0, 11);
              }
              if (vId && vId.length === 11 && !seenVideoIds.has(vId)) {
                seenVideoIds.add(vId);
                const { niche, tags } = classifyNicheFromTitle(item.title || '', item.creator || channelTitle);
                extractedVideos.push({
                  id: `ch-yt-${vId}`,
                  videoId: vId,
                  title: item.title || 'YouTube Video',
                  creator: item.creator || channelTitle || input,
                  imageUrl: `https://i.ytimg.com/vi/${vId}/maxresdefault.jpg`,
                  sourceUrl: `https://www.youtube.com/watch?v=${vId}`,
                  niche: (item.niche as NicheCategory) || niche,
                  tags: tags
                });
                if (extractedVideos.length >= requestedLimit) break;
              }
            }
          }
        }
      } catch (geminiErr) {
        console.warn('Gemini channel extract fallback error:', geminiErr);
      }
    }

    // Limit to requested count
    if (extractedVideos.length > requestedLimit) {
      extractedVideos = extractedVideos.slice(0, requestedLimit);
    }

    if (extractedVideos.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No long-form videos could be found for this channel. Please check the URL or handle (e.g. @MrBeast or youtube.com/@MrBeast).'
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      channel: {
        name: channelTitle || input,
        avatar: channelAvatar,
        url: targetUrl
      },
      count: extractedVideos.length,
      requestedLimit,
      videos: extractedVideos,
      items: extractedVideos
    });

  } catch (err: any) {
    console.error('Channel extractor error:', err);
    return NextResponse.json({ error: err.message || 'Failed to extract channel videos' }, { status: 500 });
  }
}
