import { listings as ALL_LISTINGS } from "@/data/listings";
import type { SearchIntent } from "@/lib/intent/schema";
import { toFullDeposit } from "@/lib/pricing";
import type { Listing, ListingSource } from "@/lib/types";

import { fitBudget, type BudgetFit } from "./budget";
import { dedupe } from "./dedup";
import { highlights, ruleExplanation, scoreListing, type Highlight, type ScoreBreakdown } from "./score";

export interface SearchResult {
  listing: Listing;
  /** Other sites the same apartment is posted on. */
  alsoOn: ListingSource[];
  budget: BudgetFit;
  /** Full-deposit equivalent of the listed price (for fair comparison). */
  fullDeposit: number;
  /** 0–100 match score. */
  score: number;
  breakdown: ScoreBreakdown;
  highlights: Highlight[];
  /** Rule-based explanation; the UI swaps in the AI one from /api/explain when it arrives. */
  explanation: string;
}

export interface SearchResponse {
  results: SearchResult[];
  /** Listings that passed the hard budget filter (before truncation). */
  total: number;
}

const LIMIT = 20;

/** Hard-filter by budget, then soft-score and rank. */
export function search(intent: SearchIntent, listings: Listing[] = ALL_LISTINGS): SearchResponse {
  const results: SearchResult[] = [];
  for (const { listing, alsoOn } of dedupe(listings)) {
    const budget = fitBudget(listing, intent);
    if (!budget.fits) continue;
    const { score, breakdown } = scoreListing(listing, intent);
    const hl = highlights(listing, intent, budget);
    results.push({
      listing,
      alsoOn,
      budget,
      fullDeposit: toFullDeposit(listing),
      score,
      breakdown,
      highlights: hl,
      explanation: ruleExplanation(hl),
    });
  }
  results.sort((a, b) => b.score - a.score || a.fullDeposit - b.fullDeposit);
  return { results: results.slice(0, LIMIT), total: results.length };
}

/** Look up already-ranked results by id (used by /api/explain so the client can't forge facts). */
export function resultsByIds(intent: SearchIntent, ids: string[]): SearchResult[] {
  const all = search(intent, ALL_LISTINGS);
  const byId = new Map(all.results.map((r) => [r.listing.id, r]));
  return ids.map((id) => byId.get(id)).filter((r): r is SearchResult => Boolean(r));
}
