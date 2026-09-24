import { listings } from "@/data/listings";
import { toFullDeposit } from "./pricing";
import { isComparable } from "./quality";
import { NEIGHBORHOODS, type Neighborhood } from "./types";

export interface HoodStat {
  hood: Neighborhood;
  /** Comparable listings in the neighborhood. */
  count: number;
  /** Median price as full rahn (rent converted to deposit), Toman. */
  medianFullDeposit: number;
}

function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

/** Per-neighborhood numbers shown on the home-page map. */
export function getHoodStats(): { total: number; hoods: HoodStat[] } {
  const comparable = listings.filter(isComparable);
  return {
    total: listings.length,
    hoods: NEIGHBORHOODS.map((hood) => {
      const inHood = comparable.filter((l) => l.neighborhood === hood);
      return { hood, count: inHood.length, medianFullDeposit: median(inHood.map(toFullDeposit)) };
    }),
  };
}
