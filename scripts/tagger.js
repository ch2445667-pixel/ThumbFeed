/**
 * Title -> metadata tagger for imported YouTube thumbnails.
 *
 * Replaces the substring matcher in the original importer, which had three
 * problems:
 *
 *   1. Keywords were tested with String.includes, so "ai" fired inside
 *      "said", "mac" inside "machine" and "war" inside "warm".
 *   2. Style tags were invented names ("Bold Typography", "Product Focus",
 *      "Split Screen") that do not exist in the app's VisualStyle union, so
 *      selecting a style in the filter bar matched nothing.
 *   3. Tags were just the longest words in the title ("Gen", "Gave",
 *      "Having"), which is noise rather than metadata.
 *
 * Everything here matches on word boundaries, emits only values from the app's
 * controlled vocabularies, and derives tags from a curated topic lexicon so a
 * tag means the same thing on every row.
 */

const VISUAL_STYLES = new Set([
  'Face Close-up',
  '3D Render / CGI',
  'Illustrated / Anime',
  'Minimalist & Clean',
  'Split Screen / Before-After',
  'Text-Heavy / Typography',
  'No-Text / Visual Hook',
  'High-Contrast Glow',
]);

const EMOTIONS = new Set([
  'Shocked',
  'Intense',
  'Curious',
  'Happy',
  'Mysterious',
  'Urgent',
  'Confident',
]);

// Channels whose upload history is strongly one thing. Used only as a tiebreak
// bonus, never as the deciding signal, so a Business title on a Tech channel
// still lands in Business.
const CHANNEL_PRIOR = {
  'Damon Cassidy': 'Business',
  Kallaway: 'Business',
  'Ryan Trahan': 'Business',
  MrBeast: 'Entertainment',
  Veritasium: 'Educational',
  'Ali Abdaal': 'Educational',
  'Johnny Harris': 'Documentary',
  Mrwhosetheboss: 'Tech',
  'Mark Tilbury': 'Business',
  'Marques Brownlee': 'Tech',
  HimanshuG: 'Tech',
  'Vijay Thakkar': 'Educational',
  'Tyler Stalman': 'Tech',
  'Search Party (Sam Ellis)': 'Documentary',
  GEN: 'Documentary',
  finzar: 'Tech',
  'Zane Hoyer': 'Tech',
  'The Diary Of A CEO': 'Business',
  'Raj Shamani': 'Business',
  'Fraser Cottrell': 'Educational',
  'Bloomberg Originals': 'Business',
  'Design Theory': 'Educational',
  'Colin and Samir': 'Business',
  'The Science of Products': 'Educational',
  'Wes McDowell': 'Business',
  'Chase Chappell': 'Business',
  Serrahx: 'Educational',
  PiXimperfect: 'Educational',
  'David Heacock': 'Business',
  orenmeetsworld: 'Documentary',
  'Brimm.': 'Documentary',
  "xkcd's What If?": 'Educational',
  'Badis Designs': 'Educational',
  Wampus: 'Gaming',
  'Open Residency': 'Educational',
  'Jay Clouse': 'Business',
  'Sweat Equity': 'Business',
  'Found And Explained': 'Documentary',
  'Jon Youshaei': 'Business',
  'Tim Gabe': 'Educational',
  fern: 'Educational',
  'Tim Runia': 'Educational',
  Christophe: 'Educational',
  'Max Fisher': 'Documentary',
  'Dill Toma': 'Lifestyle',
  'Noah Haynes': 'Business',
  'Barney Watts': 'Educational',
  'Thought Out': 'Educational',
  'Solar Sands': 'Educational',
  'Pranjal Joshi': 'Tech',
  'HTX Studio': 'Educational',
};

// Visual-style priors for channels with a recognisable, consistent look.
const CHANNEL_STYLE_PRIOR = {
  MrBeast: 'Face Close-up',
  'Ryan Trahan': 'Face Close-up',
  'Mark Tilbury': 'Face Close-up',
  'Ali Abdaal': 'Face Close-up',
  'Mrwhosetheboss': 'Face Close-up',
  'Marques Brownlee': 'Minimalist & Clean',
  'Colin and Samir': 'Face Close-up',
  fern: '3D Render / CGI',
  Christophe: '3D Render / CGI',
  'Tyler Stalman': 'Minimalist & Clean',
  'Design Theory': 'Minimalist & Clean',
  Wampus: 'Illustrated / Anime',
  "xkcd's What If?": 'Illustrated / Anime',
  GEN: 'Illustrated / Anime',
  PiXimperfect: 'Face Close-up',
};

// ---------------------------------------------------------------------------
// Niche lexicon. weight 3 = unambiguous, 2 = strong signal, 1 = weak.
// ---------------------------------------------------------------------------

