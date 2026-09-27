# torob.com — Light Theme Spec (for "Torob for home")

Captured 27 Sep 2026 from the live site in Chrome. Read-only: no login, no favourites/alerts, no ads clicked, no forms submitted (searches were loaded by URL).

**Setup check**
- Theme set via header sun icon → «ظاهر برنامه» → «روشن». `<html data-theme="light">` was confirmed.
- Desktop: viewport **1490×929** for the results work. Some values were also checked at 1200 and 1290.
- Mobile: DevTools device mode, then reload. `<html data-device="mobile">` was confirmed. **The reported viewport was 393×852 at DPR 3, not 390×844**, so the preset in use was probably an iPhone 14 Pro/15 size. Widths below are for 393px. The height later dropped to 645 when DevTools was resized, which only moves the fixed bottom bars.
- All values are computed styles or CSS rules read from the page. "not found" means I looked and it wasn't there.

## 0. Known tokens: verification

| Token | Status |
|---|---|
| page bg `#f1f5f9` (`--bg-bright`), surface `#fff` (`--bg-fog`), text `#1e293b` (`--sky-800`), muted `#64748b` (`--sky-500`), border `#cbd5e1` (`--sky-300`), input bg `#f8fafc` (`--sky-50`) | ✅ match |
| `--brand #d73948`, logo `#e91e33 / #bf0f22 / #6fbc23 / #519a23`, `--red-500 #d70040` | ✅ match |
| Primary gradient `linear-gradient(180deg,#f04151,#d73948)`, white 14/700, 40px | ✅ This is the default background of `.Button_button`. ⚠️ **The radius in CSS is 4px.** It is 8px only when an inline `border-radius:8px` is set (filter buttons, app-install banner). The small variant is 32px tall with 4px radius (spell-check «باشه»). |
| Desktop results **search submit** | ⚠️ Not the gradient. It is a solid `#d73948` block, 64×48, radius `8px 0 0 8px`. |
| Login-section red buttons | ⚠️ These use a different gradient: `linear-gradient(180deg, var(--red-500) #d70040, var(--brand) #d73948)` |
| Home search box 480×48, 1px `#cbd5e1`, r8 | ✅ match. ⚠️ **The home input bg is `#ffffff`** (`--bg-fog`), not `#f8fafc`. The results-page desktop input is `#f8fafc`. |
| Font | ✅ Computed family is `iranyekan`. The CSS var is `--radish-font-family: IRANYekanX`. Base 14px, weights 400/700, plus 500 in a few places. |

Extra light tokens: `--blue-500 #3b82f6`, `--blue-600 #3468cc`, `--green-500 #4caf50`, `--yellow-500 #ffca32`, `--orange-500 #f49342`, `--purple-500 #7c3aed`, `--red-50 #fff0f2`, `--red-800 #9f1239`, `--skeleton-bg-color: var(--sky-300)`, `--bottom-navigation-height: calc(56px + safe-area)`, TorobPay greens `#9ce76a / #abf27b / #54c039 / #003d01`.

---

## 1. Mobile home (light)

Top to bottom (393 wide):

1. **Header bar: none.** There is no top app bar on the home page.
2. **Logo block:** 393×144 container. The SVG logo is **80×80**, bottom-anchored (top at y=64), centred. Its fills are `var(--logo-color-1..4)`. **No wordmark** on mobile home. (The desktop header wordmark «ترب» is 24px/700, line-height 40, `#e91e33`.)
3. **Search box** (`Home_mobile_searchBoxWrapper`): **sticky, top 0**, bg `#fff`, padding `16px 16px 12px` (total 76px tall), z-index 1000.
   - Box: **361×48**, bg `#f1f5f9`, **no border**, radius **8px**.
   - Input: 16px, text `#1e293b`. Placeholder «نام کالا یا فروشگاه» in `#64748b`.
   - Icons (all 24px, `#64748b`): search on the right. On the left: mic button (40×48), a 1×16 divider in `#cbd5e1`, and a camera/image-search button (40×48).
4. **Trending chips** (`HomeTrends_mobile`): row starts 12px below the search box, 40px tall, `padding-inline: 8px`, white bg. It scrolls horizontally with no scrollbar.
   - Chip: 40px tall, padding `10px 15px`, radius **12px**, 14px/700 white text, gap **8px**.
   - Each chip has its own inline bg, stepping from red to blue:
     `#d73948 → #c6445b → #b64d6c → #a8567b → #995f8c → #89699d → #7b71ac → #6b7cbe → #5c84ce → #4a90e2` (the last colour repeats).
