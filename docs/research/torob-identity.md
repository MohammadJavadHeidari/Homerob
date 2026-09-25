# Torob visual identity: reference for the "Torob for home" concept demo

Collected from torob.com in a logged-out desktop Chrome session on 2026-09-25. Nothing was logged into, submitted, bought, or clicked if it was an ad.

Values come from `getComputedStyle` unless marked otherwise. Anything I couldn't find is marked **not found**.

> **Two limits you should know about**
> - **The mobile layout wasn't captured.** Torob picks desktop or mobile on the server (`<html data-device="desktop">`), probably from the user agent. Making the window narrower only squeezed the desktop layout. For the real mobile UI, open DevTools → Device Toolbar → iPhone preset, then reload.
> - **Viewport widths.** The browser side panel limited the viewport to 965px (desktop) and 413px (narrow), so I couldn't get exactly 1440px or 390px. The home-page measurements in §4 were taken at a 1205px viewport.

---

## 1. Logo

### 1.1 Logo mark (above «ترب»)
- It's an **inline `<svg>`**, not an `<img>`: 88×88, `viewBox="0 0 88 88"`, class `Home_desktop_svgLogo__KecEM`, inside `.logos-container > .Home_desktop_logo__zt_Ae.Home_desktop_defaultLogo__wgvwU`.
- It's filled with 4 CSS variables, so **the same SVG changes colour with the theme**:

| Variable | Part | Light | Dark |
|---|---|---|---|
| `--logo-color-1` | main red ring | `#e91e33` | `#f1f5f9` |
| `--logo-color-2` | darker inner shading of the ring | `#bf0f22` | `#f1f5f9` |
| `--logo-color-3` | front leaf | `#6fbc23` | `#f1f5f9` |
| `--logo-color-4` | back leaf | `#519a23` | `#cbd5e1` |

- In dark mode the logo is monochrome (off-white, with one leaf in grey).
- The header on results and product pages uses the **same SVG at 48×48** (`.HeaderTop_torobLogo__su8gF`).
- The full SVG is in the "SVG files" section below and in `logo-mark.svg`.

### 1.2 Wordmark «ترب»
- It's **live text, not an image**: `<h1 class="logo-text">ترب</h1>`.
- **Home page:** `font-family: iranyekan`, `font-size: 40px`, `font-weight: 700`, `line-height: 69px`, `margin: 0 0 24px`.
  - Colour: light `#e91e33`, dark `#f1f5f9`. It follows `--logo-color-1`.
- **Header (results/product pages):** a `DIV` with `24px / 700 / line-height 40px`, colour `#e91e33` (light). It sits to the right of the 48px mark.

### 1.3 Theme toggle
- The sun/moon icon in the header, left of «ورود / ثبت نام», opens a dialog titled **«ظاهر برنامه»** with three choices: **سیستم / روشن / تاریک**.
- Dialog: background `#ffffff`, radius 8px, width 500px.
  - Each option is a 100×100 tile with radius 24px.
  - The selected tile has a `1px solid #d70040` border and its label turns `#d70040` (16px/700).
- The choice is applied as `<html data-theme="light|dark">`.

### 1.4 Manifest and icons
Manifest URL: `/static/manifest.json`. The contents below are exact (verified byte-for-byte after re-serialising):

