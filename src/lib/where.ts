import { findCity, HOODS, placeHits } from "./places";

/**
 * "Where is this person looking?" — read the place out of a free-text query, instantly and offline,
 * so the search box can show it while they type and the server can fill a city the LLM missed.
 *
 * Order of evidence: a city they name → a neighborhood or landmark that belongs to one city. A name
 * that exists in several cities ("الهیه": Tehran and Mashhad) is not guessed: the UI asks, and the
 * city they tap is written into the query, so the text stays the one source of truth.
 */

/**
 * Well-known neighborhoods and landmarks → city. Only for inferring the city (these are not listing
 * areas; `HOODS` in places.ts is). Names that are common street names in every city (ولیعصر، امام،
 * آزادی…) are left out on purpose; a name listed under two cities is a real ambiguity.
 */
const PLACE_HINTS: Record<string, string[]> = {
  "تهران": [
    "سعادت‌آباد", "شهرک غرب", "پونک", "ونک", "تجریش", "نیاوران", "پاسداران", "جردن", "یوسف‌آباد", "نارمک",
    "تهرانپارس", "ستارخان", "صادقیه", "جنت‌آباد", "اکباتان", "زعفرانیه", "الهیه", "ولنجک", "چیتگر", "میرداماد",
    "قیطریه", "فرمانیه", "دروس", "ازگل", "هروی", "نازی‌آباد", "امیرآباد", "گیشا", "شهرآرا", "مرزداران",
    "اختیاریه", "کامرانیه", "دیباجی", "منیریه", "سیدخندان", "آجودانیه", "باغ فیض", "تهرانسر", "حکیمیه",
    "برج میلاد", "شهران",
  ],
  "مشهد": [
    "حرم امام رضا", "کوهسنگی", "ملک‌آباد", "رضاشهر", "طبرسی", "سناباد", "دانشگاه فردوسی", "بلوار توس",
    "آبکوه", "فرامرز عباسی",
  ],
  "اصفهان": ["جلفا", "چهارباغ", "سی‌وسه‌پل", "نقش جهان", "مرداویج", "ملک‌شهر", "سپاهان‌شهر", "شیخ صدوق"],
  "شیراز": ["معالی‌آباد", "قصردشت", "زرهی", "فرهنگ‌شهر", "عفیف‌آباد", "ستارخان", "شهرک صدرا"],
  "کرج": ["گوهردشت", "عظیمیه", "مهرشهر", "جهانشهر", "باغستان", "فردیس", "حصارک", "رجایی‌شهر"],
  "تبریز": ["ائل‌گلی", "رشدیه", "باغمیشه", "آبرسان", "یاغچیان"],
};

export type PlaceGuess =
  | {
      status: "found";
      city: string;
      /** Neighborhood / landmark they named, if any (display only). */
      area: string | null;
      /** What gave it away. */
      via: "city" | "area";
    }
  /** A name that belongs to more than one city and no city named: ask. */
  | { status: "ambiguous"; area: string; cities: string[] }
  | { status: "none" };

interface AreaHit {
  name: string;
  city: string;
  at: number;
}

function areasIn(text: string, inCity?: string): AreaHit[] {
  const hits: AreaHit[] = [];
  const scan = (name: string, spellings: string[], city: string) => {
    if (inCity && city !== inCity) return;
    const at = Math.min(...spellings.flatMap((s) => placeHits(text, s)));
    if (Number.isFinite(at)) hits.push({ name, city, at });
  };
  for (const h of HOODS) scan(h.name, [h.name, ...h.aliases], h.city);
  for (const [city, names] of Object.entries(PLACE_HINTS)) for (const n of names) scan(n, [n], city);
  return hits.sort((a, b) => a.at - b.at);
}

/** Best guess of the place in `text`. */
export function detectPlace(text: string): PlaceGuess {
  const city = findCity(text);
  if (city) return { status: "found", city, area: areasIn(text, city)[0]?.name ?? null, via: "city" };

  const areas = areasIn(text);
  if (areas.length) {
    const first = areas[0];
    // cities that have a place with the first name → ambiguous if more than one
    const cities = [...new Set(areas.filter((a) => a.name === first.name).map((a) => a.city))];
    // another area in the text can settle it ("الهیه، نزدیک ونک" → تهران)
    const settled = cities.filter((c) => areas.some((a) => a.city === c && a.name !== first.name));
    const only = cities.length === 1 ? cities[0] : settled.length === 1 ? settled[0] : null;
    if (only) return { status: "found", city: only, area: first.name, via: "area" };
    return { status: "ambiguous", area: first.name, cities };
  }
  return { status: "none" };
}
