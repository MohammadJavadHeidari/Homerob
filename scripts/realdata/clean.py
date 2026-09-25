"""Run from data/real/ after normalize.py: python3 ../../scripts/realdata/clean.py
Step 2: mashhad_rent_normalized.parquet → clean, deduped Mashhad apartment rentals.

Outputs (next to this file):
  mashhad_rent_clean.parquet   every clean apartment, Listing-like columns + 2024 originals
  listings.sample.json         demo-size sample in the app's Listing shape (not wired into the app)
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

df = duckdb.sql("SELECT * FROM 'build/mashhad_rent_normalized.parquet'").df()
steps = {"input": len(df)}

# ---------- filter ----------
df = df[df.kind == "apartment"]
steps["apartments"] = len(df)
df.loc[df.q_rent_100k, "rent"] = 0  # rent 100k = "full rahn" placeholder
bad = (df.q_deposit_rep | df.q_rent_rep | df.q_deposit_tiny | df.q_both_zero | df.q_price_missing
       | df.q_area_bad | df.q_daily | df.rooms.isna() | df.nb_fa.isna())
bad |= (df.rent > 0) & (df.rent < 500_000) & ~df.q_rent_100k
df = df[~bad]
steps["after_price_area_daily_filters"] = len(df)
df["full_deposit"] = df.deposit + df.rent / RATE
df["ppm2"] = df.full_deposit / df.area
lo, hi = df.ppm2.quantile([0.01, 0.99])
df = df[(df.ppm2 >= lo) & (df.ppm2 <= hi)]
steps["after_ppm2_outliers"] = len(df)

# ---------- dedup: official first, then RadeAI; same neighborhood + area + deposit + rent ----------
df["_rank"] = (df.src != "divarofficial").astype(int)
df = df.sort_values(["_rank", "date"], ascending=[True, False])
df = df.drop_duplicates("k_full").drop_duplicates("k_nb")
steps["after_dedup"] = len(df)
steps["by_dataset"] = df.src.value_counts().to_dict()

# ---------- text: strip phones and links ----------
PHONE = re.compile(r"(?:\+98|0098|\+۹۸|0|۰)?[\s\-]?[9۹](?:[\s\-]?[0-9۰-۹]){9}")
def scrub(t):
    if not isinstance(t, str):
        return ""
    t = PHONE.sub("[شماره حذف شد]", t)
    t = re.sub(r"https?://\S+|www\.\S+|@\w+", "", t)
    return re.sub(r"[ \t]+", " ", t).strip()
df["title"] = df.title.map(scrub)
df["description"] = df.description.map(scrub)
steps["phones_scrubbed"] = int(df.q_phone.sum())

# ---------- street / landmark from text ----------
STREET = re.compile(r"(بلوار|خیابان|میدان|بزرگراه)[ ‌]+((?:شهید[ ]+)?[\u0621-\u064A\u067E\u0686\u0698\u06A9\u06AF\u06CC\u200c]{2,}(?:[ ‌]آباد)?)(?:[ ]*([0-9۰-۹]{1,3})(?![0-9۰-۹]|[ ]*متر))?")
STOP = set("بالا پایین است هست ای ویلا درب امن یک دو سه پهن عریض باریک های اصلی بین کف اول دوم نزدیک روبروی جنب پشت بعد قبل سر اصلیه فرعی بن‌بست بن آرام دنج خلوت اختصاصی".split())
def street(row):
    text = f"{row.title} {row.description}"
    fa = row.nb_fa.split(" (")[0].replace("محله ", "")
    m = re.search(re.escape(fa) + r"[ ]*([0-9۰-۹]{1,3})(?![0-9۰-۹]|[ ]*متر)", text)  # "هاشمیه ۴۲"
    if m:
        return f"{fa} {m.group(1)}".translate(EN2FA), "numbered"
    for m in STREET.finditer(text):
        kind, name, num = m.groups()
        if name in STOP or name.startswith("ها"):
            continue
        return (f"{kind} {name}" + (f" {num}" if num else "")).translate(EN2FA), "text"
    return fa, "neighborhood"
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
out.to_parquet("build/mashhad_rent_clean.parquet", index=False)
steps["clean_rows"] = len(out)
steps["neighborhoods"] = int(out.neighborhood.nunique())
steps["with_coordinates"] = int(out.lat.notna().sum())

# ---------- demo sample: top neighborhoods, prefer rows with coordinates and a real description ----------
top = out[~out.shared_room].neighborhood.value_counts().head(SAMPLE_HOODS).index
pool = out[out.neighborhood.isin(top) & ~out.shared_room].copy()
pool["_prio"] = pool.lat.notna().astype(int) * 2 + (pool.description.str.len() > 80).astype(int)
rng = np.random.default_rng(SEED)
pool["_r"] = rng.random(len(pool))
sample = (pool.sort_values(["_prio", "_r"], ascending=False)
          .groupby("neighborhood", group_keys=False).head(SAMPLE_PER_HOOD))
cols = ["id", "source", "title", "neighborhood", "street", "deposit", "monthlyRent", "areaM2", "rooms", "floor",
        "totalFloors", "buildingAge", "elevator", "parking", "storage", "tags", "convertible", "description",
        "postedAt", "lat", "lon"]
recs = json.loads(sample[cols].to_json(orient="records", force_ascii=False))
with open("listings.sample.json", "w") as f:
    json.dump(recs, f, ensure_ascii=False, indent=1)
steps["sample_rows"] = len(recs)
steps["sample_neighborhoods"] = list(top)
steps["price_factor"] = PRICE_FACTOR

with open("clean_report.json", "w") as f:
    json.dump(steps, f, ensure_ascii=False, indent=1, default=int)
print(json.dumps(steps, ensure_ascii=False, indent=1, default=int))
