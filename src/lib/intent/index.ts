import "server-only";

import { activeProvider } from "@/lib/ai/client";
import { findCampus } from "@/lib/campuses";
import { normalizeFa } from "@/lib/text";

import { applyGroup, detectGroup } from "./group";
import { parseIntentWithLLM } from "./llm";
import { resolvePlace } from "./place";
import { parseIntentWithRules, wordsToDigits } from "./rules";
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
    result = { intent: resolvePlace(parseIntentWithRules(query)), source: "rules", model: null, ms: Date.now() - started };
  } else {
    try {
      const { intent, model } = await parseIntentWithLLM(query);
      result = { intent: resolvePlace(fillStudent(intent, query)), source: "ai", model, ms: Date.now() - started };
    } catch (err) {
      console.error("[intent] LLM failed, using rules:", err instanceof Error ? err.message : err);
      // Don't cache fallbacks: the LLM may be back on the next try.
      return { intent: resolvePlace(parseIntentWithRules(query)), source: "rules", model: null, ms: Date.now() - started };
    }
  }

  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!);
  cache.set(key, result);
  return result;
}

/**
 * The university and the group size are read from the text too: the LLM isn't asked for the
 * campus, and a lite model sometimes misses "۴ نفریم" (then a per-person budget is still per person).
 */
function fillStudent(intent: SearchIntent, query: string): SearchIntent {
  const text = wordsToDigits(normalizeFa(query));
  let next = intent;
  const campus = next.campus ? null : findCampus(text, next.city);
  if (campus) next = { ...next, campus: campus.id, city: next.city ?? campus.city };
  return next.people ? next : applyGroup(next, detectGroup(text));
}
