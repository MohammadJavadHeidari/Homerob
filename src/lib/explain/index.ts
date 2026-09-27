import "server-only";

import { z } from "zod";

import { activeProvider, chatJson } from "@/lib/ai/client";
import { CATEGORIES, categoryOf } from "@/lib/categories";
import { priceLineFa } from "@/lib/format";
import type { SearchIntent } from "@/lib/intent/schema";
import { formatToman, toEnDigits, toFaDigits } from "@/lib/persian";
import type { SearchResult } from "@/lib/search";

const SYSTEM_PROMPT = `You are Homerob, a friendly Persian real-estate assistant for Iranian cities (rentals, sales, offices/shops, short stays, construction projects). For each listing, write ONE short
Persian explanation (1–2 sentences, max ~200 characters) of how well it fits THIS user's request.

Rules:
- Use only the facts given (pros / cons / numbers). Never invent features, prices or places.
- Lead with the most important fit reason, then the single most important trade-off if there is one
  (e.g. "۵۰ میلیون زیر بودجه‌ته و خود وکیل‌آباده، ولی پارکینگ نداره.").
- Be concrete: mention money with Persian digits and "میلیون"/"میلیارد", and room counts / neighborhoods.
- Warm, natural, slightly colloquial Persian (like a helpful friend), second person. No emojis, no markdown,
  no greetings, don't repeat the listing title, don't start every item the same way.
- If the listing's rahn/ejare would be converted to fit the budget, say what the user would pay.

Output ONLY JSON: {"items":[{"id":"<listing id>","text":"<Persian explanation>"}]} with one item per listing, same ids.`;

const Output = z.object({ items: z.array(z.object({ id: z.string(), text: z.string().min(5).max(400) })) });

export interface Explanations {
  byId: Record<string, string>;
  source: "ai" | "rules";
  model: string | null;
  ms: number;
}

const cache = new Map<string, Explanations>();

/** One batched LLM call for all given results. Falls back to the rule-based explanations. */
export async function explainResults(
  query: string,
  intent: SearchIntent,
  results: SearchResult[],
): Promise<Explanations> {
  const started = Date.now();
  const fallback = (): Explanations => ({
    byId: Object.fromEntries(results.map((r) => [r.listing.id, r.explanation])),
    source: "rules",
    model: null,
    ms: Date.now() - started,
  });
  if (!results.length || activeProvider() === "mock") return fallback();

  const key = `${query}::${intent.nearMe ?? ""}::${results.map((r) => r.listing.id).join(",")}`;
  const hit = cache.get(key);
  if (hit) return hit;

  try {
    const { data, model } = await chatJson({
      system: SYSTEM_PROMPT,
      user: JSON.stringify({ query, intent: summarizeIntent(intent), listings: results.map(facts) }),
      temperature: 0.6,
      hedgeMs: 3_000,
      deadlineMs: 7_000,
    });
    const parsed = Output.parse(data);
    const byId: Record<string, string> = {};
    for (const r of results) {
      const text = parsed.items.find((i) => i.id === r.listing.id)?.text.trim();
      // Fill gaps and reject any text that mentions a number not present in the facts.
      byId[r.listing.id] = text && numbersAreGrounded(text, facts(r)) ? text : r.explanation;
    }
    const out: Explanations = { byId, source: "ai", model, ms: Date.now() - started };
    if (cache.size > 300) cache.delete(cache.keys().next().value!);
    cache.set(key, out);
    return out;
  } catch (err) {
    console.error("[explain] LLM failed, using rules:", err instanceof Error ? err.message : err);
    return fallback();
  }
}

function summarizeIntent(i: SearchIntent) {
  return {
    category: i.category ? CATEGORIES[i.category].label : null,
    maxPrice: i.maxPrice === null ? null : formatToman(i.maxPrice),
    maxDeposit: i.maxDeposit === null ? null : formatToman(i.maxDeposit),
    maxRent: i.maxRent === null ? null : formatToman(i.maxRent),
    city: i.city,
    neighborhoods: i.neighborhoods,
    userLivesNear: i.neighborhoods.length ? null : i.nearMe,
    rooms: i.minRooms === null ? null : i.maxRooms !== null && i.maxRooms !== i.minRooms ? `${i.minRooms}–${i.maxRooms}` : `${i.minRooms}+`,
    minArea: i.minArea,
    mustHave: i.mustHave,
    niceToHave: i.niceToHave,
    sharedRoom: i.sharedRoom,
    notes: i.freeTextNotes,
  };
}

function facts(r: SearchResult) {
  const l = r.listing;
  return {
    id: l.id,
    category: CATEGORIES[categoryOf(l)].label,
    city: l.city,
    neighborhood: l.neighborhood,
    rooms: !CATEGORIES[categoryOf(l)].residential ? null : l.rooms === 0 ? "سوئیت" : `${toFaDigits(l.rooms)} خوابه`,
    area: `${toFaDigits(l.areaM2)} متر`,
    listedPrice: priceLineFa(l),
    userWouldPay: r.budget.converted
      ? `رهن ${formatToman(r.budget.deposit)} + اجاره ${formatToman(r.budget.monthlyRent)}`
      : null,
    matchScore: r.score,
    pros: r.highlights.filter((h) => h.kind !== "con").map((h) => h.text),
    cons: r.highlights.filter((h) => h.kind === "con").map((h) => h.text),
  };
}

/** Every number in the LLM text must appear in the facts we sent (guards against invented prices). */
export function numbersAreGrounded(text: string, source: unknown): boolean {
  const nums = (s: string) => (toEnDigits(s).replace(/[٫.](?=\d)/g, ".").match(/\d+(?:\.\d+)?/g) ?? []);
  const allowed = new Set(nums(JSON.stringify(source)));
  return nums(text).every((n) => allowed.has(n) || Number(n) <= 10);
}
