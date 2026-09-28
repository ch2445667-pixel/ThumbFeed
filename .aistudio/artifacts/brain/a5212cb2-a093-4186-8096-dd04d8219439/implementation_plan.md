# Implementation Plan - Thumbnail Details Toggle & Automated YouTube Metadata

Enable an option toggle in the search and filter bar to reveal YouTube & creator details (channel name, video title, and view count) in a dedicated footer below thumbnail cards on the homefeed, while automatically fetching and caching metadata for YouTube-linked thumbnails.

---

## 1. User Requirements & Specification

1. **Option Toggle Button in Filter & Search Bar**:
   - Add a toggle button (e.g. "Card Info" / "Details" with icon) inside `FilterBar.tsx` alongside search and sort controls.
   - Persist user toggle state across page reloads in `localStorage` (`thumbfeed_show_card_info`).
   - Allow users to toggle on/off anytime.

2. **Card Footer Below Each Thumbnail**:
   - In `ThumbnailCard.tsx`, when the toggle is active:
     - If the item has metadata (`creator`, `title`, or `viewsEstimate`):
       - Render a sleek card footer below the 16:9 thumbnail preview.
       - Display channel name with an avatar/badge icon.
       - Display video title (2-line clamp or 1-line truncate with full hover title).
       - Display views count (e.g. "1.4M views", "820K views").
     - **Graceful Empty State**: If a thumbnail has no metadata to show, do not render any footer space—render solely the pure thumbnail image.

3. **Automated YouTube Video Metadata Fetching & Caching**:
   - Create a dedicated server-side API route `/api/youtube/details` that accepts YouTube video IDs / URLs and extracts:
     - Channel / author name
     - Video title
     - Accurate view count formatted cleanly (e.g. "2.4M views", "450K views")
   - Automatically detect YouTube-sourced thumbnails in the homefeed (by `sourceUrl`, `videoId`, or `img.youtube.com`/`i.ytimg.com` thumbnail URLs) that are missing creator or views.
   - Batch-fetch missing YouTube details in the background and cache them in local storage (`thumbvault_yt_metadata_cache_v1`) and update the in-memory/persisted records.

---

## 2. Proposed Changes & Architecture

### Backend & API
#### `src/app/api/youtube/details/route.ts`
- Implement a POST endpoint receiving `{ videoIds: string[] }` (up to 50 at a time).
- For each video ID:
  - Query YouTube oEmbed endpoint (`https://www.youtube.com/oembed?url=...`) for clean `author_name` and `title`.
  - Fetch video webpage headers/meta tags (`interactionCount` or initial data) to extract accurate `viewCount`.
  - Format views into human-friendly counts (`K`, `M`, `B`).
  - Return `{ details: Record<string, { title: string; creator: string; views: string }> }`.

### State Management & Storage
#### `src/lib/types.ts`
- Ensure `ThumbnailItem` properties `creator`, `viewsEstimate`, `title`, and `sourceUrl` are cleanly typed and integrated with `FilterState` or separate `showCardInfo: boolean` state.

#### `src/lib/youtubeMetadataCache.ts`
- Utility to:
  - Extract YouTube video ID from various YouTube URL formats.
  - Read/write cached YouTube metadata from `localStorage`.
  - Batch request missing video metadata in the background without blocking the UI.
  - Merge fetched metadata back into active thumbnail items.

### Frontend Components
#### `src/components/FilterBar.tsx`
- Add the `Show Details` switch/button in the controls row next to the sorting selector.
- Style with active indicator, icon, and clear accessibility attributes.

#### `src/components/ThumbnailCard.tsx`
- Refactor the card layout to support an optional footer below the 16:9 thumbnail when `showCardInfo` is enabled.
- Ensure 16:9 aspect ratio of the image remains strictly intact.
- Include channel name, title, and views count with crisp typography matching the design system (`#401D1A` mahogany and `#E4E0D3` warm cream / dark mode palette).
- If no metadata is available for an item, render only the thumbnail image without empty padding.

#### `src/app/page.tsx`
- Connect `showCardInfo` toggle state to `FilterBar` and `ThumbnailCard`.
- Trigger the automatic background metadata fetch for YouTube thumbnails when `showCardInfo` is enabled or on feed load.

---

## 3. Verification & Testing

1. **Toggle Interaction**:
   - Toggle button turns on/off in `FilterBar`.
   - Card footer appears under items with metadata; items without metadata remain purely thumbnail images.
   - Preference persists across browser reloads.
2. **YouTube Metadata Enrichment**:
   - Test YouTube-sourced thumbnails to ensure channel name, title, and views are automatically populated from the API.
   - Test cache persistence so subsequent loads don't make redundant network requests.
3. **Responsive Grid & Layout**:
   - Ensure the masonry/grid layout smoothly adapts whether the footer is visible or hidden.
   - Check mobile and desktop viewports.
4. **Build & Quality Check**:
   - Run `lint_applet` and `compile_applet` to confirm zero lint errors and successful compilation.
