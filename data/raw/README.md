# Scraped listings (raw CSV)

Put CSV exports from the **Ultimate Web Scraper** Chrome extension here, then run:

```bash
npm run import:scraped
```

This writes `src/data/scraped.json`, which search merges with the seeded sample data.

## How to export
1. Open a Divar (or Sheypoor) Mashhad rent page, ideally filtered to one of our neighborhoods:
   الهیه، سجاد، وکیل‌آباد، احمدآباد، هاشمیه، قاسم‌آباد. Scroll to load as many ads as you want.
2. Extension → **List Extractor** → select the ad cards → export **CSV**.
3. Name the file after the neighborhood and site, e.g. `sajad-divar.csv` or `سجاد-دیوار.csv`
   (used when a row doesn't name its neighborhood).
4. Optional, for better ranking: **Page Extractor** on single ads gives متراژ، اتاق، طبقه، سال ساخت،
   آسانسور/پارکینگ/انباری. The importer reports which fields it had to fill with defaults.

Rows outside the six neighborhoods, or without a price (e.g. «توافقی»), are skipped.
