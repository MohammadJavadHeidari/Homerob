import type { Listing } from "@/lib/types";

import raw from "./listings.json";

/**
 * Bundled fallback when there is no database: 1,000 real Mashhad rentals (40 in each of the 25
 * busiest neighborhoods) from the Divar datasets on Hugging Face, prices adjusted to 2026.
 * Built by scripts/realdata/clean.py (see data/real/README.md).
 */
export const listings = raw as Listing[];
