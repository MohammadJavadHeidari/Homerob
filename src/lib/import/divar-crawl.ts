// Cleans one ad written by scripts/divar_crawler.py (schema "homerob-divar-crawl/1") into a Listing.
// Pure: scripts/import-divar-crawl.ts does the file reading and merging. Same rules as the browser-export
// importer (src/lib/import/divar-text.ts). Four categories: residential / commercial × rent / sale. A value
// the ad doesn't state stays unset; agency / seller names and phone numbers are never copied.

import type { CategoryKey } from "../categories";
import { toEnDigits } from "../persian";
import { canonicalCity, canonicalNeighborhood, findNeighborhoods } from "../places";
import { normalizeFa } from "../text";
import type { Listing } from "../types";
import type { DistrictSighting } from "./auto-hoods";
import {
  NOT_RESIDENTIAL,
  TAGS,
  WORD_NUM,
  areaFromText,
  floorFromText,
  jalaliToIso,
  money,
  num,
  postedAtRelative,
  roomsFromText,
  stated,
} from "./divar-text";

/** One line of data/raw/divar-crawl.json(l). Mirrors parse_post() in scripts/divar_crawler.py. */
export interface CrawledAd {
  schema?: string;
  token: string;
  url?: string;
  crawled_at: string;
  city_id?: string;
  category?: string;
  title: string;
  subtitle?: string;
  /** «انتشار آگهی: ۳۰ شهریور ۱۴۰۵، ۱۷:۲۱» (crawler ≥ 2026-10-01; older crawls have it in `description`). */
  published?: string;
  city?: string;
  district?: string;
  description?: string;
  fields?: Record<string, string>;
  features?: { title: string; available?: boolean }[];
  convertible?: boolean;
  lat?: number | null;
  lng?: number | null;
  location_exact?: boolean | null;
  images?: string[];
  breadcrumb?: string[];
  card?: { title?: string; top?: string; middle?: string; bottom?: string; image?: string; district?: string; city?: string };
  meta?: Record<string, string | number | boolean>;
  rows?: string[][];
}

/** A skip names its reason; an unknown district also carries the place (for auto-registering it). */
export type CrawlResult = { listing: Listing } | { skip: string; place?: DistrictSighting };

/** Divar city ids (scripts/divar_crawler.py CITY_IDS) → Persian name, when the ad lacks one. */
const CITY_BY_ID: Record<string, string> = {
  "1": "تهران", "2": "کرج", "3": "مشهد", "4": "اصفهان", "5": "تبریز", "6": "شیراز", "7": "اهواز", "8": "قم",
};

/** Divar's category tree (webengage cat_2, else the slug the crawler searched) → Homerob category. */
const CATEGORY_OF: Record<string, CategoryKey> = {
  "residential-rent": "residential-rent",
  "residential-sell": "residential-sale",
  "commercial-rent": "commercial-rent",
  "commercial-sell": "commercial-sale",
};

/** Area a unit of each kind can plausibly have (m²): a room / storage below, a typo or the plot above. */
const AREA_RANGE: Record<CategoryKey, [number, number]> = {
  "residential-rent": [15, 1000],
  "residential-sale": [15, 50000], // land / old houses (زمین و کلنگی) can be big
  "commercial-rent": [5, 50000], // a kiosk (غرفه) is small, a warehouse big
  "commercial-sale": [5, 50000],
  "short-term": [15, 5000],
  projects: [15, 50000],
};

/** Divar sub-category slugs that are not homes (meta.category / breadcrumb). */
const COMMERCIAL_SLUG = /office|shop|store|industr|commercial|business|plot|land/;
const DESCRIPTION_MAX = 600;
/** The ad's location line: «۱ ساعت پیش در مشهد، الهیه، خ …». */
const WHEN_WHERE = /(?:پیش|دیروز|پریروز|لحظاتی|دقایقی)\s+در\s+\S/;

/** First field whose label matches (Divar's labels vary: «ودیعه», «ودیعه (رهن)», «اجارهٔ ماهانه», «اجاره»). */
const field = (f: Record<string, string>, re: RegExp) => Object.entries(f).find(([k]) => re.test(normalizeFa(k)))?.[1];

