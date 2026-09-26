"""Run from data/real/ after normalize.py: python3 ../../scripts/realdata/clean.py
Step 2: build/rent_normalized.parquet → clean, deduped apartment rentals for every city.

Outputs (next to this file):
  build/listings_iran.parquet  every clean apartment (all cities), Listing-like columns + 2024 originals → Postgres
  src/data/listings.json       Mashhad sample in the app's Listing shape (bundled fallback when there is no DB)
  clean_report.json            counts for each cleanup step
"""
import hashlib
import json
import re

import duckdb
import numpy as np
import pandas as pd

PRICE_FACTOR = 2.2  # 2024 → Sept 2026, from the divar-mcp calibration (see data/real/calibration.json)
RATE = 0.03
SAMPLE_PER_HOOD = 40
SAMPLE_HOODS = 25
SEED = 20260925

FA = str.maketrans("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩", "01234567890123456789")
EN2FA = str.maketrans("0123456789", "۰۱۲۳۴۵۶۷۸۹")

df = duckdb.sql("SELECT * FROM 'build/rent_normalized.parquet'").df()
steps = {"input": len(df)}

# ---------- filter ----------
df = df[df.kind == "apartment"]
steps["apartments"] = len(df)
df.loc[df.q_rent_100k, "rent"] = 0  # rent 100k = "full rahn" placeholder
bad = (df.q_deposit_rep | df.q_rent_rep | df.q_deposit_tiny | df.q_both_zero | df.q_price_missing
       | df.q_area_bad | df.q_daily | df.rooms.isna() | df.city_fa.isna())
bad |= (df.rent > 0) & (df.rent < 500_000) & ~df.q_rent_100k
df = df[~bad]
steps["after_price_area_daily_filters"] = len(df)
df["full_deposit"] = df.deposit + df.rent / RATE
df["ppm2"] = df.full_deposit / df.area
# ppm² outliers per city (small cities share the national bounds)
q = df.groupby("city").ppm2.quantile([0.01, 0.99]).unstack()
n = df.city.value_counts()
glo, ghi = df.ppm2.quantile([0.01, 0.99])
lo = df.city.map(q[0.01].where(n >= 200)).fillna(glo)
hi = df.city.map(q[0.99].where(n >= 200)).fillna(ghi)
df = df[(df.ppm2 >= lo) & (df.ppm2 <= hi)]
steps["after_ppm2_outliers"] = len(df)
# far off their own neighborhood's median (mislabeled area, hidden rent, typo) → not a real bargain
key = [df.city, df.nb_fa.fillna("")]
hood_med = df.groupby(key).ppm2.transform("median")
hood_n = df.groupby(key).ppm2.transform("size")
odd = df.nb_fa.notna() & (hood_n >= 20) & ((df.ppm2 < 0.4 * hood_med) | (df.ppm2 > 3 * hood_med))
df = df[~odd]
steps["after_neighborhood_outliers"] = len(df)

# ---------- dedup: official first, then RadeAI; same neighborhood + area + deposit + rent ----------
df["_rank"] = (df.src != "divarofficial").astype(int)
df = df.sort_values(["_rank", "date"], ascending=[True, False])
df = df.drop_duplicates("k_full").drop_duplicates("k_nb")
steps["after_dedup"] = len(df)
steps["by_dataset"] = df.src.value_counts().to_dict()

# ---------- coordinates: drop points far from their city (bad pins, wrong city) ----------
c_lat = df.groupby("city").lat.transform("median")
c_lon = df.groupby("city").lon.transform("median")
far = ((df.lat - c_lat) * 111) ** 2 + ((df.lon - c_lon) * 111 * np.cos(np.radians(c_lat))) ** 2 > 25 ** 2
steps["coords_dropped_far_from_city"] = int(far.sum())
df.loc[far, ["lat", "lon"]] = np.nan

