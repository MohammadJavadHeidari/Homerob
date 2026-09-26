export type ListingSource = "divar" | "sheypoor";

/**
 * The six Mashhad neighborhoods pinned on the home-page map (hero animation only). Search works on
 * whatever neighborhoods the data has for the chosen city (see `CityCatalog`).
 */
export const HERO_NEIGHBORHOODS = ["الهیه", "سجاد", "وکیل‌آباد", "احمدآباد", "هاشمیه", "قاسم‌آباد"] as const;
export type HeroNeighborhood = (typeof HERO_NEIGHBORHOODS)[number];

/** Persian neighborhood name as the data spells it (or the city name when the ad has none). */
export type Neighborhood = string;

/** A rental (rahn/ejare) listing. All money values are in Toman. */
export interface Listing {
  id: string;
  source: ListingSource;
  /** Divar city slug, e.g. "mashhad". */
  city?: string;
  cityFa?: string;
  title: string;
  neighborhood: Neighborhood;
  /** Street / landmark, e.g. "هاشمیه ۴۲". */
  street: string;
  /** Rahn / vadie (refundable deposit), Toman. */
  deposit: number;
  /** Ejare (monthly rent), Toman. 0 means full rahn. */
  monthlyRent: number;
  areaM2: number;
  /** Bedrooms. 0 = studio (suite). */
  rooms: number;
  floor: number;
  /** null when the ad does not say. */
  totalFloors: number | null;
  /** Years since construction. 0 = brand new. */
  buildingAge: number;
  elevator: boolean;
  parking: boolean;
  storage: boolean;
  /** Extra amenities / notes, e.g. "بالکن", "مبله", "نزدیک قطار شهری". */
  tags: string[];
  /** Whether the landlord accepts converting deposit ↔ rent. */
  convertible: boolean;
  description: string;
  /** ISO date-time. */
  postedAt: string;
  imageUrl?: string;
  /** Map position. Approximate (neighborhood center + jitter) when `approxLocation`. */
  lat?: number;
  lng?: number;
  approxLocation?: boolean;
  /** Link to the original ad, when known. */
  url?: string | null;
}
