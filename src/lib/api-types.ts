import type { SearchIntent } from "@/lib/intent/schema";
import type { NearbyItem } from "@/lib/nearby/facts";
import type { SearchResult } from "@/lib/search";
import type { Suggestion } from "@/lib/search/suggest";
import type { PlaceGuess } from "@/lib/where";

export type { PlaceGuess, SearchIntent, SearchResult, Suggestion };

export interface SearchApiResponse {
  query: string;
  intent: SearchIntent;
  results: SearchResult[];
  total: number;
  excluded: { placeholderPrice: number; sharedRoom: number };
  /** Where the query text says they're looking; the UI asks when it's unclear. */
  where: PlaceGuess;
  /** Listings in the searched category (in the searched city, if any) before any other filter. */
  categoryCount: number;
  suggestion: Suggestion | null;
  meta: {
    intentSource: "ai" | "rules" | "edited";
    model: string | null;
    intentMs: number;
    totalMs: number;
  };
}

export interface ExplainApiResponse {
  byId: Record<string, string>;
  source: "ai" | "rules";
  model: string | null;
  ms: number;
}

export interface NearbyApiResponse {
  id: string;
  title: string;
  summary: string;
  items: (NearbyItem & { text: string })[];
  /** Where the places came from: Neshan live search + baked OSM, or OSM only (no key / Neshan down). */
  places: "neshan+osm" | "osm";
  /** Neshan health for debugging: "ok", "off" (no key) or "error <HTTP status>" (e.g. 485 = service not enabled). */
  neshan: string;
  source: "ai" | "rules";
  ms: number;
}
