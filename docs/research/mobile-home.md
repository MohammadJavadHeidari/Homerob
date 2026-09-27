# Mobile home screen — product & UX research (2026-09-27)

Owner request: "How can we make the mobile experience better? On mobile we can have scrollable
items like *picks based on your favorite items*." Inputs: Torob's mobile home (owner's screenshot +
full-page PDF capture, 2026-09-27), Mohammad's mobile structure from the call
(`call-2026-09-25-mohammad.md` §1), NN/g and Baymard research (sources at the end).
Visual version with phone mockups: see the artifact link in `docs/PLAN.md` (Open questions).

## 1. What Torob's mobile home does (top to bottom)

| Block | What it is | Why it works | Homerob equivalent |
|---|---|---|---|
| Logo + search | 88px mark, search with voice + camera | One clear first action | Keep ours (logo + AI search) |
| Trending chips | Red pills, horizontal scroll («a07», «کفش فوتسال») | One-tap queries, no typing | **Recent searches** (returning) / 3 example queries (first visit) |
| 3 shortcut icons | «پس‌انداز طلا», «ترب‌پی», «اطراف من» | Big tap targets for Torob's own services | «دستیار هوشمند», «اطراف من», «ذخیره‌ها» |
| Promo strip | Green «میخوای قسطی بخری؟ → دریافت اعتبار» | Pushes one service | «نمی‌دونی چی می‌خوای؟ از دستیار بپرس» (Mohammad: push users to the assistant) |
| Install card | «می‌خواهید ترب را روی گوشی نصب کنید؟» | PWA install | Later (manifest exists in Torob; low priority for the demo) |
| Banner carousel | «ترب‌پی — پرداخت در ۴ قسط» | Marketing | Skip (no marketing to show) |
| **Rails** | «ترندهای موبایل…», «پرفروش‌ترین گوشی‌ها» + «نمایش همه» | Browse without a query; 2 cards + a peek of the 3rd | **The core of this proposal** (§3) |
| Rail card | Photo, photo count, «آگهی» (sponsored) tag, 2-line title, «از ۷۲٫۳۰۰٫۰۰۰ تومان», «در ۸۰ فروشگاه» | Price + "how many sellers" = Torob's value in one line | Photo, 2-line title, rahn/ejare in bold ink, «۹۵ متر · ۲ خواب · وکیل‌آباد», one signal chip, «در دیوار و شیپور» (our `alsoOn` = Torob's «در N فروشگاه») |
| Bottom nav | جستجو · دسته‌بندی · پیشنهاد ویژه · ترب من | Familiar app frame | خانه · دستیار هوشمند · ذخیره‌شده‌ها (+ ترب من later) |

Takeaway: Torob's mobile home is **search first, then things to tap**. Nobody has to type to get value.
This matches Mohammad's point that users expect a Divar/Torob-shaped home («ظاهر آشنا، با یه برتری واقعی»).
Our current mobile home is only logo + search on a dark map: clean, but a returning user sees nothing
of what they did last time.

## 2. What the research says

- **Recommendations are welcome, if labelled.** Users see personalized suggestions as a feature, not a
  privacy problem, and expect them from saved items and viewing history. They rely on explicit headings
  like "Recommended for you" / "Because you watched" to tell personal rails from promotions (NN/g).
- **Cold start is forgiven.** Users know a system needs data and don't expect good picks on the first
  visit (NN/g). → Don't fake personalization on visit 1; show generic rails, switch on personal ones
  after the first save.
- **Rails need a visible peek.** Half-cut cards are the strongest swipe signifier; dots are weak. The last
  item should be reachable in 3–4 swipes; items in one rail must be closely related; long sets belong in
  a list ("see all") (NN/g mobile carousels).
- **The first card sells the rail.** People skip the rest if the first item is uninteresting → sort each
  rail by relevance, never randomly (NN/g).
- **Mobile sites have fewer signed-in users than apps**, so personalization must work without login
  (Baymard). → Keep the taste profile on the device (localStorage); no account needed.
- **Rentals are local.** ~2/3 of Divar searches stay in the user's own city (already in
  `landing-ux.md`). → Every rail is scoped to one city (the last searched one).

## 3. Proposal: the rails

Order matters: personal and "unfinished business" first, discovery after.

