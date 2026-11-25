"""Fetch split-adjusted daily prices for every stock symbol used in data/people/*.json.

    python scripts/fetch_prices.py            # all symbols
    python scripts/fetch_prices.py NVDA TSLA  # only these

Writes data/prices/<SYM>.json as [[yyyymmdd, open, high, low, close], ...] and data/prices/index.json.
Price files are not committed to the repository: run this script (or let the GitHub Action run it)
to build them. Source: Yahoo Finance chart endpoint, daily bars, split-adjusted.
"""
import datetime
import json
import pathlib
import sys
import time
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
PEOPLE = ROOT / "data" / "people"
OUT = ROOT / "data" / "prices"
URL = "https://query1.finance.yahoo.com/v8/finance/chart/{sym}?period1=0&period2=9999999999&interval=1d"


def symbols():
    syms = set()
    for pid in json.loads((PEOPLE / "index.json").read_text(encoding="utf-8")):
        person = json.loads((PEOPLE / f"{pid}.json").read_text(encoding="utf-8"))
        for s in person.get("stocks", []):
            syms.add(s["sym"])
        if person.get("options"):
            syms.add(person["options"]["sym"])
    return sorted(syms)


def fetch(sym):
    req = urllib.request.Request(URL.format(sym=urllib.parse.quote(sym)), headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        result = json.load(resp)["chart"]["result"][0]
    quote = result["indicators"]["quote"][0]
    rows = []
    for i, ts in enumerate(result["timestamp"]):
        o, h, l, c = quote["open"][i], quote["high"][i], quote["low"][i], quote["close"][i]
        if None in (o, h, l, c) or c <= 0:
            continue
        day = datetime.datetime.fromtimestamp(ts, datetime.timezone.utc)
        rows.append([int(day.strftime("%Y%m%d")), round(o, 5), round(h, 5), round(l, 5), round(c, 5)])
    return rows


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    wanted = sys.argv[1:] or symbols()
    index = {}
    index_file = OUT / "index.json"
    if index_file.exists():
        index = json.loads(index_file.read_text(encoding="utf-8"))
    failed = []
    for sym in wanted:
        try:
            rows = fetch(sym)
        except Exception as err:  # keep going: one bad symbol should not block the rest
            print(f"{sym}: FAILED ({err})")
            failed.append(sym)
            continue
        (OUT / f"{sym}.json").write_text(json.dumps(rows, separators=(",", ":")), encoding="utf-8")
        index[sym] = {"rows": len(rows), "first": rows[0][0], "last": rows[-1][0]}
        print(f"{sym}: {len(rows)} rows, {rows[0][0]} -> {rows[-1][0]}, last close {rows[-1][4]}")
        time.sleep(0.5)
    index_file.write_text(json.dumps(index, indent=2) + "\n", encoding="utf-8")
    if failed:
        sys.exit(f"failed: {', '.join(failed)}")


if __name__ == "__main__":
    main()
