"""Run from data/real/: python3 ../../scripts/realdata/normalize.py
Normalize the residential-rent ads of the two accessible datasets into one Listing-like frame
(money in Toman): divarofficial for every city, RadeAI for Mashhad. Output: build/rent_normalized.parquet"""
import re
import duckdb
import pandas as pd
import numpy as np

con = duckdb.connect()
FA = str.maketrans("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩", "01234567890123456789")

def fa2en(s):
    return s.translate(FA) if isinstance(s, str) else s

def parse_year(v):
    if not isinstance(v, str):
        return np.nan
    s = fa2en(v)
    m = re.search(r"(1[34]\d\d)", s)
    if not m:
        return np.nan
    y = int(m.group(1))
    if "قبل" in s:  # "قبل از ۱۳۷۰"
        y -= 1
    return y

nm = con.sql("SELECT * FROM 'raw/name_map.parquet'").df()  # built from RadeAI's Persian city/district labels
city2fa = dict(zip(nm[nm.kind == "city"].city, nm[nm.kind == "city"].fa))
d = nm[nm.kind == "district"]
nb2fa = dict(zip(zip(d.city, d.district), d.fa))

# ---------- official ----------
o = con.sql("SELECT * FROM 'raw/official_rent_iran.parquet'").df()
ROOMS = {"بدون اتاق": 0, "یک": 1, "دو": 2, "سه": 3, "چهار": 4, "پنج یا بیشتر": 5}
def num(x):
    try:
        return float(fa2en(str(x)))
    except Exception:
        return np.nan
def tri(x):
    if x in ("true", True):
        return True
    if x in ("false", False):
        return False
    return None

on = pd.DataFrame({
    "src": "divarofficial",
    "src_id": ["off-" + str(i) for i in o.index],
    "city": o.city_slug,
    "kind": o.cat3_slug.map({"apartment-rent": "apartment", "house-villa-rent": "house-villa"}),
    "title": o.title,
    "description": o.description,
    "nb_slug": o.neighborhood_slug,
    "deposit": np.where(o.credit_mode == "مجانی", 0, np.where(o.credit_mode == "توافقی", np.nan, o.credit_value)),
    "rent": np.where(o.rent_mode == "مجانی", 0, np.where(o.rent_mode == "توافقی", np.nan, o.rent_value)),
    "area": o.building_size,
    "rooms": o.rooms_count.map(ROOMS),
    "floor": o.floor.map(num),
    "total_floors": o.total_floors_count.map(num),
    "year_built": o.construction_year.map(parse_year),
    "elevator": o.has_elevator,
    "parking": o.has_parking,
    "storage": o.has_warehouse,
    "balcony": o.has_balcony.map(tri),
    "convertible": o.rent_credit_transform,
    "alt_deposit": o.transformed_credit,
    "alt_rent": o.transformed_rent,
    "heating": o.has_heating_system,
    "cooling": o.has_cooling_system,
    "floor_material": o.floor_material,
    "direction": o.building_direction,
    "units_per_floor": o.unit_per_floor,
    "user_type": o.user_type,
    "date": pd.to_datetime(o.created_at_month),
    "date_kind": "created_at_month",
    "lat": o.location_latitude,
    "lon": o.location_longitude,
    "radius": o.location_radius,
    "image_count": np.nan,
})

# ---------- RadeAI ----------
r = con.sql("SELECT * FROM 'raw/radeai_mashhad_rent.parquet'").df()
r["unavailable_after"] = pd.to_datetime(r.unavailable_after, format="ISO8601")
r_all_rows = len(r)
r = r.sort_values("unavailable_after").drop_duplicates("token", keep="last")
RR = {"بدون اتاق": 0, "1": 1, "2": 2, "3": 3, "4": 4, "+4": 5}
def parse_floor(v):
    if not isinstance(v, str):
        return (np.nan, np.nan)
    s = fa2en(v).strip()
    parts = s.split("از")
    def one(p):
        p = p.strip()
        if p.startswith("همکف"):
            return 0.0
        if "زیر" in p:
            return -1.0
        try:
            return float(p)
        except Exception:
            return np.nan
    f = one(parts[0])
    t = one(parts[1]) if len(parts) > 1 else np.nan
    return (f, t)
fl = r["basic_info.Floor"].map(parse_floor)
def feat(pos, neg_col=None, pos2=None):
    a = r[pos].map(lambda x: None if x is None else x == "1.0")
    if pos2 is not None:
        b = r[pos2] == "1.0"
        a = a.where(a.notna(), np.where(b, True, None))
    if neg_col is not None:
        n = r[neg_col] == "1.0"
        a = a.where(a.notna(), np.where(n, False, None))
    return a
def clean_desc(d):
    if not isinstance(d, str):
        return d
    parts = d.split("|")
    body = "|".join(parts[3:]) if len(parts) > 3 else d
    body = re.sub(r"^خرید و فروش\s*", "", body)
    body = re.sub(r"\|\s*سایت ثبت آگهی، نیازمندی و خرید و فروش دیوار\s*$", "", body)
    return body.strip()
