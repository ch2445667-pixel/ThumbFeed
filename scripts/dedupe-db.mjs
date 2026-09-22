import fs from 'fs';
import { normalizeExisting } from './tagger-rules.mjs';

const SUPABASE_URL = 'https://xahchsuffmskbgvnxcgs.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_QprT-ekIg6xv77IwL9p81g_GR5-tdiy';
const H = { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + SUPABASE_ANON_KEY, 'Content-Type': 'application/json' };
const DRY = process.argv.includes('--dry');

async function getJson(url, attempt = 1) {
  try {
    const r = await fetch(url, { headers: H });
    if (!r.ok && r.status >= 500 && attempt <= 4) {
      await new Promise(res => setTimeout(res, 1500 * attempt));
      return getJson(url, attempt + 1);
    }
    if (!r.ok) throw new Error('fetch failed ' + r.status);
    return r.json();
  } catch (e) {
    if (attempt <= 4) {
      await new Promise(res => setTimeout(res, 1500 * attempt));
      return getJson(url, attempt + 1);
    }
    throw e;
  }
}

async function writeReq(url, method, body, attempt = 1) {
  try {
    const r = await fetch(url, {
      method, headers: { ...H, Prefer: 'return=minimal' },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    if ((!r.ok && r.status >= 500) && attempt <= 5) {
      await new Promise(res => setTimeout(res, 1500 * attempt));
      return writeReq(url, method, body, attempt + 1);
    }
    return r;
  } catch (e) {
    if (attempt <= 5) {
      await new Promise(res => setTimeout(res, 1500 * attempt));
      return writeReq(url, method, body, attempt + 1);
    }
    throw e;
  }
}
async function fetchAll() {
  let all = [];
  let from = 0;
  const step = 1000;
  while (true) {
    const j = await getJson(`${SUPABASE_URL}/rest/v1/thumbnails?select=id,title,image_url,niche,tags,created_at&order=created_at.asc&limit=${step}&offset=${from}`);
    all.push(...j);
    if (j.length < step) break;
    from += step;
  }
  return all;
}

async function run() {
  const all = await fetchAll();
  console.log('total rows:', all.length);

  // Group by exact image_url; NEVER touch rows with empty/invalid urls
  const groups = new Map();
  const untouched = [];
  for (const row of all) {
    const u = (row.image_url || '').trim();
    if (!u || !/^https?:\/\//i.test(u)) { untouched.push(row.id); continue; }
    if (!groups.has(u)) groups.set(u, []);
    groups.get(u).push(row);
  }
  const dupGroups = [...groups.entries()].filter(([u, rows]) => rows.length > 1);
  const extra = dupGroups.reduce((a, [u, rows]) => a + rows.length - 1, 0);
  console.log(`unique urls: ${groups.size}, dup groups: ${dupGroups.length}, deletable dup rows: ${extra}, untouched (empty/bad url): ${untouched.length}`);

  // Show composition of dup groups (storage vs ytimg) for safety audit
  let storGroups = 0, ytGroups = 0, otherGroups = 0, mixedTitleGroups = 0;
  for (const [u, rows] of dupGroups) {
    if (u.includes('/Thumbnails/')) storGroups++;
    else if (u.includes('ytimg.com')) ytGroups++;
    else otherGroups++;
    const titles = new Set(rows.map(r => (r.title || '').trim().toLowerCase()));
    if (titles.size > 1) mixedTitleGroups++;
  }
  console.log(`dup groups: storage=${storGroups} ytimg=${ytGroups} other=${otherGroups}, groups w/ differing titles=${mixedTitleGroups}`);

  if (DRY) {
    console.log('DRY — sample groups (keeper=newest created_at, tags=union):');
    dupGroups.slice(0, 5).forEach(([u, rows]) => {
      const keeper = rows[rows.length - 1];
      const union = [...new Set(rows.flatMap(r => normalizeExisting(r.tags || [])).map(t => t.toLowerCase()))];
      console.log(`- ${rows.length}x ${u.slice(-60)} | keeper=${keeper.id.slice(0, 18)} title=${JSON.stringify(keeper.title)?.slice(0, 50)} | unionTags=${union.length}`);
    });
    // orphans
    const bucket = new Set(JSON.parse(fs.readFileSync('bucket_list.json', 'utf8')));
    const dbFiles = new Set(all.filter(x => (x.image_url || '').includes('/Thumbnails/')).map(x => decodeURIComponent(x.image_url.split('/Thumbnails/')[1].split('?')[0])));
    const orphans = [...bucket].filter(f => ![...dbFiles].some(d => d === f));
    console.log(`orphan bucket files (no DB row): ${orphans.length}`);
    return;
  }

  // EXECUTE: per group — fresh union merge into keeper, then delete rest
  let kept = 0, deleted = 0, mergePatched = 0;
  const FAILS = [];
  for (let gi = 0; gi < dupGroups.length; gi++) {
    const [u, rows] = dupGroups[gi];
    const keeper = rows[rows.length - 1]; // newest created_at (asc order)
    const union = [];
    const seen = new Set();
    for (const r of rows) {
      for (const t of normalizeExisting(r.tags || [])) {
        if (!seen.has(t.toLowerCase())) { seen.add(t.toLowerCase()); union.push(t); }
      }
    }
    const keeperNorm = normalizeExisting(keeper.tags || []);
    if (union.length !== keeperNorm.length) {
      try {
        const pr = await writeReq(`${SUPABASE_URL}/rest/v1/thumbnails?id=eq.${encodeURIComponent(keeper.id)}`, 'PATCH', { tags: union });
        if (!pr.ok) FAILS.push({ stage: 'merge-patch', id: keeper.id, s: pr.status });
        else mergePatched++;
      } catch (e) {
        FAILS.push({ stage: 'merge-patch', id: keeper.id, s: 'timeout:' + e.message.slice(0, 60) });
      }
    }
    for (const r of rows.slice(0, -1)) {
      try {
        const dr = await writeReq(`${SUPABASE_URL}/rest/v1/thumbnails?id=eq.${encodeURIComponent(r.id)}`, 'DELETE');
        if (!dr.ok) FAILS.push({ stage: 'delete', id: r.id, s: dr.status });
        else deleted++;
      } catch (e) {
        FAILS.push({ stage: 'delete', id: r.id, s: 'timeout:' + e.message.slice(0, 60) });
      }
    }
    kept++;
    if ((gi + 1) % 200 === 0 || gi + 1 === dupGroups.length) {
      console.log(`groups ${gi + 1}/${dupGroups.length} deleted=${deleted} mergePatched=${mergePatched} fails=${FAILS.length}`);
      await new Promise(res => setTimeout(res, 100));
    }
  }
  console.log(`DONE kept=${kept} deleted=${deleted} mergePatched=${mergePatched} fails=${FAILS.length}`);
  if (FAILS.length) console.log(JSON.stringify(FAILS.slice(0, 10)));
}

run().catch(e => { console.error('FATAL', e); process.exit(1); });