5. **Services row** (`TorobServices`): 3 items, «پس‌انداز طلا», «ترب‌پی» and «اطراف من». Container `padding-inline 32px`, `margin-top 32px`, `padding-bottom 32px`, space-between.
   - Item: 84px wide. Icon image **72×72**; the rounded grey tile is part of the image.
   - Title: 12px/700 `#1e293b`, 6px margin-top.
   - Badge «قسطی»: bg `--brand`, 24px tall, radius 14, padding 6, 10px/700 white. Positioned `top:-6px; right:-6px`.
6. **TorobPay strip:** 361×40, radius 8, padding `0 12px`, shadow `0 4px 12px -3px rgba(0,61,1,.2)`.
   - The bg is **animated** (`bgColorShift`: `#9ce76a → #abf27b → #9ce76a → #54c039 → #9ce76a`).
   - Text «میخوای قسطی بخری؟» is 12px/500, line-height 28, `#003d01`, with a clover icon on the right.
   - CTA pill «دریافت اعتبار ›»: bg `#003d01`, text `#9ce76a` 10px/700, radius 8, padding `4px 10px 4px 4px`.
7. **App-install card:** the section below has page bg `#f1f5f9` and `padding-top 4px`. The card is **369×140**, white, radius 8, 12px side margins.
   - Title «می‌خواهید «ترب» را روی گوشی خود نصب کنید؟» is 14px/400, line-height 24. Right box padding is 20.
   - Buttons (12px top margin):
     - «بله، نصب شود»: gradient, 117×40, r8, white 14/700.
     - «خیر»: outlined, 56×40, r8, 1px `#d70040` border, `#d70040` text, bg `#f8fafc`.
   - Logo on the left: 80×80 bordered logo in a 100px column.
8. More sections follow (`ShopOffers_mobile`). I didn't measure them.
9. **Bottom navigation** (`BottomNavigation_mobile_navBar`): `position: fixed`, height **56px + safe-area**, bg `#fff`, `border-top: 1px solid #f1f5f9`, no shadow.
   - 4 equal items (~98×58): «جستجو», «دسته‌بندی», «پیشنهاد ویژه», «ترب من».
   - Icons are 24px and **filled**. Labels are **11px/700**.
   - **Active** (جستجو): icon fill and label `#d70040` (`--red-500`). Inactive items use `#1e293b`.
   - CSS also defines a red dot: 6px, `#d73948`, `glowing` 1s infinite. It wasn't visible.

## 2. Mobile results «گوشی سامسونگ» (light)

- **Header** (`Search_mobile_ir_header`): `position: fixed`, 393×65, padding `12px 16px`, bg `#fff`, `border-bottom: 1px solid #f1f5f9`, **no shadow**, `transition: top .3s`. A 70px filler sits underneath.
  - Search box: **361×40**, bg `#f1f5f9`, r8, padding `0 4px 0 40px`. The query text is 16px `#1e293b`.
  - The submit button is on the right: **32×32, radius 8, background is the primary gradient**, with a white search icon.
  - Left side: mic (40px) | 1×16 divider `#cbd5e1` | camera. Icons are `#64748b`.
  - When I scrolled programmatically (down 800px, up 300px), the header and bottom filter bar stayed in place (top 0, transform none). I saw no hide-on-scroll.
- **City row:** 43px, white, padding `10px 16px`. Contents: animated radish GIF (32×20), pin, «شهر خود را انتخاب کنید» (12px/700, line-height 20), a `›` chevron, and a dismiss × on the left.
- **TorobPay card:** 377×68, white, r12, padding `0 12px`.
  - Title «می‌خوای قسطی بخری؟» 16px/700/24.
  - CTA «دریافت اعتبار از ترب‌پی ↖» 14px/500 `#54c039`.
- **Layout: 2-column grid.** The container has padding 8px and bg `#f1f5f9`. Grid: `minmax(0,1fr) minmax(0,1fr)`, **gap 8px**.
  - **Card:** 185×348, bg `#fff`, **radius 16px**, padding `6px 6px 70px`, no border, no shadow.
  - Image slider: **173×176**, `object-fit: contain`. It has the image-count badge and the camera "similar image" button.
  - Title: 14px/700, line-height 24, `#1e293b`, 12px margin. The CSS says clamp 2, but the rendered block was 72px, i.e. 3 lines.
  - Price is one text node, «از ۱۰۵٫۹۹۹٫۰۰۰ تومان». It is 14px/700/20, absolutely positioned at `bottom:36px; left/right:8px`.
  - Store count: «در ۹۹ فروشگاه» 12px/400/24 `#64748b`, with ellipsis. The heart and bell buttons (24×24) sit on the left of that row.
  - Ad badge «آگهی»: yellow, top-left of the image.
  - The "جستجوی دقیق تر" suggestion card fills one grid cell (white, r8). Its title is 12px/700. Its chips are 32px tall, bg `#f1f5f9`, r8, padding `4px 12px`, 14px/400.