const NICHE_LEXICON = [
  {
    niche: 'Business',
    weight: 3,
    phrases: [
      'business', 'startup', 'start ups', 'entrepreneur', 'entrepreneurship',
      'founder', 'founders', 'agency', 'ecommerce', 'e commerce', 'side hustle',
      'marketing', 'branding', 'advertising', 'freelance', 'freelancing',
      'saas', 'b2b', 'b2c', 'funnel', 'cold email', 'cold outreach',
      'revenue', 'profit', 'margins', 'valuation', 'investors', 'pitch deck',
      'product market fit', 'growth hacking', 'scaling', 'hiring', 'onboarding',
      'client acquisition', 'retention', 'churn', 'monetization', 'monetise',
      'monetize', 'subscriptions', 'cash flow', 'burn rate',
    ],
  },
  {
    niche: 'Business',
    weight: 2,
    phrases: [
      'money', 'cash', 'income', 'salary', 'wages', 'paycheck', 'rich',
      'working class', 'middle class', 'class war', 'billionaire',
      'billionaires', 'inequality', 'career', 'careers', 'job', 'jobs',
      'fired', 'layoff', 'layoffs', 'promotion', 'boss', 'retirement',
      'mortgage', 'interest rates', 'central bank', 'stock market',
      'wealthy', 'broke', 'budget', 'savings', 'debt', 'mortgage', 'rent',
      'taxes', 'tax', 'insurance', 'pension', 'retirement', 'investing',
      'investment', 'stocks', 'stock market', 'crypto', 'bitcoin', 'ethereum',
      'trading', 'portfolio', 'dividend', 'inflation', 'recession', 'economy',
      'economic', 'prices', 'cost of living', 'real estate', 'housing',
      'marketing agency', 'productivity', 'time management', 'hustle',
      'affiliate', 'youtube channel', 'creator economy', 'sponsor',
      // Layoffs, hiring freezes and pay cuts are the vocabulary of this niche
      // as much as "revenue" is. Without them a Damon Cassidy economics title
      // fell through to the channel default.
      'layoff', 'layoffs', 'laid off', 'job losses', 'job loss',
      'hiring freeze', 'unemployment', 'pay cut', 'pay cuts', 'wage cuts',
      'minimum wage', 'union', 'strike', 'pension', 'gdp', 'recession',
      'inflation', 'interest rate', 'interest rates', 'central bank',
      'fed', 'mortgage rates', 'stock crash', 'bear market', 'bull market',
      'portfolio', 'index fund', 'roth ira', '401k', 'credit score',
      'credit card', 'student loan', 'net worth', 'cash flow',
    ],
  },
  {
    // Deliberately weak. Creator-economy vocabulary is unambiguous on its own
    // but a bare "how to" stem is not, so this only nudges the score rather
    // than deciding the niche.
    niche: 'Business',
    weight: 1,
    phrases: [
      'client', 'cold email', 'cold outreach', 'landing page', 'webinar',
      'roi', 'roas', 'cpc', 'ad spend', 'cost per click', 'conversion rate',
      'conversion', 'conversions', 'funnel', 'offer', 'offering',
      'positioning', 'business model', 'case study', 'case studies',
      'subscribe', 'subscribers', 'monetise', 'monetize', 'monetization',
      'shopify', 'woocommerce', 'stripe', 'paypal', 'click through', 'ctr',
      'brand deal', 'sponsorship', 'affiliate marketing', 'newsletter',
      'how i built', 'how we built', 'how i grew', 'how we grew',
      'buying a channel', 'selling a channel',
    ],
  },
  {
    niche: 'Tech',
    weight: 3,
    phrases: [
      'artificial intelligence', 'machine learning', 'large language model',
      'chatgpt', 'gpt', 'llm', 'neural network', 'computer vision',
      'programming', 'coding', 'developer', 'software', 'hardware',
      'cybersecurity', 'cyber security', 'hacking', 'hacked', 'malware',
      'data breach', 'encryption', 'open source', 'javascript', 'python',
      'algorithm', 'database', 'cloud computing', 'semiconductor', 'chip',
      'chips', 'nanotech', 'quantum computing', 'robotics', 'robot',
      'drone', 'autonomous', 'vr headset', 'augmented reality', 'console',
      'gaming setup', 'pc build', 'linux', 'kernel', 'web design',
    ],
  },
  {
    niche: 'Tech',
    weight: 2,
    phrases: [
      // "machine" alone is listed deliberately: "machine learning" would miss
      // "the machine war" / "the machine that took over".
      'machine', 'ai', 'tech', 'technology', 'gadget', 'iphone', 'ipad', 'macbook',
      'laptop', 'smartphone', 'phone', 'tablet', 'apple', 'google', 'samsung',
      'microsoft', 'tesla', 'spacex', 'nasa', 'rocket', 'satellite', 'space',
      'nintendo', 'playstation', 'xbox', 'steam', 'epic games', 'vr',
      'battery', 'processor', 'graphics card', 'monitor', 'keyboard',
      'headphones', 'camera', 'dslr', 'microphone', 'setup', 'rig',
      'benchmark', 'review', 'unboxing', 'first look', 'hands on',
      'firmware', 'update', 'hack', 'exploit', 'vulnerability',
      // A named AI model, developer tool or ad platform makes the subject
      // Tech even when the framing is about results: "Claude Just Changed
      // Meta Ads Forever" is an AI-tool story, not a marketing lesson.
      // Creative tools (Photoshop, Blender, DaVinci) are deliberately NOT
      // here: on the channels that use them they are taught as tutorials,
      // which is Educational.
      'claude', 'anthropic', 'openai', 'gemini', 'copilot', 'llama',
      'mistral', 'deepseek', 'perplexity', 'midjourney',
      'stable diffusion', 'runway', 'sora', 'cursor', 'vscode',
      'zapier', 'airtable', 'hubspot', 'mailchimp',
      'google ads', 'facebook ads', 'meta ads', 'tiktok ads',
      'xiaomi', 'oneplus', 'nothing phone', 'pixel', 'galaxy',
      'motorola', 'huawei', 'oppo', 'realme',
    ],
  },
  {
    niche: 'Educational',
    weight: 2,
    phrases: [
      // Creative software is the subject of a lesson, not a product review.
      'photoshop', 'illustrator', 'figma', 'premiere pro',
      'after effects', 'davinci resolve', 'blender', 'cinema 4d',
      'lightroom', 'unity', 'unreal engine',
    ],
  },
  {
    niche: 'Documentary',
    weight: 3,
    phrases: [
      'documentary', 'investigation', 'investigative', 'true story',
      'untold story', 'dark side', 'untold', 'cold war', 'world war',
      'geopolitics', 'conspiracy', 'cover up', 'cover-up', 'classified',
      'declassified', 'secret', 'secrets', 'hidden truth', 'mystery',
      'unsolved', 'vanished', 'disappeared', 'exposed', 'scandal',
      'corruption', 'mafia', 'cartel', 'crime', 'murder', 'fraud',
      'smuggling', 'trafficking', 'assassination', 'espionage', 'cia', 'fbi',
    ],
  },
  {
    niche: 'Documentary',
    weight: 2,
    phrases: [
      'history', 'historical', 'ancient', 'empire', 'dynasty', 'war',
      'battle', 'revolution', 'medieval', 'century', 'civilization',
      'archaeology', 'ruins', 'treasure', 'lost', 'forgotten', 'rise and fall',
      'collapsing', 'downfall', 'dark', 'brutal', 'terrifying', 'inside',
      'what happened', 'how did', 'biography', 'obituary', 'legacy',
      'government', 'president', 'minister', 'senate', 'congress',
      'u.s.', 'ussr', 'nazi', 'holocaust', 'cold war era',
    ],
  },
  {
    niche: 'Educational',
    weight: 3,
    phrases: [
      'explained', 'explainer', 'how to', 'tutorial', 'masterclass',
      'step by step', 'beginner guide', 'complete guide', 'course',
      'deep dive', 'breakdown', 'everything you need to know',
      'things nobody tells you', 'things i wish i knew', 'science of',
      'physics', 'chemistry', 'biology', 'mathematics', 'maths', 'math',
      'statistics', 'economics 101', 'the science', 'research shows',
      'study', 'studies', 'experiment', 'theory', 'laws of', 'principles',
    ],
  },
  {
    niche: 'Educational',
    weight: 2,
    phrases: [
      'learn', 'learning', 'lesson', 'teach', 'teaching', 'course', 'class',
      'guide', 'tips', 'tricks', 'habits', 'mistakes', 'rules', 'principles',
      'explains', 'meaning', 'definition', 'analogy', 'visualized',
      'visualised', 'simplified', 'beginner', 'advanced', 'certification',
      'curriculum', 'syllabus', 'revision', 'exam', 'interview prep',
      'book', 'reading', 'documentation',
      // "How to" is the single most common title stem on YouTube and by itself
      // says nothing about subject. Business, creator-economy and Design terms
      // deliberately stay out of this list: "How I Would Build A Business" has
      // to resolve to Business, not Educational.
      'how to', 'diary', 'logs', 'weekly analysis', 'monthly', 'yearly',
      'annual', 'recap',
      'vlog', 'webcam', 'podcast', 'writing', 'copy', 'sell', 'selling',
      'shorts', 'reels', 'tiktok', 'instagram', 'youtube',
    ],
  },
  {
    niche: 'Mindset',
    weight: 3,
    phrases: [
      'mindset', 'self improvement', 'self improvement', 'mental health',
      'anxiety', 'depression', 'therapy', 'psychology', 'psychological',
      'dopamine', 'motivation', 'discipline', 'confidence', 'self esteem',
      'burnout', 'stress', 'procrastination', 'productivity system',
      'habit stacking', 'cognitive', 'brain training',
    ],
  },
  {
    niche: 'Gaming',
    weight: 3,
    phrases: [
      'gameplay', 'gaming', 'video game', 'speedrun', 'lets play', "let's play",
      'minecraft', 'roblox', 'fortnite', 'gta', 'grand theft auto',
      'valorant', 'counter strike', 'call of duty', 'elden ring', 'pokemon',
      'mario', 'zelda', 'league of legends', 'overwatch', 'apex legends',
      'assassin', 'witcher', 'skyrim', 'fallout', 'red dead redemption',
      'game design', 'level design', 'boss fight', 'twitch',
    ],
  },
  {
    niche: 'Entertainment',
    weight: 3,
    phrases: [
      'challenge', 'prank', 'pranking', 'stunt', 'world record', 'marathon',
      'survival', 'survived', 'challenge', 'competition', 'contest',
      'experiment', 'social experiment', 'prank video', 'funny', 'comedy',
      'humor', 'meme', 'reaction', 'reacting', 'trailer', 'teaser',
      'announcement', 'vlog', 'behind the scenes', 'podcast', 'interview',
      'sit down', 'fireside', 'news', 'breaking', 'announcement',
    ],
  },
  {
    niche: 'Football',
    weight: 3,
    phrases: [
      'football', 'soccer', 'premier league', 'la liga', 'serie a',
      'champions league', 'world cup', 'europa league', 'transfer window',
      'transfer fee', 'striker', 'midfielder', 'goalkeeper', 'defender',
      'var', 'offside', 'penalty', 'free kick', 'hat trick', 'clean sheet',
      'fifa', 'uefa', 'messi', 'ronaldo', 'haaland', 'mbappe', 'vini jr',
    ],
  },
  {
    niche: 'Sports',
    weight: 3,
    phrases: [
      'nba', 'nfl', 'mlb', 'nhl', 'ufc', 'mma', 'boxing', 'formula 1',
      'formula one', 'f1', 'olympics', 'wimbledon', 'us open', 'masters',
      'golf', 'tennis', 'cricket', 'rugby', 'basketball', 'baseball',
      'hockey', 'motogp', 'nascar', 'league', 'championship', 'playoffs',
      'transfer', 'signing', 'coach', 'training', 'workout', 'fitness',
      'gym', 'muscle', 'physique', 'bodybuilding', 'nutrition', 'diet',
      'protein', 'calories', 'weight loss', 'health',
    ],
  },
  {
    niche: 'Lifestyle',
    weight: 3,
    phrases: [
      'day in my life', 'morning routine', 'night routine', 'weekly routine',
      'what i eat in a day', 'what i do in a day', 'productivity routine',
      'travel', 'solo travel', 'digital nomad', 'moving to', 'apartment tour',
      'house tour', 'minimalism', 'declutter', 'organization', 'organisation',
      'cleaning', 'tidy', 'room tour', 'van life', 'living in',
      'lifestyle', 'routine', 'relocation', 'expat', 'immigration',
    ],
  },
  {
    niche: 'IRL',
    weight: 2,
    phrases: [
      'irl', 'street', 'real life', 'day in the life', 'first time',
      'trying', 'attempted', 'i did', 'we did', 'filming', 'camera crew',
    ],
  },
  {
    niche: 'Geopolitics',
    weight: 3,
    phrases: [
      'geopolitics', 'foreign policy', 'diplomacy', 'sanctions', 'tariffs',
      'border', 'immigration policy', 'nato', 'united nations', 'eu',
      'european union', 'summit', 'embassy', 'treaty', 'alliance',
      'middle east', 'ukraine', 'russia', 'china', 'taiwan', 'israel',
      'gaza', 'iran', 'north korea', 'venezuela', 'trade war',
    ],
  },
  {
    niche: 'Military',
    weight: 3,
    phrases: [
      'military', 'army', 'navy', 'air force', 'special forces', 'special ops',
      'navy seals', 'green berets', 'sas', 'regiment', 'battalion', 'deployment',
      'veteran', 'war room', 'tank', 'fighter jet', 'missile', 'artillery',
      'infantry', 'commander', 'enlist', 'recruit', 'war game',
    ],
  },
  {
    niche: 'Podcast',
    weight: 3,
    phrases: [
      'podcast', 'episode', 'season', 'interview', 'conversation',
      'fireside chat', 'sit down interview', 'qa', 'ama', 'ask me anything',
      'guest', 'host', 'panel', 'roundtable', 'dialogue', 'debate',
    ],
  },
];

