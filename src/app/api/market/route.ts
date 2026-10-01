import { HOOD_MEDIAN_PPM, HOOD_SAMPLE_SIZE } from "@/lib/search/score";

/**
 * Median price per m² of the real ads, per category/city/neighborhood (the same numbers the search page's
 * price verdict uses). The agency panel compares each of its files against these.
 */
export function GET() {
  const byKey = Object.fromEntries(
    Object.entries(HOOD_MEDIAN_PPM).map(([key, medianPpm]) => [key, { medianPpm, sample: HOOD_SAMPLE_SIZE[key] ?? 0 }]),
  );
  return Response.json({ byKey });
}
