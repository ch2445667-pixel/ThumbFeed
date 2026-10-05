/**
 * Fetch real view counts and publish dates from YouTube and store them.
 *
 *   node scripts/fetch-stats.mjs --dry-run
 *   node scripts/fetch-stats.mjs
 *
 * The importer wrote view text scraped from the channel grid ("423K views
 * views", "2 million views") and, for 27 rows, a relative note ("Published:
 * 6mo ago"). Neither is real data. This walks every thumb-yt-* row, asks the
 * InnerTube player endpoint for the exact viewCount and ISO publishDate, and
 * writes both.
 *
 * - views_estimate  "423K views" / "1.2M views" / "847 views"
 * - created_at      the video's real publish date, so "3mo ago" is real
 * - breakdown_notes gains a "Published: YYYY-MM-DD" marker
 *
 * Resumable: rows that already carry an exact-looking value are skipped, so an
 * interrupted run continues where it stopped. Nothing else is touched.
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\//, '').replace(/%20/g, ' ')), '..');

function readEnv(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

const ENV = { ...readEnv(path.join(ROOT, '.env')), ...process.env };
const SUPABASE_URL = ENV.NEXT_PUBLIC_SUPABASE_URL || 'https://xahchsuffmskbgvnxcgs.supabase.co';
const SERVICE_KEY = ENV.SUPABASE_SERVICE_ROLE_KEY;
const HEADERS_AUTH = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` };
const HEADERS_JSON = { ...HEADERS_AUTH, 'Content-Type': 'application/json' };

const INNERTUBE_KEY = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';
const CLIENT_VERSION = '2.20260820.08.00';
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const dryRun = process.argv.includes('--dry-run');
const CONCURRENCY = 2;

/**
 * K under a million, M above, as the card displays it. "847 views" stays
 * exact because rounding it to "1K" would misstate a real number.
 */
export function formatViews(n) {
  if (!Number.isFinite(n) || n < 0) return null;
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    // One decimal below 10M ("2.1M"), whole numbers above ("18M").
    return `${m < 10 ? m.toFixed(1).replace(/\.0$/, '') : Math.round(m)}M views`;
  }
  if (n >= 1_000) {
    const k = n / 1_000;
    return `${k < 10 ? k.toFixed(1).replace(/\.0$/, '') : Math.round(k)}K views`;
  }
  return `${n} view${n === 1 ? '' : 's'}`;
}

/** ISO timestamp -> YYYY-MM-DD in UTC. */
function isoToDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

/**
 * The public watch page carries the same numbers as the player endpoint inside
 * ytInitialPlayerResponse, and unlike the API it does not ask for a login once
 * the request volume climbs.
 */
async function fetchStatsFromWatchPage(videoId) {
  const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9' },
  });
  if (!res.ok) throw new Error(`watch page HTTP ${res.status}`);
  const html = await res.text();
  const views = /"viewCount":"(\d+)"/.exec(html);
  const date = /"(?:uploadDate|publishDate)":"(\d{4}-\d{2}-\d{2})/.exec(html);
  if (!views || !date) throw new Error('watch page had no stats');
  return {
    views: Number(views[1]),
    date: date[1],
    title: /<title>([^<]+)<\/title>/.exec(html)?.[1] || null,
  };
}

async function fetchStats(videoId) {
  const attempt = async (via) => {
    const res = await fetch(`https://www.youtube.com/youtubei/v1/player?key=${INNERTUBE_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': UA,
        'X-YouTube-Client-Name': '1',
        'X-YouTube-Client-Version': CLIENT_VERSION,
      },
      body: JSON.stringify({
        context: { client: { clientName: 'WEB', clientVersion: CLIENT_VERSION, hl: 'en', gl: 'US' } },
        videoId,
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const views = json?.videoDetails?.viewCount;
    const micro = json?.microformat?.playerMicroformatRenderer;
    const date = isoToDate(micro?.publishDate || micro?.uploadDate);
    if (!views || !date) {
      throw new Error(json?.playabilityStatus?.status || 'no stats');
    }
    return { views: Number(views), date, title: json?.videoDetails?.title, via };
  };

  try {
    return await attempt('api');
  } catch (apiErr) {
    try {
      const fromPage = await fetchStatsFromWatchPage(videoId);
      return { ...fromPage, via: 'watch-page' };
    } catch {
      throw apiErr;
    }
  }
}

/** Ids are thumb-yt-<videoId>, which is how the importer wrote them. */
const videoIdFromRowId = (rowId) =>
  rowId.startsWith('thumb-yt-') ? rowId.slice('thumb-yt-'.length) : null;

async function fetchAllRows() {
  const rows = [];
  const page = 1000;
  for (let from = 0; ; from += page) {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/thumbnails?source=eq.supabase-storage&id=like.thumb-yt-*` +
        `&select=id,title,views_estimate,created_at,breakdown_notes&order=id&limit=${page}&offset=${from}`,
      { headers: HEADERS_AUTH }
    );
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    const batch = await res.json();
    rows.push(...batch);
    if (batch.length < page) break;
  }
  return rows;
}

