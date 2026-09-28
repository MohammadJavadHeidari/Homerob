import metro from "@/data/metro.json";
import { distanceKm, listingLatLng, type LatLng } from "@/lib/geo";
import { toEnDigits, toFaDigits } from "@/lib/persian";
import type { SearchIntent } from "@/lib/intent/schema";
import type { Listing } from "@/lib/types";

/**
 * Metro / light-rail lines in service, per city, from OpenStreetMap (scripts/build-metro.mjs).
 * Used to ask "which line?" when someone wants to live near the metro, and to keep the results on it.
 */

export interface MetroStation extends LatLng {
  n: string;
}

export interface MetroLine {
  /** OSM ref: "1", "2", "3"… */
  ref: string;
  /** «خط ۱» */
  name: string;
  colour: string | null;
  from: string;
  to: string;
  stations: MetroStation[];
}

const LINES = metro.cities as Record<string, MetroLine[]>;
export const METRO_SOURCE = metro.source;

/** Walking speed ≈ 80 m/min; street detours make the real walk ~1.3× the straight line. */
const METERS_PER_MIN = 80;
const DETOUR = 1.3;
/** "Near the metro" = at most this many minutes on foot to a station of the line. */
export const WALK_MAX_MIN = 15;

/** Fallback colors when OSM has none (Mashhad's line 3). */
const FALLBACK_COLOURS = ["#0026FF", "#66CC00", "#E6007E", "#F29400", "#8B5A2B", "#00A0DC"];

export function metroLinesIn(city: string | null | undefined): MetroLine[] {
  return (city && LINES[city]) || [];
}

export function lineColour(line: MetroLine): string {
  return line.colour ?? FALLBACK_COLOURS[(Number(line.ref) - 1) % FALLBACK_COLOURS.length] ?? "#737373";
}

export const walkMinutes = (a: LatLng, b: LatLng) => Math.max(1, Math.round((distanceKm(a, b) * 1000 * DETOUR) / METERS_PER_MIN));

export interface MetroAccess {
  line: MetroLine;
  station: MetroStation;
  minutes: number;
  /** False when the ad has no exact position (the walk is from a point inside its neighborhood). */
  exact: boolean;
}

/** Lines within a walk of the listing, closest first (one entry per line, its nearest station). */
export function metroAccess(l: Pick<Listing, "id" | "neighborhood" | "city" | "lat" | "lng">, maxMin = WALK_MAX_MIN): MetroAccess[] {
  const p = listingLatLng(l);
  const exact = l.lat != null && l.lng != null;
  const out: MetroAccess[] = [];
  for (const line of metroLinesIn(l.city)) {
    let best: { station: MetroStation; minutes: number } | null = null;
    for (const station of line.stations) {
      const minutes = walkMinutes(p, station);
      if (!best || minutes < best.minutes) best = { station, minutes };
    }
    if (best && best.minutes <= maxMin) out.push({ line, ...best, exact });
  }
  return out.sort((a, b) => a.minutes - b.minutes);
}

/** Is the listing within a walk of any of these lines (any line when `refs` is empty)? */
export function nearLines(l: Parameters<typeof metroAccess>[0], refs: string[] = []): MetroAccess | null {
  return metroAccess(l).find((a) => !refs.length || refs.includes(a.line.ref)) ?? null;
}

/** «۸ دقیقه پیاده تا ایستگاه صیاد شیرازی (خط ۱)»; approximate positions say «حدود». */
export function accessText(a: MetroAccess): string {
  return `${a.exact ? "" : "حدود "}${toFaDigits(a.minutes)} دقیقه پیاده تا ایستگاه ${a.station.n} (${a.line.name})`;
}

const ORDINALS: Record<string, string> = { یک: "1", اول: "1", دو: "2", دوم: "2", سه: "3", سوم: "3", چهار: "4", چهارم: "4", پنج: "5", پنجم: "5", شش: "6", ششم: "6", هفت: "7", هفتم: "7" };

/**
 * Line numbers the text names next to «مترو / قطار شهری / خط»: «خط ۱ مترو», «مترو خط دو», «خط یک و سه».
 * Only lines that exist in the city are kept (when a city is known).
 */
export function findMetroLines(text: string, city?: string | null): string[] {
  const t = toEnDigits(text);
  if (!/مترو|قطار\s*شهری|خط/.test(t)) return [];
  const refs = new Set<string>();
  const word = "(\\d{1,2}|یک|اول|دوم|دو|سوم|سه|چهارم|چهار|پنجم|پنج|ششم|شش|هفتم|هفت)";
  // «خط ۱»، «خط ۱ و ۳»، «خطوط ۱ و ۲»
  for (const m of t.matchAll(new RegExp(`خط(?:وط)?\\s*${word}(?:\\s*(?:،|,|\\sو\\s|\\sیا\\s)\\s*${word})*`, "g"))) {
    for (const [x] of m[0].replace(/^خط(?:وط)?/, "").matchAll(new RegExp(word, "g"))) {
      const ref = /^\d+$/.test(x) ? String(Number(x)) : ORDINALS[x];
      if (ref) refs.add(ref);
    }
  }
  // a line number alone only counts when the text is about the metro
  if (!/مترو|قطار\s*شهری/.test(t) && !/خط\s*(?:\d|یک|دو|سه)/.test(t)) return [];
  const known = city ? new Set(metroLinesIn(city).map((l) => l.ref)) : null;
  return [...refs].filter((r) => !known || known.has(r)).sort();
}

/** «خط ۱ مترو» / «خط ۱ یا ۲ مترو». */
export function linesLabel(refs: string[]): string {
  return `خط ${refs.map((r) => toFaDigits(r)).join(" یا ")} مترو`;
}

/** Lines the text names become a hard "near these lines" (fresh queries only; an edited intent is kept). */
export function applyMetroText(intent: SearchIntent, text: string): SearchIntent {
  const refs = findMetroLines(text, intent.city);
  return refs.length ? withMetroLines(intent, refs) : intent;
}

/** Only homes near these lines: the lines become a must (a chip), not a preference. */
export function withMetroLines(intent: SearchIntent, refs: string[]): SearchIntent {
  return {
    ...intent,
    metroLines: refs,
    mustHave: intent.mustHave.includes("nearMetro") ? intent.mustHave : [...intent.mustHave, "nearMetro"],
    niceToHave: intent.niceToHave.filter((k) => k !== "nearMetro"),
  };
}

/** The user wants the metro but hasn't said which line, and the city has more than one → ask. */
export function shouldAskLine(intent: SearchIntent, city: string | null): boolean {
  const wantsMetro = intent.mustHave.includes("nearMetro") || intent.niceToHave.includes("nearMetro");
  return wantsMetro && !intent.metroLines.length && metroLinesIn(city).length > 1;
}
