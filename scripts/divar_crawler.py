#!/usr/bin/env python3
"""
Homerob — Divar crawler (runs on the owner's machine, inside Iran).

Collects real Divar real-estate ads — residential and commercial, rent and sale — newest first, and
(with --push) publishes them to the `divar-data` branch of the repo. A GitHub Action
(.github/workflows/import-divar-crawl.yml) normalizes them into src/data/divar.json on `main` every
30 minutes, so nothing is uploaded by hand.

Routing (universal-scraping-architect): Mode 2, local Python. Divar answers only Iranian IPs, so a hosted
crawler can't see it. It talks to the same public JSON API that divar.ir's web app calls (no login, no
key) — no HTML selectors to break. Standard library only, Python 3.9+, plus `git` for --push.

    python3 scripts/divar_crawler.py --push                     # one pass, all four categories, Mashhad, push
    python3 scripts/divar_crawler.py --install-schedule 30      # run that every 30 min (launchd / cron / Task Scheduler)
    python3 scripts/divar_crawler.py --uninstall-schedule
    python3 scripts/divar_crawler.py --cities mashhad,tehran --categories residential-sale --max-new 100
    python3 scripts/divar_crawler.py --probe                    # save raw API answers for debugging
    python3 scripts/divar_crawler.py --refetch --push           # re-read stored ads with the current parser

Files:
    data/raw/divar-crawl.jsonl   local store, one ad per line (checkpoint: ads already in it are skipped)
    data/raw/divar-crawl.json    the same ads as one validated JSON array
    data/raw/divar-crawl.log     run log (+ schedule.log when run by the scheduler)
    .crawl-data/                 git worktree of the `divar-data` branch (crawl/<date>.jsonl shards)

Etiquette and privacy (the repo is public):
- robots.txt of the API host is checked every pass; a disallowed path stops the crawler.
- One request at a time, 2–4 s random pause per ad, backoff on 429/5xx, stop on 403.
- Never calls the contact endpoint: no phone numbers. Seller / agency / chat widgets are dropped, phone-like
  numbers in text are masked, agency names on the search card and Divar's business ids are removed.
"""

from __future__ import annotations

import argparse
import json
import os
import platform
import random
import re
import shlex
import subprocess
import sys
import time
import urllib.error
import urllib.request
import urllib.robotparser
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any, Iterator, Optional

# =============================================================================
# CONFIG
# =============================================================================
API = "https://api.divar.ir"
SEARCH_PATH = "/v8/postlist/w/search"
POST_PATH = "/v8/posts-v2/web/{token}"
CITIES_PATH = "/v8/places/cities"

REPO = Path(__file__).resolve().parent.parent
OUT_DIR = REPO / "data" / "raw"
STORE = "divar-crawl.jsonl"
SNAPSHOT = "divar-crawl.json"
LOG = "divar-crawl.log"
LOCK = "divar-crawl.lock"
SCHEMA = "homerob-divar-crawl/1"

DATA_BRANCH = "divar-data"
WORKTREE = REPO / ".crawl-data"
SCHEDULE_NAME = "ir.homerob.divar-crawler"

USER_AGENT = "HomerobCrawler/0.2 (+https://homerob.vercel.app; small demo dataset, polite rate)"
TIMEOUT_S = 20
MAX_RETRIES = 4
DELAY_S = (2.0, 4.0)        # before each ad page
PAGE_DELAY_S = (1.5, 3.0)   # before each search page
LOCK_STALE_S = 3 * 3600     # a lock older than this is from a crashed run

# Divar city ids (fallback when /places/cities can't be read). A number works too: --cities 3.
CITY_IDS = {
    "tehran": "1", "karaj": "2", "mashhad": "3", "isfahan": "4", "tabriz": "5",
    "shiraz": "6", "ahvaz": "7", "qom": "8",
}

# Homerob category key -> Divar category slug. Any other value is sent to Divar as-is.
CATEGORIES = {
    "residential-rent": "residential-rent",
    "residential-sale": "residential-sell",
    "commercial-rent": "commercial-rent",
    "commercial-sale": "commercial-sell",
    "short-term": "temporary-rent",
}
DEFAULT_CATEGORIES = "residential-rent,residential-sale,commercial-rent,commercial-sale"

