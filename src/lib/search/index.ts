import { listings as ALL_LISTINGS } from "@/data/listings";
import { areaAround } from "@/lib/geo";
import type { SearchIntent } from "@/lib/intent/schema";
import { toFullDeposit } from "@/lib/pricing";
import { isPlaceholderPrice, isSharedHousing } from "@/lib/quality";
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
  /** Relevant listings left out on purpose (in the wanted neighborhoods, or anywhere if none). */
  excluded: {
    /** Dummy / negotiable prices ("توافقی", "۱٬۰۰۰ تومان") — can't be ranked honestly. */
    placeholderPrice: number;
    /** Rooms in shared flats — hidden unless the user asked for همخونه. */
    sharedRoom: number;
  };
}

const LIMIT = 20;

/** Hard-filter by budget, then soft-score and rank. */
export function search(intent: SearchIntent, listings: Listing[] = ALL_LISTINGS): SearchResponse {
  const results: SearchResult[] = [];
  const area = intent.nearMe && !intent.neighborhoods.length ? areaAround(intent.nearMe) : null;
  const excluded = { placeholderPrice: 0, sharedRoom: 0 };
  const relevant = (l: Listing) =>
    area ? area.includes(l.neighborhood) : !intent.neighborhoods.length || intent.neighborhoods.includes(l.neighborhood);
  for (const { listing, alsoOn } of dedupe(listings)) {
    if (area && !area.includes(listing.neighborhood)) continue;
    if (isPlaceholderPrice(listing)) {
      if (relevant(listing)) excluded.placeholderPrice++;
      continue;
    }
    if (isSharedHousing(listing) !== intent.sharedRoom) {
      if (!intent.sharedRoom && relevant(listing)) excluded.sharedRoom++;
      continue;
    }
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
  return { results: results.slice(0, LIMIT), total: results.length, excluded };
}

/** Look up already-ranked results by id (used by /api/explain so the client can't forge facts). */
export function resultsByIds(intent: SearchIntent, ids: string[]): SearchResult[] {
  const all = search(intent, ALL_LISTINGS);
  const byId = new Map(all.results.map((r) => [r.listing.id, r]));
  return ids.map((id) => byId.get(id)).filter((r): r is SearchResult => Boolean(r));
}
