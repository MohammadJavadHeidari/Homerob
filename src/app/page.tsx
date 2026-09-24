import { SearchApp } from "@/components/search-app";
import { getHoodStats } from "@/lib/hood-stats";

export default function Home() {
  return <SearchApp hoodStats={getHoodStats()} />;
}