/** Dimensions ride at the tail of breakdown_notes; keep them through the rewrite. */
function preserveDimensions(existing, rebuilt) {
  const m = /\|\s*(\d+)x(\d+)\s*$/.exec(String(existing || ''));
  return m ? `${rebuilt} | ${m[1]}x${m[2]}` : rebuilt;
}

async function patchRow(id, patch) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/thumbnails?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: HEADERS_JSON,
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
}

const rows = await fetchAllRows();

const alreadyDone = (r) =>
  /^\d+[KMB]? views?$/.test(String(r.views_estimate || '').trim()) &&
  /^\d{4}-\d{2}-\d{2}/.test(String(r.created_at || ''));

const todo = dryRun || process.argv.includes('--force') ? rows : rows.filter((r) => !alreadyDone(r));

console.log(`mode      : ${dryRun ? 'DRY RUN' : 'live'}`);
console.log(`rows total: ${rows.length}`);
console.log(`already ok: ${rows.length - todo.length}`);
console.log(`to fetch  : ${todo.length}`);
console.log('');

let done = 0;
let failed = 0;
const failures = [];
const totalViews = [];
// YouTube answers LOGIN_REQUIRED after a burst of API calls, so slow down once
// failures start rather than burning the whole remaining queue on them.
let consecutiveFailures = 0;

for (let i = 0; i < todo.length; i += CONCURRENCY) {
  const slice = todo.slice(i, i + CONCURRENCY);
  const settled = await Promise.all(
    slice.map(async (row) => {
      const videoId = videoIdFromRowId(row.id);
      if (!videoId) return { row, error: 'no video id in row id' };
      try {
        const stats = await fetchStats(videoId);
        return { row, stats };
      } catch (err) {
        return { row, error: err.message };
      }
    })
  );

  for (const { row, stats, error } of settled) {
    if (error) {
      failed += 1;
      failures.push({ id: row.id, error });
      consecutiveFailures += 1;
      // Back off progressively. The watch-page fallback in fetchStats already
      // covers a single rejected call; this covers a sustained block.
      if (consecutiveFailures === 10 || consecutiveFailures === 40 || consecutiveFailures === 120) {
        const pauseMs = consecutiveFailures * 2000;
        console.log(`  ${consecutiveFailures} consecutive failures, pausing ${pauseMs / 1000}s`);
        await new Promise((r) => setTimeout(r, pauseMs));
      }
      continue;
    }
    consecutiveFailures = 0;
    const viewsText = formatViews(stats.views);
    totalViews.push(stats.views);

    const noteMatch = /Published:\s*\d{4}-\d{2}-\d{2}/.test(String(row.breakdown_notes || ''))
      ? String(row.breakdown_notes).replace(/Published:\s*\d{4}-\d{2}-\d{2}/, '').replace(/^\s*\|\s*/, '').trim()
      : String(row.breakdown_notes || '').replace(/\s*\|\s*\d+x\d+\s*$/, '').trim();

    const rebuilt = noteMatch || `Published: ${stats.date}`;
    const withDate = noteMatch.includes('Published:')
      ? noteMatch.replace(/Published:\s*\d{4}-\d{2}-\d{2}/, `Published: ${stats.date}`)
      : `${noteMatch} Published: ${stats.date}`.trim();

    if (!dryRun) {
      try {
        await patchRow(row.id, {
          views_estimate: viewsText,
          created_at: `${stats.date}T00:00:00+00:00`,
          breakdown_notes: preserveDimensions(row.breakdown_notes, withDate),
        });
      } catch (patchErr) {
        failed += 1;
        failures.push({ id: row.id, error: `patch: ${patchErr.message}` });
        continue;
      }
    }
    done += 1;
  }

  if ((i + CONCURRENCY) % 40 === 0 || i + CONCURRENCY >= todo.length) {
    const pct = Math.round(((i + CONCURRENCY) / todo.length) * 100);
    console.log(`${done}/${todo.length} (${pct}%) failed: ${failed}`);
  }
}

console.log('');
console.log('=== DONE ===');
console.log(`updated : ${done}`);
console.log(`failed  : ${failed}`);
if (totalViews.length) {
  const sum = totalViews.reduce((a, b) => a + b, 0);
  console.log(`total views across updated rows: ${sum.toLocaleString('en-US')}`);
}
if (failures.length) {
  console.log('\nfailures (re-run to retry these):');
  for (const f of failures.slice(0, 20)) console.log(`  ${f.id}: ${f.error}`);
  if (failures.length > 20) console.log(`  ... and ${failures.length - 20} more`);
}