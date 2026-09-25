# Real-data report — Mashhad residential rentals from Hugging Face

Step 1 of "Real data" in `docs/PLAN.md` (collect + profile, offline). Collected 2026-09-25 from
Hugging Face only (API search + file downloads); Divar, Sheypoor and divar-mcp were not contacted.
Raw and derived files live in the session scratch dir (`realdata/`, ~560 MB), not in the repo.

All money is **Toman** (proof in §3). "M" = million Toman. `full = deposit + rent / 0.03`
(same as `src/lib/pricing.ts`), `ppm2 = full / area`.

## 0. TL;DR
- Two accessible datasets hold real Mashhad rentals, both **2024 only**:
  **divarofficial/real_estate_ads** (22,655 Mashhad residential-rent rows, May–Dec 2024) and
  **RadeAI/Divar-apartmentsRent** (62,951 unique Mashhad apartment ads, Mar–Aug 2024).
  Overlap between them is only ~8–15% → independent samples of the same market.
- `laleh22/Divar-apartmentsRent` and `mhdm317/real_estate_ads` are byte-identical copies (the 2026
  date on laleh22 is the copy date). No Sheypoor data exists on Hugging Face.
- Gated (HF login needed, 401): `EhsanShahbazi/kilid-adverts` (7,657 rows) and
  `EhsanShahbazi/melkradar-adverts` (100K–1M rows), both uploaded 2025-12 — the only likely source
  of newer prices.
- Usable: ~75.5k clean apartment ads (exact dedupe), ~56.5k (aggressive dedupe); ~13.4k in the
  app's 6 neighborhoods; + ~3.2k houses/villas.
- The 3%/month rahn↔ejare rate is confirmed by the data (median implied rate 0.030, n=1,511).

## 1. Discovery
~400 unique hits from English, Persian and transliterated queries (divar, sheypoor, kilid, ihome,
melkradar, iran/tehran/mashhad × real estate/housing/rent, اجاره، رهن، آپارتمان، مسکن، املاک، دیوار،
شیپور، مشهد …), `language:fa` tag filters, and uploader listings.

| id | license | modified | size | verdict |
|---|---|---|---|---|
| divarofficial/real_estate_ads | odbl | 2025-04-26 | 1M rows, 57 cols | **Base.** Official Divar sample, 421 cities, all real-estate categories, 2024 |
| RadeAI/Divar-apartmentsRent | mit | 2024-07-22 | 764,726 rows, 5 row-aligned CSVs | **Relevant.** Daily scrape of apartment-rent, Farvardin–Tir 1403 |
| laleh22/Divar-apartmentsRent | – | 2026-04-19 | = RadeAI | Exact copy (same LFS oids) |
| mhdm317/real_estate_ads | odbl | 2025-12-06 | = official | Exact copy (same sha256) |
| EhsanShahbazi/kilid-adverts | mit | 2025-12-28 | 7,657 rows | Gated (401) |
| EhsanShahbazi/melkradar-adverts | mit | 2025-12-02 | 100K–1M rows | Gated (401) |
| sasanbarok/Persian_Tehran_RealEstate_QA | – | 2025-02 | 45 QA pairs | Tehran sale stats 1403, context only |
| mehr32/divar, Falah/ads-real_estate | | | | Irrelevant (articles / English prompts) |

## 2. Inventory (downloaded)
| id | rows | dates | disk | full copy |
|---|---|---|---|---|
| divarofficial/real_estate_ads | 1,000,000 | 99.8% in 2024-04…12 | 325 MB parquet | yes |
| RadeAI/Divar-apartmentsRent | 764,726 (682,977 unique) | 2024-03-18…2024-08-08 | 159 MB (CSV→parquet) | yes |
| sasanbarok/Persian_Tehran_RealEstate_QA | 45 | 1403 | 8 KB | yes |

Derived: Mashhad rent subsets per dataset, `mashhad_rent_normalized.parquet` (85,606 rows,
Listing-like columns + `q_*` quality flags + dedupe keys), `mashhad_neighborhood_slug_map.parquet`
(149 slugs → Persian names), national city × category × month counts; scripts `normalize.py`,
`profile.py`.

## 3. Money units = Toman
- RadeAI text fields: `Deposit="150٬000٬000 تومان"` beside `credit=150000000`.
- Official Mashhad 2-bed medians: 200M deposit + 6M rent at 100 m² — realistic in Toman, absurd in Rial.
- Official fields: `credit_value` = deposit; `rent_value` = monthly rent (`rent_mode`: fixed / free=0 /
  negotiable); `rent_credit_transform` = convertible (6.8%); `transformed_credit/rent` = the landlord's
  alternative split (implied rate p25 0.0275, **p50 0.030**, p75 0.030).
