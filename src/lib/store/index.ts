import "server-only";

import postgres from "postgres";

import { listings as BUNDLED } from "@/data/listings";
import {
  areaAround,
  buildAdjacency,
  catalogFromListings,
  FA_LETTER,
  findNeighborhoods,
  withPositions,
  type CityCatalog,
  type HoodInfo,
} from "@/lib/catalog";
import { distanceKm, type LatLng } from "@/lib/geo";
import type { SearchIntent } from "@/lib/intent/schema";
import type { HoodStat } from "@/lib/hood-stats";
import { MONTHLY_RATE } from "@/lib/pricing";
import { makeContext, type SearchContext } from "@/lib/search";
import { normalizeFa } from "@/lib/text";
import type { Listing } from "@/lib/types";

/**
 * Where listings come from. With `DATABASE_URL` set: Postgres (schema in db/schema.sql, loaded by
 * scripts/realdata/load_db.py — real Divar ads for every city). Without it: the bundled Mashhad sample
 * (src/data/listings.json), so the app still works locally and in previews.
 */

export interface CityInfo {
  city: string;
  cityFa: string;
  n: number;
  center: LatLng | null;
}

export const DEFAULT_CITY = "mashhad";
/** Rows pulled per search; ranking happens in JS on this candidate set. */
const CANDIDATE_LIMIT = 4000;
/** Candidates may cost up to this multiple of the stated budget (room for conversion + suggestions). */
const BUDGET_HEADROOM = 3;
const CACHE_MS = 10 * 60_000;

/**
 * Libpq-only URL options (Neon's URLs carry `channel_binding=require`) would be sent to the server as
 * session settings by the `postgres` client and rejected, so they are stripped.
 */
export function clientUrl(raw: string): string {
  const u = new URL(raw);
  for (const k of ["channel_binding", "connect_timeout", "options", "gssencmode"]) u.searchParams.delete(k);
  return u.toString();
}

const url = process.env.DATABASE_URL;
// prepare: false — Neon's pooled URL goes through PgBouncer (transaction mode)
const sql = url ? postgres(clientUrl(url), { max: 3, idle_timeout: 20, prepare: false, connect_timeout: 8 }) : null;

export const storeKind = () => (sql ? "postgres" : "bundled");

const cache = new Map<string, { at: number; value: unknown }>();
async function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value as T;
  const value = await load();
  cache.set(key, { at: Date.now(), value });
  return value;
}

// ---------- bundled fallback ----------

const BUNDLED_CATALOG = catalogFromListings(BUNDLED);
const BUNDLED_LISTINGS = withPositions(BUNDLED, BUNDLED_CATALOG);

// ---------- cities ----------

export function listCities(): Promise<CityInfo[]> {
  if (!sql) {
    return Promise.resolve([
      { city: DEFAULT_CITY, cityFa: "مشهد", n: BUNDLED.length, center: BUNDLED_CATALOG.center },
    ]);
  }
  return cached("cities", async () => {
    const rows = await sql`select city, city_fa, n, lat, lng from city_stats where n >= 50 order by n desc`;
    return rows.map((r) => ({
      city: r.city as string,
      cityFa: r.city_fa as string,
      n: r.n as number,
      center: r.lat == null ? null : { lat: Number(r.lat), lng: Number(r.lng) },
    }));
  });
}

const fold = (s: string) => normalizeFa(s).replace(/آ/g, "ا");

/**
 * Which city to search: one named in the query (whole word, not also a neighborhood of the user's
 * city), else the city the user is in, else Mashhad.
 */
export async function resolveCity(query: string, at?: LatLng | null): Promise<CityInfo> {
  const cities = await listCities();
  const fallback = cities.find((c) => c.city === DEFAULT_CITY) ?? cities[0];
  let here: CityInfo | undefined;
  if (at) {
    let best = 40; // km
    for (const c of cities) {
      if (!c.center || c.n < 100) continue;
      const d = distanceKm(at, c.center);
      if (d < best) [best, here] = [d, c];
    }
  }
  const base = here ?? fallback;
  const text = ` ${fold(query)} `;
  const named = cities
    .filter((c) => c.n >= 300 && c.city !== base.city)
    .filter((c) => new RegExp(`[^${FA_LETTER}]${fold(c.cityFa)}[^${FA_LETTER}]`).test(text))
    .sort((a, b) => b.cityFa.length - a.cityFa.length)[0];
  if (named) {
    // «آزادشهر» is a city and a Mashhad neighborhood: the user's own city wins
    const baseCatalog = await getCatalog(base.city);
    if (!findNeighborhoods(query, baseCatalog.hoods).length) return named;
  }
  return base;
}

// ---------- catalog ----------

