# Landing page UX research (2026-09-25)

Owner feedback: the home page is "too messy and too occupied" for ordinary people looking for a house.
Visual version (with before/after mockups and palettes): https://claude.ai/artifact/69s9NtyUdorKYH6kWUo2C5

## What a first-time visitor needs
| When | Their question | Where Homerob answers it |
|---|---|---|
| 0–1 s | Does this look trustworthy and easy? | Calm visuals, readable text, one focal point (visual appeal forms in ~50 ms — Lindgaard 2006) |
| 1–5 s | What is this, is it for me? | Headline + city |
| 5–10 s | What do I do? | One big input, short placeholder, 3 tappable examples |
| 10–30 s | Anything in my budget, near me? | Neighborhood median-price row + location pill |
| Later | How does it work, is the data real? | Results (chips, "why this listing") + one-line footer |

Evidence:
- Most visitors leave in the first 10–20 s unless the value is clear within ~10 s (NN/g, "How long do users stay on web pages").
- Price (~90% "very important/essential") then location (~85%) dominate renters' decisions (NMHC / Apartments.com survey).
- Articulation barrier: roughly half of adults are low-literacy; writing a prompt is harder than reading, so a blank AI box makes people freeze (Nielsen). → short placeholder, short tappable examples.
- Search suggestions are used ~23% of the time; irrelevant ones are worse than none (NN/g). Hick's law → 3 examples, not 6.
- ~2/3 of Divar searches stay in the user's own city; rentals are the most local category (Divar search-geography report). Mental model = Divar: city → neighborhood → price → rooms.
- People scan, don't read; "how it works" strips and disclaimers are skipped, especially on 390 px phones (NN/g homepage guidelines).

## Audit of the current landing (11 blocks, ~170 words)
Keep: logo, title (reword), location pill (merge with city), search box.
Cut: status badge (third "Mashhad"), description paragraph, "how it works" cards.
Move/shrink: 6 long examples → 3 short; neighborhood price panel → row under search (tappable);
map → faint texture, never behind text; 3-line disclaimer → 1 line + about sheet.
Bug: on mobile the dark map ends at viewport height; the dark "how it works" cards and footer render on white below it.

## Proposed landing (recommended)
Top bar: logo + «مشهد · نزدیک X» pill → H1 «دنبال چه خونه‌ای هستی؟» → subtitle «آگهی‌های رهن و اجارهٔ دیوار و شیپور، یه‌جا و مرتب‌شده»
→ input (placeholder «مثلاً: دوخوابه وکیل‌آباد، ۵۰۰ رهن») + «پیدا کن» → 3 chips → «قیمت محله‌ها» row → one-line footer.
~5 blocks, ~45 words. Pending owner choice (see PLAN.md Open questions).

## Sources
- https://www.nngroup.com/articles/how-long-do-users-stay-on-web-pages/
- https://www.tandfonline.com/doi/abs/10.1080/01449290500330448
- https://www.nngroup.com/articles/top-ten-guidelines-for-homepage-usability/
- https://www.nngroup.com/articles/site-search-suggestions/
- https://jakobnielsenphd.substack.com/p/prompt-driven-ai-ux-hurts-usability
- https://lawsofux.com/hicks-law/
- https://www.apartments.com/blog/apartment-features-renters-want-most
- https://digiato.com/iran-technology-news/search-geography-in-divar
