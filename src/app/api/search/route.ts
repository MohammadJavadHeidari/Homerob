import { z } from "zod";

import { parseIntent } from "@/lib/intent";
import { search } from "@/lib/search";

const Body = z.object({ query: z.string().trim().min(2).max(300) });

export async function POST(request: Request) {
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return Response.json({ error: "لطفاً چیزی بنویس که دنبالش هستی." }, { status: 400 });
  }

  const started = Date.now();
  const parsed = await parseIntent(body.data.query);
  const { results, total } = search(parsed.intent);

  return Response.json({
    query: body.data.query,
    intent: parsed.intent,
    results,
    total,
    meta: {
      intentSource: parsed.source,
      model: parsed.model,
      intentMs: parsed.ms,
      totalMs: Date.now() - started,
    },
  });
}
