export type NicheCategory = 
  | 'IRL'
  | 'Business'
  | 'Tech'
  | 'Entertainment'
  | 'Gaming'
  | 'Sports'
  | 'Documentary'
  | 'Educational'
  | (string & {});

/**
 * 'custom' is the user's own uploads, kept as a separate wall. It has to be
 * distinguishable in the database, not just in the UI, or a custom upload would
 * land in the thumbnails section.
 */
export type MediaKind = 'thumbnail' | 'poster' | 'custom';

export interface ThumbnailItem {
  id: string;
  // Absent means 'thumbnail'. Only posters carry kind: 'poster'.
  kind?: MediaKind;
  title: string;
  creator?: string;
  imageUrl: string;
  sourceUrl?: string;
  niche: NicheCategory;
  tags: string[];
  colors?: string[];
  /**
   * Grid-sized variant (400px WebP) served in the wall. The full original in
   * imageUrl loads only when a tile is opened. Absent until the backfill and
   * for rows uploaded before it -- the card falls back to imageUrl.
   */
  thumbSmallUrl?: string;
  /**
   * Intrinsic pixel size, recorded at upload time so a card can reserve its
   * exact box before the image loads. Without this, masonry re-balances as
   * images arrive and tiles visibly jump.
   */
  width?: number;
  height?: number;
  ocrText?: string;
  emotion?: 'Shocked' | 'Intense' | 'Curious' | 'Happy' | 'Mysterious' | 'Urgent' | 'Confident';
  breakdownNotes?: string;
  viewsEstimate?: string;
  subscribersCount?: string;
  publishedTime?: string;
  source: 'pinterest' | 'youtube' | 'upload' | 'curated' | 'supabase-storage';
  createdAt: string;
  likesCount?: number;
}

export interface CollectionBoard {
  id: string;
  name: string;
  description?: string;
  thumbnailIds: string[];
  createdAt: string;
  colorTheme?: string;
}

export interface FilterState {
  searchQuery: string;
  selectedNiche: NicheCategory | 'All';
  /** Colour families, multi-select with OR matching. */
  selectedColors: string[];
  selectedEmotion?: string | null;
  sortBy: 'latest' | 'popular' | 'random';
}

