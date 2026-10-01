// Imports the output of scripts/divar_crawler.py into src/data/divar.json.
// Run: npm run import:divar-crawl -- data/raw/divar-crawl.json [--verbose]   (.jsonl works too)
//
// Cleaning rules live in src/lib/import/divar-crawl.ts. Existing ads are kept; re-imported ids are
// replaced (fresher crawl wins). Prints what was skipped and why — "neighborhood not registered (…)"
// lines name districts worth adding to HOODS in src/lib/places.ts.

import { existsSync, readFileSync, writeFileSync } from "node:fs";

import { crawledToListing, type CrawledAd } from "../src/lib/import/divar-crawl";
import type { Listing } from "../src/lib/types";

import { linkAll } from "./link-divar-images";

const OUT = "src/data/divar.json";

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--"));
const verbose = args.includes("--verbose");
if (!file) {
  console.error("usage: npm run import:divar-crawl -- data/raw/divar-crawl.json [--verbose]");
  process.exit(1);
}

const raw = readFileSync(file, "utf8").trim();
const ads: CrawledAd[] = raw.startsWith("[")
  ? JSON.parse(raw)
  : raw.split("\n").filter(Boolean).map((line) => JSON.parse(line));
if (!ads.length) {
  console.error(`${file} has no ads`);
  process.exit(1);
}

const imported: Listing[] = [];
const skipped: Record<string, string[]> = {};
for (const ad of ads) {
  const r = crawledToListing(ad);
  if ("listing" in r) imported.push(r.listing);
  else (skipped[r.skip] ??= []).push(`${ad.token}  ${ad.title}`);
}

const existing: Listing[] = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : [];
const byId = new Map(existing.map((l) => [l.id, l]));
for (const l of imported) byId.set(l.id, JSON.parse(JSON.stringify(l)) as Listing); // drops undefined keys
const all = linkAll([...byId.values()].sort((a, b) => b.postedAt.localeCompare(a.postedAt)));
writeFileSync(OUT, `${JSON.stringify(all, null, 2)}\n`);

console.log(`${ads.length} ads read, ${imported.length} imported → ${OUT} (${all.length} total)`);
for (const [why, items] of Object.entries(skipped).sort((a, b) => b[1].length - a[1].length)) {
  console.log(`  skipped ${items.length} × ${why}`);
  if (verbose) for (const t of items) console.log(`      ${t}`);
}
