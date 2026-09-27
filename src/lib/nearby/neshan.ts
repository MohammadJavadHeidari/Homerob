import { acceptsName, type Poi, type PoiCat } from "@/lib/nearby/facts";

/**
 * Live nearby places from Neshan (the Iranian map, far richer than OSM here). Spec captured in
 * docs/research/neshan-api.md:
 *  - `GET /v1/nearby?location=lat,lng&layer=<slug>&searchRadius=<m>` for categories with a layer,
 *  - `GET /v3/search?q={"term","center"}` text search (max 30, by distance) for the ones without one.
 * Needs a *service* key with Search + Nearby enabled (`NESHAN_API_KEY`, server-only). The key is
 * domain-whitelisted by Referer/Origin, which server fetches don't send, so we send them.
 */

const API = "https://api.neshan.org";
/** ~15 minutes' walk as the crow flies (see walkMeters in facts.ts); farther hits are dropped anyway. */
const RADIUS_M = 1300;

/** Categories with a Neshan nearby layer (160 toman/request). */
export const NESHAN_LAYERS: Partial<Record<PoiCat, string>> = {
  rail: "metro_entrance",
  bus: "bus_station",
  clinic: "clinic",
  gym: "gym",
  park: "park",
  mosque: "mosque",
};
/** No layer → text search (40 toman/request). `type` is Neshan's English slug when it sends one. */
export const NESHAN_SEARCH: Partial<Record<PoiCat, { term: string; types: RegExp }>> = {
  pharmacy: { term: "داروخانه", types: /pharmacy/ },
  supermarket: { term: "سوپرمارکت", types: /supermarket|grocery|convenience|hypermarket|store/ },
  bakery: { term: "نانوایی", types: /bakery/ },
};

interface NearbyAnswer {
  layerPoints?: { nearestPoints?: { name?: string; location?: { latitude?: number; longitude?: number } }[] };
}
interface SearchAnswer {
  items?: { title?: string; type?: string; category?: string; location?: { x?: number; y?: number } }[];
}

const h24 = (name: string) => /شبانه ?‌?روز/.test(name);

function poi(cat: PoiCat, name: string, lat: number, lng: number): Poi | null {
  if (!name || !Number.isFinite(lat) || !Number.isFinite(lng) || !lat || !lng) return null;
  const p: Poi = { c: cat, lat, lng, n: name.slice(0, 60), s: "neshan" };
  if (h24(name)) p.h24 = 1;
  return p;
}

/** `/v1/nearby` answer → places. The layer already says what they are; only names are cleaned. */
export function fromNearby(cat: PoiCat, json: unknown): Poi[] {
  const pts = (json as NearbyAnswer | null)?.layerPoints?.nearestPoints;
  if (!Array.isArray(pts)) return [];
  return pts.flatMap((pt) => {
    const name = pt.name?.trim() ?? "";
    // a layer hit whose name says otherwise («خیابان مسجد») is skipped; unnamed ones keep the layer's word
    if (name && /^(خیابان|بلوار|کوچه|میدان|بزرگراه)/.test(name)) return [];
    const p = poi(cat, name || " ", Number(pt.location?.latitude), Number(pt.location?.longitude));
    if (p && !name) delete p.n;
    return p ? [p] : [];
  });
}

/** `/v3/search` answer → places: real places only (not streets / regions) that name this kind. */
export function fromSearch(cat: PoiCat, json: unknown): Poi[] {
  const items = (json as SearchAnswer | null)?.items;
  if (!Array.isArray(items)) return [];
  const types = NESHAN_SEARCH[cat]?.types;
  return items.flatMap((it) => {
    const name = it.title?.trim() ?? "";
    if (it.category && it.category !== "place") return [];
    const typed = !!(it.type && types?.test(it.type));
    if (!typed && !acceptsName(cat, name)) return [];
    const p = poi(cat, name, Number(it.location?.y), Number(it.location?.x));
    return p ? [p] : [];
  });
}

export const neshanKey = () => process.env.NESHAN_API_KEY?.trim() || null;

/** Key/config problems (480 bad key, 483 wrong type, 484 domain, 485 service not enabled) won't fix themselves soon. */
const CONFIG_ERRORS = new Set([480, 483, 484, 485]);
const BACKOFF_MS = 10 * 60_000;
let disabledUntil = 0;
/** For `/api/nearby`'s `neshan` field: "ok", "off" (no key), or the last error, e.g. "error 485". */
export let neshanStatus = "off";

class NeshanError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function get(path: string, key: string, signal: AbortSignal): Promise<unknown> {
  const site = process.env.NESHAN_REFERER?.trim() || "https://homerob.vercel.app";
  const res = await fetch(`${API}${path}`, {
    headers: { "Api-Key": key, Referer: `${site}/`, Origin: site },
    signal,
    cache: "no-store",
  });
  if (!res.ok) throw new NeshanError(res.status, `HTTP ${res.status} ${(await res.text()).slice(0, 120)}`);
  return res.json();
}

/**
 * All categories around a point, in parallel. `null` when there's no key, the key is misconfigured
 * (then Neshan is skipped for 10 minutes so every request doesn't pay for it), or every call failed.
 */
export async function neshanPois(home: { lat: number; lng: number }, timeoutMs = 3_500): Promise<Poi[] | null> {
  const key = neshanKey();
  if (!key) return null;
  if (Date.now() < disabledUntil) return null; // neshanStatus keeps the error that caused the pause
  const signal = AbortSignal.timeout(timeoutMs);
  const loc = `${home.lat.toFixed(6)},${home.lng.toFixed(6)}`;
  const center = { latitude: +home.lat.toFixed(6), longitude: +home.lng.toFixed(6) };
  const calls: Promise<Poi[]>[] = [
    ...Object.entries(NESHAN_LAYERS).map(async ([cat, layer]) =>
      fromNearby(cat as PoiCat, await get(`/v1/nearby?location=${loc}&layer=${layer}&searchRadius=${RADIUS_M}`, key, signal)),
    ),
    ...Object.entries(NESHAN_SEARCH).map(async ([cat, s]) =>
      fromSearch(cat as PoiCat, await get(`/v3/search?q=${encodeURIComponent(JSON.stringify({ term: s.term, center }))}`, key, signal)),
    ),
  ];
  const results = await Promise.allSettled(calls);
  const failed = results.flatMap((r) => (r.status === "rejected" ? [r.reason] : []));
  const first = failed[0];
  neshanStatus = !failed.length ? "ok" : `error ${first instanceof NeshanError ? first.status : "network"}`;
  if (failed.length) {
    console.error(`[nearby] Neshan: ${failed.length}/${calls.length} calls failed:`, failed[0]?.message ?? failed[0]);
    if (failed.some((e) => e instanceof NeshanError && CONFIG_ERRORS.has(e.status))) disabledUntil = Date.now() + BACKOFF_MS;
  }
  if (failed.length === calls.length) return null;
  return results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
}
