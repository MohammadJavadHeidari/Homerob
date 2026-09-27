import "server-only";

import { z } from "zod";

import { listings } from "@/data/listings";
import pois from "@/data/pois.json";
import { activeProvider, chatJson } from "@/lib/ai/client";
import type { NearbyApiResponse } from "@/lib/api-types";
import { listingLatLng } from "@/lib/geo";
import { BUS_MINUTES, itemText, nearbyItems, ruleSummary, ruleTitle, type Poi } from "@/lib/nearby/facts";
import { neshanPois } from "@/lib/nearby/neshan";
import { toEnDigits, toFaDigits } from "@/lib/persian";

/** `title`: catchy one-liner; `summary`: one sentence like a friend who lives there (may be empty). */
export type NearbyAdvantages = NearbyApiResponse;

const POIS = (pois as { cities: Record<string, Poi[]> }).cities;

const SYSTEM_PROMPT = `You are Torob's rental assistant. A user is looking at a home for rent. You get the REAL places within
walking distance of it (from Neshan / OpenStreetMap map data). Write the "neighborhood advantages" section in Persian, like a friend
who has lived in that neighborhood for years.

Rules:
- ONLY advantages. Never mention anything missing, far or negative.
- Use only the facts given. Never invent a place, a name, a number or "24h" status. Keep real names exactly.
- "title": a catchy headline, max ~40 characters, no quotes, no emoji (e.g. "مترو و نون تازه، دو قدمیِ در").
- "summary": ONE warm, colloquial sentence (max ~140 characters) about everyday life here, second person.
- "items": one short line per fact (max ~70 characters) with the same "key". Mention the walking minutes from the
  fact (e.g. "۲ دقیقه پیاده" or "یه ربع پیاده" for 15). Say "شبانه‌روزی" only when h24 is true.
  For the bus fact, mention how many stops.
- Persian digits. No markdown.

Output ONLY JSON: {"title":"…","summary":"…","items":[{"key":"…","text":"…"}]}`;

const Output = z.object({
  title: z.string().min(4).max(80),
  summary: z.string().max(260),
  items: z.array(z.object({ key: z.string(), text: z.string().min(3).max(140) })),
});

const cache = new Map<string, NearbyAdvantages>();

export async function nearbyAdvantages(id: string): Promise<NearbyAdvantages | null> {
  const hit = cache.get(id);
  if (hit) return hit;
  const listing = listings.find((l) => l.id === id);
  if (!listing) return null;

  const started = Date.now();
  const home = listingLatLng(listing);
  // Neshan (live, richest for Iran) + baked OSM places; the closest real place per category wins
  const live = await neshanPois(home);
  const items = nearbyItems(home, [...(live ?? []), ...(POIS[listing.city] ?? [])]);
  const rules: NearbyAdvantages = {
    id,
    title: items.length ? ruleTitle(items) : "",
    summary: ruleSummary(items),
    items: items.map((i) => ({ ...i, text: itemText(i) })),
    places: live ? "neshan+osm" : "osm",
    source: "rules",
    ms: 0,
  };
  // a failed Neshan call isn't cached either: the next open tries again
  const keep = (a: NearbyAdvantages) => (live || !process.env.NESHAN_API_KEY ? remember(a) : a);
  if (!items.length || activeProvider() === "mock") return keep({ ...rules, ms: Date.now() - started });

  try {
    const facts = items.map((i) => ({
      key: i.key,
      kind: i.label,
      name: i.name,
      walkMinutes: toFaDigits(i.minutes),
      h24: i.h24,
      ...(i.count ? { stops: toFaDigits(i.count), stopsWithinWalkMinutes: toFaDigits(BUS_MINUTES) } : {}),
    }));
    const { data } = await chatJson({
      system: SYSTEM_PROMPT,
      user: JSON.stringify({ neighborhood: listing.neighborhood, city: listing.city, places: facts }),
      temperature: 0.7,
      hedgeMs: 3_000,
      deadlineMs: 7_000,
    });
    const out = Output.parse(data);
    const all = JSON.stringify(facts);
    // numbers and "24h" must come from the facts the text is about
    const ok = (text: string, own: string) => grounded(text, numbersIn(own)) && (!/شبانه/.test(text) || /شبانه|"h24":true/.test(own));
    return keep({
      ...rules,
      title: ok(out.title, all) ? out.title.trim() : rules.title,
      summary: ok(out.summary, all) ? out.summary.trim() : rules.summary,
      items: rules.items.map((i, n) => {
        const text = out.items.find((x) => x.key === i.key)?.text.trim();
        // every number in a line must be that place's own number (no invented minutes)
        return text && ok(text, JSON.stringify(facts[n])) ? { ...i, text } : i;
      }),
      source: "ai",
      ms: Date.now() - started,
    });
  } catch (err) {
    console.error("[nearby] LLM failed, using rules:", err instanceof Error ? err.message : err);
    return { ...rules, ms: Date.now() - started }; // not cached: the AI may answer next time
  }
}

function remember(a: NearbyAdvantages) {
  if (cache.size > 500) cache.delete(cache.keys().next().value!);
  cache.set(a.id, a);
  return a;
}

const numbersIn = (s: string) => new Set(toEnDigits(s).match(/\d+/g) ?? []);

/** Strict: unlike the listing explanations, even small numbers must come from the facts. */
export function grounded(text: string, allowed: Set<string>): boolean {
  return [...numbersIn(text)].every((n) => allowed.has(n));
}
