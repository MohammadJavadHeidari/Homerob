import { areaAround, type CityCatalog, type HoodInfo } from "@/lib/catalog";
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

/** The listings to rank (one city, possibly pre-filtered by the store) and that city's reference data. */
export interface SearchContext {
  listings: Listing[];
  catalog: CityCatalog;
  hoodIndex: Map<string, HoodInfo>;
  /** "Now" for recency = newest listing, so old data doesn't all score 0. */
  referenceTime: number;
}

export function makeContext(listings: Listing[], catalog: CityCatalog): SearchContext {
  return {
    listings,
    catalog,
    hoodIndex: new Map(catalog.hoods.map((h) => [h.name, h])),
    referenceTime: listings.reduce((m, l) => Math.max(m, Date.parse(l.postedAt) || 0), 0),
  };
}

/**
 * Hard-filter by budget, then soft-score and rank. `limit` defaults to the top 20; the API asks
 * for everything so the client can refine (filter / re-sort) instantly without a round trip.
 */
export function search(intent: SearchIntent, ctx: SearchContext, limit = LIMIT): SearchResponse {
  const results: SearchResult[] = [];
  const area = intent.nearMe && !intent.neighborhoods.length ? areaAround(ctx.catalog, intent.nearMe) : null;
  const excluded = { placeholderPrice: 0, sharedRoom: 0 };
  const relevant = (l: Listing) =>
    area ? area.includes(l.neighborhood) : !intent.neighborhoods.length || intent.neighborhoods.includes(l.neighborhood);
  for (const { listing, alsoOn } of dedupe(ctx.listings)) {
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
    const { score, breakdown } = scoreListing(listing, intent, ctx);
    const hl = highlights(listing, intent, budget, ctx);
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
  // equal scores: newest ad first (real listings go stale), then cheaper
  results.sort(
    (a, b) =>
      b.score - a.score ||
      Date.parse(b.listing.postedAt) - Date.parse(a.listing.postedAt) ||
      a.fullDeposit - b.fullDeposit,
  );
  return { results: results.slice(0, limit), total: results.length, excluded };
}

/** Look up already-ranked results by id (used by /api/explain so the client can't forge facts). */
export function resultsByIds(intent: SearchIntent, ctx: SearchContext, ids: string[]): SearchResult[] {
  const all = search(intent, ctx, Infinity);
  const byId = new Map(all.results.map((r) => [r.listing.id, r]));
  return ids.map((id) => byId.get(id)).filter((r): r is SearchResult => Boolean(r));
}
