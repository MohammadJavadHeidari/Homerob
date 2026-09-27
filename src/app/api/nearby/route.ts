import { nearbyAdvantages } from "@/lib/nearby";

/** Neighborhood advantages of one listing: real nearby places (OSM) + an AI-written, grounded summary. */
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id")?.trim();
  if (!id || id.length > 40) return Response.json({ error: "bad request" }, { status: 400 });
  const out = await nearbyAdvantages(id);
  if (!out) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json(out);
}
