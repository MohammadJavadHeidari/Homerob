import { normalizeFa } from "./text";
import type { Listing } from "./types";

/**
 * Sellers who don't want to state a price type a dummy number ("۱٬۰۰۰ تومان", "۱۱۱۱۱۱۱").
 * Such listings are kept out of ranking and neighborhood medians — never treated as a bargain.
 */
export function isPlaceholderPrice(l: Pick<Listing, "deposit" | "monthlyRent">): boolean {
  const tiny = l.deposit < 5e6 && l.monthlyRent < 5e5;
  const repeated = (n: number) => n >= 1e5 && /^(\d)\1+$/.test(String(Math.round(n)));
  return tiny || repeated(l.deposit) || repeated(l.monthlyRent);
}

const SHARED = /هم ?خونه|هم ?خانه|هم ?اتاقی|اجاره (?:ی )?اتاق|اتاق اجاره|خوابگاه|پانسیون/;

/** A room in a shared flat: its price is for one room, not a whole unit. */
export function isSharedHousing(l: Pick<Listing, "title" | "description">): boolean {
  return SHARED.test(normalizeFa(`${l.title} ${l.description}`));
}

/** A regular, fairly priced whole-unit listing — the only kind used for medians. */
export function isComparable(l: Listing): boolean {
  return !isPlaceholderPrice(l) && !isSharedHousing(l);
}
