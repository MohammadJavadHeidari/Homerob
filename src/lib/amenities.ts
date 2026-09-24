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
    /** Natural phrases for explanations; default "X دارد" / "X ندارد". */
    yes?: string;
    no?: string;
  }
> = {
  parking: { label: "پارکینگ", aliases: ["پارکینگ", "جای پارک", "پارکینگ‌دار"], has: (l) => l.parking },
  elevator: { label: "آسانسور", aliases: ["آسانسور", "اسانسور"], has: (l) => l.elevator },
  storage: { label: "انباری", aliases: ["انباری", "انبار"], has: (l) => l.storage },
  balcony: { label: "بالکن", aliases: ["بالکن", "تراس"], has: (l) => l.tags.includes("بالکن") },
  furnished: { label: "مبله", aliases: ["مبله", "مبلمان"], has: (l) => l.tags.includes("مبله"), yes: "مبله است", no: "مبله نیست" },
  newBuilding: {
    label: "نوساز",
    aliases: ["نوساز", "نو ساز", "کلید نخورده", "کلیدنخورده", "تازه ساز"],
    has: (l) => l.buildingAge <= 3,
    yes: "نوساز است",
    no: "نوساز نیست",
  },
  nearMetro: {
    label: "نزدیک قطار شهری",
    aliases: ["مترو", "قطار شهری", "ایستگاه"],
    has: (l) => l.tags.includes("نزدیک قطار شهری"),
    yes: "نزدیک قطار شهری است",
    no: "به قطار شهری نزدیک نیست",
  },
  yard: { label: "حیاط", aliases: ["حیاط", "حیاط‌دار"], has: (l) => l.tags.includes("حیاط اختصاصی") },
  lobby: { label: "لابی‌من", aliases: ["لابی", "نگهبان", "لابی من"], has: (l) => l.tags.includes("لابی‌من") },
  pool: {
    label: "استخر و سونا",
    aliases: ["استخر", "سونا", "جکوزی"],
    has: (l) => l.tags.includes("استخر و سونا"),
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

