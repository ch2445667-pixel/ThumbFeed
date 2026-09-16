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

export interface ThumbnailItem {
  id: string;
  title: string;
  creator?: string;
  imageUrl: string;
  sourceUrl?: string;
  niche: NicheCategory;
  styles: VisualStyle[];
  tags: string[];
  colors?: string[];
  ocrText?: string;
  emotion?: 'Shocked' | 'Intense' | 'Curious' | 'Happy' | 'Mysterious' | 'Urgent' | 'Confident';
  breakdownNotes?: string;
  viewsEstimate?: string;
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
  selectedColor?: string | null;
  selectedEmotion?: string | null;
  sortBy: 'latest' | 'popular' | 'random';
}