// ---------------------------------------------------------------------------
// Topic lexicon for tags. Each phrase maps to the canonical tag written to the
// row, so the same concept always produces the same string.
// ---------------------------------------------------------------------------

const TOPIC_LEXICON = {
  // Tech
  'artificial intelligence': 'AI', ai: 'AI', 'machine learning': 'AI',
  chatgpt: 'ChatGPT', llm: 'LLM', 'neural network': 'Neural Networks',
  robotics: 'Robotics', robot: 'Robotics', quantum: 'Quantum Computing',
  cybersecurity: 'Cybersecurity', hacking: 'Hacking', hack: 'Hacking',
  coding: 'Coding', programming: 'Coding', developer: 'Developer',
  software: 'Software', hardware: 'Hardware', apple: 'Apple', iphone: 'iPhone',
  google: 'Google', tesla: 'Tesla', spacex: 'SpaceX', nasa: 'NASA',
  bitcoin: 'Bitcoin', crypto: 'Crypto', nintendo: 'Nintendo',
  playstation: 'PlayStation', xbox: 'Xbox', openai: 'OpenAI',
  startup: 'Startups', saas: 'SaaS', automation: 'Automation',
  semiconductor: 'Semiconductors', chip: 'Semiconductors',
  smartphone: 'Smartphones', laptop: 'Laptops', battery: 'Batteries',
  firmware: 'Firmware', 'data breach': 'Data Breach', exploit: 'Exploits',

  // Business
  money: 'Money', income: 'Income', salary: 'Salaries', tax: 'Taxes',
  taxes: 'Taxes', budget: 'Budgeting', debt: 'Debt', mortgage: 'Mortgages',
  investing: 'Investing', investment: 'Investing', stocks: 'Stocks',
  'stock market': 'Stock Market', trading: 'Trading',
  economy: 'Economy', economic: 'Economy', inflation: 'Inflation',
  recession: 'Recession', 'cost of living': 'Cost of Living',
  'real estate': 'Real Estate', housing: 'Housing', rent: 'Rents',
  retirement: 'Retirement', wealth: 'Wealth', rich: 'Wealth',
  'working class': 'Class Economics', 'middle class': 'Class Economics',
  'class war': 'Class Economics', billionaires: 'Billionaires',
  billionaire: 'Billionaires', inequality: 'Inequality',
  'median income': 'Class Economics',
  'middle manager': 'Workplace', 'office politics': 'Workplace',
  'wfh': 'Remote Work', 'remote work': 'Remote Work',
  'business': 'Business', 'businesses': 'Business',
  brands: 'Brands', brand: 'Brands',
  sell: 'Sales', selling: 'Sales', sales: 'Sales',
  clients: 'Clients', client: 'Clients',
  products: 'Products', product: 'Products',
  services: 'Services', service: 'Services',
  pricing: 'Pricing', copy: 'Copywriting',
  content: 'Content', shorts: 'Shorts', reels: 'Reels',
  youtube: 'YouTube', tiktok: 'TikTok', instagram: 'Instagram',
  algorithm: 'Algorithms', algorithms: 'Algorithms',
  thumbnail: 'Thumbnails', thumbnails: 'Thumbnails',
  yacht: 'Luxury', 'fast food': 'Fast Food',
  hollywood: 'Hollywood', company: 'Companies', companies: 'Companies',
  founder: 'Founders', founders: 'Founders',
  'non profits': 'Nonprofits', 'non profits get so rich': 'Nonprofits',
  'next generation': 'Next Generation',
  'four day week': 'Work Culture', 'four-day week': 'Work Culture',
  'quiet quitting': 'Work Culture',
  interview: 'Interviews', interviews: 'Interviews',
  'landing page': 'Landing Pages', webinar: 'Webinars',
  'click through': 'CTR', 'click through rate': 'CTR',
  retention: 'Retention', 'churn rate': 'Churn',
  roi: 'ROI', 'return on investment': 'ROI',
  'case study': 'Case Studies', 'case studies': 'Case Studies',
  startup: 'Startups', founder: 'Founders', agency: 'Agencies',
  marketing: 'Marketing', branding: 'Branding', advertising: 'Advertising',
  ecommerce: 'Ecommerce', 'side hustle': 'Side Hustles',
  revenue: 'Revenue', profit: 'Profits', pricing: 'Pricing',
  'cold email': 'Cold Email', 'cold outreach': 'Cold Email',
  negotiation: 'Negotiation', freelancing: 'Freelancing',
  freelance: 'Freelancing', productivity: 'Productivity',
  entrepreneurship: 'Entrepreneurship', business: 'Business',
  'youTube channel': 'YouTube Growth', 'creator economy': 'Creator Economy',

  // Documentary / geopolitics
  history: 'History', historical: 'History', empire: 'Empires',
  dynasty: 'Dynasties', ancient: 'Ancient Civilizations',
  'cold war': 'Cold War', 'world war': 'World War',
  war: 'War', revolution: 'Revolutions', archaeology: 'Archaeology',
  conspiracy: 'Conspiracy', 'cover up': 'Cover-Ups',
  'cover-up': 'Cover-Ups', secret: 'Secrets', secrets: 'Secrets',
  mystery: 'Mysteries', unsolved: 'Unsolved Mysteries',
  vanished: 'Vanished', disappeared: 'Vanished',
  scandal: 'Scandals', corruption: 'Corruption', crime: 'Crime',
  murder: 'Murder', fraud: 'Fraud', mafia: 'Mafia', cartel: 'Cartels',
  biography: 'Biographies', 'true story': 'True Stories',
  'untold story': 'Untold Stories', untold: 'Untold Stories',
  dark: 'Dark Topics', 'dark side': 'Dark Topics',
  terrorism: 'Terrorism', assassination: 'Assassination',
  espionage: 'Espionage', 'cia': 'Spycraft', fbi: 'Spycraft',
  'human trafficking': 'Human Trafficking',
  smuggling: 'Smuggling',
  geopolitics: 'Geopolitics', 'foreign policy': 'Foreign Policy',
  sanctions: 'Sanctions', tariffs: 'Tariffs', diplomacy: 'Diplomacy',
  nato: 'NATO', 'european union': 'European Union',
  ukraine: 'Ukraine', russia: 'Russia', china: 'China', india: 'India',
  brazil: 'Brazil', israel: 'Israel', iran: 'Iran',
  'north korea': 'North Korea', venezuela: 'Venezuela',
  'middle east': 'Middle East',

  // Education / science
  explained: 'Explained', science: 'Science', physics: 'Physics',
  chemistry: 'Chemistry', biology: 'Biology', mathematics: 'Mathematics',
  stats: 'Statistics', statistics: 'Statistics',
  research: 'Research', study: 'Studies', studies: 'Studies',
  experiment: 'Experiments', theory: 'Theory',
  'quantum mechanics': 'Quantum Mechanics',
  psychology: 'Psychology', 'mental health': 'Mental Health',
  anxiety: 'Anxiety', depression: 'Depression', therapy: 'Therapy',
  dopamine: 'Dopamine', motivation: 'Motivation',
  discipline: 'Discipline', confidence: 'Self-Confidence',
  'self esteem': 'Self-Esteem', mindset: 'Mindset',
  'self improvement': 'Self-Improvement', habits: 'Habits',
  burnout: 'Burnout', stress: 'Stress',
  'lazy person': 'Laziness',
  book: 'Books', reading: 'Reading', masterclass: 'Masterclasses',
  tutorial: 'Tutorials', guide: 'Guides', course: 'Courses',
  tips: 'Tips', mistakes: 'Mistakes', 'life lesson': 'Life Lessons',
  'life lessons': 'Life Lessons', 'red flags': 'Red Flags',
  'signs of': 'Warning Signs', 'things to know': 'Things To Know',
  'gen z': 'Gen Z', millennials: 'Millennials', 'gen alpha': 'Gen Alpha',
  'boomers': 'Boomers', 'millennial': 'Millennials',
  // Demographic decline is a recurring framing in this genre; naming it beats
  // emitting the word "Kids".
  'having kids': 'Declining Birth Rates',
  'birth rate': 'Declining Birth Rates',
  'birth rates': 'Declining Birth Rates',
  'fertility': 'Declining Birth Rates',
  'not having kids': 'Declining Birth Rates',
  'population': 'Population Decline', 'population decline': 'Population Decline',
  childfree: 'Childfree', lonely: 'Loneliness', loneliness: 'Loneliness',
  island: 'Islands', islands: 'Islands', stranded: 'Stranded',
  youtuber: 'YouTubers', 'being youtuber': 'Creator Burnout',
  'creator burnout': 'Creator Burnout',
  jail: 'Prisons', prison: 'Prisons',
  'work anymore': 'Work', 'no one wants to work': 'Work',
  'dope': 'Culture', 'so good': 'Reviews',

  // Gaming / entertainment
  gaming: 'Gaming', gameplay: 'Gameplay', minecraft: 'Minecraft',
  roblox: 'Roblox', fortnite: 'Fortnite', gta: 'GTA',
  'grand theft auto': 'GTA', valorant: 'Valorant',
  'call of duty': 'Call of Duty', 'elden ring': 'Elden Ring',
  pokemon: 'Pokemon', zelda: 'Zelda',
  'league of legends': 'League of Legends', twitch: 'Twitch',
  speedrun: 'Speedrunning', 'lets play': "Let's Plays",
  "let's play": "Let's Plays",
  challenge: 'Challenges', stunt: 'Stunts',
  'world record': 'World Records', survival: 'Survival',
  'social experiment': 'Social Experiments',
  experiment: 'Experiments', prank: 'Pranks', comedy: 'Comedy',
  funny: 'Humor', meme: 'Memes', reaction: 'Reactions',
  trailer: 'Trailers', vlog: 'Vlogs', review: 'Reviews',
  unboxing: 'Unboxings', 'first look': 'First Looks',
  interview: 'Interviews', podcast: 'Podcasts', episode: 'Episodes',
  documentary: 'Documentaries', news: 'News', music: 'Music',
  anime: 'Anime', manga: 'Manga',
  '3d render': '3D Art', cgi: '3D Art', 'motion graphics': 'Motion Design',
  animation: 'Animation', blender: 'Blender', photoshop: 'Photoshop',
  design: 'Design', typography: 'Typography', 'color theory': 'Color Theory',
  logo: 'Logos', branding: 'Branding',

  // Sports / fitness / lifestyle
  football: 'Football', soccer: 'Football', 'premier league': 'Premier League',
  'champions league': 'Champions League', 'world cup': 'World Cup',
  transfer: 'Transfers', striker: 'Strikers',
  'middle east football': 'Football', messi: 'Messi', ronaldo: 'Ronaldo',
  nba: 'NBA', nfl: 'NFL', mma: 'MMA', ufc: 'UFC', boxing: 'Boxing',
  formula: 'Formula 1', f1: 'Formula 1', olympics: 'Olympics',
  golf: 'Golf', tennis: 'Tennis', cricket: 'Cricket',
  basketball: 'Basketball', motorsport: 'Motorsport',
  workout: 'Workouts', fitness: 'Fitness', gym: 'Gym',
  muscle: 'Muscle', physique: 'Physique', nutrition: 'Nutrition',
  diet: 'Diet', protein: 'Protein', 'weight loss': 'Weight Loss',
  health: 'Health', training: 'Training',
  travel: 'Travel', 'digital nomad': 'Digital Nomads',
  minimalism: 'Minimalism', declutter: 'Decluttering',
  routine: 'Routines', 'morning routine': 'Morning Routines',
  'day in my life': 'Day In My Life',
  motivation: 'Motivation', 'cold plunge': 'Cold Plunge',
  'walmart': 'Walmart', etsy: 'Etsy', costco: 'Costco', nike: 'Nike',
  gucci: 'Gucci', prada: 'Prada', rolex: 'Rolex', lego: 'LEGO',
  'fast food': 'Fast Food', mcdonalds: "McDonald's",
  mcdonald: "McDonald's", starbucks: 'Starbucks',
  'online gambling': 'Online Gambling', gambling: 'Gambling',
  casino: 'Gambling', casino: 'Gambling', betting: 'Betting',
  'car prices': 'Car Prices', 'car price': 'Car Prices',
  'used cars': 'Car Prices', 'housing market': 'Housing',
  'grocery prices': 'Cost of Living', 'food prices': 'Cost of Living',
  'energy prices': 'Cost of Living', 'gas prices': 'Cost of Living',
  'psychology': 'Psychology', 'social media': 'Social Media',
  subscribers: 'Subscriber Growth', 'subscriber': 'Subscriber Growth',
  'thumbnail': 'Thumbnails', thumbnails: 'Thumbnails',
  'glare': 'Glare', 'impossible': 'Impossible',
  'slop': 'Slop Culture', 'slop bowls': 'Slop Culture',
  'states': 'US States', 'washington d.c.': 'Washington',
  'afford': 'Cost of Living', 'anymore': 'Cost of Living',
  'unstoppable': 'Growth', 'outsmarted': 'Strategy',
  'become a': 'Growth', 'extreme': 'Extreme',
  'miniscule': 'Scale', 'tiny': 'Scale', 'giant': 'Scale',
  'massive': 'Scale', 'largest': 'Scale', 'smallest': 'Scale',
  'weirdest': 'Unusual', 'strangest': 'Unusual',
  'banned': 'Censorship', 'censored': 'Censorship',
  'dangerous': 'Danger', 'deadly': 'Danger', 'deadliest': 'Danger',
  'terrifying': 'Danger', 'scary': 'Danger', 'brutal': 'Danger',
  prison: 'Prisons', 'prison break': 'Prison Breaks',
  'prison escape': 'Prison Breaks', jail: 'Prisons',
  'embarrassed': 'Scandals', 'national embarrassment': 'Scandals',
  scandal: 'Scandals', roast: 'Roasts', roasts: 'Roasts',
  'drama': 'Drama', beef: 'Feuds', feud: 'Feuds',
  'high sea': 'Maritime', maritime: 'Maritime', piracy: 'Piracy',
  pirates: 'Piracy', smuggler: 'Smuggling',
  'tutorial for': 'Tutorials', 'facebook ads': 'Facebook Ads',
  'google ads': 'Google Ads', 'youtube seo': 'YouTube Growth',
  script: 'Screenwriting', scripts: 'Screenwriting',
  'screenplay': 'Screenwriting', writing: 'Writing',
  storyboarding: 'Storyboarding', 'storytelling': 'Storytelling',
  earthquake: 'Earthquakes', 'natural disaster': 'Natural Disasters',
  climate: 'Climate', 'global warming': 'Climate',
  'glasses': 'Wearables', 'smart glasses': 'Wearables',
  'meta glasses': 'Wearables', wearable: 'Wearables',
  'timelapse': 'Timelapse', 'colour grading': 'Color Grading',
  'color grading': 'Color Grading', 'film grain': 'Film Grain',
  'lighting': 'Lighting', 'composition': 'Composition',
  'magnets': 'Magnets', 'fridge': 'Appliances',
  'washing machine': 'Appliances', 'tumble dryer': 'Appliances',
  microwave: 'Appliances', dishwasher: 'Appliances',
  headphones: 'Audio', speakers: 'Audio', microphone: 'Audio',
  'noise cancelling': 'Audio', earbuds: 'Audio',
  london: 'London', paris: 'Paris', tokyo: 'Tokyo',
  dubai: 'Dubai', singapore: 'Singapore', 'new york': 'New York',
  'los angeles': 'Los Angeles', 'san francisco': 'San Francisco',
  berlin: 'Berlin', toronto: 'Toronto', sydney: 'Sydney',
  washington: 'Washington', 'hong kong': 'Hong Kong',
  'middle east': 'Middle East', india: 'India',

  // Military
  military: 'Military', army: 'Military', navy: 'Navy',
  'air force': 'Air Force', 'special forces': 'Special Forces',
  'special ops': 'Special Operations', tank: 'Tanks',
  'fighter jet': 'Fighter Jets', missile: 'Missiles',
  infantry: 'Infantry', veteran: 'Veterans', war: 'War',
  'civil war': 'Civil War', 'cold war': 'Cold War',
  'prince harry': 'Royalty', 'king charles': 'Royalty',
  'royal family': 'Royalty', monarchy: 'Monarchy', queen: 'Royalty',
  'princess diana': 'Royalty', 'white house': 'Politics',
  president: 'Politics', 'prime minister': 'Politics',
  election: 'Elections', trump: 'Politics', biden: 'Politics',
  'border': 'Borders', immigration: 'Immigration',
  'social media': 'Social Media', algorithm: 'Algorithms',
  instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube',
  'ai generated': 'AI Generated', 'ai art': 'AI Art',
};

