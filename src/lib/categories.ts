import { toFullDeposit } from "./pricing";
import { normalizeFa } from "./text";
import type { Listing } from "./types";

/**
 * Real-estate categories, same split as Divar's «املاک» tree (docs/research/categories.md).
 * Client-safe static data. Each category has its own price model:
 * - rent: rahn + ejare (deposit / monthly rent, convertible with MONTHLY_RATE)
 * - sale: one total price
 * - nightly: price per night
 */

export const CATEGORY_KEYS = [
  "residential-rent",
  "residential-sale",
  "commercial-rent",
  "commercial-sale",
  "short-term",
  "projects",
] as const;

export type CategoryKey = (typeof CATEGORY_KEYS)[number];
export type PriceModel = "rent" | "sale" | "nightly";

export interface CategoryInfo {
  /** Divar's own name for the category. */
  label: string;
  /** Short tab label. */
  short: string;
  priceModel: PriceModel;
  /** Homes (rooms matter) vs offices / shops / land. */
  residential: boolean;
  /** Property types inside the category (Divar's sub-categories). */
  types: string[];
  /** Example query shown when the category has no results yet. */
  example: string;
}

export const CATEGORIES: Record<CategoryKey, CategoryInfo> = {
  "residential-rent": {
    label: "اجاره مسکونی",
    short: "اجاره مسکونی",
    priceModel: "rent",
    residential: true,
    types: ["آپارتمان", "خانه و ویلا"],
    example: "دوخوابه وکیل‌آباد ۵۰۰ رهن",
  },
  "residential-sale": {
    label: "فروش مسکونی",
    short: "خرید مسکونی",
    priceModel: "sale",
    residential: true,
    types: ["آپارتمان", "خانه و ویلا", "زمین و کلنگی"],
    example: "خرید آپارتمان دوخوابه تا ۵ میلیارد",
  },
  "commercial-rent": {
    label: "اجاره اداری و تجاری",
    short: "اجاره اداری و تجاری",
    priceModel: "rent",
    residential: false,
    types: ["دفتر کار، اتاق اداری و مطب", "مغازه و غرفه", "صنعتی، کشاورزی و تجاری"],
    example: "مغازه ۳۰ متری برای اجاره، رهن ۲۰۰",
  },
  "commercial-sale": {
    label: "فروش اداری و تجاری",
    short: "خرید اداری و تجاری",
    priceModel: "sale",
    residential: false,
    types: ["دفتر کار، اتاق اداری و مطب", "مغازه و غرفه", "صنعتی، کشاورزی و تجاری"],
    example: "خرید دفتر کار اداری تا ۸ میلیارد",
  },
  "short-term": {
    label: "اجاره کوتاه‌مدت",
    short: "اجاره روزانه",
    priceModel: "nightly",
    residential: true,
    types: ["آپارتمان و سوئیت", "ویلا و باغ", "دفتر کار و فضای آموزشی"],
    example: "سوئیت مبله روزانه، شبی ۲ تومن",
  },
  projects: {
    label: "پروژه‌های ساخت و ساز",
    short: "پیش‌فروش و مشارکت",
    priceModel: "sale",
    residential: true,
    types: ["پیش‌فروش", "مشارکت در ساخت"],
    example: "پیش‌فروش آپارتمان تا ۳ میلیارد",
  },
};

/** Legacy sample listings carry no category: they are all residential rentals. */
export const DEFAULT_CATEGORY: CategoryKey = "residential-rent";

export const categoryOf = (l: Pick<Listing, "category">): CategoryKey => l.category ?? DEFAULT_CATEGORY;
export const priceModelOf = (key: CategoryKey | null | undefined): PriceModel => CATEGORIES[key ?? DEFAULT_CATEGORY].priceModel;
export const isCategoryKey = (v: unknown): v is CategoryKey => (CATEGORY_KEYS as readonly unknown[]).includes(v);

/**
 * The one number listings of a category are compared by: full-rahn equivalent for rentals,
 * total price for sales, price per night for short stays. Toman.
 */
export function comparablePrice(l: Pick<Listing, "category" | "deposit" | "monthlyRent" | "price" | "nightlyPrice">): number {
  const model = priceModelOf(categoryOf(l));
  if (model === "sale") return l.price ?? 0;
  if (model === "nightly") return l.nightlyPrice ?? 0;
  return toFullDeposit(l);
}

/** Comparable price per m² (the fair "apples to apples" unit price inside a category). */
export const unitPrice = (l: Parameters<typeof comparablePrice>[0] & { areaM2: number }) =>
  Math.round(comparablePrice(l) / Math.max(1, l.areaM2));

/** How the comparable price is named in the UI. */
export const PRICE_LABEL: Record<PriceModel, { price: string; perM2: string }> = {
  rent: { price: "معادل رهن کامل", perM2: "هر متر (معادل رهن کامل)" },
  sale: { price: "قیمت کل", perM2: "قیمت هر متر" },
  nightly: { price: "هر شب", perM2: "هر شب، هر متر" },
};

// ---------- detection in free text (rule parser) ----------

const PROJECT = /پیش ?فروش|پیش ?خرید|مشارکت در ساخت|پروژه|ساخت و ساز|سازنده/;
const SHORT_TERM = /روزانه|کوتاه ?مدت|شبانه|شبی(?![؀-ۿ])|هر شب|\d+ ?شب|چند شب|یک شب|آخر ?هفته|تعطیلات|اقامتگاه|مسافر/;
// "انبار" but not the "انباری" amenity
const COMMERCIAL = /مغازه|فروشگاه|دفتر|اداری|تجاری|مطب|غرفه|سوله|کارگاه|انبار(?!ی)|فضای کار|کافه|رستوران|صنعتی|کشاورزی|باغ ?تالار|کلینیک|آموزشگاه/;
const SALE = /خرید|بخرم|می ?خرم|فروشی|فروش(?!گاه)|خریدار|سند|قولنامه|قسطی|اقساطی/;
const RENT = /رهن|اجاره|ودیعه|پول پیش|کرایه|ماهی|ماهانه/;

/** Category named or implied in a query; null when nothing points to one (search then uses the default). */
export function detectCategory(query: string): CategoryKey | null {
  const text = normalizeFa(query);
  if (PROJECT.test(text)) return "projects";
  if (SHORT_TERM.test(text)) return "short-term";
  const sale = SALE.test(text) && !RENT.test(text);
  if (COMMERCIAL.test(text)) return sale ? "commercial-sale" : "commercial-rent";
  if (sale) return "residential-sale";
  return null;
}
