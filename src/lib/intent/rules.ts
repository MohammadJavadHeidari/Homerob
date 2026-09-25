import { AMENITIES, AMENITY_KEYS, type AmenityKey } from "@/lib/amenities";
import { findNeighborhoods } from "@/lib/neighborhoods";
import { normalizeFa } from "@/lib/text";

import { EMPTY_INTENT, type SearchIntent } from "./schema";

/**
 * Deterministic Persian query parser. Used as the `mock` AI provider and as the fallback
 * when the LLM call fails, so search always works.
 */
export function parseIntentWithRules(query: string): SearchIntent {
  const text = wordsToDigits(normalizeFa(query));
  const intent: SearchIntent = structuredClone(EMPTY_INTENT);

  parseMoney(text, intent);
  parseRooms(text, intent);
  parseArea(text, intent);
  parseAmenities(text, intent);
  intent.neighborhoods = findNeighborhoods(text);

  if (/غیر ?قابل تبدیل|فقط رهن کامل|مبلغ ثابت/.test(text)) intent.flexibleConversion = false;
  if (/همخونه|هم خونه|هماتاقی|هم اتاقی|اجاره اتاق/.test(text)) intent.sharedRoom = true;

  const family = text.match(/خانواده(?: ی)? ?(\d+) ?نفر/);
  if (family) {
    const size = Number(family[1]);
    intent.freeTextNotes = `خانواده ${size} نفره`;
    if (intent.minRooms === null && size >= 3) intent.minRooms = 2;
  } else if (/دانشجو/.test(text)) {
    intent.freeTextNotes = "دانشجو";
  } else if (/زوج|تازه ازدواج/.test(text)) {
    intent.freeTextNotes = "زوج جوان";
  }

  return intent;
}

// ---------- numbers ----------

const UNITS: Record<string, number> = {
  یک: 1, یه: 1, دو: 2, سه: 3, چهار: 4, پنج: 5, شش: 6, شیش: 6, هفت: 7, هشت: 8, نه: 9,
  ده: 10, یازده: 11, دوازده: 12, سیزده: 13, چهارده: 14, پانزده: 15, پونزده: 15,
  شانزده: 16, شونزده: 16, هفده: 17, هیفده: 17, هجده: 18, هیجده: 18, نوزده: 19,
  بیست: 20, سی: 30, چهل: 40, پنجاه: 50, شصت: 60, هفتاد: 70, هشتاد: 80, نود: 90,
  صد: 100, یکصد: 100, دویست: 200, سیصد: 300, چهارصد: 400, پانصد: 500, پونصد: 500,
  ششصد: 600, شیشصد: 600, هفتصد: 700, هشتصد: 800, نهصد: 900,
};

const FA = "؀-ۿ";
const WORD = Object.keys(UNITS)
  .sort((a, b) => b.length - a.length)
  .join("|");
// A run of number words joined by " و ", optionally ending in "و نیم".
const NUMBER_RUN = new RegExp(
  `(?<![${FA}])((?:${WORD})(?: و (?:${WORD}))*)(?: و نیم)?(?![${FA}])`,
  "g",
);

/** "پونصد" → "500", "یک و نیم" → "1.5", "صد و پنجاه" → "150". Leaves "نه" (no) alone. */
function wordsToDigits(text: string): string {
  return text.replace(NUMBER_RUN, (match, run: string) => {
    if (match === "نه" || match === "یه" || match === "سی") return match; // too ambiguous alone
    const value = run.split(" و ").reduce((sum, w) => sum + (UNITS[w] ?? 0), 0);
    return String(match.endsWith("و نیم") ? value + 0.5 : value);
  });
}

const DEPOSIT_KW = /رهن|ودیعه|پیش|پول پیش|بودجه/;
const RENT_KW = /اجاره|ماهی|ماهانه|کرایه|در ماه|ماهیانه/;

