import { unitPrice } from "@/lib/categories";
import { formatToman, toFaDigits } from "@/lib/persian";
import type { Listing } from "@/lib/types";

/**
 * Agency dashboard numbers from real events (pure, tested). Funnel per ad:
 * impression (shown in a list) → view (opened) → contact («اطلاعات تماس»); saves (♥) on the side.
 */
export type AdEventType = "impression" | "view" | "contact" | "save";

export interface AdEvent {
  id: string;
  type: AdEventType;
  at: number;
}

export type Counts = Record<AdEventType, number>;

export interface AdStats extends Counts {
  /** Views per day, oldest → today (`days` long). */
  daily: number[];
  lastViewAt: number | null;
}

export interface Overview {
  totals: Counts;
  last7: Counts;
  prev7: Counts;
  /** Start of each day (local time), oldest → today. */
  days: number[];
  dailyViews: number[];
  dailyContacts: number[];
  byAd: Record<string, AdStats>;
}

const DAY = 864e5;
const zero = (): Counts => ({ impression: 0, view: 0, contact: 0, save: 0 });

export function startOfDay(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function overview(events: AdEvent[], adIds: string[], now = Date.now(), days = 14): Overview {
  const ids = new Set(adIds);
  const today = startOfDay(now);
  const dayStarts = Array.from({ length: days }, (_, i) => startOfDay(today - (days - 1 - i) * DAY + DAY / 2));
  const dayIndex = (t: number) => {
    const s = startOfDay(t);
    const i = dayStarts.indexOf(s);
    return i;
  };
  const o: Overview = {
    totals: zero(),
    last7: zero(),
    prev7: zero(),
    days: dayStarts,
    dailyViews: dayStarts.map(() => 0),
    dailyContacts: dayStarts.map(() => 0),
    byAd: Object.fromEntries(adIds.map((id) => [id, { ...zero(), daily: dayStarts.map(() => 0), lastViewAt: null }])),
  };
  const weekStart = startOfDay(today - 6 * DAY + DAY / 2);
  const prevWeekStart = startOfDay(today - 13 * DAY + DAY / 2);
  for (const e of events) {
    if (!ids.has(e.id)) continue;
    const ad = o.byAd[e.id];
    o.totals[e.type]++;
    ad[e.type]++;
    if (e.at >= weekStart) o.last7[e.type]++;
    else if (e.at >= prevWeekStart) o.prev7[e.type]++;
    const i = dayIndex(e.at);
    if (e.type === "view") {
      ad.lastViewAt = Math.max(ad.lastViewAt ?? 0, e.at);
      if (i >= 0) {
        o.dailyViews[i]++;
        ad.daily[i]++;
      }
    }
    if (e.type === "contact" && i >= 0) o.dailyContacts[i]++;
  }
  return o;
}

/** Contacts per view, 0–1 (null with no views). */
export const contactRate = (c: Pick<Counts, "view" | "contact">) => (c.view ? Math.min(1, c.contact / c.view) : null);

/** "+۳۴٪" / "−۱۲٪" / null when there's nothing to compare against. */
export function deltaFa(now: number, before: number): { text: string; up: boolean } | null {
  if (!before) return null;
  const pct = Math.round(((now - before) / before) * 100);
  return { text: `${pct >= 0 ? "+" : "−"}${toFaDigits(Math.abs(pct))}٪`, up: pct >= 0 };
}

export interface MarketRef {
  /** Median comparable price per m² of real ads in the same category, city and neighborhood. */
  medianPpm: number;
  sample: number;
}

export interface Insight {
  tone: "good" | "warn" | "info";
  text: string;
}

/** Same threshold as the search page's price verdict (src/lib/search/score.ts MIN_SAMPLE). */
const MIN_SAMPLE = 5;

/**
 * One or two concrete, checkable suggestions per ad. Rule-based on purpose: every number comes from the
 * ad, its events or the real ads' median, so nothing is invented.
 */
export function adInsights(
  ad: Pick<Listing, "category" | "deposit" | "monthlyRent" | "price" | "nightlyPrice" | "areaM2"> & { images: string[] },
  s: Counts,
  market: MarketRef | null,
): Insight[] {
  const out: Insight[] = [];
  if (market && market.sample >= MIN_SAMPLE && ad.areaM2 > 0) {
    const ppm = unitPrice(ad);
    const diff = (ppm - market.medianPpm) / market.medianPpm;
    const pct = toFaDigits(Math.round(Math.abs(diff) * 100));
    const basis = `میانهٔ ${toFaDigits(market.sample)} آگهی واقعی محله، متری ${formatToman(Math.round(market.medianPpm / 1e4) * 1e4)}`;
    if (diff > 0.15) out.push({ tone: "warn", text: `${pct}٪ گرون‌تر از ${basis}. اگه تماس کمه، قیمت رو بازبینی کن.` });
    else if (diff < -0.1) out.push({ tone: "good", text: `${pct}٪ ارزون‌تر از ${basis}. احتمالاً زود مشتری پیدا می‌کنه.` });
    else out.push({ tone: "info", text: `قیمتش نزدیک ${basis}ه.` });
  }
  if (s.view >= 5 && s.contact === 0) out.push({ tone: "warn", text: `${toFaDigits(s.view)} بازدید ولی هنوز هیچ تماسی. قیمت و توضیحات رو چک کن.` });
  else if (s.impression >= 5 && s.view === 0) out.push({ tone: "warn", text: `${toFaDigits(s.impression)} بار تو نتایج دیده شده ولی کسی بازش نکرده. عنوان رو گویاتر کن.` });
  if (!ad.images.length) out.push({ tone: "info", text: "عکس نداره. با چند عکس، آگهی کامل‌تر دیده می‌شه." });
  return out.slice(0, 2);
}
