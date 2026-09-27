import "server-only";

import { AMENITIES, AMENITY_KEYS } from "@/lib/amenities";
import { chatJson } from "@/lib/ai/client";
import { canonicalNeighborhood, cityName, COVERED_CITIES, hoodsIn } from "@/lib/places";
import { CATEGORIES, CATEGORY_KEYS, detectCategory, isCategoryKey } from "@/lib/categories";

import { settleBudget } from "./category";
import { SearchIntentSchema, type SearchIntent } from "./schema";

const AMENITY_LIST = AMENITY_KEYS.map((k) => `${k} (${AMENITIES[k].label})`).join(", ");

const CATEGORY_LIST = CATEGORY_KEYS.map((k) => `${k} (${CATEGORIES[k].label}: ${CATEGORIES[k].types.join("، ")})`).join("\n");

const PLACES = COVERED_CITIES.map((c) => `${c}: ${hoodsIn(c).map((h) => h.name).join("، ")}`).join("\n");

const SYSTEM_PROMPT = `You convert a Persian real-estate search query (any city in Iran) into a strict JSON object.

Output ONLY a JSON object with exactly these keys:
{
  "category": string | null,          // one key from the category list below; null if nothing points to one
  "maxPrice": number | null,          // sale / projects: max total price; short-term: max price PER NIGHT; in TOMAN. null for rentals
  "maxDeposit": number | null,        // max rahn / vadie / pool-e pish the user can pay, in TOMAN
  "maxRent": number | null,           // max monthly ejare, in TOMAN
  "flexibleConversion": boolean,      // false only if the user refuses to shift money between rahn and ejare
  "city": string | null,              // Persian city name if the user names one or a neighborhood implies it; else null
  "neighborhoods": string[],          // canonical names from the list below (same city only)
  "minRooms": number | null,          // bedrooms; سوئیت/استودیو = 0
  "maxRooms": number | null,          // set only for ranges ("سوئیت یا یک‌خوابه" → 0..1) or an explicit maximum
  "minArea": number | null,           // square meters; for "حدود X متر" use ~0.85·X
  "mustHave": string[],               // required amenities, keys from the list below
  "niceToHave": string[],             // preferred amenities ("ترجیحاً", "اگه… بهتره")
  "sharedRoom": boolean,              // true only if they want a room in a shared flat (همخونه / اجاره اتاق)
  "freeTextNotes": string | null      // short Persian note for anything else useful (household, lifestyle); else null
}
Amenity keys: ${AMENITY_LIST}.
Categories (key (Divar name: property types)):
${CATEGORY_LIST}
Known cities and neighborhoods (city: neighborhoods):
${PLACES}

Money rules (critical):
- Everything is TOMAN. "میلیون" = 1,000,000; "میلیارد" = 1,000,000,000; "هزار" = 1,000.
- Colloquially "تومن"/"تومان" after a small number means MILLION: "ماهی ۸ تومن" → maxRent 8000000, "۵۰۰ تومن رهن" → maxDeposit 500000000.
- Bare numbers after رهن/اجاره are millions ("رهن ۳۰۰ اجاره ۱۰" → 300000000 / 10000000); "رهن ۱.۵" means 1.5 میلیارد.
- Persian and Arabic digits and number words (پونصد = 500, یک و نیم = 1.5) must be converted.
- "رهن کامل" with a budget → maxRent 0.
- An amount with no rahn/ejare word: ≥ 100 million → maxDeposit, otherwise → maxRent.
- Never invent a budget that was not stated; use null.

Category rules:
- Buying (خرید، بخرم، فروشی، قیمت کل) a home/land → residential-sale; an office/shop/industrial unit → commercial-sale.
- Renting an office, shop, store, clinic, warehouse (انبار, not the انباری amenity) → commercial-rent (rahn/ejare like homes).
- Daily / nightly / weekend / trip stays (روزانه، شبی، آخر هفته، سفر) → short-term, budget per night in maxPrice.
- پیش‌فروش، مشارکت در ساخت، پروژه → projects, budget in maxPrice.
- Sale, short-term and projects use maxPrice only (maxDeposit and maxRent null); rentals never use maxPrice.
- Plain home rental (رهن/اجاره) or no clue → residential-rent or null.

Other rules:
- Map neighborhood spellings to the canonical names above ("وکیل آباد" → "وکیل‌آباد"). Ignore unknown neighborhoods.
- Any Iranian city the user names goes in "city" in Persian (e.g. "تهران", "کیش"), even if it is not in the list.
- If no city is named but a well-known neighborhood, street or landmark clearly belongs to one city
  ("سعادت‌آباد" → "تهران", "حرم امام رضا" → "مشهد"), set that city. If it could be in several cities, use null.
- Moving from one city to another ("از تهران میام مشهد"): "city" is where they want to live.
- "خانواده ۳ نفره" or more → minRooms 2 if rooms not stated, and mention it in freeTextNotes.
- Amenities the user says don't matter ("مهم نیست") go nowhere.
- Default flexibleConversion to true.

Examples:
Q: یه آپارتمان دوخوابه نزدیک وکیل‌آباد با ۵۰۰ میلیون رهن
A: {"category":"residential-rent","maxPrice":null,"maxDeposit":500000000,"maxRent":null,"flexibleConversion":true,"city":"مشهد","neighborhoods":["وکیل‌آباد"],"minRooms":2,"maxRooms":null,"minArea":null,"mustHave":[],"niceToHave":[],"sharedRoom":false,"freeTextNotes":null}
Q: سوئیت یا یک خوابه مبله تو سجاد، ماهی حداکثر ۱۰ تومن، پول پیش زیاد ندارم
A: {"category":"residential-rent","maxPrice":null,"maxDeposit":null,"maxRent":10000000,"flexibleConversion":true,"city":"مشهد","neighborhoods":["سجاد"],"minRooms":0,"maxRooms":1,"minArea":null,"mustHave":["furnished"],"niceToHave":[],"sharedRoom":false,"freeTextNotes":"پول پیش کم"}
Q: آپارتمان سه خوابه در تهران با پارکینگ، رهن کامل تا ۳ میلیارد
A: {"category":"residential-rent","maxPrice":null,"maxDeposit":3000000000,"maxRent":0,"flexibleConversion":true,"city":"تهران","neighborhoods":[],"minRooms":3,"maxRooms":null,"minArea":null,"mustHave":["parking"],"niceToHave":[],"sharedRoom":false,"freeTextNotes":null}
Q: میخوام یه آپارتمان صد متری تو شیراز بخرم، تا ۶ میلیارد
A: {"category":"residential-sale","maxPrice":6000000000,"maxDeposit":null,"maxRent":null,"flexibleConversion":true,"city":"شیراز","neighborhoods":[],"minRooms":null,"maxRooms":null,"minArea":100,"mustHave":[],"niceToHave":[],"sharedRoom":false,"freeTextNotes":null}
Q: مغازه بر خیابون برای اجاره، رهن ۳۰۰ اجاره ۲۰
A: {"category":"commercial-rent","maxPrice":null,"maxDeposit":300000000,"maxRent":20000000,"flexibleConversion":true,"city":null,"neighborhoods":[],"minRooms":null,"maxRooms":null,"minArea":null,"mustHave":[],"niceToHave":[],"sharedRoom":false,"freeTextNotes":"بر خیابان"}
Q: ویلا با استخر برای آخر هفته، شبی تا ۴ میلیون
A: {"category":"short-term","maxPrice":4000000,"maxDeposit":null,"maxRent":null,"flexibleConversion":true,"city":null,"neighborhoods":[],"minRooms":null,"maxRooms":null,"minArea":null,"mustHave":["pool"],"niceToHave":[],"sharedRoom":false,"freeTextNotes":"ویلا"}`;

