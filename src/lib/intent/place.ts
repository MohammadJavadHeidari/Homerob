import { canonicalCity, canonicalNeighborhood, cityOfHood } from "@/lib/places";

import type { SearchIntent } from "./schema";

/**
 * Make the place part of an intent consistent: canonical city and neighborhood names, unknown
 * neighborhoods dropped, the city implied by a named neighborhood, neighborhoods outside the
 * named city dropped. `nearMe` is kept only when it is in that city.
 */
export function resolvePlace(intent: SearchIntent): SearchIntent {
  let city = intent.city ? canonicalCity(intent.city) : null;
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