// Capitalised words that are still just English. Without these the proper-noun
// pass reads "Why Gen Z GAVE UP Having Kids" as tags named "Gen" and "Having".
// Modals, auxiliaries and light verbs that survive title-casing. "How I Would
// Build A Business" was emitting "Build" and "Start" as tags.
const COMMON_VERBS = new Set([
  'would', 'could', 'should', 'must', 'might', 'will', 'can', 'cannot',
  'need', 'needs', 'needed', 'want', 'wants', 'let', 'lets', 'help',
  'helps', 'use', 'uses', 'using', 'used', 'make', 'makes', 'making',
  'get', 'gets', 'getting', 'keep', 'keeps', 'keeping', 'tell', 'tells',
  'telling', 'talk', 'talks', 'talking', 'give', 'gives', 'giving',
  'take', 'takes', 'taking', 'put', 'puts', 'putting', 'come', 'comes',
  'coming', 'went', 'gone', 'goes', 'going', 'went', 'ran', 'run',
  'build', 'builds', 'building', 'built', 'start', 'starts', 'starting',
  'started', 'end', 'ends', 'ending', 'ended', 'turn', 'turns',
  'turning', 'turned', 'seem', 'seems', 'become', 'becomes', 'becoming',
  'feel', 'feels', 'feeling', 'felt', 'leave', 'leaves', 'leaving',
  'left', 'put', 'mean', 'means', 'meaning', 'said', 'says', 'say',
  'grew', 'grow', 'grows', 'growing', 'sold', 'sell', 'sells', 'selling',
  'bought', 'buy', 'buys', 'buying', 'paid', 'pay', 'pays', 'paying',
  'lost', 'lose', 'loses', 'losing', 'won', 'win', 'wins', 'winning',
  'found', 'find', 'finds', 'finding', 'told', 'tell', 'tells',
  'sent', 'send', 'sends', 'sending', 'brought', 'bring', 'brings',
  'bringing', 'held', 'hold', 'holds', 'holding', 'kept', 'keep',
  'beat', 'beats', 'beating', 'broke', 'break', 'breaks', 'breaking',
  'choose', 'chose', 'chosen', 'choice', 'chances', 'chance',
  // -ing forms. Titles capitalise them mid-sentence, so they look like nouns.
  'having', 'giving', 'taking', 'making', 'getting', 'going', 'being',
  'doing', 'saying', 'telling', 'showing', 'trying', 'asking', 'looking',
  'knowing', 'thinking', 'putting', 'working', 'moving', 'living',
  'starting', 'stopping', 'building', 'breaking', 'watching', 'finding',
  'losing', 'winning', 'earning', 'spending', 'saving', 'investing',
  'growing', 'running', 'driving', 'flying', 'swimming', 'eating',
  'drinking', 'sleeping', 'waking', 'walking', 'talking', 'reading',
  'writing', 'coding', 'gaming', 'trading', 'holding', 'bringing',
  'keeping', 'feeling', 'becoming', 'removing', 'adding', 'removes',
  'adds', 'makes', 'made',
  // Comparatives and judgement words. "The Job Market Is WORSE Than You
  // Think" was emitting "Worse" as a topic.
  'knew', 'wished', 'wish', 'wishes', 'fixing', 'fix', 'fixes',
  'edit', 'editing', 'edited', 'changed', 'changing', 'kill', 'killing',
  'forcing', 'forces', 'creating', 'create', 'created', 'advice',
  'died', 'dies', 'attacked', 'attack', 'attacking', 'solve', 'solves',
  'solving', 'solved', 'predict', 'predicts', 'predicted',
  'manipulates', 'manipulating', 'replaced', 'replacing',
  'worse', 'better', 'easier', 'harder', 'faster', 'slower',
  'bigger', 'smaller', 'cheaper', 'expensive', 'everywhere',
  'broke', 'broken', 'works', 'figured', 'wishful',
]);

