import { canonicalNeighborhood, cityName, cityOfHood } from "@/lib/places";
import type { PlaceGuess } from "@/lib/where";

import type { SearchIntent } from "./schema";

/**
 * Make the place part of an intent consistent: canonical city and neighborhood names, unknown
 * neighborhoods dropped, the city implied by a named neighborhood, neighborhoods outside the
 * named city dropped. `nearMe` is kept only when it is in that city.
 */
export function resolvePlace(intent: SearchIntent): SearchIntent {
  let city = cityName(intent.city);
  const hoods = [...new Set(intent.neighborhoods.map((n) => canonicalNeighborhood(n, city)).filter((n): n is string => !!n))];
  if (!city && hoods.length) city = cityOfHood(hoods[0]);
  const neighborhoods = hoods.filter((n) => cityOfHood(n, city) === city);
  const nearMe = intent.nearMe && (!city || cityOfHood(intent.nearMe, city)) ? intent.nearMe : null;
  return { ...intent, city, neighborhoods, nearMe };
}

/** The city results are limited to: the named one, else the user's own (near me), else none. */
export function searchCity(intent: SearchIntent): string | null {
  return intent.city ?? (intent.nearMe ? cityOfHood(intent.nearMe) : null);
}

/**
 * Fill or correct the intent's city from what the text says (see `detectPlace`): a city named in the
 * text wins over the LLM's guess; a neighborhood or landmark fills in a city the LLM missed.
 */
export function applyPlace(intent: SearchIntent, said: PlaceGuess): SearchIntent {
  if (said.status !== "found") return intent;
  return said.via === "city" || !intent.city ? { ...intent, city: said.city } : intent;
}
