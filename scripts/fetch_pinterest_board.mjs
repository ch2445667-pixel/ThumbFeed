import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BOARD_URL = "https://www.pinterest.com/tanzeelgfx/youtube-thumbnail-designs/";
const MOCK_DATA_PATH = path.join(__dirname, "..", "src", "lib", "mockData.ts");

const NICHES = [
  'Gaming',
  'Tech & AI',
  'Finance & Crypto',
  'Storytelling & Documentary',
  'Education & Science',
  'Fitness & Health',
  'Entertainment & Challenge',
  'Lifestyle & Vlog'
];

const STYLES_LIST = [
  ['Face Close-up', 'High-Contrast Glow'],
  ['3D Render / CGI', 'Text-Heavy / Typography'],
  ['Minimalist & Clean', 'No-Text / Visual Hook'],
  ['Split Screen / Before-After', 'High-Contrast Glow'],
  ['Illustrated / Anime', 'High-Contrast Glow']
];

const COLOR_SETS = [
  ['#ef4444', '#0f172a', '#fbbf24', '#ffffff'],
  ['#06b6d4', '#6366f1', '#111827', '#e11d48'],
  ['#10b981', '#09090b', '#22c55e', '#ffffff'],
  ['#f97316', '#dc2626', '#1e1b4b', '#facc15'],
  ['#8b5cf6', '#ec4899', '#0f172a', '#38bdf8']
];

async function fetchBoard() {
  console.log(`Connecting to Pinterest Board: ${BOARD_URL}...`);

  try {
    const res = await fetch(BOARD_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });

    const html = await res.text();
    console.log(`Retrieved Pinterest page HTML (${html.length} chars)`);

    const regex = /https:\/\/i\.pinimg\.com\/[0-9a-zA-Z_x/-]+\.jpg/g;
    const matches = html.match(regex) || [];

    const seen = new Set();
    const cleanedImages = [];

    for (const img of matches) {
      const hd = img.replace(/\/(236x|474x|170x|60x60)\//, '/736x/');
      if (!seen.has(hd) && !hd.includes('60x60') && !hd.includes('75x75') && !hd.includes('user_avatars')) {
        seen.add(hd);
        cleanedImages.push(hd);
      }
    }

    console.log(`Discovered ${cleanedImages.length} pin images from your board!`);

    if (cleanedImages.length === 0) {
      console.log("No raw image URLs parsed directly. Pinterest may require cookie / rendered tokens.");
      return;
    }

    const items = cleanedImages.map((imgUrl, idx) => {
      const niche = NICHES[idx % NICHES.length];
      const styles = STYLES_LIST[idx % STYLES_LIST.length];
      const colors = COLOR_SETS[idx % COLOR_SETS.length];

      return {
        id: `pin-${idx + 1}`,
        title: `TanzeelGFX Inspiration #${idx + 1} (${niche})`,
        creator: 'TanzeelGFX Board',
        imageUrl: imgUrl,
        sourceUrl: BOARD_URL,
        niche: niche,
        styles: styles,
        tags: ['TanzeelGFX', 'Pinterest', 'YouTube Hook', 'High CTR', niche],
        colors: colors,
        ocrText: '',
        emotion: 'Curious',
        breakdownNotes: `Curated from TanzeelGFX YouTube Thumbnail Designs board for ${niche} creators.`,
        viewsEstimate: `${(1.2 + (idx * 0.25)).toFixed(1)}M`,
        source: 'pinterest',
        createdAt: new Date().toISOString().split('T')[0],
        likesCount: 150 + ((idx * 17) % 350)
      };
    });

    const fileContent = `import { ThumbnailItem } from './types';\n\nexport const INITIAL_THUMBNAILS: ThumbnailItem[] = ${JSON.stringify(items, null, 2)};\n`;
    fs.writeFileSync(MOCK_DATA_PATH, fileContent, 'utf-8');

    console.log(`\n🎉 SUCCESS! Populated ${items.length} thumbnails directly from your Pinterest board into THUMBSY!`);

  } catch (err) {
    console.error('Error fetching Pinterest board:', err);
  }
}

fetchBoard();
