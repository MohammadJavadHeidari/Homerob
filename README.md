# Homerob 🏠

**AI-powered home search & comparison for Iran's rental market.**

Built for [Torob](https://torob.com)'s **AI Product Engineer** hiring challenge — an exploration of what "Torob for real estate" could look like.

> ترب برای پیدا کردن بهترین قیمت کالا رو ساده کرده؛ Homerob همون کارو برای پیدا کردن خونه انجام می‌ده.

---

## The Problem

Searching for a rental home in Iran today (via Divar, Sheypoor, etc.) means:

- **Messy, unstructured listings** — free-text descriptions, inconsistent formatting, no standard schema
- **Rahn/Ejare confusion** — deposit (رهن) and rent (اجاره) are quoted in dozens of different combinations, making true cost comparison nearly impossible
- **No price transparency** — no way to tell if a listing is fairly priced for its neighborhood
- **Manual, exhausting comparison** — users scroll through hundreds of ads to find what actually fits their budget and needs

## The Idea

Homerob is a **meta-search / AI-normalization layer** on top of existing listings — not a new classifieds site. It:

1. **Ingests** listings (a curated sample dataset for this MVP — see [Status](#status))
2. **Normalizes** messy free-text into structured data (price, rahn↔ejare conversion, area, rooms, location, amenities)
3. **Ranks** results by natural-language user intent (not just rigid filters)
4. **Explains** why each top result was chosen, in plain Persian

```
build homerob --for "rental housing"
> ingest sample listings
> normalize rahn/ejare pricing
> rank by user intent
> explain the best choice
> ship demo.mp4
```

> **Vision vs. MVP:** the longer-term idea is a live crawler over sources like Divar/Sheypoor. That's explicitly **not built** for this challenge — see [Future Work](#future-work) — this MVP runs entirely on a static sample dataset.

## Deliverable

A **locally-runnable Next.js app**, demoed via a screen-recorded walkthrough (`demo.mp4`) — not a live deployed URL. This avoids hosting/uptime risk within the challenge timebox while still showing a real click-through of working search, ranking, and explanations.

## Core Features (MVP)

- 🔎 **Natural-language Persian search** — e.g. *"۲ خوابه زیر ۵۰۰ میلیون رهن نزدیک مترو در سعادت‌آباد"*
- 💰 **Rahn ↔ Ejare converter** — normalizes every listing to a comparable "true monthly cost"
- 📊 **Fair-price estimate** — flags listings priced above/below the neighborhood median
- 🤖 **AI-generated explanations** — why a result matches (or doesn't quite match) what you asked for

## Tech Stack

- **Next.js** — frontend + API routes
- **Claude API** — listing normalization, intent parsing, ranking, and explanation generation
- **Sample dataset** — a curated set of real listings (JSON) used for the demo, in lieu of a live crawler

## Status

🚧 Work in progress — built as a rapid demo for a hiring challenge, not production software.

## Future Work

Not built for this MVP — kept here as stated direction, not a claim:

- **Live crawler** over Divar / Sheypoor (or ingestion via Divar's public dataset / Kenar platform), replacing the static sample dataset
- Real transaction-price data to improve the fair-price estimate beyond a simple neighborhood median
- Fraud/duplicate-listing detection

## Why This Approach

This mirrors Torob's own DNA: **aggregate → structure → compare**, applied to a market (housing) that is far messier and higher-stakes than e-commerce. The goal isn't to compete with Divar on listing volume — it's to be the smart layer on top that makes sense of what's already there.

## Author

**Mohammad Javad Heidari**
Built as part of Torob's AI Product Engineer challenge.

## License
