import { distanceKm, type LatLng } from "./geo";
import { toFullDeposit } from "./pricing";
import { isComparable } from "./quality";
import { normalizeFa } from "./text";
import type { Listing, Neighborhood } from "./types";

/**
 * Everything the ranking needs to know about one city: its neighborhoods (with reference prices and
 * map centers) and which of them are next to each other. Built from the database's `hood_stats`
 * view, or from the bundled listings when there is no database.
 */

export interface HoodInfo {
  name: Neighborhood;
  /** Comparable listings behind the numbers below. */
  n: number;
  /** Median full-deposit Toman per m². */
  medianPpm2: number;
  /** Median full-deposit price, Toman. */
  medianFull: number;
  center: LatLng | null;
}

export interface CityCatalog {
  city: string;
  cityFa: string;
  /** Most listings first. */
  hoods: HoodInfo[];
  medianPpm2: number;
  center: LatLng | null;
  /** Neighborhood → the ones next to it (nearest centers within `ADJACENT_KM`). */
  adjacent: Record<Neighborhood, Neighborhood[]>;
}

export const ADJACENT_KM = 2.5;
const ADJACENT_MAX = 4;

export function buildAdjacency(hoods: HoodInfo[]): Record<Neighborhood, Neighborhood[]> {
  const located = hoods.filter((h): h is HoodInfo & { center: LatLng } => h.center !== null);
  return Object.fromEntries(
    hoods.map((h) => {
      if (!h.center) return [h.name, []];
      const near = located
        .filter((o) => o.name !== h.name)
        .map((o) => ({ name: o.name, d: distanceKm(h.center!, o.center) }))
        .filter((o) => o.d <= ADJACENT_KM)
        .sort((a, b) => a.d - b.d)
        .slice(0, ADJACENT_MAX)
        .map((o) => o.name);
      return [h.name, near];
    }),
  );
}

/** The user's area: their neighborhood plus the ones next to it. */
export function areaAround(catalog: CityCatalog, n: Neighborhood): Neighborhood[] {
  return [n, ...(catalog.adjacent[n] ?? [])];
}

const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** Catalog computed from a list of listings (bundled data, tests). */
export function catalogFromListings(listings: Listing[], city = "mashhad", cityFa = "مشهد"): CityCatalog {
  const comparable = listings.filter(isComparable);
  const groups = new Map<string, Listing[]>();
  for (const l of comparable) groups.set(l.neighborhood, [...(groups.get(l.neighborhood) ?? []), l]);
  const centerOf = (ls: Listing[]): LatLng | null => {
    const pts = ls.filter((l) => l.lat != null && l.lng != null && !l.approxLocation);
    if (!pts.length) return null;
    return { lat: median(pts.map((l) => l.lat!)), lng: median(pts.map((l) => l.lng!)) };
  };
  const hoods: HoodInfo[] = [...groups.entries()]
    .map(([name, ls]) => ({
      name,
      n: ls.length,
      medianPpm2: median(ls.map((l) => toFullDeposit(l) / l.areaM2)),
      medianFull: median(ls.map(toFullDeposit)),
      center: centerOf(ls),
    }))
    .sort((a, b) => b.n - a.n);
  return {
    city,
    cityFa,
    hoods,
    medianPpm2: median(comparable.map((l) => toFullDeposit(l) / l.areaM2)),
    center: centerOf(comparable),
    adjacent: buildAdjacency(hoods),
  };
}

// ---------- names ----------

/** Matching form: normalized, «آ» → «ا», «… آباد» glued ("وکیل‌آباد" = "وکیل اباد" = "وکیلاباد"). */
const fold = (s: string) => normalizeFa(s).replace(/آ/g, "ا").replace(/ اباد/g, "اباد");

