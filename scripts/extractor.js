const { createClient } = require('@supabase/supabase-js');
const sharp = require('sharp');

function isShorts(node) {
  if (!node) return true;
  if (node.contentType && (node.contentType.includes('SHORT') || node.contentType.includes('REEL'))) {
    return true;
  }
  const navUrl = node.navigationEndpoint?.commandMetadata?.webCommandMetadata?.url || 
                 node.rendererContext?.commandContext?.onTap?.innertubeCommand?.commandMetadata?.webCommandMetadata?.url || '';
  if (navUrl.includes('/shorts/')) return true;

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

function findContinuationToken(obj) {
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

function extractAllVideos(obj, channelFallbackName, seenIds, list = []) {
  if (!obj || typeof obj !== 'object') return list;

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
                const txt = (part.text?.content || '').trim();
                const a11y = (part.accessibilityLabel || '').trim();
                if (a11y.toLowerCase().includes('view') || txt.toLowerCase().includes('view')) {
                  // Continuation responses carry "19M views" as plain text while
                  // the first page carries it as an accessibility label. Appending
                  // unconditionally produced "19M views views".
                  const label = (a11y || txt).trim();
                  viewsText = /views?\b/i.test(label) ? label : (label ? `${label} views` : '');
                } else if (a11y.toLowerCase().includes('ago') || txt.toLowerCase().includes('ago')) {
                  publishedText = txt || a11y;
                }
              }
            }
          }
        }

        list.push({
          videoId: vId,
          title: titleText,
          creator: channelFallbackName,
          imageUrl: `https://i.ytimg.com/vi/${vId}/maxresdefault.jpg`,
          sourceUrl: `https://www.youtube.com/watch?v=${vId}`,
          views: viewsText,
          publishedTime: publishedText
        });
      }
    }
    return list;
  }

  const renderer = obj.videoRenderer || obj.gridVideoRenderer || obj.compactVideoRenderer;
  if (renderer) {
    if (!isShorts(renderer)) {
      const vId = renderer.videoId;
      if (vId && vId.length === 11 && !seenIds.has(vId)) {
        seenIds.add(vId);
        const titleText = renderer.title?.runs?.[0]?.text || renderer.title?.simpleText || 'YouTube Video';
        const ownerName = renderer.ownerText?.runs?.[0]?.text || renderer.shortBylineText?.runs?.[0]?.text || channelFallbackName;
        const viewText = renderer.viewCountText?.simpleText || renderer.viewCountText?.runs?.map((r) => r.text).join('') || '';
        const published = renderer.publishedTimeText?.simpleText || '';

        list.push({
          videoId: vId,
          title: titleText,
          creator: ownerName,
          imageUrl: `https://i.ytimg.com/vi/${vId}/maxresdefault.jpg`,
          sourceUrl: `https://www.youtube.com/watch?v=${vId}`,
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

async function fetchDirectChannelVideos(channelUrl, requestedLimit = 60) {
  let targetUrl = channelUrl.trim();
  if (targetUrl.startsWith('@')) {
    targetUrl = `https://www.youtube.com/${targetUrl}/videos`;
  } else if (!targetUrl.startsWith('http')) {
    targetUrl = `https://www.youtube.com/@${targetUrl.replace(/^@/, '')}/videos`;
  }
  if (!targetUrl.endsWith('/videos')) {
    targetUrl = targetUrl.replace(/\/+$/, '') + '/videos';
  }

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
  };

  const res = await fetch(targetUrl, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${targetUrl}`);
  const html = await res.text();

  let channelTitle = '';
  const titleMatch = html.match(/<meta property="og:title" content="([^"]+)">/) || html.match(/<title>([^<]+)<\/title>/);
  if (titleMatch && titleMatch[1]) channelTitle = titleMatch[1].replace(' - YouTube', '').trim();

  let innertubeApiKey = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';
  const apiKeyMatch = html.match(/"INNERTUBE_API_KEY":"([^"]+)"/);
  if (apiKeyMatch && apiKeyMatch[1]) innertubeApiKey = apiKeyMatch[1];

  let clientVersion = '2.20260820.08.00';
  const clientVerMatch = html.match(/"INNERTUBE_CONTEXT_CLIENT_VERSION":"([^"]+)"/) || html.match(/"cver":"([^"]+)"/);
  if (clientVerMatch && clientVerMatch[1]) clientVersion = clientVerMatch[1];

  const seenVideoIds = new Set();
  const extractedVideos = [];

  const ytDataMatch = html.match(/var ytInitialData\s*=\s*(\{[\s\S]+?\});<\/script>/) ||
                      html.match(/ytInitialData\s*=\s*(\{[\s\S]+?\});/);
  let continuationToken = null;

  if (ytDataMatch && ytDataMatch[1]) {
    try {
      const ytData = JSON.parse(ytDataMatch[1]);
      extractAllVideos(ytData, channelTitle, seenVideoIds, extractedVideos);
      continuationToken = findContinuationToken(ytData);
    } catch {}
  }

  let paginationAttempts = 0;
  const maxPages = Math.ceil(requestedLimit / 25) + 3;

  while (extractedVideos.length < requestedLimit && continuationToken && innertubeApiKey && paginationAttempts < maxPages) {
    paginationAttempts++;
    try {
      const browseUrl = `https://www.youtube.com/youtubei/v1/browse?key=${innertubeApiKey}`;
      const browseRes = await fetch(browseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'X-YouTube-Client-Name': '1',
          'X-YouTube-Client-Version': clientVersion,
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
      extractAllVideos(browseData, channelTitle, seenVideoIds, extractedVideos);
      continuationToken = findContinuationToken(browseData);
    } catch {
      break;
    }
  }

  return extractedVideos.slice(0, requestedLimit);
}

module.exports = {
  fetchDirectChannelVideos
};
