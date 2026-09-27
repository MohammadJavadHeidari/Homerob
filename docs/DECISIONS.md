# Decisions (locked — do not re-open)

## Product
- Name: **Homerob** (Torob + Home). Repo: https://github.com/MohammadJavadHeidari/Homerob
- Market: real estate, **all six Divar «املاک» categories** (2026-09-27, supersedes "rental only"):
  residential rent/sale, office & commercial rent/sale, short-term rentals, construction projects.
- Scale: **all of Iran** — any city; a city is "covered" once it has listings (2026-09-26, supersedes
  "Mashhad only").
- Data: **real listings only** (Divar, Sheypoor, …), flat JSON/TS file, **no database** (2026-09-26,
  supersedes "seeded sample dataset, no live scraping"). The seeded Mashhad sample set stays only until
  real data replaces it; no new fake listings. No sellers' phone numbers or other personal data.
- Core feature: **natural-language intent → ranking + per-result AI explanation**.
- Secondary feature: price normalization (rahn ↔ ejare comparison). Supporting, not the focus.
- Ranking: **hard filter** listings over the stated budget; **soft-weight** neighborhood,
  room count, amenities, etc.
- Parsed intent (budget, neighborhood, rooms, …) is shown to the user as **chips/tags**.

## Tech
- Single **Next.js** app with **API routes** (no separate backend), **TypeScript**.
- **Tailwind CSS** with full **RTL** support.
- **shadcn/ui** with the **base-ui** preset.
- Deploy on **Vercel** with a live link for reviewers.
- AI provider: **Claude** preferred; ChatGPT (OpenAI) key available as backup. Build a small
  provider abstraction so switching is one env var.

## Demo
- Output: a demo video, **max 5 minutes**, narrated in **Persian**, plus the live Vercel link.
- Goal: speed and demoability, show product thinking — not stack showcasing.

## Log (append new decisions below with date)
- 2026-09-24 — **AI provider: Claude.** Owner obtained an Anthropic API key (stored only in
  `.env.local` / Vercel env vars). Account has no credits yet → mock provider until credits are added.
- 2026-09-24 — **AI provider switched to DeepSeek** (owner's call; supersedes the Claude entry above).
  OpenAI-compatible API at `https://api.deepseek.com`, models `deepseek-flash` (default, fast/cheap)
  and `deepseek-v4-pro`. Provider abstraction keeps `claude`/`openai` as options. Account has $0
  balance yet → mock provider until topped up.
- 2026-09-24 — **AI provider: Google Gemini free tier** (owner has no budget; supersedes the
  DeepSeek and Claude entries above). Via the OpenAI-compatible endpoint
  `https://generativelanguage.googleapis.com/v1beta/openai/`, key in `GEMINI_API_KEY`.
  Primary model `gemini-3.6-flash` (~2.5s, best quality); fallback `gemini-3.5-flash-lite`
  (~0.7s) on 429/503 — `gemini-2.5-*` is closed to new users and `gemini-3.8-flash` /
  `gemini-flash-latest` returned 503 (high demand) when tested. Free-tier daily caps apply,
  so cache repeated queries. Provider abstraction keeps `mock`/`deepseek`/`claude`/`openai`.
- 2026-09-24 — Gemini model order changed after load testing: `gemini-3.5-flash-lite` first
  (~0.8s when healthy), then `gemini-flash-lite-latest`, then `gemini-3.6-flash` (mostly 503).
  Requests are hedged (next model after 1.5s, 5s deadline) and fall back to the rule parser.
- 2026-09-24 — **divar-mcp: ideas only, no connection.** Borrow product ideas (placeholder-price
  detection, shared-room flag, sample size in price verdicts, "only differing specs" compare view)
  and mention a live read-only listings source (e.g. an MCP server) as future work in the video.
  No calls to the service; the "no live scraping" hard stop stays. Its text/branding are not reused.
  *(The "no live scraping" part is superseded by the real-data decision of 2026-09-26.)*
- 2026-09-24 — **Location-aware home (owner request).** Ask for browser location on first visit; title
  becomes «جستجوی هوشمند اجاره در {city}» and results are limited to the user's area (nearest
  neighborhood + adjacent ones) unless the query names a neighborhood. Data is still Mashhad only;
  users elsewhere see their city named as "not covered yet" and get Mashhad results.
