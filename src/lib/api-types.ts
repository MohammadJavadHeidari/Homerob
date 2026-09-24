import type { SearchIntent } from "@/lib/intent/schema";
import type { SearchResult } from "@/lib/search";
import type { Suggestion } from "@/lib/search/suggest";

export type { SearchIntent, SearchResult, Suggestion };

export interface SearchApiResponse {
  query: string;
  intent: SearchIntent;
  results: SearchResult[];
  total: number;
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
