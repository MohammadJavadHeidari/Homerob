import { CATEGORIES, CATEGORY_KEYS, detectCategory, type CategoryKey } from "@/lib/categories";
import { toEnDigits } from "@/lib/persian";

import { EMPTY_DRAFT, validateDraft, type AdDraft, type DraftErrors } from "./ads";

/**
 * Agencies keep their «فایل‌ها» (property files) in Excel. They upload a CSV export or paste cells copied from
 * Excel (tab-separated); one row = one property. Columns are found by header name, Persian or English, in any
 * order. Pure and tested.
 */

/** Template header, in the order the downloadable sample file uses. */
export const TEMPLATE_COLUMNS = [
  "عنوان",
  "دسته",
  "شهر",
  "محله",
  "آدرس",
  "متراژ",
  "اتاق",
  "طبقه",
  "سن بنا",
  "رهن",
  "اجاره",
  "قیمت",
  "آسانسور",
  "پارکینگ",
  "انباری",
  "ویژگی‌ها",
  "توضیحات",
] as const;

type Column = (typeof TEMPLATE_COLUMNS)[number];

const ALIASES: Record<Column, string[]> = {
  عنوان: ["عنوان", "title", "نام فایل"],
  دسته: ["دسته", "دسته بندی", "نوع آگهی", "category", "نوع معامله"],
  شهر: ["شهر", "city"],
  محله: ["محله", "منطقه", "neighborhood", "district"],
  آدرس: ["آدرس", "خیابان", "street", "address"],
  متراژ: ["متراژ", "متر", "area", "زیربنا"],
  اتاق: ["اتاق", "خواب", "تعداد خواب", "rooms", "bedrooms"],
  طبقه: ["طبقه", "floor"],
  "سن بنا": ["سن بنا", "سن", "سال ساخت", "age"],
  رهن: ["رهن", "ودیعه", "deposit"],
  اجاره: ["اجاره", "اجاره ماهانه", "rent"],
  قیمت: ["قیمت", "قیمت کل", "price"],
  آسانسور: ["آسانسور", "elevator"],
  پارکینگ: ["پارکینگ", "parking"],
  انباری: ["انباری", "storage"],
  "ویژگی‌ها": ["ویژگی‌ها", "ویژگی ها", "امکانات", "tags", "features"],
  توضیحات: ["توضیحات", "شرح", "description"],
};

const norm = (s: string) =>
  toEnDigits(s)
    .replace(/[‌\s_‌-]+/g, " ")
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .trim()
    .toLowerCase();

