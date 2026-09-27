// Imports real Divar rental ads from a browser table export (HTML) into src/data/divar.json.
// Run: npm run import:divar -- data/raw/<export>.html [--captured 2026-09-27]
//
// The export is what the owner's scraping extension produces from a Divar search: one table of
// search-result cards (title, price lines, "در <district>", thumbnail, link) and, optionally, a
// second table of ad pages (location line, متراژ/ساخت/اتاق/طبقه, features, first lines of the
// description). Rows are joined on the ad token at the end of the URL.
//
// Only whole-unit residential rentals (ودیعه/اجاره) are kept: sales, nightly villa rentals and
// commercial units are skipped, and so are ads whose area or neighborhood can't be read. Nothing is
// invented: a value the ad doesn't state stays unset. Agency / seller names and phone numbers are
// never copied. Existing ads in src/data/divar.json are kept; re-imported ids are replaced.

import { existsSync, readFileSync, writeFileSync } from "node:fs";

import { toEnDigits } from "../src/lib/persian";
import { canonicalCity, canonicalNeighborhood, findNeighborhoods } from "../src/lib/places";
import { normalizeFa } from "../src/lib/text";
import type { Listing } from "../src/lib/types";

const OUT = "src/data/divar.json";

// ---------- args ----------
const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--"));
const capturedArg = args[args.indexOf("--captured") + 1];
if (!file) {
  console.error("usage: npm run import:divar -- <export.html> [--captured YYYY-MM-DD]");
  process.exit(1);
}
const captured = new Date(`${args.includes("--captured") ? capturedArg : new Date().toISOString().slice(0, 10)}T12:00:00+03:30`);
/** Solar Hijri year at capture time (for "ساخت ۱۳۹۴" → age). */
const capturedYearFa = Number(toEnDigits(new Intl.DateTimeFormat("fa-IR-u-ca-persian", { year: "numeric" }).format(captured)));

// ---------- tiny HTML table reader ----------
interface Cell {
  text: string;
  links: string[];
  imgs: string[];
}

const decode = (s: string) =>
  s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

