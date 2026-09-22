import fs from 'fs';
import { normalizeExisting, isGenericTitle } from './tagger-rules.mjs';

const SUPABASE_URL = 'https://xahchsuffmskbgvnxcgs.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_QprT-ekIg6xv77IwL9p81g_GR5-tdiy';
const H = { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + SUPABASE_ANON_KEY, 'Content-Type': 'application/json' };
const GEMINI_KEY = process.env.GEMINI_API_KEY || '';
const MODEL = 'gemini-3.5-flash-lite';
const ALLOWED = ['Podcast','Interviews','Football','Mindset','Self-Improvement','Lifestyle','Business','Entrepreneurship','Gaming','Geopolitics','Military','Nfl','Psychology','Soccer','Sports','Video Games','Vlog','War'];
const ALLOWED_LOWER = new Map(ALLOWED.map(a => [a.toLowerCase(), a]));

const DRY = process.argv.includes('--dry');
const LIMIT = (() => { const m = process.argv.find(a => a.startsWith('--limit=')); return m ? parseInt(m.split('=')[1]) : Infinity; })();
const CONC = (() => { const m = process.argv.find(a => a.startsWith('--conc=')); return m ? parseInt(m.split('=')[1]) : 4; })();
const CKPT = (() => { const m = process.argv.find(a => a.startsWith('--ckpt=')); return m ? m.split('=')[1] : 'vision_progress.json'; })();
const RPM = (() => { const m = process.argv.find(a => a.startsWith('--rpm=')); return m ? parseFloat(m.split('=')[1]) : 0; })();
let lastGeminiStart = 0;
async function geminiGate() {
  if (!RPM || RPM <= 0) return;
  const gap = 60000 / RPM;
  const now = Date.now();
  const wait = lastGeminiStart + gap - now;
  if (wait > 0) await new Promise(res => setTimeout(res, wait));
  lastGeminiStart = Date.now();
}
const TARGETS_FILE = (() => { const m = process.argv.find(a => a.startsWith('--targets=')); return m ? m.split('=')[1] : null; })();

function loadCkpt() {
  try { return JSON.parse(fs.readFileSync(CKPT, 'utf8')); }
  catch { return { done: {}, failed: [], patched: 0, skipped: 0 }; }
}
function saveCkpt(c) { fs.writeFileSync(CKPT, JSON.stringify(c)); }

