// Registers Divar districts the registry doesn't know yet, from the crawled ads themselves — so a new
// district's ads aren't dropped while nobody has looked at it. Used by scripts/import-divar-crawl.ts.
// Real data only: a district is registered only where real ads put map points; nothing is guessed.

import { canonicalCity, canonicalNeighborhood, type HoodInfo } from "../places";

/** A skipped ad's place: Divar's district, the city, and the ad's map point. */
export interface DistrictSighting {
  city: string;
  district: string;
  lat?: number | null;
  lng?: number | null;
  exact?: boolean | null;
}

/** Same as the curated block: neighbors are districts whose centers lie within 2 km (at most 5). */
const ADJACENT_KM = 2;
const ADJACENT_MAX = 5;

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

function km(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const dy = (a.lat - b.lat) * 111;
  const dx = (a.lng - b.lng) * 111 * Math.cos((a.lat * Math.PI) / 180);
  return Math.hypot(dx, dy);
}

/**
 * Whether a name may be a common word or a street name («دانشجو», «گاز», «امام»): then it is matched in a
 * query only as «محله X». Names with «آباد», «شهر», «شهرک», or more than one word read as places.
 */
export function isStrictName(name: string): boolean {
  if (canonicalCity(name)) return true; // «خرمشهر» is also a city
  return !(/\s/.test(name.trim()) || /آباد|شهر/.test(name));
}

/**
 * New registry entries for the districts in `sightings` that `known` doesn't have. Center = median of
 * the exact map points (any points if none is exact); districts without a point are left out.
 */
export function proposeHoods(sightings: DistrictSighting[], known: HoodInfo[]): HoodInfo[] {
  const groups = new Map<string, DistrictSighting[]>();
  for (const s of sightings) {
    if (!s.district || !s.city) continue;
    const key = `${s.city}|${s.district}`;
    groups.set(key, [...(groups.get(key) ?? []), s]);
  }
  const added: HoodInfo[] = [];
  for (const group of groups.values()) {
    const { city, district } = group[0];
    if (canonicalNeighborhood(district, city)) continue;
    const located = group.filter((s) => typeof s.lat === "number" && typeof s.lng === "number");
    const exact = located.filter((s) => s.exact);
    const points = (exact.length ? exact : located) as { lat: number; lng: number }[];
    if (!points.length) continue;
    // «مشکینی (شهرک غرب)» → «مشکینی», Divar's spelling kept as an alias
    const name = district.replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s+/g, " ").trim();
    if (!name || added.some((h) => h.city === city && h.name === name) || known.some((h) => h.city === city && h.name === name)) continue;
    const aliases = [...new Set([district, name.replace(/‌/g, " ")])].filter((a) => a !== name);
    added.push({
      name,
      city,
      center: { lat: Number(median(points.map((p) => p.lat)).toFixed(4)), lng: Number(median(points.map((p) => p.lng)).toFixed(4)) },
      aliases,
      adjacent: [],
      ...(isStrictName(name) ? { strict: true } : {}),
    });
  }
  const all = [...known, ...added];
  for (const h of added) {
    h.adjacent = all
      .filter((o) => o !== h && o.city === h.city && km(o.center, h.center) <= ADJACENT_KM)
      .sort((a, b) => km(a.center, h.center) - km(b.center, h.center))
      .slice(0, ADJACENT_MAX)
      .map((o) => o.name);
  }
  return added;
}