- **Filter/sort row: bottom-fixed, not at the top.** It sits directly above the bottom nav (`bottom: var(--bottom-navigation-height)`), 48px tall, bg `#fff`, `box-shadow: inset 0 1px 0 #f1f5f9`, `border-bottom: 1px solid #f1f5f9`, `transition: transform .3s ease-in-out`. It scrolls horizontally.
  - **Items are plain text, not chips.** No bg, no border, no radius. Each is a 14px/400/24 `#1e293b` label plus a 16px chevron pointing up. The wrapper is 32px tall with padding 4px and `margin-inline-end 8px`.
  - Items: «قیمت», «انتخاب برند», «دسته‌بندی», «وضعیت کارکرد», «مرتب‌سازی». Inline switches «خرید قسطی ترب‌پی» and «فقط موجودها» use the same switch as desktop (§3).
  - Active/applied state: not found, because I didn't apply any filter.
- **«فیلترها»: not found.** There is no single "filters" button. **Each item opens its own bottom sheet** (`TwoStepBottomSheet`):
  - Sheet: full width, white, radius `16px 16px 0 0`, shadow `0 -8px 8px rgba(0,0,0,.1), 0 -30px 30px rgba(0,0,0,.2)`. **No dimmed backdrop**; the page stays visible.
  - Header area is 56px. The title is in the top-right corner, 14px/400 `#64748b`, e.g. «انتخاب قیمت». Close is a 32×32 × on the left: white, r16.
  - **Price sheet:** «از» and «تا» inputs (40px, bordered and rounded) with the label «تومان». A suggestion chip reads «از ۰ تا ۴٫۵۳۱۳۶۴ میلیارد». Buttons:
    - **«اعمال فیلتر»**: 289×40, bg `#1e293b`, text `#f8fafc` 14/700, r8.
    - «حذف»: ghost, 1px `#1e293b` border, bg `#f8fafc`, r8.
  - **Sort sheet «انتخاب مرتب‌سازی»:** radio list with a **40px row pitch**. Labels are 14px/400/24.
    - Radio: 20px circle, 1px `#8897a8` border.
    - Checked radio: `border: 6px solid #1e293b` on a white fill, giving a ring look. Transition .3s.
    - Options: محبوب‌ترین / ارزان‌ترین / گران‌ترین / جدیدترین / بیشترین فروشنده.

## 3. Desktop results details (light)

**Top filter row** (`TopFiltersDesktop`): «خرید قسطی ترب‌پی» | «امکان خرید حضوری» (blue pin) | «نو» «کارکرده» | «فقط موجودها» | «مرتب‌سازی ⌄». Dividers separate the groups.

**Switches** («خرید قسطی ترب‌پی», «فقط موجودها»): the native checkbox is visually hidden.

| | Off | On |
|---|---|---|
| Track | 28×18, radius 9, bg `#cbd5e1`, `inset 0 1px 2px rgba(0,0,0,.1)` | bg `#1e293b` |
| Knob | 14×14 circle, bg `#fff` (`--bg-fog`), shadow `0 1px 2px rgba(0,0,0,.24)`, `inset-inline-start: 2px` | `inset-inline-start: 12px` |
| Motion | `transition: .1s` on both | |
| Label | 14px/400 `#1e293b`, `margin-inline: 4px`, padding `5px 0`, cursor pointer | same |

Focus-visible style for the switch: **not found**; no rule exists.

**Checkboxes** («نو», «کارکرده») are `<button class="stock_status-filter">` elements.
- **Unchecked:** 20×20 box, `1px solid #8897a8`, radius 4, bg `#fff`. Label 14px/400, line-height 24, 8px gap.
- **Checked:** bg and border `#1e293b` with a 16px white check SVG. `transition: .3s`.
- **Focus-visible:** `outline: 2px solid #1e293b; outline-offset: 2px` on the whole button.

