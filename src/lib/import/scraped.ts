// Turns CSV rows exported by the Ultimate Web Scraper Chrome extension (Divar/Sheypoor pages) into
// `Listing`s. The extension's column names depend on the page, so fields are found by header name
// when it is obvious and otherwise by patterns in the row's text (e.g. «ودیعه: ۲۰۰٬۰۰۰٬۰۰۰ تومان»).
// Pure functions only; the CLI is scripts/import-scraped.ts.

import { findNeighborhoods } from "../neighborhoods";
import { toEnDigits } from "../persian";
import type { Listing, ListingSource, Neighborhood } from "../types";

/** Current Persian (Shamsi) year, for «سال ساخت» → building age. */
const SHAMSI_YEAR_NOW = 1405;

/** Fields we fill with a neutral default when the scraped page doesn't show them. */
export type GuessedField = "floor" | "buildingAge" | "areaM2" | "rooms" | "postedAt";

export interface ImportedListing {
  listing: Listing;
  guessed: GuessedField[];
}

export type SkipReason = "no-price" | "no-neighborhood" | "no-title" | "not-a-listing";

export type RowResult = { ok: true; value: ImportedListing } | { ok: false; reason: SkipReason };

// ---------- CSV ----------

/** RFC 4180 CSV (quoted fields, "" escapes, CRLF/LF, optional BOM) → rows of cells. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((c) => c.trim())) rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim())) rows.push(row);
  return rows;
}

/** CSV text → one record per data row, keyed by header. */
export function csvRecords(text: string): Record<string, string>[] {
  const [header, ...rows] = parseCsv(text);
  if (!header) return [];
  const keys = header.map((h, i) => h.trim() || `col${i + 1}`);
  return rows.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? "").trim()])));
}

// ---------- text helpers ----------

/** Normalize for matching: Latin digits, Persian ی/ک, ZWNJ → space, one space, no thousands separators. */
function norm(s: string): string {
  return toEnDigits(s)
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[‌‏‎]/g, " ")
    .replace(/(\d)[٬,](?=\d)/g, "$1")
    .replace(/٫/g, ".")
    .replace(/\s+/g, " ")
    .trim();
}

const WORD_NUMBERS: Record<string, number> = { یک: 1, دو: 2, سه: 3, چهار: 4, پنج: 5, شش: 6 };

/** «۲۰۰٬۰۰۰٬۰۰۰ تومان», «۱٫۲ میلیارد», «۵۰۰ میلیون» → Toman. «رایگان» → 0. «توافقی» / nothing → null. */
export function parseToman(raw: string): number | null {
  const s = norm(raw);
  if (/رایگان|مجانی/.test(s)) return 0;
  const m = s.match(/(\d+(?:\.\d+)?)\s*(میلیارد|میلیون|هزار)?/);
  if (!m) return null;
  const unit = { میلیارد: 1e9, میلیون: 1e6, هزار: 1e3 }[m[2] ?? ""] ?? 1;
  return Math.round(Number(m[1]) * unit);
}

/** Headers that name a field, e.g. «ودیعه», "deposit", "kt-post-card__title". */
const HEADER: Record<string, RegExp> = {
  title: /title|عنوان/i,
  description: /desc|توضیح/i,
  url: /url|link|href|لینک/i,
  image: /image|img|photo|عکس|تصویر/i,
  deposit: /deposit|ودیعه|رهن/i,
  rent: /rent|اجاره/i,
  area: /area|متراژ/i,
  rooms: /room|اتاق|خواب/i,
  year: /year|ساخت/i,
  floor: /floor|طبقه/i,
  street: /street|address|آدرس|خیابان/i,
  hood: /neighbo|محله|محدوده|district/i,
  time: /time|date|زمان|تاریخ/i,
};

function byHeader(rec: Record<string, string>, field: keyof typeof HEADER): string | undefined {
  for (const [k, v] of Object.entries(rec)) if (v && HEADER[field].test(k)) return v;
  return undefined;
}

/** A yes/no feature: header «آسانسور: دارد», or the word in the text without «ندارد»/«بدون». */
function hasFeature(rec: Record<string, string>, text: string, word: string): boolean {
  for (const [k, v] of Object.entries(rec)) {
    if (norm(k).includes(word)) return /دارد|true|yes|بله|✓|1/i.test(v) && !/ندارد|false|no\b|خیر/i.test(v);
  }
  if (new RegExp(`(بدون|فاقد)\\s*${word}|${word}\\s*(ندارد|نداره|ندارند)`).test(text)) return false;
  return text.includes(word);
}

