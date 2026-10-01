// Points src/data/divar.json at the thumbnails in public/img/divar/ (downloaded on the owner's machine by
// `python3 scripts/divar_crawler.py --images`). Run: npm run link:divar-images
//
// An ad gets `photo` only when its file exists; ids in src/data/hidden-photos.json lose their photo entirely.
// The importers run the same step, so a re-import keeps the links.

import { existsSync, readFileSync, writeFileSync } from "node:fs";

import { linkPhotos, PHOTO_DIR } from "../src/lib/import/photos";
import type { Listing } from "../src/lib/types";

const OUT = "src/data/divar.json";
const HIDDEN = "src/data/hidden-photos.json";

export function linkAll(listings: Listing[]): Listing[] {
  const hidden = new Set<string>(existsSync(HIDDEN) ? JSON.parse(readFileSync(HIDDEN, "utf8")) : []);
  return linkPhotos(listings, (id) => existsSync(`${PHOTO_DIR}/${id}.webp`), hidden);
}

if (process.argv[1]?.endsWith("link-divar-images.ts")) {
  const all = linkAll(JSON.parse(readFileSync(OUT, "utf8")));
  writeFileSync(OUT, `${JSON.stringify(all, null, 2)}\n`);
  const own = all.filter((l) => l.photo).length;
  const remote = all.filter((l) => !l.photo && l.imageUrl).length;
  console.log(`${all.length} ads: ${own} with our own copy, ${remote} only on Divar's CDN, ${all.length - own - remote} without a photo`);
}
