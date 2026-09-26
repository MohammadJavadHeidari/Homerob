import { listings } from "@/data/listings";
import { HOODS } from "./places";
import { toFullDeposit } from "./pricing";
import { isComparable } from "./quality";

export interface HoodStat {
  city: string;
  hood: string;
  /** Comparable listings in the neighborhood. */
  count: number;
  /** Median price as full rahn (rent converted to deposit), Toman. */
  medianFullDeposit: number;
}

export interface CityStat {
  city: string;
  /** All listings in the city. */
  count: number;
}

function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

/** Per-city and per-neighborhood numbers shown on the home-page map. */
export function getHoodStats(): { total: number; cities: CityStat[]; hoods: HoodStat[] } {
  const comparable = listings.filter(isComparable);
  const cities = [...new Set(listings.map((l) => l.city))]
    .map((city) => ({ city, count: listings.filter((l) => l.city === city).length }))
    .sort((a, b) => b.count - a.count);
  return {
    total: listings.length,
    cities,
    hoods: HOODS.map(({ city, name }) => {
      const inHood = comparable.filter((l) => l.city === city && l.neighborhood === name);
      return { city, hood: name, count: inHood.length, medianFullDeposit: median(inHood.map(toFullDeposit)) };
    }),
  };
}
