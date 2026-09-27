import { categoryOf, comparablePrice, priceModelOf } from "./categories";
import { normalizeFa } from "./text";
import type { Listing } from "./types";

/**
 * Sellers who don't want to state a price type a dummy number ("۱٬۰۰۰ تومان", "۱۱۱۱۱۱۱").
 * Such listings are kept out of ranking and neighborhood medians — never treated as a bargain.
 */
export function isPlaceholderPrice(l: Pick<Listing, "category" | "deposit" | "monthlyRent" | "price" | "nightlyPrice">): boolean {
  const repeated = (n: number) => n >= 1e5 && /^(\d)\1+$/.test(String(Math.round(n)));
  const model = priceModelOf(categoryOf(l));
  if (model !== "rent") {
    // no price ("توافقی"), a dummy number, or one no sale / night could cost
    const p = comparablePrice(l);
    return p < (model === "sale" ? 50e6 : 1e5) || repeated(p);
  }
  const tiny = l.deposit < 5e6 && l.monthlyRent < 5e5;
  return tiny || repeated(l.deposit) || repeated(l.monthlyRent);
}

const SHARED = /همخونه|هم خونه|هماتاقی|هم اتاقی|اجاره اتاق|اتاق اجاره/;

/** A room in a shared flat: its price is for one room, not a whole unit. */
export function isSharedHousing(l: Pick<Listing, "title" | "description">): boolean {
  return SHARED.test(normalizeFa(`${l.title} ${l.description}`));
}

/** A regular, fairly priced whole-unit listing — the only kind used for medians. */
export function isComparable(l: Listing): boolean {
  return !isPlaceholderPrice(l) && !isSharedHousing(l);
}