**«مرتب‌سازی» dropdown**
- **Closed:** text trigger 14px, line-height 24, `#1e293b`, no border or bg. Chevron-down 16px, `transition .3s`.
- **Open:** the chevron gets `rotate(180deg)`. The menu `ul` is 140×154, **bg `#fff`, `1px solid #f1f5f9`, radius 8px, padding 16px, NO box-shadow**. It is absolutely positioned at `top: calc(100% + 4px)`, z-index 10.
- Items are **24px tall**, centred, 14px/400 `#1e293b`, with no hover style.
- **Selected item:** text `#d73948` (`.DropDownFilter_active`), and **the trigger label changes to the chosen option** (e.g. «ارزان‌ترین ⌄»).
- Exact options: **محبوب‌ترین / ارزان‌ترین / گران‌ترین / جدیدترین / بیشترین فروشنده**

**Pagination: infinite scroll.** The product-link count went 148 → 196 → 244 as I scrolled (~48 per batch).
- Loader: centred (margin 10px) **30×30 SVG spinner in `#d70040`**. It is a circle r=12, stroke 3, `stroke-dasharray: 56,100`, round cap, spinning `.6s linear infinite`. It appears with a `.3s ease-out` scale 0.3→1 animation.
- Error fallback in CSS: grey retry button, `#9e9e9e`, radius 4, min 80×36. Hover `#757575`, active `#616161` + `scale(.98)`.
- Lazy images: white card area until each image loads.

**Header on scroll: not sticky.** `HeaderTop_headerLarge` is `position: relative`, **132px** tall (padding `20px 40px 0`, includes the category row), bg `#fff`, `border-bottom: 1px solid #f1f5f9`. It scrolls away and gains no shadow.
- The **right filter sidebar is sticky** (`top: 1px`).

## 4. Interaction states (light)

`button:focus { box-shadow: none !important }` is global, and most buttons compute `outline: none`. So **most buttons have no visible focus state.** Transitions are 0s unless stated.

