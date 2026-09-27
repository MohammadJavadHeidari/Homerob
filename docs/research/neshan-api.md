# Neshan API — findings for homerob (collected 2026-09-27)

## TL;DR for the coding agent
- The panel currently has **no `service.` key** — only one key "Homerob", type **نقشه وب (web map)**, prefix `web.`.
- **Search and Nearby cannot be self-enabled.** The "create key → سرویس‌ها" dialog does not list them; the docs say both require a **support ticket** ("برای فعال سازی این سرویس لطفا از طریق ارسال تیکت در پنل کاربری با پشتیبانی تماس بگیرید").
- **There is no free plan.** Account credit = 0 toman (0 paid + 0 free). Services are pay-as-you-go from prepaid credit (smallest package: 1,000,000 toman / 14 days).
- **No live test results yet** (section 3) — nothing to test with. Until the key is activated and funded, build against the spec below and mock responses.
- For "amenities around a home", prefer **`/v1/nearby`** (category + radius) for metro, bus, clinic, gym, park, mosque; use **`/v3/search`** text search for pharmacy and supermarket, which have no nearby layer.

---

## 1. API specs (copied from platform.neshan.org docs)

### 1a. Nearby Search — `GET https://api.neshan.org/v1/nearby`
Doc page: https://platform.neshan.org/docs/api/search-category/nearby/

- **Header:** `Api-Key: <YOUR_API_KEY>`
- **Activation:** by support ticket (see TL;DR).
- **Query params (all required):**

| Param | Type | Description |
|---|---|---|
| `location` | String | `latitude,longitude`, e.g. `32.657307,51.677579`. Comma may be URL-encoded as `%2C`; both accepted. |
| `layer` | String | Category slug (list below). |
| `searchRadius` | Integer | Search radius in metres. |

No documented max for `searchRadius`, no max-results/limit/paging param.

**Example request**
```bash
curl --location 'https://api.neshan.org/v1/nearby?location=32.657307,51.677579&layer=park&searchRadius=1200' \
--header 'Api-Key: <YOUR_API_KEY>'
```

**Example response (verbatim from docs)**
```json
{
  "layerPoints": {
    "layer": {
      "farsiTitle": "بوستان",
      "icon": "https://static.neshanmap.ir/poi/64/park.png",
      "slug": "park"
    },
    "nearestPoints": [
      {
        "distance": 2828,
        "duration": 471,
        "location": { "latitude": 32.65758359999999, "longitude": 51.675046300000005 },
        "name": "پارک استانداری",
        "poiHash": "Twv1A2RG1HVVYxRqAQfHeKgMLEtfGNuHURi8GBdD6iVqdcX-EE0KnTO0MobBxezpgeLBNt9QZS532FawuD1FbA"
      },
      {
        "distance": 2937,
        "duration": 486,
        "location": { "latitude": 32.6579886, "longitude": 51.6753564 },
        "name": "بوستان مشاهیر صفوی",
        "poiHash": "8D4tOlj4fldYt_1QQ_fKuVNbJFcTu2HIbjRc_bgVA4FqdcX-EE0KnTO0MobBxezpGPnZnujTdC_IgeTPlWjU1g"
      },
      {
        "distance": 3085,
        "duration": 514,
        "location": { "latitude": 32.65512069999999, "longitude": 51.67072830000001 },
        "name": "پارک شهید رجایی",
        "poiHash": "8z-NNbsPp0GcWwtezwnNbcyFTFpqUmqGC0EwekKqjohqdcX-EE0KnTO0MobBxezpAL6buG9vnS4-uTyO2vNegw"
      },
      {
        "distance": 3281,
        "duration": 535,
        "location": { "latitude": 32.654284, "longitude": 51.6702465 },
        "name": "بوستان هشت بهشت",
        "poiHash": "6F1lYKQUHBCwxnP7LV3kCinYE86WJFmP-TjVM8ewPJNqdcX-EE0KnTO0MobBxezpK1ckr-sYUUuIGpDp5DtlCg"
      }
    ]
  }
}
```

**Fields**
- `layerPoints.layer`: `slug` (English layer name, same as the `layer` you sent), `farsiTitle`, `icon` (URL).
- `layerPoints.nearestPoints[]`: `name` (String), `location {latitude, longitude}`, `distance` (Integer, metres), `duration` (Integer, seconds, estimated travel time), `poiHash` (String; input to the place-details service for phone, website, opening hours, category…).

**Sorting / distance caveat (from docs):** results are sorted by proximity. `distance` is **travel (route) distance, not straight-line**, so it can exceed `searchRadius` (docs example: radius 1200 m, distances 2800–3300 m, while all straight-line distances are < 1200 m). The docs say not to rely on `distance` for air-distance filtering → compute haversine from `location`.

