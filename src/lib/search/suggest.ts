import { listings as ALL_LISTINGS } from "@/data/listings";
import { CATEGORIES, categoryOf, DEFAULT_CATEGORY, type CategoryKey } from "@/lib/categories";
import { withCategory } from "@/lib/intent/category";
import type { SearchIntent } from "@/lib/intent/schema";
import { formatToman, toFaDigits } from "@/lib/persian";
import { COVERED_CITIES, isCovered } from "@/lib/places";

import { search } from "./index";

export interface Suggestion {
  /** Persian, e.g. "با ماهی ۷ میلیون، ۳ آگهی پیدا می‌شه". */
  text: string;
  /** The relaxed intent to search with if the user accepts. */
  intent: SearchIntent;
  count: number;
}

const round = (v: number, step: number) => Math.ceil(v / step) * step;

/** Listings in a category, in one city or anywhere (city null). */
export function categoryCount(category: CategoryKey, city: string | null): number {
  return ALL_LISTINGS.filter((l) => categoryOf(l) === category && (!city || l.city === city)).length;
}

/** When nothing fits, find the smallest sensible relaxation that returns results. */
export function suggest(intent: SearchIntent): Suggestion | null {
  const { maxDeposit: D, maxRent: R, maxPrice: P } = intent;

  // A category with no listings yet (here or anywhere): no budget change helps.
  const category = intent.category ?? DEFAULT_CATEGORY;
  if (category !== DEFAULT_CATEGORY && !categoryCount(category, intent.city)) {
    if (intent.city && categoryCount(category, null)) {
      const relaxed: SearchIntent = { ...intent, city: null, neighborhoods: [], nearMe: null };
      const { total } = search(relaxed);
      if (total > 0) return { text: `در شهرهای دیگر ${toFaDigits(total)} آگهی ${CATEGORIES[category].label} هست`, intent: relaxed, count: total };
    }
    const relaxed = withCategory(intent, DEFAULT_CATEGORY);
    const { total } = search(relaxed);
    const fallback = total ? relaxed : { ...relaxed, city: null, neighborhoods: [], nearMe: null };
    const count = total || search(fallback).total;
    return count > 0
      ? { text: `در «${CATEGORIES[DEFAULT_CATEGORY].label}» ${toFaDigits(count)} آگهی هست`, intent: fallback, count }
      : null;
  }

  // A city with no listings yet: no budget change helps, point to the cities that have some.
  if (intent.city && !isCovered(intent.city)) {
    const relaxed: SearchIntent = { ...intent, city: null, neighborhoods: [], nearMe: null };
    const { total } = search(relaxed);
    const where = COVERED_CITIES.join("، ");
    return total > 0
      ? { text: `در ${where} ${toFaDigits(total)} آگهی هست`, intent: relaxed, count: total }
      : null;
  }

  if (P !== null) {
    for (const f of [1.15, 1.3, 1.5, 2]) {
      const relaxed: SearchIntent = { ...intent, maxPrice: round(P * f, P < 100e6 ? 1e5 : 100e6) };
      const { total } = search(relaxed);
      if (total > 0) {
        return { text: `با ${formatToman(relaxed.maxPrice!)}، ${toFaDigits(total)} آگهی پیدا می‌شه`, intent: relaxed, count: total };
      }
    }
  }

  if (D !== null || R !== null) {
    for (const f of [1.15, 1.3, 1.5, 1.75, 2, 2.5]) {
      const relaxed: SearchIntent = {
        ...intent,
        maxDeposit: D === null ? null : round(D * f, 50e6),
        maxRent: R === null || R === 0 ? R : round(R * f, 5e5),
      };
      const { total } = search(relaxed);
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
    const { total } = search(relaxed);
    if (total > 0) return { text: `در کل شهر ${toFaDigits(total)} آگهی هست`, intent: relaxed, count: total };
  }

  if (intent.neighborhoods.length) {
    const relaxed = { ...intent, neighborhoods: [] };
    const { total } = search(relaxed);
    if (total > 0) return { text: `در بقیهٔ محله‌ها ${toFaDigits(total)} آگهی هست`, intent: relaxed, count: total };
  }
  return null;
}