/** RFC-4180-ish: commas or tabs, quoted cells with "" escapes, CRLF/LF. Picks the delimiter from the header. */
export function parseTable(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const firstLine = src.split(/\r?\n/, 1)[0] ?? "";
  // pasted Excel cells are tab-separated; a Persian-keyboard CSV may use «،»
  const delim = firstLine.includes("\t") ? "\t" : !firstLine.includes(",") && firstLine.includes("،") ? "،" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"' && cell === "") quoted = true;
    else if (c === delim) {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

/**
 * "۵۰۰ میلیون" / "1.2 میلیارد" / "500,000,000" / "۵۰۰" → Toman. A bare number below 100,000 is read as
 * millions (agencies write «۵۰۰» for ۵۰۰ میلیون), except rents below 1,000 read as millions too.
 */
export function parseMoneyFa(input: string): number | null {
  const s = toEnDigits(input).replace(/[٬,،\s]/g, "").replace(/٫/g, ".").replace(/تومان|تومن|ت$/g, "");
  if (!s) return null;
  const n = parseFloat(s.replace(/[^\d.]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return null;
  if (/میلیارد/.test(s)) return Math.round(n * 1e9);
  if (/میلیون|م$/.test(s)) return Math.round(n * 1e6);
  if (/هزار/.test(s)) return Math.round(n * 1e3);
  return n < 100_000 ? Math.round(n * 1e6) : Math.round(n);
}

const parseIntFa = (s: string): number | null => {
  const t = toEnDigits(s).trim();
  if (/همکف/.test(t)) return 0;
  if (/نوساز|کلید ?نخورده/.test(t)) return 0;
  if (/سوئیت|سوییت|استودیو/.test(t)) return 0;
  const m = t.match(/\d+(\.\d+)?/);
  return m ? Math.round(Number(m[0])) : null;
};

const yes = (s: string) => /^(بله|دارد|داره|هست|yes|y|true|1|✓|✔|\+)$/i.test(toEnDigits(s).trim());

function categoryFrom(cell: string, fallbackText: string): CategoryKey {
  const t = cell.trim();
  const exact = CATEGORY_KEYS.find((k) => CATEGORIES[k].label === t || CATEGORIES[k].short === t || k === t);
  if (exact) return exact;
  if (/فروش|خرید/.test(t)) return /اداری|تجاری|مغازه|دفتر/.test(t + fallbackText) ? "commercial-sale" : "residential-sale";
  if (/اجاره|رهن/.test(t)) return /اداری|تجاری|مغازه|دفتر/.test(t + fallbackText) ? "commercial-rent" : "residential-rent";
  if (/روزانه|کوتاه/.test(t)) return "short-term";
  return detectCategory(`${t} ${fallbackText}`) ?? "residential-rent";
}

export interface ImportedRow {
  /** 1-based row number in the file (header = 1). */
  line: number;
  draft: AdDraft;
  errors: DraftErrors;
}

export interface ImportResult {
  rows: ImportedRow[];
  /** Template columns found in the header. */
  found: Column[];
  /** Header cells we didn't recognise (ignored). */
  unknown: string[];
}

export function importTable(text: string, defaults: { city: string }): ImportResult {
  const [header = [], ...body] = parseTable(text);
  const index = new Map<Column, number>();
  const unknown: string[] = [];
  header.forEach((h, i) => {
    const n = norm(h);
    const col = TEMPLATE_COLUMNS.find((c) => ALIASES[c].some((a) => norm(a) === n));
    if (col && !index.has(col)) index.set(col, i);
    else if (h.trim()) unknown.push(h.trim());
  });
  const get = (r: string[], c: Column) => (index.has(c) ? (r[index.get(c)!] ?? "").trim() : "");

  const rows = body.map((r, i): ImportedRow => {
    const title = get(r, "عنوان");
    const description = get(r, "توضیحات");
    const category = categoryFrom(get(r, "دسته"), `${title} ${description}`);
    const model = CATEGORIES[category].priceModel;
    const price = parseMoneyFa(get(r, "قیمت"));
    const draft: AdDraft = {
      ...EMPTY_DRAFT,
      category,
      title,
      city: get(r, "شهر") || defaults.city,
      neighborhood: get(r, "محله"),
      street: get(r, "آدرس"),
      areaM2: parseIntFa(get(r, "متراژ")),
      rooms: parseIntFa(get(r, "اتاق")),
      floor: parseIntFa(get(r, "طبقه")),
      buildingAge: parseIntFa(get(r, "سن بنا")),
      deposit: parseMoneyFa(get(r, "رهن")),
      monthlyRent: parseMoneyFa(get(r, "اجاره")),
      price: model === "sale" ? price : null,
      nightlyPrice: model === "nightly" ? price : null,
      elevator: yes(get(r, "آسانسور")),
      parking: yes(get(r, "پارکینگ")),
      storage: yes(get(r, "انباری")),
      tags: get(r, "ویژگی‌ها")
        .split(/[،,؛;|/]+/)
        .map((t) => t.trim())
        .filter(Boolean),
      description,
      images: [],
    };
    return { line: i + 2, draft, errors: validateDraft(draft) };
  });
  return { rows, found: [...index.keys()], unknown };
}

/** The downloadable sample file: header only (no invented rows, real data only). */
export function templateCsv(): string {
  return `﻿${TEMPLATE_COLUMNS.join(",")}\n`;
}