function readTables(html: string): Cell[][][] {
  return [...html.matchAll(/<table[\s\S]*?<\/table>/g)].map(([table]) =>
    [...table.matchAll(/<tr[\s\S]*?<\/tr>/g)].map(([tr]) =>
      [...tr.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map(([, inner]) => ({
        text: decode(inner.replace(/<br\s*\/?>/g, "\n").replace(/<[^>]+>/g, "")).trim(),
        links: [...inner.matchAll(/href="([^"]+)"/g)].map((m) => decode(m[1])),
        imgs: [...inner.matchAll(/src="([^"]+)"/g)].map((m) => decode(m[1])),
      })),
    ),
  );
}

const EMPTY = "—";
const val = (c: Cell | undefined) => (c && c.text !== EMPTY ? c.text : "");
const tokenOf = (url: string) => url.replace(/\/+$/, "").split("/").pop() ?? "";

// ---------- parsing helpers ----------
const num = (s: string) => Number(toEnDigits(s).replace(/[^\d.]/g, ""));

/** "۱,۰۰۰,۰۰۰,۰۰۰ تومان" / "۶۸۰ میلیون" / "۱ میلیارد" → Toman. */
function money(s: string): number {
  const t = toEnDigits(s).replace(/[,٬]/g, "");
  const n = Number(t.match(/[\d.]+/)?.[0] ?? NaN);
  if (/میلیارد/.test(t)) return n * 1e9;
  if (/میلیون/.test(t)) return n * 1e6;
  return n;
}

const WORD_NUM: Record<string, number> = { یک: 1, دو: 2, سه: 3, چهار: 4, پنج: 5 };
const ORDINAL: Record<string, number> = { اول: 1, دوم: 2, سوم: 3, چهارم: 4, پنجم: 5, ششم: 6, هفتم: 7, هشتم: 8 };

/** Bedrooms stated in free text: "دوخوابه", "۳ خواب", "یک اتاق خواب", "یک خابه", "سوئیت". */
function roomsFromText(t: string): number | undefined {
  const m = t.match(/(\d|یک|دو|سه|چهار|پنج)\s*(?:اتاق\s*)?(?:خوابه|خواب|خابه|خاب)/);
  if (m) return WORD_NUM[m[1]] ?? Number(m[1]);
  if (/سوئیت|سوییت|سوعیت|استودیو/.test(t)) return 0;
  return undefined;
}

/** Floor stated in free text: "همکف", "طبقه ۲", "طبقه چهارم". */
function floorFromText(t: string): number | undefined {
  if (/همکف/.test(t)) return 0;
  const m = t.match(/طبقه\s*(\d+)/) ?? t.match(/طبقه\s*(اول|دوم|سوم|چهارم|پنجم|ششم|هفتم|هشتم)/);
  if (m) return ORDINAL[m[1]] ?? Number(m[1]);
  return undefined;
}

/** Built area in free text: "۱۸۰ متر زیر بنا" / "۲۴۰ متر بنا" first, else the first "N متر". */
function areaFromText(t: string): number | undefined {
  const built = t.match(/(\d+)\s*متر\s*(?:زیر\s*)?بنا/);
  if (built) return Number(built[1]);
  const any = t.match(/(\d+)\s*متر(?!\s*(?:حیاط|زمین|تجاری))/);
  return any ? Number(any[1]) : undefined;
}

const RELATIVE: [RegExp, (n: number) => number][] = [
  [/(\d+)\s*دقیقه/, (n) => n / 60],
  [/دقایقی|لحظاتی/, () => 0.2],
  [/(\d+)\s*ساعت/, (n) => n],
  [/پریروز/, () => 48],
  [/دیروز/, () => 24],
  [/(\d+)\s*روز/, (n) => n * 24],
  [/(\d+)\s*هفته/, (n) => n * 24 * 7],
  [/هفته/, () => 24 * 7],
  [/(\d+)\s*ماه/, (n) => n * 24 * 30],
  [/ماه/, () => 24 * 30],
  [/(\d+)\s*سال/, (n) => n * 24 * 365],
  [/سال/, () => 24 * 365],
];

/** "۳ هفته پیش در …" → approximate ISO date, relative to the capture date. */
function postedAt(line: string): string | undefined {
  const t = normalizeFa(line);
  if (!/پیش|دیروز|پریروز/.test(t)) return undefined;
  for (const [re, hours] of RELATIVE) {
    const m = t.match(re);
    if (m) return new Date(captured.getTime() - hours(Number(m[1] ?? 1)) * 3600e3).toISOString();
  }
  return undefined;
}

const NOT_RESIDENTIAL =
  /مغازه|کافه|رستوران|سوله|کارگاه|انبار(?!ی)|غرفه|دفتر\s*کار|دفترکار|تجاری|واگذاری|نمایندگی|سرقفلی|اداری(?!\s*و\s*مسکونی)|صنعتی|باغ ویلا/;

/** Amenities worth a tag, matched in title + description (never when negated). */
const TAGS: [string, RegExp][] = [
  ["بالکن", /بالکن(?!\s*ندارد)/],
  ["مبله", /مبله|مبلمان/],
  ["حیاط", /حیاط/],
  ["استخر", /استخر/],
  ["دوبلکس", /دوبلکس/],
  ["ویلایی", /ویلایی|ویلا|دربست/],
  ["راه جدا", /راه\s*جدا/],
  ["تک‌واحدی", /تک\s*واحد/],
  ["لابی", /لابی/],
  ["نزدیک قطار شهری", /مترو|قطار شهری/],
];

/** true = the ad says it has it, false = says it doesn't ("پارکینگ ندارد", "بدون آسانسور"), unset = silent. */
function stated(t: string, word: string): boolean | undefined {
  if (new RegExp(`${word}\\s*(?:ندارد|نداره)|(?:بدون|فاقد)\\s*${word}`).test(t)) return false;
  return new RegExp(word).test(t) ? true : undefined;
}

// ---------- read export ----------
const tables = readTables(readFileSync(file, "utf8"));
const cardsTable = tables.find((t) => t[0]?.some((c) => /post-card__action URL/i.test(c.text)));
const pagesTable = tables.find((t) => t[0]?.some((c) => /^PAGE URL$/i.test(c.text)));
if (!cardsTable) {
  console.error("no search-result table found (expected a 'Kt-post-card__action URL' column)");
  process.exit(1);
}
const cardHead = cardsTable[0].map((c) => c.text);
const pages = new Map((pagesTable ?? []).slice(1).map((r) => [tokenOf(r[1]?.links[0] ?? r[1]?.text ?? ""), r]));

/** Label → value pairs of an ad page row (group rows are label, label, value, value). */
function pageFields(r: Cell[] | undefined) {
  const f: Record<string, string> = {};
  if (!r) return { f, features: "", location: "", description: "" };
  const pairs: [number, number][] = [[4, 6], [5, 7], [24, 25], [26, 27], [35, 37], [36, 38]];
  for (const [l, v] of pairs) if (val(r[l]) && val(r[v])) f[val(r[l])] = val(r[v]);
  // Feature rows (پارکینگ / انباری / بالکن, "… ندارد") sit where a group row's values would be.
  const features = [6, 7, 25, 31].map((i) => val(r[i])).filter((t) => /پارکینگ|انباری|بالکن|آسانسور/.test(t)).join(" ");
  const convertible = r.some((c) => /این ملک قابل تبدیل است/.test(c.text));
  if (convertible) f["تبدیل"] = "بله";
  return { f, features, location: val(r[3]), description: val(r[17]).replace(/\.\.\.$/, "…") };
}

// ---------- build listings ----------
const col = (name: RegExp) => cardHead.findIndex((h) => name.test(h));
const iTitle = col(/^Title$/);
const iUrl = col(/post-card__action URL/i);
const iWhere = cardHead.findIndex((h, i) => h === "Description" && i > col(/red-text/i));
const priceCols = cardHead.map((h, i) => (h === "Description" && i < iWhere ? i : -1)).filter((i) => i >= 0);

const imported: Listing[] = [];
const skipped: Record<string, string[]> = {};
const skip = (why: string, title: string) => (skipped[why] ??= []).push(title);

for (const row of cardsTable.slice(1)) {
  const url = row[iUrl]?.links[0] ?? `https://${val(row[iUrl])}`;
  const token = tokenOf(url);
  const title = val(row[iTitle]).replace(/\s+/g, " ");
  const prices = priceCols.map((i) => val(row[i]));
  const depositLine = prices.find((p) => p.startsWith("ودیعه"));
  if (!depositLine) {
    skip(prices.some((p) => /نفر|از /.test(p)) ? "nightly rental" : "sale / no price", title);
    continue;
  }

  const page = pageFields(pages.get(token));
  const text = normalizeFa(`${title} ${page.description}`);
  if (NOT_RESIDENTIAL.test(text) || /صنعتی|سوله/.test(Object.values(page.f).join(" "))) {
    skip("commercial", title);
    continue;
  }

  const deposit = money(depositLine);
  const rentLine = prices.find((p) => p.startsWith("اجاره")) ?? "";
  const monthlyRent = /رهن کامل/.test(prices.join(" ")) || !rentLine ? 0 : money(rentLine);

  // Location: "۳ هفته پیش در مشهد، وکیل‌آباد، خ مدرس یکم" (page) or "… در وکیل‌آباد" (card).
  const where = page.location || val(row[iWhere]);
  const [, placePart = ""] = where.split(/\s+در\s+/);
  const parts = placePart.split("،").map((s) => s.trim()).filter(Boolean);
  const city = (parts.length > 1 && canonicalCity(parts[0])) || "مشهد";
  const district = parts.length > 1 ? parts[1] : parts[0] ?? "";
  // Divar's district first; else a registered neighborhood named in the ad ("پشت حاشیه وکیل آباد").
  const hood = canonicalNeighborhood(district, city) ?? findNeighborhoods(text, city)[0];
  if (!hood) {
    skip(`neighborhood not registered (${district})`, title);
    continue;
  }

  const areaM2 = num(page.f["متراژ"] ?? "") || areaFromText(text) || num(page.f["متراژ زمین"] ?? "") || undefined;
  if (!areaM2 || areaM2 < 15) {
    skip("no area in the ad", title);
    continue;
  }

  const roomsField = page.f["اتاق"];
  const rooms = roomsField ? (/بدون/.test(roomsField) ? 0 : num(roomsField)) : roomsFromText(text);
  const floorField = page.f["طبقه"] ? toEnDigits(page.f["طبقه"]) : "";
  const floorMatch = floorField.match(/(\d+|همکف)(?:\s*از\s*(\d+))?/);
  const floor = floorMatch ? (floorMatch[1] === "همکف" ? 0 : Number(floorMatch[1])) : floorFromText(text);
  const totalFloors = floorMatch?.[2] ? Number(floorMatch[2]) : undefined;
  const built = num(page.f["ساخت"] ?? "");
  const buildingAge = built > 1300 ? Math.max(0, capturedYearFa - built) : /نوساز|کلید\s*نخورده|صفر/.test(text) ? 0 : undefined;

  const featureText = normalizeFa(`${page.features} ${text}`);
  const image = row.flatMap((c) => c.imgs).find((src) => /divarcdn\.com\/static\/photo\//.test(src));

  imported.push({
    id: `dv-${token}`,
    source: "divar",
    url: `https://divar.ir/v/${token}`,
    title,
    city,
    neighborhood: hood,
    street: parts.slice(2).join("، "),
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
    convertible: page.f["تبدیل"] === "بله",
    description: page.description,
    postedAt: postedAt(where) ?? captured.toISOString(),
    imageUrl: image,
  });
}

// ---------- write ----------
const existing: Listing[] = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : [];
const byId = new Map(existing.map((l) => [l.id, l]));
for (const l of imported) byId.set(l.id, JSON.parse(JSON.stringify(l)) as Listing); // drops undefined keys
const all = [...byId.values()].sort((a, b) => b.postedAt.localeCompare(a.postedAt));
writeFileSync(OUT, `${JSON.stringify(all, null, 2)}\n`);

console.log(`${cardsTable.length - 1} ads read, ${imported.length} imported → ${OUT} (${all.length} total)`);
for (const [why, titles] of Object.entries(skipped)) console.log(`  skipped ${titles.length} × ${why}`);
