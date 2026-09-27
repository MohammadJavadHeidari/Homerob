/**
 * Mobile home feed: horizontal rails built from the listings + what the visitor did on this phone
 * (saves, opened listings, last search). No account, no LLM — every reason shown is a checked fact.
 * Research: docs/research/mobile-home.md.
 */
import { listings as ALL_LISTINGS } from "@/data/listings";
import { AMENITIES, type AmenityKey } from "@/lib/amenities";
import { CATEGORIES, categoryOf, comparablePrice, DEFAULT_CATEGORY, unitPrice, type CategoryKey } from "@/lib/categories";
import { timeAgoFa } from "@/lib/format";
import { EMPTY_INTENT, type SearchIntent } from "@/lib/intent/schema";
import { toFaDigits } from "@/lib/persian";
import { adjacentHoods, isCovered } from "@/lib/places";
import { search, type SearchResult } from "@/lib/search";
import type { SortKey } from "@/lib/search/refine";
import { HOOD_MEDIAN_PPM, HOOD_SAMPLE_SIZE, hoodKey, MIN_SAMPLE } from "@/lib/search/score";
import type { Listing } from "@/lib/types";

export interface Signal {
  tone: "why" | "deal" | "new" | "muted";
  text: string;
}

export interface RailItem extends SearchResult {
  signal: Signal | null;
}

export type RailKey = "picks" | "continue" | "deals" | "newest" | "recent";

export interface Rail {
  key: RailKey;
  title: string;
  subtitle: string | null;
  /** Small red pill next to the title, e.g. «۳ جدید». */
  badge: string | null;
  items: RailItem[];
  /** «نمایش همه» runs this search (with this intent, so no LLM round trip). */
  seeAll: { query: string; intent: SearchIntent; sort?: SortKey } | null;
}

export interface LastSearch {
  query: string;
  intent: SearchIntent;
  /** When it ran (ms) — listings posted after it count as «جدید». */
  at: number;
}

export interface FeedInput {
  /** City of the visitor's last search; else the one their history points to; else the biggest. */
  city: string | null;
  /** Newest first. */
  saved: string[];
  /** Newest first. */
  viewed: string[];
  last: LastSearch | null;
  now?: number;
}

export interface Feed {
  city: string;
  rails: Rail[];
  /** Saved listings, newest save first (for the «ذخیره‌شده‌ها» tab). */
  saved: SearchResult[];
}

const RAIL_SIZE = 10;
/** Cheaper than the neighborhood median by at least this → «زیر قیمت محله». */
const DEAL_RATIO = 0.9;
const WEIGHT = { saved: 3, viewed: 1 } as const;

const ROOM_WORDS = ["سوئیت", "یه‌خوابه", "دوخوابه", "سه‌خوابه", "چهارخوابه"];
export const roomsWord = (n: number) => ROOM_WORDS[Math.min(n, 4)];

/** Everything rankable in a category (+ city): deduped, no placeholder prices, no shared rooms. */
function pool(category: CategoryKey, city: string | null, listings: Listing[]) {
  return search({ ...EMPTY_INTENT, category, city }, listings, Infinity).results;
}

