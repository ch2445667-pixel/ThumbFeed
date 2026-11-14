import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { extractItemFingerprint, deduplicateThumbnailItems } from './thumbnailDedupe';
import { ThumbnailItem } from './types';

function makeItem(overrides: Partial<ThumbnailItem>): ThumbnailItem {
  return {
    id: 'thumb-1',
    title: 'Sample Thumbnail',
    creator: 'Creator',
    imageUrl: '/api/media/sample_abc12.jpg',
    niche: 'Tech',
    styles: ['Minimalist & Clean'],
    tags: ['Tech'],
    source: 'r2-storage',
    createdAt: '2026-01-01T00:00:00.000Z',
    likesCount: 10,
    ...overrides,
  };
}

describe('thumbnailDedupe', () => {
  it('collapses repeated uploads with chained random suffixes into a single item', () => {
    const a = makeItem({
      id: 'img-1',
      title: 'How We Built a $100K Agency',
      imageUrl: '/api/media/how_we_built_a_100k_agency_8cph1_6xwjz.jpg',
      viewsEstimate: '250K',
      styles: ['Minimalist & Clean', 'Text-Heavy / Typography'],
      colors: ['#111111', '#ffffff'],
    });
    const b = makeItem({
      id: 'r2-how_we_built_a_100k_agency_etrl9_70mjv_jpg',
      title: 'how we built a 100k agency etrl9',
      creator: 'Cloudflare R2',
      imageUrl: '/api/media/how_we_built_a_100k_agency_etrl9_70mjv.jpg',
      styles: ['Minimalist & Clean'],
    });

    assert.equal(extractItemFingerprint(a), extractItemFingerprint(b));
    const result = deduplicateThumbnailItems([b, a]);
    assert.equal(result.length, 1);
    assert.equal(result[0].id, 'img-1');

    const agencyA = makeItem({
      id: 'r2-v2_The_Most_Valuable_Agency_Offers_Train_8cph1_6xwjz_jpg',
      title: 'The Most Valuable Agency Offers Train',
      creator: 'Cloudflare R2',
      imageUrl: '/api/media/v2_The_Most_Valuable_Agency_Offers_Train_8cph1_6xwjz.jpg',
    });
    const agencyB = makeItem({
      id: 'r2-v2_The_Most_Valuable_Agency_Offers_Train_etrl9_70mjv_jpg',
      title: 'Agency Offers System Breakdown',
      creator: 'Cloudflare R2',
      imageUrl: '/api/media/v2_The_Most_Valuable_Agency_Offers_Train_etrl9_70mjv.jpg',
    });
    assert.equal(extractItemFingerprint(agencyA), extractItemFingerprint(agencyB));
    assert.equal(deduplicateThumbnailItems([agencyA, agencyB]).length, 1);
  });

  it('deduplicates YouTube items sharing an 11-char video ID', () => {
    const direct = makeItem({
      id: 'thumb-yt-dQw4w9WgXcQ',
      imageUrl: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
      viewsEstimate: '1.4B',
    });
    const r2Copy = makeItem({
      id: 'r2-dQw4w9WgXcQ_ab12c_jpg',
      creator: 'Cloudflare R2',
      imageUrl: '/api/media/dQw4w9WgXcQ_ab12c.jpg',
    });

    const result = deduplicateThumbnailItems([r2Copy, direct]);
    assert.equal(result.length, 1);
    assert.equal(result[0].id, 'thumb-yt-dQw4w9WgXcQ');
  });

  it('drops preview-only /media/small/ items', () => {
    const preview = makeItem({
      id: 'r2-small_hero_jpg',
      imageUrl: '/api/media/small/hero.webp',
    });
    const full = makeItem({
      id: 'img-hero',
      imageUrl: '/api/media/hero_abc12.jpg',
    });

    const result = deduplicateThumbnailItems([preview, full]);
    assert.equal(result.length, 1);
    assert.equal(result[0].id, 'img-hero');
  });
});
