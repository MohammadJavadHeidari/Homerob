import { z } from "zod";

import { AMENITY_KEYS } from "@/lib/amenities";
import { NEIGHBORHOODS } from "@/lib/types";

/** Structured version of what the user asked for. Money is in Toman. */
export const SearchIntentSchema = z.object({
  /** Most rahn/deposit the user can pay. null = not stated. */
  maxDeposit: z.number().nonnegative().nullable(),
  /** Most monthly rent the user can pay. null = not stated. */
  maxRent: z.number().nonnegative().nullable(),
  /** User accepts shifting money between deposit and rent (default true). */
  flexibleConversion: z.boolean(),
  neighborhoods: z.array(z.enum(NEIGHBORHOODS)),
  minRooms: z.number().int().min(0).nullable(),
  maxRooms: z.number().int().min(0).nullable(),
  minArea: z.number().positive().nullable(),
  mustHave: z.array(z.enum(AMENITY_KEYS)),
  niceToHave: z.array(z.enum(AMENITY_KEYS)),
  /** Anything else worth keeping, in Persian (e.g. "خانواده سه نفره"). */
  freeTextNotes: z.string().nullable(),
  /**
   * The user's own neighborhood (from browser location, never from the LLM). When set, results are
   * limited to it and the neighborhoods next to it. Only used when no neighborhood was named.
   */
  nearMe: z.enum(NEIGHBORHOODS).nullable().default(null),
});

export type SearchIntent = z.infer<typeof SearchIntentSchema>;

export const EMPTY_INTENT: SearchIntent = {
  maxDeposit: null,
  maxRent: null,
  flexibleConversion: true,
  neighborhoods: [],
  minRooms: null,
  maxRooms: null,
  minArea: null,
  mustHave: [],
  niceToHave: [],
  freeTextNotes: null,
  nearMe: null,
};
