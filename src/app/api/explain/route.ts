import { z } from "zod";

import { explainResults } from "@/lib/explain";
import { SearchIntentSchema } from "@/lib/intent/schema";
import { resultsByIds } from "@/lib/search";
import { DEFAULT_CITY, getCatalog, getContext } from "@/lib/store";

const Body = z.object({
  query: z.string().trim().min(2).max(300),
  intent: SearchIntentSchema,
  ids: z.array(z.string().max(20)).min(1).max(10),
});

/** AI explanations for already-ranked results. Facts are recomputed server-side from the ids. */
export async function POST(request: Request) {
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "bad request" }, { status: 400 });

  const { query, intent, ids } = body.data;
  try {
    const catalog = await getCatalog(intent.city ?? DEFAULT_CITY);
    const results = resultsByIds(intent, await getContext(intent, catalog), ids);
    const explanations = await explainResults(query, intent, results);
    return Response.json(explanations);
  } catch (err) {
    console.error("[explain] failed:", err instanceof Error ? err.message : err);
    return Response.json({ error: "unavailable" }, { status: 503 });
  }
}