// Titles are shouty on purpose, so ALL-CAPS runs carry real signal about the
// thumbnail's on-image text. These are kept as a hook tag, not as free tags.
const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'this', 'that', 'your', 'have', 'has',
  'had', 'they', 'will', 'would', 'should', 'could', 'when', 'what', 'which',
  'who', 'why', 'how', 'are', 'was', 'were', 'been', 'being', 'you', 'our',
  'but', 'not', 'all', 'can', 'its', 'his', 'her', 'their', 'them', 'then',
  'than', 'into', 'out', 'about', 'over', 'under', 'again', 'more', 'most',
  'some', 'any', 'every', 'very', 'much', 'many', 'just', 'now', 'get',
  'got', 'make', 'made', 'take', 'took', 'know', 'think', 'need', 'want',
  'like', 'did', 'does', 'done', 'going', 'get', 'one', 'two', 'after',
  'before', 'because', 'why', 'up', 'down', 'off', 'on', 'at', 'by', 'of',
  'in', 'to', 'from', 'a', 'an', 'as', 'or', 'if', 'so', 'no', 'yes',
  'new', 'top', 'best', 'worst', 'actually', 'literally', 'honestly',
  'guy', 'guys', 'people', 'stuff', 'things', 'way', 'lot', 'bit',
  // Fragments that survived word-splitting in the old tags ("Gen", "Gave").
  'gen', 'mill', 'kids', 'boy', 'girl', 'boyfriend', 'girlfriend',
  'wife', 'husband', 'mom', 'dad', 'friend', 'friends', 'family',
  'gave', 'gives', 'told', 'says', 'said',
  // Capitalised function words the proper-noun pass was reading as entities.
  'these', 'this', 'those', 'these', 'entire', 'behind', 'high', 'every',
  'someone', 'something', 'anyone', 'everything', 'nothing', 'another',
  'first', 'last', 'next', 'old', 'new', 'good', 'bad', 'best', 'worst',
  'real', 'true', 'actual', 'actually', 'literally', 'honestly', 'wrong',
  'right', 'left', 'own', 'very', 'much', 'many', 'more', 'most', 'less',
  'few', 'such', 'only', 'even', 'also', 'still', 'yet', 'soon', 'now',
  'here', 'there', 'where', 'why', 'really', 'literally', 'billionaires',
  'millionaires', 'celebrity', 'celebrities', 'million', 'billion',
  'trillion', 'thousand', 'hundred', 'percent', 'average', 'total',
  'half', 'double', 'triple', 'single', 'double', 'twice', 'thrice',
]);