```json
{
  "name": "Torob",
  "short_name": "Torob",
  "description": "ترب | بهترین قیمت بازار",
  "background_color": "#f9fafb",
  "theme_color": "#ffffff",
  "start_url": "/?utm_source=homescreen",
  "scope": "/",
  "display": "standalone",
  "orientation": "portrait-primary",
  "dir": "rtl",
  "lang": "fa",
  "related_applications": [
    {
      "platform": "play",
      "id": "ir.torob"
    }
  ],
  "icons": [
    {
      "src": "/static/icons/icon-48x48.png",
      "type": "image/png",
      "sizes": "48x48",
      "purpose": "any"
    },
    {
      "src": "/static/icons/icon-96x96.png",
      "type": "image/png",
      "sizes": "96x96",
      "purpose": "any"
    },
    {
      "src": "/static/icons/icon-128x128.png",
      "type": "image/png",
      "sizes": "128x128",
      "purpose": "any"
    },
    {
      "src": "/static/icons/icon-144x144.png",
      "type": "image/png",
      "sizes": "144x144",
      "purpose": "any"
    },
    {
      "src": "/static/icons/icon-192x192.png",
      "type": "image/png",
      "sizes": "192x192",
      "purpose": "any"
    },
    {
      "src": "/static/icons/icon-256x256.png",
      "type": "image/png",
      "sizes": "256x256",
      "purpose": "any"
    },
    {
      "src": "/static/icons/icon-384x384.png",
      "type": "image/png",
      "sizes": "384x384",
      "purpose": "any"
    },
    {
      "src": "/static/icons/icon-512x512.png",
      "type": "image/png",
      "sizes": "512x512",
      "purpose": "any"
    }
  ],
  "screenshots": [
    {
      "src": "/static/icons/torob1.jpg",
      "type": "image/jpg",
      "sizes": "320x569",
      "form_factor": "narrow"
    },
    {
      "src": "/static/icons/torob2.jpg",
      "type": "image/jpg",
      "sizes": "320x569",
      "form_factor": "narrow"
    },
    {
      "src": "/static/icons/torob3.jpg",
      "type": "image/jpg",
      "sizes": "320x569",
      "form_factor": "narrow"
    },
    {
      "src": "/static/icons/torob4.jpg",
      "type": "image/jpg",
      "sizes": "320x569",
      "form_factor": "narrow"
    },
    {
      "src": "/static/icons/wide.jpg",
      "type": "image/jpg",
      "sizes": "1280x569",
      "form_factor": "wide"
    }
  ]
}
```

**Icons declared in `<head>`:**
- `shortcut icon`: `https://assets.torob.com/public/main/images/favicon.png`
- `apple-touch-icon`: `/static/icons/icon-{57,76,114,144,152,167,180,190}x{same}.png`, for example `/static/icons/icon-180x180.png`
- `apple-touch-startup-image`: `/static/icons/icon-512x512.png`
- `msapplication-TileImage`: `/static/icons/icon-144x144.png`
- `mask-icon`: **not found** (the page has none)
- `theme-color`: `#ffffff` for `(prefers-color-scheme: light)` and `#15202B` for `(prefers-color-scheme: dark)`
- Other tags: `apple-mobile-web-app-title` = "Torob", `search` → `/static/opensearch.xml`

---

## 2. Colours

### 2.1 Stylesheet rules (your console snippet)
The snippet returns 14 rules totalling 5,445 characters. The browser tool cut off long output and blocked some chunks, so I couldn't copy the raw text. Below I rebuilt the three rules that matter (`body`, `html[data-theme="light"]` and `html[data-theme="dark"]`) declaration by declaration from `CSSStyleRule.style`. The values are exact, but formatting and order may differ slightly from the original.

