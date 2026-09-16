import urllib.request
import re
import json
import uuid
import os
from datetime import datetime

BOARD_URL = "https://www.pinterest.com/tanzeelgfx/youtube-thumbnail-designs/"
MOCK_DATA_PATH = os.path.join(os.path.dirname(__file__), "..", "src", "lib", "mockData.ts")

def infer_metadata_from_index(idx, img_url):
    niches = [
        'Gaming',
        'Tech & AI',
        'Finance & Crypto',
        'Storytelling & Documentary',
        'Education & Science',
        'Fitness & Health',
        'Entertainment & Challenge',
        'Lifestyle & Vlog'
    ]
    styles_list = [
        ['Face Close-up', 'High-Contrast Glow'],
        ['3D Render / CGI', 'Text-Heavy / Typography'],
        ['Minimalist & Clean', 'No-Text / Visual Hook'],
        ['Split Screen / Before-After', 'High-Contrast Glow'],
        ['Illustrated / Anime', 'High-Contrast Glow']
    ]
    color_sets = [
        ['#ef4444', '#0f172a', '#fbbf24', '#ffffff'],
        ['#06b6d4', '#6366f1', '#111827', '#e11d48'],
        ['#10b981', '#09090b', '#22c55e', '#ffffff'],
        ['#f97316', '#dc2626', '#1e1b4b', '#facc15'],
        ['#8b5cf6', '#ec4899', '#0f172a', '#38bdf8']
    ]
    
    niche = niches[idx % len(niches)]
    styles = styles_list[idx % len(styles_list)]
    colors = color_sets[idx % len(color_sets)]
    
    return niche, styles, colors

def fetch_and_import():
    print(f"Connecting to Pinterest board: {BOARD_URL}...")
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
    }
    
    req = urllib.request.Request(BOARD_URL, headers=headers)
    try:
        with urllib.request.urlopen(req) as resp:
            html = resp.read().decode('utf-8')
    except Exception as e:
        print(f"Error fetching URL: {e}")
        return

    # Extract all high-res pin images (originals or 736x)
    raw_images = re.findall(r'https://i\.pinimg\.com/[0-9a-zA-Z_x/-]+\.jpg', html)
    
    # Filter and convert to high resolution 736x or originals
    cleaned_images = []
    seen = set()
    for img in raw_images:
        # upgrade 236x or 474x to 736x for crisp display
        hd_img = re.sub(r'/(236x|474x|170x|60x60)/', '/736x/', img)
        if hd_img not in seen and not any(k in hd_img for k in ['60x60', '75x75']):
            seen.add(hd_img)
            cleaned_images.append(hd_img)
            
    print(f"Discovered {len(cleaned_images)} high-res Pinterest thumbnails from your board!")
    
    if len(cleaned_images) == 0:
        print("Pinterest requires rendered JavaScript. Generating collection...")
        return
        
    items = []
    for idx, img_url in enumerate(cleaned_images, 1):
        niche, styles, colors = infer_metadata_from_index(idx, img_url)
        item = {
            "id": f"pin-{idx}-{uuid.uuid4().hex[:6]}",
            "title": f"YouTube Thumbnail Inspiration #{idx}",
            "creator": "TanzeelGFX Board",
            "imageUrl": img_url,
            "sourceUrl": BOARD_URL,
            "niche": niche,
            "styles": styles,
            "tags": ["TanzeelGFX", "Pinterest", "High CTR", "YouTube Hook", niche],
            "colors": colors,
            "ocrText": "",
            "emotion": "Curious",
            "breakdownNotes": "Curated from TanzeelGFX Pinterest YouTube Thumbnail Designs board.",
            "viewsEstimate": f"{round(1.2 + (idx * 0.3), 1)}M",
            "source": "pinterest",
            "createdAt": datetime.utcnow().strftime("%Y-%m-%d"),
            "likesCount": 120 + (idx * 13 % 400)
        }
        items.append(item)

    mock_data_content = f"""import {{ ThumbnailItem }} from './types';

export const INITIAL_THUMBNAILS: ThumbnailItem[] = {json.dumps(items, indent=2)};
"""
    with open(MOCK_DATA_PATH, 'w', encoding='utf-8') as f:
        f.write(mock_data_content)
        
    print(f"Successfully populated {len(items)} Pinterest thumbnails into THUMBSY!")

if __name__ == '__main__':
    fetch_and_import()
