# Homerob visual identity — "Torob family" red (owner's choice, 2026-09-25)

Homerob = "Torob for home", so the brand borrows Torob's family color: a warm red on a warm sand
ground. The home page keeps its dark animated map (gold roads) as the background; the red is the
one action color on top of it. Research and the alternatives considered: `docs/research/landing-ux.md`
and https://claude.ai/artifact/69s9NtyUdorKYH6kWUo2C5.

## Tokens (`src/app/globals.css`) — WCAG AA checked
| Role | Light | Dark (`.dark`, home page) | Notes |
|---|---|---|---|
| background | `#F7F4EF` sand | `#161311` | ink on bg 14.9:1 / 15.4:1 |
| card | `#FFFFFF` | `#1F1B18` | |
| foreground (ink) | `#231F1C` | `#EFE9E2` | not pure black |
| muted-foreground | `#6B625A` | `#A89F96` | 5.4:1 on sand / 7.1:1 on dark |
| border | `#E7E0D8` | white 10% | |
| **primary** | `#D41A2E` | `#F2566A` | white on light 5.3:1; dark text `#1A0B09` on coral 5.8:1 |
| brand-soft / brand-ink | `#FDE8EA` / `#9E1426` | `#3A1A1E` / `#F4A3AC` | intent chips, AI "why" box (6.9:1 / 7.9:1) |
| success | `#1E7A4C` | `#5FC48E` | pros, match score ≥ 85 |
| warning | `#9A5B00` | `#F2B85B` | trade-offs / cons (amber, never red) |
| destructive | `#A1201A` | `#F2877B` | real errors only, always with an icon |
| hero map | gold `#E8BC6A` on `#05070C` | | "you are here" marker = coral `#F2566A` |

`globals.css` declares the light tokens on `html:root`: the Neshan map CSS ships its own
`:root { --primary: #03a9f4 }`, which used to turn the brand color blue on desktop once the map loaded.

Hue taken from Torob's own icon (`#E91E33`, shadow `#BF0F22`); `#E91E33` itself gives white text only
4.47:1, so buttons use the slightly deeper `#D41A2E`.

## Logo
- `public/brand/torob-icon.png` — Torob's official app icon (256 px, from torob.com/static/icons/icon-512x512.png).
- `public/brand/torob-logo.png` — white one-color version derived from it, as torob.com shows on its dark home.
  `src/app/page.tsx` picks it up and the home page stacks it over the «ترب» wordmark.
- The browser-tab icon is still Homerob's house tile (`src/app/icon.svg`); switching it is pending the owner.

## Type
Vazirmatn everywhere. Minimum 16 px for anything that must be read on a phone; 13 px for labels only.
Persian digits in text; tabular numbers for prices.

## Rules
- One red action per screen (the search button on the home page).
- Red is the brand, so it is **not** used for "bad": trade-offs are amber, pros are green.
- One chip style (brand-soft) for every "what the AI understood" chip — no sky/violet/amber rainbow.
- Divar/Sheypoor badges: neutral chip + small brand-colored dot.
- No text over map lines without a scrim.

## Assets
`src/app/icon.svg` (red tile, white house), `src/app/apple-icon.png` (rendered from the SVG),
`public/og.png` (1200×630, Chromium-rendered with the app's Vazirmatn).
