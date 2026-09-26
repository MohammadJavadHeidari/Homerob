import type { SearchIntent } from "@/lib/intent/schema";
import { formatToman, toFaDigits } from "@/lib/persian";

import { search, type SearchContext } from "./index";

export interface Suggestion {
  /** Persian, e.g. "با ماهی ۷ میلیون، ۳ آگهی پیدا می‌شه". */
  text: string;
  /** The relaxed intent to search with if the user accepts. */
  intent: SearchIntent;
  count: number;
}

const round = (v: number, step: number) => Math.ceil(v / step) * step;

/** When nothing fits, find the smallest sensible relaxation that returns results. */
export function suggest(intent: SearchIntent, ctx: SearchContext): Suggestion | null {
  const { maxDeposit: D, maxRent: R } = intent;

  if (D !== null || R !== null) {
    for (const f of [1.15, 1.3, 1.5, 1.75, 2, 2.5]) {
      const relaxed: SearchIntent = {
        ...intent,
        maxDeposit: D === null ? null : round(D * f, 50e6),
        maxRent: R === null || R === 0 ? R : round(R * f, 5e5),
      };
      const { total } = search(relaxed, ctx);
      if (total > 0) {
        const parts = [
          relaxed.maxDeposit !== null && relaxed.maxDeposit !== D ? `رهن ${formatToman(relaxed.maxDeposit)}` : null,
          relaxed.maxRent !== null && relaxed.maxRent !== R ? `ماهی ${formatToman(relaxed.maxRent)}` : null,
        ].filter(Boolean);
        return { text: `با ${parts.join(" و ")}، ${toFaDigits(total)} آگهی پیدا می‌شه`, intent: relaxed, count: total };
      }
    }
  }

  if (intent.nearMe && !intent.neighborhoods.length) {
    const relaxed = { ...intent, nearMe: null };
    const { total } = search(relaxed, ctx);
    if (total > 0) return { text: `در کل شهر ${toFaDigits(total)} آگهی هست`, intent: relaxed, count: total };
  }

  if (intent.neighborhoods.length) {
    const relaxed = { ...intent, neighborhoods: [] };
    const { total } = search(relaxed, ctx);
    if (total > 0) return { text: `در بقیهٔ محله‌ها ${toFaDigits(total)} آگهی هست`, intent: relaxed, count: total };
  }
  return null;
}
