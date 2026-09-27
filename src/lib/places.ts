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
  // Islands, the north coast and other places people rent in (holiday towns, satellite cities).
  city("کیش", 26.53, 53.98),
  city("قشم", 26.95, 56.27),
  city("چابهار", 25.29, 60.64),
  city("رامسر", 36.92, 50.64),
  city("تنکابن", 36.82, 50.87),
  city("چالوس", 36.65, 51.42),
  city("نوشهر", 36.65, 51.5),
  city("محمودآباد", 36.63, 52.26),
  city("بابلسر", 36.7, 52.65),
  city("بابل", 36.54, 52.68),
  city("آمل", 36.47, 52.35),
  city("قائم‌شهر", 36.46, 52.86),
  city("بندر انزلی", 37.47, 49.46),
  city("لاهیجان", 37.21, 50.0),
  city("لواسان", 35.82, 51.63),
  city("اسلامشهر", 35.55, 51.23),
  city("شهریار", 35.66, 51.06),
  city("ورامین", 35.32, 51.65),
  city("شاهین‌شهر", 32.86, 51.55),
  city("نجف‌آباد", 32.63, 51.37),
  city("خمینی‌شهر", 32.7, 51.52),
  city("آبادان", 30.34, 48.3),
  city("خرمشهر", 30.44, 48.18),
  city("دزفول", 32.38, 48.4),
  city("بندر ماهشهر", 30.56, 49.2),
  city("ساوه", 35.02, 50.36),
  city("شاهرود", 36.42, 54.98),
  city("گنبد کاووس", 37.25, 55.17),
  city("بروجرد", 33.9, 48.75),
  city("ملایر", 34.3, 48.82),
  city("رفسنجان", 30.4, 56.0),
  city("سیرجان", 29.45, 55.68),
  city("جیرفت", 28.68, 57.74),
  city("بم", 29.1, 58.36),
  city("مراغه", 37.39, 46.24),
  city("خوی", 38.55, 44.95),
  city("مهاباد", 36.76, 45.72),
  city("مرودشت", 29.87, 52.8),
  city("زابل", 31.03, 61.49),
  city("تربت جام", 35.24, 60.62),
  city("کاشمر", 35.24, 58.46),
  city("گناباد", 34.35, 58.68),
  city("شاندیز", 36.4, 59.3),
  city("طرقبه", 36.31, 59.37),
  city("گلبهار", 36.52, 59.21),
];

/** Other spellings, including Finglish (people type "tehran" or "kish" too). */
const CITY_ALIASES: Record<string, string[]> = {
  "تهران": ["طهران", "tehran"],
  "مشهد": ["mashhad", "mashad"],
  "اصفهان": ["اصفهون", "isfahan", "esfahan"],
  "شیراز": ["shiraz"],
  "تبریز": ["tabriz"],
  "کرج": ["karaj"],
  "قم": ["qom", "ghom"],
  "اهواز": ["ahvaz", "ahwaz"],
  "رشت": ["rasht"],
  "یزد": ["yazd"],
  "کیش": ["جزیره کیش", "kish"],
  "قشم": ["qeshm", "gheshm"],
  "خرم‌آباد": ["خرم آباد", "خرماباد"],
  "بندر انزلی": ["انزلی", "بندرانزلی"],
  "بندر ماهشهر": ["ماهشهر"],
  "گنبد کاووس": ["گنبد"],
  "بندرعباس": ["بندر عباس"],
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

const cityWords = (c: CityInfo) => [c.fa, ...(CITY_ALIASES[c.fa] ?? [])];

/**
 * Text form used for place matching: normalized, lower-case, «آ» as «ا» (people type both), and
 * ZWNJ / no space / space treated alike ("وکیل‌آباد" = "وکیل آباد" = "وکیلاباد").
 */
const loose = (s: string) => normalizeFa(s).toLowerCase().replace(/آ/g, "ا");

/**
 * Whole-word pattern for a place name ("قم", not the "قم" inside "رقم"). Spaces inside the name are
 * optional, so a joined spelling still matches.
 */
export function placePattern(name: string): RegExp {
  const body = loose(name)
    .split(" ")
    .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join(" ?");
  // letters (and marks) of any script are word characters; «،» and «؟» are not
  return new RegExp(`(?<![\\p{L}\\p{M}])${body}(?![\\p{L}\\p{M}])`, "gu");
}

/** Every whole-word hit of a place name in text (index in the `loose` form of the text). */
export function placeHits(text: string, name: string): number[] {
  return [...loose(text).matchAll(placePattern(name))].map((m) => m.index);
}

/** Canonical city name for any spelling, or null. */
export function canonicalCity(name: string): string | null {
  const n = loose(name).replace(/^(شهر|جزیره|استان) /, "");
  return CITIES.find((c) => cityWords(c).some((w) => loose(w) === n))?.fa ?? null;
}

/**
 * City name to search by: the canonical one when known, else the name as written (so a query for a
 * city we don't list yet gets "no listings from X yet", not another city's listings). Not a city → null.
 */
export function cityName(name: string | null | undefined): string | null {
  if (!name) return null;
  const known = canonicalCity(name);
  if (known) return known;
  const n = normalizeFa(name).replace(/^(شهر|جزیره|استان) /, "");
  return /^[\p{Script=Arabic} ]{2,24}$/u.test(n) && !/^(ایران|کل ایران|همه جا)$/.test(n) ? n : null;
}

/** Every city named in free text, in reading order. */
export function citiesIn(text: string): { fa: string; at: number }[] {
  const t = loose(text);
  const hits: { fa: string; at: number }[] = [];
  for (const c of CITIES) {
    const at = Math.min(...cityWords(c).flatMap((w) => placeHits(t, w)));
    if (Number.isFinite(at)) hits.push({ fa: c.fa, at });
  }
  return hits.sort((a, b) => a.at - b.at);
}

/**
 * The city the user wants to live in: the first one named, except one they are moving away from
 * ("از تهران میام مشهد" → مشهد) when another city is named too.
 */
export function findCity(text: string): string | null {
  const t = loose(text);
  const hits = citiesIn(t);
  const from = (h: { at: number }) => /(?:^|\s)از\s?$/.test(t.slice(Math.max(0, h.at - 4), h.at));
  return (hits.find((h) => !from(h)) ?? hits[0])?.fa ?? null;
}
