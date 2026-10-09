/**
 * End-to-end check that a custom upload lands in the uploads wall and does NOT
 * leak into the thumbnails wall.
 *
 *   node scripts/test_custom_upload.js
 *
 * POSTs one tiny PNG through the real upload route, then reads all three
 * sections back and prints where the row actually ended up.
 */

const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const ID = `upload-selftest-${Date.now()}`;

// 1x1 transparent PNG
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

(async () => {
  console.log(`posting custom upload ${ID}`);
  const res = await fetch(`${BASE}/api/supabase/upload-thumbnail`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      items: [
        {
          id: ID,
          kind: 'custom',
          imageUrl: `data:image/png;base64,${PNG.toString('base64')}`,
          title: 'Self test upload',
          creator: 'My Uploads',
          niche: 'Design',
          tags: ['Design', 'Self Test'],
        },
      ],
    }),
  });
  const body = await res.json();
  if (!res.ok) {
    console.error(`upload failed HTTP ${res.status}`, JSON.stringify(body).slice(0, 300));
    process.exit(1);
  }
  const first = body.items?.[0];
  console.log(`saved id=${first?.id} dbSaved=${first?.dbSaved} url=${String(first?.imageUrl).slice(0, 80)}`);

  for (const section of ['thumbnails', 'posters', 'uploads']) {
    const g = await fetch(`${BASE}/api/gallery?section=${section}&sort=latest`).then((r) => r.json());
    const ids = (g.items || []).map((i) => i.id);
    console.log(`${section.padEnd(11)} total=${g.total} containsTestRow=${ids.includes(ID)}`);
  }

  const f = await fetch(`${BASE}/api/gallery/facets?section=uploads`).then((r) => r.json());
  console.log(`uploads facets total=${f.total}`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});