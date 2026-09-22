const KEY = process.env.GEMINI_API_KEY || '';
if (!KEY) { console.error('Set GEMINI_API_KEY env var'); process.exit(1); }
const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models?key=' + encodeURIComponent(KEY));
const j = await r.json();
const names = (j.models || []).map(m => m.name).slice(0, 100);
console.log(names.join('\n'));
console.log('total', names.length);
