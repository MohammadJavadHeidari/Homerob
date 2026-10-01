import { z } from "zod";

import { EMPTY_DRAFT, type AdDraft } from "@/lib/account/ads";
import { CATEGORIES, DEFAULT_CATEGORY } from "@/lib/categories";
import { parseIntent } from "@/lib/intent";
import { toEnDigits, toFaDigits } from "@/lib/persian";

const Body = z.object({ text: z.string().trim().min(10).max(3000), city: z.string().max(40).optional() });

/** Iranian mobile / landline numbers in Latin or Persian digits, with spaces or dashes. */
const PHONE_SRC = String.raw`(?:\+98|0098|[0۰])\s?[9۹](?:[\s-]?[0-9۰-۹]){9}|[0۰][1-8۱-۸][0-9۰-۹]{1,2}[\s-]?[0-9۰-۹]{8}`;
const PHONE = new RegExp(PHONE_SRC, "g");
const hasPhone = (s: string) => new RegExp(PHONE_SRC).test(s);

/**
 * «متن فایل رو بچسبون»: an agency pastes the text of one property (from a Telegram group, an old ad, notes) and
 * gets a filled-in ad form to check. The same intent parser as search (LLM when configured, rules otherwise)
 * reads money, rooms, area, place, category and amenities; a few regexes add floor and age. Phone numbers are
 * stripped (no personal data is kept).
 */
export async function POST(request: Request) {
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "متن آگهی رو بنویس (حداقل چند کلمه)." }, { status: 400 });

  const started = Date.now();
  const raw = body.data.text;
  const text = toEnDigits(raw);
  const { intent, source, model } = await parseIntent(raw.slice(0, 300));
  const category = intent.category ?? DEFAULT_CATEGORY;
  const info = CATEGORIES[category];

  const floor = /همکف/.test(text) ? 0 : num(text.match(/طبقه\s*(\d{1,2})/));
  const age = /نوساز|کلید ?نخورده|تازه ساز/.test(text) ? 0 : num(text.match(/(\d{1,2})\s*(?:سال ساخت|ساله|سال سن)/));
  const area = intent.minArea ?? num(text.match(/(\d{2,4})\s*(?:متر|متری)/));
  const rooms = intent.minRooms ?? intent.maxRooms;
  const hood = intent.neighborhoods[0] ?? "";
  const amenities = new Set([...intent.mustHave, ...intent.niceToHave]);
  const tags = [
    amenities.has("balcony") && "بالکن",
    amenities.has("furnished") && "مبله",
    amenities.has("yard") && "حیاط",
    amenities.has("lobby") && "لابی‌من",
    amenities.has("pool") && "استخر",
  ].filter((t): t is string => Boolean(t));

  const firstLine = raw.split(/\r?\n/).map((l) => l.trim()).find((l) => l.length >= 5) ?? "";
  const generated = [info.types[0], area && `${toFaDigits(area)} متری`, rooms != null && (rooms === 0 ? "سوئیت" : `${toFaDigits(rooms)} خوابه`), hood]
    .filter(Boolean)
    .join(" ");
  const title = (firstLine.length <= 60 && !hasPhone(firstLine) ? firstLine : generated).replace(PHONE, "").trim();

  const draft: AdDraft = {
    ...EMPTY_DRAFT,
    category,
    title: title || generated,
    city: intent.city ?? body.data.city ?? EMPTY_DRAFT.city,
    neighborhood: hood,
    areaM2: area,
    rooms: info.residential ? (rooms ?? null) : null,
    floor,
    buildingAge: age,
    deposit: info.priceModel === "rent" ? intent.maxDeposit : null,
    monthlyRent: info.priceModel === "rent" ? intent.maxRent || null : null,
    price: info.priceModel === "sale" ? intent.maxPrice : null,
    nightlyPrice: info.priceModel === "nightly" ? intent.maxPrice : null,
    elevator: amenities.has("elevator"),
    parking: amenities.has("parking"),
    storage: amenities.has("storage"),
    convertible: /قابل تبدیل|قابل جابجایی/.test(raw),
    tags,
    description: raw.replace(PHONE, "").trim(),
  };

  return Response.json({ draft, source, model, ms: Date.now() - started });
}

const num = (m: RegExpMatchArray | null) => (m ? Number(m[1]) : null);
