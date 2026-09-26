# Real rental data (Divar, 2024 → prices adjusted to 2026)

Source: public Hugging Face datasets of Divar real-estate ads —
[`divarofficial/real_estate_ads`](https://huggingface.co/datasets/divarofficial/real_estate_ads) (official
Divar sample, 1M ads, ODbL) for **every city**, and
[`RadeAI/Divar-apartmentsRent`](https://huggingface.co/datasets/RadeAI/Divar-apartmentsRent) for extra
**Mashhad** depth. Profile of every dataset found: `docs/REAL_DATA_REPORT.md`.

## Files
| path | what |
|---|---|
| `raw/official_rent_iran.parquet` | all 276,558 residential-rent rows of the official set (every city, all 57 columns) |
| `raw/radeai_mashhad_rent.parquet` | 71,226 Mashhad apartment-rent rows (62,951 unique ads), the 5 RadeAI tables joined |
| `raw/name_map.parquet` | Divar city / district slugs → Persian names (from RadeAI's labels, 265 cities, 1,095 districts) |
| `calibration.json` | 2024 vs live Sept 2026 medians (divar-mcp, 18 calls, aggregates only) → price factor ×2.2 |
| `clean_report.json` | row counts after each cleanup step |
| `build/` (gitignored) | `rent_normalized.parquet`, `listings_iran.parquet` (210,840 clean apartments, 262 cities) |
| `../../src/data/listings.json` | 1,000 Mashhad listings (40 × top-25 neighborhoods): bundled fallback when there is no DB |

## Rebuild and load (needs `pip install duckdb pandas pyarrow "psycopg[binary]"`)
```bash
cd data/real && mkdir -p build
python3 ../../scripts/realdata/normalize.py   # raw/ → build/rent_normalized.parquet
python3 ../../scripts/realdata/clean.py       # → build/listings_iran.parquet + src/data/listings.json
cd ../.. && DATABASE_URL=postgres://… python3 scripts/realdata/load_db.py   # schema + COPY + stats (~10 s)
```
Where port 5432 is blocked (e.g. Claude's cloud sandbox), `scripts/realdata/load_db_http.py` does the same
over Neon's HTTPS `/sql` endpoint (~1 min). The database takes ~185 MB (fits the Neon / Supabase free tiers). Schema: `db/schema.sql`
(`listings` table + `hood_stats` / `city_stats` materialized views used for ranking and the map).

## Cleanup (`clean.py`)
Apartments only; rent 100,000 = "full rahn" placeholder → 0; drop repeated-digit / tiny / missing prices,
bad areas, daily rentals; ppm² outside the city's 1–99th percentile or <0.4× / >3× its neighborhood median
(mislabeled areas, hidden rent); dedupe (official first) on title+area+price and neighborhood+area+price;
coordinates >25 km from the city dropped; phone numbers and links stripped; descriptions cut at 600 chars;
street from text («هاشمیه ۴۲», «بلوار سجاد»); tags aligned with `src/lib/amenities.ts`; prices ×2.2
(`PRICE_FACTOR`, originals kept as `deposit_2024` / `rent_2024`). Dates stay real (1403).

Known gaps: no photos; ~30% of ads have no neighborhood (searchable by city only); the price factor
was calibrated on Mashhad and applied everywhere.
