import { categoryOf, comparablePrice } from "@/lib/categories";
import type { Listing, ListingSource } from "@/lib/types";

/** Same apartment posted on several sites → one listing with `alsoOn`. Exact-match key for now. */
export function dedupe(listings: Listing[]): { listing: Listing; alsoOn: ListingSource[] }[] {
  const groups = new Map<string, Listing[]>();
  for (const l of listings) {
    // rahn/ejare are 0 outside rentals, so the category's own price is part of the key
    const key = [categoryOf(l), l.city, l.neighborhood, l.street, l.areaM2, l.rooms, l.floor, l.deposit, l.monthlyRent, comparablePrice(l)].join("|");
    groups.set(key, [...(groups.get(key) ?? []), l]);
  }
  return [...groups.values()].map((group) => {
    // Prefer the Divar copy (usually the richer description), then the newest.
    const sorted = [...group].sort(
      (a, b) => Number(b.source === "divar") - Number(a.source === "divar") || b.postedAt.localeCompare(a.postedAt),
    );
    const [primary, ...rest] = sorted;
    return { listing: primary, alsoOn: [...new Set(rest.map((l) => l.source))].filter((s) => s !== primary.source) };
  });
}