| Element | Default | Hover | Focus-visible (Tab) | Active |
|---|---|---|---|---|
| **Primary red button**, gradient (`.Button_button`, e.g. «باشه») | gradient `#f04151→#d73948`, white 14/700, r4, no border/shadow, cursor pointer | no change (a hover bg only applies with the `hasHoverColor` class) | no outline | not found |
| **Desktop search submit** | solid `#d73948`, 64×48, r `8 0 0 8`, white 24px icon | no change | outline none | not found |
| **Search box** (results) | input bg `#f8fafc`, 1px `#cbd5e1` (top/bottom/right), r `0 8 8 0`, 16px text, placeholder `#64748b` | no change | `outline: none`, no border or shadow change, so **no visible focus** | — |
| **Product card** | `#fff`, r8, no shadow/border | **Card doesn't change.** The image arrows (24×24, `rgba(51,51,51,.5)`) and the "similar image" camera (32×32, r4, `rgba(51,51,51,.5)`) fade in (`opacity .2s`). Each turns `#1e293b` on its own hover. | image link: browser default ring (`auto 1px rgb(0,95,204)`, offset 1px) | not found |
| **Card heart/bell** | 24×24 mask icon, colour `#64748b` (inline) | not visible (the rule's `--sky-100` bg is overridden by inline style) | — | — |
| **Category nav link**, results header (`span.catsMenu_droptrigger`) | 14/400, line-height 64, padding `3px 10px`, `#1e293b` | **`#d70040`** | **not focusable** (span, no tabindex) | — |
| **Category nav link**, home (`droptriggerIndex`) | 14/400 `#64748b` | `#1e293b` | tabindex −1 | — |
| **Footer link** (home) | 14/400/20 `#64748b`, 24px gap, no underline. The footer is a fixed 40px white bar with padding `10px 16px 10px 40px`. | **`#1e293b`** | browser default ring (`auto 1px rgb(0,95,204)`, offset 1px) | — |
| **Outlined chip** (price suggestion) | 32px tall, padding `0 12px`, `1px #cbd5e1`, **r16**, bg `#f8fafc`, 12px/400 `#1e293b` | no change | outline none | — |
| Outlined red button («نمی‌خوام», «خیر») | bg `#f8fafc`, `1px #d70040`, text `#d70040` 14/700, r4 (r8 in the banner) | no change | none | — |
| Ghost «حذف» | bg `#f8fafc`, `1px #1e293b`, `#1e293b` 14/700, 80×40, r8 | no change | none | — |
| AI-chat CTA card (`SearchChatbotQueryCta_link`) | `#fff`, r8, padding 16 | bg `#f8fafc` | `2px solid #1e293b`, offset 2 | — |

Transitions found: switch `.1s`, checkbox `.3s`, sort chevron `.3s`, card image controls `opacity .2s`, desktop price text `bottom .2s`, mobile header `top .3s`, mobile filter bar `transform .3s ease-in-out`. No `:active` transforms except the retry button.

## 5. Elevation and shape

**Box-shadows in use**

| Value | Where |
|---|---|
| `0 -8px 8px rgba(0,0,0,.1), 0 -30px 30px rgba(0,0,0,.2)` | mobile bottom sheet |
| `0 4px 12px -3px rgba(0,61,1,.2)` | TorobPay strip (mobile home) |
| `0 2px 2px rgba(0,0,0,.1)` | floating "آیا نتایج جستجو مفید بود؟" pill |
| `inset 0 1px 2px rgba(0,0,0,.1)` / `0 1px 2px rgba(0,0,0,.24)` | switch track / knob |
| `inset 0 1px 0 #f1f5f9` | mobile filter bar |
| `0 1px 0 var(--bg-bright)` | mobile title bar (inner pages) |
| `0 0 3px #cbd5e1` | search-suggestions dropdown (CSS; not opened) |
| `0 2px 2px rgba(51,51,51,.2)` | tooltip |
| `0 0 12px rgba(51,51,51,.2)` | bottom-of-page box (r `16 16 0 0`) |
| `0 4px 12px rgba(51,51,51,.2)`, `0 2px 4px rgba(0,0,0,.1)`, `0 0 4px rgba(0,0,0,.1)` | `styles_container` variants (components not identified) |
| `0 4px 20px rgba(0,0,0,.15)` | alert dialog (CSS) |
| `0 0 0 .2rem rgba(0,123,255,.25)` | generic input focus (CSS) |
| **none** | product cards, sort dropdown, desktop header, desktop modal (the theme dialog is `#fff` r8 on a `rgba(0,0,0,.6)` backdrop) |

**Radius scale**

| Radius | Where |
|---|---|
| 4 | `.Button_button` default, checkboxes, image-count badge, card camera button, retry button, small buttons |
| **8** | desktop cards, search boxes, buttons with the inline override, dropdown menu, modals, app-install card, TorobPay strip, suggestion chips |
| 9 | switch track |
| 12 | mobile trending chips, mobile TorobPay card |
| 14 | service badge |
| **16** | mobile product cards, pill chips, `Badge_badgeContainer`, bottom-sheet top, sheet close |
| 24 | theme-picker tiles (100×100) |
| 50% | knobs, radios |

**Spacing**

| Area | Values |
|---|---|
| Desktop card | padding `5 5 70` |
| Desktop grid | `repeat(auto-fill, minmax(170px,1fr))` (5 columns × ~199px at 1490 wide), gap 8, wrapper margin `0 40px` |
| Mobile card | padding `6 6 70` |
| Mobile grid | gap 8, container padding 8 |
| Product name | margin 12 |
| Price | bottom 32 (desktop) / 36 (mobile) |
| Headers | 40px side padding (desktop), 12/16 (mobile) |
| Mobile home | sections 12 / 32 |
| AI CTA card | padding 16 |

## 6. States

**Empty results: not found.** «ززززقققق», «qxzjqxzjvwkq» and «ژژژژژژژژژ1234567890ژژژ» all returned products. Torob always auto-corrects the query:
- Spell-check line: «جستجو غلط‌گیری شد: رز رز ق ق ق ق». The label is 14/24 `#1e293b`; the corrected term is 14/700 `#d70040`. Two buttons follow:
  - **«باشه»**: primary gradient, 77×32, r4.
  - **«نمی‌خوام»**: outlined `#d70040`, 86×32, r4.
  «نمی‌خوام» re-ran the literal query and still returned products.
- AI card below it (white, r8, radish mascot 36×36):
  - Title «برای این جستجو، تربچت بهتر می‌تونه کمکت کنه» 14/700/24.
  - Helper «از تربچت در مورد «ززززقققق» بپرس.» 12/20 `#64748b`.
  - CTA «ادامه در تربچت ‹» 14/700 `--brand`, and a dismiss × (28px).
- The CSS does define `.ProductCards_noResults { color: #1e293b; text-align: center; margin-top: 24px }`, but I couldn't trigger it.

**Loading (Slow 4G, mobile, client-side navigation):**
- **No skeletons appeared.** The old page stayed on screen until results rendered.
- The only indicator was the **30×30 red spinner** (§3), seen at about 2.5 s.
- A skeleton class exists in CSS but I didn't see it used: `.styles_placeholder`, bg `#cbd5e1`, `pulse` 2s `cubic-bezier(.4,0,.6,1)` infinite (opacity → .5 at 50%).
- I couldn't observe a full hard reload, because the tool waits for page load.

**Toast/snackbar:** none triggered. The closest element is the floating **satisfaction pill** «آیا نتایج جستجو مفید بود؟» with green 👍 and red 👎 outline icons:
- `position: fixed`, left 24px, bottom 120px, 265×49.
- White, `0.5px solid #e6e6e6`, r8, padding 12, shadow `0 2px 2px rgba(0,0,0,.1)`.

I didn't click it, because that sends feedback.

## 7. Iconography

- **Style is mixed.** Navigation and header icons are **filled** (search, categories, offers, chevrons, pin). Utility icons are **outline**: camera, sun, and the card heart/bell (stroke 1–2, round caps and joins).
- **Sizes:** 24px (header, nav, search box) and 16px (chevrons, card actions, checkmark, pin).
- **Colours:**
  - `#64748b` in search boxes and card actions.
  - `#1e293b` for chevrons and inactive nav.
  - `#d70040` for active nav.
  - White on the red submit.
  - `--blue-600 #3468cc` for the in-store pin.
- Card heart/bell are **CSS masks** (`assets.torob.com/public/main/images/like.svg`, `bell.svg`) tinted with `--sky-500`.

```svg
<!-- Search (desktop search submit, 24px, white via currentColor) -->
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="9.5 9.5 20.5 20.5" version="1.1"><path d="M29.7,28.3 L25.2,23.8 C26.3,22.4 27,20.5 27,18.5 C27,13.8 23.2,10 18.5,10 C13.8,10 10,13.8 10,18.5 C10,23.2 13.8,27 18.5,27 C20.5,27 22.3,26.3 23.8,25.2 L28.3,29.7 C28.5,29.9 28.8,30 29,30 C29.2,30 29.5,29.9 29.7,29.7 C30.1,29.3 30.1,28.7 29.7,28.3 Z M12,18.5 C12,14.9 14.9,12 18.5,12 C22.1,12 25,14.9 25,18.5 C25,20.3 24.3,21.9 23.1,23.1 C23.1,23.1 23.1,23.1 23.1,23.1 C23.1,23.1 23.1,23.1 23.1,23.1 C21.9,24.3 20.3,25 18.5,25 C14.9,25 12,22.1 12,18.5 Z" fill="currentColor" fill-rule="nonzero"></path></svg>
```

```svg
<!-- Location pin (filter «امکان خرید حضوری», 16px) -->
<svg width="16" height="16" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" stroke="var(--blue-600)" fill="var(--blue-600)" stroke-width="0.1" aria-hidden="true" focusable="false"><path d="M12,2 C16.418278,2 20,5.66312472 20,10.1818181 C20,16.5454545 12,22 12,22 C12,22 4,16.5454545 4,10.1818181 C4,5.66312472 7.58172205,2 12,2 Z M12,7 C10.3431458,7 9,8.34314575 9,10 C9,11.6568542 10.3431458,13 12,13 C13.6568542,13 15,11.6568542 15,10 C15,8.34314575 13.6568542,7 12,7 Z" stroke-linecap="round" stroke-linejoin="round"></path></svg>
```

```svg
<!-- Sort / filter chevron (16px) -->
<svg fill="currentColor" height="16" title="chevron-down" viewBox="0 0 24 24" width="16" xmlns="http://www.w3.org/2000/svg" style="transform:rotate(0deg)"><g><path d="M18.7 9.7l-6 6c-.2.2-.4.3-.7.3-.3 0-.5-.1-.7-.3l-6-6c-.4-.4-.4-1 0-1.4.4-.4 1-.4 1.4 0l5.3 5.3 5.3-5.3c.4-.4 1-.4 1.4 0 .4.4.4 1 0 1.4z"></path></g></svg>
```

```svg
<!-- Heart (card «محبوب‌ها», used as CSS mask; 16px) -->
<svg width="16px" height="16px" viewBox="0 0 16 16" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"> <title>Icon / 16px / Heart</title> <g id="Icon-/-16px-/-Heart" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd"> <rect id="Rectangle" x="0" y="0" width="16" height="16"></rect> <g id="heart" transform="translate(1.3333, 2)" stroke="#737373" stroke-linecap="round" stroke-linejoin="round"> <path d="M12.3052087,1.06088704 C11.6472372,0.381629641 10.7546508,0 9.82392001,0 C8.89318923,0 8.00060285,0.381629641 7.34263129,1.06088704 L6.66649606,1.75856813 L5.99036083,1.06088704 C4.61998291,-0.353159587 2.39816134,-0.35315957 1.02778344,1.06088707 C-0.342594465,2.47493372 -0.342594482,4.76755631 1.0277834,6.18160297 L1.70391863,6.87928406 L6.66649606,12 L11.6290735,6.87928406 L12.3052087,6.18160297 C12.9634892,5.50266436 13.3333333,4.58163464 13.3333333,3.621245 C13.3333333,2.66085537 12.9634892,1.73982565 12.3052087,1.06088704 Z" id="Path"></path> </g> </g> </svg>
```

```svg
<!-- Bell (card «تغییرات قیمت», used as CSS mask; 16px) -->
<svg width="16px" height="16px" viewBox="0 0 16 16" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"> <title>Icon / 16px / Bell</title> <g id="Icon-/-16px-/-Bell" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd"> <rect id="Rectangle" x="0" y="0" width="16" height="16"></rect> <g id="bell" transform="translate(2, 1.3333)" stroke="#737373" stroke-linecap="round" stroke-linejoin="round"> <path d="M10,4 C10,1.790861 8.209139,0 6,0 C3.790861,0 2,1.790861 2,4 C2,8.66666667 0,10 0,10 L12,10 C12,10 10,8.66666667 10,4" id="Path"></path> <path d="M7.15333333,12.6666667 C6.91480149,13.0778696 6.47537907,13.3309709 6,13.3309709 C5.52462093,13.3309709 5.08519851,13.0778696 4.84666667,12.6666667" id="Path"></path> </g> </g> </svg>
```

```svg
<!-- Camera / image search (search box, 24px, #64748b via currentColor) -->
<svg width="24" height="24" viewBox="-2 -2 26 26" version="1.1" xmlns="http://www.w3.org/2000/svg"><g transform="translate(1, 3)"><path d="M10,18 L2,18 C0.8954305,18 0,17.1045695 0,16 L0,13 M0,8 L0,5 C0,3.8954305 0.8954305,3 2,3 L6,3 L8,0 L14,0 L16,3 L20,3 C21.1045695,3 22,3.8954305 22,5 L22,10" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path><circle fill="currentColor" cx="20" cy="15.75" r="2"></circle><circle fill="currentColor" cx="11" cy="10" r="4"></circle></g></svg>
```

```svg
<!-- Mobile bottom-nav «دسته‌بندی» (filled, 24px) -->
<svg title="categories" fill="var(--sky-800)" width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><g transform="translate(2 2)"><path id="categories" d="M8 0H1C.4 0 0 .4 0 1v7c0 .6.4 1 1 1h7c.6 0 1-.4 1-1V1c0-.6-.4-1-1-1zM7 7H2V2h5v5zm12-7h-7c-.6 0-1 .4-1 1v7c0 .6.4 1 1 1h7c.6 0 1-.4 1-1V1c0-.6-.4-1-1-1zm-1 7h-5V2h5v5zm1 4h-7c-.6 0-1 .4-1 1v7c0 .6.4 1 1 1h7c.6 0 1-.4 1-1v-7c0-.6-.4-1-1-1zm-1 7h-5v-5h5v5zM8 11H1c-.6 0-1 .4-1 1v7c0 .6.4 1 1 1h7c.6 0 1-.4 1-1v-7c0-.6-.4-1-1-1zm-1 7H2v-5h5v5z"></path></g></svg>
```

```svg
<!-- Checkbox checkmark (16px, white on #1e293b when checked) -->
<svg fill="var(--bg-fog)" height="16" viewBox="0 0 24 24" width="16" xmlns="http://www.w3.org/2000/svg"> <path d="M0 0h24v24H0z" fill="none"></path> <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"></path> </svg>
```

## 8. Typography scale (desktop results page)

Font: `iranyekan`. Persian digits are used throughout.

| size / weight / line-height | Example | Colour |
|---|---|---|
| 24 / 700 / 40 | header wordmark «ترب» | `#e91e33` |
| 16 / 400 / normal | search input text | `#000` (desktop results input), `#1e293b` (home and mobile inputs) |
| 16 / 700 / 24 | *(mobile)* TorobPay card title | `#1e293b` |
| 14 / 700 / 40 | filter section title «قیمت» | `#1e293b` |
| 14 / 700 / 35 | button «اعمال فیلتر» | `#f8fafc` on `#1e293b` |
| 14 / 700 / 32 | «نمایش سایر برندها» | `#1e293b` |
| 14 / 700 / 24 | product name | `#1e293b` |
| 14 / 700 / 20 | price «از ۸۱۲٫۷۴۰ تومان» | `#1e293b` |
| 14 / 700 / normal | «ورود / ثبت نام» | `#1e293b` |
| 14 / 400 / 64 | category nav «موبایل و کالای دیجیتال» | `#1e293b` |
| 14 / 400 / 32 | suggested category «گوشی موبایل» | `#1e293b` |
| 14 / 400 / 24 | checkbox labels «نو», sort trigger and items | `#1e293b` |
| 14 / 400 / normal | body, brand list «Samsung / سامسونگ» | `#1e293b` |
| 12 / 700 / 40 | price-input prefix «از» | `#64748b` |
| 12 / 700 / 20 | «شهر خود را انتخاب کنید» | `#1e293b` |
| 12 / 500 / 28 | «میخوای قسطی بخری؟» | `#003d01` |
| 12 / 400 / 24 | «در ۵۱ فروشگاه» | `#64748b` |
| 12 / 400 / 20 | badge «کارکرده» (bg `#f1f5f9`, r16, padding `2px 6px`) | `#1e293b` |
| 12 / 400 / normal | price chip «از ۲۰۳ هزار تا …» | `#1e293b` |
| 11 / 700 | *(mobile)* bottom-nav labels | `#1e293b` / `#d70040` |
| 10 / 700 | «دریافت اعتبار» pill | `#9ce76a` |
| 10 / 400 | image-count badge «۲» (bg `#64748b`, 16px tall, r4) | `#fff` |

**Prices:**
- `font-variant-numeric: normal` and `font-feature-settings: normal`, so **no tabular figures**.
- The whole price is **one text node** with no separate styling: «از ۸۱۲٫۷۴۰ تومان». «از», the number and «تومان» share 14/700 `#1e293b`.
- The thousands separator is **«٫» (U+066B)**, which the font draws like a slash.
- On mobile the markup is the same (`priceAmount`). CSS also has an unused `pricePrefix` style at 12/400 `#64748b`.

## 9. Light vs dark differences (besides tokens)

- **Theme CSS is almost entirely tokens.** Apart from the `html[data-theme]` variable blocks, the only theme-specific rule is one `[data-theme="dark"]` rule for the chatbot composer. There are no `prefers-color-scheme` blocks.
- **Logo:** same inline SVG (viewBox 88). In dark, the fills become monochrome (`#f1f5f9` ×3, leaf `#cbd5e1`).
- **Product photos** are not adjusted (no filter or blend). Their white backgrounds show as **white tiles inside dark `#212b36` cards**.
- **Shadows and some borders are hard-coded** (`rgba(...)` shadows, checkbox border `#8897a8`, satisfaction-pill border `#e6e6e6`), so they are identical in both themes.
- **TorobPay banners** keep their light-green palette in dark.
- **Service icons, radish mascot and GIFs** are the same images in both themes.
- Token swaps to note on top of what you have:
  - `--brand` `#d73948` → `#d74937`
  - `--red-500` → `#f43f5e`
  - `--purple-50/800` swap
  - `--sky-*` ramp inverts (`--sky-800 #f1f5f9`)
  - `--bg-bright #15202b`, `--bg-fog #212b36`

---

### Screenshots I took (viewed in-session; the tool can't export them)
1. Desktop home, light, with the «ظاهر برنامه» theme dialog open.
2. Desktop results «گوشی سامسونگ», 5-column grid, sidebar and top filter row.
3. Zoom of the sort dropdown, open (plain white menu, 5 options).
4. Zoom of the sort trigger after choosing «ارزان‌ترین».
5. Desktop results scrolled: the header has scrolled away, the sidebar is sticky, and the red spinner shows at the bottom.
6. Product card hover: image arrows and camera button visible.
7. Spell-check block and AI-chat card for «ززززقققق».
8. Desktop results with the floating «آیا نتایج جستجو مفید بود؟» pill.
9. Home footer with the default focus ring on «درباره ترب».
10. Desktop results with `data-theme` flipped to dark temporarily (white product tiles).
11. Mobile home, light, full layout with bottom nav.
12. Mobile results: header, city row, TorobPay card, grid and bottom filter bar.
13. Mobile price bottom sheet «انتخاب قیمت».
14. Mobile sort bottom sheet «انتخاب مرتب‌سازی».
