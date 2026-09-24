import type { Listing } from "@/lib/types";

import raw from "./listings.json";

/** Seeded sample listings (see scripts/generate-listings.mjs). */
export const listings = raw as Listing[];
