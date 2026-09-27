# Listing data (real listings only)

Since 2026-09-26 Homerob uses **real** ads only (see `docs/DECISIONS.md`).

`src/data/divar.json` holds **real** Divar ads, written by the importer below — 50 so far, all Mashhad:

| export (in gitignored `data/raw/`) | captured | ads | imported |
|---|---|---|---|
| `divar-mashhad-vakilabad-2026-09-27.html` | `2026-09-27` | 169 (all real-estate) | 14 |
| `divar-mashhad-mofatteh-2026-09-27.rtf` | `2026-09-27T22:00` | 45 (rent-residential) | 36 |

Rebuild from scratch: delete `divar.json`, then import each export in the order above.
`src/data/listings.ts` serves it. The generated sample set was removed on 2026-09-27 (owner). Unit tests
use hand-written fixtures (`src/test/fixtures.ts`), never served.

## Importing a Divar export

The owner exports a Divar search with a browser table-scraper extension and saves the HTML (one table of
search-result cards; optionally a second table of the opened ad pages — much better data).

```bash
# raw exports live in data/raw/ (gitignored: they contain agency names)
npm run import:divar -- data/raw/<export>.html --captured 2026-09-27        # or .rtf; add --verbose
```

- **RTF** (macOS TextEdit paste) is unwrapped automatically.
- **Columns are found by header name**, not position — the extension reorders them between exports.
- `--captured` is the base for Divar's «۳ ساعت پیش» (Tehran time; a date means noon). Ads whose page has
  «انتشار آگهی: ۵ مهر ۱۴۰۵، ۲۱:۰۱» get that exact time instead.
- Page tables with JSON-LD columns give exact `lat`/`lng`, rooms and floor size.
- Cleaning: a symbolic rent (< ۵۰۰ هزار) next to a real deposit = full rahn; the «برای تبدیل بکشید» slider
  = convertible; areas < 15 m² (a room / storage) or > 1000 m² (typo / whole plot) are skipped.
- Known export gap: on **apartment** pages the extension writes the feature row (آسانسور / پارکینگ /
  انباری) into the same columns as متراژ / ساخت / اتاق, so those three are lost; area then comes from the
  title / description or the ad is skipped (6 Mofatteh apartments).

`scripts/import-divar.ts` joins cards and ad pages on the ad token, keeps only whole-unit residential
rentals (ودیعه/اجاره; `category` unset = `residential-rent`), and skips sales, nightly villa rentals
(«تا N نفر») and commercial units — the other categories exist in the app since 2026-09-27 but the
importer doesn't fill them yet (their `price` / `nightlyPrice` models) — plus ads with
no area, and ads whose Divar district isn't registered in `HOODS` (unless the title/description names a
registered neighborhood). It prints what it skipped and why. Re-running merges into `divar.json` by id.

Nothing is guessed: rooms, floor, building age, elevator/parking/storage stay **unset** when the ad
doesn't say, and the UI shows only what the ad states («نامشخص» in compare; a missing amenity in a real
ad reads «آگهی دربارهٔ X چیزی نگفته», never «X ندارد»). Descriptions are the first lines Divar shows on
the ad page (the export truncates them). Phone numbers, agency and seller names are never copied.

Best export for the next batch: the **rent-residential** category of one neighborhood at a time
(`divar.ir/s/mashhad/rent-residential?districts=…`), with each ad page opened so the second table has
متراژ / ساخت / اتاق / طبقه / features.

## Format

`divar.json` is an array of `Listing` (`src/lib/types.ts`). Money is **Toman**.

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
| `areaM2` | `95` | required (built area when the ad gives one) |
| `rooms`, `floor`, `totalFloors`, `buildingAge` | `2, 3, 5, 6` | optional (unset = not stated); `rooms: 0` = سوئیت (or none, for offices / shops / land); `floor: 0` = همکف |
| `elevator`, `parking`, `storage` | booleans | optional (unset = not stated) |
| `convertible` | boolean | «قابل تبدیل» |
| `tags` | `["بالکن", "مبله"]` | extra amenities in Persian |
| `description` | text | as posted, **without phone numbers** |
| `postedAt` | ISO date-time | from Divar's «۳ هفته پیش», relative to the capture date |
| `imageUrl` | Divar CDN thumbnail | optional; not shown in the UI yet |
| `lat`, `lng` | `35.76, 51.33` | optional; approximate location when the site shows one |

Rules: no sellers' phone numbers or other personal data; keep the original text; placeholder
prices («توافقی», ۱٬۰۰۰ تومان) are fine — `src/lib/quality.ts` keeps them out of ranking.

## Adding a city

1. Add its neighborhoods to `HOODS` in `src/lib/places.ts` (Divar's district name, city, center from
   OpenStreetMap — Nominatim is reachable from the sandbox, Overpass isn't — spelling aliases, adjacent =
   centers within ~2 km, symmetric; `npm test` checks). The city becomes "covered" automatically: search, the
   AI prompt, location ("near me") and the home map pick it up.
2. Import its listings (above) into `src/data/divar.json`. `npm test` checks every listing's city and
   neighborhood are registered.
3. Re-bake the nearby places for "neighborhood advantages": `node scripts/build-nearby.mjs [cacheDir]`
   (Overpass API / OpenStreetMap; writes `src/data/pois.json`, server-side only). Without it, listings
   in the new city show «هنوز اطلاعات کافی از اطراف این خونه نداریم».
4. Optional: its province name in `PROVINCE_OF` (`src/components/hero-map/hero-map.tsx`) and baked
   roads (`scripts/build-hero-map.mjs`, needs Overpass access).
