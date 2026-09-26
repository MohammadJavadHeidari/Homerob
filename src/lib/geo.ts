import { adjacentHoods, CITIES, hoodCenter, hoodsIn, isCovered, type LatLng } from "@/lib/places";
import type { Listing } from "@/lib/types";

/** Offline "reverse geocoding": nearest big Iranian city, no API key or network call needed. */

export type { LatLng };

const CITY_RADIUS_KM = 60;

export function distanceKm(a: LatLng, b: LatLng): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

export interface UserPlace {
  /** Persian city name, or null when we can't tell. */
  city: string | null;
  /** True when Homerob has listings for that city. */
  supported: boolean;
  /** Closest dataset neighborhood (only in a supported city). */
  neighborhood: string | null;
}

export function locate(p: LatLng): UserPlace {
  let city: string | null = null;
  let best = CITY_RADIUS_KM;
  for (const c of CITIES) {
    const d = distanceKm(p, c.center);
    if (d <= best) {
      best = d;
      city = c.fa;
    }
  }
  if (!city || !isCovered(city)) return { city, supported: false, neighborhood: null };
  const neighborhood = hoodsIn(city).reduce((a, b) => (distanceKm(p, b.center) < distanceKm(p, a.center) ? b : a)).name;
  return { city, supported: true, neighborhood };
}

/** The user's area: their neighborhood plus the ones next to it. */
export function areaAround(n: string, city?: string | null): string[] {
  return [n, ...adjacentHoods(n, city)];
}

/** [west, south, east, north] */
export type BBox = [number, number, number, number];

/** How far (degrees of latitude, ~1.1 km) a listing may sit from its neighborhood center. */
const SPREAD = 0.01;

/**
 * Approximate map position of a seeded listing: a stable point inside its neighborhood, derived
 * from the id (the sample data has no real addresses). Same id → same point, on server and client.
 */
export function listingLatLng(l: Pick<Listing, "id" | "neighborhood" | "city" | "lat" | "lng">): LatLng {
  if (l.lat != null && l.lng != null) return { lat: l.lat, lng: l.lng };
  let h = 2166136261;
  for (let i = 0; i < l.id.length; i++) h = Math.imul(h ^ l.id.charCodeAt(i), 16777619);
  const u = ((h >>> 0) % 10_000) / 10_000;
  const v = ((Math.imul(h, 2654435761) >>> 0) % 10_000) / 10_000;
  const r = SPREAD * Math.sqrt(0.08 + 0.92 * u); // uniform over a disc, never exactly the center
  const a = 2 * Math.PI * v;
  const c = hoodCenter(l.neighborhood, l.city) ?? { lat: 32.4, lng: 53.7 }; // unknown place → middle of Iran
  return { lat: c.lat + r * Math.sin(a), lng: c.lng + (r * Math.cos(a)) / Math.cos((c.lat * Math.PI) / 180) };
}

export const inBBox = (p: LatLng, [w, s, e, n]: BBox) => p.lng >= w && p.lng <= e && p.lat >= s && p.lat <= n;
