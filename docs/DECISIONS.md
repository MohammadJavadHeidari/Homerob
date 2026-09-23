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
