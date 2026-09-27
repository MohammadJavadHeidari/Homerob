// Imports real Divar rental ads from a browser table export (HTML) into src/data/divar.json.
// Run: npm run import:divar -- data/raw/<export>.html|.rtf [--captured 2026-09-27]
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
// --captured 2026-09-27 (noon) or 2026-09-27T22:00, Tehran time: the base for "۳ ساعت پیش".
const capturedAt = args.includes("--captured") ? capturedArg : new Date().toISOString().slice(0, 10);
const captured = new Date(`${capturedAt.includes("T") ? capturedAt : `${capturedAt}T12:00`}:00+03:30`);
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

/**
 * macOS TextEdit wraps a pasted export in RTF: non-ASCII as \uNNNN (UTF-16 units, negative when > 32767),
 * cp1252 bytes as \'hh, escaped braces/backslashes, and "\" + newline for line breaks.
 */
function unwrapRtf(rtf: string): string {
  const start = rtf.indexOf("<table");
  const body = rtf.slice(start >= 0 ? rtf.lastIndexOf("\n", start) + 1 : 0);
  const units: number[] = [];
  let out = "";
  const flush = () => {
    out += String.fromCharCode(...units);
    units.length = 0;
  };
  for (let i = 0; i < body.length; ) {
    const rest = body.slice(i, i + 12);
    const u = /^\\u(-?\d+) ?/.exec(rest);
    if (u) {
      const n = Number(u[1]);
      units.push(n < 0 ? n + 65536 : n);
      i += u[0].length;
      continue;
    }
    flush();
    const hex = /^\\'([0-9a-f]{2})/i.exec(rest);
    if (hex) {
      out += new TextDecoder("windows-1252").decode(Uint8Array.of(parseInt(hex[1], 16)));
      i += hex[0].length;
    } else if (/^\\uc\d ?/.test(rest)) {
      i += /^\\uc\d ?/.exec(rest)![0].length;
    } else if (/^\\[\\{}\n]/.test(rest)) {
      out += rest[1]; // escaped \ { } or a "\" line break
      i += 2;
    } else {
      if (!(rest[0] === "}" && i >= body.length - 3)) out += rest[0]; // skip the document's closing brace
      i++;
    }
  }
  flush();
  return out;
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
  // "طبقه ۲", not the area in "دو طبقه ۱۲۵ متری"
  const m = t.match(/طبقه\s*(\d{1,2})(?!\d|\s*متر)/) ?? t.match(/طبقه\s*(اول|دوم|سوم|چهارم|پنجم|ششم|هفتم|هشتم)/);
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
const raw = readFileSync(file, "utf8");
const tables = readTables(raw.startsWith("{\\rtf") ? unwrapRtf(raw) : raw);
const cardsTable = tables.find((t) => t[0]?.some((c) => /post-card__action URL/i.test(c.text)));
const pagesTable = tables.find((t) => t[0]?.some((c) => /^PAGE URL$/i.test(c.text)));
if (!cardsTable) {
  console.error("no search-result table found (expected a 'Kt-post-card__action URL' column)");
  process.exit(1);
}
const cardHead = cardsTable[0].map((c) => c.text);
const pageHead = pagesTable?.[0].map((c) => c.text) ?? [];
const iPageUrl = pageHead.findIndex((h) => /^PAGE URL$/i.test(h));
const pages = new Map((pagesTable ?? []).slice(1).map((r) => [tokenOf(r[iPageUrl]?.links[0] ?? r[iPageUrl]?.text ?? ""), r]));

// The extension names columns after Divar's CSS classes, and their order changes between exports, so
// cells are found by header name + content, never by position.
const GROUP_LABELS = ["متراژ", "متراژ ویلا", "ساخت", "اتاق"];
const ROW_LABELS = ["طبقه", "متراژ زمین", "ودیعه و اجاره", "قیمت هر متر", "نوع ملک", "کاربری", "هزینهٔ هر نفر اضافه"];
const FEATURE = /پارکینگ|انباری|بالکن|آسانسور/;
const WHEN_WHERE = /(?:پیش|دیروز|پریروز)\s+در\s|^در\s/;

/** "۵ مهر ۱۴۰۵، ۲۱:۰۱" (Divar's "انتشار آگهی") → ISO, via Intl's Persian calendar. */
function jalaliToIso(line: string): string | undefined {
  const MONTHS = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"];
  const m = toEnDigits(line).match(/(\d{1,2})\s+(\S+)\s+(\d{4})(?:،\s*(\d{1,2}):(\d{2}))?/);
  const month = m ? MONTHS.indexOf(m[2]) + 1 : 0;
  if (!m || !month) return undefined;
  const [day, year] = [Number(m[1]), Number(m[3])];
  const fmt = new Intl.DateTimeFormat("en-u-ca-persian-nu-latn", { year: "numeric", month: "numeric", day: "numeric", timeZone: "Asia/Tehran" });
  const guess = Date.UTC(year + 621, 2, 21) + ((month <= 6 ? (month - 1) * 31 : 186 + (month - 7) * 30) + day - 1) * 864e5;
  for (const off of [0, -1, 1, -2, 2]) {
    const t = guess + off * 864e5 + 12 * 3600e3;
    const p = Object.fromEntries(fmt.formatToParts(t).map((x) => [x.type, x.value]));
    if (Number(p.year) === year && Number(p.month) === month && Number(p.day) === day) {
      const [hh, mm] = m[4] ? [Number(m[4]), Number(m[5])] : [12, 0];
      const dayStart = new Date(t).toISOString().slice(0, 10);
      return new Date(`${dayStart}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00+03:30`).toISOString();
    }
  }
  return undefined;
}

/** Everything useful on an opened ad page (either export layout). */
function pageFields(r: Cell[] | undefined) {
  const f: Record<string, string> = {};
  const out = { f, features: "", location: "", description: "", district: "", city: "", category: "", published: "", lat: NaN, lng: NaN };
  if (!r) return out;
  const cells = r.map((c, i) => ({ h: pageHead[i] ?? "", t: val(c) })).filter((c) => c.t && c.t !== "clicked");
  const byHead = (re: RegExp) => cells.find((c) => re.test(c.h))?.t ?? "";

  // Group row (متراژ | ساخت | اتاق): labels and values in order. On apartment pages the extension puts the
  // feature row (آسانسور / پارکینگ ندارد / انباری) in the same value columns.
  const groupValues = cells.filter((c) => c.h === "Kt-group-row-item").map((c) => c.t);
  if (groupValues.some((t) => FEATURE.test(t))) out.features = groupValues.filter((t) => FEATURE.test(t)).join(" ");
  else {
    const labels = cells.filter((c) => c.h === "Title" && GROUP_LABELS.includes(c.t)).map((c) => c.t);
    labels.forEach((l, i) => groupValues[i] && (f[l.replace(" ویلا", "")] ??= groupValues[i]));
  }
  // Single rows (طبقه: ۴ از ۶, متراژ زمین: ۸۸ متر مربع, …).
  const rowLabels = cells.filter((c) => c.h === "Title" && ROW_LABELS.includes(c.t)).map((c) => c.t);
  const rowValues = cells.filter((c) => c.h === "Kt-unexpandable-row__value").map((c) => c.t);
  rowLabels.forEach((l, i) => rowValues[i] && (f[l] ??= rowValues[i]));
  // Divar renders the deposit ↔ rent slider only on convertible ads; the export sometimes drops the sentence.
  if (cells.some((c) => /این ملک قابل تبدیل است|برای تبدیل بکشید/.test(c.t))) f["تبدیل"] = "بله";

  // Structured data (JSON-LD columns) when the export has it.
  f["اتاق"] ??= byHead(/^Rooms$/);
  f["متراژ"] ??= byHead(/^Floor Size$/);
  out.lat = Number(byHead(/^Latitude$/)) || NaN;
  out.lng = Number(byHead(/^Longitude$/)) || NaN;
  out.district = byHead(/District Persian/);
  out.city = byHead(/City Persian/);
  out.category = `${byHead(/Accommodation Category/)} ${byHead(/^Breadcrumb$/)}`;
  out.published = cells.find((c) => /انتشار آگهی/.test(c.t))?.t ?? "";

  const texts = cells.filter((c) => /^(p_element|Description)$/.test(c.h)).map((c) => c.t);
  out.location = texts.find((t) => WHEN_WHERE.test(t)) ?? "";
  out.description = (texts.find((t) => !WHEN_WHERE.test(t) && !/^آگهی .* در دیوار|\|دیوار$/.test(t)) ?? "").replace(/\.\.\.$/, "…");
  for (const k of Object.keys(f)) if (!f[k]) delete f[k];
  return out;
}

// ---------- build listings ----------
const iTitle = cardHead.findIndex((h) => /^Title$/.test(h));
const iUrl = cardHead.findIndex((h) => /post-card__action URL/i.test(h));
const PRICE = /^(?:ودیعه|اجاره|رهن کامل|توافقی|از\s)|تومان|نفر/;
const RESIDENTIAL_TITLE = /خانه|خونه|منزل|ویلایی|آپارتمان|اپارتمان|سوئیت|سوییت/;

const imported: Listing[] = [];
const skipped: Record<string, string[]> = {};
const skip = (why: string, title: string) => (skipped[why] ??= []).push(title);
const verbose = args.includes("--verbose");

for (const row of cardsTable.slice(1)) {
  const url = row[iUrl]?.links[0] ?? `https://${val(row[iUrl])}`;
  const token = tokenOf(url);
  const title = val(row[iTitle]).replace(/\s+/g, " ");
  const descCells = row.map((c, i) => (cardHead[i] === "Description" ? val(c) : "")).filter(Boolean);
  const prices = descCells.filter((t) => PRICE.test(t));
  const cardWhere = descCells.find((t) => !PRICE.test(t) && /(?:^|\s)در\s/.test(t)) ?? "";
  const depositLine = prices.find((p) => p.startsWith("ودیعه"));
  if (!depositLine) {
    skip(prices.some((p) => /نفر|^از /.test(p)) ? "nightly rental" : "sale / no price", title);
    continue;
  }

  const page = pageFields(pages.get(token));
  const text = normalizeFa(`${title} ${page.description}`);
  const residential = /اجارهٔ (?:مسکونی|آپارتمان|خانه)/.test(page.category) || RESIDENTIAL_TITLE.test(normalizeFa(title));
  if (!residential && (NOT_RESIDENTIAL.test(text) || /صنعتی|سوله/.test(Object.values(page.f).join(" ")))) {
    skip("commercial", title);
    continue;
  }

  const deposit = money(depositLine);
  const rentLine = prices.find((p) => p.startsWith("اجاره")) ?? "";
  const listedRent = /رهن کامل/.test(prices.join(" ")) || !rentLine ? 0 : money(rentLine);
  // Divar makes sellers type some rent; "رهن کامل" ads carry a symbolic ۱۰–۱۰۰ هزار. Next to a real
  // deposit that is full rahn, not rent.
  const monthlyRent = listedRent < 5e5 && deposit >= 50e6 ? 0 : listedRent;

  // Location: structured district, else "۳ هفته پیش در مشهد، وکیل‌آباد، خ مدرس یکم" (page) or
  // "… در وکیل‌آباد" (card; the text before the last "در" may be an agency name).
  const where = page.location || cardWhere;
  const parts = (where.split(/\s+در\s+|^در\s+/).pop() ?? "").split("،").map((x) => x.trim()).filter(Boolean);
  const city = canonicalCity(page.city) || (parts.length > 1 && canonicalCity(parts[0])) || "مشهد";
  const district = page.district || (parts.length > 1 ? parts[1] : (parts[0] ?? ""));
  // Divar's district first; else a registered neighborhood named in the ad ("پشت حاشیه وکیل آباد").
  const hood = canonicalNeighborhood(district, city) ?? findNeighborhoods(text, city)[0];
  if (!hood) {
    skip(`neighborhood not registered (${district})`, title);
    continue;
  }

  const areaM2 = num(page.f["متراژ"] ?? "") || areaFromText(text) || num(page.f["متراژ زمین"] ?? "") || undefined;
  // < 15 m²: a single room or a storage unit; > 1000 m²: a typo or the whole plot, not the unit.
  if (!areaM2 || areaM2 < 15 || areaM2 > 1000) {
    skip("no plausible area in the ad", title);
    continue;
  }

  const WORDS: Record<string, number> = { یک: 1, دو: 2, سه: 3, چهار: 4, پنج: 5 };
  const roomsField = page.f["اتاق"];
  const rooms = roomsField
    ? /بدون/.test(roomsField)
      ? 0
      : (WORDS[roomsField] ?? (num(roomsField) || undefined))
    : roomsFromText(text);
  const floorField = page.f["طبقه"] ? toEnDigits(page.f["طبقه"]) : "";
  const floorMatch = floorField.match(/(\d+|همکف)(?:\s*از\s*(\d+))?/);
  const floor = floorMatch ? (floorMatch[1] === "همکف" ? 0 : Number(floorMatch[1])) : floorFromText(text);
  const totalFloors = floorMatch?.[2] ? Number(floorMatch[2]) : undefined;
  const builtField = page.f["ساخت"] ?? "";
  const built = num(builtField);
  const buildingAge =
    built > 1300 && !/قبل/.test(builtField)
      ? Math.max(0, capturedYearFa - built)
      : /نوساز|کلید\s*نخورده|صفر/.test(text)
        ? 0
        : undefined;

  const featureText = normalizeFa(`${page.features} ${text}`);
  const image = row.flatMap((c) => c.imgs).find((src) => /divarcdn\.com\/static\/photo\//.test(src));

  imported.push({
    id: `dv-${token}`,
    source: "divar",
    url: `https://divar.ir/v/${token}`,
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
    convertible: page.f["تبدیل"] === "بله",
    description: page.description,
    postedAt: jalaliToIso(page.published) ?? postedAt(cardWhere) ?? postedAt(where) ?? captured.toISOString(),
    imageUrl: image,
    ...(Number.isFinite(page.lat) && Number.isFinite(page.lng) ? { lat: page.lat, lng: page.lng } : {}),
  });
}

// ---------- write ----------
const existing: Listing[] = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : [];
const byId = new Map(existing.map((l) => [l.id, l]));
for (const l of imported) byId.set(l.id, JSON.parse(JSON.stringify(l)) as Listing); // drops undefined keys
const all = [...byId.values()].sort((a, b) => b.postedAt.localeCompare(a.postedAt));
writeFileSync(OUT, `${JSON.stringify(all, null, 2)}\n`);

console.log(`${cardsTable.length - 1} ads read, ${imported.length} imported → ${OUT} (${all.length} total)`);
for (const [why, titles] of Object.entries(skipped)) {
  console.log(`  skipped ${titles.length} × ${why}`);
  if (verbose) for (const t of titles) console.log(`      ${t}`);
}