/** Rahn / ejare of a rental, from the page rows or (convertible ads: slider only) the search card. */
function rentPrice(
  f: Record<string, string>,
  card: NonNullable<CrawledAd["card"]>,
): { deposit: number; monthlyRent: number } | { skip: string } {
  // «ودیعه», «اجارهٔ ماهانه» — not the «ودیعه و اجاره: غیر قابل تبدیل» row
  const depositText = field(f, /^(?:ودیعه|رهن)(?!\s*و\s*اجاره)/) ?? (/ودیعه|رهن/.test(card.top ?? "") ? card.top! : undefined);
  const rentText = field(f, /^اجاره/) ?? (/اجاره/.test(card.middle ?? "") ? card.middle! : "");
  if (!depositText) return { skip: "no deposit (nightly / negotiable)" };
  // «ودیعه: توافقی» on the page can read «ودیعه: رایگان» on the card (no deposit, rent only).
  const free = (t?: string) => /رایگان|مجانی/.test(t ?? "");
  const deposit = free(depositText) || free(card.top) ? 0 : /\d|[۰-۹]/.test(depositText) ? money(depositText) : NaN;
  if (!Number.isFinite(deposit)) return { skip: "deposit not a number (توافقی…)" };
  const listedRent = /رهن کامل|مجانی|رایگان/.test(rentText) || !rentText ? 0 : money(rentText) || 0;
  // Divar makes sellers type some rent; full-rahn ads carry a symbolic ۱۰–۱۰۰ هزار. Next to a real deposit
  // that is full rahn, not rent (same rule as the export importer).
  const monthlyRent = listedRent < 5e5 && deposit >= 50e6 ? 0 : listedRent;

  return { deposit, monthlyRent };
}