- 2026-09-25 — **Map view: Neshan** (owner chose option 1 of 3; OSM and a stylized SVG map were the
  alternatives). Free Neshan *web map* key, domain-restricted, in Vercel env `NEXT_PUBLIC_NESHAN_MAP_KEY`
  (never committed). Listings get approximate seeded lat/lng inside their neighborhood.
- 2026-09-25 — **Visual identity: Torob-family red** (owner chose option C of 3; turquoise+saffron and a
  dark night+gold palette were the alternatives). Primary `#C8372D` light / `#F0675D` dark, warm sand
  neutrals. Spec in `docs/BRAND.md`.
- 2026-09-25 — **Home page declutter, map stays.** Owner: keep the animated map background (video wow,
  gamified feel); no "how it works" section. Home = title, location pill, one-line subtitle, search,
  3 short examples, one-line footer. Research in `docs/research/landing-ux.md`.
- 2026-09-25 — **Home page shows Torob's name** «ترب» (and Torob's logo once the owner supplies the file)
  instead of «هومراب», stacked like torob.com's own home. Owner request for the hiring pitch; supersedes
  the home-page wordmark only (repo, results header and product name stay Homerob for now).
- 2026-09-25 — **Adopt Torob's own identity** (supersedes the "Torob-family red" palette entry above):
  logo SVG, colors (`--brand #d73948`, slate neutrals, `#15202b` dark), 8px radius and home layout from
  torob.com, captured by the owner with Claude in Chrome (`docs/research/torob-identity.md`). Font stays
  Vazirmatn (IRANYekan is commercial). Spec: `docs/BRAND.md`.
