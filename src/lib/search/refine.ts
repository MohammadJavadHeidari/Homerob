import { AMENITIES, type AmenityKey } from "@/lib/amenities";
import { MONTHLY_RATE } from "@/lib/pricing";
import { NEIGHBORHOODS, type ListingSource, type Neighborhood } from "@/lib/types";

import type { SearchResult } from "./index";

/**
 * Post-search refinement: hard filters + sort the user sets by hand on top of the AI ranking.
 * Pure and client-side — the result set is small, so every change is instant (and animatable).
 */

export type Range = [number, number];

export const SORTS = {
  best: "بیشترین تطابق",
  cheap: "ارزان‌ترین",
  ppm: "ارزان‌ترین هر متر",
  newest: "جدیدترین",
  largest: "بزرگ‌ترین",
} as const;
export type SortKey = keyof typeof SORTS;

/** Amenities offered as filter toggles ("newBuilding" is covered by the age filter). */
export const FILTER_AMENITIES: AmenityKey[] = [
  "parking",
  "elevator",
  "storage",
  "balcony",
  "furnished",
  "nearMetro",
  "yard",
  "lobby",
  "pool",
  "convertible",
];

/** Room buckets; 4 means "4 or more". */
export const ROOM_OPTIONS = [0, 1, 2, 3, 4] as const;

/** Max building age buckets, in years (null = any). */
export const AGE_OPTIONS = [null, 0, 5, 10, 15] as const;
export type MaxAge = (typeof AGE_OPTIONS)[number];

export interface Refine {
  sort: SortKey;
  /** Full-deposit equivalent, Toman. */
  price: Range | null;
  area: Range | null;
  /** Full-deposit Toman per m². */
  ppm: Range | null;
  rooms: number[];
  neighborhoods: Neighborhood[];
  amenities: AmenityKey[];
  maxAge: MaxAge;
  sources: ListingSource[];
}

export const EMPTY_REFINE: Refine = {
  sort: "best",
  price: null,
  area: null,
  ppm: null,
  rooms: [],
  neighborhoods: [],
  amenities: [],
  maxAge: null,
  sources: [],
};

export type FilterKey = Exclude<keyof Refine, "sort">;

// ---------- accessors ----------

export const priceOf = (r: SearchResult) => r.fullDeposit;
export const areaOf = (r: SearchResult) => r.listing.areaM2;
export const ppmOf = (r: SearchResult) => Math.round(r.fullDeposit / r.listing.areaM2);
/** Full-deposit Toman → equivalent monthly rent with no deposit. */
export const toMonthly = (fullDeposit: number) => Math.round(fullDeposit * MONTHLY_RATE);

const inRange = (v: number, r: Range | null) => r === null || (v >= r[0] && v <= r[1]);

function matches(r: SearchResult, f: Refine, skip?: FilterKey): boolean {
  const l = r.listing;
  if (skip !== "price" && !inRange(priceOf(r), f.price)) return false;
  if (skip !== "area" && !inRange(areaOf(r), f.area)) return false;
  if (skip !== "ppm" && !inRange(ppmOf(r), f.ppm)) return false;
  if (skip !== "rooms" && f.rooms.length && !f.rooms.includes(Math.min(l.rooms, 4))) return false;
  if (skip !== "neighborhoods" && f.neighborhoods.length && !f.neighborhoods.includes(l.neighborhood)) return false;
  if (skip !== "amenities" && !f.amenities.every((k) => AMENITIES[k].has(l))) return false;
  if (skip !== "maxAge" && f.maxAge !== null && l.buildingAge > f.maxAge) return false;
  if (skip !== "sources" && f.sources.length && ![l.source, ...r.alsoOn].some((s) => f.sources.includes(s))) return false;
  return true;
}

const SORTERS: Record<SortKey, (a: SearchResult, b: SearchResult) => number> = {
  best: () => 0, // keep the server's ranking
  cheap: (a, b) => priceOf(a) - priceOf(b),
  ppm: (a, b) => ppmOf(a) - ppmOf(b),
  newest: (a, b) => Date.parse(b.listing.postedAt) - Date.parse(a.listing.postedAt),
  largest: (a, b) => areaOf(b) - areaOf(a),
};

export function applyRefine(results: SearchResult[], f: Refine): SearchResult[] {
  const out = results.filter((r) => matches(r, f));
  return f.sort === "best" ? out : out.sort(SORTERS[f.sort]);
}