```css
body { background-color: var(--bg-bright); font-family: iranyekan, Aerial; height: 100%; margin: 0px; font-size: 14px; color: var(--sky-800); }
html, #__next { height: 100%; }

html[data-theme="light"] {
  --blue-800:#1e40af; --blue-600:#3468cc; --blue-500:#3b82f6; --blue-300:#60a5fa; --blue-50:#eff6ff;
  --yellow-800:#854d0f; --yellow-500:#ffca32; --yellow-50:#ffeebf;
  --green-800:#003d01; --green-500:#4caf50; --green-200:#cafdb1; --green-100:#daf2d5; --green-50:#eefceb;
  --red-800:#9f1239; --red-500:#d70040; --red-50:#fff0f2;
  --purple-50:#e5d9f6; --purple-300:#9333ea; --purple-500:#7c3aed; --purple-800:#32175f;
  --orange-500:#f49342;
  --sky-800:var(--sky-800-light); /* = #1e293b */
  --sky-500:#64748b; --sky-300:#cbd5e1; --sky-100:#f1f5f9; --sky-50:#f8fafc;
  --bg-bright:#f1f5f9; --bg-fog:#ffffff;
  --store-card-background-color:var(--sky-50);
  --brand:#d73948;
  --logo-color-1:#e91e33; --logo-color-2:#bf0f22; --logo-color-3:#6fbc23; --logo-color-4:#519a23;
}

html[data-theme="dark"] {
  --blue-800:#1e40af; --blue-600:#3468cc; --blue-500:#3b82f6; --blue-300:#60a5fa; --blue-50:#eff6ff;
  --yellow-800:#854d0f; --yellow-500:#ffca32; --yellow-50:#ffeebf;
  --green-800:#003d01; --green-500:#4caf50; --green-200:#cafdb1; --green-100:#daf2d5; --green-50:#eefceb;
  --red-800:#9f1239; --red-500:#f43f5e; --red-50:#fff0f2;
  --purple-50:#32175f; --purple-300:#9333ea; --purple-500:#7c3aed; --purple-800:#e5d9f6;
  --orange-500:#f49342;
  --sky-800:#f1f5f9; --sky-500:#94a3b8; --sky-300:#475569; --sky-100:#1e293b; --sky-50:#0f172b;
  --bg-bright:#15202b; --bg-fog:#212b36;
  --store-card-background-color:var(--sky-50);
  --brand:#d74937;
  --logo-color-1:#f1f5f9; --logo-color-2:#f1f5f9; --logo-color-3:#f1f5f9; --logo-color-4:#cbd5e1;
}

/* Colour-related declarations picked from :root (65 declarations in total) */
:root {
  --radish-font-family: IRANYekanX;
  --radish-primary-color: var(--sky-800);
  --sky-800-light: #1e293b; --sky-50-light: #f8fafc;
  --btn-other-1st-color: linear-gradient(180deg,#3b75e5,#3468cc);
  --torobpay-primary: #773ca1; /* TorobPay purple */
  --guarantee-800: #1C1C5D; --guarantee-50: #D6F1FF;
  --input-bg-color: var(--sky-50); --input-placeholder-color: var(--sky-500);
  --check-box-checked-color: var(--blue-500);
  --modal-bg-color: var(--bg-fog);
}
```

The token naming is useful to copy: `sky-*` is a Tailwind-slate-like neutral ramp that **inverts** in dark mode. `bg-bright` is the page background and `bg-fog` is the surface (cards, header, footer).

### 2.2 Computed colours

| Element | Light | Dark |
|---|---|---|
| Page background (`body`, `--bg-bright`) | `#f1f5f9` | `#15202b` |
| Surfaces: header, footer, cards, dialogs (`--bg-fog`) | `#ffffff` | `#212b36` |
| Main text (`--sky-800`) | `#1e293b` | `#f1f5f9` |
| Secondary text: tagline, nav, footer links, icons (`--sky-500`) | `#64748b` | `#94a3b8` |
| Borders (`--sky-300`) | `#cbd5e1` | `#475569` |
| Home search box: background | `#ffffff` | `#212b36` |
| Home search box: border | `1px solid #cbd5e1` | `1px solid #475569` |
| Search box focus ring | **not found**: nothing changes on focus (no outline, shadow or border change); caret uses the text colour | same |
| Header search input on results page | `#f8fafc`, no border | not measured |
| Links (nav and footer) | `#64748b`, no underline | `#94a3b8` |
| Primary button (for example «خرید اینترنتی») | gradient `linear-gradient(#f04151, #d73948)`, white 14px/700 text, radius 8px, 40px tall | not measured |
| Search submit button (results header) | `#d73948`, white icon, radius `8px 0 0 8px`, 64×48 | not measured |
| Brand red (`--brand`) | `#d73948`: search button, «راهنمای خرید امن» link, primary buttons | `#d74937` |
| Logo and wordmark red | `#e91e33` | (becomes `#f1f5f9`) |
| Selected/accent red (`--red-500`) | `#d70040`: theme dialog selection | `#f43f5e` |
| Login button «ورود / ثبت نام» | bg `#ffffff`, border `1px solid #cccccc`, radius 8px, 110×28, text 12px `#64748b` | bg `#212b36`, same `#ccc` border |
| «آگهی» (ad) badge | bg `#ffca32` (`--yellow-500`), text `#1e293b` 10px, radius 4px | not measured |
| Store rating chip | bg `#daf2d5` (`--green-100`), text `#0b5124`, radius 16px | not measured |
| Count pill (for example «۴۴۸») | bg `#cbd5e1`, text `#1e293b`, 12px, radius 6px | not measured |