# Widgets that are about the seller, not the property (never stored).
PERSONAL_WIDGET = re.compile(r"CONTACT|CHAT|BUSINESS|AGENCY|SELLER|USER|PROFILE|CALL", re.I)
# Divar's analytics fields worth keeping (category tree, place, prices). Business ids etc. are dropped.
META_KEEP = {"category", "cat_1", "cat_2", "cat_3", "city", "district", "credit", "rent", "price", "image_count"}
# Iranian mobile / landline numbers in Latin or Persian digits, with optional separators.
PHONE = re.compile(r"(?:\+98|0098|۰۰۹۸|0|۰)[\s\-]?(?:9|۹)(?:[\s\-]?[0-9۰-۹]){9}|(?:0|۰)(?:[0-9۰-۹]){2}[\s\-]?(?:[0-9۰-۹][\s\-]?){8}")
TOKEN = re.compile(r"^[A-Za-z0-9_-]{6,12}$")
WHEN_WHERE = re.compile(r"(?:پیش|دیروز|پریروز|لحظاتی|دقایقی)\s+در\s+\S")


# =============================================================================
# HELPERS
# =============================================================================
class Blocked(Exception):
    """Divar refused us (403, robots.txt, or too many 429s): stop this pass, keep what we have."""


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def log(msg: str, level: str = "INFO") -> None:
    line = f"[{datetime.now():%Y-%m-%d %H:%M:%S}] [{level}] {msg}"
    print(line, flush=True)
    with open(OUT_DIR / LOG, "a", encoding="utf-8") as f:
        f.write(line + "\n")


def pause(span: Optional[tuple[float, float]] = None) -> None:
    time.sleep(random.uniform(*(span or DELAY_S)))


