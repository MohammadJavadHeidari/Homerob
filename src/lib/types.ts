export type ListingSource = "divar" | "sheypoor";

/** Canonical neighborhood name (see HOODS in src/lib/places.ts). Unique within a city. */
export type Neighborhood = string;

/** A rental (rahn/ejare) listing. All money values are in Toman. */
export interface Listing {
  id: string;
  source: ListingSource;
  title: string;
  /** Persian city name, e.g. "مشهد" (see CITIES in src/lib/places.ts). */
  city: string;
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
  totalFloors: number;
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
  /** Exact map position when the source gives one; otherwise derived inside the neighborhood. */
  lat?: number;
  lng?: number;
  /** Link to the original ad on Divar / Sheypoor (real listings). */
  url?: string;
}