---

## 3. Typography

**Fonts loaded (`document.fonts` plus the Network panel):**
- `iranyekan` 400: `https://torob.com/static/fonts/iranyekan/iranyekanwebregular.woff2` (preloaded, status: loaded)
- `iranyekan` 700: `https://torob.com/static/fonts/iranyekan/iranyekanwebbold.woff2` (preloaded, status: loaded)
- `IRANYekanX` 100–900, a variable font: `https://assets.torob.com/nextjs/IRANYekanXVF.woff2`. It's declared as `--radish-font-family`, probably for their "radish" component library. It showed **unloaded** on the home page.
- The body stack is `iranyekan, Aerial` (their own typo for Arial). The base size is 14px.

**Home and chrome sizes:**

| Element | font-size | weight | line-height | colour (light) |
|---|---|---|---|---|
| Tagline | 14px | 400 | 69px (sic) | `#64748b` |
| Search placeholder and input | 16px | 400 | normal | text `#1e293b`, placeholder uses `--sky-500` |
| Top category nav | 14px | 400 | 48px | `#64748b` |
| Footer links | 14px | 400 | 20px | `#64748b` |
| Login button | 12px | 400 | normal | `#64748b` |
| Home wordmark | 40px | 700 | 69px | `#e91e33` |

**Results and product pages:**
- Card title: 14px/700, line-height 24px, clamped to 3 lines.
- Card price: 14px/700, `#1e293b`.
- Store count: 12px/400, `#64748b`.
- Seller name: 16px/700.
- Seller price: 16px/700, `#1e293b`.
- Secondary notes (for example «هزینه ارسال رایگان»): 12px, `#64748b`.

**Numbers:** prices use Persian digits with `٫` (U+066B) as the thousands separator, for example `۱۶۶٫۴۹۰٫۰۰۰ تومان`. In iranyekan this separator renders like a slash.

---

## 4. Home page layout
Measured at a 1205px-wide viewport, light mode.

**Header** (`#ffffff`, 48px tall, no border or shadow)
- Right side: the category nav, in RTL order «موبایل و کالای دیجیتال · لپ‌تاپ، کامپیوتر، اداری · هایپر مارکت · لوازم خانگی · مد و پوشاک · زیبایی و بهداشت · سایر دسته‌ها».
- Left side: the theme toggle icon (~24px) and the «ورود / ثبت نام» button.

**Centre stack** (horizontally centred)
1. **Logo mark:** rendered at about 85×85, top at y=220 (the container has `margin-top: -173px` and pushes the logo to its bottom). There's no gap before the wordmark: the logo's bottom and the h1's top are both at y=305.
2. **Wordmark:** the h1 box is 69px tall (the glyphs are visually centred in it), with `margin-bottom: 24px`.
3. **Search box** (`form.searchbox_searchFormHome__2jdEN`)
   - 480×48, `border: 1px solid #cbd5e1`, `border-radius: 8px`.
   - The input inside is 478×46, `padding: 1px 48px`, background `#fff`, no border.
   - **Search icon:** 20×20, on the right (the start side in RTL), 14px from the edge, colour `#64748b`.
   - **Camera icon** (image search): 24×24, on the left, 9px from the edge, colour `#64748b`.
   - Placeholder, exact text: **«نام کالا یا فروشگاه»**
4. **Tagline:** directly under the search box with no margin. Because its line-height is 69px, the text sits about 34px below the box. It has `padding-bottom: 80px`.
   - Exact text: **«مقایسه قیمت میلیون‌ها محصول بین هزاران فروشگاه»**

**Footer** (`#ffffff` surface, 76px, pinned to the bottom): two centred rows of 14px links (listed in §6).

**Narrow viewport (413px):** the logo stack stays the same size. The search form stretches edge to edge (413×48). As noted at the top, this is the desktop layout squeezed, not Torob's real mobile UI.

