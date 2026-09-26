import { z } from "zod";

import { nearestHood } from "@/lib/catalog";
import { parseIntent } from "@/lib/intent";
import { SearchIntentSchema } from "@/lib/intent/schema";
import { search } from "@/lib/search";
import { suggest } from "@/lib/search/suggest";
import { getCatalog, getContext, resolveCity, storeKind } from "@/lib/store";

const Body = z.object({
  query: z.string().trim().min(2).max(300),
  /** When the user edits the understood intent (removes a chip), search with it directly. */
  intent: SearchIntentSchema.optional(),
  /** The user's browser location: picks their city and, unless the query names one, their neighborhood. */
  at: z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }).optional(),
});

export async function POST(request: Request) {
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return Response.json({ error: "لطفاً چیزی بنویس که دنبالش هستی." }, { status: 400 });
  }

  const started = Date.now();
  const { query, at } = body.data;
  try {
    const city = body.data.intent?.city ?? (await resolveCity(query, at)).city;
    const catalog = await getCatalog(city);
    const parsed = body.data.intent
      ? { intent: { ...body.data.intent, city }, source: "edited" as const, model: null, ms: 0 }
      : await parseIntent(query, catalog);
    const near = !body.data.intent && at && !parsed.intent.neighborhoods.length ? nearestHood(catalog, at) : null;
    const intent = near ? { ...parsed.intent, nearMe: near } : parsed.intent;

    const ctx = await getContext(intent, catalog);
    const { results, total, excluded } = search(intent, ctx, Infinity);
    const suggestion = total === 0 ? suggest(intent, await getContext(intent, catalog, true)) : null;

    return Response.json({
      query,
      city: catalog.city,
      cityFa: catalog.cityFa,
      intent,
      results,
      total,
      excluded,
      suggestion,
      meta: {
        intentSource: parsed.source,
        model: parsed.model,
        intentMs: parsed.ms,
        totalMs: Date.now() - started,
        store: storeKind(),
        candidates: ctx.listings.length,
      },
    });
  } catch (err) {
    console.error("[search] failed:", err instanceof Error ? err.message : err);
    return Response.json({ error: "جستجو الان ممکن نشد؛ چند لحظه بعد دوباره امتحان کن." }, { status: 503 });
  }
}