**`layer` values**
| slug | فارسی |
|---|---|
| airline | شرکت هواپیمایی |
| airport | فرودگاه |
| bank | بانک |
| cafe | کافی‌شاپ |
| cafe_restaurant | کافه رستوران |
| campground | اردوگاه |
| car_dealer_official | نمایندگی خودرو |
| car_inspection | معاینه فنی |
| charity | موسسه خیریه |
| cinema | سالن و پردیس سینمایی |
| city_hall | مرکز همایش و سالن اجتماعات |
| clinic | درمانگاه |
| college | دانشکده |
| commercial_complex | مجتمع تجاری اداری |
| company | شرکت خصوصی |
| courthouse | دادگاه |
| embassy | سفارت |
| entertainment | تفریح و سرگرمی |
| finance | موسسه مالی و اعتباری |
| foreign_consulate | کنسولگری |
| formal_school | مدرسه |
| garden | باغ |
| gym | مجموعه ورزشی |
| health_complex | مجتمع پزشکی |
| helal_ahmar | هلال احمر |
| historical | مکان تاریخی |
| hospital | بیمارستان |
| hotel | هتل |
| industrial_zone | منطقه و شهرک صنعتی |
| interests | مکان دیدنی |
| international_expo | نمایشگاه بین المللی |
| juice_shop | آبمیوه و بستنی |
| library | کتابخانه |
| local_government_office | اداره و سازمان دولتی |
| lodging | مهمانپذیر و پانسیون |
| lodging_tourist | اقامتگاه بومگردی |
| marriage_registration_office | دفتر رسمی ازدواج و طلاق |
| mosque | مسجد |
| movie_theater | سالن نمایش و آمفی تئاتر |
| natural_feature | جاذبه طبیعی |
| notary_public | دفتر اسناد رسمی |
| park | بوستان |
| bus_station | ایستگاه اتوبوس |
| metro_entrance | ایستگاه مترو |
| parking | پارکینگ |
| pool | استخر شنا |
| post_office | اداره پست |
| post_service | خدمات پست و حمل بار هوایی |
| restaurant | رستوران |
| school | موسسه آموزشی |
| shopping_mall | بازار و مرکز خرید |
| stadium | استادیوم ورزشی |
| studying_center | مرکز مطالعه |
| temporary_accommodation | اردوگاه اسکان اضطراری |
| theater | سالن تئاتر |
| traffic_police | پلیس راهنمایی و رانندگی |
| train_station | ایستگاه قطار |
| transit_station | پایانه مسافربری و ایستگاه سوار |
| university | دانشگاه و موسسه آموزش عالی |
| vegetable_market | بازار روز و میوه تره‌بار |
| water_park | پارک آبی |
| wedding_venue | تالار پذیرایی |

**Mapping for homerob:** metro → `metro_entrance`; bus stop → `bus_station`; clinic → `clinic` (+ `hospital`, `health_complex`); gym → `gym` (+ `pool`); park → `park`; mosque → `mosque`. **No layer for pharmacy or supermarket** → use text search (closest layer for groceries: `vegetable_market`).

Extra error for nearby: `404 NOT_FOUND` ("no route with these specifications was found"), plus the shared table below.

### 1b. Region (province/city lists) — not a search API
Doc page: https://platform.neshan.org/docs/api/search-category/region/

- `GET https://api.neshan.org/v1/region/provinces`: no params. Response: array of `{ "id": Integer, "name": String }`, e.g.
  ```json
  [ { "id": 3581, "name": "استان یزد" }, { "id": 3641, "name": "استان لرستان" }, { "id": 3595, "name": "استان اصفهان" }, { "id": 3682, "name": "استان خوزستان" }, ... ]
  ```
- `GET https://api.neshan.org/v1/region/provinces/{provinceId}/cities`: `provinceId` (Integer, path, required). Response e.g.
  ```json
  [ { "id": 3382, "name": "یزد" }, { "id": 1676, "name": "هرات" }, { "id": 3398, "name": "احمدآباد" }, ... ]
  ```
- Header `Api-Key`. Errors: shared table.

### 1c. Text search (for comparison)
The docs say both versions sort by distance from the reference point and return **max 30 results per request**. Neither version has a radius, category or paging parameter. Activation is by ticket.

