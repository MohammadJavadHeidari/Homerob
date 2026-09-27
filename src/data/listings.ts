import type { Listing } from "@/lib/types";

import divar from "./divar.json";

/** Real Divar ads, imported by scripts/import-divar.ts (see docs/DATA.md). */
export const listings = divar as Listing[];
