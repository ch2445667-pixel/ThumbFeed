# Category tagging spec

You are assigning **category tags** to YouTube thumbnail rows so the app's
category filter works. This is a reading task: **use the video title text and
nothing else.** Do not fetch the image, do not open the thumbnail URL, do not
look at the video. The title plus the channel name is the whole input.

## Output

For every input row, emit categories. Rules:

- **2 to 5 categories per row.** Never zero. Never one.
- Only use names from the taxonomy below. If nothing fits well, still pick the
  closest 2.
- Prefer **specific over generic**. "True Crime" beats "Documentary".
  "Cars" beats "Tech". Prefer the topic the title is *about*.
- Only add a category when the title supports it. Do not pad with categories
  that merely could apply.

## Taxonomy

Existing filter categories:
IRL, Business, Tech, Entertainment, Gaming, Sports, Documentary, Educational,
Podcast, Interviews, Football, Mindset, Self-Improvement, Lifestyle,
Entrepreneurship, Geopolitics, Military, Nfl, Psychology, Soccer, Video Games,
Vlog, War

Additional categories you may use (they will be added to the filter):
Food, Cooking, Cars, Automotive, Aviation, Engineering, Design, Music,
Beauty, Fashion, Science, Space, Nature, Animals, True Crime, Mystery,
History, Geography, Travel, News, Politics, Art, Animation, Photography,
Software, Hardware, AI, Cybersecurity, Crypto, Real Estate, Investing,
Economy, Sales, Marketing, Career, Productivity, Study, Language, Fitness,
Workout, Nutrition, Mental Health, Family, Kids, Comedy, Challenge, Interview,
News Commentary, Consumer, Fashion Design, Home, DIY, Survival, Aviation,
Esports, Tabletop, Movie Review, Crypto, E-commerce, Language Learning

Guidance on borderline calls:

- A cooking/recipe video → `Food` (and `Cooking` if technique-focused)
- A car review/race → `Cars` (+ `Automotive` when it's engineering-focused)
- A space/rocket/physics explainer → `Science`, add `Space` when cosmic
- A murder case / disappearance / criminal investigation → `True Crime`
- A ghost/alien/unexplained-supernatural video → `Mystery`
- A company founder or earnings story → `Business` (+ `Investing`/`Startup`)
- A gym workout → `Fitness` (+ `Workout`)
- A makeup tutorial → `Beauty`; clothing → `Fashion`
- An interview/conversation episode → `Interviews` (+ the guest's field)
- A short-form meme/comedy clip → `Comedy` or `Entertainment`
- A language lesson → `Language` (+ `Language Learning`)
- Sports must be specific: use `Football`/`Soccer`/`Nfl` when it is clearly
  American football / soccer / NFL, plus `Sports`
- Gameplay of a specific game → `Gaming`; the game genre topic → `Video Games`
  when the video is about games as a medium
- A person explaining a topic with slides/animation → `Educational`
- Anything primarily political/current affairs → `Geopolitics` or `Politics`
- Military conflict/history → `Military` or `War`

## Format

Write to the sibling file named in your task, e.g. batch_000.json becomes
`tags_000.json`:

```json
[
  {"id": "thumb-yt-XXX", "categories": ["Food", "Cooking"]},
  {"id": "thumb-yt-YYY", "categories": ["True Crime", "Documentary"]}
]
```

- Same ids as the input, same order, one entry per input row, no omissions.
- Valid JSON, no trailing commas, no comments.
- Keep the file under ~40 KB; if a batch is long that is fine.

## Output file names

Input `scripts/tagging/batch_NNN.json` → output `scripts/tagging/tags_NNN.json`