async function fetchAll() {
  let all = [];
  let from = 0;
  const step = 1000;
  while (true) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/thumbnails?select=id,title,image_url,tags&order=id.asc&limit=${step}&offset=${from}`, { headers: H });
    if (!r.ok) throw new Error('fetch rows failed ' + r.status);
    const j = await r.json();
    all.push(...j);
    if (j.length < step) break;
    from += step;
  }
  return all;
}

async function fetchImageB64(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error('img ' + r.status);
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length > 900000) {
    // crude downsize guard: still send (flash-lite handles it), just note
  }
  return buf.toString('base64');
}

function buildPrompt(existingTitle) {
  const retarget = Boolean(TARGETS_FILE);
  return `You are tagging YouTube thumbnails. Look ONLY at the IMAGE PIXELS (faces, jerseys, kits, text on thumbnail, logos, game art, studio mics, soldiers, maps, money, books).
Existing DB title: "${String(existingTitle || '').replace(/"/g, "'").slice(0, 120)}"${retarget ? '\nIMPORTANT: that DB title is an auto-generated PLACEHOLDER — ALWAYS write a fresh descriptive title from the image content; never return it verbatim.' : ''}
Allowed tags — use EXACT spelling, 0 or more, multiple if qualifies: ${ALLOWED.join(', ')}.
Definitions: Interviews=interview setup/interview text/guest conversation (merge singular/plural into Interviews); Podcast=podcast studio/mics or PODCAST text; Football=american football only; Soccer=soccer kits/stadium/Messi/Ronaldo/FIFA soccer; Nfl=NFL shield/text/team; Sports=parent for any sport; Gaming AND Video Games=assign BOTH for video-game art/gameplay/streamer; Vlog=daily-life/travel/routine thumbnails; Lifestyle=fashion/outfit/food/home/aesthetic/men-style; Business=money/investing/stocks/crypto/startup/revenue; Entrepreneurship=founder/startup journey (ALSO add Business); Mindset=motivation/discipline/stoic quotes; Self-Improvement=productivity/study/self-help/glow-up; Psychology=mind/behavior/therapy/dopamine; Geopolitics=countries/leaders/maps/elections/sanctions; Military=soldiers/weapons/jets/ships; War=battle/combat/WW2/invasion/airstrike text. If none fit, tags=[]. Do NOT invent tags outside the list.
Return STRICT JSON only: {"tags":[],"title":"...","ocr":"...","conf":0.0-1.0}. Title: return existing title verbatim if it is specific/descriptive; if it is generic ("image","untitled","High-CTR YouTube Thumbnail Concept","Youtube Thumbnail Design","Home X") write a new short descriptive title 4-10 words from IMAGE content only.`;
}

async function callGemini(b64, existingTitle, attempt = 1) {
  await geminiGate();
  const body = {
    contents: [{ parts: [{ inline_data: { mime_type: 'image/jpeg', data: b64 } }, { text: buildPrompt(existingTitle) }] }],
    generationConfig: { responseMimeType: 'application/json', temperature: 0.1, maxOutputTokens: 400 }
  };
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=` + encodeURIComponent(GEMINI_KEY), {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  });
  if (r.status === 429 || r.status >= 500) {
    if (attempt > 5) throw new Error('gemini ' + r.status + ' retries exhausted');
    await new Promise(res => setTimeout(res, 1500 * attempt * Math.random() + 1000));
    return callGemini(b64, existingTitle, attempt + 1);
  }
  if (!r.ok) throw new Error('gemini ' + r.status + ': ' + (await r.text()).slice(0, 400));
  const j = await r.json();
  const txt = j.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
  const cleaned = txt.replace(/^```json/i, '').replace(/```$/m, '').trim();
  return JSON.parse(cleaned);
}

function sanitizeVisionTags(raw) {
  const out = [];
  for (const t of (raw || [])) {
    const k = String(t).trim().toLowerCase();
    if (k === 'interview') { if (!out.includes('Interviews')) out.push('Interviews'); continue; }
    if (ALLOWED_LOWER.has(k)) {
      const canon = ALLOWED_LOWER.get(k);
      if (!out.includes(canon)) out.push(canon);
    }
  }
  // Entrepreneurship implies Business
  if (out.includes('Entrepreneurship') && !out.includes('Business')) out.push('Business');
  // Gaming/Video Games paired
  if (out.includes('Gaming') && !out.includes('Video Games')) out.push('Video Games');
  if (out.includes('Video Games') && !out.includes('Gaming')) out.push('Gaming');
  if (out.includes('Nfl') && !out.includes('Football')) out.push('Football');
  if ((out.includes('Soccer') || out.includes('Football') || out.includes('Nfl')) && !out.includes('Sports')) out.push('Sports');
  return out;
}

async function patchRow(id, payload, attempt = 1) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/thumbnails?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify(payload)
  });
  if (!r.ok && attempt <= 3) {
    await new Promise(res => setTimeout(res, 500 * attempt));
    return patchRow(id, payload, attempt + 1);
  }
  if (!r.ok) throw new Error('patch ' + id + ' ' + r.status);
}