---

## 5. Results page patterns
Search: `/search/?query=گوشی سامسونگ`

**Page structure**
- **Header:** logo mark (48px) + «ترب» (24px) on the right; a large search field (bg `#f8fafc`) with a camera icon inside; the red search button; «ورود / ثبت نام» on the left.
- **Filter bar:** toggles «خرید قسطی ترب‌پی», «امکان خرید حضوری» (with a blue location pin), «فقط موجودها»; checkboxes «نو» and «کارکرده»; a «مرتب‌سازی» dropdown; and a «فیلترها» link with a funnel icon.
- A dismissible promo card: «میخوای قسطی بخری؟ [دریافت اعتبار ›]», with a dark green pill button.

**Product card** (5 per row at about 965px)
- White surface (`#ffffff`), radius 8px, `padding: 5px 5px 70px`, no border or shadow. The cards sit on the `#f1f5f9` page background.
- **Image:** square, top of the card.
  - Top-left: a small dark translucent badge with a camera icon and the photo count (for example «۷ 📷»).
  - Sponsored items instead show a yellow **«آگهی»** badge (`#ffca32`).
- **Title:** 14px/700, up to 3 lines, then an ellipsis.
- **Price:** **«از ۷۲٫۸۰۰٫۰۰۰ تومان»**. The "از" means "from", i.e. the lowest price. It's 14px/700 in `#1e293b`: the price is **not** in brand red or green, just bold text.
- **Number of stores:** **«در ۸۲ فروشگاه»**, 12px, `#64748b`, bottom-right.
- **Bottom-left:** outline heart (favourite) and bell (price alert) icons.
- **Rating on cards: not found.** Cards show no rating; ratings appear only per store on product pages.

Screenshots: desktop results page (965px) and narrow (413px, squeezed desktop layout). See the screenshots section.

### Product page: price comparison between stores
Tested on the Samsung S25 FE 5G (Vietnam) 256/8 page.

**Top of the page:** variant chips (storage, RAM and country), each with «از … تومان» or «ناموجود».

**«فروشنده‌ها» panel**
- White card, radius 8px. On the left of its header, a red link: «راهنمای خرید امن».
- **Summary chips** (outlined, radius about 12px):
  - «دارای ضمانت ترب · از ۱۶۸٫۶۹۷٫۰۰۰ تومان»
  - «خرید قسطی · از ۱۷۰٫۰۰۰٫۰۰۰ تومان»
  - «انتخاب شهر من» (with a pin)
  - «تمام ایران · از ۱۶۶٫۴۹۰٫۰۰۰ تومان»
- **Tabs:** «خرید اینترنتی ۴۴۸» and «خرید حضوری ۲۷۳», each with a red/blue pin icon and a grey count pill. The active tab has a thick dark underline bar.

**It isn't a table. Each seller is a stacked row:**
1. Store name (16px/700) with the city in muted text next to it (for example «تهران»).
2. A chip row:
   - Rating chip in green: «★۵ (۸ ماه در ترب)», i.e. rating plus how long the store has been on Torob, with a dropdown chevron.
   - Or a grey «فروشگاه جدید» chip for new stores.
   - Plus a grey «گزارش» (report) chip with a flag icon.
3. The seller's own product title (14px/700), then the seller's note in 12px muted text (warranty, shipping and so on).
4. A pill: «آیا امکان پرداخت در محل در شهر من وجود دارد؟ ›».
5. Bottom line: the price «۱۶۶٫۴۹۰٫۰۰۰ تومان» (16px/700) on the right; the red gradient **«خرید اینترنتی»** button on the left.
6. Under the price, optionally: «هزینه ارسال رایگان» (12px muted).
- Rows are separated by a 1px `#f1f5f9` line. Sponsored rows go first and carry a yellow «آگهی» badge with a megaphone icon.
- The panel ends with **«نمایش تمام ۴۴۸ فروشگاه»**.

**Sorting:** there's no visible sort control in this panel. After the sponsored row, the online sellers were in **ascending price order** (166.49M → 166.9M → 167M → 168.2M), and so were the in-person sellers (115.999M → 128M → 150M → 151M).