function parseMoney(text: string, intent: SearchIntent) {
  const re = /(\d+(?:\.\d+)?)\s*(میلیارد|میلیون|تومن|تومان|هزار|م(?![؀-ۿ]))/g;
  for (const m of text.matchAll(re)) {
    const n = Number(m[1]);
    const unit = m[2];
    let value: number;
    if (unit === "میلیارد") value = n * 1e9;
    else if (unit === "میلیون" || unit === "م") value = n * 1e6;
    else if (unit === "هزار") value = n * 1e3;
    else value = n < 100_000 ? n * 1e6 : n; // colloquial "۸ تومن" = 8 million

    const kind = moneyKind(text, m.index!, m[0].length, value);
    if (kind === "deposit") intent.maxDeposit = value;
    else intent.maxRent = value;
  }
  // Bare amounts (no unit) next to a keyword: "رهن ۳۰۰ اجاره ۱۰" or the reversed short form people
  // type, "دوخوابه ۵۰۰ رهن" / "۳۰۰ رهن ۱۰ اجاره". Whichever order the text starts with wins, so a
  // number between two keywords is read only once.
  const unitNext = /(?!\d|\.\d|\s*(?:میلیارد|میلیون|تومن|تومان|هزار|متر|خواب|م(?![\u0600-\u06FF])))/.source;
  const after = [...text.matchAll(new RegExp(`(رهن|ودیعه|پول پیش|اجاره|ماهی|کرایه)\\s*(?:حداکثر |تا |زیر )?(\\d+(?:\\.\\d+)?)${unitNext}`, "g"))];
  const before = [...text.matchAll(/(?<![\d.])(\d+(?:\.\d+)?)\s*(رهن|ودیعه|پول پیش|اجاره|کرایه)/g)];
  const numberFirst = before.length > 0 && (after.length === 0 || before[0].index! < after[0].index!);
  const pairs = numberFirst ? before.map((m) => [m[2], m[1]]) : after.map((m) => [m[1], m[2]]);
  for (const [kw, amount] of pairs) {
    const n = Number(amount);
    if (/رهن|ودیعه|پول پیش/.test(kw)) {
      if (intent.maxDeposit === null) intent.maxDeposit = n < 10 ? n * 1e9 : n * 1e6;
    } else if (intent.maxRent === null && n < 1000) {
      intent.maxRent = n * 1e6;
    }
  }
  if (/رهن کامل/.test(text) && intent.maxRent === null && intent.maxDeposit !== null) {
    intent.maxRent = 0;
  }
}

/** Decide whether an amount is a deposit or a rent from the nearest keyword around it. */
function moneyKind(text: string, index: number, length: number, value: number) {
  const before = text.slice(Math.max(0, index - 25), index);
  const after = text.slice(index + length, index + length + 15);
  const lastIndex = (s: string, re: RegExp) => {
    let pos = -1;
    for (const m of s.matchAll(new RegExp(re, "g"))) pos = m.index!;
    return pos;
  };
  const depBefore = lastIndex(before, DEPOSIT_KW);
  const rentBefore = lastIndex(before, RENT_KW);
  if (depBefore !== -1 || rentBefore !== -1) return depBefore > rentBefore ? "deposit" : "rent";
  const depAfter = after.search(DEPOSIT_KW);
  const rentAfter = after.search(RENT_KW);
  if (depAfter !== -1 || rentAfter !== -1) {
    if (rentAfter === -1) return "deposit";
    if (depAfter === -1) return "rent";
    return depAfter < rentAfter ? "deposit" : "rent";
  }
  return value >= 100e6 ? "deposit" : "rent";
}

// ---------- rooms & area ----------

function parseRooms(text: string, intent: SearchIntent) {
  const rooms: number[] = [];
  if (/سوئیت|سویت|استودیو/.test(text)) rooms.push(0);
  for (const m of text.matchAll(/(\d)\s*(?:تا )?خواب/g)) rooms.push(Number(m[1]));
  // attached forms like "دوخوابه" that wordsToDigits can't split
  const attached: Record<string, number> = { یک: 1, یه: 1, دو: 2, سه: 3, چهار: 4 };
  for (const m of text.matchAll(/(یک|یه|دو|سه|چهار) ?خواب/g)) rooms.push(attached[m[1]]);
  if (!rooms.length) return;

  intent.minRooms = Math.min(...rooms);
  if (/حداقل|یا بیشتر|به بالا|به بالاتر/.test(text)) return;
  if (rooms.length > 1 || rooms.includes(0)) intent.maxRooms = Math.max(...rooms);
}

function parseArea(text: string, intent: SearchIntent) {
  const m = text.match(/(\d{2,3})\s*متر/);
  if (!m) return;
  const area = Number(m[1]);
  intent.minArea = /حدود|حوالی|تقریبا|تقریباً/.test(text) ? Math.round(area * 0.85) : area;
}

// ---------- amenities ----------

const SOFT = /ترجیحا|ترجیحاً|ترجیح|اگه|اگر|بهتره|بهتر است|باشه بهتر|خوبه|امتیازه/;
const NEGATE = /مهم نیست|لازم نیست|نمی ?خوام|نیاز ندارم/;

function parseAmenities(text: string, intent: SearchIntent) {
  // Soft/negating words apply to the clause they're in: "پارکینگ داشته باشه، ترجیحاً بالکن".
  const clauses = text.split(/[،,.؛!؟?]| ولی | اما /);
  for (const key of AMENITY_KEYS) {
    const aliases = AMENITIES[key].aliases.map(normalizeFa);
    const clause = clauses.find((c) => aliases.some((a) => c.includes(a)));
    if (clause === undefined || NEGATE.test(clause)) continue;
    const list: AmenityKey[] = SOFT.test(clause) ? intent.niceToHave : intent.mustHave;
    list.push(key);
  }
}
