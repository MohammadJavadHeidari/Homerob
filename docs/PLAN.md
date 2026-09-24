# Homerob — Plan (2 days)

Time boxes are hard limits. Over budget → cut to simplest demoable version, note it in Status.

## Status
- **Current phase:** Phase 0
- **Done:** Phase 0 code tasks — Next.js 16 (App Router, TS, Tailwind v4, ESLint), shadcn/ui
  (base-ui, base-nova style), RTL + Vazirmatn + `src/lib/persian.ts` digit/Toman helpers,
  `.env.example`, placeholder home page (checked at 390px and 1280px). Build + lint green.
- **Next:** Phase 1 → `Listing` type + seed data
- **Blocked:** Vercel deploy — owner must import the repo in Vercel (see Open questions).
  AI provider unblocked: Gemini free tier works (see DECISIONS).
- **Cut / deferred:** —
- **Notes:** shadcn/ui set up with the official CLI (`base-nova`, RTL on). Add components with
  `npx shadcn@latest add <name>`. Already added: button, card, badge, skeleton, input. `cn()` comes from
  the `cn` package (shadcn's replacement for clsx + tailwind-merge).
  `AGENTS.md` is managed by `next dev` — leave it; it keeps Next from editing `CLAUDE.md`.
- **Preview URL:** —

## Open questions
- **Vercel:** owner imports `MohammadJavadHeidari/Homerob` in Vercel (framework: Next.js, no env
  vars needed yet — `AI_PROVIDER` defaults to mock) and shares the preview URL.

---

## Day 1

### Phase 0 — Setup & first deploy (≤ 1h)
- [x] Scaffold Next.js (App Router) + TypeScript + Tailwind + ESLint
- [x] shadcn/ui with base-ui preset
- [x] RTL: `<html lang="fa" dir="rtl">`, Persian font (Vazirmatn), Persian digits helper
- [x] `.env.example` (`AI_PROVIDER=mock|gemini|deepseek|claude|openai`, `GEMINI_API_KEY`, `DEEPSEEK_API_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`); `.env.local` gitignored
- [ ] Placeholder home page, push, confirm Vercel deploy works (owner connects Vercel to repo if not yet)

### Phase 1 — Seed data & normalization (≤ 2h)
- [ ] `Listing` type: id, source (divar|sheypoor), title, neighborhood, deposit, monthlyRent,
      areaM2, rooms, floor, buildingAge, elevator, parking, storage, description, postedAt, imageUrl?
- [ ] ~80–100 realistic Mashhad listings across 5–6 neighborhoods
      (e.g. وکیل‌آباد، سجاد، احمدآباد، هاشمیه، قاسم‌آباد، الهیه) with realistic price ranges per area
- [ ] Price normalization util: convert deposit ↔ rent with a configurable monthly rate
      (default: common market convention; value in one constant), expose "equivalent full deposit"
      and "equivalent monthly rent" for fair comparison
- [ ] Unit test for normalization

### Phase 2 — Intent parsing (≤ 3h)
- [ ] `SearchIntent` schema (zod): maxDeposit, maxRent, flexibleConversion, neighborhoods[],
      minRooms, minArea, mustHave[], niceToHave[], freeTextNotes
- [ ] Provider abstraction `lib/ai/` with `mock` and one OpenAI-compatible client (base URL + key + model per provider: `gemini` default,
      `deepseek`, `openai`) + `claude`; Gemini: `gemini-3.6-flash` with fallback to `gemini-3.5-flash-lite` on 429/503
- [ ] Prompt: Persian query → strict JSON intent (handles "میلیون/میلیارد", Persian digits, colloquial phrasing)
- [ ] `POST /api/search` → returns `{ intent, results }`
- [ ] 8–10 sample queries in `lib/demo-queries.ts` used for manual testing and the UI

### Phase 3 — Ranking & explanations (≤ 3h)
- [ ] Hard filter on budget (using normalization when `flexibleConversion`)
- [ ] Soft score: neighborhood match, rooms, area, amenities, recency; weights in one config
- [ ] One batched LLM call for top ~10 results → 1–2 sentence Persian explanation each,
      mentioning concrete trade-offs ("۵۰ میلیون زیر بودجه‌ته ولی پارکینگ نداره")
- [ ] Graceful fallback: if LLM fails, show rule-based explanation

## Day 2

### Phase 4 — UI (≤ 4h)
- [ ] Hero with big natural-language search box + clickable example queries
- [ ] Intent chips row (what the AI understood); chips removable to refine
- [ ] Result cards: title, neighborhood, deposit/rent + normalized price, key features,
      source badge (دیوار/شیپور), AI explanation highlighted, match score
- [ ] Loading skeletons, empty state ("هیچ آگهی‌ای با این بودجه نیست — …" + suggestion), error state
- [ ] Mobile-first check at 390px and desktop

### Phase 5 — Polish & production (≤ 2h)
- [ ] Response time check (target < 5s); cache repeated queries in memory
- [ ] Meta/OG title, favicon, small "about" line explaining the idea
- [ ] Production deploy green, with real AI provider

### Phase 6 — Demo package (≤ 2h)
- [ ] `docs/DEMO_SCRIPT.md`: Persian narration, ≤ 5 min: problem → solution → 3 live queries
      (simple, tricky budget, trade-off) → what's next (live aggregation, dedup across sources, more cities)
- [ ] [DECISION] Owner approves the 3 demo queries and the script
- [ ] README updated with live link, screenshot, how it works

## Stretch (only if everything above is done)
- [ ] Cross-source duplicate detection (same listing on Divar & Sheypoor merged — very "Torob")
- [ ] "Compare" view for 2–3 listings
