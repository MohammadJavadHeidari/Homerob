import "server-only";

import { AMENITIES, AMENITY_KEYS } from "@/lib/amenities";
import { chatJson } from "@/lib/ai/client";
import { canonicalNeighborhood, type CityCatalog } from "@/lib/catalog";

import { SearchIntentSchema, type SearchIntent } from "./schema";

const AMENITY_LIST = AMENITY_KEYS.map((k) => `${k} (${AMENITIES[k].label})`).join(", ");

/** Neighborhood names offered to the model (most listings first). */
const PROMPT_HOODS = 90;

const systemPrompt = (catalog: CityCatalog) => `You convert a Persian rental-housing search query (${catalog.cityFa}, Iran) into a strict JSON object.

Output ONLY a JSON object with exactly these keys:
{
  "maxDeposit": number | null,        // max rahn / vadie / pool-e pish the user can pay, in TOMAN
  "maxRent": number | null,           // max monthly ejare, in TOMAN
  "flexibleConversion": boolean,      // false only if the user refuses to shift money between rahn and ejare
  "neighborhoods": string[],          // only from: ${catalog.hoods.slice(0, PROMPT_HOODS).map((h) => h.name).join("، ")}
  "minRooms": number | null,          // bedrooms; سوئیت/استودیو = 0
  "maxRooms": number | null,          // set only for ranges ("سوئیت یا یک‌خوابه" → 0..1) or an explicit maximum
  "minArea": number | null,           // square meters; for "حدود X متر" use ~0.85·X
  "mustHave": string[],               // required amenities, keys from the list below
  "niceToHave": string[],             // preferred amenities ("ترجیحاً", "اگه… بهتره")
  "sharedRoom": boolean,              // true only if they want a room in a shared flat (همخونه / اجاره اتاق)
  "freeTextNotes": string | null      // short Persian note for anything else useful (household, lifestyle); else null
}
Amenity keys: ${AMENITY_LIST}.

Money rules (critical):
- Everything is TOMAN. "میلیون" = 1,000,000; "میلیارد" = 1,000,000,000; "هزار" = 1,000.
- Colloquially "تومن"/"تومان" after a small number means MILLION: "ماهی ۸ تومن" → maxRent 8000000, "۵۰۰ تومن رهن" → maxDeposit 500000000.
- Bare numbers after رهن/اجاره are millions ("رهن ۳۰۰ اجاره ۱۰" → 300000000 / 10000000); "رهن ۱.۵" means 1.5 میلیارد.
- Persian and Arabic digits and number words (پونصد = 500, یک و نیم = 1.5) must be converted.
- "رهن کامل" with a budget → maxRent 0.
- An amount with no rahn/ejare word: ≥ 100 million → maxDeposit, otherwise → maxRent.
- Never invent a budget that was not stated; use null.

Other rules:
- Map neighborhood spellings to the canonical names above ("وکیل آباد" → "وکیل‌آباد", "قاسم آباد" → the name that contains it). Ignore other places and city names.
- "خانواده ۳ نفره" or more → minRooms 2 if rooms not stated, and mention it in freeTextNotes.
- Amenities the user says don't matter ("مهم نیست") go nowhere.
- Default flexibleConversion to true.

Examples (from Mashhad):
Q: یه آپارتمان دوخوابه نزدیک وکیل‌آباد با ۵۰۰ میلیون رهن
A: {"maxDeposit":500000000,"maxRent":null,"flexibleConversion":true,"neighborhoods":["وکیل‌آباد"],"minRooms":2,"maxRooms":null,"minArea":null,"mustHave":[],"niceToHave":[],"sharedRoom":false,"freeTextNotes":null}
Q: سوئیت یا یک خوابه مبله تو سجاد، ماهی حداکثر ۱۰ تومن، پول پیش زیاد ندارم
A: {"maxDeposit":null,"maxRent":10000000,"flexibleConversion":true,"neighborhoods":["سجاد"],"minRooms":0,"maxRooms":1,"minArea":null,"mustHave":["furnished"],"niceToHave":[],"sharedRoom":false,"freeTextNotes":"پول پیش کم"}`;

/** Parse a query with the LLM. Throws if the provider fails or returns an unusable object. */
export async function parseIntentWithLLM(
  query: string,
  catalog: CityCatalog,
): Promise<{ intent: SearchIntent; model: string }> {
  const { data, model } = await chatJson({
    system: systemPrompt(catalog),
    user: `Q: ${query}\nA:`,
    temperature: 0,
  });
  return { intent: SearchIntentSchema.parse({ ...(clean(data, catalog) as object), city: catalog.city }), model };
}

/** Lenient cleanup before strict validation: canonical names, numbers from strings, drop unknowns. */
function clean(raw: unknown, catalog: CityCatalog): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const r = raw as Record<string, unknown>;
  const num = (v: unknown) => {
    if (v === null || v === undefined || v === "") return null;
    const n = typeof v === "number" ? v : Number(String(v).replace(/[,٬\s]/g, ""));
    return Number.isFinite(n) ? n : null;
  };
  const amenities = (v: unknown) =>
    Array.isArray(v) ? v.filter((k): k is string => (AMENITY_KEYS as readonly string[]).includes(k)) : [];
  const hoods = Array.isArray(r.neighborhoods)
    ? [...new Set(r.neighborhoods.map((n) => canonicalNeighborhood(String(n), catalog.hoods)).filter(Boolean))]
    : [];
  const mustHave = amenities(r.mustHave);
  const int = (v: unknown) => {
    const n = num(v);
    return n === null ? null : Math.round(n);
  };
  return {
    maxDeposit: num(r.maxDeposit),
    maxRent: num(r.maxRent),
    flexibleConversion: r.flexibleConversion !== false,
    neighborhoods: hoods,
    minRooms: int(r.minRooms),
    maxRooms: int(r.maxRooms),
    minArea: num(r.minArea) || null,
    mustHave,
    niceToHave: amenities(r.niceToHave).filter((k) => !mustHave.includes(k)),
    sharedRoom: r.sharedRoom === true,
    freeTextNotes: typeof r.freeTextNotes === "string" && r.freeTextNotes.trim() ? r.freeTextNotes.trim() : null,
  };
}
