import "server-only";

import { activeProvider } from "@/lib/ai/client";
import { normalizeFa } from "@/lib/text";

import { parseIntentWithLLM } from "./llm";
import { parseIntentWithRules } from "./rules";
import type { SearchIntent } from "./schema";

export interface ParsedIntent {
  intent: SearchIntent;
  /** "ai" = LLM understood it; "rules" = deterministic parser (mock provider or LLM failure). */
  source: "ai" | "rules";
  model: string | null;
  ms: number;
}

const cache = new Map<string, ParsedIntent>();
const CACHE_MAX = 300;

/** Understand a Persian query. Never throws: falls back to the rule-based parser. */
export async function parseIntent(query: string): Promise<ParsedIntent> {
  const key = normalizeFa(query);
  const hit = cache.get(key);
  if (hit) return hit;

  const started = Date.now();
  let result: ParsedIntent;
  if (activeProvider() === "mock") {
    result = { intent: parseIntentWithRules(query), source: "rules", model: null, ms: Date.now() - started };
  } else {
    try {
      const { intent, model } = await parseIntentWithLLM(query);
      result = { intent, source: "ai", model, ms: Date.now() - started };
    } catch (err) {
      console.error("[intent] LLM failed, using rules:", err instanceof Error ? err.message : err);
      // Don't cache fallbacks: the LLM may be back on the next try.
      return { intent: parseIntentWithRules(query), source: "rules", model: null, ms: Date.now() - started };
    }
  }

  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!);
  cache.set(key, result);
  return result;
}
