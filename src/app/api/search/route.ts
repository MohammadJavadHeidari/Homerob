import { z } from "zod";

import { parseIntent } from "@/lib/intent";
import { applyPlace, resolvePlace } from "@/lib/intent/place";
import { SearchIntentSchema } from "@/lib/intent/schema";
import { hoodInfo } from "@/lib/places";
import { DEFAULT_CATEGORY } from "@/lib/categories";
import { search } from "@/lib/search";
import { categoryCount, suggest } from "@/lib/search/suggest";
import { detectPlace } from "@/lib/where";

const Body = z.object({
  query: z.string().trim().min(2).max(300),
  /** When the user edits the understood intent (removes a chip), search with it directly. */
  intent: SearchIntentSchema.optional(),
  /** The user's neighborhood from browser location; limits results to their area unless the query names one. */
  near: z
    .string()
    .max(60)
    .optional()
    .transform((n) => (n && hoodInfo(n) ? n : undefined)),
});

export async function POST(request: Request) {
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return Response.json({ error: "لطفاً چیزی بنویس که دنبالش هستی." }, { status: 400 });
  }

  const started = Date.now();
  const parsed = body.data.intent
    ? { intent: body.data.intent, source: "edited" as const, model: null, ms: 0 }
    : await parseIntent(body.data.query);
  const { near } = body.data;
  // Where the text says they're looking (instant, offline); the UI shows it and asks when unclear.
  const where = detectPlace(body.data.query);
  const placed = body.data.intent ? parsed.intent : applyPlace(parsed.intent, where);
  // resolvePlace drops "near me" when the query names another city.
  const intent = resolvePlace(!body.data.intent && near && !placed.neighborhoods.length ? { ...placed, nearMe: near } : placed);
  const { results, total, excluded } = search(intent, undefined, Infinity);

  return Response.json({
    query: body.data.query,
    intent,
    results,
    total,
    excluded,
    where,
    categoryCount: categoryCount(intent.category ?? DEFAULT_CATEGORY, intent.city),
    suggestion: total === 0 ? suggest(intent) : null,
    meta: {
      intentSource: parsed.source,
      model: parsed.model,
      intentMs: parsed.ms,
      totalMs: Date.now() - started,
    },
  });
}
