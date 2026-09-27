import { distanceKm, type LatLng } from "@/lib/geo";
import { formatFaNumber, toFaDigits } from "@/lib/persian";

/**
 * "Neighborhood advantages": what's within walking distance of a home, from real OpenStreetMap
 * places (baked by scripts/build-nearby.mjs). Pure; the data is passed in, so it's testable and
 * the 300 KB place file never reaches the browser.
 */

export const POI_CATS = [
  "rail",
  "supermarket",
  "bakery",
  "pharmacy",
  "clinic",
  "hospital",
  "gym",
  "park",
  "mosque",
  "school",
  "bus",
] as const;
export type PoiCat = (typeof POI_CATS)[number];

/** One baked place: category, position, optional name, open 24/7. */
export interface Poi {
  c: PoiCat;
  lat: number;
  lng: number;
  n?: string;
  h24?: 1;
}

export interface NearbyItem {
  /** Stable key within one listing (the category). */
  key: PoiCat;
  /** Generic Persian label, e.g. «داروخانه شبانه‌روزی». */
  label: string;
  /** Real name from OpenStreetMap, when it has one. */
  name: string | null;
  /** Walking minutes (straight line × detour, 80 m/min). */
  minutes: number;
  meters: number;
  h24: boolean;
  /** Bus stops only: how many within BUS_MINUTES. */
  count?: number;
  lat: number;
  lng: number;
}

/** Straight-line → street distance. */
const DETOUR = 1.3;
/** Average walking speed, meters per minute (~4.8 km/h). */
const WALK = 80;
export const BUS_MINUTES = 5;
/** Show at most this many advantages (the closest / most useful). */
export const MAX_ITEMS = 6;

/** `kind`: words that already say what the place is, so «سوپرمارکت» isn't put before «هایپرمارکت جهانی». */
const CAT: Record<PoiCat, { label: string; maxMin: number; weight: number; kind: RegExp }> = {
  rail: { label: "ایستگاه مترو", maxMin: 15, weight: 1.6, kind: /ایستگاه|مترو|قطار/ },
  supermarket: { label: "سوپرمارکت", maxMin: 10, weight: 1.4, kind: /سوپر|هایپر|مارکت|فروشگاه|شهروند|افق|کوروش|رفاه/ },
  bakery: { label: "نانوایی", maxMin: 8, weight: 1.1, kind: /نان|شیرینی/ },
  pharmacy: { label: "داروخانه", maxMin: 12, weight: 1.2, kind: /داروخانه/ },
  clinic: { label: "درمانگاه", maxMin: 15, weight: 1.2, kind: /درمانگاه|کلینیک|مرکز|clinic/i },
  hospital: { label: "بیمارستان", maxMin: 20, weight: 1.0, kind: /بیمارستان/ },
  gym: { label: "باشگاه ورزشی", maxMin: 12, weight: 1.0, kind: /باشگاه|سالن|مجموعه|استخر|ورزش/ },
  park: { label: "پارک", maxMin: 10, weight: 1.1, kind: /پارک|بوستان|باغ/ },
  mosque: { label: "مسجد", maxMin: 8, weight: 0.8, kind: /مسجد|حسینیه|مصلی/ },
  school: { label: "مدرسه", maxMin: 8, weight: 0.7, kind: /مدرسه|دبستان|دبیرستان|هنرستان|آموزشگاه/ },
  bus: { label: "ایستگاه اتوبوس", maxMin: BUS_MINUTES, weight: 1.3, kind: /ایستگاه/ },
};
/** A 24/7 place wins over a slightly closer one (a night pharmacy is what people remember). */
const H24_BONUS_MIN = 6;

export const walkMeters = (a: LatLng, b: LatLng) => Math.round(distanceKm(a, b) * 1000 * DETOUR);
export const walkMinutes = (m: number) => Math.max(1, Math.round(m / WALK));