- **Rent = 100,000 is a placeholder meaning "full rahn"** (8,727 rows) → treat as 0.

## 4. Counts
| | official | RadeAI |
|---|---|---|
| Mashhad residential rent | 22,655 (19,083 apt + 3,572 house/villa) | 62,951 apt |
| excluded short-term rent | 2,941 | – |
| date field | month only | ad-expiry timestamp |
| clean apartments | 18,203 | 59,955 |

## 5. Neighborhoods
149 distinct in each set, none missing. Coordinates: official 54% (±500 m radius), RadeAI 7%.

The app's current 6 (clean, combined, medians in M Toman):

| app | slug | Divar label | ads | dep | rent | full | m² | ppm2 |
|---|---|---|--:|--:|--:|--:|--:|--:|
| الهیه | elahiyehblvd | الهیه | 7,690 | 300 | 3.5 | 500 | 105 | 4.64 |
| قاسم‌آباد | ghasemabad | قاسم‌آباد (شهرک غرب) | 6,726 | 200 | 5 | 383 | 85 | 4.35 |
| هاشمیه | hashemieh | هاشمیه | 3,090 | 300 | 14 | 803 | 130 | 6.67 |
| سجاد | sadjadshahr | بلوار سجاد | 1,573 | 500 | 25 | 1,467 | 170 | 8.89 |
| وکیل‌آباد | vakilabad | وکیل‌آباد | 1,209 | 300 | 8 | 683 | 125 | 5.83 |
| احمدآباد | ahmadabad | احمدآباد | 1,160 | 300 | 15 | 1,018 | 150 | 7.22 |

Note: app «سجاد» = `sadjadshahr`, not `sajadieh` (سجادیه, a different, cheaper area). The synthetic
seed data had الهیه as the priciest area; real data puts it mid-market and سجاد / احمدآباد on top.

Top neighborhoods by count (combined clean apartments):

| slug | fa | n | dep | rent | full | m² | ppm2 |
|:--|:--|--:|--:|--:|--:|--:|--:|
| elahiyehblvd | الهیه | 7690 | 300 | 3.5 | 500 | 105 | 4.64 |
| ghasemabad | قاسم‌آباد | 6726 | 200 | 5 | 383 | 85 | 4.35 |
| bolvartoos | بلوار توس | 3851 | 100 | 2.5 | 183 | 80 | 2.41 |
| azadshahr | آزادشهر | 3576 | 300 | 10 | 808 | 150 | 6.25 |
| hashemieh | هاشمیه | 3090 | 300 | 14 | 803 | 130 | 6.67 |
| north-tabars | طبرسی شمالی | 2643 | 120 | 2 | 193 | 75 | 2.49 |
| sayyadshirazi | صیاد شیرازی | 2330 | 200 | 8 | 545 | 100 | 5.49 |
| haftetir | هفت تیر | 2120 | 300 | 11 | 700 | 120 | 6.11 |
| kuy-e-sarafrazan | سرافرازان | 1693 | 150 | 6.5 | 385 | 85 | 4.62 |
| sadjadshahr | بلوار سجاد | 1573 | 500 | 25 | 1467 | 170 | 8.89 |
| daneshjoo | دانشجو | 1571 | 300 | 12 | 753 | 150 | 6.04 |
| rezashahr | رضاشهر | 1560 | 300 | 9 | 653 | 110 | 6.04 |
| farhang | فرهنگ | 1443 | 400 | 13.5 | 1033 | 160 | 6.88 |
| faramarzabbasi | فرامرز عباسی | 1416 | 350 | 12 | 800 | 150 | 6.25 |
| Kuy-e-Seyyedi | سیدی | 1351 | 130 | 3 | 230 | 82 | 2.81 |
| amiriyeh-mashhad | امیریه | 1339 | 200 | 2.5 | 383 | 95 | 4.10 |
| honarestan | هنرستان | 1214 | 325 | 15 | 867 | 140 | 6.71 |
| vakilabad | وکیل‌آباد | 1209 | 300 | 8 | 683 | 125 | 5.83 |
| ahmadabad | احمدآباد | 1160 | 300 | 15 | 1018 | 150 | 7.22 |
| tollab | طلاب | 1155 | 200 | 2.5 | 317 | 80 | 3.92 |
| eqbal | اقبال | 1042 | 300 | 8 | 600 | 105 | 5.61 |
| kuy-e-kowsar | کوثر | 998 | 300 | 13.75 | 895 | 140 | 6.89 |
| koohsangi | کوه سنگی | 626 | 400 | 7 | 833 | 120 | 6.47 |
| fareqoltahsilan | فارغ التحصیلان | 610 | 400 | 10 | 803 | 145 | 6.18 |
| sanabad | سناباد | 476 | 300 | 12 | 700 | 125 | 6.00 |

