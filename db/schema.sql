-- Homerob listings store (Postgres 14+; works on Neon / Supabase free tiers).
-- Load with: python3 scripts/realdata/load_db.py  (reads data/real/build/listings_iran.parquet)

create table if not exists listings (
  id               text primary key,
  source           text        not null default 'divar',
  dataset          text        not null,            -- divarofficial | RadeAI | live
  city             text        not null,            -- Divar city slug, e.g. mashhad
  city_fa          text        not null,
  neighborhood     text,                            -- Persian; null when the ad has none
  street           text,
  title            text        not null,
  description      text        not null default '',
  deposit          bigint      not null,            -- Toman (2026-adjusted for 2024 ads)
  monthly_rent     bigint      not null,
  deposit_2024     bigint,                          -- as published, before the price factor
  rent_2024        bigint,
  full_deposit     bigint      generated always as (deposit + (monthly_rent * 100) / 3) stored,
  area_m2          integer     not null,
  rooms            integer     not null,
  floor            integer,
  total_floors     integer,
  building_age     integer,
  elevator         boolean     not null,
  parking          boolean     not null,
  storage          boolean     not null,
  tags             text[]      not null default '{}',
  convertible      boolean     not null,
  posted_at        timestamptz,
  posted_precision text,                            -- created_at_month | unavailable_after | exact
  lat              double precision,
  lng              double precision,
  shared_room      boolean     not null default false,
  url              text,
  imported_at      timestamptz not null default now()
);

create index if not exists listings_city_hood on listings (city, neighborhood);
create index if not exists listings_city_price on listings (city, full_deposit);

-- Per-neighborhood reference numbers (median price per m², sample size, center) used for ranking,
-- the "cheaper than N ads in X" verdict and the map. Refresh after every import.
create materialized view if not exists hood_stats as
select city, neighborhood,
       count(*)::int                                                        as n,
       percentile_cont(0.5) within group (order by full_deposit::float8 / area_m2) as median_ppm2,
       percentile_cont(0.5) within group (order by full_deposit)           as median_full,
       percentile_cont(0.5) within group (order by lat)                    as lat,
       percentile_cont(0.5) within group (order by lng)                    as lng
from listings
where not shared_room and neighborhood is not null
group by city, neighborhood;
create unique index if not exists hood_stats_pk on hood_stats (city, neighborhood);

create materialized view if not exists city_stats as
select city, min(city_fa) as city_fa, count(*)::int as n,
       percentile_cont(0.5) within group (order by full_deposit::float8 / area_m2) as median_ppm2,
       percentile_cont(0.5) within group (order by lat) as lat,
       percentile_cont(0.5) within group (order by lng) as lng
from listings
where not shared_room
group by city;
create unique index if not exists city_stats_pk on city_stats (city);
