# ⚡ ThumbVault — YouTube Thumbnail Inspiration & AI Tagger

An all-in-one inspiration vault, tagging engine, and moodboard platform created for YouTube thumbnail designers and creators.

---

## 🚀 Quickstart Guide (Running Locally)

To start the ThumbVault web app on your computer:

```bash
# 1. Navigate to the project directory
cd C:\Users\ch244\.gemini\antigravity\scratch\thumbvault

# 2. Run the development server
npm run dev
```

Then open your browser to: **`http://localhost:3000`**

---

## 🎨 Features & Capabilities

1. **Inspiration Gallery**: Fluid masonry grid with instant filtering by:
   - **Niche** (Gaming, Tech, Finance, Storytelling, Fitness, etc.)
   - **Visual Style** (Face close-up, 3D render, Clean/Minimal, Split-screen, High-contrast glow)
   - **Dominant Color Palette** (Red, Yellow, Neon Green, Cyan, Purple, Slate)
   - **Keywords & OCR Text Hooks**
2. **Deep Inspection Modal**:
   - Full HD zoom
   - 1-Click Dominant Color HEX code copy
   - Detected text on image (OCR)
   - "Why it converts" breakdown analysis notes
   - AI Design prompt generator (for Midjourney / Photoshop / Canva)
3. **Personal Moodboards & Collections**:
   - Create custom boards (e.g. *"Next Gaming Video References"*, *"Clean Tech Style"*)
   - Export moodboard references to `.json`
4. **AI Auto-Tagging & Admin Hub (`/admin`)**:
   - Paste any YouTube link or upload an image
   - AI automatically detects niche, colors, styles, and text
   - Full manual override before publishing
5. **1-Click YouTube Chrome Extension (`/extension`)**:
   - Grab the maximum resolution thumbnail directly while browsing YouTube
6. **1,000+ Pinterest Bulk Importer (`scripts/pinterest_importer.py`)**:
   - Bulk-tag and migrate your Pinterest board images