function mode<T>(entries: [T, number][]): T | null {
  const m = new Map<T, number>();
  for (const [k, w] of entries) m.set(k, (m.get(k) ?? 0) + w);
  return [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

function median(xs: number[]) {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** How much cheaper per m² than the neighborhood median (0.21 = 21%), or null without a solid median. */
export function belowHood(l: Listing): number | null {
  const k = hoodKey(l);
  if ((HOOD_SAMPLE_SIZE[k] ?? 0) < MIN_SAMPLE) return null;
  return 1 - unitPrice(l) / HOOD_MEDIAN_PPM[k];
}

const pct = (x: number) => `${toFaDigits(Math.round(x * 100))}٪`;

export interface Taste {
  intent: SearchIntent;
  /** Median comparable price of the liked listings. */
  price: number;
  /** The listing the rail is "because of" (latest save, else latest view). */
  anchor: Listing;
  anchorSaved: boolean;
}

/** Weighted profile of saved (×3) and opened (×1) listings, as a search intent the scorer understands. */
export function tasteOf(savedLs: Listing[], viewedLs: Listing[]): Taste | null {
  const liked: [Listing, number][] = [
    ...savedLs.map((l) => [l, WEIGHT.saved] as [Listing, number]),
    ...viewedLs.filter((l) => !savedLs.includes(l)).map((l) => [l, WEIGHT.viewed] as [Listing, number]),
  ];
  if (!savedLs.length && viewedLs.length < 2) return null;
  const category = mode(liked.map(([l, w]) => [categoryOf(l), w]))!;
  const inCat = liked.filter(([l]) => categoryOf(l) === category);
  const city = mode(inCat.map(([l, w]) => [l.city, w]))!;
  const here = inCat.filter(([l]) => l.city === city);
  const hoods = new Map<string, number>();
  for (const [l, w] of here) hoods.set(l.neighborhood, (hoods.get(l.neighborhood) ?? 0) + w);
  const neighborhoods = [...hoods.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([n]) => n);
  // ads that don't state their rooms don't vote
  const withRooms = here.filter((e): e is [Listing & { rooms: number }, number] => e[0].rooms !== undefined);
  const rooms = CATEGORIES[category].residential ? mode(withRooms.map(([l, w]) => [l.rooms, w])) : null;
  const total = here.reduce((s, [, w]) => s + w, 0);
  const niceToHave = (["parking", "elevator", "storage", "balcony"] as AmenityKey[]).filter(
    (k) => here.reduce((s, [l, w]) => s + (AMENITIES[k].has(l) ? w : 0), 0) >= total / 2,
  );
  const anchor = savedLs.find((l) => categoryOf(l) === category && l.city === city) ?? here[0][0];
  return {
    intent: { ...EMPTY_INTENT, category, city, neighborhoods, minRooms: rooms, maxRooms: rooms, niceToHave },
    price: median(here.map(([l]) => comparablePrice(l))),
    anchor,
    anchorSaved: savedLs.includes(anchor),
  };
}

/** Listings like the liked ones: same scorer as search, kept near their price, varied neighborhoods. */
export function picksFor(taste: Taste, exclude: Set<string>, listings: Listing[] = ALL_LISTINGS): RailItem[] {
  const all = search(taste.intent, listings, Infinity).results.filter(
    (r) => !exclude.has(r.listing.id) && r.breakdown.neighborhood > 0,
  );
  const inBand = all.filter((r) => Math.abs(r.price / taste.price - 1) <= 0.35);
  const ranked = (inBand.length >= 4 ? inBand : all)
    .map((r) => ({ r, s: r.score - 20 * Math.abs(r.price / taste.price - 1) }))
    .sort((a, b) => b.s - a.s)
    .map(({ r }) => r);

  // at most 2 per neighborhood among the first 5, so the rail doesn't look like one building
  const out: SearchResult[] = [];
  const rest: SearchResult[] = [];
  for (const r of ranked) {
    const same = out.filter((o) => o.listing.neighborhood === r.listing.neighborhood).length;
    (out.length < 5 && same >= 2 ? rest : out).push(r);
  }
  const hoods = taste.intent.neighborhoods;
  return [...out, ...rest].slice(0, RAIL_SIZE).map((r) => {
    const l = r.listing;
    const cheaper = 1 - r.price / taste.price;
    const same = hoods.includes(l.neighborhood);
    const near = hoods.find((h) => adjacentHoods(h, l.city).includes(l.neighborhood));
    const text =
      same && cheaper >= 0.1
        ? `همون محله، ${pct(cheaper)} ارزون‌تر`
        : same
          ? "همون محله"
          : near
            ? `کنار ${near}`
            : cheaper >= 0.1
              ? `${pct(cheaper)} ارزون‌تر`
              : "همون بازهٔ قیمت";
    return { ...r, signal: { tone: "why", text } };
  });
}

function because(t: Taste) {
  const l = t.anchor;
  const what = CATEGORIES[categoryOf(l)].residential && l.rooms !== undefined ? `یه ${roomsWord(l.rooms)}` : "یه آگهی";
  return `چون ${what} تو ${l.neighborhood} ${t.anchorSaved ? "ذخیره کردی" : "دیدی"}`;
}

export function buildFeed(input: FeedInput, listings: Listing[] = ALL_LISTINGS): Feed {
  const now = input.now ?? Date.now();
  const byId = new Map(listings.map((l) => [l.id, l]));
  const pick = (ids: string[]) => ids.map((id) => byId.get(id)).filter((l): l is Listing => Boolean(l));
  const savedLs = pick(input.saved);
  const viewedLs = pick(input.viewed);
  const taste = tasteOf(savedLs, viewedLs);

  const counts = mode(listings.map((l) => [l.city, 1]));
  const city = [input.city, taste?.intent.city, counts].find((c) => isCovered(c) && listings.some((l) => l.city === c)) ?? counts ?? "مشهد";
  const category = input.last?.intent.category ?? taste?.intent.category ?? DEFAULT_CATEGORY;
  const here = pool(category, city, listings);
  // every rankable listing, for saved / recently viewed (any city or category)
  const everywhere = new Map(
    (Object.keys(CATEGORIES) as CategoryKey[]).flatMap((k) => pool(k, null, listings)).map((r) => [r.listing.id, r]),
  );
  const cityIntent: SearchIntent = { ...EMPTY_INTENT, category, city };
  const rails: Rail[] = [];

  if (taste) {
    const items = picksFor(taste, new Set([...input.saved, ...input.viewed]), listings);
    if (items.length) {
      const hoods = taste.intent.neighborhoods.slice(0, 2).join(" و ");
      const rooms = taste.intent.minRooms;
      rails.push({
        key: "picks",
        title: "پیشنهاد برای تو",
        subtitle: because(taste),
        badge: null,
        items,
        seeAll: {
          query: `${rooms !== null ? `${roomsWord(rooms)} ` : ""}${hoods} در ${taste.intent.city}`,
          intent: { ...taste.intent, niceToHave: [] },
        },
      });
    }
  }

  if (input.last) {
    const { query, intent, at } = input.last;
    const results = search(intent, listings, Infinity).results.slice(0, RAIL_SIZE);
    const fresh = results.filter((r) => Date.parse(r.listing.postedAt) > at);
    const items = [...fresh, ...results.filter((r) => !fresh.includes(r))].map((r) => ({
      ...r,
      signal: { tone: "new", text: fresh.includes(r) ? "جدید" : timeAgoFa(r.listing.postedAt, now) } as Signal,
    }));
    if (items.length) {
      rails.push({
        key: "continue",
        title: "ادامهٔ جستجو",
        subtitle: query,
        badge: fresh.length ? `${toFaDigits(fresh.length)} جدید` : null,
        items,
        seeAll: { query, intent },
      });
    }
  }

  const deals = here
    .map((r) => ({ r, off: belowHood(r.listing) }))
    .filter((x): x is { r: SearchResult; off: number } => x.off !== null && x.off >= 1 - DEAL_RATIO)
    .sort((a, b) => b.off - a.off)
    .slice(0, RAIL_SIZE)
    .map(({ r, off }) => ({ ...r, signal: { tone: "deal", text: `${pct(off)} زیر قیمت محله` } as Signal }));
  if (deals.length) {
    rails.push({
      key: "deals",
      title: "زیر قیمت محله",
      subtitle: `حداقل ${pct(1 - DEAL_RATIO)} ارزون‌تر از میانهٔ قیمت هر متر محله‌اش`,
      badge: null,
      items: deals,
      seeAll: { query: `ارزون‌تر از قیمت محله در ${city}`, intent: cityIntent, sort: "ppm" },
    });
  }

  const newest = [...here]
    .sort((a, b) => b.listing.postedAt.localeCompare(a.listing.postedAt))
    .slice(0, RAIL_SIZE)
    .map((r) => ({ ...r, signal: { tone: "new", text: timeAgoFa(r.listing.postedAt, now) } as Signal }));
  if (newest.length) {
    rails.push({
      key: "newest",
      title: `تازه‌ترین‌ها در ${city}`,
      subtitle: null,
      badge: null,
      items: newest,
      seeAll: { query: `تازه‌ترین آگهی‌ها در ${city}`, intent: cityIntent, sort: "newest" },
    });
  }

  const recent = input.viewed
    .map((id) => everywhere.get(id))
    .filter((r): r is SearchResult => Boolean(r))
    .slice(0, RAIL_SIZE)
    .map((r) => ({ ...r, signal: input.saved.includes(r.listing.id) ? ({ tone: "muted", text: "ذخیره شده" } as Signal) : null }));
  if (recent.length) {
    rails.push({ key: "recent", title: "اخیراً دیدی", subtitle: null, badge: null, items: recent, seeAll: null });
  }

  return {
    city,
    rails,
    saved: input.saved.map((id) => everywhere.get(id)).filter((r): r is SearchResult => Boolean(r)),
  };
}