| # | Rail title (UI) | Shows | Appears when | Source of truth |
|---|---|---|---|---|
| 1 | «پیشنهاد برای تو» | Listings like the ones you saved/opened, each with a reason: «چون یه دوخوابه تو وکیل‌آباد ذخیره کردی» | ≥1 save or ≥2 opened listings | Taste profile → `SearchIntent` → existing `score.ts` |
| 2 | «ادامهٔ جستجو: دوخوابه وکیل‌آباد تا ۵۰۰» + «۳ جدید» badge | Results of your last search, new ones first | After 1 search | Last intent (already parsed; no LLM call) |
| 3 | «زیر قیمت محله» | Listings ≥10% under their neighborhood's median price per m² | Always (city has ≥5 comparable listings) | `comparablePrice` + existing medians; placeholder prices excluded (`quality.ts`) |
| 4 | «تازه‌ترین‌ها در مشهد» | Newest listings | Always (the cold-start rail) | `postedAt` |
| 5 | «اخیراً دیدی» | Listings you opened | ≥1 opened listing | localStorage |

First visit = rails 3 + 4 (+ example chips). After one save = rail 1 appears on top. This before/after
is the demo moment (§5).

### Taste profile (on-device, no LLM, instant)
- Events kept in localStorage: saved ids (♥), opened ids, last 5 search intents.
- Profile = city (most frequent), neighborhoods (weighted, + `ADJACENT` at half weight), rooms (mode),
  category, price band (median `comparablePrice` of saved items ±25%), amenities seen in ≥ half the saves.
- Turn the profile into a `SearchIntent` and rank with the existing scorer. Drop saved/seen ids and
  Divar/Sheypoor duplicates; max 2 per neighborhood in the first 5 cards (variety).
- Reason line from the strongest matching feature (rule-based, like the explanation fallback), so it is
  always true: «هم‌محلهٔ آگهی ذخیره‌شده‌ات · ۱۲٪ ارزون‌تر».
- «پاک کردن سابقه» link under the rails. Nothing leaves the phone.

### Card (rail) spec
- Width ≈ 44% of the viewport → 2 cards + a peek of the 3rd at 390px. 8–10 cards, then «نمایش همه»
  opens the results page with that rail's intent.
- Photo (4:3) when the listing has one; until real data lands, a neutral tile with the category icon and
  the neighborhood name (the sample set has no photos).
- Title 2 lines · price bold ink («رهن ۴۵۰م · اجاره ۱۸م») · «۹۵ متر · ۲ خواب · وکیل‌آباد» ·
  one signal chip (green «۲۱٪ زیر قیمت محله», or «۲ ساعت پیش») · «در دیوار و شیپور» when deduped ·
  ♥ button top corner. Same tokens as `BRAND.md` (8px radius, prices never red).

### Frame
- **Search stays first.** Map + logo + search as the first screen; the feed is a light sheet that
  slides up over the map when you scroll (keeps the video's map "wow", readable feed).
- Chip row under the search: recent searches (returning) or the 3 example queries (first visit).
- Bottom nav (mobile only): «خانه» · «دستیار هوشمند» (the search/chat) · «ذخیره‌شده‌ها».
  No «ثبت آگهی»: Homerob is a meta-search like Torob and doesn't host ads.
- Desktop unchanged (Mohammad: desktop has room; mobile is the hard part).

## 4. What conflicts with existing decisions (needs the owner)

- `DECISIONS.md` 2026-09-26 "Landing = logo + search only" → this adds a feed below the fold on mobile.
- 2026-09-27 "No category picker on the home page" → respected: no category icons, only rails.
- "Real data only" → rails show whatever real data exists; with the sample set they are Mashhad-only and
  photo-less. They get much better once the importer lands.
- Mohammad's login gate ("AI analysis only for members") and 3–4 screen assistant onboarding are out
  of this proposal (need accounts; bigger scope).

## 5. Demo beat (≈15 s)
Phone view → search «دوخوابه وکیل‌آباد ۵۰۰ رهن» → ♥ one result → back to home → «پیشنهاد برای تو»
appears on top with «چون یه دوخوابه تو وکیل‌آباد ذخیره کردی». Shows AI + personalization without a
single extra word typed.

## 6. Effort
Option A (full: rails 1–5, saves, bottom nav, sheet): ~4–5 h. Option B (only saves + rails 1–2 under the
current landing, first visit unchanged): ~2 h.

## Sources
- NN/g, Individualized Recommendations: Users' Expectations & Assumptions — https://www.nngroup.com/articles/recommendation-expectations/
- NN/g, Carousels on Mobile Devices — https://www.nngroup.com/articles/mobile-carousels/
- NN/g, The Illusion of Completeness — https://www.nngroup.com/articles/illusion-of-completeness/
- NN/g, Carousel Usability — https://www.nngroup.com/articles/designing-effective-carousels/
- Baymard, Native mobile apps study (personalization easier when signed in) — https://baymard.com/blog/native-mobile-apps-launch
- Baymard, Homepage & category navigation — https://baymard.com/research/homepage-and-category-usability
