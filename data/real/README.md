# Real Mashhad rental data (Divar, 2024 → adjusted to 2026)

Source: public Hugging Face datasets of Divar real-estate ads —
[`divarofficial/real_estate_ads`](https://huggingface.co/datasets/divarofficial/real_estate_ads) (ODbL,
official Divar sample) and [`RadeAI/Divar-apartmentsRent`](https://huggingface.co/datasets/RadeAI/Divar-apartmentsRent).
Profile of every dataset found: `docs/REAL_DATA_REPORT.md`. Not wired into the app yet (owner decision pending).

| path | what |
|---|---|
| `raw/divarofficial_mashhad_rent.parquet` | 22,655 Mashhad residential-rent rows (all 57 columns) |
| `raw/radeai_mashhad_rent.parquet` | 71,226 Mashhad apartment-rent rows (62,951 unique ads), the 5 RadeAI tables joined |
| `raw/mashhad_neighborhood_slug_map.parquet` | 149 Divar neighborhood slugs → Persian names |
| `calibration.json` | 2024 vs live Sept 2026 medians (divar-mcp, 18 calls, aggregates only) → price factor ×2.2 |
| `clean_report.json` | row counts after each cleanup step |
| `listings.sample.json` | 1,000 clean listings (40 × top-25 neighborhoods) in the app's `Listing` shape |
| `build/` (gitignored) | `mashhad_rent_normalized.parquet`, `mashhad_rent_clean.parquet` (56,093 rows) |

Rebuild (≈30 s, needs `pip install duckdb pandas pyarrow`):

```bash
cd data/real && mkdir -p build
python3 ../../scripts/realdata/normalize.py   # raw/ → build/mashhad_rent_normalized.parquet
python3 ../../scripts/realdata/clean.py       # → build/mashhad_rent_clean.parquet, listings.sample.json
```

Cleanup (`clean.py`): apartments only; rent 100,000 = "full rahn" placeholder → 0; drop repeated-digit /
tiny / missing prices, bad areas, daily rentals, ppm² outside the 1–99th percentile; dedupe (official
first) on title+area+price and neighborhood+area+price; strip phone numbers and links; street from text
(«هاشمیه ۴۲», «بلوار سجاد», else the neighborhood); tags aligned with `src/lib/amenities.ts`; prices ×2.2
(`PRICE_FACTOR`, originals kept as `deposit_2024` / `rent_2024`, rounded to 10M / 0.5M Toman).

Known gaps: no photos; dates are 2024 (month-only for the official set); `totalFloors` often missing;
rooms in shared flats are kept but flagged (`shared_room`).
