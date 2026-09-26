"""Load data/real/build/listings_iran.parquet into Postgres (schema: db/schema.sql).

Run from the repo root:  DATABASE_URL=postgres://... python3 scripts/realdata/load_db.py
Needs: pip install duckdb pandas pyarrow "psycopg[binary]". Replaces the imported (non-live) rows.
"""
import math
import os
import sys
import time
from pathlib import Path

import pandas as pd
import psycopg

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "data/real/build/listings_iran.parquet"
COLS = ["id", "source", "dataset", "city", "city_fa", "neighborhood", "street", "title", "description",
        "deposit", "monthly_rent", "deposit_2024", "rent_2024", "area_m2", "rooms", "floor", "total_floors",
        "building_age", "elevator", "parking", "storage", "tags", "convertible", "posted_at",
        "posted_precision", "lat", "lng", "shared_room", "url"]


def clean(v):
    if v is None:
        return None
    if isinstance(v, float) and math.isnan(v):
        return None
    return v


def main():
    url = os.environ.get("DATABASE_URL")
    if not url:
        sys.exit("DATABASE_URL is not set")
    df = pd.read_parquet(SRC)
    df = df.rename(columns={"monthlyRent": "monthly_rent", "areaM2": "area_m2", "totalFloors": "total_floors",
                            "buildingAge": "building_age", "postedAt": "posted_at", "postedAt_kind": "posted_precision",
                            "lon": "lng", "shared_room": "shared_room"})
    for c in ["floor", "total_floors", "building_age"]:
        df[c] = pd.Series([None if pd.isna(x) else int(x) for x in df[c]], index=df.index, dtype=object)
    df["tags"] = df.tags.map(list)
    df["street"] = df.street.where(df.street.notna(), None)
    df["neighborhood"] = df.neighborhood.where(df.neighborhood.notna(), None)
    rows = [tuple(clean(v) for v in r) for r in df[COLS].itertuples(index=False, name=None)]

    started = time.time()
    with psycopg.connect(url, autocommit=False) as conn, conn.cursor() as cur:
        cur.execute((ROOT / "db/schema.sql").read_text())
        cur.execute("select count(*) from listings where dataset = 'live'")
        if cur.fetchone()[0]:
            cur.execute("delete from listings where dataset <> 'live'")
        else:
            cur.execute("truncate listings")  # no dead rows left behind (free tiers count them)
        with cur.copy(f"copy listings ({', '.join(COLS)}) from stdin") as cp:
            for i, r in enumerate(rows):
                cp.write_row(r)
                if i and i % 50_000 == 0:
                    print(f"  {i:,} rows…", flush=True)
        conn.commit()
        cur.execute("refresh materialized view hood_stats")
        cur.execute("refresh materialized view city_stats")
        conn.commit()
        cur.execute("analyze listings")
        cur.execute("select count(*), pg_size_pretty(pg_database_size(current_database())) from listings")
        n, size = cur.fetchone()
    print(f"loaded {n:,} listings in {time.time() - started:.0f}s; database size {size}")


if __name__ == "__main__":
    main()