**Cheapest option:** there's **no special highlight on the cheapest row itself (not found)**. The lowest price shows up only as «از …» in the summary chips and the variant chips.

**In-person tab rows:** store name, city plus a truncated address, a note, the price, and an «اطلاعات تماس» button. Above them is the prompt: «با انتخاب شهر، قیمت فروشگاه‌های آنلاین کل ایران رو با ارزانترین حضوری‌های اطرافت مقایسه کن!»

**Other sections:** «لیست تغییرات قیمت», «راهنمای جامع محصول», «نظرات کاربران و توضیحات تخصصی», and «مشخصات محصول». The specs table has zebra rows (`#f8fafc` / white), keys on the right in `#1e293b`, and values on the left in muted text.

---

## 6. Voice: microcopy exactly as written
1. «نام کالا یا فروشگاه»: search placeholder
2. «مقایسه قیمت میلیون‌ها محصول بین هزاران فروشگاه»: tagline
3. «ورود / ثبت نام»: header button
4. «ظاهر برنامه» · «سیستم» · «روشن» · «تاریک»: theme dialog
5. «ورود به ترب» · «شماره موبایل خود را وارد کنید» · «دریافت کد ورود پیامکی» · «دریافت کد ورود صوتی»: login dialog. It opened by accident when I clicked near the header; I closed it without entering anything.
6. «میخوای قسطی بخری؟» + «دریافت اعتبار»: promo
7. «فقط موجودها» · «مرتب‌سازی» · «فیلترها» · «نو» · «کارکرده»: filters
8. «از … تومان» · «در ۸۲ فروشگاه»: card
9. «فروشگاه جدید» · «گزارش» · «ناموجود»
10. «آیا امکان پرداخت در محل در شهر من وجود دارد؟»
11. «هزینه ارسال رایگان»
12. «نمایش تمام ۴۴۸ فروشگاه» · «اطلاعات تماس» · «انتخاب شهر من» · «تمام ایران»
13. «با انتخاب شهر، قیمت فروشگاه‌های آنلاین کل ایران رو با ارزانترین حضوری‌های اطرافت مقایسه کن!»
14. Footer: «راهنمای خرید امن» · «پیگیری سفارش» · «پشتیبانی» · «درباره ترب» · «پیشنهاد ویژه» · «نصب اپلیکیشن» · «ترب‌پی» · «لیست فروشگاه‌ها» · «ثبت نام فروشگاه» · «پنل فروشگاه‌ها» · «فرصت‌های شغلی» · «بلاگ ترب»

**Tone:** short and friendly. Promos and helper text use colloquial spoken Persian (for example «میخوای…», «اطرافت», «کن!»), while labels stay neutral and formal («شماره موبایل خود را وارد کنید»). Everything is second person, with no exclamation marks outside promos.

---

## SVG files
(Also saved as separate files next to this report.)

