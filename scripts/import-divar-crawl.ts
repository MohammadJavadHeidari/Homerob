// Imports the output of scripts/divar_crawler.py into src/data/divar.json.
// Run: npm run import:divar-crawl -- <file.json|file.jsonl|dir>… [--auto-hoods] [--verbose] [--summary <file.md>]
//
//   data/raw/divar-crawl.json           a local snapshot (manual route)
//   .crawl-data/crawl                   all shards of the divar-data branch (what the GitHub Action passes)
//
// Cleaning rules live in src/lib/import/divar-crawl.ts. The same ad may appear in several shards: the
// latest crawl of a token wins. Existing ads in divar.json are kept; re-imported ids are replaced.
// --auto-hoods registers districts that aren't in the registry yet (src/data/auto-hoods.json, see
// src/lib/import/auto-hoods.ts) and imports their ads in the same run. Skips are printed with a reason.

import { appendFileSync, existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { proposeHoods, type DistrictSighting } from "../src/lib/import/auto-hoods";
import { crawledToListing, type CrawledAd } from "../src/lib/import/divar-crawl";
import { HOODS, linkAdjacent, type HoodInfo } from "../src/lib/places";
import type { Listing } from "../src/lib/types";

import { linkAll } from "./link-divar-images";

const OUT = "src/data/divar.json";
const AUTO_HOODS = "src/data/auto-hoods.json";

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const summaryFile = args.includes("--summary") ? args[args.indexOf("--summary") + 1] : undefined;
const inputs = args.filter((a, i) => !a.startsWith("--") && args[i - 1] !== "--summary");
if (!inputs.length) {
  console.error("usage: npm run import:divar-crawl -- <file.json|.jsonl|dir>… [--auto-hoods] [--verbose] [--summary out.md]");
  process.exit(1);
}

// ---------- read every input, newest crawl of each token wins ----------
function files(path: string): string[] {
  if (!statSync(path).isDirectory()) return [path];
  return readdirSync(path)
    .filter((f) => /\.jsonl?$/.test(f))
    .sort()
    .map((f) => join(path, f));
}

const byToken = new Map<string, CrawledAd>();
for (const file of inputs.flatMap(files)) {
  const raw = readFileSync(file, "utf8").trim();
  if (!raw) continue;
  const ads: CrawledAd[] = raw.startsWith("[") ? JSON.parse(raw) : raw.split("\n").filter(Boolean).map((l) => JSON.parse(l));
  for (const ad of ads) {
    const seen = byToken.get(ad.token);
    if (!seen || seen.crawled_at <= ad.crawled_at) byToken.set(ad.token, ad);
  }
}
const ads = [...byToken.values()];
if (!ads.length) {
  console.error(`no ads in ${inputs.join(", ")}`);
  process.exit(1);
}

// ---------- normalize ----------
function run(batch: CrawledAd[]) {
  const imported: Listing[] = [];
  const skipped = new Map<string, { ad: CrawledAd; place?: DistrictSighting }[]>();
  for (const ad of batch) {
    const r = crawledToListing(ad);
    if ("listing" in r) imported.push(r.listing);
    else skipped.set(r.skip, [...(skipped.get(r.skip) ?? []), { ad, place: r.place }]);
  }
  return { imported, skipped };
}

const first = run(ads);
let imported = first.imported;
const skipped = first.skipped;

// ---------- auto-register unknown districts, then import their ads too ----------
let registered: HoodInfo[] = [];
if (flag("--auto-hoods")) {
  const sightings = [...skipped.values()].flat().flatMap((s) => (s.place ? [s.place] : []));
  registered = proposeHoods(sightings, HOODS);
  if (registered.length) {
    const existing: HoodInfo[] = existsSync(AUTO_HOODS) ? JSON.parse(readFileSync(AUTO_HOODS, "utf8")) : [];
    writeFileSync(AUTO_HOODS, `${JSON.stringify([...existing, ...registered], null, 2)}\n`);
    HOODS.push(...registered); // this run sees them too
    linkAdjacent();
    const retry = [...skipped.values()].flat().filter((s) => s.place).map((s) => s.ad);
    const again = run(retry);
    imported = [...imported, ...again.imported];
    for (const [why, list] of [...skipped]) if (list.some((s) => s.place)) skipped.delete(why);
    for (const [why, list] of again.skipped) skipped.set(why, [...(skipped.get(why) ?? []), ...list]);
  }
}

// ---------- write ----------
const existing: Listing[] = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : [];
const byId = new Map(existing.map((l) => [l.id, l]));
const before = byId.size;
for (const l of imported) byId.set(l.id, JSON.parse(JSON.stringify(l)) as Listing); // drops undefined keys
const all = linkAll([...byId.values()].sort((a, b) => b.postedAt.localeCompare(a.postedAt)));
const out = `${JSON.stringify(all, null, 2)}\n`;
if (!existsSync(OUT) || readFileSync(OUT, "utf8") !== out) writeFileSync(OUT, out);

// ---------- report ----------
const perCategory = new Map<string, number>();
for (const l of all) perCategory.set(l.category ?? "residential-rent", (perCategory.get(l.category ?? "residential-rent") ?? 0) + 1);
const lines = [
  `${ads.length} ads read, ${imported.length} imported → ${OUT}: ${all.length} total (${all.length - before} new)`,
  `  by category: ${[...perCategory].map(([k, v]) => `${k} ${v}`).join(", ")}`,
  ...(registered.length
    ? [`  registered ${registered.length} districts in ${AUTO_HOODS}: ${registered.map((h) => `${h.name}${h.strict ? "*" : ""}`).join("، ")}`]
    : []),
  ...[...skipped].sort((a, b) => b[1].length - a[1].length).flatMap(([why, list]) => [
    `  skipped ${list.length} × ${why}`,
    ...(flag("--verbose") ? list.map(({ ad }) => `      ${ad.token}  ${ad.title}`) : []),
  ]),
];
console.log(lines.join("\n"));
if (summaryFile) {
  appendFileSync(summaryFile, `### Divar crawl import\n\n\`\`\`\n${lines.join("\n")}\n\`\`\`\n(* = strict name: matched in a query only as «محله X»)\n`);
}
