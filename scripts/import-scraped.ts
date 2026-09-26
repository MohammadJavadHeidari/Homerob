// Imports CSVs exported by the Ultimate Web Scraper Chrome extension into src/data/scraped.json.
// Run: npm run import:scraped            (reads every data/raw/*.csv)
//      npm run import:scraped -- a.csv   (specific files)
// A file name that names a neighborhood or site («sajad-divar.csv», «سجاد.csv») is used as the
// fallback for rows that don't say it themselves. Re-running replaces scraped.json.

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

import { csvRecords, rowToListing, type GuessedField, type SkipReason } from "../src/lib/import/scraped";
import { findNeighborhoods } from "../src/lib/neighborhoods";
import type { Listing, ListingSource, Neighborhood } from "../src/lib/types";

const RAW_DIR = "data/raw";
const OUT = "src/data/scraped.json";

/** Latin file-name spellings → neighborhood. */
const LATIN_HOODS: [RegExp, Neighborhood][] = [
  [/elah?i/i, "الهیه"],
  [/sajj?ad/i, "سجاد"],
  [/vakil/i, "وکیل‌آباد"],
  [/ahmad/i, "احمدآباد"],
  [/hashem/i, "هاشمیه"],
  [/gh?asem|qasem/i, "قاسم‌آباد"],
];

function fileHints(file: string): { hood: Neighborhood | null; source?: ListingSource } {
  const name = basename(file);
  const hood = findNeighborhoods(name)[0] ?? LATIN_HOODS.find(([re]) => re.test(name))?.[1] ?? null;
  const source = /sheypoor|شیپور/i.test(name) ? "sheypoor" : /divar|دیوار/i.test(name) ? "divar" : undefined;
  return { hood, source };
}

const args = process.argv.slice(2);
const files = args.length ? args : readdirSync(RAW_DIR).filter((f) => f.endsWith(".csv")).map((f) => join(RAW_DIR, f));
if (!files.length) {
  console.error(`No CSV files. Put exports from the extension in ${RAW_DIR}/ (see ${RAW_DIR}/README.md).`);
  process.exit(1);
}

const now = new Date();
const byId = new Map<string, Listing>();
const skipped: Partial<Record<SkipReason, number>> = {};
const guessed: Partial<Record<GuessedField, number>> = {};

for (const file of files) {
  const hints = fileHints(file);
  const records = csvRecords(readFileSync(file, "utf8"));
  let ok = 0;
  for (const rec of records) {
    const r = rowToListing(rec, { now, fallbackNeighborhood: hints.hood, fallbackSource: hints.source });
    if (!r.ok) {
      skipped[r.reason] = (skipped[r.reason] ?? 0) + 1;
      continue;
    }
    ok++;
    for (const g of r.value.guessed) guessed[g] = (guessed[g] ?? 0) + 1;
    byId.set(r.value.listing.id, r.value.listing); // same ad in two files → keep the last
  }
  console.log(`${file}: ${ok}/${records.length} rows imported (fallback hood: ${hints.hood ?? "none"})`);
  if (records[0]) console.log(`  columns: ${Object.keys(records[0]).join(" | ")}`);
}

const listings = [...byId.values()].sort((a, b) => b.postedAt.localeCompare(a.postedAt));
writeFileSync(OUT, JSON.stringify(listings, null, 2) + "\n");

const perHood = Object.groupBy(listings, (l) => l.neighborhood);
console.log(`\nWrote ${listings.length} listings to ${OUT}`);
console.log("per neighborhood:", Object.fromEntries(Object.entries(perHood).map(([k, v]) => [k, v?.length])));
console.log("skipped rows:", skipped);
console.log("fields filled with a default (not on the scraped page):", guessed);
