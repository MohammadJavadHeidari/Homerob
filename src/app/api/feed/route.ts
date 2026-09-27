import { z } from "zod";

import { buildFeed } from "@/lib/feed";
import { SearchIntentSchema } from "@/lib/intent/schema";

const Ids = z.array(z.string().max(40)).max(50);

const Body = z.object({
  city: z.string().max(40).nullable(),
  saved: Ids,
  viewed: Ids,
  last: z.object({ query: z.string().max(300), intent: SearchIntentSchema, at: z.number() }).nullable(),
});

/** Mobile home rails (src/lib/feed.ts) for the history kept on the visitor's phone. */
export async function POST(request: Request) {
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "bad request" }, { status: 400 });
  return Response.json(buildFeed(body.data));
}