/**
 * Tags whose text is a substring of another tag already chosen. Without this,
 * "If You Don't Understand Psychology, You Don't Understand Social Media"
 * produced Social Media + Social + Media as three separate tags.
 */
function dropSubsumed(tags) {
  const result = [];
  for (const tag of tags) {
    const low = tag.toLowerCase();
    const covered = result.some((kept) => {
      const keptLow = kept.toLowerCase();
      return keptLow !== low && keptLow.includes(low);
    });
    if (!covered) result.push(tag);
  }
  return result;
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Matches whole words or whole phrases only. "ai" cannot match inside "said"
 * and "war" cannot match inside "warm", which the previous includes() matching
 * allowed.
 */
function hasPhrase(normalized, phrase) {
  const re = new RegExp(`(^|[^a-z0-9])${escapeRe(phrase)}([^a-z0-9]|$)`, 'i');
  return re.test(normalized);
}

function normalize(title) {
  return ` ${String(title || '')
    .toLowerCase()
    .replace(/[^a-z0-9' ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()} `;
}

/** Capitalised runs in the title, minus the leading word. Good entity signal. */
function properNouns(title) {
  const cleaned = String(title || '').replace(/[^\w\s'&-]/g, ' ').trim();
  const words = cleaned.split(/\s+/);
  const found = [];
  for (let i = 1; i < words.length; i += 1) {
    const w = words[i];
    if (w.length < 3) continue;
    if (!/^[A-Z][a-z]+$/.test(w)) continue;
    const low = w.toLowerCase();
    if (STOPWORDS.has(low) || COMMON_VERBS.has(low)) continue;
    found.push(w);
  }
  return found;
}

function scoreNiche(normalized) {
  const scores = new Map();
  for (const entry of NICHE_LEXICON) {
    let score = 0;
    const hits = [];
    for (const phrase of entry.phrases) {
      if (hasPhrase(normalized, phrase)) {
        score += entry.weight;
        hits.push(phrase);
      }
    }
    if (score > 0) scores.set(entry.niche, { score, hits });
  }
  return scores;
}

function pickNiche(title, channelName, defaultNiche) {
  const normalized = normalize(title);
  const scores = scoreNiche(normalized);

  const prior = CHANNEL_PRIOR[channelName];
  if (prior && scores.has(prior)) {
    const entry = scores.get(prior);
    entry.score += 1.5; // tiebreak only, never decisive
    scores.set(prior, entry);
  }

  // A headline figure is a money signal that normalize() cannot see, because it
  // strips the currency symbol. Read it off the raw title and weight it as
  // strongly as an unambiguous Business keyword: "$1,000,000 empire collapsed"
  // is business framing, not just history.
  const raw = String(title || '');
  const currencyMarked = /[$€£¥]\s?\d/.test(raw);
  const groupedFigure = /(^|[^0-9])(\d{1,3}(?:[,\s]\d{3})+|\d{6,})([^0-9]|$)/.test(raw);
  if (currencyMarked || groupedFigure) {
    const entry = scores.get('Business') || { score: 0, hits: ['headline figure'] };
    entry.score += 3;
    scores.set('Business', entry);
  }

  if (scores.size > 0) {
    let best = null;
    for (const [niche, entry] of scores) {
      if (!best || entry.score > best.score) best = { niche, ...entry };
    }
    // A single weak hit should not outrank the channel's own default.
    if (best.score >= 2) return { niche: best.niche, scores, normalized };
  }

  return { niche: defaultNiche || prior || 'Educational', scores, normalized };
}

function pickStyles(title, normalized, channelName) {
  const scores = new Map();
  const bump = (style, amount) => {
    if (!VISUAL_STYLES.has(style)) return;
    scores.set(style, (scores.get(style) || 0) + amount);
  };

  // Comparison framing is the clearest split-screen cue in a title.
  if (hasPhrase(normalized, 'vs') || hasPhrase(normalized, 'versus') ||
      hasPhrase(normalized, 'compared') || hasPhrase(normalized, 'difference') ||
      hasPhrase(normalized, 'before and after') || hasPhrase(normalized, 'then vs now')) {
    bump('Split Screen / Before-After', 3);
  }
  if (hasPhrase(normalized, 'ranking') || hasPhrase(normalized, 'every') ||
      hasPhrase(normalized, 'top 10') || hasPhrase(normalized, 'signs') ||
      hasPhrase(normalized, 'reasons') || hasPhrase(normalized, 'types') ||
      hasPhrase(normalized, 'ways')) {
    bump('Text-Heavy / Typography', 2);
  }
  if (hasPhrase(normalized, 'explained') || hasPhrase(normalized, 'breakdown') ||
      hasPhrase(normalized, 'how to') || hasPhrase(normalized, 'why') ||
      hasPhrase(normalized, 'what is') || hasPhrase(normalized, 'tutorial')) {
    bump('Text-Heavy / Typography', 2);
    bump('High-Contrast Glow', 1);
  }
  if (hasPhrase(normalized, 'interview') || hasPhrase(normalized, 'podcast') ||
      hasPhrase(normalized, 'reaction') || hasPhrase(normalized, 'reacts') ||
      hasPhrase(normalized, 'sit down') || hasPhrase(normalized, 'talks to') ||
      hasPhrase(normalized, 'meets') || hasPhrase(normalized, 'face to face') ||
      hasPhrase(normalized, 'asks')) {
    bump('Face Close-up', 3);
  }
  if (hasPhrase(normalized, 'render') || hasPhrase(normalized, 'cgi') ||
      hasPhrase(normalized, 'animation') || hasPhrase(normalized, 'blender') ||
      hasPhrase(normalized, 'ai art') || hasPhrase(normalized, 'ai generated') ||
      hasPhrase(normalized, 'motion graphics')) {
    bump('3D Render / CGI', 3);
  }
  if (hasPhrase(normalized, 'anime') || hasPhrase(normalized, 'manga') ||
      hasPhrase(normalized, 'comic') || hasPhrase(normalized, 'illustration') ||
      hasPhrase(normalized, 'cartoon')) {
    bump('Illustrated / Anime', 3);
  }
  if (hasPhrase(normalized, 'minimalist') || hasPhrase(normalized, 'minimal') ||
      hasPhrase(normalized, 'clean design') || hasPhrase(normalized, 'simple') ||
      hasPhrase(normalized, 'rebuild') || hasPhrase(normalized, 'redesign') ||
      hasPhrase(normalized, 'from scratch')) {
    bump('Minimalist & Clean', 3);
  }

  const prior = CHANNEL_STYLE_PRIOR[channelName];
  if (prior) bump(prior, 2);

  // Thumbnail titles are short and shouty: a capitalised or ALL-CAPS run is on
  // the image itself, which is a text-heavy composition.
  const raw = String(title || '');
  const caps = raw.match(/\b[A-Z][A-Z0-9]{3,}\b/g);
  if (caps && caps.length >= 1) bump('Text-Heavy / Typography', 1.5);
  if (/^\s*[A-Z0-9$€£%?!\s]{12,}\s*$/.test(raw)) bump('No-Text / Visual Hook', 1);

  if (scores.size === 0) return ['Text-Heavy / Typography'];
  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([style]) => style);
}

function pickEmotion(title, normalized) {
  const scores = new Map();
  const bump = (emotion, amount) => {
    if (!EMOTIONS.has(emotion)) return;
    scores.set(emotion, (scores.get(emotion) || 0) + amount);
  };

  if (hasPhrase(normalized, 'shocking') || hasPhrase(normalized, 'insane') ||
      hasPhrase(normalized, 'unbelievable') || hasPhrase(normalized, 'wild') ||
      hasPhrase(normalized, 'crazy') || hasPhrase(normalized, 'stunned') ||
      hasPhrase(normalized, 'nobody expected')) bump('Shocked', 3);
  if (hasPhrase(normalized, 'emergency') || hasPhrase(normalized, 'urgent') ||
      hasPhrase(normalized, 'warning') || hasPhrase(normalized, 'alert') ||
      hasPhrase(normalized, 'before it') || hasPhrase(normalized, 'act now') ||
      hasPhrase(normalized, 'last chance') || hasPhrase(normalized, 'stop')) bump('Urgent', 3);
  if (hasPhrase(normalized, 'terrifying') || hasPhrase(normalized, 'brutal') ||
      hasPhrase(normalized, 'horrifying') || hasPhrase(normalized, 'darkest') ||
      hasPhrase(normalized, 'deadliest') || hasPhrase(normalized, 'worst') ||
      hasPhrase(normalized, 'fight') || hasPhrase(normalized, 'war') ||
      hasPhrase(normalized, 'destroyed')) bump('Intense', 3);
  if (hasPhrase(normalized, 'secret') || hasPhrase(normalized, 'mystery') ||
      hasPhrase(normalized, 'unknown') || hasPhrase(normalized, 'unsolved') ||
      hasPhrase(normalized, 'hidden') || hasPhrase(normalized, 'vanished') ||
      hasPhrase(normalized, 'nobody knows') || hasPhrase(normalized, 'conspiracy')) bump('Mysterious', 3);
  if (hasPhrase(normalized, 'mastery') || hasPhrase(normalized, 'pro') ||
      hasPhrase(normalized, 'winning') || hasPhrase(normalized, 'success') ||
      hasPhrase(normalized, 'blueprint') || hasPhrase(normalized, 'framework') ||
      hasPhrase(normalized, 'strategy')) bump('Confident', 3);
  if (hasPhrase(normalized, 'funny') || hasPhrase(normalized, 'happy') ||
      hasPhrase(normalized, 'wholesome') || hasPhrase(normalized, 'feel good') ||
      hasPhrase(normalized, 'relaxing')) bump('Happy', 3);
  if (hasPhrase(normalized, 'why') || hasPhrase(normalized, 'how') ||
      hasPhrase(normalized, 'what if') || hasPhrase(normalized, 'explained') ||
      hasPhrase(normalized, 'explorer') || hasPhrase(normalized, 'understand') ||
      hasPhrase(normalized, 'learn')) bump('Curious', 2);

  if (scores.size === 0) return 'Curious';
  return [...scores.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

function pickTags(title, normalized, channelName, niche) {
  const tags = new Set();
  tags.add(niche);

  // Curated topics, longest phrase first so "cost of living" wins over "cost".
  const phrases = Object.keys(TOPIC_LEXICON).sort((a, b) => b.length - a.length);
  for (const phrase of phrases) {
    if (tags.size >= 7) break;
    if (hasPhrase(normalized, phrase)) tags.add(TOPIC_LEXICON[phrase]);
  }

  // Entities the lexicon does not know about.
  for (const noun of properNouns(title)) {
    if (tags.size >= 7) break;
    if (channelName && noun.toLowerCase() === channelName.toLowerCase()) continue;
    tags.add(noun);
  }

  // A row with a single tag is nearly useless for filtering, and short titles
    // ("Dope Tech: STILL so good!") carry no lexicon match at all. Fall back to
    // the title's own distinctive words to reach a usable minimum.
    if (tags.size < 3) {
    const words = String(title || '')
      .replace(/[^A-Za-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 3 && !STOPWORDS.has(w.toLowerCase()) &&
        !COMMON_VERBS.has(w.toLowerCase()));
    const seen = new Set([...tags].map((t) => t.toLowerCase()));
    for (const w of words) {
      if (tags.size >= 4) break;
      const key = w.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      tags.add(w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
    }
  }

  return dropSubsumed([...tags]).slice(0, 7);
}

function hookTag(title) {
  const caps = String(title || '').match(/\b[A-Z][A-Z0-9]{4,}\b/g);
  if (!caps) return null;
  const word = caps.find((c) => !STOPWORDS.has(c.toLowerCase()));
  return word || null;
}

/**
 * @param {string} title
 * @param {string} channelName
 * @param {string} defaultNiche
 * @returns {{niche:string, tags:string[], styles:string[], emotion:string, hookWord:string|null, breakdownNotes:string}}
 */
function analyzeAndTagTitle(title, channelName = '', defaultNiche = 'Educational') {
  const cleanTitle = String(title || '').trim();
  const normalized = normalize(cleanTitle);

  const { niche } = pickNiche(cleanTitle, channelName, defaultNiche);
  const styles = pickStyles(cleanTitle, normalized, channelName);
  const emotion = pickEmotion(cleanTitle, normalized);
  const tags = pickTags(cleanTitle, normalized, channelName, niche);
  const hookWord = hookTag(cleanTitle);

  // Descriptive, and it states what was actually inferred. Avoids the old
  // blanket "high CTR" claim, which was applied to all 2000+ rows regardless.
  const hook = hookWord ? ` On-image hook word "${hookWord}".` : '';
  const breakdownNotes =
    `Tagged "${cleanTitle}" (${channelName || 'unknown channel'}) as ${niche}, ` +
    `${emotion.toLowerCase()} tone, ${styles.join(' + ')} composition.${hook} ` +
    `Keywords: ${tags.filter((t) => t !== niche).join(', ') || 'none'}.`;

  return { niche, tags, styles, emotion, hookWord, breakdownNotes };
}

module.exports = {
  analyzeAndTagTitle,
  VISUAL_STYLES,
  EMOTIONS,
  CHANNEL_PRIOR,
  CHANNEL_STYLE_PRIOR,
};