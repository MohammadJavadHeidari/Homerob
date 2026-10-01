// Cleans one ad written by scripts/divar_crawler.py (schema "homerob-divar-crawl/1") into a Listing.
// Pure: scripts/import-divar-crawl.ts does the file reading and merging. Same rules as the browser-export
// importer (src/lib/import/divar-text.ts): only whole-unit residential rentals; a value the ad doesn't
// state stays unset; agency / seller names and phone numbers are never copied.

import { toEnDigits } from "../persian";
import { canonicalCity, canonicalNeighborhood, findNeighborhoods } from "../places";
import { normalizeFa } from "../text";
import type { Listing } from "../types";
import {
  NOT_RESIDENTIAL,
  TAGS,
  WORD_NUM,
  areaFromText,
  floorFromText,
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

export type CrawlResult = { listing: Listing } | { skip: string };

/** Divar city ids (scripts/divar_crawler.py CITY_IDS) → Persian name, when the ad lacks one. */
const CITY_BY_ID: Record<string, string> = {
  "1": "تهران", "2": "کرج", "3": "مشهد", "4": "اصفهان", "5": "تبریز", "6": "شیراز", "7": "اهواز", "8": "قم",
};

/** Divar sub-category slugs that are not homes (meta.category / breadcrumb). */
const COMMERCIAL_SLUG = /office|shop|store|industr|commercial|business|plot|land/;
const DESCRIPTION_MAX = 600;

/** First field whose label matches (Divar's labels vary: «ودیعه», «ودیعه (رهن)», «اجارهٔ ماهانه», «اجاره»). */
const field = (f: Record<string, string>, re: RegExp) => Object.entries(f).find(([k]) => re.test(normalizeFa(k)))?.[1];

export function crawledToListing(ad: CrawledAd): CrawlResult {
  const crawled = new Date(ad.crawled_at);
  const f = ad.fields ?? {};
  const card = ad.card ?? {};
  const title = (ad.title || card.title || "").replace(/\s+/g, " ").trim();
  const text = normalizeFa(`${title} ${ad.description ?? ""}`);

  if (ad.category && ad.category !== "residential-rent") return { skip: `category ${ad.category} (not imported yet)` };
  const slug = `${ad.meta?.category ?? ""} ${(ad.breadcrumb ?? []).join(" ")}`;
  const residentialSlug = /apartment|house|villa|residential|آپارتمان|خانه|مسکونی/.test(slug);
  if (COMMERCIAL_SLUG.test(slug) && !residentialSlug) return { skip: "commercial" };
  if (!residentialSlug && NOT_RESIDENTIAL.test(text)) return { skip: "commercial" };

  // ---- price ----
  const depositText = field(f, /ودیعه|رهن/) ?? (/ودیعه|رهن/.test(card.top ?? "") ? card.top! : undefined);
  const rentText = field(f, /اجاره/) ?? (/اجاره/.test(card.middle ?? "") ? card.middle! : "");
  if (!depositText) return { skip: "no deposit (sale / nightly / negotiable)" };
  const deposit = /رهن کامل/.test(depositText) && !/\d|[۰-۹]/.test(depositText) ? NaN : money(depositText);
  if (!Number.isFinite(deposit)) return { skip: "deposit not a number (توافقی…)" };
  const listedRent = /رهن کامل|مجانی|رایگان/.test(rentText) || !rentText ? 0 : money(rentText) || 0;
  // Divar makes sellers type some rent; full-rahn ads carry a symbolic ۱۰–۱۰۰ هزار. Next to a real deposit
  // that is full rahn, not rent (same rule as the export importer).
  const monthlyRent = listedRent < 5e5 && deposit >= 50e6 ? 0 : listedRent;

  // ---- place ----
  // subtitle: "۲ ساعت پیش در مشهد، وکیل‌آباد، خ مدرس" (the text before "در" is time or agency).
  const where = ad.subtitle || card.bottom || "";
  const parts = (where.split(/\s+در\s+|^در\s+/).pop() ?? "").split("،").map((x) => x.trim()).filter(Boolean);
  const city =
    canonicalCity(ad.city ?? "") || canonicalCity(card.city ?? "") || (parts.length > 1 && canonicalCity(parts[0])) || CITY_BY_ID[ad.city_id ?? ""];
  if (!city) return { skip: "unknown city" };
  const district = ad.district || card.district || (parts.length > 1 ? parts[1] : (parts[0] ?? ""));
  // Divar's district first; else a registered neighborhood named in the ad ("پشت حاشیه وکیل آباد").
  const hood = canonicalNeighborhood(district, city) ?? findNeighborhoods(text, city)[0];
  if (!hood) return { skip: `neighborhood not registered (${city}، ${district || "?"})` };

  // ---- unit ----
  const areaM2 = num(f["متراژ"] ?? "") || areaFromText(text) || undefined;
  // < 15 m²: a single room or a storage unit; > 1000 m²: a typo or the whole plot, not the unit.
  if (!areaM2 || areaM2 < 15 || areaM2 > 1000) return { skip: "no plausible area" };

  const roomsField = f["اتاق"];
  const rooms = roomsField
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
  const totalFloors = floorMatch?.[2] ? Number(floorMatch[2]) : undefined;

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
      text,
    ].join(" "),
  );

  // The crawler masks phone numbers as «[شماره حذف شد]»; drop the marker on the card.
  const description = (ad.description ?? "").replace(/\s*\[شماره حذف شد\]/g, "").trim();
  const listing: Listing = {
    id: `dv-${ad.token}`,
    source: "divar",
    url: `https://divar.ir/v/${ad.token}`,
    title,
    city,
    neighborhood: hood,
    street: parts.filter((x) => x !== district && !canonicalCity(x) && !canonicalNeighborhood(x, city)).join("، "),
    deposit,
    monthlyRent,
    areaM2,
    rooms,
    floor,
    totalFloors,
    buildingAge,
    elevator: stated(featureText, "آسانسور"),
    parking: stated(featureText, "پارکینگ"),
    storage: stated(featureText, "انباری"),
    tags: TAGS.filter(([, re]) => re.test(featureText)).map(([tag]) => tag),
    convertible: !!ad.convertible,
    description: description.length > DESCRIPTION_MAX ? `${description.slice(0, DESCRIPTION_MAX).trimEnd()}…` : description,
    postedAt: postedAtRelative(where, crawled) ?? postedAtRelative(card.bottom ?? "", crawled) ?? crawled.toISOString(),
    imageUrl: ad.images?.[0] || card.image || undefined,
    ...(typeof ad.lat === "number" && typeof ad.lng === "number" ? { lat: ad.lat, lng: ad.lng } : {}),
  };
  return { listing };
}