- 2026-09-25 — **Torob branding everywhere user-facing** (results header, tab icon, og image, title, copy).
  Home page shows no "demo" line (owner's call); the results footer keeps the demo/sample-data note.
  Repo, code identifiers and the Vercel URL stay "homerob".
- 2026-09-26 — **Scale: all of Iran, not only Mashhad** (owner, after the call with Mohammad). Code is
  city-aware: `Listing.city`, registry of cities/neighborhoods in `src/lib/places.ts`, intent `city`
  (rule parser + LLM), hard city filter in search, city chip, "no listings from X yet" empty state,
  home map flies to the visitor's city when it has listings (else the city with the most listings).
  Titles/OG say «ایران». Data for new cities comes from real listings only (next entry).
- 2026-09-26 — **Real data only** (owner; supersedes "seeded sample data" and the "no live scraping"
  hard stop). Listings must be real ads; never generated. Existing Mashhad sample set is temporary.
  Protective rule kept: no sellers' phone numbers / personal data stored. How the real data is
  obtained is an open question in `docs/PLAN.md` (the sandbox can't reach Divar).
- 2026-09-26 — **Landing = Iran only, no location prompt** (owner; supersedes "Location-aware home" and
  the "Iran → user location → Mashhad" map intro). The home page never asks for the browser location
  (no near-me filtering unless added back as an explicit button), the map stays on Iran (no flight, no
  Mashhad roads/neighborhoods/side panel/status pill), and only the logo + search box are shown (map
  credit moved to the results footer + README). Illustrative "new ad" place pins drop across Iran
  showing only a generic ad title (owner: psychological "people are posting everywhere" effect). They
  are a mood layer, not listings: generic titles, no price/neighborhood, not searchable; swap for the
  newest real titles once real data lands.
- 2026-09-26 — Findings of the owner's call with Mohammad (2026-09-25) are kept in
  `docs/research/call-2026-09-25-mohammad.md` (Persian) for future reference.
- 2026-09-27 — **Place from the prompt** (owner request): infer the city from the text (city, then a
  neighborhood/landmark), show it live under the search box and on the home map, ask with one-tap city chips
  only when it's ambiguous or missing; a tapped city is written into the query. Searching without a city is
  never blocked (all of Iran + a "where?" question on results). Details: `docs/research/location-intent.md`.
- 2026-09-27 — **Real-estate categories** (owner request; supersedes "rental only (rahn/ejare), no
  buy/sell"). Six categories with Divar's names: اجاره مسکونی، فروش مسکونی، اجاره اداری و تجاری،
  فروش اداری و تجاری، اجاره کوتاه‌مدت، پروژه‌های ساخت و ساز. Each has its own price model (rahn+ejare /
  total price / per night). The AI detects the category from the query, and a tab row on the results
  page switches it. No category picker on the home page (landing stays logo + search). Residential
  rent stays the default. Categories without real ads show an honest "not yet" empty state. Listings
  are never invented. Research: `docs/research/categories.md`.
- 2026-09-27 — **Neighborhood advantages** (owner request, from the call findings: "main competitive
  advantage"). Each listing gets «اطراف این خونه چی داره؟» → a catchy AI title + only advantages
  (metro, supermarket, 24h pharmacy, clinic, gym, park, mosque, bus-stop count) with walking minutes.
  Places are **real** (OpenStreetMap via Overpass, baked into `src/data/pois.json`, ODbL), never
  generated; the AI only words them and every number/"24h" is checked against the data. Walking time =
  straight line × 1.3 at 80 m/min, labeled approximate. Lazy: one call per opened/selected listing.
- 2026-09-27 — **Nearby places also from Neshan** (owner). Server-side `/v1/nearby` (layers) + `/v3/search`
  (pharmacy, supermarket, bakery) around the listing with the *service* key `homerob-server` in `NESHAN_API_KEY`
  (Vercel env only, never committed); merged with the baked OSM places, OSM alone as the fallback. Spec:
  `docs/research/neshan-api.md`. Activation (ticket) and credit are the owner's call (paid service).
- 2026-09-27 — **Mobile home = search first, then scrollable rails** (owner chose option A of 3; "only saves +
  two personal rails" and "Mohammad's full structure with login/onboarding" were the alternatives). Supersedes
  "logo + search only" **on phones** (desktop unchanged). Under the search: recent-search chips, an assistant
  banner, rails «پیشنهاد برای تو» (from on-device saves/views, each card with a true reason), «ادامهٔ جستجو»,
  «زیر قیمت محله», «تازه‌ترین‌ها», «اخیراً دیدی»; ♥ saves; bottom nav خانه · دستیار هوشمند · ذخیره‌شده‌ها.
  No account: history lives in localStorage. No category picker. Research: `docs/research/mobile-home.md`.
- 2026-09-27 — **Real data source: owner's Divar exports** (option (a) of the open question; no official
  API, no new account). The owner exports Divar searches with a browser table-scraper extension; the
  sandbox never calls Divar. `scripts/import-divar.ts` cleans them into `src/data/divar.json`. Raw exports
  stay out of git (agency/seller names); fields an ad doesn't state stay unset — never guessed.
- 2026-09-27 — **Sample set removed now** (owner chose option (b) of 3; "export more first" and "keep a
  mix until the video" were the alternatives). The app serves only the 13 real Divar ads (وکیل‌آباد
  مشهد); demo queries naming other neighborhoods or a 2-bed at 500M get few/weak results until more real
  data arrives. Tests use hand-written fixtures (`src/test/fixtures.ts`), never served.
- 2026-09-27 — **Demo queries approved** (owner chose option (a); "wait for more exports" was the
  alternative): (1) «دوخوابه مفتح رهن کامل تا ۱.۵ میلیارد», (2) «دوخوابه وکیل‌آباد با ۵۰۰ میلیون رهن»,
  (3) «خونه ویلایی پورسینا رهن ۲۰۰ ماهی ۱۰ تومن» + remove the «پورسینا» chip. Script:
  `docs/DEMO_SCRIPT.md`. Owner asked to merge and update the live site.