# ---------- text: strip phones and links ----------
PHONE = re.compile(r"(?:\+98|0098|\+۹۸|0|۰)?[\s\-]?[9۹](?:[\s\-]?[0-9۰-۹]){9}")
def scrub(t):
    if not isinstance(t, str):
        return ""
    t = PHONE.sub("[شماره حذف شد]", t)
    t = re.sub(r"https?://\S+|www\.\S+|@\w+", "", t)
    t = re.sub(r"[ \t]+", " ", t).strip()
    return t if len(t) <= 600 else t[:600].rsplit(" ", 1)[0] + "…"  # keeps the DB inside a free tier
df["title"] = df.title.map(scrub)
df["description"] = df.description.map(scrub)
steps["phones_scrubbed"] = int(df.q_phone.sum())

# ---------- street / landmark from text ----------
STREET = re.compile(r"(بلوار|خیابان|میدان|بزرگراه)[ ‌]+((?:شهید[ ]+)?[\u0621-\u064A\u067E\u0686\u0698\u06A9\u06AF\u06CC\u200c]{2,}(?:[ ‌]آباد)?)(?:[ ]*([0-9۰-۹]{1,3})(?![0-9۰-۹]|[ ]*متر))?")
STOP = set("بالا پایین است هست ای ویلا درب امن یک دو سه پهن عریض باریک های اصلی بین کف اول دوم نزدیک روبروی جنب پشت بعد قبل سر اصلیه فرعی بن‌بست بن آرام دنج خلوت اختصاصی".split())
def street(row):
    text = f"{row.title} {row.description}"
    if not isinstance(row.nb_fa, str):
        fa = None
    else:
        fa = row.nb_fa.split(" (")[0].replace("محله ", "")
    m = fa and re.search(re.escape(fa) + r"[ ]*([0-9۰-۹]{1,3})(?![0-9۰-۹]|[ ]*متر)", text)  # "هاشمیه ۴۲"
    if m:
        return f"{fa} {m.group(1)}".translate(EN2FA), "numbered"
    for m in STREET.finditer(text):
        kind, name, num = m.groups()
        if name in STOP or name.startswith("ها"):
            continue
        return (f"{kind} {name}" + (f" {num}" if num else "")).translate(EN2FA), "text"
    return (fa, "neighborhood") if fa else (None, "none")
st = df.apply(street, axis=1)
df["street"] = [s for s, _ in st]
df["street_source"] = [k for _, k in st]
steps["street_source"] = df.street_source.value_counts().to_dict()

# ---------- tags (aligned with src/lib/amenities.ts) ----------
df["building_age"] = (1405 - df.year_built).clip(lower=0)
TAGS = [
    ("مبله", r"مبله|فول\s*مبل"),
    ("نزدیک قطار شهری", r"مترو|قطار\s*شهری|ایستگاه\s*قطار"),
    ("حیاط اختصاصی", r"حیاط"),
    ("لابی‌من", r"لابی|نگهبان|سرایدار"),
    ("استخر و سونا", r"استخر|سونا|جکوزی"),
    ("روف‌گاردن", r"روف\s*گاردن|روفگاردن"),
    ("پنت‌هاوس", r"پنت\s*هاوس"),
    ("بازسازی‌شده", r"بازسازی"),
    ("پکیج", r"پکیج"),
    ("کولر گازی", r"کولر\s*گازی|اسپلیت"),
]
def tags(row):
    text = f"{row.title} {row.description}"
    out = []
    if row.building_age <= 2:
        out.append("نوساز")
    if row.balcony is True:
        out.append("بالکن")
    out += [name for name, rx in TAGS if re.search(rx, text)]
    return out
df["tags"] = df.apply(tags, axis=1)

# ---------- price adjustment ----------
df["deposit_2024"] = df.deposit
df["rent_2024"] = df.rent
df["deposit"] = (df.deposit * PRICE_FACTOR / 10e6).round() * 10e6
df["rent"] = (df.rent * PRICE_FACTOR / 5e5).round() * 5e5

# ---------- Listing shape ----------
def lid(row):
    return "dv-" + hashlib.sha1(row.src_id.encode()).hexdigest()[:8]
