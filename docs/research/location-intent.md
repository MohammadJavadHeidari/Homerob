# Where is the user looking? (2026-09-27)

Owner request: when someone types what they want on the landing page, Homerob has to know *where*
they are searching — is the prompt about Mashhad, a house in Kish, …?

## Why it matters
- Rentals are the most local category there is: location is the #2 decision factor after price, and
  most Divar searches stay in one city (see `landing-ux.md`). A result from the wrong city is worse
  than no result.
- Divar and Sheypoor solve it by asking for the city **before** anything else. Homerob's promise is
  "just type what you need", so we can't put a city gate in front of the box, but we still need the
  city.
- **Bug found:** "سوئیت مبله تو کیش" returned Mashhad listings. Kish wasn't in the city list, so its
  name was dropped and the search ran on every city. A city followed by «،» ("تهران،") didn't match
  either, because «،» is in the Arabic Unicode block and counted as a letter.

## Design: infer → show → ask only when unsure
1. **Infer from the text, instantly and offline** (`src/lib/where.ts`, `detectPlace`). Evidence in order:
   - a city name (~80 cities, including Kish, Qeshm, the north coast, satellite cities, Finglish spellings);
   - a neighborhood or landmark that belongs to one city ("سعادت‌آباد" → Tehran, "حرم امام رضا" → Mashhad,
     "گوهردشت" → Karaj);
   - "از تهران میام مشهد" → Mashhad (the city they move *to*).
2. **Show it while they type** (a visible system status, Nielsen heuristic #1): a line under the box, «📍 جستجو در
   سعادت‌آباد، تهران», plus a pin on the home map. If we have no listings there yet, say it right away
   («هنوز آگهی‌ای از کیش نداریم») instead of after the search.
3. **Ask only when we can't tell**, with one tap and no modal:
   - ambiguous name ("الهیه" is in Tehran *and* Mashhad) → «"الهیه" کدوم شهر؟ [مشهد] [تهران]» (both pins on the map);
   - no place at all → «کجا؟ [تهران] [مشهد] [اصفهان] [شیراز] [کرج]» (the city of the last search goes first).
   Tapping writes the city **into the query** ("… در تهران"). The text stays the one source of truth: shareable
   `?q=` URLs, the LLM sees it, no hidden state.
4. **Never block.** Searching without a city still works (all of Iran); the results page then says
   «شهر رو نگفتی، برای همین همهٔ ایران رو گشتم. کجا دنبال خونه‌ای؟» with the same chips. When the city was a
   guess between several, it says which one was used and offers the other.

Server side, the same detector backs up the LLM: a city named in the text wins over the LLM's guess, and a
landmark fills in a city the LLM missed. City names we don't list are kept (→ "no listings from X yet"), never
dropped.

## Not done (options for later)
- IP or browser location as a default city: the owner removed the location prompt on 2026-09-26.
- A full gazetteer (every neighborhood of every city, e.g. from OSM): the hand list covers the big markets;
  real-data imports will add neighborhoods to `HOODS` as they arrive.

Screenshots: `docs/screenshots/where-*.png`.
