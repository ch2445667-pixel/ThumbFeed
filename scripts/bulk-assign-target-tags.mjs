import fs from 'fs';
import { assignNewTags, normalizeExisting, isGenericTitle, buildTitle, SUPABASE_URL, H } from './tagger-rules.mjs';

const DRY = process.argv.includes('--dry');
const LIMIT = (() => { const m = process.argv.find(a => a.startsWith('--limit=')); return m ? parseInt(m.split('=')[1]) : Infinity; })();

async function fetchAll() {
  let all = [];
  let from = 0;
  const step = 1000;
  while (true) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/thumbnails?select=id,title,image_url,niche,tags&order=id.asc&limit=${step}&offset=${from}`, { headers: H });
    if (!r.ok) throw new Error('fetch failed ' + r.status + ' ' + (await r.text()).slice(0, 300));
    const j = await r.json();
    all.push(...j);
    if (j.length < step) break;
    from += step;
  }
  return all;
}

async function patchRow(id, payload, attempt = 1) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/thumbnails?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { ...H, Prefer: 'return=minimal' },
    body: JSON.stringify(payload)
  });
  if (!r.ok && attempt <= 3) {
    await new Promise(res => setTimeout(res, 400 * attempt));
    return patchRow(id, payload, attempt + 1);
  }
  if (!r.ok) throw new Error(`patch ${id} failed ${r.status}: ${(await r.text()).slice(0, 300)}`);
}

async function run() {
  console.log('Fetching all rows...');
  const all = await fetchAll();
  console.log(`Total rows: ${all.length}`);

  const ops = [];
  const dist = {};
  for (const row of all.slice(0, LIMIT)) {
    const fname = (row.image_url || '').split('/').pop() || '';
    const norm = normalizeExisting(row.tags || []);
    const normChanged = JSON.stringify(norm) !== JSON.stringify(row.tags || []);
    const add = assignNewTags({ title: row.title, filename: fname, niche: row.niche, existingTags: norm });
    const seen = new Set(norm.map(v => v.toLowerCase()));
    const fresh = add.filter(a => !seen.has(a.toLowerCase()));
    fresh.forEach(f => dist[f] = (dist[f] || 0) + 1);
    const merged = [...norm, ...fresh];

    let newTitle = row.title;
    let titleFixed = false;
    if (isGenericTitle(row.title, row.image_url)) {
      newTitle = buildTitle(fname, row.niche, merged);
      titleFixed = newTitle !== row.title;
    }

    const tagsChanged = fresh.length > 0 || normChanged;
    if (tagsChanged || titleFixed) {
      const payload = {};
      if (tagsChanged) payload.tags = merged;
      if (titleFixed) payload.title = newTitle;
      ops.push({ id: row.id, title: row.title, newTitle: titleFixed ? newTitle : undefined, add: fresh, normChanged, payload });
    }
  }

  console.log(`Rows needing update: ${ops.length}`);
  console.log('New-tag distribution:', Object.entries(dist).sort((a, b) => b[1] - a[1]));
  console.log(`Title fixes: ${ops.filter(o => o.newTitle).length}, Tag appends: ${ops.filter(o => o.add.length).length}, Norm-only: ${ops.filter(o => !o.add.length && !o.newTitle).length}`);

  if (DRY) {
    console.log('DRY RUN - first 20 ops:');
    ops.slice(0, 20).forEach(o => console.log(`- ${o.id} | ${JSON.stringify(o.title)?.slice(0, 60)} => ADD ${o.add.join(',')} | TITLE: ${o.newTitle || '(keep)'}`));
    return;
  }

  let ok = 0, fail = 0;
  const CONC = 8;
  for (let i = 0; i < ops.length; i += CONC) {
    const batch = ops.slice(i, i + CONC);
    await Promise.all(batch.map(async (o) => {
      try { await patchRow(o.id, o.payload); ok++; }
      catch (e) { fail++; console.error('FAIL', o.id, e.message); }
    }));
    if ((i + CONC) % 200 < CONC || i + CONC >= ops.length) console.log(`Progress ${Math.min(i + CONC, ops.length)}/${ops.length} ok=${ok} fail=${fail}`);
    await new Promise(r => setTimeout(r, 60));
  }
  console.log(`DONE ok=${ok} fail=${fail}`);
  fs.writeFileSync('thumb_bulk_result.json', JSON.stringify({ total: all.length, updated: ok, failed: fail, dist }, null, 2));
}

run().catch(e => { console.error(e); process.exit(1); });