/** «لحظاتی پیش», «۳ ساعت پیش», «دیروز», «۲ روز پیش», «هفته پیش», ISO dates → ISO string. */
export function parsePostedAt(raw: string, now: Date): string | null {
  if (!raw) return null;
  if (!Number.isNaN(Date.parse(raw)) && /\d{4}-\d{2}-\d{2}/.test(raw)) return new Date(raw).toISOString();
  const s = norm(raw);
  const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();
  const MIN = 60_000;
  const HOUR = 60 * MIN;
  const DAY = 24 * HOUR;
  if (/لحظاتی|دقایقی|همین الان/.test(s)) return ago(5 * MIN);
  if (/ربع/.test(s)) return ago(15 * MIN);
  if (/نیم ساعت/.test(s)) return ago(30 * MIN);
  if (/دیروز/.test(s)) return ago(DAY);
  if (/پریروز/.test(s)) return ago(2 * DAY);
  const m = s.match(/(\d+|یک|دو|سه|چهار|پنج|شش)?\s*(دقیقه|ساعت|روز|هفته|ماه)\s*(پیش|قبل)/);
  if (!m) return null;
  const n = m[1] ? (WORD_NUMBERS[m[1]] ?? Number(m[1])) : 1;
  const unit = { دقیقه: MIN, ساعت: HOUR, روز: DAY, هفته: 7 * DAY, ماه: 30 * DAY }[m[2]]!;
  return ago(n * unit);
}

/** Known tags the ranking/amenity code understands (see src/lib/amenities.ts). */
const TAGS: [tag: string, pattern: RegExp][] = [
  ["بالکن", /بالکن|تراس/],
  ["مبله", /مبله/],
  ["نزدیک قطار شهری", /مترو|قطار شهری/],
  ["حیاط اختصاصی", /حیاط/],
  ["لابی‌من", /لابی/],
  ["استخر و سونا", /استخر|سونا|جکوزی/],
  ["پکیج", /پکیج/],
  ["کولر گازی", /کولر گازی|اسپلیت/],
];