**Latest — `GET https://api.neshan.org/v3/search?q=<URL-encoded JSON>`**
- `q` = `{"term": "...", "center": {"latitude": .., "longitude": ..}}`. `term`, `center.latitude`, `center.longitude` all required.
- Example (decoded): `https://api.neshan.org/v3/search?q={"term":"تهران، میدان تجریش","center":{"latitude":35.8069995955,"longitude":51.428789156}}`
- Response: `{ "count": Integer, "items": [ { "title", "address", "category", "type", "region", "neighbourhood", "location": { "x": <lng>, "y": <lat> }, "poiHash" } ] }`
  - `category`: `place` | `municipal` (street) | `region` (city/village/province)
  - `type`: English slug, e.g. `pharmacy`, `police`, `bank`, `vegetable_market`, `roundabout`, `town_square`, `shoe_store`, `insurance_agency`.
  - Example item from docs:
    ```json
    { "title": "داروخانه میدان تجریش", "address": "شهرداری، زعیم", "category": "place", "type": "pharmacy",
      "region": "تهران، استان تهران", "neighbourhood": "",
      "location": { "x": 51.429683597299295, "y": 35.806801040812374 },
      "poiHash": "wXtqMQxZnBicNffFbj37mUMdyo_92YTV2jf6sB110zUrRHSpAiiLu-lym_JX0iaqr5QiD7k_I9F9qz-w0HI5Qg" }
    ```
  - Note: the docs' last example item (`"category": "municipal"`, `"type": "roundabout"`) has a shorter `poiHash`.

**Old (v1.0.0) — `GET https://api.neshan.org/v1/search?term=&lat=&lng=`**: all three required. Same shape but **no `poiHash`**, and `type` in the example is Persian (`"میدان"`). Docs example:
```json
{ "count": 25, "items": [ { "title": "میدان آزادی", "address": "تهران، میدان آزادی", "neighbourhood": "استاد معین", "region": "تهران، استان تهران", "type": "میدان", "category": "municipal", "location": { "x": 51.352, "y": 35.700 } } ] }
```

### Answers
- **Nearby vs `/v1/search`:** different endpoints. Nearby is category-based (`layer`) with a radius, returns name, location, route distance, duration and poiHash (no address or type). Search is free-text, has no radius, and returns title, address, type, category, region and neighbourhood.
- **Radius / category param:** nearby has `searchRadius` + `layer`. Search has neither.
- **Sorted by distance:** yes, both. Nearby sorts by route distance.
- **Max per call:** search returns 30. Nearby: not documented.

### Shared error codes
| HTTP | Status | Meaning |
|---|---|---|
| 400 | INVALID_ARGUMENT | Invalid input parameters |
| 470 | CoordinateParseError | Invalid coordinates |
| 480 | KeyNotFound | Invalid or missing Api-Key header |
| 481 | LimitExceeded | Allowed usage quota exceeded |
| 482 | RateExceeded | Per-minute request rate exceeded |
| 483 | ApiKeyTypeError | Key type doesn't match the service |
| 484 | ApiWhiteListError | Not allowed by the key's scope (domain/IP whitelist) |
| 485 | ApiServiceListError | Service not enabled on this key |
| 500 | GenericError | Unknown error |

### Rate limits / pricing
- No numeric rate limits are published. You only get 481 (quota) and 482 (per minute).
- Prices from platform.neshan.org/pricing:

| Service | Price |
|---|---|
| Search (جستجو) | 40,000 toman / 1,000 requests |
| Nearby (مکان‌های اطراف) | 160,000 toman / 1,000 requests |
| Place info (poiHash details) | 5,000,000 toman / 1,000 requests |

---

## 2. API keys in the panel
- **Existing keys (1):** "Homerob", type **نقشه وب** (web map SDK), prefix `web.`, created 1405/07/03. **Not a service key**, so it can't be used for Search/Nearby (would return 483).
- **Create-key dialog** (کلیدهای دسترسی → ایجاد کلید دسترسی): tabs سرویس‌ها / نقشه وب / MOBILE. The سرویس‌ها tab has fields for a name and allowed domains/IPs, and these service checkboxes:
  - Location: شهر و استان; تبدیل آدرس به نقطه پلاس; تبدیل آدرس به نقطه; تبدیل نقطه به آدرس
  - Map: static map, static curved map
  - Routing: logistics, isochrone, map-matching, TSP, distance matrix (with/without traffic), several routing variants
  - **Search (جستجو) and Nearby (مکان‌های اطراف) are not in the list.**
- **Update:** the user has since created a `service.` key named "homerob-server" with no whitelist. Search and Nearby are still not enabled on it (every call returns 485).
- **Quota:** account credit **0 toman (0 paid + 0 free)**. The charge page has only paid packages: 1M toman/14 days (no bonus), 7M/12M/20M/30M/50M toman per 365 days with 10–30% bonus, or a custom amount; +10% VAT. **No free plan for Search.**

