"""Load data/real/build/listings_iran.parquet into a Neon database over HTTPS (Neon's /sql endpoint).

For environments where Postgres' port 5432 is blocked (only HTTPS allowed). Same result as load_db.py.
Run from the repo root:  DATABASE_URL=postgres://...neon.tech/... python3 scripts/realdata/load_db_http.py
"""
import json
import math
import os
import re
import sys
import time
import urllib.request
from pathlib import Path
from urllib.parse import urlparse

import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "data/real/build/listings_iran.parquet"
BATCH = 2000
COLS = ["id", "source", "dataset", "city", "city_fa", "neighborhood", "street", "title", "description",
        "deposit", "monthly_rent", "deposit_2024", "rent_2024", "area_m2", "rooms", "floor", "total_floors",
        "building_age", "elevator", "parking", "storage", "tags", "convertible", "posted_at",
        "posted_precision", "lat", "lng", "shared_room", "url"]

URL = os.environ.get("DATABASE_URL") or sys.exit("DATABASE_URL is not set")
HOST = urlparse(URL).hostname


def sql(query, params=None, retries=4):
    body = json.dumps({"query": query, "params": params or []}).encode()
    for attempt in range(retries):
        req = urllib.request.Request(f"https://{HOST}/sql", data=body, method="POST", headers={
            "content-type": "application/json", "Neon-Connection-String": URL})
        try:
            with urllib.request.urlopen(req, timeout=120) as res:
                return json.loads(res.read())
        except urllib.error.HTTPError as e:
            msg = e.read().decode()[:300]
            if e.code < 500 or attempt == retries - 1:
                raise RuntimeError(f"HTTP {e.code}: {msg}") from None
        except (urllib.error.URLError, TimeoutError):
            if attempt == retries - 1:
                raise
        time.sleep(2 ** attempt)


def statements(text):
    text = re.sub(r"--[^\n]*", "", text)
    return [s.strip() for s in text.split(";") if s.strip()]


def val(v):
    if v is None or (isinstance(v, float) and math.isnan(v)):
        return None
    if hasattr(v, "item"):
        return v.item()
    return v


def main():
    df = pd.read_parquet(SRC).rename(columns={
        "monthlyRent": "monthly_rent", "areaM2": "area_m2", "totalFloors": "total_floors",
        "buildingAge": "building_age", "postedAt": "posted_at", "postedAt_kind": "posted_precision", "lon": "lng"})
    df["tags"] = df.tags.map(list)
    ints = {"floor", "total_floors", "building_age", "deposit", "monthly_rent", "deposit_2024", "rent_2024",
            "area_m2", "rooms"}

    started = time.time()
    for s in statements((ROOT / "db/schema.sql").read_text()):
        sql(s)
    live = sql("select count(*)::int n from listings where dataset = 'live'")["rows"][0]["n"]
    sql("delete from listings where dataset <> 'live'" if live else "truncate listings")

    insert = (f"insert into listings ({', '.join(COLS)}) "
              f"select {', '.join(COLS)} from json_populate_recordset(null::listings, $1::json)")
    def cell(k, v):
        v = val(v)
        return int(v) if k in ints and v is not None else v
    records = [{k: cell(k, v) for k, v in zip(COLS, row)} for row in df[COLS].itertuples(index=False, name=None)]
    for i in range(0, len(records), BATCH):
        sql(insert, [json.dumps(records[i:i + BATCH], ensure_ascii=False)])
        done = min(i + BATCH, len(records))
        if done % 20_000 < BATCH or done == len(records):
            print(f"  {done:,} / {len(records):,} rows ({time.time() - started:.0f}s)", flush=True)

    sql("refresh materialized view hood_stats")
    sql("refresh materialized view city_stats")
    sql("analyze listings")
    r = sql("select count(*)::int n, pg_size_pretty(pg_database_size(current_database())) s from listings")["rows"][0]
    print(f"loaded {r['n']:,} listings in {time.time() - started:.0f}s; database size {r['s']}")


if __name__ == "__main__":
    main()