rn = pd.DataFrame({
    "src": "RadeAI",
    "src_id": "rade-" + r.token,
    "city": "mashhad",
    "kind": "apartment",
    "title": r.title,
    "description": r.description.map(clean_desc),
    "nb_slug": r.district,
    "deposit": pd.to_numeric(r.credit, errors="coerce"),
    "rent": pd.to_numeric(r.rent, errors="coerce"),
    "area": pd.to_numeric(r["basic_info.Area"].map(fa2en), errors="coerce"),
    "rooms": r["basic_info.Rooms"].map(RR),
    "floor": [x[0] for x in fl],
    "total_floors": [x[1] for x in fl],
    "year_built": r["basic_info.Year Built"].map(parse_year),
    "elevator": feat("features.Elevator", "features.آسانسور ندارد", "features.آسانسور"),
    "parking": feat("features.Parking", "features.پارکینگ ندارد", "features.پارکینگ"),
    "storage": feat("features.Storage Room", "features.انباری ندارد", "features.انباری"),
    "balcony": np.where(r["features.بالکن"] == "1.0", True, np.where(r["features.بالکن ندارد"] == "1.0", False, None)),
    "convertible": (r.amenities.str.contains("قابل تبدیل", na=False)) | (r["basic_info.Deposit and Rent"] == "قابل تبدیل"),
    "alt_deposit": np.nan,
    "alt_rent": np.nan,
    "heating": None, "cooling": None, "floor_material": None, "direction": r["features.جهت ساختمان"],
    "units_per_floor": r["features.تعداد واحد در طبقه"],
    "user_type": r.business_type.map({"personal": "شخصی", "real-estate-business": "مشاور املاک"}),
    "date": r.unavailable_after,
    "date_kind": "unavailable_after",
    "lat": pd.to_numeric(r.lat, errors="coerce"),
    "lon": pd.to_numeric(r.lon, errors="coerce"),
    "radius": pd.to_numeric(r.radius, errors="coerce"),
    "image_count": pd.to_numeric(r.image_count, errors="coerce"),
})
rn["token"] = r.token.values

df = pd.concat([on, rn], ignore_index=True)
df["city_fa"] = df.city.map(city2fa)
df["nb_fa"] = [nb2fa.get((c, n)) for c, n in zip(df.city, df.nb_slug)]
df["full_deposit"] = df.deposit + df.rent / 0.03
df["ppm2"] = df.full_deposit / df.area
df["building_age_1405"] = 1405 - df.year_built

# ---------- quality flags ----------
def rep_digits(v):
    if pd.isna(v) or v <= 0:
        return False
    s = str(int(v))
    return len(s) >= 5 and len(set(s)) == 1
df["q_deposit_rep"] = df.deposit.map(rep_digits)
df["q_rent_rep"] = df.rent.map(rep_digits)
df["q_deposit_tiny"] = (df.deposit > 0) & (df.deposit < 5_000_000)
df["q_rent_tiny"] = (df.rent > 0) & (df.rent < 100_000)
df["q_rent_100k"] = df.rent == 100_000
df["q_both_zero"] = (df.deposit.fillna(0) == 0) & (df.rent.fillna(0) == 0)
df["q_price_missing"] = df.deposit.isna() | df.rent.isna()
df["q_area_bad"] = (df.area < 20) | (df.area > 1000) | df.area.isna()
txt = (df.title.fillna("") + " \n " + df.description.fillna(""))
SHARED = r"هم[\s‌]?خونه|هم[\s‌]?خانه|اجاره[\s‌]?(?:ی[\s‌]?)?اتاق|یک اتاق از|خوابگاه|پانسیون"
df["q_shared"] = txt.str.contains(SHARED, regex=True)
PHONE = r"(?:\+98|0098|0|۰|\+۹۸)[\s\-]?(?:9|۹)(?:[\s\-]?[0-9۰-۹]){9}"
df["q_phone"] = txt.str.contains(PHONE, regex=True)
DAILY = r"روزانه|اجاره روزی|شبی|اجاره کوتاه مدت|سوئیت روزانه"
df["q_daily"] = txt.str.contains(DAILY, regex=True)
lo, hi = df.loc[df.ppm2 > 0, "ppm2"].quantile([0.01, 0.99])
df["q_ppm2_outlier"] = (df.ppm2 < lo) | (df.ppm2 > hi)
df["q_any_price"] = df[["q_deposit_rep", "q_rent_rep", "q_deposit_tiny", "q_rent_tiny", "q_both_zero", "q_price_missing"]].any(axis=1)

# ---------- cross-dataset overlap key ----------
def norm_title(t):
    t = fa2en(t) if isinstance(t, str) else ""
    return re.sub(r"[\s‌\-_/|.,،*:()]+", "", t)
df["k_title"] = df.title.map(norm_title)
df["k_full"] = df.city + "|" + df.k_title + "|" + df.area.astype(str) + "|" + df.deposit.astype(str) + "|" + df.rent.astype(str)
df["k_nb"] = df.city + "|" + df.nb_slug.fillna("") + "|" + df.area.astype(str) + "|" + df.deposit.astype(str) + "|" + df.rent.astype(str)

df.to_parquet("build/rent_normalized.parquet", index=False)
print("rows", len(df), df.src.value_counts().to_dict(), "radeai raw rows", r_all_rows, "ppm2 1/99 pct", lo, hi)