export function nearbyItems(home: LatLng, pois: Poi[]): NearbyItem[] {
  const byCat = new Map<PoiCat, { p: Poi; m: number }[]>();
  for (const p of pois) {
    const cfg = CAT[p.c];
    if (!cfg) continue;
    const m = walkMeters(home, p);
    if (walkMinutes(m) > cfg.maxMin) continue;
    byCat.set(p.c, [...(byCat.get(p.c) ?? []), { p, m }]);
  }

  const items: NearbyItem[] = [];
  for (const [cat, list] of byCat) {
    list.sort((a, b) => a.m - b.m);
    let pick = list[0];
    if (cat === "park" || cat === "mosque") pick = list.find((x) => x.p.n && x.m <= pick.m + 240) ?? pick; // a name reads better
    const h24 = list.find((x) => x.p.h24);
    if (h24 && walkMinutes(h24.m) - walkMinutes(pick.m) <= H24_BONUS_MIN) pick = h24;
    const isH24 = !!pick.p.h24 && cat !== "bus" && cat !== "rail" && cat !== "park";
    items.push({
      key: cat,
      label: isH24 ? `${CAT[cat].label} شبانه‌روزی` : CAT[cat].label,
      name: pick.p.n && /[\u0600-\u06FF]/.test(pick.p.n) ? pick.p.n : null, // Latin-only names read oddly in Persian copy
      minutes: walkMinutes(pick.m),
      meters: pick.m,
      h24: isH24,
      ...(cat === "bus" ? { count: list.length } : {}),
      lat: pick.p.lat,
      lng: pick.p.lng,
    });
  }
  // closest + most useful first; a hospital next to a clinic adds little, keep the clinic
  const score = (i: NearbyItem) => CAT[i.key].weight * (1 - i.minutes / (CAT[i.key].maxMin + 5)) + (i.h24 ? 0.15 : 0);
  const sorted = items.sort((a, b) => score(b) - score(a));
  const hasClinic = sorted.some((i) => i.key === "clinic");
  return sorted.filter((i) => !(i.key === "hospital" && hasClinic && i.minutes > 10)).slice(0, MAX_ITEMS);
}

/** Rule-based line for one advantage, e.g. «داروخانه شبانه‌روزی دکتر شیرازی، ۴ دقیقه پیاده». */
export function itemText(i: NearbyItem): string {
  const walk = `${toFaDigits(i.minutes)} دقیقه پیاده`;
  if (i.key === "bus") return `${formatFaNumber(i.count ?? 1)} ایستگاه اتوبوس تا ${toFaDigits(BUS_MINUTES)} دقیقه پیاده`;
  if (!i.name) return `${i.label}، ${walk}`;
  // most OSM names already say the kind («داروخانه دکتر…», «ایستگاه مترو کوثر»)
  const name = CAT[i.key].kind.test(i.name) ? i.name : `${i.label} ${i.name}`;
  const named = i.h24 && !/شبانه/.test(name) ? `${name} (شبانه‌روزی)` : name;
  return `${named}، ${walk}`;
}

/** Rule-based catchy title, used when the AI is unavailable. */
export function ruleTitle(items: NearbyItem[]): string {
  const near = items.filter((i) => i.minutes <= 5);
  const rail = items.find((i) => i.key === "rail");
  const shop = items.some((i) => (i.key === "supermarket" || i.key === "bakery") && i.minutes <= 6);
  if (rail && rail.minutes <= 8) return shop ? "مترو و خرید روزانه، همه دمِ دستت" : "مترو چند قدم اون‌ورتره";
  if (near.length >= 3) return `${toFaDigits(near.length)} چیز لازم، کمتر از ۵ دقیقه پیاده`;
  if (items.some((i) => i.h24)) return "نصفه‌شب هم دستت خالی نمی‌مونه";
  return "هر چی لازم داری، همین نزدیکی";
}

export function ruleSummary(items: NearbyItem[]): string {
  const [a, b] = items.filter((i) => i.key !== "bus");
  if (!a) return "";
  const to = (i: NearbyItem) => `تا ${i.label.replace(" شبانه‌روزی", "")} ${toFaDigits(i.minutes)} دقیقه`;
  return b ? `از در خونه ${to(a)} و ${to(b)} پیاده‌ست؛ برای کارای هر روز لازم نیست ماشین برداری.` : `از در خونه ${to(a)} پیاده‌ست.`;
}
