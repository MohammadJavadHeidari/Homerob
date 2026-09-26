import { normalizeFa } from "./text";

/**
 * Places Homerob knows: Iranian cities and, for cities that have listings, their neighborhoods.
 * Client-safe static data (no listings import). Real-data imports add neighborhoods here; a city
 * with at least one neighborhood counts as covered.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

export interface CityInfo {
  fa: string;
  center: LatLng;
}

export interface HoodInfo {
  name: string;
  city: string;
  /** From OpenStreetMap (for Mashhad: same points as the home-page map pins). */
  center: LatLng;
  aliases: string[];
  /** Neighborhoods next to this one, same city (for "near X" soft matching). */
  adjacent: string[];
}

const city = (fa: string, lat: number, lng: number): CityInfo => ({ fa, center: { lat, lng } });

/** Big Iranian cities (offline reverse geocoding + city names in queries). */
export const CITIES: CityInfo[] = [
  city("مشهد", 36.3, 59.58),
  city("تهران", 35.69, 51.39),
  city("کرج", 35.83, 50.99),
  city("اصفهان", 32.65, 51.67),
  city("شیراز", 29.61, 52.53),
  city("تبریز", 38.08, 46.29),
  city("قم", 34.64, 50.88),
  city("اهواز", 31.32, 48.67),
  city("کرمانشاه", 34.31, 47.07),
  city("ارومیه", 37.55, 45.08),
  city("رشت", 37.28, 49.58),
  city("زاهدان", 29.5, 60.86),
  city("کرمان", 30.28, 57.08),
  city("یزد", 31.9, 54.37),
  city("همدان", 34.8, 48.51),
  city("اراک", 34.09, 49.69),
  city("اردبیل", 38.25, 48.29),
  city("بندرعباس", 27.18, 56.27),
  city("قزوین", 36.27, 50.0),
  city("زنجان", 36.67, 48.48),
  city("ساری", 36.56, 53.06),
  city("گرگان", 36.84, 54.44),
  city("سنندج", 35.31, 47.0),
  city("خرم‌آباد", 33.49, 48.36),
  city("بوشهر", 28.97, 50.84),
  city("بجنورد", 37.47, 57.33),
  city("بیرجند", 32.87, 59.22),
  city("نیشابور", 36.21, 58.8),
  city("سبزوار", 36.21, 57.68),
  city("تربت حیدریه", 35.27, 59.22),
  city("قوچان", 37.11, 58.51),
  city("سمنان", 35.57, 53.39),
  city("شهرکرد", 32.33, 50.86),
  city("یاسوج", 30.67, 51.59),
  city("ایلام", 33.64, 46.42),
  city("کاشان", 33.98, 51.44),
];

const CITY_ALIASES: Record<string, string[]> = {
  "تهران": ["طهران"],
  "اصفهان": ["اصفهون"],
  "خرم‌آباد": ["خرم آباد", "خرماباد"],
};

export const HOODS: HoodInfo[] = [
  { name: "الهیه", city: "مشهد", center: { lat: 36.3705, lng: 59.4835 }, aliases: ["الاهیه"], adjacent: ["وکیل‌آباد", "سجاد"] },
  { name: "سجاد", city: "مشهد", center: { lat: 36.3185, lng: 59.5525 }, aliases: ["بلوار سجاد"], adjacent: ["احمدآباد", "الهیه"] },
  {
    name: "وکیل‌آباد",
    city: "مشهد",
    center: { lat: 36.3345, lng: 59.4875 },
    aliases: ["وکیل آباد", "وکیلاباد", "وکیل اباد"],
    adjacent: ["هاشمیه", "الهیه", "قاسم‌آباد"],
  },
  { name: "احمدآباد", city: "مشهد", center: { lat: 36.2965, lng: 59.5755 }, aliases: ["احمد آباد", "احمداباد", "احمد اباد"], adjacent: ["سجاد"] },
  { name: "هاشمیه", city: "مشهد", center: { lat: 36.3105, lng: 59.5045 }, aliases: [], adjacent: ["وکیل‌آباد", "قاسم‌آباد"] },
  {
    name: "قاسم‌آباد",
    city: "مشهد",
    center: { lat: 36.3505, lng: 59.5055 },
    aliases: ["قاسم آباد", "قاسماباد", "قاسم اباد"],
    adjacent: ["هاشمیه", "وکیل‌آباد"],
  },
];

/** Cities that have neighborhoods (and so listings). */
export const COVERED_CITIES: string[] = [...new Set(HOODS.map((h) => h.city))];

export const isCovered = (c: string | null | undefined) => !!c && COVERED_CITIES.includes(c);

export function cityInfo(name: string): CityInfo | undefined {
  return CITIES.find((c) => c.fa === name);
}

export function hoodsIn(c: string): HoodInfo[] {
  return HOODS.filter((h) => h.city === c);
}

/** Neighborhood by canonical name (optionally within a city — names can repeat across cities). */
export function hoodInfo(name: string, inCity?: string | null): HoodInfo | undefined {
  return HOODS.find((h) => h.name === name && (!inCity || h.city === inCity));
}

export function cityOfHood(name: string, inCity?: string | null): string | null {
  return hoodInfo(name, inCity)?.city ?? null;
}

export function adjacentHoods(name: string, inCity?: string | null): string[] {
  return hoodInfo(name, inCity)?.adjacent ?? [];
}

/** Map point for a neighborhood; the city center when the neighborhood isn't in the registry. */
export function hoodCenter(name: string, inCity?: string | null): LatLng | null {
  return hoodInfo(name, inCity)?.center ?? (inCity ? (cityInfo(inCity)?.center ?? null) : null);
}

const spellings = (h: HoodInfo) => [h.name, ...h.aliases].map(normalizeFa);

/** Map any spelling of a neighborhood to its canonical name, or null if unknown. */
export function canonicalNeighborhood(name: string, inCity?: string | null): string | null {
  const n = normalizeFa(name);
  return HOODS.find((h) => (!inCity || h.city === inCity) && spellings(h).includes(n))?.name ?? null;
}

/** All neighborhoods mentioned anywhere in free text (within `inCity` when given). */
export function findNeighborhoods(text: string, inCity?: string | null): string[] {
  const t = normalizeFa(text);
  return HOODS.filter((h) => (!inCity || h.city === inCity) && spellings(h).some((s) => t.includes(s))).map((h) => h.name);
}

const cityWords = (c: CityInfo) => [c.fa, ...(CITY_ALIASES[c.fa] ?? [])].map(normalizeFa);
const FA_LETTER = "؀-ۿ";

/** Canonical city name for any spelling, or null. */
export function canonicalCity(name: string): string | null {
  const n = normalizeFa(name);
  return CITIES.find((c) => cityWords(c).includes(n))?.fa ?? null;
}

/** First city named in free text, as a whole word ("قم", not the "قم" inside "رقم"). */
export function findCity(text: string): string | null {
  const t = normalizeFa(text);
  let best: { fa: string; at: number } | null = null;
  for (const c of CITIES) {
    for (const w of cityWords(c)) {
      const m = new RegExp(`(?<![${FA_LETTER}])${w}(?![${FA_LETTER}])`).exec(t);
      if (m && (!best || m.index < best.at)) best = { fa: c.fa, at: m.index };
    }
  }
  return best?.fa ?? null;
}
