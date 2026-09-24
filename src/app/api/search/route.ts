import { z } from "zod";

import { parseIntent } from "@/lib/intent";
import { SearchIntentSchema } from "@/lib/intent/schema";
import { search } from "@/lib/search";
import { suggest } from "@/lib/search/suggest";

const Body = z.object({
  query: z.string().trim().min(2).max(300),
  /** When the user edits the understood intent (removes a chip), search with it directly. */
  intent: SearchIntentSchema.optional(),
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
  const { results, total } = search(parsed.intent, undefined, Infinity);

  return Response.json({
    query: body.data.query,
    intent: parsed.intent,
    results,
    total,
    suggestion: total === 0 ? suggest(parsed.intent) : null,
    meta: {
      intentSource: parsed.source,
      model: parsed.model,
      intentMs: parsed.ms,
      totalMs: Date.now() - started,
    },
  });
}
