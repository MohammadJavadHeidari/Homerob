import type { SearchIntent } from "@/lib/intent/schema";
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
