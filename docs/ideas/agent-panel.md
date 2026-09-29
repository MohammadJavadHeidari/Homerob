# Idea: agent panel + "notify me" demand matching (post-demo)

Owner conversation, 2026-09-29. **Not part of the 2-day demo** (owner: leave the video out of it for now).
Deck for presenting it: `docs/ideas/agent-panel.pdf` (source `agent-panel.html`).

## The problem on each side
- **Searcher:** types a precise need (e.g. "a flat in Mousavi Ghouchani 25"), nothing matches today, leaves.
  When a matching unit appears tomorrow, nobody tells them.
- **Real-estate agent (مشاور املاک):** gets a new file from an owner but doesn't know who wants it.
  Owners overprice, files sit for months, commission never arrives. Agents are hard to win:
  they won't change tools for "more stats" — Divar already shows view counts.

## Core feature: unmet demand → "notify me" (تقاضای برآورده‌نشده)
Homerob's search is a full sentence parsed by AI into a structured intent (area, budget, rooms, size,
parking…). That is structured *demand* no classifieds site has.

Flow:
1. Mohammad searches "rent in Mousavi Ghouchani 25, 2 bedrooms, ≤ 600M deposit". No match.
2. Empty state offers **«خبرم کن»** — saves the intent as a demand alert (with his consent).
3. Next day an owner gives that unit to an agent; the agent adds the file in the agent panel.
4. Homerob matches the new file against open demand alerts (same scorer as search).
5. Agent sees: **"12 people wanted exactly this in the last 7 days — notify them?"**
6. Mohammad gets: "the flat you wanted in Mousavi Ghouchani is here" → contacts **through the agent**.

The agent gets a ready buyer before the ad is even public. That is the hook, not dashboards.

## Supporting features (ordered by pull)
1. **Price report for the owner meeting** — one page: asked price vs neighborhood median per m²,
   days-on-market for similar units at that price vs fair price, suggested range. Solves the agent's
   real pain: convincing an owner to price realistically.
2. **What files to take** — high-demand / low-supply areas and unit types that close fast.
3. **Per-listing stats** — views, saves, matched searches (table stakes, not the hook).

## Cold start (no users on day one)
Demand stats need traffic. Bootstrap from crawled supply data, which needs no users:
median price per m² per neighborhood, **days on market** (an ad that disappears fast probably closed —
best demand proxy), price drops. Search demand joins later and makes feature 1 stronger over time.
Go-to-market: "40 of your ads are already on Homerob — claim them" (Google-Maps-style claim).

## Trust rules agents will ask about
- **Files are private by default.** The agent picks what is published; matching and reports work on
  private files too. Exact address stays in the backend (used for matching), the public sees the area.
- **Commission stays 100% theirs.** Homerob sends leads and data, it doesn't replace the agent.
  Contact always goes through the agent.
- Searchers opt in to alerts; no personal data from ads is stored (existing hard rule).

## Ingestion for agents
Every agent's Excel is different and many use a notebook or Telegram. Accept "whatever you have":
Excel/CSV with LLM column mapping, or a Telegram bot that takes text + photos and structures them.

## Validate before building
Make one price/demand report **by hand** for one Mashhad agent's area from Divar data, show it to
~5 agents, note which part lands and what they'd pay for. ~1 day of work.

## Rough build order (when it's time)
1. Demand alerts: save intent from the empty state, match on new listings, notify (email/Telegram/push).
2. Agent panel: auth, file import (Excel + LLM mapping), private/public toggle.
3. "N people want this" on file import + notify button.
4. Price report (PDF) from crawled market data.
