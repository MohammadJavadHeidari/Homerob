import type { Listing } from "@/lib/types";

/** Where a listing's photo can be loaded from, best first: our own copy, then the source's (Divar's CDN). */
export function photoSources(l: Pick<Listing, "photo" | "imageUrl">): string[] {
  return [...new Set([l.photo, l.imageUrl].filter((s): s is string => Boolean(s)))];
}