/** Parse a query with the LLM. Throws if the provider fails or returns an unusable object. */
export async function parseIntentWithLLM(query: string): Promise<{ intent: SearchIntent; model: string }> {
  const { data, model } = await chatJson({
    system: SYSTEM_PROMPT,
    user: `Q: ${query}\nA:`,
    temperature: 0,
  });
  const intent = SearchIntentSchema.parse(clean(data));
  // a lite model sometimes drops the category; the keyword rules are a safe second opinion
  return { intent: settleBudget({ ...intent, category: intent.category ?? detectCategory(query) }), model };
}

/** Lenient cleanup before strict validation: canonical names, numbers from strings, drop unknowns. */
function clean(raw: unknown): unknown {
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
    ? [...new Set(r.neighborhoods.map((n) => canonicalNeighborhood(String(n))).filter(Boolean))]
    : [];
  const mustHave = amenities(r.mustHave);
  const int = (v: unknown) => {
    const n = num(v);
    return n === null ? null : Math.round(n);
  };
  return {
    category: isCategoryKey(r.category) ? r.category : null,
    maxPrice: num(r.maxPrice),
    maxDeposit: num(r.maxDeposit),
    maxRent: num(r.maxRent),
    flexibleConversion: r.flexibleConversion !== false,
    city: typeof r.city === "string" ? cityName(r.city) : null,
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
