#!/usr/bin/env python3
"""
Homerob — Divar crawler (run locally, from inside Iran).

Collects real Divar real-estate ads (default: residential rentals in Mashhad), newest first, and
writes them to data/raw/ so the owner can upload the file and `npm run import:divar-crawl` can
clean them into src/data/divar.json.

Routing (universal-scraping-architect): Mode 2, local Python. Divar is reachable only from Iranian
IPs, so a hosted crawler (Firecrawl, a cloud sandbox) can't see it; the owner runs this on their own
machine. It talks to the same public JSON API that divar.ir's web app calls (no login, no key), so no
HTML selectors to break. Standard library only — nothing to pip install. Python 3.9+.

    python3 scripts/divar_crawler.py                       # one pass: Mashhad, residential rent
    python3 scripts/divar_crawler.py --every 30            # repeat every 30 minutes (Ctrl+C stops)
    python3 scripts/divar_crawler.py --city tehran --pages 5 --max-new 100
    python3 scripts/divar_crawler.py --probe               # save raw API answers for debugging

Output (data/raw/ is gitignored):
    data/raw/divar-crawl.jsonl   working store, one ad per line, appended as each ad is fetched
                                 (checkpoint: a re-run or the next pass skips ads already in it)
    data/raw/divar-crawl.json    the same ads as one validated JSON array — upload this one
    data/raw/divar-crawl.log     run log

Etiquette and privacy:
- robots.txt of the API host is checked before every pass; a disallowed path stops the crawler.
- One request at a time with a 3–6 s random pause, exponential backoff on 429/5xx, stop on 403.
- Never calls the contact endpoint: no phone numbers. Phone-like numbers inside descriptions are
  masked, and seller / agency / chat widgets are dropped.
"""

from __future__ import annotations

import argparse
import json
import os
import random
import re
import sys
import time
import urllib.error
import urllib.request
import urllib.robotparser
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterator, Optional

# =============================================================================
# CONFIG
# =============================================================================
API = "https://api.divar.ir"
SEARCH_PATH = "/v8/postlist/w/search"
POST_PATH = "/v8/posts-v2/web/{token}"
CITIES_PATH = "/v8/places/cities"

OUT_DIR = Path(__file__).resolve().parent.parent / "data" / "raw"
STORE = "divar-crawl.jsonl"
SNAPSHOT = "divar-crawl.json"
LOG = "divar-crawl.log"
SCHEMA = "homerob-divar-crawl/1"

USER_AGENT = "HomerobCrawler/0.1 (+https://homerob.vercel.app; small demo dataset, polite rate)"
TIMEOUT_S = 20
MAX_RETRIES = 4
DELAY_S = (3.0, 6.0)

# Divar city ids (fallback when /places/cities can't be read). A number works too: --city 3.
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

# Widgets that are about the seller, not the home (never stored).
PERSONAL_WIDGET = re.compile(r"CONTACT|CHAT|BUSINESS|AGENCY|SELLER|USER|PROFILE|CALL", re.I)
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


def pause() -> None:
    time.sleep(random.uniform(*DELAY_S))


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


def strip_personal(node: Any) -> Any:
    """Copy of the tree without seller / contact widgets (and everything inside them)."""
    if isinstance(node, dict):
        if PERSONAL_WIDGET.search(text(node.get("widget_type"))):
            return None
        return {k: strip_personal(v) for k, v in node.items()}
    if isinstance(node, list):
        return [x for x in (strip_personal(v) for v in node) if x is not None]
    return node


def text(v: Any) -> str:
    return v.strip() if isinstance(v, str) else ""