function sourceFromUrl(url: string): { source: ListingSource; token: string } | null {
  const divar = url.match(/divar\.ir\/v\/(?:[^/?#]*\/)?([A-Za-z0-9_-]{6,})/);
  if (divar) return { source: "divar", token: divar[1] };
  const sheypoor = url.match(/sheypoor\.com\/.*?(\d{6,})/);
  if (sheypoor) return { source: "sheypoor", token: sheypoor[1] };
  return null;
}

function hash(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}

const isUrl = (v: string) => /^https?:\/\//i.test(v);
const isImage = (v: string) => isUrl(v) && /divarcdn|sheypoor.*(img|image|photo)|\.(jpe?g|png|webp)(\?|$)/i.test(v);

export interface RowOptions {
  now: Date;
  /** Used when the row itself names no known neighborhood (e.g. file scraped from «سجاد» page). */
  fallbackNeighborhood?: Neighborhood | null;
  /** Used when the row has no Divar/Sheypoor link. */
  fallbackSource?: ListingSource;
}

/** One scraped row → a Listing (with the fields we had to guess), or why it was skipped. */
export function rowToListing(rec: Record<string, string>, opts: RowOptions): RowResult {
  const values = Object.values(rec).filter(Boolean);
  const text = norm(values.join(" | "));

  // Link, source, id
  const url = byHeader(rec, "url") && isUrl(byHeader(rec, "url")!) ? byHeader(rec, "url")! : values.find((v) => isUrl(v) && !isImage(v));
  const origin = url ? sourceFromUrl(url) : null;
  const source = origin?.source ?? opts.fallbackSource ?? "divar";

  // Title
  const title =
    byHeader(rec, "title") ??
    values.find((v) => !isUrl(v) && /[آ-ی]/.test(v) && v.length >= 8 && v.length <= 120 && !/تومان|ودیعه|اجاره\s*[:：]/.test(v));
  if (!title) return { ok: false, reason: values.length ? "no-title" : "not-a-listing" };

  // Prices: header first, then «ودیعه: …» / «اجاره: …» in the text
  const MONEY = String.raw`[\s:：\-–]*(\d+(?:\.\d+)?\s*(?:میلیارد|میلیون|هزار)?(?!\d|\s*متر)|رایگان|مجانی|توافقی)`;
  const depRaw = byHeader(rec, "deposit") ?? text.match(new RegExp(`(?:ودیعه|رهن)(?! و)${MONEY}`))?.[1];
  const rentRaw = byHeader(rec, "rent") ?? text.match(new RegExp(`اجاره(?:ه|ٔ|ی)?(?: ماهانه| ماهیانه)?${MONEY}`))?.[1];
  const fullRahn = /رهن کامل|اجاره ندارد/.test(text);
  let deposit = depRaw ? parseToman(depRaw) : null;
  let monthlyRent = rentRaw ? parseToman(rentRaw) : fullRahn ? 0 : null;
  if (deposit === null && monthlyRent !== null && monthlyRent > 0) deposit = 0; // «ودیعه» missing = none
  if (monthlyRent === null && deposit !== null && deposit > 0) monthlyRent = 0;
  if (deposit === null || monthlyRent === null || deposit + monthlyRent === 0) return { ok: false, reason: "no-price" };

  // Neighborhood
  const hoodText = [byHeader(rec, "hood"), title, text].filter(Boolean).join(" ");
  const neighborhood = findNeighborhoods(hoodText)[0] ?? opts.fallbackNeighborhood ?? null;
  if (!neighborhood) return { ok: false, reason: "no-neighborhood" };

  const guessed: GuessedField[] = [];
  const num = (raw: string | undefined) => (raw ? Number(norm(raw).match(/\d+/)?.[0] ?? NaN) : NaN);

  // Area
  let areaM2 = num(byHeader(rec, "area"));
  if (!(areaM2 > 10)) areaM2 = Number(text.match(/(\d{2,4})\s*(?:متر|متری|m2|㎡)/)?.[1] ?? NaN);
  if (!(areaM2 > 10)) {
    areaM2 = 80;
    guessed.push("areaM2");
  }

  // Rooms
  let rooms = num(byHeader(rec, "rooms"));
  if (Number.isNaN(rooms)) {
    const m = text.match(/(\d|یک|دو|سه|چهار|پنج)\s*(?:خوابه|خواب|اتاق)/);
    rooms = m ? (WORD_NUMBERS[m[1]] ?? Number(m[1])) : /سوئیت|بدون اتاق|استودیو/.test(text) ? 0 : NaN;
  }
  if (Number.isNaN(rooms)) {
    rooms = areaM2 < 60 ? 1 : areaM2 < 110 ? 2 : 3;
    guessed.push("rooms");
  }

  // Floor
  let floor = NaN;
  let totalFloors = NaN;
  const fm = norm(byHeader(rec, "floor") ?? "").match(/(\d+|همکف)(?:\s*از\s*(\d+))?/) ?? text.match(/طبقه\s*(\d+|همکف)(?:\s*از\s*(\d+))?/);
  if (fm) {
    floor = fm[1] === "همکف" ? 0 : Number(fm[1]);
    totalFloors = fm[2] ? Number(fm[2]) : floor;
  } else if (/همکف/.test(text)) floor = totalFloors = 0;
  if (Number.isNaN(floor)) {
    floor = 1;
    totalFloors = 1;
    guessed.push("floor");
  }
  totalFloors = Math.max(totalFloors, floor);

  // Building age from «سال ساخت ۱۳۹۸» / «قبل از ۱۳۷۰» / «نوساز»
  let buildingAge = NaN;
  const year = num(byHeader(rec, "year")) || Number(text.match(/(?:ساخت|قبل از)\s*(1[34]\d\d)/)?.[1] ?? NaN);
  if (year > 1300 && year <= SHAMSI_YEAR_NOW) buildingAge = SHAMSI_YEAR_NOW - year;
  else if (/نوساز|کلید نخورده/.test(text)) buildingAge = 0;
  else {
    const age = text.match(/(\d{1,2})\s*سال(?:ه)?\s*(?:ساخت|سن)/);
    if (age) buildingAge = Number(age[1]);
  }
  if (Number.isNaN(buildingAge)) {
    buildingAge = 10;
    guessed.push("buildingAge");
  }

  // Time
  let postedAt = parsePostedAt(byHeader(rec, "time") ?? "", opts.now);
  for (const v of values) postedAt ??= /پیش|قبل|دیروز/.test(v) ? parsePostedAt(v, opts.now) : null;
  if (!postedAt) {
    postedAt = opts.now.toISOString();
    guessed.push("postedAt");
  }

  const desc = byHeader(rec, "description");
  const description = desc && !/تومان|ودیعه/.test(desc) && desc.length > title.length ? desc : title;
  const street = byHeader(rec, "street") ?? "";
  const image = byHeader(rec, "image");
  const imageUrl = image && isUrl(image) ? image : values.find(isImage);

  const listing: Listing = {
    id: `${source === "divar" ? "dv" : "sp"}-${origin?.token ?? hash(title + deposit + monthlyRent)}`,
    source,
    title: title.trim(),
    neighborhood,
    street: street.trim(),
    deposit,
    monthlyRent,
    areaM2,
    rooms,
    floor,
    totalFloors,
    buildingAge,
    elevator: hasFeature(rec, text, "آسانسور"),
    parking: hasFeature(rec, text, "پارکینگ"),
    storage: hasFeature(rec, text, "انباری"),
    tags: TAGS.filter(([, re]) => re.test(text)).map(([tag]) => tag),
    convertible: /قابل تبدیل|قابل جابجایی/.test(text) && !/(غیر|غیرِ)\s*قابل تبدیل|تبدیل (نمی|ن)/.test(text),
    description: description.trim(),
    postedAt,
    ...(imageUrl ? { imageUrl } : {}),
    ...(url ? { url } : {}),
  };
  return { ok: true, value: { listing, guessed } };
}
