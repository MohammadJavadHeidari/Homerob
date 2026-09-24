import { listings as ALL_LISTINGS } from "@/data/listings";
import { AMENITIES, amenityNo, amenityYes, type AmenityKey } from "@/lib/amenities";
import type { SearchIntent } from "@/lib/intent/schema";
import { ADJACENT } from "@/lib/neighborhoods";
import { formatToman, toFaDigits } from "@/lib/persian";
import { pricePerM2 } from "@/lib/pricing";
import { isComparable } from "@/lib/quality";
import type { Listing, Neighborhood } from "@/lib/types";

import type { BudgetFit } from "./budget";

/** Soft-score weights (sum = 100 → the match score is a percentage). Tune here. */
export const WEIGHTS = {
  neighborhood: 30,
  mustHave: 25,
  rooms: 20,
  area: 8,
  value: 7,
  niceToHave: 5,
  recency: 5,
} as const;

export type ScoreBreakdown = Record<keyof typeof WEIGHTS, number>;

export interface Highlight {
  kind: "pro" | "con" | "info";
  text: string;
  /** Higher = more important to mention. */
  weight: number;
}

// ---------- reference stats ----------

function median(xs: number[]) {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

const COMPARABLE = ALL_LISTINGS.filter(isComparable);
const HOODS = [...new Set(COMPARABLE.map((l) => l.neighborhood))];

/** Median full-deposit price per m² in each neighborhood (placeholder prices and shared rooms excluded). */
export const HOOD_MEDIAN_PPM: Record<Neighborhood, number> = Object.fromEntries(
  HOODS.map((h) => [h, median(COMPARABLE.filter((l) => l.neighborhood === h).map((l) => pricePerM2(l)))]),
) as Record<Neighborhood, number>;

/** How many listings each median is based on — shown to the user, like any honest price verdict. */
export const HOOD_SAMPLE_SIZE: Record<Neighborhood, number> = Object.fromEntries(
  HOODS.map((h) => [h, COMPARABLE.filter((l) => l.neighborhood === h).length]),
) as Record<Neighborhood, number>;

/** "Now" for recency = newest listing, so the demo doesn't age. */
const REFERENCE_TIME = Math.max(...ALL_LISTINGS.map((l) => Date.parse(l.postedAt)));

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

// ---------- scoring ----------

export function scoreListing(l: Listing, intent: SearchIntent): { score: number; breakdown: ScoreBreakdown } {
  const b: ScoreBreakdown = {
    neighborhood: neighborhoodScore(l, intent),
    mustHave: fraction(intent.mustHave, l, 1),
    rooms: roomsScore(l, intent),
    area: intent.minArea === null ? 1 : clamp01(1 - ((intent.minArea - l.areaM2) / intent.minArea) * 3),
    value: valueScore(l),
    niceToHave: fraction(intent.niceToHave, l, 1),
    recency: clamp01(1 - (REFERENCE_TIME - Date.parse(l.postedAt)) / (21 * 864e5)),
  };
  const score = (Object.keys(WEIGHTS) as (keyof typeof WEIGHTS)[]).reduce(
    (sum, k) => sum + WEIGHTS[k] * b[k],
    0,
  );
  return { score: Math.round(score), breakdown: b };
}

function neighborhoodScore(l: Listing, intent: SearchIntent) {
  if (!intent.neighborhoods.length) return 1;
  if (intent.neighborhoods.includes(l.neighborhood)) return 1;
  if (intent.neighborhoods.some((n) => ADJACENT[n]?.includes(l.neighborhood))) return 0.45;
  return 0;
}

function roomsScore(l: Listing, { minRooms: min, maxRooms: max }: SearchIntent) {
  if (min === null && max === null) return 1;
  if (min !== null && l.rooms < min) return l.rooms === min - 1 ? 0.3 : 0;
  if (max !== null && l.rooms > max) return l.rooms === max + 1 ? 0.5 : 0.1;
  // in range; with only a minimum, much bigger than asked is slightly less relevant
  if (max === null && min !== null && l.rooms > min + 1) return 0.75;
  return 1;
}

function fraction(keys: AmenityKey[], l: Listing, empty: number) {
  if (!keys.length) return empty;
  return keys.filter((k) => AMENITIES[k].has(l)).length / keys.length;
}

/** 1 = ≥20% cheaper per m² than the neighborhood median, 0.5 = at median, 0 = ≥20% pricier. */
function valueScore(l: Listing) {
  const ratio = pricePerM2(l) / HOOD_MEDIAN_PPM[l.neighborhood];
  return clamp01(0.5 + (1 - ratio) * 2.5);
}

// ---------- highlights (facts the explanation is built from) ----------

export function highlights(l: Listing, intent: SearchIntent, fit: BudgetFit): Highlight[] {
  const out: Highlight[] = [];
  const add = (kind: Highlight["kind"], text: string, weight: number) => out.push({ kind, text, weight });

  // budget — phrase savings on the side the user talked about
  const { maxDeposit: D, maxRent: R } = intent;
  if (fit.converted) {
    add(
      "info",
      fit.monthlyRent === 0
        ? `با ${formatToman(roundM(fit.deposit))} رهن کامل می‌شه`
        : `با ${formatToman(roundM(fit.deposit))} رهن، اجاره‌اش ${formatToman(roundHalfM(fit.monthlyRent))} می‌شه`,
      8,
    );
  }
  const rentSlack = R !== null ? R - fit.monthlyRent : 0;
  const depositSlack = D !== null ? D - fit.deposit : 0;
  if (R !== null && R > 0 && rentSlack >= 1e6) {
    add("pro", `ماهی ${formatToman(roundHalfM(rentSlack))} کمتر از سقف اجاره‌ات`, 7);
  } else if (D !== null && depositSlack >= 20e6) {
    add("pro", `${formatToman(roundM(depositSlack))} زیر بودجه‌ات`, 7);
  } else if ((D !== null || R !== null) && !fit.converted) {
    add("info", "درست در حد بودجه‌ات", 3);
  }

  // neighborhood
  if (intent.neighborhoods.length) {
    if (intent.neighborhoods.includes(l.neighborhood)) add("pro", `خود ${l.neighborhood}`, 5);
    else {
      const near = intent.neighborhoods.find((n) => ADJACENT[n]?.includes(l.neighborhood));
      if (near) add("con", `${l.neighborhood} است، نزدیک ${near}`, 7);
      else add("con", `در ${l.neighborhood}، خارج از محله‌های مدنظرت`, 9);
    }
  }

  // rooms / area
  if (intent.minRooms !== null && l.rooms < intent.minRooms) {
    add("con", `${roomsLabel(l.rooms)} است، نه ${roomsLabel(intent.minRooms)}`, 9);
  } else if (intent.maxRooms !== null && l.rooms > intent.maxRooms) {
    add("info", `${roomsLabel(l.rooms)}، بزرگ‌تر از چیزی که گفتی`, 4);
  }
  if (intent.minArea !== null && l.areaM2 < intent.minArea) {
    add("con", `${toFaDigits(l.areaM2)} متر، کمتر از ${toFaDigits(intent.minArea)} متر`, 6);
  }

  // amenities the user asked for
  for (const k of intent.mustHave) {
    if (AMENITIES[k].has(l)) add("pro", amenityYes(k), 4);
    else add("con", amenityNo(k), 10);
  }
  for (const k of intent.niceToHave) {
    if (AMENITIES[k].has(l)) add("pro", amenityYes(k), 3);
  }

  // value vs neighborhood
  const ratio = pricePerM2(l) / HOOD_MEDIAN_PPM[l.neighborhood];
  const sample = `میانهٔ ${toFaDigits(HOOD_SAMPLE_SIZE[l.neighborhood])} آگهی ${l.neighborhood}`;
  if (ratio <= 0.9) add("pro", `حدود ${toFaDigits(Math.round((1 - ratio) * 100))}٪ ارزان‌تر از ${sample}`, 6);
  else if (ratio >= 1.12) add("con", `حدود ${toFaDigits(Math.round((ratio - 1) * 100))}٪ گران‌تر از ${sample}`, 5);

  // notable facts nobody asked about
  if (!intent.mustHave.includes("parking") && !l.parking && l.rooms >= 2) add("con", "پارکینگ ندارد", 4);
  if (!l.elevator && l.floor >= 3) add("con", `طبقه ${toFaDigits(l.floor)} بدون آسانسور`, 4);
  if (l.buildingAge <= 2 && !intent.mustHave.includes("newBuilding")) add("pro", "نوساز", 2);
  if (REFERENCE_TIME - Date.parse(l.postedAt) < 864e5) add("info", "آگهی امروز", 1);

  return out.sort((a, b) => b.weight - a.weight);
}

/** Deterministic 1-sentence explanation from the top pro and top con (fallback for the LLM). */
export function ruleExplanation(hl: Highlight[]): string {
  const pro = hl.filter((h) => h.kind !== "con").slice(0, 2).map((h) => h.text);
  const con = hl.find((h) => h.kind === "con")?.text;
  if (!pro.length && !con) return "با خواسته‌هات جور است.";
  if (!con) return `${pro.join(" و ")}.`;
  if (!pro.length) return `${con}.`;
  return `${pro.join(" و ")}؛ ولی ${con}.`;
}

const roundM = (v: number) => Math.round(v / 1e6) * 1e6;
const roundHalfM = (v: number) => Math.round(v / 5e5) * 5e5;

function roomsLabel(n: number) {
  return n === 0 ? "سوئیت" : `${toFaDigits(n)} خوابه`;
}