## 6. Distributions (clean apartments, medians in M Toman)
| rooms | n | dep | rent | full | m² |
|--:|--:|--:|--:|--:|--:|
| 0 | 1,352 | 50 | 3.2 | 163 | 50 |
| 1 | 16,791 | 100 | 3.0 | 217 | 70 |
| 2 | 39,051 | 200 | 5.0 | 450 | 100 |
| 3 | 17,425 | 500 | 14.5 | 1,033 | 160 |
| 4 | 768 | 900 | 30 | 2,167 | 280 |

Official quantiles — deposit p10/p50/p90: 50 / 200 / 700; rent 0 / 6 / 23; full 200 / 500 / 1,250;
ppm2 2.61 / 4.98 / 7.95. RadeAI values run ~5–10% lower. Year built: median 1396 → buildingAge = 1405 − year.

## 7. Completeness vs `Listing` (% missing, official / RadeAI)
title 0.1/0 · neighborhood 0/0 · **street 100/100** (extract from text) · deposit 0.1/0 · rent 0.2/0 ·
area 0/0 · rooms 0/0 · floor 15.8/0 · totalFloors 51.6/43.6 · year built 0/0 · elevator 15.8/0 ·
parking 0/0 · storage 0/0 · balcony 35.6/43.5 · convertible 0/0 · description 0/0 (cut at 1,000
chars) · postedAt 0/0 (month only / expiry) · **imageUrl 100/100** · lat/lon 46/93.

## 8. Quality issues (official / RadeAI)
| issue | official | RadeAI |
|---|--:|--:|
| rent = 100k placeholder | 2,033 | 6,694 |
| repeated-digit deposit / rent | 113 / 218 | 178 / 429 |
| deposit 0–5M | 290 | 655 |
| area < 20 or > 1000 | 166 | 453 |
| ppm2 outside 1–99 pct | 485 | 1,326 |
| shared-room ads | 587 | 1,366 |
| phone numbers strict / loose | 5 / 9 | 22 / 80 |

Extremes: deposit up to ~1.1e14; 29 rows > 50 bn deposit; 153 rows > 500M rent.
RadeAI `description` is an HTML meta string wrapper → strip. RadeAI has 8,275 same-token re-scrapes.

## 9. Price adjustment 2024 → Sept 2026
No empirical factor from these datasets (no 2025–26 Mashhad rentals). Within 2024 the trend is flat
(official ppm2 May 5.00 → Dec 4.85; RadeAI Apr 4.12 → Jul 4.83, summer season).
Options: (1) divar-mcp calibration (owner chose this, pending the CLAUDE.md exception),
(2) gated kilid/melkradar sets (owner's HF login), (3) SCI rent CPI for Mashhad.
External national figures, **unverified**: SCI rent inflation Esfand 1404 ~34% (12-month average)
([NourNews](https://nournews.ir/en/news/306188/sci-housing-rent-inflation-tu)); ~42% y/y to Nov 2024
([Iran International](https://www.iranintl.com/en/202411236717)). Over ~2.2 years that would be ≈ ×1.8–1.9.

## 10. Recommendation for step 2 (normalize)
Base = official set; add unique RadeAI ads for volume (dedupe on normalized title + area + deposit +
rent); skip the copies. Sample 50–200 ads per neighborhood for the app. Work items: placeholder and
outlier prices (rent 100k → 0), Persian room/floor/year parsing, slug → Persian names, street and
amenity-tag extraction, phone-number stripping, shared-room / short-term / pilgrim removal,
`postedAt` precision, the price factor, and no images.

## 11. National context (official set)
Mashhad is #2 after Tehran: 69,032 real-estate ads (19,083 apartment-rent, 3,572 house-rent,
24,331 apartment-sell). Median apartment-rent: Tehran 600M + 8.5M/month; Mashhad 200M + 5.5M.