/** Short forms people type: «محله کوثر» → «کوثر», «قاسم‌آباد (شهرک غرب)» → «قاسم‌آباد», «بلوار سجاد» → «سجاد». */
export function nameVariants(name: string): string[] {
  const base = name.replace(/\s*\(.*\)\s*$/, "").trim();
  const out = new Set([name, base]);
  for (const prefix of ["محله ", "بلوار ", "شهرک ", "خیابان ", "کوی "]) {
    if (base.startsWith(prefix) && base.length - prefix.length >= 3) out.add(base.slice(prefix.length));
  }
  return [...out].map(fold).filter((v) => v.length >= 2);
}

/** Persian/Arabic letters only (not «،», «؛», «؟» or digits), for whole-word matching. */
export const FA_LETTER = "\\u0621-\\u064A\\u0671-\\u06D3\\u06FA-\\u06FF";
const LETTER = FA_LETTER;
const wordRe = (v: string) =>
  new RegExp(`(^|[^${LETTER}])${v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^${LETTER}])`);

/** Neighborhoods mentioned in free text (whole words only, so «سجاد» does not match «سجادیه»). */
export function findNeighborhoods(text: string, hoods: HoodInfo[]): Neighborhood[] {
  const t = fold(text);
  const hits: { name: Neighborhood; len: number; at: number }[] = [];
  for (const h of hoods) {
    let best: { len: number; at: number } | null = null;
    for (const v of nameVariants(h.name)) {
      const m = wordRe(v).exec(t);
      if (m && (!best || v.length > best.len)) best = { len: v.length, at: m.index };
    }
    if (best) hits.push({ name: h.name, ...best });
  }
  // a longer name wins over a shorter one it contains ("طبرسی شمالی" over "طبرسی")
  const kept = hits.filter(
    (a) => !hits.some((b) => b !== a && b.len > a.len && Math.abs(b.at - a.at) <= b.len && b.name.includes(a.name.split(" ")[0])),
  );
  return [...new Set(kept.sort((a, b) => a.at - b.at).map((h) => h.name))];
}

/** Map any spelling of a neighborhood to the catalog's name, or null. */
export function canonicalNeighborhood(name: string, hoods: HoodInfo[]): Neighborhood | null {
  const n = fold(name);
  const exact = hoods.find((h) => nameVariants(h.name).includes(n));
  if (exact) return exact.name;
  return findNeighborhoods(name, hoods)[0] ?? null;
}

/** Nearest neighborhood center to a point (for "near me"), within `maxKm`. */
export function nearestHood(catalog: CityCatalog, p: LatLng, maxKm = 4, minListings = 10): Neighborhood | null {
  let best: { name: Neighborhood; d: number } | null = null;
  for (const h of catalog.hoods) {
    if (!h.center || h.n < minListings) continue;
    const d = distanceKm(p, h.center);
    if (d <= maxKm && (!best || d < best.d)) best = { name: h.name, d };
  }
  return best?.name ?? null;
}

// ---------- positions ----------

/** How far (degrees of latitude, ~0.9 km) an unlocated listing may sit from its neighborhood center. */
const SPREAD = 0.008;

/** Stable approximate point for a listing without coordinates: its neighborhood (or city) center + jitter. */
export function approxPosition(id: string, center: LatLng): LatLng {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  const u = ((h >>> 0) % 10_000) / 10_000;
  const v = ((Math.imul(h, 2654435761) >>> 0) % 10_000) / 10_000;
  const r = SPREAD * Math.sqrt(0.08 + 0.92 * u);
  const a = 2 * Math.PI * v;
  return { lat: center.lat + r * Math.sin(a), lng: center.lng + (r * Math.cos(a)) / Math.cos((center.lat * Math.PI) / 180) };
}

/** Give every listing a map position (real when known, approximate otherwise). */
export function withPositions(listings: Listing[], catalog: CityCatalog): Listing[] {
  const centers = new Map(catalog.hoods.map((h) => [h.name, h.center]));
  return listings.map((l) => {
    if (l.lat != null && l.lng != null) return l;
    const c = centers.get(l.neighborhood) ?? catalog.center;
    if (!c) return l;
    return { ...l, ...approxPosition(l.id, c), approxLocation: true };
  });
}