export function crawledToListing(ad: CrawledAd): CrawlResult {
  const crawled = new Date(ad.crawled_at);
  const f = ad.fields ?? {};
  const card = ad.card ?? {};
  const title = (ad.title || card.title || "").replace(/\s+/g, " ").trim();
  // Divar's date rows («انتشار آگهی: …», «آخرین نردبان: …») landed in `description` on the first crawl.
  const descLines = (ad.description ?? "").split("\n");
  const isDateLine = (l: string) => /^(?:انتشار آگهی|آخرین نردبان)/.test(l.trim());
  const published = ad.published || descLines.filter(isDateLine).join("\n");
  const rawDescription = descLines.filter((l) => !isDateLine(l)).join("\n");
  const text = normalizeFa(`${title} ${rawDescription}`);

  const divarCategory = String(ad.meta?.cat_2 || ad.category || "residential-rent");
  const category = CATEGORY_OF[divarCategory];
  if (!category) return { skip: `category ${divarCategory} (not imported)` };
  const isRent = category.endsWith("-rent");
  const residential = category.startsWith("residential");

  if (residential) {
    const slug = `${ad.meta?.category ?? ""} ${ad.meta?.cat_3 ?? ""} ${(ad.breadcrumb ?? []).join(" ")}`;
    const residentialSlug = /apartment|house|villa|residential|plot|old|آپارتمان|خانه|مسکونی|کلنگی/.test(slug);
    if (COMMERCIAL_SLUG.test(slug) && !residentialSlug) return { skip: "commercial" };
    if (!residentialSlug && NOT_RESIDENTIAL.test(text)) return { skip: "commercial" };
  }
  // Sellers sometimes post a sale in the rent category («… باغ و ویلا فروشی»).
  const t = normalizeFa(title);
  if (isRent && /(?:^|\s)(?:فروش|فروشی)(?:\s|$)/.test(t) && !/رهن|اجاره|ودیعه/.test(t)) {
    return { skip: "sale ad in the rent category" };
  }

  // ---- price ----
  let deposit = 0;
  let monthlyRent = 0;
  let price: number | undefined;
  if (isRent) {
    const rent = rentPrice(f, card);
    if ("skip" in rent) return rent;
    ({ deposit, monthlyRent } = rent);
  } else {
    // «قیمت کل: ۴٬۵۰۰٬۰۰۰٬۰۰۰ تومان» on the page, the same number on the card's first line.
    const priceText = field(f, /^قیمت کل|^قیمت$/) ?? (/تومان/.test(card.top ?? "") ? card.top! : "");
    price = /\d|[۰-۹]/.test(priceText) ? money(priceText) : Number(ad.meta?.price) || NaN;
    if (!Number.isFinite(price) || !price) return { skip: "price not stated (توافقی…)" };
  }

  // ---- place ----
  // subtitle: "۲ ساعت پیش در مشهد، وکیل‌آباد، خ مدرس" (the text before "در" is time or agency).
  const where =
    ad.subtitle || ad.rows?.map((r) => r[1] ?? "").find((t) => WHEN_WHERE.test(t)) || card.bottom || "";
  const parts = (where.split(/\s+در\s+|^در\s+/).pop() ?? "").split("،").map((x) => x.trim()).filter(Boolean);
  const city =
    canonicalCity(ad.city ?? "") || canonicalCity(card.city ?? "") || (parts.length > 1 && canonicalCity(parts[0])) || CITY_BY_ID[ad.city_id ?? ""];
  if (!city) return { skip: "unknown city" };
  const district = ad.district || card.district || (parts.length > 1 ? parts[1] : (parts[0] ?? ""));
  // Divar's district first; else a registered neighborhood named in the ad ("پشت حاشیه وکیل آباد").
  const hood = canonicalNeighborhood(district, city) ?? findNeighborhoods(text, city)[0];
  if (!hood) {
    const place = { city, district, lat: ad.lat, lng: ad.lng, exact: ad.location_exact };
    return { skip: `neighborhood not registered (${city}، ${district || "?"})`, place };
  }

  // ---- unit ----
  const areaM2 = num(f["متراژ"] ?? "") || areaFromText(text) || num(f["متراژ زمین"] ?? "") || undefined;
  const [minArea, maxArea] = AREA_RANGE[category];
  if (!areaM2 || areaM2 < minArea || areaM2 > maxArea) return { skip: "no plausible area" };

  // Bedrooms only mean something for homes (an office's «اتاق» counts rooms of any kind).
  const roomsField = f["اتاق"];
  const rooms = !residential
    ? undefined
    : roomsField
    ? /بدون/.test(roomsField)
      ? 0
      : (WORD_NUM[roomsField.trim()] ?? (num(roomsField) || undefined))
    : roomsFromText(text);
  const floorField = toEnDigits(field(f, /^طبقه/) ?? "");
  const floorMatch = floorField.match(/(-?\d+|همکف|زیرهمکف)(?:\s*از\s*(\d+))?/);
  const floor = floorMatch
    ? floorMatch[1] === "همکف"
      ? 0
      : floorMatch[1] === "زیرهمکف"
        ? -1
        : Number(floorMatch[1])
    : floorFromText(text);
  const totalFloors = floorMatch?.[2]
    ? Number(floorMatch[2])
    : num(field(f, /تعداد کل طبقات/) ?? "") || undefined;

  const yearFa = Number(toEnDigits(new Intl.DateTimeFormat("fa-IR-u-ca-persian", { year: "numeric" }).format(crawled)));
  const builtField = f["ساخت"] ?? f["سال ساخت"] ?? "";
  const built = num(builtField);
  const buildingAge =
    built > 1300 && !/قبل/.test(builtField)
      ? Math.max(0, yearFa - built)
      : /نوساز|کلید\s*نخورده|صفر/.test(text)
        ? 0
        : undefined;

  // Feature row: "آسانسور" / "پارکینگ ندارد"; an item flagged unavailable without "ندارد" reads as "X ندارد".
  const featureText = normalizeFa(
    [
      ...(ad.features ?? []).map((x) => (x.available === false && !/ندارد/.test(x.title) ? `${x.title} ندارد` : x.title)),
      // rows like «مبله: هست», «استخر: دارد»
      ...Object.entries(f).filter(([, v]) => /^(?:هست|دارد|بله)$/.test(v.trim())).map(([k]) => k),
      text,
    ].join(" "),
  );

  // The crawler masks phone numbers as «[شماره حذف شد]»; drop the marker on the card.
  const description = rawDescription.replace(/\s*\[شماره حذف شد\]/g, "").trim();
  const listing: Listing = {
    id: `dv-${ad.token}`,
    source: "divar",
    // unset = residential-rent (the app's default; keeps older records unchanged)
    ...(category !== "residential-rent" ? { category } : {}),
    url: `https://divar.ir/v/${ad.token}`,
    title,
    city,
    neighborhood: hood,
    street: parts.filter((x) => x !== district && !canonicalCity(x) && !canonicalNeighborhood(x, city)).join("، "),
    deposit,
    monthlyRent,
    ...(price !== undefined ? { price } : {}),
    areaM2,
    rooms,
    floor,
    totalFloors,
    buildingAge,
    elevator: stated(featureText, "آسانسور"),
    parking: stated(featureText, "پارکینگ"),
    storage: stated(featureText, "انباری"),
    tags: TAGS.filter(([, re]) => re.test(featureText)).map(([tag]) => tag),
    // «ودیعه و اجاره: غیر قابل تبدیل» when stated, else the deposit ↔ rent slider
    convertible: isRent && (f["ودیعه و اجاره"] ? !/غیر/.test(f["ودیعه و اجاره"]) : !!ad.convertible),
    description: description.length > DESCRIPTION_MAX ? `${description.slice(0, DESCRIPTION_MAX).trimEnd()}…` : description,
    postedAt: jalaliToIso(published) ?? postedAtRelative(where, crawled) ?? postedAtRelative(card.bottom ?? "", crawled) ?? crawled.toISOString(),
    // the search card's photo; the page's own image list also holds Divar's map snapshot
    imageUrl: card.image || ad.images?.find((u) => !/mapimage/.test(u)) || undefined,
    ...(typeof ad.lat === "number" && typeof ad.lng === "number" ? { lat: ad.lat, lng: ad.lng } : {}),
  };
  return { listing };
}
