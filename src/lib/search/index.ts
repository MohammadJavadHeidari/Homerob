import { listings as ALL_LISTINGS } from "@/data/listings";
import { categoryOf, comparablePrice, DEFAULT_CATEGORY } from "@/lib/categories";
import { areaAround } from "@/lib/geo";
import { searchCity } from "@/lib/intent/place";
import { nearLines } from "@/lib/metro";
import type { SearchIntent } from "@/lib/intent/schema";
import { isPlaceholderPrice, isSharedHousing } from "@/lib/quality";
import type { Listing, ListingSource } from "@/lib/types";

import { fitBudget, type BudgetFit } from "./budget";
import { dedupe } from "./dedup";
import { highlights, isNewListing, ruleExplanation, scoreListing, type Highlight, type ScoreBreakdown } from "./score";

export interface SearchResult {
  listing: Listing;
  /** Other sites the same apartment is posted on. */
  alsoOn: ListingSource[];
  budget: BudgetFit;
  /**
   * The price listings of the category are compared by (src/lib/categories.ts): full-deposit
   * equivalent for rentals, total price for sales, price per night for short stays.
   */
  price: number;
  /** 0–100 match score. */
  score: number;
  /** Posted within a day of the newest ad (see isNewListing) → «جدید» badge. */
  isNew: boolean;
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

/**
 * Hard-filter by category, city and budget, then soft-score and rank. `limit` defaults to the top 20; the API asks
 * for everything so the client can refine (filter / re-sort) instantly without a round trip.
 */
export function search(intent: SearchIntent, listings: Listing[] = ALL_LISTINGS, limit = LIMIT): SearchResponse {
  const results: SearchResult[] = [];
  const category = intent.category ?? DEFAULT_CATEGORY;
  const city = searchCity(intent);
  const area = intent.nearMe && !intent.neighborhoods.length ? areaAround(intent.nearMe, city) : null;
  const excluded = { placeholderPrice: 0, sharedRoom: 0 };
  const relevant = (l: Listing) =>
    area ? area.includes(l.neighborhood) : !intent.neighborhoods.length || intent.neighborhoods.includes(l.neighborhood);
  for (const { listing, alsoOn } of dedupe(listings)) {
    if (categoryOf(listing) !== category) continue;
    if (city && listing.city !== city) continue;
    if (area && !area.includes(listing.neighborhood)) continue;
    // "which line?" answered (or «خط ۱ مترو» typed): only homes a short walk from those lines
    if (intent.metroLines.length && !nearLines(listing, intent.metroLines)) continue;
    if (isPlaceholderPrice(listing)) {
      if (relevant(listing)) excluded.placeholderPrice++;
      continue;
    }
    // shared flats are a residential-rental thing («اتاق اجاره» in an office ad is just an office)
    if (category === DEFAULT_CATEGORY && isSharedHousing(listing) !== intent.sharedRoom) {
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
      price: comparablePrice(listing),
      score,
      isNew: isNewListing(listing),
      breakdown,
      highlights: hl,
      explanation: ruleExplanation(hl),
    });
  }
  results.sort((a, b) => b.score - a.score || a.price - b.price);
  return { results: results.slice(0, limit), total: results.length, excluded };
}

/** Look up already-ranked results by id (used by /api/explain so the client can't forge facts). */
export function resultsByIds(intent: SearchIntent, ids: string[], extra: Listing[] = []): SearchResult[] {
  const all = search(intent, extra.length ? [...extra, ...ALL_LISTINGS] : ALL_LISTINGS, Infinity);
  const byId = new Map(all.results.map((r) => [r.listing.id, r]));
  return ids.map((id) => byId.get(id)).filter((r): r is SearchResult => Boolean(r));
}