def mask_phones(s: str) -> str:
    return PHONE.sub("[شماره حذف شد]", s)


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
            "bottom": text(d.get("bottom_description_text")),
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
                fields[t] = mask_phones(v)
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
                rows.append([wtype, t, mask_phones(v)])

    seo = post.get("seo") if isinstance(post.get("seo"), dict) else {}
    web = seo.get("web_info") if isinstance(seo.get("web_info"), dict) else {}
    engage = post.get("webengage") if isinstance(post.get("webengage"), dict) else {}
    meta = {k: v for k, v in engage.items() if isinstance(v, (str, int, float, bool))}

    return {
        "schema": SCHEMA,
        "token": token,
        "url": f"https://divar.ir/v/{token}",
        "crawled_at": now_iso(),
        "city_id": city_id,
        "category": category,
        "title": title or text(web.get("title")) or card.get("title", ""),
        "subtitle": subtitle,  # "۲ ساعت پیش در مشهد، وکیل‌آباد"
        "city": text(web.get("city_persian")) or card.get("city", ""),
        "district": text(web.get("district_persian")) or card.get("district", ""),
        "description": mask_phones("\n\n".join(texts)),
        "published": published,  # "انتشار آگهی: ۳۰ شهریور ۱۴۰۵، ۱۷:۲۱\nآخرین نردبان: …"
        "fields": fields,  # {"متراژ": "۸۵", "ساخت": "۱۳۹۵", "اتاق": "دو", "ودیعه": "…", "طبقه": "۲ از ۴", …}
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
    }


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
    """Validate (non-empty, required keys, no duplicates) and write the upload file atomically."""
    rows = sorted(ads.values(), key=lambda a: a["crawled_at"], reverse=True)
    if not rows:
        log("nothing collected yet; snapshot not written", "WARNING")
        return
    broken = [a.get("token", "?") for a in rows if any(not a.get(k) for k in REQUIRED)]
    if broken:
        log(f"{len(broken)} ads miss a required field ({', '.join(broken[:5])}…); left out", "WARNING")
        rows = [a for a in rows if a.get("token") not in set(broken)]
    tmp = OUT_DIR / (SNAPSHOT + ".tmp")
    tmp.write_text(json.dumps(rows, ensure_ascii=False, indent=1), encoding="utf-8")
    os.replace(tmp, OUT_DIR / SNAPSHOT)

    def share(pred) -> str:
        return f"{sum(1 for a in rows if pred(a))}/{len(rows)}"

    log(
        f"snapshot {SNAPSHOT}: {len(rows)} ads · with area {share(lambda a: 'متراژ' in a['fields'])}"
        f" · deposit {share(lambda a: any('ودیعه' in k for k in a['fields']))}"
        f" · district {share(lambda a: a['district'])} · map point {share(lambda a: a['lat'] is not None)}"
        f" · description {share(lambda a: a['description'])}"
    )


# =============================================================================
# CRAWL
# =============================================================================
def crawl_pass(city_id: str, category: str, pages: int, max_new: int) -> int:
    ads = load_store()
    log(f"pass start: city {city_id}, category {category}, {len(ads)} ads already stored")
    robots_allow([SEARCH_PATH, POST_PATH.format(token="x")])
    new, pagination, stale_pages = 0, None, 0
    try:
        for page_no in range(1, pages + 1):
            page = http("POST", SEARCH_PATH, search_body(city_id, category, pagination))
            cards = cards_of(page or {})
            fresh = [c for c in cards if c["token"] not in ads]
            log(f"page {page_no}: {len(cards)} ads, {len(fresh)} new")
            if not cards:
                log("no ads on this page — Divar's answer may have changed; run --probe", "WARNING")
                break
            for card in fresh:
                if new >= max_new:
                    break
                pause()
                post = http("GET", POST_PATH.format(token=card["token"]))
                if post is None:
                    continue  # removed meanwhile
                ad = parse_post(card["token"], post, card, city_id, category)
                ads[ad["token"]] = ad
                append(ad)
                new += 1
            # Newest first: two pages in a row with nothing new = we caught up with the last pass.
            stale_pages = stale_pages + 1 if not fresh else 0
            pagination = next_pagination(page)
            if new >= max_new or stale_pages >= 2 or not pagination:
                break
            pause()
    except Blocked as e:
        log(str(e), "ERROR")
    finally:
        write_snapshot(ads)
    log(f"pass done: {new} new ads, {len(ads)} total")
    return new