out = pd.DataFrame({
    "id": df.apply(lid, axis=1),
    "source": "divar",
    "dataset": df.src,
    "city": df.city,
    "city_fa": df.city_fa,
    "url": ["https://divar.ir/v/" + t if isinstance(t, str) else None for t in df.token],
    "title": df.title,
    "neighborhood": df.nb_fa,
    "nb_slug": df.nb_slug,
    "street": df.street,
    "street_source": df.street_source,
    "deposit": df.deposit.astype("int64"),
    "monthlyRent": df.rent.astype("int64"),
    "deposit_2024": df.deposit_2024.astype("int64"),
    "rent_2024": df.rent_2024.astype("int64"),
    "areaM2": df.area.round().astype("int64"),
    "rooms": df.rooms.astype("int64"),
    "floor": df.floor,
    "totalFloors": df.total_floors,
    "buildingAge": df.building_age,
    "elevator": df.elevator.fillna(False).astype(bool),
    "parking": df.parking.fillna(False).astype(bool),
    "storage": df.storage.fillna(False).astype(bool),
    "tags": df.tags,
    "convertible": df.convertible.fillna(False).astype(bool),
    "description": df.description,
    "postedAt": df.date.dt.strftime("%Y-%m-%dT%H:%M:%S.000Z"),
    "postedAt_kind": df.date_kind,
    "lat": df.lat,
    "lon": df.lon,
    "shared_room": df.q_shared,
})
out = out.drop_duplicates("id")
out.to_parquet("build/listings_iran.parquet", index=False)
steps["clean_rows"] = len(out)
steps["cities"] = int(out.city.nunique())
steps["neighborhoods"] = int(out.dropna(subset=["neighborhood"]).groupby(["city", "neighborhood"]).ngroups)
steps["with_neighborhood"] = int(out.neighborhood.notna().sum())
steps["top_cities"] = out.city_fa.value_counts().head(15).to_dict()
steps["with_coordinates"] = int(out.lat.notna().sum())

# ---------- demo sample: top neighborhoods, prefer rows with coordinates and a real description ----------
mashhad = out[(out.city == "mashhad") & out.neighborhood.notna() & ~out.shared_room]
top = mashhad.neighborhood.value_counts().head(SAMPLE_HOODS).index
pool = mashhad[mashhad.neighborhood.isin(top)].copy()
pool["_prio"] = pool.lat.notna().astype(int) * 2 + (pool.description.str.len() > 80).astype(int)
rng = np.random.default_rng(SEED)
pool["_r"] = rng.random(len(pool))
sample = (pool.sort_values(["_prio", "_r"], ascending=False)
          .groupby("neighborhood", group_keys=False).head(SAMPLE_PER_HOOD))
cols = ["id", "source", "city", "title", "neighborhood", "street", "deposit", "monthlyRent", "areaM2", "rooms", "floor",
        "totalFloors", "buildingAge", "elevator", "parking", "storage", "tags", "convertible", "description",
        "postedAt", "lat", "lon", "url"]
recs = json.loads(sample[cols].to_json(orient="records", force_ascii=False))
for r in recs:  # app shape (src/lib/types.ts Listing)
    r["cityFa"] = "مشهد"
    r["lng"] = r.pop("lon")
    r["floor"] = int(r["floor"]) if r["floor"] is not None else 0
    r["totalFloors"] = int(r["totalFloors"]) if r["totalFloors"] is not None else None
    r["buildingAge"] = int(r["buildingAge"]) if r["buildingAge"] is not None else 0
    for k in ("lat", "lng", "url"):
        if r[k] is None:
            del r[k]
recs.sort(key=lambda r: r["postedAt"], reverse=True)
with open("../../src/data/listings.json", "w") as f:  # bundled fallback when there is no DATABASE_URL
    json.dump(recs, f, ensure_ascii=False, separators=(",", ":"))
steps["sample_rows"] = len(recs)
steps["sample_neighborhoods"] = list(top)
steps["price_factor"] = PRICE_FACTOR

with open("clean_report.json", "w") as f:
    json.dump(steps, f, ensure_ascii=False, indent=1, default=int)
print(json.dumps(steps, ensure_ascii=False, indent=1, default=int))
