import { formatFaNumber } from "@/lib/persian";
import { hoodCenter, type LatLng } from "@/lib/places";
import { normalizeFa } from "@/lib/text";
import type { Listing } from "@/lib/types";

/**
 * Universities students search near ("نزدیک دانشگاه فردوسی"). Outlines: OpenStreetMap (ODbL) via
 * Nominatim, simplified (2026-09-27), as [lat, lng]. Distance is measured to the campus edge, so a
 * big campus isn't "far" just because its middle is.
 *
 * Every alias names the university explicitly: a bare "فردوسی" or "خیام" is usually a street, and
 * names that contain a neighborhood («دانشگاه فرهنگیان» ⊃ فرهنگ، «دانشگاه سجاد» ⊃ سجاد) are left out
 * until neighborhood matching can tell them apart.
 */
export interface Campus {
  id: string;
  /** Display name. */
  name: string;
  city: string;
  aliases: string[];
  outline: [number, number][];
}

export const CAMPUSES: Campus[] = [
  {
    id: "ferdowsi",
    name: "دانشگاه فردوسی",
    city: "مشهد",
    aliases: ["دانشگاه فردوسی", "دانشجوی فردوسی", "دانشجو فردوسی", "پردیس فردوسی", "ferdowsi"],
    // relation 13108266
    outline: [
      [36.30238, 59.51811], [36.29935, 59.52399], [36.30089, 59.53339], [36.30446, 59.53203], [36.30467, 59.53737],
      [36.31108, 59.53901], [36.31339, 59.53222], [36.3155, 59.53295], [36.31496, 59.53545], [36.31619, 59.53603],
      [36.31875, 59.52767], [36.31552, 59.52611], [36.30843, 59.51891], [36.30396, 59.51955],
    ],
  },
  {
    id: "mums",
    name: "دانشگاه علوم پزشکی مشهد",
    city: "مشهد",
    aliases: ["علوم پزشکی", "دانشکده پزشکی", "دانشگاه پزشکی"],
    // relation 13268160
    outline: [[36.31393, 59.53203], [36.31108, 59.53901], [36.31428, 59.53987], [36.31619, 59.53603], [36.31496, 59.53545], [36.3155, 59.53295]],
  },
  {
    id: "azad",
    name: "دانشگاه آزاد مشهد",
    city: "مشهد",
    aliases: ["دانشگاه آزاد", "آزاد اسلامی", "دانشجوی آزاد"],
    // way 36843270
    outline: [[36.35726, 59.51318], [36.35677, 59.51463], [36.35678, 59.51843], [36.35894, 59.51678], [36.359, 59.5147]],
  },
  {
    id: "pnu",
    name: "دانشگاه پیام نور مشهد",
    city: "مشهد",
    aliases: ["پیام نور"],
    // way 99733864
    outline: [[36.34294, 59.48481], [36.34267, 59.48735], [36.34346, 59.48772], [36.34366, 59.48523]],
  },
  {
    id: "khayyam",
    name: "دانشگاه خیام",
    city: "مشهد",
    aliases: ["دانشگاه خیام", "دانشجوی خیام"],
    // way 354092110
    outline: [[36.35652, 59.48925], [36.35493, 59.48945], [36.35588, 59.49017]],
  },
];

export const campusById = (id: string | null | undefined) => CAMPUSES.find((c) => c.id === id);

const loose = (s: string) => normalizeFa(s).toLowerCase().replace(/آ/g, "ا").replace(/ /g, "");

/** The university a query names (first mention wins), or null. */
export function findCampus(text: string, city?: string | null): Campus | null {
  const t = loose(text);
  let best: { c: Campus; at: number } | null = null;
  for (const c of CAMPUSES) {
    if (city && c.city !== city) continue;
    for (const a of c.aliases) {
      const at = t.indexOf(loose(a));
      if (at !== -1 && (!best || at < best.at)) best = { c, at };
    }
  }
  return best?.c ?? null;
}

// ---------- distance ----------

/** Local flat projection (km) around a point; plenty accurate inside one city. */
function project(origin: LatLng, lat: number, lng: number): [number, number] {
  const rad = Math.PI / 180;
  return [(lng - origin.lng) * rad * Math.cos(origin.lat * rad) * 6371, (lat - origin.lat) * rad * 6371];
}

/** Straight-line km from `p` to the campus edge (0 inside it). */
export function kmToCampus(p: LatLng, campus: Campus): number {
  const pts = campus.outline.map(([lat, lng]) => project(p, lat, lng));
  let inside = false;
  let best = Infinity;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [ax, ay] = pts[j];
    const [bx, by] = pts[i];
    if (ay > 0 !== by > 0 && 0 < ((bx - ax) * (0 - ay)) / (by - ay) + ax) inside = !inside;
    const dx = bx - ax;
    const dy = by - ay;
    const t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy || 1)));
    best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy));
  }
  return inside ? 0 : best;
}

export interface CampusDistance {
  campus: string;
  /** Straight-line km, rounded (0.1 with the ad's own location, 0.5 from the neighborhood center). */
  km: number;
  /** True when the ad has its own map point; false = measured from its neighborhood's center. */
  exact: boolean;
  /** Rough walking minutes (street factor 1.3, 4.8 km/h), only when it's walkable (≤ 2.5 km). */
  walkMin: number | null;
}

export const WALKABLE_KM = 2.5;

export function campusDistance(l: Pick<Listing, "lat" | "lng" | "neighborhood" | "city">, campus: Campus): CampusDistance | null {
  const exact = l.lat != null && l.lng != null;
  const p = exact ? { lat: l.lat!, lng: l.lng! } : hoodCenter(l.neighborhood, l.city);
  if (!p) return null;
  const raw = kmToCampus(p, campus);
  const km = exact ? Math.max(0.1, Math.round(raw * 10) / 10) : Math.max(0.5, Math.round(raw * 2) / 2);
  const walkMin = km <= WALKABLE_KM ? Math.max(5, Math.round((km * 1.3 * 60) / 4.8 / 5) * 5) : null;
  return { campus: campus.name, km, exact, walkMin };
}

/** "۱٫۲ کیلومتر تا دانشگاه فردوسی" (prefixed with «حدود» when measured from the neighborhood). */
export function campusDistanceFa(d: CampusDistance): string {
  return `${d.exact ? "" : "حدود "}${formatFaNumber(d.km)} کیلومتر تا ${d.campus}`;
}

/** 1 when walkable (≤ 1 km), 0 from 6 km on (a long bus ride). */
export function campusScore(km: number): number {
  return Math.max(0, Math.min(1, (6 - km) / 5));
}