**To get a working key:**
1. Send a ticket via پشتیبانی asking them to enable **Search (v3)** and **Nearby** for a new service key.
2. Create a key on the **سرویس‌ها** tab, name `homerob-server`, and tick the needed services.
   - Leave the domain/IP whitelist empty or set it to match Vercel egress. Vercel serverless IPs aren't fixed, so a whitelist may cause 484 errors.
3. Add credit (Search ≈ 40 toman/request, Nearby ≈ 160 toman/request).

## 3. Test requests (36.3345, 59.4875 — Vakilabad, Mashhad)
**Ran 2026-09-27 with the new `service.` key "homerob-server" (empty whitelist). Every call returned HTTP 485.** Search and Nearby aren't enabled on the key yet (they need a support ticket), so there are no items to show.

| Request | HTTP | Body |
|---|---|---|
| `v3/search` — داروخانه, ایستگاه مترو, مسجد, سوپرمارکت | 485 | `{"status":"ERROR","code":485,"message":"Api Key services not match."}` |
| `v1/search` — same 4 terms | 485 | same |
| `v1/nearby` — metro_entrance, mosque, park (r=1500) | 485 | same |

Notes:
- CORS was not a problem: `fetch` from a browser page on platform.neshan.org reached api.neshan.org and returned a readable JSON body.
- The error body shape is `{ status, code, message }`. Handle 485, 481 and 484 in the app.

**Domain whitelist and credit findings (tested by the user with curl from his own machine):**
- The key's allowed domains are `homerob.vercel.app` and `localhost`. Without a matching Referer/Origin, every call returns **484** `{"status":"ERROR","code":484,"message":"API Key scope (ip, domain or bundle) did not match."}`.
- The check only looks at the `Referer`/`Origin` headers. Sending `Referer: https://homerob.vercel.app/` + `Origin: https://homerob.vercel.app` from curl passes it.
- With those headers, `GET /v5/reverse?lat=36.3345&lng=59.4875` returned **HTTP 200** even though account credit shows **0**. So there's no immediate 481 at zero balance: either there's an unlisted free allowance, or billing is settled later. Watch the panel's usage report (گزارش مصرف).
  ```json
  {"status":"OK","neighbourhood":"شریف","municipality_zone":"11","state":"استان خراسان رضوی","city":"مشهد","in_traffic_zone":false,"in_odd_even_zone":false,"route_name":"قانع 3","route_type":"residential","place":"","place_type":"","district":"بخش مرکزی شهرستان مشهد","formatted_address":"مشهد، بلوار شهید قانع، قانع 3","village":"","county":"شهرستان مشهد"}
  ```
- **Implementation rule:** server-side calls from Vercel don't send a Referer/Origin by default. Every server fetch to api.neshan.org must set them explicitly:
  ```ts
  headers: {
    'Api-Key': process.env.NESHAN_API_KEY!,
    'Referer': 'https://homerob.vercel.app/',
    'Origin': 'https://homerob.vercel.app',
  }
  ```
  Because anyone can spoof these headers, the whitelist is not real protection. Keep the key server-only and never use a `NEXT_PUBLIC_` variable for it.

Re-run the Search/Nearby calls below once Neshan confirms activation (add the Referer/Origin headers):
```js
const KEY = '<service key>'; // never log it
const c = { latitude: 36.3345, longitude: 59.4875 };
for (const term of ['داروخانه','ایستگاه مترو','مسجد','سوپرمارکت']) {
  const r = await fetch('https://api.neshan.org/v3/search?q=' + encodeURIComponent(JSON.stringify({ term, center: c })), { headers: { 'Api-Key': KEY } });
  console.log(term, r.status, (await r.json()).items?.slice(0,5));
}
for (const layer of ['metro_entrance','bus_station','mosque','clinic','park','gym']) {
  const r = await fetch(`https://api.neshan.org/v1/nearby?location=36.3345,59.4875&layer=${layer}&searchRadius=1500`, { headers: { 'Api-Key': KEY } });
  console.log(layer, r.status, await r.json());
}
```
(Run these server-side in a Next.js route handler. Browser calls may hit CORS, and the key must not ship to the client.)

## 4. Vercel env var
I didn't do this. Claude can't enter API keys into web forms. Do it manually once the service key exists:
1. Vercel → **homerob** → Settings → Environment Variables.
2. Add `NESHAN_API_KEY` = `service.…`, ticked for Production + Preview. No `NEXT_PUBLIC_` prefix.
3. Deployments → latest Production → ⋯ → **Redeploy**.
