"""One-off price calibration via the hosted divar-mcp endpoint (owner decision, option 1).

Budget: 1 divar_suggest + 1 city-wide search + 6 per-neighborhood searches = 8 tool calls
(plus the MCP handshake). Like-for-like slice: 2-bedroom apartments, 70–130 m², Mashhad.
Only aggregates are written (medians of deposit, monthly rent and full-deposit equivalent per
neighborhood + sample sizes). No ad titles, tokens, links or photos are stored.

Already run once (2026-09-25, 18 calls); results are in data/real/calibration.json. Do not re-run
without the owner's OK. Note: district filters by name fail upstream (HTTP 400); the run used
query=<neighborhood> and kept cards whose district matched.
"""
import json
import statistics
import time
import urllib.request
from pathlib import Path

ENDPOINT = "https://divar-mcp.mmdju2.workers.dev/mcp"
RATE = 0.03  # keep in sync with MONTHLY_RATE in src/lib/pricing.ts
HOODS = {"وکیل‌آباد": "وکیل‌آباد", "سجاد": "بلوار سجاد", "احمدآباد": "احمدآباد", "هاشمیه": "هاشمیه",
         "قاسم‌آباد": "قاسم‌آباد (شهرک غرب)", "الهیه": "الهیه"}  # app name → Divar district label
SLICE = {"category": "apartment-rent", "city": "mashhad", "rooms": ["دو"],
         "min_size_sqm": 70, "max_size_sqm": 130, "pages": 3, "limit": 30}
PAUSE_S = 3  # stay far below the 60 req/min fair-use limit

_rid = 0


def rpc(method, params=None):
    global _rid
    _rid += 1
    body = json.dumps({"jsonrpc": "2.0", "id": _rid, "method": method, "params": params or {}}).encode()
    req = urllib.request.Request(ENDPOINT, data=body, method="POST", headers={
        "content-type": "application/json",
        "accept": "application/json, text/event-stream",
        "user-agent": "homerob-calibration/1.0",
    })
    with urllib.request.urlopen(req, timeout=60) as res:
        text = res.read().decode("utf-8", "replace")
    payload = next((l[5:].strip() for l in reversed(text.splitlines()) if l.startswith("data:")), text)
    return json.loads(payload) if payload else {}


def tool(name, args):
    time.sleep(PAUSE_S)
    out = rpc("tools/call", {"name": name, "arguments": args})
    if "error" in out:
        raise RuntimeError(f"{name}: {out['error']}")
    return json.loads(out["result"]["content"][0]["text"])


def summarize(items, district=None):
    rows = []
    seen = {}
    for c in items:
        seen[c.get("district")] = seen.get(c.get("district"), 0) + 1
        if district and (c.get("district") or "").replace("\u200c", "") != district.replace("\u200c", ""):
            continue
        if c.get("shared_housing") or c.get("price_is_placeholder") or c.get("deposit_is_placeholder"):
            continue
        dep, rent = c.get("deposit_toman"), c.get("price_toman")
        if dep is None and rent is None:
            continue
        dep, rent = dep or 0, rent or 0
        rows.append((dep, rent, dep + rent / RATE))
    if not rows:
        return {"n": 0, "districts_seen": seen}
    med = lambda i: round(statistics.median(r[i] for r in rows))
    return {"n": len(rows), "scanned": len(items), "median_deposit": med(0), "median_rent": med(1),
            "median_full_deposit": med(2), "districts_seen": dict(sorted(seen.items(), key=lambda kv: -kv[1])[:5])}


def main():
    rpc("initialize", {"protocolVersion": "2024-11-05", "capabilities": {},
                       "clientInfo": {"name": "homerob-calibration", "version": "1.0"}})
    rpc("notifications/initialized")


    result = {"slice": SLICE, "rate": RATE, "fetched_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
              "city": summarize(tool("search_ads", SLICE).get("items", [])), "neighborhoods": {}}
    for hood, label in HOODS.items():
        try:
            data = tool("search_ads", {**SLICE, "districts": [label]})
            agg = summarize(data.get("items", []), label)
            agg["filters_not_applied"] = data.get("filters_not_applied")
        except Exception as e:  # noqa: BLE001 — record and keep going
            agg = {"n": 0, "error": str(e)[:200]}
        result["neighborhoods"][hood] = agg
        print(hood, agg)

    Path(__file__).with_name("aggregates.json").write_text(json.dumps(result, ensure_ascii=False, indent=1))
    print("city", result["city"])


if __name__ == "__main__":
    main()
