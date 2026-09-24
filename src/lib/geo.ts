import { ADJACENT } from "@/lib/neighborhoods";
import type { Neighborhood } from "@/lib/types";

/** Offline "reverse geocoding": nearest big Iranian city, no API key or network call needed. */

export interface LatLng {
  lat: number;
  lng: number;
}

/** Cities Homerob has listings for. */
export const SUPPORTED_CITY = "مشهد";

const CITIES: [name: string, lat: number, lng: number][] = [
  ["مشهد", 36.3, 59.58],
  ["تهران", 35.69, 51.39],
  ["کرج", 35.83, 50.99],
  ["اصفهان", 32.65, 51.67],
  ["شیراز", 29.61, 52.53],
  ["تبریز", 38.08, 46.29],
  ["قم", 34.64, 50.88],
  ["اهواز", 31.32, 48.67],
  ["کرمانشاه", 34.31, 47.07],
  ["ارومیه", 37.55, 45.08],
  ["رشت", 37.28, 49.58],
  ["زاهدان", 29.5, 60.86],
  ["کرمان", 30.28, 57.08],
  ["یزد", 31.9, 54.37],
  ["همدان", 34.8, 48.51],
  ["اراک", 34.09, 49.69],
  ["اردبیل", 38.25, 48.29],
  ["بندرعباس", 27.18, 56.27],
  ["قزوین", 36.27, 50.0],
  ["زنجان", 36.67, 48.48],
  ["ساری", 36.56, 53.06],
  ["گرگان", 36.84, 54.44],
  ["سنندج", 35.31, 47.0],
  ["خرم‌آباد", 33.49, 48.36],
  ["بوشهر", 28.97, 50.84],
  ["بجنورد", 37.47, 57.33],
  ["بیرجند", 32.87, 59.22],
  ["نیشابور", 36.21, 58.8],
  ["سبزوار", 36.21, 57.68],
  ["تربت حیدریه", 35.27, 59.22],
  ["قوچان", 37.11, 58.51],
  ["سمنان", 35.57, 53.39],
  ["شهرکرد", 32.33, 50.86],
  ["یاسوج", 30.67, 51.59],
  ["ایلام", 33.64, 46.42],
  ["کاشان", 33.98, 51.44],
];
const CITY_RADIUS_KM = 60;

/** Rough centers of the neighborhoods in the dataset. */
const HOOD_CENTERS: Record<Neighborhood, LatLng> = {
  "قاسم‌آباد": { lat: 36.352, lng: 59.505 },
  "وکیل‌آباد": { lat: 36.334, lng: 59.49 },
  "هاشمیه": { lat: 36.325, lng: 59.515 },
  "الهیه": { lat: 36.322, lng: 59.548 },
  "سجاد": { lat: 36.317, lng: 59.572 },
  "احمدآباد": { lat: 36.302, lng: 59.585 },
};

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
  neighborhood: Neighborhood | null;
}

export function locate(p: LatLng): UserPlace {
  let city: string | null = null;
  let best = CITY_RADIUS_KM;
  for (const [name, lat, lng] of CITIES) {
    const d = distanceKm(p, { lat, lng });
    if (d <= best) {
      best = d;
      city = name;
    }
  }
  if (city !== SUPPORTED_CITY) return { city, supported: false, neighborhood: null };
  const neighborhood = (Object.keys(HOOD_CENTERS) as Neighborhood[]).reduce((a, b) =>
    distanceKm(p, HOOD_CENTERS[b]) < distanceKm(p, HOOD_CENTERS[a]) ? b : a,
  );
  return { city, supported: true, neighborhood };
}

/** The user's area: their neighborhood plus the ones next to it. */
export function areaAround(n: Neighborhood): Neighborhood[] {
  return [n, ...ADJACENT[n]];
}
