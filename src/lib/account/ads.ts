import { CATEGORIES, type CategoryKey } from "@/lib/categories";
import { canonicalCity, canonicalNeighborhood } from "@/lib/places";
import type { Listing } from "@/lib/types";

import type { Role } from "./session";

/**
 * Ads posted on Torob itself by a signed-in customer or agency (pure helpers, no storage).
 * A posted ad is a normal `Listing` (so search, ranking, cards and compare work unchanged) plus who posted it.
 */
export interface PostedAd extends Listing {
  source: "homerob";
  owner: Role;
  ownerPhone: string;
  /** Agency name, or empty for a private owner. */
  ownerName: string;
  /** Compressed JPEG data URLs (max PHOTO_MAX). */
  images: string[];
  status: "published" | "archived";
  /** How it got in: the form, a CSV/Excel file, or pasted ad text read by the AI. */
  via: "form" | "file" | "ai";
}

export const PHOTO_MAX = 4;
export const isPostedId = (id: string) => id.startsWith("hr-");

/** What the ad form edits. Numbers are null until typed; money in Toman. */
export interface AdDraft {
  category: CategoryKey;
  title: string;
  city: string;
  neighborhood: string;
  street: string;
  areaM2: number | null;
  rooms: number | null;
  floor: number | null;
  buildingAge: number | null;
  deposit: number | null;
  monthlyRent: number | null;
  price: number | null;
  nightlyPrice: number | null;
  elevator: boolean;
  parking: boolean;
  storage: boolean;
  tags: string[];
  convertible: boolean;
  description: string;
  images: string[];
}

export const EMPTY_DRAFT: AdDraft = {
  category: "residential-rent",
  title: "",
  city: "مشهد",
  neighborhood: "",
  street: "",
  areaM2: null,
  rooms: null,
  floor: null,
  buildingAge: null,
  deposit: null,
  monthlyRent: null,
  price: null,
  nightlyPrice: null,
  elevator: false,
  parking: false,
  storage: false,
  tags: [],
  convertible: false,
  description: "",
  images: [],
};

/** Extra features the form offers as chips (the same words the scorer reads from `tags`). */
export const TAG_OPTIONS = ["بالکن", "مبله", "حیاط", "لابی‌من", "استخر", "نزدیک قطار شهری", "کابینت", "پکیج"] as const;

export type DraftErrors = Partial<Record<keyof AdDraft, string>>;

export function validateDraft(d: AdDraft): DraftErrors {
  const e: DraftErrors = {};
  const model = CATEGORIES[d.category].priceModel;
  if (d.title.trim().length < 5) e.title = "یه عنوان کوتاه بنویس، مثلاً «آپارتمان ۸۵ متری دوخوابه».";
  if (!canonicalCity(d.city)) e.city = "شهر رو از فهرست انتخاب کن.";
  if (d.neighborhood.trim().length < 2) e.neighborhood = "محله رو بنویس.";
  if (!d.areaM2 || d.areaM2 < 10 || d.areaM2 > 100_000) e.areaM2 = "متراژ رو به متر مربع بنویس.";
  if (model === "rent" && !d.deposit && !d.monthlyRent) e.deposit = "رهن یا اجاره رو بنویس.";
  if (model === "sale" && !d.price) e.price = "قیمت کل رو بنویس.";
  if (model === "nightly" && !d.nightlyPrice) e.nightlyPrice = "قیمت هر شب رو بنویس.";
  return e;
}

const randomId = () =>
  `hr-${Array.from({ length: 8 }, () => "abcdefghijkmnpqrstuvwxyz23456789"[Math.floor(Math.random() * 32)]).join("")}`;

export function draftToAd(
  d: AdDraft,
  owner: { role: Role; phone: string; name: string },
  via: PostedAd["via"],
  base?: Pick<PostedAd, "id" | "postedAt" | "status">,
): PostedAd {
  const city = canonicalCity(d.city) ?? d.city.trim();
  const model = CATEGORIES[d.category].priceModel;
  return {
    id: base?.id ?? randomId(),
    source: "homerob",
    category: d.category,
    title: d.title.trim().slice(0, 120),
    city,
    // a registered neighborhood gets its canonical spelling, so search and the map find it
    neighborhood: canonicalNeighborhood(d.neighborhood.trim(), city) ?? d.neighborhood.trim().slice(0, 60),
    street: d.street.trim().slice(0, 120),
    deposit: model === "rent" ? (d.deposit ?? 0) : 0,
    monthlyRent: model === "rent" ? (d.monthlyRent ?? 0) : 0,
    price: model === "sale" ? (d.price ?? undefined) : undefined,
    nightlyPrice: model === "nightly" ? (d.nightlyPrice ?? undefined) : undefined,
    areaM2: d.areaM2 ?? 0,
    rooms: CATEGORIES[d.category].residential ? (d.rooms ?? undefined) : undefined,
    floor: d.floor ?? undefined,
    buildingAge: d.buildingAge ?? undefined,
    elevator: d.elevator,
    parking: d.parking,
    storage: d.storage,
    tags: d.tags.map((t) => t.slice(0, 40)).slice(0, 20),
    convertible: model === "rent" && d.convertible,
    description: d.description.trim().slice(0, 3000),
    postedAt: base?.postedAt ?? new Date().toISOString(),
    imageUrl: d.images[0],
    images: d.images.slice(0, PHOTO_MAX),
    owner: owner.role,
    ownerPhone: owner.phone,
    ownerName: owner.name,
    status: base?.status ?? "published",
    via,
  };
}

export function adToDraft(a: PostedAd): AdDraft {
  return {
    category: a.category ?? "residential-rent",
    title: a.title,
    city: a.city,
    neighborhood: a.neighborhood,
    street: a.street,
    areaM2: a.areaM2 || null,
    rooms: a.rooms ?? null,
    floor: a.floor ?? null,
    buildingAge: a.buildingAge ?? null,
    deposit: a.deposit || null,
    monthlyRent: a.monthlyRent || null,
    price: a.price ?? null,
    nightlyPrice: a.nightlyPrice ?? null,
    elevator: !!a.elevator,
    parking: !!a.parking,
    storage: !!a.storage,
    tags: a.tags,
    convertible: a.convertible,
    description: a.description,
    images: a.images,
  };
}

/** What gets sent to the server for search: the listing without photos or the poster's phone. */
export function toSearchable(a: PostedAd): Listing {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { images, owner, ownerPhone, ownerName, status, via, imageUrl, ...listing } = a;
  return listing;
}
