import { metroAccess, metroLinesIn } from "./metro";
import type { Listing } from "./types";

/** Canonical amenity keys the AI may put in `mustHave` / `niceToHave`. */
export const AMENITY_KEYS = [
  "parking",
  "elevator",
  "storage",
  "balcony",
  "furnished",
  "newBuilding",
  "nearMetro",
  "yard",
  "lobby",
  "pool",
  "convertible",
] as const;

export type AmenityKey = (typeof AMENITY_KEYS)[number];

export const AMENITIES: Record<
  AmenityKey,
  {
    label: string;
    aliases: string[];
    has: (l: Listing) => boolean;
    /** Whether the ad states this at all; when false, "doesn't have it" really means "not mentioned". */
    known?: (l: Listing) => boolean;
    /** Natural phrases for explanations; default "X دارد" / "X ندارد". */
    yes?: string;
    no?: string;
  }
> = {
  parking: {
    label: "پارکینگ",
    aliases: ["پارکینگ", "جای پارک", "پارکینگ‌دار"],
    has: (l) => l.parking === true,
    known: (l) => l.parking !== undefined,
  },
  elevator: { label: "آسانسور", aliases: ["آسانسور", "اسانسور"], has: (l) => l.elevator === true, known: (l) => l.elevator !== undefined },
  storage: { label: "انباری", aliases: ["انباری", "انبار"], has: (l) => l.storage === true, known: (l) => l.storage !== undefined },
  balcony: { label: "بالکن", aliases: ["بالکن", "تراس"], has: (l) => l.tags.includes("بالکن") },
  furnished: { label: "مبله", aliases: ["مبله", "مبلمان"], has: (l) => l.tags.includes("مبله"), yes: "مبله است", no: "مبله نیست" },
  newBuilding: {
    label: "نوساز",
    aliases: ["نوساز", "نو ساز", "کلید نخورده", "کلیدنخورده", "تازه ساز"],
    has: (l) => l.buildingAge !== undefined && l.buildingAge <= 3,
    known: (l) => l.buildingAge !== undefined,
    yes: "نوساز است",
    no: "نوساز نیست",
  },
  nearMetro: {
    label: "نزدیک قطار شهری",
    aliases: ["مترو", "قطار شهری", "ایستگاه"],
    // the ad says so, or a station (OSM, src/data/metro.json) is a short walk away
    has: (l) => l.tags.includes("نزدیک قطار شهری") || metroAccess(l).length > 0,
    known: (l) => l.tags.includes("نزدیک قطار شهری") || metroLinesIn(l.city).length > 0,
    yes: "نزدیک قطار شهری است",
    no: "به قطار شهری نزدیک نیست",
  },
  yard: { label: "حیاط", aliases: ["حیاط", "حیاط‌دار"], has: (l) => l.tags.some((t) => t.startsWith("حیاط")) },
  lobby: { label: "لابی‌من", aliases: ["لابی", "نگهبان", "لابی من"], has: (l) => l.tags.some((t) => t.startsWith("لابی")) },
  pool: {
    label: "استخر و سونا",
    aliases: ["استخر", "سونا", "جکوزی"],
    has: (l) => l.tags.some((t) => t.startsWith("استخر")),
  },
  convertible: {
    label: "قابل تبدیل",
    aliases: ["قابل تبدیل", "قابل جابجایی", "تبدیل"],
    has: (l) => l.convertible,
    yes: "رهن و اجاره‌اش قابل تبدیل است",
    no: "مبلغش قابل تبدیل نیست",
  },
};

export const amenityYes = (k: AmenityKey) => AMENITIES[k].yes ?? `${AMENITIES[k].label} دارد`;
export const amenityNo = (k: AmenityKey) => AMENITIES[k].no ?? `${AMENITIES[k].label} ندارد`;

/**
 * Does the ad say it lacks this? Real ads (with a `url`) only list what they have, so a missing tag
 * means "not mentioned"; the sample set lists everything.
 */
export const amenityKnown = (k: AmenityKey, l: Listing) => AMENITIES[k].known?.(l) ?? (k === "convertible" || !l.url);
export const amenityUnstated = (k: AmenityKey) => `آگهی دربارهٔ ${AMENITIES[k].label} چیزی نگفته`;

