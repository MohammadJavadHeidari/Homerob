# Listing data (real listings only)

Since 2026-09-26 Homerob uses **real** ads only (see `docs/DECISIONS.md`).

`src/data/divar.json` holds **real** Divar ads, written by the importers below — 198 so far, all Mashhad:

| export (in gitignored `data/raw/`) | captured | ads | imported |
|---|---|---|---|
| `divar-mashhad-vakilabad-2026-09-27.html` | `2026-09-27` | 169 (all real-estate) | 14 |
| `divar-mashhad-mofatteh-2026-09-27.rtf` | `2026-09-27T22:00` | 45 (rent-residential) | 36 |
| `divar-crawl-mashhad-2026-10-01.json` (crawler, `import:divar-crawl`) | 2026-10-01 20:09–20:22 | 150 (rent-residential, newest) | 148 |

Rebuild from scratch: delete `divar.json`, then import each export in the order above. The crawl batch registered 62
Mashhad districts in `HOODS` (centers = median of the batch's exact ad points; `strict` for names that are
everyday words). `pois.json` was **not** re-baked for them (Overpass 503/504/429 on 2026-10-01) — re-run
`node scripts/build-nearby.mjs` when it answers.
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

## Crawling Divar — automated (owner's machine → `divar-data` → GitHub Action → `main`)

Divar answers only Iranian IPs, so the crawl runs on the owner's machine; everything after it is automatic.

```
owner's laptop (every 30 min)          GitHub                                   Vercel
divar_crawler.py --push  ──push──▶  branch divar-data          Action "Import Divar crawl"
  4 categories, Mashhad              crawl/<date>.jsonl  ──▶  (:10 and :40 every hour)
  new ads only, sanitized            (append-only shards)      import → test → build ──▶ main ──▶ deploy
```

**Owner, once:**

```bash
git pull origin main
python3 scripts/divar_crawler.py --refetch --push        # descriptions for the first 150 + first push (≈10 min)
python3 scripts/divar_crawler.py --install-schedule 30   # then every 30 min: crawl + push (launchd / cron / Task Scheduler)
python3 scripts/divar_crawler.py --uninstall-schedule    # to stop
```

Options (also kept by `--install-schedule`): `--cities mashhad,tehran` (Divar slugs or ids), `--categories`
(default `residential-rent,residential-sale,commercial-rent,commercial-sale`), `--pages 30` and `--max-new 60`
per city × category per pass. A pass keeps paging past ads it already has, so each pass reaches further back
(backfill ≈ 240 new ads per pass ≈ 11k a day at most) until the newest ads are all that's left. A lock file
keeps two runs from overlapping. `--probe` saves raw answers per category to `data/raw/probe/` if the parser
breaks; `--refetch` re-reads stored ads with the current parser; `--every N` loops in a terminal instead.

- **Crawler** (`scripts/divar_crawler.py`, stdlib Python 3.9+ and `git`): Divar's public web JSON API
  (`/v8/postlist/w/search` newest first, `/v8/posts-v2/web/<token>` per new ad). Polite: robots.txt each pass,
  one request at a time, 2–4 s per ad, backoff on 429/5xx, stop on 403.
- **Privacy — the repo is public.** Never calls the contact endpoint; seller / agency / chat widgets are
  dropped; phone-like numbers are masked; the card's «آژانس … در X» becomes «در X»; Divar business ids are
  removed from `meta` (only the category tree, place and prices are kept). Applied again before every push,
  so ads stored by older versions are cleaned too.
- **`divar-data` branch** (orphan; has its own README and `vercel.json` with deployments off): one line per
  crawled ad version in `crawl/<date>.jsonl`; a later line for the same token wins. The crawler keeps it in
  the `.crawl-data/` worktree (gitignored) and pushes whatever the branch doesn't have yet — an offline pass
  goes out with the next one.
- **Action** (`.github/workflows/import-divar-crawl.yml`, also runnable by hand from the Actions tab): reads
  all shards, `npm run import:divar-crawl -- .crawl-data/crawl --auto-hoods`, then `npm test` and
  `npm run build`; only if both pass does it commit `src/data/divar.json` + `src/data/auto-hoods.json` to
  `main` (Vercel deploys it). The run summary lists imports, new districts and skip reasons.
