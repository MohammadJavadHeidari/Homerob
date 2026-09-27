import { normalizeFa } from "@/lib/text";

import type { SearchIntent } from "./schema";

/**
 * Students and friends rent together: "۴ تا دانشجوییم، نفری ۱۵۰ میلیون رهن". The intent keeps the
 * group's TOTAL budget (that's what a listing is compared with) plus `people`, so each card can show
 * every person's share.
 */
export interface Group {
  /** How many people will share the place (≥ 2), or null. */
  people: number | null;
  /** The amounts in the text are per person ("نفری", "هر نفر"). */
  perPerson: boolean;
}

const MATES = "(?:دانشجو|همخونه|هم خونه|هماتاقی|هم اتاقی|رفیق|دوست|همکار)";

/** Read the group size and whether the budget is per person. Expects digits (see rules.ts). */
export function detectGroup(query: string): Group {
  const text = normalizeFa(query);
  if (/خانواده/.test(text)) return { people: null, perPerson: false }; // a family pays as one
  let people: number | null = null;
  const withMates = text.match(new RegExp(`با (\\d+) ?(?:تا |نفر )?(?:از )?${MATES}`));
  const count =
    text.match(/(\d+) ?نفر(?:یم|ی هستیم| هستیم| هم ?خونه| دانشجو)/) ??
    text.match(new RegExp(`(\\d+) ?(?:تا |نفر )${MATES}`)) ??
    text.match(new RegExp(`(\\d+) ?${MATES}(?:یم| هستیم)`));
  if (withMates) people = Number(withMates[1]) + 1; // "با ۲ تا دوستم" = 3 of us
  else if (count) people = Number(count[1]);
  else if (new RegExp(`با (?:یه |یک )?${MATES}(?:م|ام| ام)(?![؀-ۿ])`).test(text)) people = 2;
  if (people !== null && (people < 2 || people > 12)) people = null;

  // «نفری» (each) but not «۴ نفری» / «نفریم» (the four of us)
  const perPerson = /(?<!\d ?)نفری(?![؀-ۿ])|هر نفر|سهم هر|هر کدوم|هرکدوم|سرانه/.test(text);
  return { people, perPerson };
}

/**
 * Put a group into an intent: per-person amounts become the group total, and with no room count
 * stated, about two people per bedroom. Only for home rentals (a sale or a villa night isn't split).
 */
export function applyGroup(intent: SearchIntent, { people, perPerson }: Group): SearchIntent {
  const renting = !intent.category || intent.category === "residential-rent";
  if (!people || !renting) return intent;
  const times = (v: number | null) => (perPerson && v ? v * people : v);
  return {
    ...intent,
    people,
    maxDeposit: times(intent.maxDeposit),
    maxRent: times(intent.maxRent),
    minRooms: intent.minRooms ?? Math.ceil(people / 2),
  };
}
