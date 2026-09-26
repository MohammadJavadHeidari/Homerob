import type { Listing } from "@/lib/types";

import scraped from "./scraped.json";

/** Real Divar/Sheypoor listings imported from scraper CSVs (see scripts/import-scraped.ts). */
export const listings = scraped as Listing[];