### Logo mark (`logo-mark.svg`)
Exact outerHTML; the 4 colour variables are listed in §1.1.

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="88" height="88" viewBox="0 0 88 88" class="Home_desktop_svgLogo__KecEM"><g fill="none"><path fill="var(--logo-color-1)" d="M79.245 20.322l-.627.726c-2.474 2.656-5.814 4.2-9.462 4.313-.16.023-.342.023-.502.023-.456 0-.878-.023-1.31-.068 8.595 10.1 9.895 24.968 2.222 36.579-7.638 11.542-21.774 16.252-34.428 12.484h-.08c-5.13-1.34-10.944.68-14.022 5.414 3.192-4.847 2.736-11.055-.798-15.322v-.045c-8.333-10.079-9.473-24.72-1.87-36.16C26.692 15.67 42.766 11.22 56.195 17.031c-.57-1.476-.935-3.065-1.026-4.688-.114-2.95.741-5.788 2.371-8.171-18.012-5.902-38.532.567-49.476 17.137C-5.104 41.171.425 67.842 20.261 80.893c19.882 13.064 46.592 7.502 59.702-12.246 10.032-15.174 9.177-34.331-.707-48.348l-.011.023z"></path><path fill="var(--logo-color-2)" d="M31.969 10.22c-10.91 1.08-20.463 5.721-24.054 11.191C-5.195 41.216.3 67.853 20.193 80.905l.73-1.112c3.191-4.847 2.735-11.055-.799-15.322v-.045c-8.22-10.079-9.36-24.72-1.835-36.16C26.61 15.67 42.685 11.22 56.114 17.031c0 0-11.4-8.059-24.122-6.81h-.023z"></path><path fill="var(--logo-color-3)" d="M62.544 22.32s-.342-4.086 1.482-7.037c1.824-2.951 5.7-5.845 10.602-5.539 4.925.307 5.723 1.442 5.723 1.442s.114 3.972-1.254 6.242-4.218 5.606-8.322 6.446c-4.104.829-8.231-1.555-8.231-1.555z"></path><path fill="var(--logo-color-4)" d="M61.062 21.173s-.456-3.972 2.28-7.944c2.736-3.973 5.7-4.563 5.7-4.563S68.7 3.218 66.078.608c.228-.057-3.124.08-6.042 3.291-2.577 2.815-4.104 7.264-2.964 11.577 1.14 4.312 3.99 5.697 3.99 5.697z"></path></g></svg>
```

To use it standalone, define the variables, for example:

```css
:root{--logo-color-1:#e91e33;--logo-color-2:#bf0f22;--logo-color-3:#6fbc23;--logo-color-4:#519a23}
[data-theme=dark]{--logo-color-1:#f1f5f9;--logo-color-2:#f1f5f9;--logo-color-3:#f1f5f9;--logo-color-4:#cbd5e1}
```

### Wordmark
**Not an SVG.** It's `<h1>` text, iranyekan 700 (see §1.2).

### Search icon (`icon-search.svg`, uses `currentColor`)
```svg
<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="9.5 9.5 20.5 20.5" version="1.1"><path d="M29.7,28.3 L25.2,23.8 C26.3,22.4 27,20.5 27,18.5 C27,13.8 23.2,10 18.5,10 C13.8,10 10,13.8 10,18.5 C10,23.2 13.8,27 18.5,27 C20.5,27 22.3,26.3 23.8,25.2 L28.3,29.7 C28.5,29.9 28.8,30 29,30 C29.2,30 29.5,29.9 29.7,29.7 C30.1,29.3 30.1,28.7 29.7,28.3 Z M12,18.5 C12,14.9 14.9,12 18.5,12 C22.1,12 25,14.9 25,18.5 C25,20.3 24.3,21.9 23.1,23.1 C23.1,23.1 23.1,23.1 23.1,23.1 C23.1,23.1 23.1,23.1 23.1,23.1 C21.9,24.3 20.3,25 18.5,25 C14.9,25 12,22.1 12,18.5 Z" fill="currentColor" fill-rule="nonzero"></path></svg>
```

### Camera / image-search icon (`icon-camera.svg`, uses `currentColor`)
```svg
<svg width="24" height="24" viewBox="-2 -2 26 26" version="1.1" xmlns="http://www.w3.org/2000/svg"><g transform="translate(1, 3)"><path d="M10,18 L2,18 C0.8954305,18 0,17.1045695 0,16 L0,13 M0,8 L0,5 C0,3.8954305 0.8954305,3 2,3 L6,3 L8,0 L14,0 L16,3 L20,3 C21.1045695,3 22,3.8954305 22,5 L22,10" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path><circle fill="currentColor" cx="20" cy="15.75" r="2"></circle><circle fill="currentColor" cx="11" cy="10" r="4"></circle></g></svg>
```

---

## Screenshots
I took 7 screenshots in the browser:
- Home page: dark and light at 965px, and dark and light at 413px
- Results page: 965px and 413px
- Product page: the sellers panel

They're visible in this chat's browser tool output, but **the browser tool can't export them as files**, so they aren't attached here. To make clean copies at exactly 1440px and 390px:
1. DevTools → Device Toolbar → set the size (for mobile, pick an iPhone preset and reload so Torob serves its mobile layout).
2. ⋮ menu → "Capture screenshot".
