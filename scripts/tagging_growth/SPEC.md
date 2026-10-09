# Category tagging spec

You are assigning **category tags** to YouTube thumbnail rows so the app's
category filter works. This is a reading task: **use the video title text and
nothing else.** Do not fetch the image, do not open the thumbnail URL, do not
look at the video. The title plus the channel name is the whole input.

These rows come from creator-growth, business, marketing/SEO, AI and developer
channels, so the titles skew toward making money, growing channels, tooling and
software. Do not let the channel's reputation decide the tag — read the title
and tag what it is actually about. A video from a business channel about a
specific tax rule is `Business` + `Economy`, not `Mindset`.

## Output

- **2 to 5 categories per row.** Never zero. Never one.
- Only names from the taxonomy below. If nothing fits well, still pick the
  closest 2.
- Prefer **specific over generic**. "AI Agents" style tools are still `AI` +
  `Software`; a founder origin story is `Business` + `Entrepreneurship`.
- Only add a category the title supports. Do not pad with ones that merely
  could apply.

## Taxonomy

Existing filter categories:
IRL, Business, Tech, Entertainment, Gaming, Sports, Documentary, Educational,
Podcast, Interviews, Football, Mindset, Self-Improvement, Lifestyle,
Entrepreneurship, Geopolitics, Military, Nfl, Psychology, Soccer, Video Games,
Vlog, War

Additional categories you may use:
Food, Cooking, Cars, Automotive, Aviation, Engineering, Design, Music, Beauty,
Fashion, Science, Space, Nature, Animals, True Crime, Mystery, History,
Geography, Travel, News, Politics, Art, Animation, Photography, Software,
Hardware, AI, Cybersecurity, Crypto, Real Estate, Investing, Economy, Sales,
Marketing, Career, Productivity, Study, Language, Fitness, Workout, Nutrition,
Mental Health, Family, Kids, Comedy, Challenge, Interview, News Commentary,
Consumer, Home, DIY, Survival, Esports, Tabletop, Movie Review, E-commerce,
Language Learning, Creator, YouTube Growth, SEO, Copywriting, Email Marketing,
Paid Ads, Social Media, Content Creation, Freelancing, Ecommerce, Dropshipping,
Passive Income, Stocks, Crypto, Entrepreneurship, Negotiation, Leadership,
Team Building, Time Management, Focus, Habits, Sleep, Dating, Parenting,
Marriage, Self Improvement, Motivation, Public Speaking, Networking, Coaching,
Mentorship, Editing, Filmmaking, Photography, Design, Figma, Photoshop, Blender,
Coding, Web Development, Data Science, Machine Learning, DevOps, Cybersecurity,
Open Source, SaaS, Side Hustle, Affiliate Marketing, Dropshipping, Dropship,
Cold Email, Growth, Scaling, Fundraising, Venture Capital, Startups, Analytics,
Data, No Code, Prompting, Automation, Agents, LLM, OpenAI, ChatGPT

Guidance on borderline calls:

- A video about building/starting a business → `Entrepreneurship` (+ `Startup` if a company story)
- A video teaching a marketing channel → `Marketing`, `Sales`, or the specific channel
- An explainer of a coding topic → the specific language/tool area plus `Software`
- A creator/growth video about thumbnails, titles, CTR, or audience growth → `Creator` + `YouTube Growth`
- An AI product/tool demo → `AI` + `Software` (add `Automation` for workflow automation)
- A podcast/interview episode → `Interviews` or `Podcast` plus the guest's field
- A personal story framing a lesson → `Documentary` or the topic plus the lesson's field
- Generic life advice or discipline content → `Mindset` or `Self-Improvement`
- Money/income/how-to-earn content → the specific vehicle (`Affiliate Marketing`, `Dropshipping`, `Real Estate`, `Stocks`) plus `Business`
- A video dissecting someone else's business or channel → `Documentary` + the field

## Format

Write to the sibling file named in your task, e.g. batch_000.json becomes
`tags_000.json`:

```json
[
  {"id": "thumb-yt-XXX", "categories": ["AI", "Software"]},
  {"id": "thumb-yt-YYY", "categories": ["Entrepreneurship", "Business"]}
]
```

- Same ids as the input, same order, one entry per input row, no omissions.
- Valid JSON, no trailing commas, no comments.
- Keep the file under ~40 KB.

## Output file names

Input `scripts/tagging_growth/batch_NNN.json` → output `scripts/tagging_growth/tags_NNN.json`