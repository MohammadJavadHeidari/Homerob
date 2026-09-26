import { approxPosition, catalogFromListings } from "@/lib/catalog";
import { HOOD_CENTERS } from "@/lib/geo";
import { makeContext } from "@/lib/search";
import type { HeroNeighborhood, Listing } from "@/lib/types";

import raw from "./synthetic-listings.json";

/**
 * The original synthetic Mashhad listings (scripts/generate-listings.mjs), kept as a test fixture:
 * hand-made anchors (dv-0901…dv-0910) pin down ranking, dedup and data-quality behavior.
 * Positions are placed around the six home-map neighborhood centers.
 */
export const SYNTHETIC: Listing[] = (raw as Listing[]).map((l) => ({
  ...l,
  ...approxPosition(l.id, HOOD_CENTERS[l.neighborhood as HeroNeighborhood]),
}));

export const SYNTHETIC_CATALOG = catalogFromListings(SYNTHETIC);
export const syntheticContext = () => makeContext(SYNTHETIC, SYNTHETIC_CATALOG);