export function getCatalog(city: string): Promise<CityCatalog> {
  if (!sql) return Promise.resolve(BUNDLED_CATALOG);
  return cached(`catalog:${city}`, async () => {
    const [cityRow] = await sql`select city_fa, median_ppm2, lat, lng from city_stats where city = ${city}`;
    const rows = await sql`
      select neighborhood, n, median_ppm2, median_full, lat, lng
      from hood_stats where city = ${city} order by n desc`;
    const hoods: HoodInfo[] = rows.map((r) => ({
      name: r.neighborhood as string,
      n: r.n as number,
      medianPpm2: Number(r.median_ppm2),
      medianFull: Number(r.median_full),
      center: r.lat == null ? null : { lat: Number(r.lat), lng: Number(r.lng) },
    }));
    return {
      city,
      cityFa: (cityRow?.city_fa as string) ?? city,
      hoods,
      medianPpm2: Number(cityRow?.median_ppm2 ?? 0),
      center: cityRow?.lat == null ? null : { lat: Number(cityRow.lat), lng: Number(cityRow.lng) },
      adjacent: buildAdjacency(hoods),
    };
  });
}

// ---------- candidates ----------

/** Full-deposit ceiling worth fetching for this intent (null = no budget stated). */
function priceCap(intent: SearchIntent): number | null {
  const { maxDeposit: D, maxRent: R } = intent;
  if (D === null && R === null) return null;
  const full = (D ?? 0) + (R ?? 0) / MONTHLY_RATE;
  // one-sided budgets allow an implicit other side of ~2× (see search/budget.ts)
  const oneSided = D === null || R === null ? 3 : 1;
  return Math.round(full * oneSided * BUDGET_HEADROOM);
}

/** Neighborhoods to fetch: the named ones and their neighbors, or the user's area, or all (null). */
function hoodFilter(intent: SearchIntent, catalog: CityCatalog, broad: boolean): string[] | null {
  if (broad) return null;
  if (intent.neighborhoods.length) {
    return [...new Set(intent.neighborhoods.flatMap((n) => areaAround(catalog, n)))];
  }
  if (intent.nearMe) return areaAround(catalog, intent.nearMe);
  return null;
}

type Row = Record<string, unknown>;
function toListing(r: Row): Listing {
  const cityFa = r.city_fa as string;
  const hood = (r.neighborhood as string | null) ?? cityFa;
  return {
    id: r.id as string,
    source: "divar",
    city: r.city as string,
    cityFa,
    title: r.title as string,
    neighborhood: hood,
    street: (r.street as string | null) ?? hood,
    deposit: Number(r.deposit),
    monthlyRent: Number(r.monthly_rent),
    areaM2: r.area_m2 as number,
    rooms: r.rooms as number,
    floor: (r.floor as number | null) ?? 0,
    totalFloors: r.total_floors as number | null,
    buildingAge: (r.building_age as number | null) ?? 0,
    elevator: r.elevator as boolean,
    parking: r.parking as boolean,
    storage: r.storage as boolean,
    tags: (r.tags as string[]) ?? [],
    convertible: r.convertible as boolean,
    description: r.description as string,
    postedAt: r.posted_at ? new Date(r.posted_at as string).toISOString() : new Date(0).toISOString(),
    lat: r.lat == null ? undefined : Number(r.lat),
    lng: r.lng == null ? undefined : Number(r.lng),
    url: (r.url as string | null) ?? null,
  };
}

/**
 * Listings to rank for this intent, with the city's reference data. `broad` drops the neighborhood
 * prefilter (used to find suggestions when nothing matched).
 */
export async function getContext(intent: SearchIntent, catalog: CityCatalog, broad = false): Promise<SearchContext> {
  const hoods = hoodFilter(intent, catalog, broad);
  const cap = priceCap(intent);
  if (!sql) {
    const ls = BUNDLED_LISTINGS.filter(
      (l) => (!hoods || hoods.includes(l.neighborhood)) && (cap === null || l.deposit + l.monthlyRent / MONTHLY_RATE <= cap),
    );
    return makeContext(ls, catalog);
  }
  const rows = await sql`
    select id, city, city_fa, neighborhood, street, title, description, deposit, monthly_rent, area_m2, rooms,
           floor, total_floors, building_age, elevator, parking, storage, tags, convertible, posted_at, lat, lng, url
    from listings
    where city = ${catalog.city}
      ${hoods ? sql`and neighborhood = any(${hoods})` : sql``}
      ${cap !== null ? sql`and full_deposit <= ${cap}` : sql``}
      ${intent.minRooms !== null ? sql`and rooms >= ${Math.max(0, intent.minRooms - 1)}` : sql``}
    order by posted_at desc nulls last
    limit ${CANDIDATE_LIMIT}`;
  return makeContext(withPositions(rows.map(toListing), catalog), catalog);
}

// ---------- home-page map numbers ----------

/** Listing count and median full-rahn for the given Mashhad neighborhoods (home-page map). */
export async function getHoodStats(names: Record<string, string>): Promise<{ total: number; hoods: HoodStat[] }> {
  const catalog = await getCatalog(DEFAULT_CITY);
  const cities = await listCities();
  const total = cities.find((c) => c.city === DEFAULT_CITY)?.n ?? 0;
  return {
    total,
    hoods: Object.entries(names).map(([pin, dataName]) => {
      const h = catalog.hoods.find((x) => x.name === dataName);
      return { hood: pin, count: h?.n ?? 0, medianFullDeposit: Math.round(h?.medianFull ?? 0) };
    }),
  };
}
