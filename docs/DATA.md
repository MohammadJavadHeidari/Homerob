# Listing data (real listings only)

Since 2026-09-26 Homerob uses **real** rental ads only (see `docs/DECISIONS.md`). The current
`src/data/listings.json` (100 generated Mashhad listings) is a temporary leftover until real data
replaces it.

## Format

`src/data/listings.json` is an array of `Listing` (`src/lib/types.ts`). Money is **Toman**.

| field | example | notes |
|---|---|---|
| `id` | `"dv-QZx7abc"` | unique; prefix `dv-` Divar, `sp-` Sheypoor + the site's own token |
| `source` | `"divar"` | `divar` \| `sheypoor` |
| `url` | `"https://divar.ir/v/…"` | link to the original ad (shown on the card) |
| `title` | `"آپارتمان ۹۵ متری دوخوابه"` | as posted |
| `city` | `"تهران"` | Persian name from `CITIES` in `src/lib/places.ts` |
| `neighborhood` | `"پونک"` | canonical name; must exist in `HOODS` for that city |
| `street` | `"بلوار عدل"` | optional detail, `""` if none |
| `deposit` / `monthlyRent` | `500000000` / `18000000` | rahn / ejare; `monthlyRent: 0` = full rahn |
| `areaM2`, `rooms`, `floor`, `totalFloors`, `buildingAge` | `95, 2, 3, 5, 6` | `rooms: 0` = سوئیت; `floor: 0` = همکف |
| `elevator`, `parking`, `storage`, `convertible` | booleans | `convertible` = «قابل تبدیل» |
| `tags` | `["بالکن", "مبله"]` | extra amenities in Persian |
| `description` | text | as posted, **without phone numbers** |
| `postedAt` | ISO date-time | |
| `lat`, `lng` | `35.76, 51.33` | optional; approximate location when the site shows one |

Rules: no sellers' phone numbers or other personal data; keep the original text; placeholder
prices («توافقی», ۱٬۰۰۰ تومان) are fine — `src/lib/quality.ts` keeps them out of ranking.

## Adding a city

1. Add its neighborhoods to `HOODS` in `src/lib/places.ts` (name, city, center from OpenStreetMap,
   spelling aliases, adjacent neighborhoods). The city becomes "covered" automatically: search, the
   AI prompt, location ("near me") and the home map pick it up.
2. Add its listings to `src/data/listings.json`. `npm test` checks every listing's city and
   neighborhood are registered.
3. Optional: its province name in `PROVINCE_OF` (`src/components/hero-map/hero-map.tsx`) and baked
   roads (`scripts/build-hero-map.mjs`, needs Overpass access).
