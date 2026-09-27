# Listing data (real listings only)

Since 2026-09-26 Homerob uses **real** ads only (see `docs/DECISIONS.md`). The current
`src/data/listings.json` (100 generated Mashhad listings) is a temporary leftover until real data
replaces it.

## Format

`src/data/listings.json` is an array of `Listing` (`src/lib/types.ts`). Money is **Toman**.

| field | example | notes |
|---|---|---|
| `id` | `"dv-QZx7abc"` | unique; prefix `dv-` Divar, `sp-` Sheypoor + the site's own token |
| `source` | `"divar"` | `divar` \| `sheypoor` |
| `category` | `"residential-sale"` | one of `residential-rent`, `residential-sale`, `commercial-rent`, `commercial-sale`, `short-term`, `projects` (Divar's «املاک» split, `src/lib/categories.ts`); missing = `residential-rent` |
| `url` | `"https://divar.ir/v/…"` | link to the original ad (shown on the card) |
| `title` | `"آپارتمان ۹۵ متری دوخوابه"` | as posted |
| `city` | `"تهران"` | Persian name from `CITIES` in `src/lib/places.ts` |
| `neighborhood` | `"پونک"` | canonical name; must exist in `HOODS` for that city |
| `street` | `"بلوار عدل"` | optional detail, `""` if none |
| `deposit` / `monthlyRent` | `500000000` / `18000000` | rentals (`*-rent`): rahn / ejare; `monthlyRent: 0` = full rahn. Other categories: `0` / `0` |
| `price` | `4800000000` | sales and `projects`: total asking price; omit or `0` if «توافقی» |
| `nightlyPrice` | `2500000` | `short-term`: price per night |
| `areaM2`, `rooms`, `floor`, `totalFloors`, `buildingAge` | `95, 2, 3, 5, 6` | `rooms: 0` = سوئیت (or none, for offices / shops / land); `floor: 0` = همکف |
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
3. Re-bake the nearby places for "neighborhood advantages": `node scripts/build-nearby.mjs [cacheDir]`
   (Overpass API / OpenStreetMap; writes `src/data/pois.json`, server-side only). Without it, listings
   in the new city show «هنوز اطلاعات کافی از اطراف این خونه نداریم».
4. Optional: its province name in `PROVINCE_OF` (`src/components/hero-map/hero-map.tsx`) and baked
   roads (`scripts/build-hero-map.mjs`, needs Overpass access).
