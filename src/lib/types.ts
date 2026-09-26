export type ListingSource = "divar" | "sheypoor";

export const NEIGHBORHOODS = [
  "الهیه",
  "سجاد",
  "وکیل‌آباد",
  "احمدآباد",
  "هاشمیه",
  "قاسم‌آباد",
] as const;

export type Neighborhood = (typeof NEIGHBORHOODS)[number];

/** A rental (rahn/ejare) listing. All money values are in Toman. */
export interface Listing {
  id: string;
  source: ListingSource;
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
  /** Original ad on Divar/Sheypoor (scraped listings only). */
  url?: string;
}
