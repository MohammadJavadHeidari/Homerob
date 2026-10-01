// Text rules shared by the Divar importers (scripts/import-divar.ts for browser exports,
// scripts/import-divar-crawl.ts for scripts/divar_crawler.py output). Pure: nothing here reads files.
// A value the ad doesn't state stays undefined — never guessed.

import { toEnDigits } from "../persian";
import { normalizeFa } from "../text";

export const num = (s: string) => Number(toEnDigits(s).replace(/[^\d.]/g, ""));

/** "۱,۰۰۰,۰۰۰,۰۰۰ تومان" / "۶۸۰ میلیون" / "۱ میلیارد" → Toman. */
export function money(s: string): number {
  const t = toEnDigits(s).replace(/[,٬]/g, "");
  const n = Number(t.match(/[\d.]+/)?.[0] ?? NaN);
  if (/میلیارد/.test(t)) return n * 1e9;
  if (/میلیون/.test(t)) return n * 1e6;
  return n;
}

export const WORD_NUM: Record<string, number> = { یک: 1, دو: 2, سه: 3, چهار: 4, پنج: 5 };
export const ORDINAL: Record<string, number> = { اول: 1, دوم: 2, سوم: 3, چهارم: 4, پنجم: 5, ششم: 6, هفتم: 7, هشتم: 8 };

/** Bedrooms stated in free text: "دوخوابه", "۳ خواب", "یک اتاق خواب", "یک خابه", "سوئیت". */
export function roomsFromText(t: string): number | undefined {
  const m = t.match(/(\d|یک|دو|سه|چهار|پنج)\s*(?:اتاق\s*)?(?:خوابه|خواب|خابه|خاب)/);
  if (m) return WORD_NUM[m[1]] ?? Number(m[1]);
  if (/سوئیت|سوییت|سوعیت|استودیو/.test(t)) return 0;
  return undefined;
}

/** Floor stated in free text: "همکف", "طبقه ۲", "طبقه چهارم". */
export function floorFromText(t: string): number | undefined {
  if (/همکف/.test(t)) return 0;
  // "طبقه ۲", not the area in "دو طبقه ۱۲۵ متری"
  const m = t.match(/طبقه\s*(\d{1,2})(?!\d|\s*متر)/) ?? t.match(/طبقه\s*(اول|دوم|سوم|چهارم|پنجم|ششم|هفتم|هشتم)/);
  if (m) return ORDINAL[m[1]] ?? Number(m[1]);
  return undefined;
}

/** Built area in free text: "۱۸۰ متر زیر بنا" / "۲۴۰ متر بنا" first, else the first "N متر". */
export function areaFromText(t: string): number | undefined {
  const built = t.match(/(\d+)\s*متر\s*(?:زیر\s*)?بنا/);
  if (built) return Number(built[1]);
  const any = t.match(/(\d+)\s*متر(?!\s*(?:حیاط|زمین|تجاری))/);
  return any ? Number(any[1]) : undefined;
}

export const RELATIVE: [RegExp, (n: number) => number][] = [
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

/** "۳ هفته پیش در …" → approximate ISO date, relative to the capture time. */
export function postedAtRelative(line: string, captured: Date): string | undefined {
  const t = normalizeFa(line);
  if (!/پیش|دیروز|پریروز/.test(t)) return undefined;
  for (const [re, hours] of RELATIVE) {
    const m = t.match(re);
    if (m) return new Date(captured.getTime() - hours(Number(m[1] ?? 1)) * 3600e3).toISOString();
  }
  return undefined;
}

export const NOT_RESIDENTIAL =
  /مغازه|کافه|رستوران|سوله|کارگاه|انبار(?!ی)|غرفه|دفتر\s*کار|دفترکار|تجاری|واگذاری|نمایندگی|سرقفلی|اداری(?!\s*و\s*مسکونی)|صنعتی|باغ ویلا/;

/** Amenities worth a tag, matched in title + description (never when negated). */
export const TAGS: [string, RegExp][] = [
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
export function stated(t: string, word: string): boolean | undefined {
  if (new RegExp(`${word}\\s*(?:ندارد|نداره)|(?:بدون|فاقد)\\s*${word}`).test(t)) return false;
  return new RegExp(word).test(t) ? true : undefined;
}

/** "۵ مهر ۱۴۰۵، ۲۱:۰۱" (Divar's "انتشار آگهی") → ISO, via Intl's Persian calendar. */
export function jalaliToIso(line: string): string | undefined {
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
