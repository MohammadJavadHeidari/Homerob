# Decisions (locked — do not re-open)

## Product
- Name: **Homerob** (Torob + Home). Repo: https://github.com/MohammadJavadHeidari/Homerob
- Market: real estate, **rental only (rahn/ejare)**, no buy/sell.
- City: **Mashhad only**.
- Data: **seeded sample dataset** (~80–100 listings, 5–6 Mashhad neighborhoods), flat JSON/TS
  file, **no database**, **no live scraping**. Listings look like they come from Divar/Sheypoor.
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
