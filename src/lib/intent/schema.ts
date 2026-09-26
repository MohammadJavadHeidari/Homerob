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
  /** Divar city slug the search runs in (from the query or the user's location; default mashhad). */
  city: z.string().max(60).nullable().default(null),
  /** Persian names as the city's data spells them. */
  neighborhoods: z.array(z.string().max(80)).max(10),
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
  nearMe: z.string().max(80).nullable().default(null),
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
