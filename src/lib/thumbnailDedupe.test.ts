import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { extractItemFingerprint, deduplicateThumbnailItems } from './thumbnailDedupe';
import { extractDedupeKeys } from './storage';
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

  it('deduplicates YouTube items sharing an 11-char video ID (including ch-yt- prefix)', () => {
    const direct = makeItem({
      id: 'thumb-yt-dQw4w9WgXcQ',
      imageUrl: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
      viewsEstimate: '1.4B',
    });
    const chCopy = makeItem({
      id: 'ch-yt-dQw4w9WgXcQ',
      creator: 'Channel Import',
      imageUrl: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
    });
    const r2Copy = makeItem({
      id: 'r2-dQw4w9WgXcQ_ab12c_jpg',
      creator: 'Cloudflare R2',
      imageUrl: '/api/media/dQw4w9WgXcQ_ab12c.jpg',
    });

    const result = deduplicateThumbnailItems([r2Copy, chCopy, direct]);
    assert.equal(result.length, 1);
    assert.equal(result[0].id, 'thumb-yt-dQw4w9WgXcQ');
  });

  it('keeps distinct YouTube channel items ending in maxresdefault.jpg separate in extractDedupeKeys and deduplicateThumbnailItems', () => {
    const videos = [
      {
        id: 'yt-ch-dQw4w9WgXcQ',
        videoId: 'dQw4w9WgXcQ',
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        imageUrl: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
        title: 'Video One',
      },
      {
        id: 'yt-ch-9bZkp7q19f0',
        videoId: '9bZkp7q19f0',
        url: 'https://www.youtube.com/watch?v=9bZkp7q19f0',
        imageUrl: 'https://i.ytimg.com/vi/9bZkp7q19f0/maxresdefault.jpg',
        title: 'Video Two',
      },
      {
        id: 'yt-ch-kJQP7kiw5Fk',
        videoId: 'kJQP7kiw5Fk',
        url: 'https://www.youtube.com/watch?v=kJQP7kiw5Fk',
        imageUrl: 'https://i.ytimg.com/vi/kJQP7kiw5Fk/maxresdefault.jpg',
        title: 'Video Three',
      },
    ];

    const seen = new Set<string>();
    const kept: typeof videos = [];
    for (const v of videos) {
      const keys = extractDedupeKeys(v);
      assert.ok(!keys.includes('maxresdefault'), 'generic maxresdefault must not be a dedupe key');
      assert.ok(!keys.includes('maxresdefault.jpg'), 'generic maxresdefault.jpg must not be a dedupe key');
      if (!keys.some((k) => seen.has(k))) {
        keys.forEach((k) => seen.add(k));
        kept.push(v);
      }
    }
    assert.equal(kept.length, 3);

    const galleryItems = videos.map((v) =>
      makeItem({
        id: `thumb-yt-${v.videoId}`,
        imageUrl: v.imageUrl,
        sourceUrl: v.url,
        title: v.title,
      })
    );
    assert.equal(deduplicateThumbnailItems(galleryItems).length, 3);
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
