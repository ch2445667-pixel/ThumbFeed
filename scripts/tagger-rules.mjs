const SUPABASE_URL = 'https://xahchsuffmskbgvnxcgs.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_QprT-ekIg6xv77IwL9p81g_GR5-tdiy';
const H = { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + SUPABASE_ANON_KEY, 'Content-Type': 'application/json' };

const TARGETS = ['Podcast','Interviews','Football','Mindset','Self-Improvement','Lifestyle','Business','Entrepreneurship','Gaming','Geopolitics','Military','Nfl','Psychology','Soccer','Sports','Video Games','Vlog','War'];

function esc(s){ return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
// match phrase with word boundaries (for single words) else plain includes
function hasAny(t, arr){
  return arr.some(k => {
    if (/^[a-z0-9]+$/i.test(k) && k.length <= 6) {
      try { return new RegExp(`\\b${esc(k)}\\b`, 'i').test(t); } catch { return t.includes(k); }
    }
    return t.includes(k);
  });
}

function assignNewTags({ title, filename, niche, existingTags }) {
  const primary = `${title || ''} ${filename || ''}`.toLowerCase();
  const nicheStr = (niche || '').toLowerCase();
  const out = new Set();

  // --- Podcast (niche is trusted + primary keywords) ---
  if (hasAny(primary, ['podcast','joe rogan','lex fridman','diary of a ceo','steven bartlett','andrew huberman','huberman lab','modern wisdom','chris williamson','jay shetty','theo von','shawn ryan','pbd podcast','valuetainment','full send','impulsive','smartless','armchair expert']) || nicheStr === 'podcast') {
    out.add('Podcast');
  }

  // --- Interviews (primary only - avoid generic tag pollution) ---
  if (hasAny(primary, ['interview','sits down with','sit down with','sits down','one on one','one-on-one','in conversation with','talks to','asks a','interrogat','confronts','debate with'])) {
    out.add('Interviews');
  } else if (out.has('Podcast') && hasAny(primary, ['guest','reveals','tells all','opens up','untold','breaks silence','confesses'])) {
    out.add('Interviews');
  }

  // --- Soccer (primary only) ---
  const soccerHit = hasAny(primary, ['soccer','premier league','champions league','la liga','serie a','bundesliga','ligue 1','world cup','messi','ronaldo','cristiano','neymar','mbappe','mbappé','haaland','bellingham','salah','vinicius','man city','manchester city','man united','manchester united','arsenal','liverpool','chelsea','tottenham','barcelona','real madrid','bayern','dortmund','uefa','penalty shootout','hat-trick','hat trick','golden boot','transfer news']) && !hasAny(primary, ['nfl','super bowl','quarterback','touchdown']);
  if (soccerHit) out.add('Soccer');

  // --- Nfl (primary only) ---
  const nflHit = hasAny(primary, ['nfl','super bowl','superbowl','touchdown','quarterback','patrick mahomes','mahomes','travis kelce','kelce','josh allen','lamar jackson','joe burrow','jalen hurts','brock purdy','chiefs','cowboys','49ers','niners','patriots','packers','bills mafia','nfl draft','nfl combine','american football','college football','ncaa football','gridiron','heisman']);
  if (nflHit) { out.add('Nfl'); out.add('Football'); }

  // --- Football lone word (primary, exclude soccer context) ---
  if (primary.includes('football') && !soccerHit && !nflHit) out.add('Football');

  // --- Sports parent (primary only) ---
  if (out.has('Soccer') || out.has('Football') || out.has('Nfl') || hasAny(primary, ['sports','athlete','olympics','ufc','mma','boxing','knockout','wwe ','wrestlemania','formula 1','formula1','verstappen','hamilton','lebron','steph curry','nba','mlb ','nhl ','wimbledon','tennis','cricket','virat kohli','trophy','championship game','matchday','grand prix','powerlift','bodybuild','mike tyson','mcgregor','khabib','golf masters'])) {
    out.add('Sports');
  }

  // --- Gaming / Video Games (primary only; avoids 'ai'/'game' false positives) ---
  const gameHit = hasAny(primary, ['minecraft','roblox','fortnite','gta v','gta 6','valorant','call of duty','warzone','apex legends','league of legends','counter-strike','overwatch','elden ring','zelda','mario','pokemon','pokémon','pubg','free fire','among us','fall guys','rocket league','eafc','fc 25','skyrim','red dead','rdr2','god of war','gameplay','walkthrough','boss fight','speedrun','lets play',"let's play",'kai cenat','ishowspeed','twitch','kick stream','streamer','esports','e-sports','victory royale','ranked grind']);
  const gamingWord = hasAny(primary, ['gaming','gamer']);
  // bare 'gta' with word boundary (hasAny handles short words with \b)
  if (hasAny(primary, ['gta']) || gameHit || gamingWord) { out.add('Gaming'); out.add('Video Games'); }

  // --- Vlog (primary only) ---
  if (hasAny(primary, ['vlog','vlogs','day in my life','day in the life','daily routine','morning routine','night routine','evening routine','week in my life','come with me','spend the day','living in ','moving to','moved to','road trip','travel vlog','apartment tour','room tour','house tour','home tour','what i eat','grocery haul','pack with me','grwm','get ready with me','a day with'])) {
    out.add('Vlog');
  }

  // --- Lifestyle (primary only) ---
  if (hasAny(primary, ['lifestyle','fashion','outfit','style guide','wardrobe','lookbook','loafer','suede','sneaker','skincare','makeup','home decor','room makeover','minimalism','minimalist living','luxury life','travel guide','food tour','cooking','recipe','van life'])) {
    out.add('Lifestyle');
  }

  // --- Business (primary only; FIX: 'invest' must not match 'investigative') ---
  // use explicit word-boundary safe list: split risky stems out
  const bizPhrases = ['business','money','million','billion','finance','stock market','crypto','bitcoin','ethereum','real estate','startup','founder','entrepreneur','sales','marketing','ecommerce','e-commerce','dropship','shopify','amazon fba','revenue','profit','wealth','passive income','side hustle','billionaire','dollar','economy','forex','funding','venture capital','shark tank','net worth','financial freedom','make money','quit my job','trading'];
  let bizHit = hasAny(primary, bizPhrases);
  if (!bizHit) {
    // risky singles with strict word boundaries, excluding investigative/investigation
    const t = ' ' + primary + ' ';
    if (/\binvest(s|ed|ing|or|ment)?\b/.test(t) && !t.includes('investig')) bizHit = true;
    if (/\bstock(s)?\b/.test(t)) bizHit = true;
    if (/\brich\b/.test(t)) bizHit = true;
    if (/\bceo\b/.test(t)) bizHit = true;
    if (/\bmarket crash\b/.test(t)) bizHit = true;
  }
  if (bizHit) out.add('Business');

  // --- Entrepreneurship (primary only) ---
  if (hasAny(primary, ['entrepreneur','startup','founder','solopreneur','built a business','from zero to','side hustle','small business','my business','started a','how i built','agency owner','startup story','founder story','business owner'])) {
    out.add('Entrepreneurship');
    out.add('Business');
  }

  // --- Mindset (primary only) ---
  if (hasAny(primary, ['mindset','discipline','motivation','motivational','deep work','atomic habits','stoic','stoicism','david goggins','goggins','jocko','mental toughness','self discipline','self-discipline','procrastinat','stop being lazy','no excuses','mindset shift','winner mindset','success mindset'])) {
    out.add('Mindset');
  }

  // --- Self-Improvement (primary only; FIX: ignore 'Productivity Apps' tag pollution) ---
  if (hasAny(primary, ['self-improvement','self improvement','self-help','self help','self development','personal development','glow up','level up','how to be ','how to improve','life changing','change your life','study tips','better student','goal setting','morning motivation','upgrade yourself','reinvent yourself','fix your life','become the best','become a better'])) {
    out.add('Self-Improvement');
  }

  // --- Psychology (primary only) ---
  if (hasAny(primary, ['psychology','psychological','human behavior','dark psychology','mind tricks','cognitive','manipulation','narcissist','gaslight','trauma','therapy','therapist','freud','carl jung','dopamine','anxiety','depression','overthink','persuasion','persuade','body language','mind control','subconscious','mental model'])) {
    out.add('Psychology');
  }

  // --- Geopolitics (primary only) ---
  if (hasAny(primary, ['geopolitic','global politics','world order','superpower','cold war','united nations','xi jinping','putin','zelensky','ukraine','russia','china vs','usa vs','america vs','middle east','israel','palestine','gaza','iran','taiwan','north korea','sanctions']) || hasAny(primary, ['nato'])) {
    out.add('Geopolitics');
  }

  // --- Military (primary only) ---
  if (hasAny(primary, ['military','special forces','navy seal','green beret','soldier','troops','veteran','pentagon','fighter jet','aircraft carrier','submarine','sniper','special ops','boot camp','deployment','medal of honor','weapons test','missile test','drone strike','air force','marines'])) {
    out.add('Military');
  }

  // --- War (primary only) ---
  if (hasAny(primary, ['warfare','world war','vietnam war','civil war','invasion of','battle of','frontline','front line','war zone','warzone','airstrike','air strike','invasion','operation desert','operation barbarossa','d-day','normandy','war crimes','prisoner of war','trench warfare','war documentary','gaza war','ukraine war']) || hasAny(primary, ['war']) || hasAny(primary, ['ww1','ww2','wwi','wwii'])) {
    // 'war' short-word uses \b via hasAny; ww* also \b
    out.add('War');
  }
  if (out.has('War') && hasAny(primary, ['ukraine','russia','gaza','israel','palestine','iran','iraq','afghanistan','syria','yemen','putin','taiwan'])) out.add('Geopolitics');
  if (out.has('War') && hasAny(primary, ['soldier','troop','army','navy','marines','tank','sniper','fighter','weapon','battle','veteran','general'])) out.add('Military');

  return [...out];
}

function normalizeExisting(tags) {
  return (tags || []).map(x => {
    if (!x) return x;
    const l = String(x).trim().toLowerCase();
    if (l === 'interview') return 'Interviews';
    if (l === 'interviews') return 'Interviews';
    if (l === 'nfl') return 'Nfl';
    if (l === 'video games' || l === 'videogames' || l === 'video game') return 'Video Games';
    if (l === 'self improvement' || l === 'self-improvement') return 'Self-Improvement';
    if (l === 'vlog' || l === 'vlogs') return 'Vlog';
    return String(x).trim();
  }).filter(Boolean);
}

function cleanFilenameTitle(filename) {
  let s = decodeURIComponent(filename || '');
  s = s.split('?')[0];
  s = s.replace(/\.[a-z0-9]+$/i, '');
  s = s.replace(/^[0-9]+\.\s*/, '');
  s = s.replace(/[_-]+/g, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

function isGenericTitle(title, filename) {
  const t = (title || '').trim();
  if (!t) return true;
  const l = t.toLowerCase();
  if (l.length < 3) return true;
  if (/^(image|images|untitled|thumbnail|thumbnails|youtube thumbnail( design)?|youtube thumbnail design.*|high[ -]?ctr (youtube )?thumbnail( concept)?|high ctr thumbnail concept|curated high[ -]?ctr thumbnail|professional youtube cover design|eye[ -]?catching youtube thumbnail design|thumbnail design|home x|img_\d+.*|image_[a-z0-9_]+|untitled design.*)(\s*[\d.\-_x]*)?$/i.test(t)) return true;
  if (/^\d+\.\s*(untitled|image|thumbnail)/i.test(t)) return true;
  const stem = cleanFilenameTitle(filename).toLowerCase();
  if (stem && (stem === l || stem.replace(/\s/g,'') === l.replace(/\s/g,'')) && /^(untitled|image)/.test(stem)) return true;
  return false;
}

function buildTitle(filename, niche, tags) {
  const cleaned = cleanFilenameTitle(filename);
  const bad = /^(untitled|image|thumbnail|youtube thumbnail|high ctr|curated|professional|eye catching|design|home)/i.test(cleaned) || cleaned.length < 8;
  if (!bad) {
    return cleaned.slice(0, 90);
  }
  const meaningful = (tags || []).filter(x => !/^(high ctr|youtube|creator|tanzeelgfx|thumbnail design|visual hook|click magnet)$/i.test(x)).slice(0, 3);
  const topic = meaningful.length ? ' – ' + meaningful.join(' • ') : '';
  return `${(niche || 'Creator').trim()} Thumbnail${topic}`.slice(0, 120);
}

export { assignNewTags, normalizeExisting, isGenericTitle, buildTitle, cleanFilenameTitle, TARGETS, SUPABASE_URL, SUPABASE_ANON_KEY, H };