/** Results that pass every filter except `skip` — the base for that filter's counts / histogram. */
export function withoutFilter(results: SearchResult[], f: Refine, skip: FilterKey): SearchResult[] {
  return results.filter((r) => matches(r, f, skip));
}

// ---------- facets ----------

export interface Facets {
  rooms: Record<number, number>;
  neighborhoods: Record<string, number>;
  amenities: Record<string, number>;
  maxAge: Record<string, number>;
  sources: Record<string, number>;
}

/** How many results each option would give, given all the *other* active filters. */
export function facets(results: SearchResult[], f: Refine): Facets {
  const count = <K extends string | number>(key: FilterKey, keys: readonly K[], test: (r: SearchResult, k: K) => boolean) => {
    const base = withoutFilter(results, f, key);
    return Object.fromEntries(keys.map((k) => [k, base.filter((r) => test(r, k)).length])) as Record<K, number>;
  };
  const ages = AGE_OPTIONS.map((a) => String(a));
  return {
    rooms: count("rooms", ROOM_OPTIONS, (r, k) => Math.min(r.listing.rooms, 4) === k),
    neighborhoods: count("neighborhoods", NEIGHBORHOODS, (r, k) => r.listing.neighborhood === k),
    // amenities combine with AND, so each count also includes the already-selected ones
    amenities: count("amenities", FILTER_AMENITIES, (r, k) =>
      [...f.amenities, k].every((a) => AMENITIES[a].has(r.listing)),
    ),
    maxAge: count("maxAge", ages, (r, k) => k === "null" || r.listing.buildingAge <= Number(k)),
    sources: count("sources", ["divar", "sheypoor"] as ListingSource[], (r, k) => [r.listing.source, ...r.alsoOn].includes(k)),
  };
}

// ---------- ranges & histograms ----------

/** [min, max] of a numeric field over the results, rounded outward to `step`. */
export function bounds(values: number[], step: number): Range {
  if (!values.length) return [0, step];
  const lo = Math.floor(Math.min(...values) / step) * step;
  const hi = Math.ceil(Math.max(...values) / step) * step;
  return [lo, hi === lo ? lo + step : hi];
}

/** Bucket counts across `domain` for a small histogram. */
export function histogram(values: number[], domain: Range, bins = 24): number[] {
  const out = new Array<number>(bins).fill(0);
  const width = (domain[1] - domain[0]) / bins;
  for (const v of values) {
    const i = Math.min(bins - 1, Math.max(0, Math.floor((v - domain[0]) / width)));
    out[i]++;
  }
  return out;
}

/** Number of active filters (for the badge on the mobile button). */
export function activeCount(f: Refine): number {
  return (
    (f.price ? 1 : 0) +
    (f.area ? 1 : 0) +
    (f.ppm ? 1 : 0) +
    f.rooms.length +
    f.neighborhoods.length +
    f.amenities.length +
    (f.maxAge !== null ? 1 : 0) +
    f.sources.length
  );
}

/** Drop range filters that no longer narrow anything (e.g. after a new search changed the bounds). */
export function clampRanges(f: Refine, domains: Record<"price" | "area" | "ppm", Range>): Refine {
  const fix = (r: Range | null, d: Range): Range | null => {
    if (!r) return null;
    const lo = Math.max(r[0], d[0]);
    const hi = Math.min(r[1], d[1]);
    if (lo >= hi || (lo <= d[0] && hi >= d[1])) return null;
    return [lo, hi];
  };
  return { ...f, price: fix(f.price, domains.price), area: fix(f.area, domains.area), ppm: fix(f.ppm, domains.ppm) };
}

export type RangeKey = "price" | "area" | "ppm";

/** Slider step and bound rounding per range filter. */
export const RANGE_STEPS: Record<RangeKey, { step: number; round: number }> = {
  price: { step: 10_000_000, round: 50_000_000 },
  area: { step: 5, round: 10 },
  ppm: { step: 100_000, round: 1_000_000 },
};

export const RANGE_VALUE: Record<RangeKey, (r: SearchResult) => number> = { price: priceOf, area: areaOf, ppm: ppmOf };

/** Stable slider domains, from the full (unfiltered) result set. */
export function domains(results: SearchResult[]): Record<RangeKey, Range> {
  const d = (k: RangeKey) => bounds(results.map(RANGE_VALUE[k]), RANGE_STEPS[k].round);
  return { price: d("price"), area: d("area"), ppm: d("ppm") };
}
