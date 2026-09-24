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
  /** User wants a room in a shared flat (همخونه / اجاره اتاق). Default false = whole units only. */
  sharedRoom: z.boolean(),
  /** Anything else worth keeping, in Persian (e.g. "خانواده سه نفره"). */
  freeTextNotes: z.string().nullable(),
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
  sharedRoom: false,
  freeTextNotes: null,
};
