import type { Listing } from "@/lib/types";

import divar from "./divar.json";
import sample from "./listings.json";

/** Real Divar ads, imported by scripts/import-divar.ts (see docs/DATA.md). */
export const realListings = divar as Listing[];

/**
 * TEMPORARY: generated Mashhad sample set (scripts/generate-listings.mjs). Stays next to the real ads
 * until the owner decides to drop it (docs/PLAN.md, Open questions).
 */
export const sampleListings = sample as Listing[];

export const listings: Listing[] = [...realListings, ...sampleListings];
