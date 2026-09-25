import { existsSync } from "node:fs";
import path from "node:path";

import { SearchApp } from "@/components/search-app";
import { getHoodStats } from "@/lib/hood-stats";

/** Torob's logo, if the owner has dropped it into public/brand/ (the home page shows «ترب» either way). */
const BRAND_LOGO = ["torob-logo.svg", "torob-logo.png", "torob-logo.webp"]
  .map((f) => `/brand/${f}`)
  .find((src) => existsSync(path.join(process.cwd(), "public", src)));

export default function Home() {
  return <SearchApp hoodStats={getHoodStats()} brandLogo={BRAND_LOGO} />;
}