- Live shape (first run, 2026-10-01): the location line is an `EXPANDABLE_SECTION` title, «انتشار آگهی» is a
  description row (→ `published`), deposit/rent of convertible ads live only in the slider (the card's
  «ودیعه: …» / «اجاره: …» lines are used), the page's image list holds only Divar's map snapshot (the
  card thumbnail is used). Sale and commercial slugs (`residential-sell`, `commercial-rent`,
  `commercial-sell`) were not seen live yet: the crawler logs a warning if Divar's `cat_2` differs from the
  slug asked for, and the importer trusts `cat_2`.

**Import rules** (`src/lib/import/divar-crawl.ts`, tested; text rules shared with the export importer in
`src/lib/import/divar-text.ts`):

- Category from Divar's `cat_2`: `residential-rent` (left unset in `divar.json`), `residential-sale`,
  `commercial-rent`, `commercial-sale`; anything else is skipped.
- Rentals: deposit/rent from the ad's rows (not the «ودیعه و اجاره» row), else the card; symbolic rent = full
  rahn; «رایگان» = 0; «قابل تبدیل» / the slider = convertible. Sales: `price` from «قیمت کل» (else the card);
  «توافقی» is skipped. Placeholder prices stay in the data and are kept out of ranking by `src/lib/quality.ts`.
- Area: «متراژ», else the text, else «متراژ زمین»; plausible range per category (homes for rent 15–1000 m²,
  sales and commercial up to 50,000 m², commercial from 5 m²). Rooms only for residential ads.
- Exact `postedAt` from «انتشار آگهی»; floors «۲ از ۴» / «تعداد کل طبقات»; the feature row and «X: هست» rows
  → elevator / parking / storage / tags; Divar's map point.
- **Unknown districts** (`--auto-hoods`, `src/lib/import/auto-hoods.ts`): registered in
  `src/data/auto-hoods.json` at the median of their ads' exact map points (never without a point), neighbors
  = districts within 2 km, and `strict` unless the name is clearly a place (has «آباد» / «شهر» or several
  words) — strict names match a query only as «محله X». Curated entries in `src/lib/places.ts` win; move an
  auto entry there once checked. `scripts/build-nearby.mjs` includes them.

Manual route (no push): `npm run import:divar-crawl -- data/raw/divar-crawl.json --verbose` (files, `.jsonl`
or directories; add `--auto-hoods` to register districts).

## Photos (owner's machine)

Each ad keeps Divar's photo link (`imageUrl`, the search card's thumbnail). Divar's CDN, like its API, answers only
Iranian IPs, so the site serves **its own copy** from `public/img/divar/<id>.webp` and falls back to Divar's link
(works for viewers in Iran), then to the «بدون عکس» tile.

```bash
python3 scripts/divar_crawler.py --images     # = npm run crawl:divar-images; downloads only what's missing
npm run link:divar-images                     # sets `photo` on ads whose file exists
git add public/img/divar src/data/divar.json  # commit both
```

- The crawler tries Divar's larger ad-page size (`webp_post`, ≤ 400 KB) first, then the thumbnail; 1–2 s apart.
- Both importers run the link step too, so a re-import keeps the links.
- A photo showing a phone number or a person: add the ad id to `src/data/hidden-photos.json` and run
  `npm run link:divar-images` (drops both our copy and Divar's link). Delete the file from `public/img/divar/`.
- Frontend: `photoSources()` (`src/lib/photo.ts`) + `<ListingPhoto>` (tries each source, renders nothing if all
  fail). Plain `<img>`, not `next/image`: Vercel's optimizer can't fetch Divar's CDN either.

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
   Also bake its metro lines: `node scripts/build-metro.mjs [cacheDir]` (lines in service only, ordered
   stations; writes `src/data/metro.json`). A city with 2+ lines gets the «نزدیک کدوم خط مترو؟» question.
   And the neighborhood boundaries for the results-map outline: `node scripts/build-hood-shapes.mjs
   [cacheDir]` (OSM admin_level 10/11 boundaries matched by name + near the registered center; writes
   `src/data/hood-shapes.json`). A neighborhood without an OSM boundary keeps a dashed ~1.2 km circle.
4. Optional: its province name in `PROVINCE_OF` (`src/components/hero-map/hero-map.tsx`) and baked
   roads (`scripts/build-hero-map.mjs`, needs Overpass access).
