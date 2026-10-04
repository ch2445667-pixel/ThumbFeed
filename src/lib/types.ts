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

export type VisualStyle = 
  | 'Face Close-up'
  | '3D Render / CGI'
  | 'Illustrated / Anime'
  | 'Minimalist & Clean'
  | 'Split Screen / Before-After'
  | 'Text-Heavy / Typography'
  | 'No-Text / Visual Hook'
  | 'High-Contrast Glow';

export type MediaKind = 'thumbnail' | 'poster';

export interface ThumbnailItem {
  id: string;
  // Absent means 'thumbnail'. Only posters carry kind: 'poster'.
  kind?: MediaKind;
  title: string;
  creator?: string;
  imageUrl: string;
  sourceUrl?: string;
  niche: NicheCategory;
  styles: VisualStyle[];
  tags: string[];
  colors?: string[];
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
  selectedStyles: VisualStyle[];
  /** Colour families, multi-select with OR matching. */
  selectedColors: string[];
  selectedEmotion?: string | null;
  sortBy: 'latest' | 'popular' | 'random';
}

