import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { extractExactPalette } from '../../../lib/colorExtract';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { imageUrl, videoTitle } = body;

    if (!imageUrl) {
      return NextResponse.json({ error: 'Image URL is required' }, { status: 400 });
    }

    let imageBuffer: Buffer | null = null;
    let base64Data = '';
    let mimeType = 'image/jpeg';

    if (imageUrl.startsWith('data:')) {
      mimeType = imageUrl.split(';')[0].replace('data:', '') || 'image/jpeg';
      base64Data = imageUrl.split(',')[1];
      imageBuffer = Buffer.from(base64Data, 'base64');
    } else if (imageUrl.startsWith('http')) {
      const imgRes = await fetch(imageUrl);
      if (imgRes.ok) {
        const arrayBuf = await imgRes.arrayBuffer();
        imageBuffer = Buffer.from(arrayBuf);
        base64Data = imageBuffer.toString('base64');
        mimeType = imgRes.headers.get('content-type') || 'image/jpeg';
      }
    }

    // Extract exact real pixel palette
    const realPixelColors = imageBuffer ? await extractExactPalette(imageBuffer) : ['#FF3366', '#3B82F6', '#0F172A', '#FFFFFF'];

    const apiKey = process.env.GEMINI_API_KEY;

    // If Gemini API Key is available, enhance with AI tagger & OCR
    if (apiKey && base64Data) {
      try {
        const ai = new GoogleGenAI({ apiKey });
        const promptText = `Analyze this YouTube thumbnail image.
Video Title (if any): "${videoTitle || 'N/A'}"

Return STRICT JSON only with this schema:
{
  "title": "A short, descriptive, clean title for this thumbnail (no file extensions)",
  "niche": "IRL | Business | Tech | Entertainment | Gaming | Sports | Documentary | Educational",
  "tags": ["5 to 7 high-value keyword tags"],
  "ocrText": "Exact text visible on the thumbnail, or empty string",
  "emotion": "Shocked | Intense | Curious | Happy | Mysterious | Urgent | Confident",
  "breakdownNotes": "1-2 sentences explaining the visual hook"
}`;

        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: [
            {
              inlineData: {
                mimeType,
                data: base64Data,
              }
            },
            promptText
          ],
          config: {
            responseMimeType: 'application/json',
          }
        });

        if (response && response.text) {
          const parsed = JSON.parse(response.text);
          return NextResponse.json({
            success: true,
            data: {
              ...parsed,
              colors: realPixelColors // Always use real pixel colors
            },
            engine: 'gemini-vision + pixel-extractor'
          });
        }
      } catch (err) {
        console.warn('Gemini AI Vision tagger error:', err);
      }
    }

    // Heuristic classification fallback
    const lower = (videoTitle || imageUrl).toLowerCase();
    let niche = 'Tech';
    let tags = ['YouTube Thumbnail', 'High CTR', 'Visual Hook', 'Content Creator'];

    if (
      lower.includes('documentary') || lower.includes('geopolitical') || lower.includes('history') ||
      lower.includes('mystery') || lower.includes('truth') || lower.includes('investigation') ||
      lower.includes('dark reality') || lower.includes('untold story') || lower.includes('crime') ||
      lower.includes('downfall') || lower.includes('conspiracy') || lower.includes('scam')
    ) {
      niche = 'Documentary';
      tags = ['Documentary', 'Deep Dive', 'True Story', 'Investigation', 'Curiosity'];
    } else if (
      lower.includes('vlog') || lower.includes('lifestyle') || lower.includes('daily') ||
      lower.includes('routine') || lower.includes('day in') || lower.includes('living in') ||
      lower.includes('fashion') || lower.includes('travel') || lower.includes('room') ||
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

    return NextResponse.json({
      success: true,
      data: {
        title: videoTitle || 'Curated High-CTR Thumbnail',
        niche,
        styles: ['Face Close-up', 'High-Contrast Glow'],
        tags,
        colors: realPixelColors,
        ocrText: '',
        emotion: 'Curious',
        breakdownNotes: 'Clean visual contrast and focal hierarchy designed for maximum click-through rate.'
      },
      engine: 'sharp-pixel-extractor'
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to extract thumbnail metadata' }, { status: 500 });
  }
}
