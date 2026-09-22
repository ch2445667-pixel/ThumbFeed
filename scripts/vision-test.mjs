const KEY = process.env.GEMINI_API_KEY || '';
if (!KEY) { console.error('Set GEMINI_API_KEY env var'); process.exit(1); }
const ALLOWED = ['Podcast','Interviews','Football','Mindset','Self-Improvement','Lifestyle','Business','Entrepreneurship','Gaming','Geopolitics','Military','Nfl','Psychology','Soccer','Sports','Video Games','Vlog','War'];

async function tagOne(imageUrl, existingTitle) {
  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) throw new Error('img fetch ' + imgRes.status);
  const buf = Buffer.from(await imgRes.arrayBuffer());
  console.log('bytes', buf.length);
  const b64 = buf.toString('base64');
  const prompt = `You are tagging YouTube thumbnails. Look at the IMAGE PIXELS carefully (faces, jerseys, text, logos, game art, studio mics, soldiers, maps, money).
Existing title: "${String(existingTitle).replace(/"/g, "'").slice(0, 120)}"
Allowed tags (use EXACT spelling, assign 0 or more, multiple if qualifies): ${ALLOWED.join(', ')}.
Rules: Interviews=visible interview setup or INTERVIEW text/guest conversation; Podcast=podcast studio/mics/podcast text; Football=american football; Soccer=soccer kits, Messi/Ronaldo, stadiums; Nfl=NFL logos/text; Sports=any sport parent; Gaming+Video Games=both for video-game art/gameplay; Vlog=daily-life/travel; Lifestyle=fashion/food/home/aesthetic; Business=money/investing/startup; Entrepreneurship=founder/startup journey (also add Business); Mindset=motivation/discipline quotes; Self-Improvement=productivity/self-help; Psychology=mind/behavior; Geopolitics=countries/leaders/maps/conflict politics; Military=soldiers/weapons/jets; War=battle/combat/war text. If none fit, return [].
Return STRICT JSON: {"tags":[],"title":"...","ocr":"...","conf":0-1}. Title: keep existing if specific, else write short descriptive title 4-10 words from image content.`;
  const body = {
    contents: [{ parts: [{ inline_data: { mime_type: 'image/jpeg', data: b64 } }, { text: prompt }] }],
    generationConfig: { responseMimeType: 'application/json', temperature: 0.1, maxOutputTokens: 400 }
  };
  const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=' + encodeURIComponent(KEY), {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  });
  console.log('gemini status', r.status);
  const j = await r.json();
  console.log(JSON.stringify(j).slice(0, 4000));
  try {
    const txt = j.candidates?.[0]?.content?.parts?.map(p => p.text).join('');
    console.log('PARSED TEXT:', txt);
  } catch (e) { console.log('parse err', e.message); }
}

const url1 = 'https://xahchsuffmskbgvnxcgs.supabase.co/storage/v1/object/public/Thumbnails/12. I_Found_The_Best_Suede_Summer_Loafers_For_Men.jpg';
await tagOne(url1, 'I Found The Best Suede Summer Loafers For Men');
