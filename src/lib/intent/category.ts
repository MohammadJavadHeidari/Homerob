import { CATEGORIES, DEFAULT_CATEGORY, priceModelOf, type CategoryKey } from "@/lib/categories";

import type { SearchIntent } from "./schema";

/**
 * Put the parsed budget in the fields the category uses: a sale or a short stay has one price
 * (`maxPrice`), a rental has rahn + ejare. Parsers read money as rahn/ejare first ("۵ میلیارد" →
 * maxDeposit), so for other categories that amount moves to `maxPrice`.
 */
export function settleBudget(intent: SearchIntent): SearchIntent {
  // «اجاره اتاق» in an office query means an office room, not a room in a shared flat
  const sharedRoom = intent.sharedRoom && (intent.category ?? DEFAULT_CATEGORY) === DEFAULT_CATEGORY;
  const model = priceModelOf(intent.category);
  if (model === "rent") return { ...intent, maxPrice: null, sharedRoom };
  const { maxDeposit: D, maxRent: R } = intent;
  // a sale budget is the big number; a nightly one the small one
  const moved = model === "sale" ? (D ?? R) : (R || D);
  return {
    ...intent,
    maxPrice: intent.maxPrice ?? moved ?? null,
    maxDeposit: null,
    maxRent: null,
    flexibleConversion: true,
    sharedRoom,
  };
}

/**
 * The user picked another category by hand. The rest of the request stays; the budget stays only
 * when both categories are priced the same way (a rahn budget is not a purchase budget).
 */
export function withCategory(intent: SearchIntent, category: CategoryKey): SearchIntent {
  const same = priceModelOf(intent.category) === priceModelOf(category);
  const next: SearchIntent = {
    ...intent,
    category,
    ...(same ? {} : { maxDeposit: null, maxRent: null, maxPrice: null, flexibleConversion: true }),
  };
  if (!CATEGORIES[category].residential) Object.assign(next, { minRooms: null, maxRooms: null });
  return settleBudget(next);
}
