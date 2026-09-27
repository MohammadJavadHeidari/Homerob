import { acceptsName, type Poi, type PoiCat } from "@/lib/nearby/facts";

/**
 * Live nearby places from Neshan's search API (the Iranian map, so far richer than OSM here):
 * `GET https://api.neshan.org/v1/search?term=…&lat=…&lng=…`, header `Api-Key: service.…`.
 * Needs a *service* key (`NESHAN_API_KEY`, server-only); the `web.` map key doesn't work here.
 */

const URL_BASE = "https://api.neshan.org/v1/search";

/** One search term per category; hits are filtered by `acceptsName` and distance afterwards. */
export const NESHAN_TERMS: Record<PoiCat, string> = {
  rail: "ایستگاه مترو",
  bus: "ایستگاه اتوبوس",
  supermarket: "سوپرمارکت",
  bakery: "نانوایی",
  pharmacy: "داروخانه",
  clinic: "درمانگاه",
  hospital: "بیمارستان",
  gym: "باشگاه ورزشی",
  park: "پارک",
  mosque: "مسجد",
  school: "مدرسه",
};

interface NeshanItem {
  title?: string;
  address?: string;
  type?: string;
  category?: string;
  location?: { x?: number; y?: number };
}

/** Neshan answer for one term → places of that category (pure, tested). */
export function toPois(cat: PoiCat, json: unknown): Poi[] {
  const items = (json as { items?: NeshanItem[] } | null)?.items;
  if (!Array.isArray(items)) return [];
  const out: Poi[] = [];
  for (const it of items) {
    const name = it.title?.trim();
    const lng = Number(it.location?.x);
    const lat = Number(it.location?.y);
    if (!name || !Number.isFinite(lat) || !Number.isFinite(lng) || !lat || !lng) continue;
    if (!acceptsName(cat, name)) continue;
    const p: Poi = { c: cat, lat, lng, n: name.slice(0, 60), s: "neshan" };
    if (/شبانه ?(‌)?روز/.test(name)) p.h24 = 1;
    out.push(p);
  }
  return out;
}

export const neshanKey = () => process.env.NESHAN_API_KEY?.trim() || null;

/**
 * All categories around a point, in parallel. `null` when there's no key or Neshan failed
 * everywhere (the caller then uses the baked OSM places only).
 */
export async function neshanPois(home: { lat: number; lng: number }, timeoutMs = 3_500): Promise<Poi[] | null> {
  const key = neshanKey();
  if (!key) return null;
  const signal = AbortSignal.timeout(timeoutMs);
  const cats = Object.keys(NESHAN_TERMS) as PoiCat[];
  const results = await Promise.allSettled(
    cats.map(async (cat) => {
      const q = new URLSearchParams({ term: NESHAN_TERMS[cat], lat: home.lat.toFixed(6), lng: home.lng.toFixed(6) });
      const res = await fetch(`${URL_BASE}?${q}`, { headers: { "Api-Key": key }, signal, cache: "no-store" });
      if (!res.ok) throw new Error(`${cat}: HTTP ${res.status} ${(await res.text()).slice(0, 120)}`);
      return toPois(cat, await res.json());
    }),
  );
  const failed = results.filter((r) => r.status === "rejected");
  if (failed.length) console.error(`[nearby] Neshan: ${failed.length}/${cats.length} failed:`, (failed[0] as PromiseRejectedResult).reason?.message);
  if (failed.length === cats.length) return null;
  return results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
}
