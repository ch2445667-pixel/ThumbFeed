/**
 * Verify the AddModal's YouTube-into-My-Uploads path end to end.
 *
 *   node scripts/test_upload_to_custom_wall.js
 *
 * Posts a real YouTube video thumbnail through the upload route with
 * kind 'custom' and a videoId -- the exact shape the YouTube tab sends. The
 * id must come back prefixed upload-, and the row must appear ONLY in the
 * uploads wall, never in thumbnails or posters.
 */

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const STAMP = Date.now();
const VIDEO_ID = 'dQw4w9WgXcQ';

(async () => {
  const id = `upload-selftest-yt-${STAMP}`;
  console.log(`posting custom upload from a YouTube videoId -> ${id}`);

  const res = await fetch(`${BASE}/api/supabase/upload-thumbnail`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      items: [
        {
          id,
          kind: 'custom',
          videoId: VIDEO_ID,
          imageUrl: `https://i.ytimg.com/vi/${VIDEO_ID}/maxresdefault.jpg`,
          sourceUrl: `https://www.youtube.com/watch?v=${VIDEO_ID}`,
          title: 'Self test: YouTube into My Uploads',
          creator: 'My Uploads',
          niche: 'Entertainment',
          tags: ['Entertainment', 'Self Test'],
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
  console.log(`saved id=${first?.id} dbSaved=${first?.dbSaved}`);

  const prefixesCorrect = String(first?.id || '').startsWith('upload-');
  console.log(`id prefixed upload-: ${prefixesCorrect}`);

  let leaked = false;
  for (const section of ['thumbnails', 'posters', 'uploads']) {
    const g = await fetch(`${BASE}/api/gallery?section=${section}&sort=latest`).then((r) => r.json());
    const present = (g.items || []).some((i) => String(i.id).startsWith('upload-selftest-yt-'));
    console.log(`${section.padEnd(11)} total=${g.total} hasTestRow=${present}`);
    if (present && section !== 'uploads') leaked = true;
  }

  console.log(leaked ? '\nFAIL: row leaked out of the uploads wall' : '\nPASS: row is confined to the uploads wall');
  process.exit(leaked ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});