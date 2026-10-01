import { z } from "zod";

import { CATEGORY_KEYS } from "@/lib/categories";
import type { Listing } from "@/lib/types";

/**
 * Ads posted on the visitor's device ride along with a search (there is no server database in this
 * prototype). Validated strictly enough that a bad payload can't break ranking: ids must be `hr-…`,
 * numbers bounded, strings capped. Photos and the poster's phone are never sent (see toSearchable).
 */
const money = z.number().nonnegative().max(1e14);
const text = (max: number) => z.string().max(max);

export const PostedListingSchema = z.object({
  id: z.string().regex(/^hr-[a-z0-9]{4,16}$/),
  source: z.literal("homerob"),
  category: z.enum(CATEGORY_KEYS).optional(),
  title: text(120),
  city: text(40),
  neighborhood: text(60),
  street: text(120),
  deposit: money,
  monthlyRent: money,
  price: money.optional(),
  nightlyPrice: money.optional(),
  areaM2: z.number().positive().max(1e6),
  rooms: z.number().int().min(0).max(20).optional(),
  floor: z.number().int().min(-5).max(200).optional(),
  totalFloors: z.number().int().min(0).max(200).optional(),
  buildingAge: z.number().int().min(0).max(200).optional(),
  elevator: z.boolean().optional(),
  parking: z.boolean().optional(),
  storage: z.boolean().optional(),
  tags: z.array(text(40)).max(20),
  convertible: z.boolean(),
  description: text(3000),
  postedAt: z.string().datetime(),
}) satisfies z.ZodType<Listing>;

/** Invalid entries are dropped (never fail the whole search because of one odd device-posted ad). */
export const ExtraListings = z
  .array(z.unknown())
  .max(200)
  .optional()
  .transform((xs) =>
    xs?.flatMap((x) => {
      const r = PostedListingSchema.safeParse(x);
      return r.success ? [r.data] : [];
    }),
  );
