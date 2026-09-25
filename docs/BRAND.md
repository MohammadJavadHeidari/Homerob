# Homerob visual identity — Torob's own (owner's choice, 2026-09-25)

Homerob is pitched as "Torob for home", so it uses Torob's identity: logo, «ترب» wordmark, colors and
home-page layout, taken from torob.com (owner's Claude-in-Chrome capture: `docs/research/torob-identity.md`).
The home page keeps its animated map background, drawn on Torob's dark navy.
Earlier research and alternatives: `docs/research/landing-ux.md`, https://claude.ai/artifact/69s9NtyUdorKYH6kWUo2C5.

## Logo
`src/components/torob-logo.tsx` — torob.com's inline SVG (88×88) with its four `--logo-color-*` tokens:
light = red ring `#e91e33` / `#bf0f22` + leaves `#6fbc23` / `#519a23`; dark (`.dark`) = monochrome
`#f1f5f9` / `#cbd5e1`, exactly like torob.com. Home: mark directly above a 40px/700 «ترب».
Also Torob: results-page header (mark + 24px «ترب» in `--logo-color-1`), tab icon `src/app/icon.svg` (the same SVG,
fixed colors), `apple-icon.png`, `public/og.png`, page title and in-app copy («ترب این‌طور فهمید»).
The home page has no demo disclaimer (owner's call); only the OSM/geoBoundaries map credit, which ODbL requires.
The results-page footer still says it's a demo with sample listings.

## Tokens (`src/app/globals.css`, on `html:root` because Neshan's CSS sets `:root { --primary }`)
| Role | Light | Dark (`.dark`, home page) | Torob source |
|---|---|---|---|
| background | `#F1F5F9` | `#15202B` | `--bg-bright` |
| card / popover | `#FFFFFF` | `#212B36` | `--bg-fog` |
| foreground | `#1E293B` | `#F1F5F9` | `--sky-800` |
| muted-foreground | `#5B6B82` | `#94A3B8` | `--sky-500` (`#64748B` is 4.34:1 on the page bg → one step darker, 4.95:1) |
| border / input | `#E2E8F0` / `#CBD5E1` | `#334155` / `#475569` | `--sky-300` |
| **primary** | `#D73948` (white 4.6:1) | `#D73948` | `--brand` |
| brand-soft / brand-ink | `#FFF0F2` / `#9F1239` (7.3:1) | `#3B1D27` / `#FECDD3` | `--red-50` / `--red-800` |
| success | `#15803D` | `#4ADE80` | green ramp |
| warning (trade-offs) | `#854D0F` (6.9:1) | `#FFCA32` | `--yellow-800` / `--yellow-500` |
| radius | 8px | | cards, inputs, buttons |
| theme-color | `#FFFFFF` | `#15202B` | torob.com meta |
| hero map | gold roads on `#0F172B` | | `--sky-50` dark |

Known gap: `#D73948` as small text on the `#F1F5F9` page background is 4.2:1 (Torob does the same);
on white cards it is 4.6:1.

## Type
torob.com uses IRANYekan (a commercial Fontiran font, not ours to ship) → we keep **Vazirmatn**, which is
close in feel. Torob sizes: base 14px, search 16px, wordmark 40/700, card title 14/700, price 14–16/700 in
ink (prices are never red), store count 12px muted.

## Rules (from Torob's patterns)
- Search box: 48px, 8px radius, 1px `--input` border, search icon inside at the start, tagline right under it.
- Prices in bold ink, not brand red; red is for actions (buttons, active sort pill) and the logo.
- Trade-offs in amber (`--warning`), pros in green, one chip style for parsed intent.
- Divar/Sheypoor badges: neutral chip + small colored dot (like Torob's store chips).
- Microcopy: colloquial, second person, short (see `docs/research/torob-identity.md` §6).