def refetch() -> None:
    """Re-read every stored ad with the current parser (e.g. after a parser fix). Removed ads are dropped."""
    ads = load_store()
    log(f"refetch: {len(ads)} stored ads")
    robots_allow([POST_PATH.format(token="x")])
    fresh: dict[str, dict] = {}
    removed: set[str] = set()
    try:
        for n, (token, old) in enumerate(ads.items(), 1):
            pause()
            post = http("GET", POST_PATH.format(token=token))
            if post is None:
                log(f"{token} was removed from Divar; dropped")
                removed.add(token)
                continue
            fresh[token] = parse_post(token, post, {"token": token, **old.get("card", {})}, old.get("city_id", ""), old.get("category", ""))
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
    (d / "search.json").write_text(json.dumps(page, ensure_ascii=False, indent=1), encoding="utf-8")
    cards = cards_of(page or {})
    log(f"probe: search page saved, {len(cards)} ads recognised")
    if cards:
        pause()
        post = http("GET", POST_PATH.format(token=cards[0]["token"]))
        (d / "post.json").write_text(json.dumps(post, ensure_ascii=False, indent=1), encoding="utf-8")
        ad = parse_post(cards[0]["token"], post or {}, cards[0], city_id, category)
        (d / "parsed.json").write_text(json.dumps(ad, ensure_ascii=False, indent=1), encoding="utf-8")
        log(f"probe: ad {cards[0]['token']} saved; fields read: {', '.join(ad['fields']) or 'none'}")
    log(f"probe files in {d} (they may contain seller names — send them to Claude only, don't commit)")


def main() -> None:
    global API, OUT_DIR, DELAY_S
    ap = argparse.ArgumentParser(description="Crawl newest Divar real-estate ads into data/raw/ (run from Iran).")
    ap.add_argument("--city", default="mashhad", help="Divar city slug or id (default: mashhad)")
    ap.add_argument("--category", default="residential-rent",
                    help=f"{', '.join(CATEGORIES)} or a Divar slug (default: residential-rent)")
    ap.add_argument("--pages", type=int, default=10, help="max search pages per pass (≈24 ads each; default 10)")
    ap.add_argument("--max-new", type=int, default=150, help="max new ads fetched per pass (default 150)")
    ap.add_argument("--every", type=float, default=0, help="repeat every N minutes (default: run once)")
    ap.add_argument("--probe", action="store_true", help="save one raw search page + ad to data/raw/probe/ and exit")
    ap.add_argument("--refetch", action="store_true", help="re-read every stored ad with the current parser and exit")
    # Tests point these at a local mock server and a temp folder.
    ap.add_argument("--api", default=API, help=argparse.SUPPRESS)
    ap.add_argument("--out", default=str(OUT_DIR), help=argparse.SUPPRESS)
    ap.add_argument("--delay", type=float, default=None, help=argparse.SUPPRESS)
    args = ap.parse_args()

    API = args.api.rstrip("/")
    OUT_DIR = Path(args.out)
    if args.delay is not None:
        DELAY_S = (args.delay, args.delay)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    category = CATEGORIES.get(args.category, args.category)
    city_id = resolve_city(args.city)

    if args.probe:
        probe(city_id, category)
        return
    if args.refetch:
        refetch()
        return
    while True:
        crawl_pass(city_id, category, args.pages, args.max_new)
        if not args.every:
            break
        wake = time.time() + args.every * 60
        log(f"next pass at {datetime.fromtimestamp(wake):%H:%M} (Ctrl+C to stop)")
        time.sleep(max(0, wake - time.time()))


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nstopped. Everything fetched so far is in data/raw/divar-crawl.jsonl (and .json).")
