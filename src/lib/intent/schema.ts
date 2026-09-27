import { z } from "zod";

import { AMENITY_KEYS } from "@/lib/amenities";
import { CATEGORY_KEYS } from "@/lib/categories";

/** Structured version of what the user asked for. Money is in Toman. */
export const SearchIntentSchema = z.object({
  /** Real-estate category (Divar's split). null = not stated → residential rent. */
  category: z.enum(CATEGORY_KEYS).nullable().default(null),
  /** Most the user can pay in a sale (total price) or a short stay (per night). null = not stated. */
  maxPrice: z.number().nonnegative().nullable().default(null),
  /** Most rahn/deposit the user can pay. null = not stated. */
  maxDeposit: z.number().nonnegative().nullable(),
  /** Most monthly rent the user can pay. null = not stated. */
  maxRent: z.number().nonnegative().nullable(),
  /** User accepts shifting money between deposit and rent (default true). */
  flexibleConversion: z.boolean(),
  /** City the user asked for (Persian name). null = any city (or the user's own, via nearMe). */
  city: z.string().nullable().default(null),
  /** Canonical neighborhood names in that city. */
  neighborhoods: z.array(z.string()),
  minRooms: z.number().int().min(0).nullable(),
  maxRooms: z.number().int().min(0).nullable(),
  minArea: z.number().positive().nullable(),
  mustHave: z.array(z.enum(AMENITY_KEYS)),
  niceToHave: z.array(z.enum(AMENITY_KEYS)),
  /** User wants a room in a shared flat (همخونه / اجاره اتاق). Default false = whole units only. */
  sharedRoom: z.boolean(),
  /**
   * People who will share the place and its cost (students, friends), ≥ 2. The budget fields are the
   * group's total; cards show each person's share. null = one household.
   */
  people: z.number().int().min(2).max(12).nullable().default(null),
  /** University to live near (id in src/lib/campuses.ts); ranks by distance to its campus. */
  campus: z.string().nullable().default(null),
  /** Anything else worth keeping, in Persian (e.g. "خانواده سه نفره"). */
  freeTextNotes: z.string().nullable(),
  /**
   * The user's own neighborhood (from browser location, never from the LLM). When set, results are
   * limited to it and the neighborhoods next to it. Only used when no neighborhood was named.
   */
  nearMe: z.string().nullable().default(null),
});

export type SearchIntent = z.infer<typeof SearchIntentSchema>;

export const EMPTY_INTENT: SearchIntent = {
  category: null,
  maxPrice: null,
  maxDeposit: null,
  maxRent: null,
  flexibleConversion: true,
  city: null,
  neighborhoods: [],
  minRooms: null,
  maxRooms: null,
  minArea: null,
  mustHave: [],
  niceToHave: [],
  sharedRoom: false,
  people: null,
  campus: null,
  freeTextNotes: null,
  nearMe: null,
};
