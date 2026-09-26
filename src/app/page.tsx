import { SearchApp } from "@/components/search-app";
import { HERO_DATA_NAMES } from "@/lib/hood-stats";
import { getHoodStats, listCities } from "@/lib/store";

/** Re-read the neighborhood numbers and city list at most hourly. */
export const revalidate = 3600;

export default async function Home() {
  const [hoodStats, cities] = await Promise.all([
    getHoodStats(HERO_DATA_NAMES).catch(() => ({ total: 0, hoods: [] })),
    listCities().catch(() => []),
  ]);
  return <SearchApp hoodStats={hoodStats} coveredCities={cities.map((c) => c.cityFa)} />;
}
