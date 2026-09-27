# Real-estate categories — product & UX research (2026-09-27)

Owner request: let users search and filter by **Residential rental, Residential sales, Office &
Commercial sales, Office & Commercial rentals, Construction projects, Short-term rentals**.

## 1. What users already know: Divar's «املاک» tree

The six categories the owner listed are exactly Divar's top-level real-estate categories. Sheypoor
uses nearly the same split. Keeping Divar's names makes Homerob "familiar like Divar, with one real
advantage" (Mohammad's advice, `call-2026-09-25-mohammad.md`).

| Key | Divar name (shown in UI) | Property types (Divar sub-categories) | Price model |
|---|---|---|---|
| `residential-rent` | اجاره مسکونی | آپارتمان · خانه و ویلا | rahn + ejare (convertible) |
| `residential-sale` | فروش مسکونی | آپارتمان · خانه و ویلا · زمین و کلنگی | total price |
| `commercial-rent` | اجاره اداری و تجاری | دفتر کار، اتاق اداری و مطب · مغازه و غرفه · صنعتی، کشاورزی و تجاری | rahn + ejare |
| `commercial-sale` | فروش اداری و تجاری | same as above | total price |
| `short-term` | اجاره کوتاه‌مدت | آپارتمان و سوئیت · ویلا و باغ · دفتر کار و فضای آموزشی | price per night |
| `projects` | پروژه‌های ساخت و ساز | پیش‌فروش · مشارکت در ساخت | total price (often none → «توافقی») |

Source: Divar's public category tree as known to us. The sandbox can't open divar.ir, so the
owner should give the names a quick look against the live site.

## 2. What changes between categories

The categories need different price models and different filters. The ranking logic stays the same.

- **Price.** Rentals compare on the full-rahn equivalent (existing 3%/month rule). A sale compares
  on the total price. A short stay compares on the price per night. The same number is used for sorting,
  histograms, "cheaper than the neighborhood median" and map pins. `comparablePrice()` in
  `src/lib/categories.ts`.
- **Medians.** Medians are kept per category, city and neighborhood. A shop's price per m² says
  nothing about a flat's.
- **Filters.** Rooms only matter for homes, so they are hidden for offices and shops. The
  «رهن کامل / اجارهٔ کامل» switch and «قابل تبدیل» only apply to rentals. Price hints and slider
  steps follow the category: tens of millions for rahn, hundreds of millions for a purchase,
  hundreds of thousands for a night.
- **Placeholder prices.** A sale with no price or a dummy one (common in «مشارکت در ساخت»),
  or a night under 100k, is kept out of ranking. This matches the rental rule.
- **Shared rooms (همخونه).** This only applies to residential rentals. «اجاره اتاق اداری» is
  an office.

## 3. How people ask (Persian cues the AI and the rule fallback use)

| Category | Typical phrasing |
|---|---|
| sale | خرید، بخرم، فروشی، قیمت کل، سند، قسطی — "آپارتمان صد متری تو شیراز بخرم تا ۶ میلیارد" |
| commercial | مغازه، دفتر کار، اداری، تجاری، مطب، غرفه، سوله، انبار (≠ انباری), کافه، کارگاه |
| short-term | روزانه، شبی، هر شب، آخر هفته، تعطیلات، کوتاه‌مدت، مسافر — "ویلا با استخر برای آخر هفته، شبی ۴ تومن" |
| projects | پیش‌فروش، پیش‌خرید، مشارکت در ساخت، پروژه، سازنده |

A budget is read as rahn/ejare first and then moved to the category's own price. "۵ میلیارد" in a
purchase query becomes a total price. "شبی ۲ تومن" becomes a price per night.

## 4. Design decisions

1. **Natural language picks the category.** No category picker on the home page. The owner's
   landing decision is "logo + search only", and Mohammad asked for a home page without
   categories. The AI understands "بخرم" or "مغازه". The category also shows as the first chip
   under «ترب این‌طور فهمید».
2. **Category tabs on the results page.** One scrollable row of the six Divar names sits above
   the chips. The active tab shows what the AI understood, and tapping another tab re-runs the same
   request in that category. The rest of the request is kept. The budget is kept only when both
   categories use the same price model, because a rahn budget is not a purchase budget. On a
   phone the row scrolls, and the active tab scrolls into view.
3. **No results is said honestly.** Until real ads of a category are imported, that category shows
   «هنوز آگهی «فروش مسکونی» در مشهد نداریم», names what will come (its property types) and offers
   one click back to a category that has results. Listings are never invented.
4. **Rentals stay the default.** A query with no category cue behaves exactly as before, so the
   demo queries don't change.

## 5. What real data needs (importer)

Every imported ad sets `category`. Sales and projects set `price`, short stays set `nightlyPrice`,
and rentals keep `deposit` / `monthlyRent`. Format: `docs/DATA.md`. Once ads of a category are in
`listings.json`, search, filters, medians, map pins, compare and AI explanations pick them up with
no code change.

## 6. Open / later

- Property-type sub-filter (apartment vs villa vs land; office vs shop). This needs real data to be
  worth a UI.
- Category-specific attributes (sale: document type «سند»; short-term: capacity / min nights;
  projects: delivery date, progress %). Add them when the importer sees them in real ads.
