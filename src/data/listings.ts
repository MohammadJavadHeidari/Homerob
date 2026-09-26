import type { Listing } from "@/lib/types";

import seed from "./listings.json";
import scraped from "./scraped.json";

/** Seeded sample listings (see scripts/generate-listings.mjs). */
export const seedListings = seed as Listing[];

/** Real Divar/Sheypoor listings imported from scraper CSVs (see scripts/import-scraped.ts). */
export const scrapedListings = scraped as Listing[];

/** Everything search sees: real scraped listings first, then the seeded sample. */
export const listings: Listing[] = [...scrapedListings, ...seedListings];
