import type { HeroNeighborhood } from "./types";

export interface HoodStat {
  hood: string;
  /** Comparable listings in the neighborhood. */
  count: number;
  /** Median price as full rahn (rent converted to deposit), Toman. */
  medianFullDeposit: number;
}

/** Home-map pin → the neighborhood's name in the Divar data. */
export const HERO_DATA_NAMES: Record<HeroNeighborhood, string> = {
  "الهیه": "الهیه",
  "سجاد": "بلوار سجاد",
  "وکیل‌آباد": "وکیل‌آباد",
  "احمدآباد": "احمدآباد",
  "هاشمیه": "هاشمیه",
  "قاسم‌آباد": "قاسم‌آباد (شهرک غرب)",
};