async function processOne(row, ckpt) {
  const id = row.id;
  const d = ckpt.done[id];
  if (d && (!TARGETS_FILE || d.targeted)) return { status: 'cached' };
  const norm = normalizeExisting(row.tags || []);
  let b64;
  try {
    b64 = await fetchImageB64(row.image_url);
  } catch (e) {
    ckpt.failed.push({ id, stage: 'image', err: e.message });
    ckpt.done[id] = { error: 'image:' + e.message };
    return { status: 'image-fail' };
  }
  let v;
  try {
    v = await callGemini(b64, row.title);
  } catch (e) {
    ckpt.failed.push({ id, stage: 'gemini', err: e.message });
    return { status: 'gemini-fail', err: e.message };
  }
  const visionTags = sanitizeVisionTags(v.tags);
  const seen = new Set(norm.map(x => x.toLowerCase()));
  const fresh = visionTags.filter(t => !seen.has(t.toLowerCase()));
  const merged = [...norm, ...fresh];
  const normChanged = JSON.stringify(norm) !== JSON.stringify(row.tags || []);

  let newTitle;
  const needsTitle = isGenericTitle(row.title, row.image_url) || /Thumbnail – /.test(row.title || '');
  if (needsTitle && v.title && !isGenericTitle(v.title, row.image_url) && !/Thumbnail – /.test(v.title || '') && v.title.trim() !== (row.title || '').trim()) {
    newTitle = String(v.title).slice(0, 120);
  }

  const payload = {};
  if (fresh.length || normChanged) payload.tags = merged;
  if (newTitle && newTitle !== row.title) payload.title = newTitle;

  if (!DRY && Object.keys(payload).length) {
    try { await patchRow(id, payload); }
    catch (e) {
      ckpt.failed.push({ id, stage: 'patch', err: e.message });
      return { status: 'patch-fail' };
    }
  }
  ckpt.done[id] = { add: fresh, title: newTitle || null, conf: v.conf ?? null, ocr: (v.ocr || '').slice(0, 80), ...(TARGETS_FILE ? { targeted: true } : {}) };
  if (Object.keys(payload).length) ckpt.patched = (ckpt.patched || 0) + 1;
  else ckpt.skipped = (ckpt.skipped || 0) + 1;
  return { status: Object.keys(payload).length ? 'patched' : 'skipped', add: fresh, newTitle };
}

async function run() {
  if (!GEMINI_KEY) throw new Error('Set GEMINI_API_KEY env');
  const all = await fetchAll();
  console.log('total rows', all.length);
  const ckpt = loadCkpt();
  console.log(`checkpoint has ${Object.keys(ckpt.done).length} done`);
  let todo = all.slice(0, LIMIT).filter(r => !ckpt.done[r.id]);
  if (TARGETS_FILE) {
    const ids = new Set(JSON.parse(fs.readFileSync(TARGETS_FILE, 'utf8')));
    // re-process targets even if checkpoint-marked (old marks predate retargeting and have placeholder titles)
    todo = all.filter(r => ids.has(r.id));
    console.log(`targets file ${TARGETS_FILE}: ${ids.size} ids, todo ${todo.length} (checkpoint ignored for targets)`);
  }
  console.log(`todo ${todo.length} (conc ${CONC}, dry ${DRY})`);

  let i = 0, patched = 0;
  const dist = {};
  for (; i < todo.length; i += CONC) {
    const batch = todo.slice(i, i + CONC);
    const results = await Promise.all(batch.map(r => processOne(r, ckpt).catch(e => ({ status: 'error', err: e.message, id: r.id }))));
    results.forEach(res => {
      if (res?.add) res.add.forEach(t => dist[t] = (dist[t] || 0) + 1);
      if (res?.status === 'patched') patched++;
      if (res?.status?.includes('fail') || res?.status === 'error') console.log('WARN', res);
    });
    if ((i + CONC) % 100 < CONC || i + CONC >= todo.length) {
      console.log(`progress ${Math.min(i + CONC, todo.length)}/${todo.length} patched_this_run=${patched} ckpt_patched=${ckpt.patched} skipped=${ckpt.skipped} failed=${ckpt.failed.length}`);
      console.log('dist so far', JSON.stringify(dist));
      if (!DRY) saveCkpt(ckpt);
    }
    await new Promise(r => setTimeout(r, 250));
  }
  if (!DRY) saveCkpt(ckpt);
  console.log('DONE', JSON.stringify({ dist, patched, ckptPatched: ckpt.patched, skipped: ckpt.skipped, failed: ckpt.failed.length }));
}

run().catch(e => { console.error('FATAL', e); process.exit(1); });
