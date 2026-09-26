# Scraped listings (raw CSV)

Current files (2026-09-26): `<hood>-divar.csv`, one per neighborhood, collected from single Divar ad
pages with these exact headers (the importer matches them by name):

`عنوان,محله,ودیعه,اجاره,متراژ,اتاق,طبقه,سال ساخت,آسانسور,پارکینگ,انباری,توضیحات,زمان,link,image`

`محله` is Divar's district name. Divar has no «هاشمیه»/«قاسم‌آباد» district, so those files come from
«هنرستان» and «شهرک رازی (شهرک غرب)»; the file name supplies our neighborhood. Descriptions had seller
names, agency lines, office addresses and phone-like numbers removed; no phone numbers, seller names,
chat links or exact addresses are stored.

Put CSV exports from the **Ultimate Web Scraper** Chrome extension here, then run:

```bash
npm run import:scraped
```

This writes `src/data/scraped.json`, the only data the app searches.

## How to export
1. Open a Divar (or Sheypoor) Mashhad rent page, ideally filtered to one of our neighborhoods:
   الهیه، سجاد، وکیل‌آباد، احمدآباد، هاشمیه، قاسم‌آباد. Scroll to load as many ads as you want.
2. Extension → **List Extractor** → select the ad cards → export **CSV**.
3. Name the file after the neighborhood and site, e.g. `sajad-divar.csv` or `سجاد-دیوار.csv`
   (used when a row doesn't name its neighborhood).
4. Optional, for better ranking: **Page Extractor** on single ads gives متراژ، اتاق، طبقه، سال ساخت،
   آسانسور/پارکینگ/انباری. The importer reports which fields it had to fill with defaults.

Rows outside the six neighborhoods, without a price (e.g. «توافقی»), with placeholder prices
(e.g. «۱٬۰۰۰ تومان» on roommate posts) or an implausible area (<20 or >1000 m²) are skipped.
