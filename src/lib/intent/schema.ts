import { z } from "zod";

import { AMENITY_KEYS } from "@/lib/amenities";

/** Structured version of what the user asked for. Money is in Toman. */
export const SearchIntentSchema = z.object({
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
  freeTextNotes: null,
  nearMe: null,
};