def http(method: str, path: str, body: Optional[dict] = None) -> Optional[Any]:
    """JSON request with retries. Returns None for a missing ad (404/410). Raises Blocked."""
    url = API + path
    data = json.dumps(body, ensure_ascii=False).encode("utf-8") if body is not None else None
    headers = {
        "User-Agent": USER_AGENT,
        "Accept": "application/json",
        "Accept-Language": "fa-IR,fa;q=0.9",
        "Origin": "https://divar.ir",
        "Referer": "https://divar.ir/",
    }
    if data is not None:
        headers["Content-Type"] = "application/json"
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            req = urllib.request.Request(url, data=data, headers=headers, method=method)
            with urllib.request.urlopen(req, timeout=TIMEOUT_S) as r:
                return json.loads(r.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            if e.code in (404, 410):
                return None
            if e.code == 403:
                raise Blocked(f"403 Forbidden on {path} — Divar refused the crawler")
            if e.code not in (429, 500, 502, 503, 504):
                raise Blocked(f"HTTP {e.code} on {path}: {e.read()[:300]!r}")
            wait = 2 ** attempt * 5 if e.code == 429 else 2 ** attempt
            log(f"HTTP {e.code} on {path} (attempt {attempt}/{MAX_RETRIES}); waiting {wait}s", "WARNING")
        except (urllib.error.URLError, TimeoutError, ConnectionError) as e:
            wait = 2 ** attempt
            log(f"network error on {path} (attempt {attempt}/{MAX_RETRIES}): {e}; waiting {wait}s", "WARNING")
        except json.JSONDecodeError as e:
            raise Blocked(f"{path} did not return JSON ({e}) — run --probe and send the files in data/raw/probe/")
        time.sleep(wait)
    raise Blocked(f"giving up on {path} after {MAX_RETRIES} attempts")


def robots_allow(paths: list[str]) -> None:
    """RFC 9309 check on the API host. Unreachable robots.txt = allowed (logged)."""
    rp = urllib.robotparser.RobotFileParser()
    rp.set_url(API + "/robots.txt")
    try:
        rp.read()
    except Exception as e:  # noqa: BLE001 — any failure to read means "no rules"
        log(f"could not read {API}/robots.txt ({e}); continuing", "WARNING")
        return
    for p in paths:
        if not rp.can_fetch(USER_AGENT, API + p):
            raise Blocked(f"robots.txt of {API} disallows {p} — stopping (tell Claude; we'll pick another route)")


def walk(node: Any) -> Iterator[dict]:
    """Every dict in a JSON tree, depth-first."""
    if isinstance(node, dict):
        yield node
        for v in node.values():
            yield from walk(v)
    elif isinstance(node, list):
        for v in node:
            yield from walk(v)


def text(v: Any) -> str:
    return v.strip() if isinstance(v, str) else ""


def strip_personal(node: Any) -> Any:
    """Copy of the tree without seller / contact widgets (and everything inside them)."""
    if isinstance(node, dict):
        if PERSONAL_WIDGET.search(text(node.get("widget_type"))):
            return None
        return {k: strip_personal(v) for k, v in node.items()}
    if isinstance(node, list):
        return [x for x in (strip_personal(v) for v in node) if x is not None]
    return node


def mask_phones(s: str) -> str:
    return PHONE.sub("[شماره حذف شد]", s)


def card_place(line: str) -> str:
    """Card line «آژانس املاک X در الهیه» → «در الهیه»; «۲ ساعت پیش در الهیه» stays (time, not a name)."""
    if not line or WHEN_WHERE.search(line):
        return line
    m = re.search(r"(?:^|\s)در\s+(.+)$", line)
    return f"در {m.group(1)}" if m else ""


def sanitize(ad: dict) -> dict:
    """Public-safe copy (the data branch is public). Idempotent; also cleans ads stored by older versions."""
    ad = dict(ad)
    card = dict(ad.get("card") or {})
    card["bottom"] = card_place(text(card.get("bottom")))
    ad["card"] = card
    ad["meta"] = {k: v for k, v in (ad.get("meta") or {}).items() if k in META_KEEP}
    ad["description"] = mask_phones(ad.get("description") or "")
    ad["fields"] = {k: mask_phones(v) for k, v in (ad.get("fields") or {}).items()}
    ad["rows"] = [[r[0], mask_phones(r[1]), mask_phones(r[2])] for r in ad.get("rows") or [] if len(r) == 3]
    return ad


def resolve_city(city: str) -> str:
    if city.isdigit():
        return city
    try:
        data = http("GET", CITIES_PATH)
        for d in walk(data):
            if text(d.get("slug")) == city and d.get("id") is not None:
                return str(d["id"])
    except Blocked as e:
        log(f"city list unavailable ({e}); using the built-in ids", "WARNING")
    if city in CITY_IDS:
        return CITY_IDS[city]
    sys.exit(f"unknown city '{city}'. Use a Divar slug ({', '.join(CITY_IDS)}) or a numeric id.")


# =============================================================================
# SEARCH (list of newest ads)
# =============================================================================
def search_body(city_id: str, category: str, pagination: Optional[dict]) -> dict:
    body: dict[str, Any] = {
        "city_ids": [city_id],
        "source_view": "CATEGORY",
        "disable_recommendation": True,
        "map_state": {"camera_info": {"bbox": {}}},
        "search_data": {
            "form_data": {"data": {"category": {"str": {"value": category}}}},
            "server_payload": {
                "@type": "type.googleapis.com/widgets.SearchData.ServerPayload",
                "additional_form_data": {"data": {"sort": {"str": {"value": "sort_date"}}}},
            },
        },
    }
    if pagination:
        body["pagination_data"] = pagination
    return body


def cards_of(page: Any) -> list[dict]:
    """POST_ROW cards on a search page → {token, title, top, middle, bottom, image, district, city}."""
    cards, seen = [], set()
    for w in walk(page):
        if text(w.get("widget_type")) != "POST_ROW" or not isinstance(w.get("data"), dict):
            continue
        d = w["data"]
        token = next(
            (text(x.get("token")) for x in walk(d) if TOKEN.match(text(x.get("token")))),
            "",
        )
        if not token or token in seen:
            continue
        seen.add(token)
        info = next((x for x in walk(d) if "district_persian" in x or "city_persian" in x), {})
        cards.append({
            "token": token,
            "title": text(d.get("title")),
            "top": text(d.get("top_description_text")),
            "middle": text(d.get("middle_description_text")),
            "bottom": card_place(text(d.get("bottom_description_text"))),
            "image": text(d.get("image_url")),
            "district": text(info.get("district_persian")),
            "city": text(info.get("city_persian")),
        })
    return cards


def next_pagination(page: Any) -> Optional[dict]:
    p = page.get("pagination") if isinstance(page, dict) else None
    if isinstance(p, dict) and p.get("has_next_page") and isinstance(p.get("data"), dict):
        return p["data"]
    return None


# =============================================================================
# AD PAGE (details)
# =============================================================================
def parse_post(token: str, post: dict, card: dict, city_id: str, category: str) -> dict:
    """Reads an ad generically: every widget's title/value/text, so a renamed widget isn't lost."""
    fields: dict[str, str] = {}
    features: list[dict] = []
    rows: list[list[str]] = []  # [widget_type, title, value/text] for anything not otherwise captured
    images: list[str] = []
    subtitle = title = published = ""
    texts: list[str] = []  # every description-like text block, in page order
    lat = lng = None
    exact: Optional[bool] = None
    convertible = False
    breadcrumb: list[str] = []

    post = strip_personal(post)
    for w in walk(post):
        wtype = text(w.get("widget_type"))
        d = w.get("data")
        if not wtype or not isinstance(d, dict):
            continue
        if wtype == "LEGEND_TITLE_ROW":
            title = title or text(d.get("title"))
            subtitle = subtitle or text(d.get("subtitle"))
        elif "DESCRIPTION" in wtype:
            # Divar renders «انتشار آگهی: ۳۰ شهریور ۱۴۰۵، ۱۷:۲۱» as a description row too.
            t = text(d.get("text"))
            if t.startswith("انتشار آگهی") or "آخرین نردبان" in t:
                published = published or t
            elif t and t not in texts:
                texts.append(t)
        elif wtype == "MAP_ROW":
            loc = d.get("location") if isinstance(d.get("location"), dict) else {}
            for kind, is_exact in (("exact_data", True), ("fuzzy_data", False)):
                pt = (loc.get(kind) or {}).get("point") if isinstance(loc.get(kind), dict) else None
                if isinstance(pt, dict) and pt.get("latitude") is not None:
                    lat, lng, exact = float(pt["latitude"]), float(pt["longitude"]), is_exact
                    break
        elif "SLIDER" in wtype:
            convertible = True
        elif wtype == "BREADCRUMB":
            breadcrumb = [text(x.get("title")) for x in walk(d) if text(x.get("title"))]
        elif "FEATURE" in wtype:
            for it in walk(d):
                t = text(it.get("title"))
                if t and t not in {f["title"] for f in features} and it is not d:
                    features.append({"title": t, **({"available": it["available"]} if isinstance(it.get("available"), bool) else {})})
        for it in walk(d):  # GROUP_INFO_ROW items, UNEXPANDABLE_ROW, nested "all details" modals …
            t, v = text(it.get("title")), text(it.get("value"))
            if t and v and t not in fields:
                fields[t] = v
        for it in walk(d):
            img = text(it.get("image_url")) or text(it.get("image"))
            if img.startswith("http") and "divarcdn" in img and "mapimage" not in img and img not in images:
                images.append(img)
        if wtype not in ("LEGEND_TITLE_ROW", "MAP_ROW", "BREADCRUMB") and not re.search("FEATURE|DESCRIPTION", wtype):
            t, v = text(d.get("title")), text(d.get("value")) or text(d.get("text")) or text(d.get("subtitle"))
            # The location line («۱ ساعت پیش در مشهد، الهیه، خ …») sits in an EXPANDABLE_SECTION title.
            if not subtitle and WHEN_WHERE.search(t):
                subtitle = t
            if (t or v) and [wtype, t, v] not in rows:
                rows.append([wtype, t, v])

    seo = post.get("seo") if isinstance(post.get("seo"), dict) else {}
    web = seo.get("web_info") if isinstance(seo.get("web_info"), dict) else {}
    engage = post.get("webengage") if isinstance(post.get("webengage"), dict) else {}
    meta = {k: v for k, v in engage.items() if isinstance(v, (str, int, float, bool))}

    return sanitize({
        "schema": SCHEMA,
        "token": token,
        "url": f"https://divar.ir/v/{token}",
        "crawled_at": now_iso(),
        "city_id": city_id,
        "category": category,  # the Divar slug searched; meta.cat_2 is Divar's own answer
        "title": title or text(web.get("title")) or card.get("title", ""),
        "subtitle": subtitle,  # "۲ ساعت پیش در مشهد، وکیل‌آباد"
        "city": text(web.get("city_persian")) or card.get("city", ""),
        "district": text(web.get("district_persian")) or card.get("district", ""),
        "description": "\n\n".join(texts),
        "published": published,  # "انتشار آگهی: ۳۰ شهریور ۱۴۰۵، ۱۷:۲۱\nآخرین نردبان: …"
        "fields": fields,  # {"متراژ": "۸۵", "ساخت": "۱۳۹۵", "اتاق": "دو", "ودیعه": "…", "قیمت کل": "…", …}
        "features": features,  # [{"title": "آسانسور"}, {"title": "پارکینگ ندارد"}]
        "convertible": convertible,
        "lat": lat,
        "lng": lng,
        "location_exact": exact,
        "images": images[:6],
        "breadcrumb": breadcrumb,
        "card": {k: v for k, v in card.items() if k != "token"},
        "meta": meta,
        "rows": rows,
    })


# =============================================================================
# STORE (checkpoint + validated snapshot)
# =============================================================================
def load_store() -> dict[str, dict]:
    ads: dict[str, dict] = {}
    path = OUT_DIR / STORE
    if path.exists():
        for n, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
            try:
                ad = json.loads(line)
                ads[ad["token"]] = ad
            except (json.JSONDecodeError, KeyError):
                log(f"{STORE} line {n} is broken; ignored", "WARNING")
    return ads


def append(ad: dict) -> None:
    with open(OUT_DIR / STORE, "a", encoding="utf-8") as f:
        f.write(json.dumps(ad, ensure_ascii=False) + "\n")


REQUIRED = ("token", "url", "title", "crawled_at")


def write_snapshot(ads: dict[str, dict]) -> None:
    """Validate (non-empty, required keys) and write the local snapshot atomically."""
    rows = sorted(ads.values(), key=lambda a: a["crawled_at"], reverse=True)
    if not rows:
        log("nothing collected yet; snapshot not written", "WARNING")
        return
    broken = {a.get("token", "?") for a in rows if any(not a.get(k) for k in REQUIRED)}
    if broken:
        log(f"{len(broken)} ads miss a required field ({', '.join(list(broken)[:5])}…); left out", "WARNING")
        rows = [a for a in rows if a.get("token") not in broken]
    tmp = OUT_DIR / (SNAPSHOT + ".tmp")
    tmp.write_text(json.dumps(rows, ensure_ascii=False, indent=1), encoding="utf-8")
    os.replace(tmp, OUT_DIR / SNAPSHOT)
    by_cat: dict[str, int] = {}
    for a in rows:
        by_cat[a.get("category", "?")] = by_cat.get(a.get("category", "?"), 0) + 1
    log(f"snapshot {SNAPSHOT}: {len(rows)} ads ({', '.join(f'{k} {v}' for k, v in sorted(by_cat.items()))})")


# =============================================================================
# CRAWL
# =============================================================================
def crawl_one(ads: dict[str, dict], city_id: str, category: str, pages: int, max_new: int) -> list[dict]:
    """Newest-first pages of one city × category; fetches up to max_new ads not in the store yet.
    Keeps paging past ads it already has, so each pass reaches further back (backfill)."""
    got: list[dict] = []
    pagination = None
    for page_no in range(1, pages + 1):
        page = http("POST", SEARCH_PATH, search_body(city_id, category, pagination))
        cards = cards_of(page or {})
        fresh = [c for c in cards if c["token"] not in ads]
        log(f"  {category} page {page_no}: {len(cards)} ads, {len(fresh)} new")
        if not cards:
            if page_no == 1:
                log(f"  no ads at all for {category} — wrong slug or Divar's answer changed; run --probe", "WARNING")
            break
        for card in fresh:
            if len(got) >= max_new:
                break
            pause()
            post = http("GET", POST_PATH.format(token=card["token"]))
            if post is None:
                continue  # removed meanwhile
            ad = parse_post(card["token"], post, card, city_id, category)
            if not got and ad["meta"].get("cat_2") and ad["meta"]["cat_2"] != category:
                log(f"  asked Divar for {category}, got cat_2={ad['meta']['cat_2']} — check the slug", "WARNING")
            ads[ad["token"]] = ad
            append(ad)
            got.append(ad)
        pagination = next_pagination(page)
        if len(got) >= max_new or not pagination:
            break
        pause(PAGE_DELAY_S)
    return got


def crawl_pass(city_ids: list[str], categories: list[str], pages: int, max_new: int) -> list[dict]:
    ads = load_store()
    log(f"pass start: cities {','.join(city_ids)} · {', '.join(categories)} · {len(ads)} ads already stored")
    got: list[dict] = []
    try:
        robots_allow([SEARCH_PATH, POST_PATH.format(token="x")])
        for city_id in city_ids:
            for category in categories:
                got += crawl_one(ads, city_id, category, pages, max_new)
    except Blocked as e:
        log(str(e), "ERROR")
    finally:
        write_snapshot(ads)
    log(f"pass done: {len(got)} new ads, {len(ads)} stored")
    return got


def refetch() -> None:
    """Re-read every stored ad with the current parser (e.g. after a parser fix). Removed ads are dropped."""
    ads = load_store()
    log(f"refetch: {len(ads)} stored ads")
    fresh: dict[str, dict] = {}
    removed: set[str] = set()
    try:
        robots_allow([POST_PATH.format(token="x")])
        for n, (token, old) in enumerate(ads.items(), 1):
            pause()
            post = http("GET", POST_PATH.format(token=token))
            if post is None:
                log(f"{token} was removed from Divar; dropped")
                removed.add(token)
                continue
            card = {"token": token, **old.get("card", {})}
            fresh[token] = parse_post(token, post, card, old.get("city_id", ""), old.get("category", ""))
            if n % 25 == 0:
                log(f"refetch: {n}/{len(ads)}")
    except Blocked as e:
        log(f"{e}; ads not refetched keep their old version", "ERROR")
    merged = {t: fresh.get(t, a) for t, a in ads.items() if t not in removed}
    tmp = OUT_DIR / (STORE + ".tmp")
    tmp.write_text("".join(json.dumps(a, ensure_ascii=False) + "\n" for a in merged.values()), encoding="utf-8")
    os.replace(tmp, OUT_DIR / STORE)
    write_snapshot(merged)
    log(f"refetch done: {len(fresh)} refreshed, {len(merged)} stored")


def probe(city_id: str, category: str) -> None:
    """Save one raw search page and one raw ad, to fix the parser if Divar's answers changed."""
    d = OUT_DIR / "probe"
    d.mkdir(parents=True, exist_ok=True)
    page = http("POST", SEARCH_PATH, search_body(city_id, category, None))
    (d / f"search-{category}.json").write_text(json.dumps(page, ensure_ascii=False, indent=1), encoding="utf-8")
    cards = cards_of(page or {})
    log(f"probe {category}: search page saved, {len(cards)} ads recognised")
    if cards:
        pause()
        post = http("GET", POST_PATH.format(token=cards[0]["token"]))
        (d / f"post-{category}.json").write_text(json.dumps(post, ensure_ascii=False, indent=1), encoding="utf-8")
        ad = parse_post(cards[0]["token"], post or {}, cards[0], city_id, category)
        (d / f"parsed-{category}.json").write_text(json.dumps(ad, ensure_ascii=False, indent=1), encoding="utf-8")
        log(f"probe {category}: ad {cards[0]['token']} saved; fields read: {', '.join(ad['fields']) or 'none'}")
    log(f"probe files in {d} (raw answers may contain seller names — send them to Claude only, don't commit)")


# =============================================================================
# PUSH (data branch) — the GitHub Action on `main` takes it from there
# =============================================================================
DATA_README = """# divar-data

Real Divar ads collected by `scripts/divar_crawler.py --push` (see `main`), one JSON object per line in
`crawl/<date>.jsonl`, appended as they are crawled (a later line for the same token wins). Contact data,
agency names and Divar business ids are removed before anything is committed here.

The `Import Divar crawl` workflow on `main` normalizes these into `src/data/divar.json` every 30 minutes.
Nothing here is served directly. Do not edit by hand.
"""


def git(*args: str, cwd: Optional[Path] = None, check: bool = True) -> str:
    r = subprocess.run(["git", *args], cwd=cwd or REPO, capture_output=True, text=True)
    if check and r.returncode != 0:
        raise RuntimeError(f"git {' '.join(args)}: {r.stderr.strip() or r.stdout.strip()}")
    return r.stdout


def ensure_worktree() -> None:
    """A git worktree of `divar-data` in .crawl-data/ (created as an orphan branch the first time)."""
    if (WORKTREE / ".git").exists():
        if git("ls-remote", "--heads", "origin", DATA_BRANCH, check=False).strip():
            git("pull", "--rebase", "--quiet", "origin", DATA_BRANCH, cwd=WORKTREE, check=False)
        return
    git("worktree", "prune", check=False)
    if git("ls-remote", "--heads", "origin", DATA_BRANCH, check=False).strip():
        git("fetch", "--quiet", "origin", DATA_BRANCH)
        git("worktree", "add", "--force", "-B", DATA_BRANCH, str(WORKTREE), f"origin/{DATA_BRANCH}")
        return
    git("worktree", "add", "--force", "--detach", str(WORKTREE))
    git("checkout", "--quiet", "--orphan", DATA_BRANCH, cwd=WORKTREE)
    git("rm", "-r", "-f", "--quiet", ".", cwd=WORKTREE, check=False)
    (WORKTREE / "README.md").write_text(DATA_README, encoding="utf-8")
    # No Vercel builds for this branch (it's data, not the app).
    (WORKTREE / "vercel.json").write_text('{ "git": { "deploymentEnabled": false } }\n', encoding="utf-8")


def push(store: dict[str, dict]) -> None:
    """Append every stored ad version not yet on the data branch to today's shard, commit, push."""
    try:
        ensure_worktree()
        shard_dir = WORKTREE / "crawl"
        shard_dir.mkdir(exist_ok=True)
        published: set[tuple[str, str]] = set()
        for shard in shard_dir.glob("*.jsonl"):
            for line in shard.read_text(encoding="utf-8").splitlines():
                try:
                    a = json.loads(line)
                    published.add((a["token"], a["crawled_at"]))
                except (json.JSONDecodeError, KeyError):
                    pass
        todo = sorted(
            (sanitize(a) for a in store.values() if (a["token"], a["crawled_at"]) not in published),
            key=lambda a: a["crawled_at"],
        )
        if todo:
            with open(shard_dir / f"{date.today():%Y-%m-%d}.jsonl", "a", encoding="utf-8") as f:
                f.writelines(json.dumps(a, ensure_ascii=False) + "\n" for a in todo)
            git("add", "-A", cwd=WORKTREE)
            cats = sorted({a.get("category", "?") for a in todo})
            git("commit", "--quiet", "-m", f"data: +{len(todo)} Divar ads ({', '.join(cats)})", cwd=WORKTREE)
        # Push every time: an earlier commit may not have made it out (offline). No-op when up to date.
        if git("rev-parse", "--verify", "--quiet", "HEAD", cwd=WORKTREE, check=False).strip():
            git("push", "--quiet", "-u", "origin", DATA_BRANCH, cwd=WORKTREE)
        log(f"push: {len(todo)} ads → branch {DATA_BRANCH}" if todo else f"push: nothing new for {DATA_BRANCH}")
    except (RuntimeError, OSError) as e:
        log(f"push failed ({e}); the ads stay in {STORE} and go out with the next push", "ERROR")


# =============================================================================
# SCHEDULE (launchd on macOS, cron on Linux, Task Scheduler on Windows)
# =============================================================================
def install_schedule(minutes: int, extra: list[str]) -> None:
    cmd = [sys.executable, str(Path(__file__).resolve()), "--push", *extra]
    system = platform.system()
    sched_log = OUT_DIR / "schedule.log"
    if system == "Darwin":
        plist = Path.home() / "Library" / "LaunchAgents" / f"{SCHEDULE_NAME}.plist"
        plist.parent.mkdir(parents=True, exist_ok=True)
        args_xml = "".join(f"<string>{a}</string>" for a in cmd)
        plist.write_text(f"""<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>{SCHEDULE_NAME}</string>
  <key>ProgramArguments</key><array>{args_xml}</array>
  <key>WorkingDirectory</key><string>{REPO}</string>
  <key>StartInterval</key><integer>{minutes * 60}</integer>
  <key>RunAtLoad</key><true/>
  <key>EnvironmentVariables</key><dict><key>PATH</key><string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string></dict>
  <key>StandardOutPath</key><string>{sched_log}</string>
  <key>StandardErrorPath</key><string>{sched_log}</string>
</dict></plist>
""", encoding="utf-8")
        subprocess.run(["launchctl", "unload", str(plist)], capture_output=True)
        subprocess.run(["launchctl", "load", "-w", str(plist)], check=True)
        print(f"installed: launchd job {SCHEDULE_NAME}, every {minutes} min (first run starts now). Log: {sched_log}")
    elif system == "Windows":
        tr = subprocess.list2cmdline(cmd)
        subprocess.run(["schtasks", "/Create", "/F", "/SC", "MINUTE", "/MO", str(minutes), "/TN", "HomerobDivarCrawler", "/TR", tr], check=True)
        print(f"installed: Task Scheduler task HomerobDivarCrawler, every {minutes} min. Log: {OUT_DIR / LOG}")
    else:
        line = (
            f"*/{minutes} * * * * cd {shlex.quote(str(REPO))} && {' '.join(shlex.quote(a) for a in cmd)}"
            f" >> {shlex.quote(str(sched_log))} 2>&1 # {SCHEDULE_NAME}"
        )
        current = subprocess.run(["crontab", "-l"], capture_output=True, text=True).stdout
        kept = [x for x in current.splitlines() if SCHEDULE_NAME not in x]
        subprocess.run(["crontab", "-"], input="\n".join([*kept, line]) + "\n", text=True, check=True)
        print(f"installed: cron line, every {minutes} min. Log: {sched_log}")


def uninstall_schedule() -> None:
    system = platform.system()
    if system == "Darwin":
        plist = Path.home() / "Library" / "LaunchAgents" / f"{SCHEDULE_NAME}.plist"
        subprocess.run(["launchctl", "unload", "-w", str(plist)], capture_output=True)
        plist.unlink(missing_ok=True)
    elif system == "Windows":
        subprocess.run(["schtasks", "/Delete", "/F", "/TN", "HomerobDivarCrawler"], capture_output=True)
    else:
        current = subprocess.run(["crontab", "-l"], capture_output=True, text=True).stdout
        kept = [x for x in current.splitlines() if SCHEDULE_NAME not in x]
        subprocess.run(["crontab", "-"], input="\n".join(kept) + "\n", text=True, check=True)
    print("schedule removed")


# =============================================================================
# MAIN
# =============================================================================
def take_lock() -> bool:
    """One crawler at a time (the scheduler may fire while a long pass is still running)."""
    lock = OUT_DIR / LOCK
    try:
        if lock.exists() and time.time() - lock.stat().st_mtime < LOCK_STALE_S:
            return False
    except OSError:
        pass
    lock.write_text(str(os.getpid()), encoding="utf-8")
    return True


def main() -> None:
    global API, OUT_DIR, DELAY_S, PAGE_DELAY_S, WORKTREE
    ap = argparse.ArgumentParser(description="Crawl newest Divar real-estate ads (run from Iran).")
    ap.add_argument("--cities", "--city", default="mashhad", help="comma-separated Divar city slugs or ids (default: mashhad)")
    ap.add_argument("--categories", "--category", default=DEFAULT_CATEGORIES,
                    help=f"comma-separated: {', '.join(CATEGORIES)} or Divar slugs (default: the four rent/sale ones)")
    ap.add_argument("--pages", type=int, default=30, help="max search pages per city × category per pass (≈24 ads each; default 30)")
    ap.add_argument("--max-new", type=int, default=60, help="max new ads fetched per city × category per pass (default 60)")
    ap.add_argument("--push", action="store_true", help="publish new ads to the divar-data branch after the pass")
    ap.add_argument("--every", type=float, default=0, help="repeat every N minutes in this terminal (default: run once)")
    ap.add_argument("--install-schedule", type=int, metavar="MINUTES",
                    help="run `--push` every N minutes via the OS scheduler, with the other options given")
    ap.add_argument("--uninstall-schedule", action="store_true", help="remove that schedule")
    ap.add_argument("--probe", action="store_true", help="save one raw search page + ad per category to data/raw/probe/ and exit")
    ap.add_argument("--refetch", action="store_true", help="re-read every stored ad with the current parser")
    # Tests point these at a local mock server and temp folders.
    ap.add_argument("--api", default=API, help=argparse.SUPPRESS)
    ap.add_argument("--out", default=str(OUT_DIR), help=argparse.SUPPRESS)
    ap.add_argument("--worktree", default=str(WORKTREE), help=argparse.SUPPRESS)
    ap.add_argument("--delay", type=float, default=None, help=argparse.SUPPRESS)
    args = ap.parse_args()

    API = args.api.rstrip("/")
    OUT_DIR = Path(args.out)
    WORKTREE = Path(args.worktree)
    if args.delay is not None:
        DELAY_S = PAGE_DELAY_S = (args.delay, args.delay)
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    if args.uninstall_schedule:
        uninstall_schedule()
        return
    if args.install_schedule:
        passthrough = [f"--cities={args.cities}", f"--categories={args.categories}", f"--pages={args.pages}", f"--max-new={args.max_new}"]
        install_schedule(args.install_schedule, passthrough)
        return

    categories = [CATEGORIES.get(c.strip(), c.strip()) for c in args.categories.split(",") if c.strip()]
    city_ids = [resolve_city(c.strip()) for c in args.cities.split(",") if c.strip()]
    if args.probe:
        for category in categories:
            probe(city_ids[0], category)
        return

    if not take_lock():
        log("another crawler run is still going (data/raw/divar-crawl.lock); skipping this one")
        return
    try:
        while True:
            if args.refetch:
                refetch()
            else:
                crawl_pass(city_ids, categories, args.pages, args.max_new)
            if args.push:
                push(load_store())
            if not args.every or args.refetch:
                break
            wake = time.time() + args.every * 60
            log(f"next pass at {datetime.fromtimestamp(wake):%H:%M} (Ctrl+C to stop)")
            time.sleep(max(0, wake - time.time()))
            (OUT_DIR / LOCK).touch()
    finally:
        (OUT_DIR / LOCK).unlink(missing_ok=True)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nstopped. Everything fetched so far is in data/raw/divar-crawl.jsonl.")
