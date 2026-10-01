import { listings } from "@/data/listings";

/** Real ads by id (?ids=a,b,c), in the order asked; for the account page's saved / recently viewed lists. */
export function GET(request: Request) {
  const ids = (new URL(request.url).searchParams.get("ids") ?? "").split(",").filter(Boolean).slice(0, 60);
  const byId = new Map(listings.map((l) => [l.id, l]));
  return Response.json({ listings: ids.map((id) => byId.get(id)).filter(Boolean) });
}
