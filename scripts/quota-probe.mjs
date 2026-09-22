const KEY = process.env.GEMINI_API_KEY || '';
if (!KEY) { console.error('Set GEMINI_API_KEY env var'); process.exit(1); }
const c = await Promise.race([
  fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=' + encodeURIComponent(KEY), {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: 'Reply with the single word: ok' }] }] })
  }).then(async r => ({ status: r.status, body: (await r.text()).slice(0, 200) })),
  new Promise(res => setTimeout(() => res({ status: 'TIMEOUT' }), 20000))
]);
console.log(JSON.stringify(c));
