import type { SearchIntent } from "@/lib/intent/schema";
import type { NearbyItem } from "@/lib/nearby/facts";
import type { SearchResult } from "@/lib/search";
import type { Suggestion } from "@/lib/search/suggest";

export type { SearchIntent, SearchResult, Suggestion };

export interface SearchApiResponse {
  query: string;
  intent: SearchIntent;
  results: SearchResult[];
  total: number;
  excluded: { placeholderPrice: number; sharedRoom: number };
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
