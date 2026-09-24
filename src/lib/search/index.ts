import { listings as ALL_LISTINGS } from "@/data/listings";
import type { SearchIntent } from "@/lib/intent/schema";
import { toFullDeposit } from "@/lib/pricing";
import type { Listing } from "@/lib/types";

import { fitBudget, type BudgetFit } from "./budget";

export interface SearchResult {
  listing: Listing;
  budget: BudgetFit;
  /** Full-deposit equivalent of the listed price (for fair comparison). */
  fullDeposit: number;
}

export interface SearchResponse {
  results: SearchResult[];
  /** Listings that passed the hard budget filter (before truncation). */
  total: number;
}

const LIMIT = 20;

/**
 * Hard-filter by budget, then order. Phase 2: simple ordering (neighborhood match, then price).
 * Phase 3 replaces the ordering with weighted soft scoring.
 */
export function search(intent: SearchIntent, listings: Listing[] = ALL_LISTINGS): SearchResponse {
  const matches = listings
    .map((listing) => ({ listing, budget: fitBudget(listing, intent), fullDeposit: toFullDeposit(listing) }))
    .filter((r) => r.budget.fits);

  const inHood = (r: SearchResult) =>
    intent.neighborhoods.length === 0 || intent.neighborhoods.includes(r.listing.neighborhood) ? 0 : 1;
  matches.sort((a, b) => inHood(a) - inHood(b) || a.fullDeposit - b.fullDeposit);

  return { results: matches.slice(0, LIMIT), total: matches.length };
}
