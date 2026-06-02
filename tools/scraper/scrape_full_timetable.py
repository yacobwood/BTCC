#!/usr/bin/env python3
"""
BTCC Full Timetable Scraper — scrapes support series timetables from btcc.net circuit pages.
Populates fullTimetable in data/calendar.json for each round.

Usage:
    python scrape_full_timetable.py [--dry-run] [--round N]
"""

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Optional

try:
    from playwright.sync_api import sync_playwright
except ImportError:
    print("Install playwright: pip install playwright && playwright install chromium", file=sys.stderr)
    sys.exit(1)

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"
CALENDAR_JSON = DATA_DIR / "calendar.json"

# Map calendar.json venue names to btcc.net circuit URL slugs
VENUE_SLUG = {
    "Donington Park":    "donington-park",
    "Donington Park GP": "donington-park",
    "Brands Hatch Indy": "brands-hatch",
    "Brands Hatch GP":   "brands-hatch",
    "Snetterton":        "snetterton",
    "Oulton Park":       "oulton-park",
    "Thruxton":          "thruxton",
    "Knockhill":         "knockhill",
    "Croft":             "croft",
    "Silverstone":       "silverstone",
}

# Series name fragments that identify BTCC rows (for normalisation only — stored as-is)
_BTCC_MARKERS = ("british touring car",)

# Non-series events that have no championship column
_NULL_SERIES = {"", "-", "—", "–"}

# Keywords that identify a motorsport series name (used to classify 3-column rows)
_SERIES_MARKERS = (
    "championship", "challenge", "touring cars", "touring car",
    "cup", "series", "trophy", "legends", "mini challenge",
)


def looks_like_series(text: str) -> bool:
    """Return True if text reads like a championship/series name rather than an event description."""
    lower = text.lower()
    return any(marker in lower for marker in _SERIES_MARKERS)


def parse_time(raw: str) -> tuple:
    """Return (startTime, endTime) from '09:00 – 09:10' or '11:40'."""
    raw = raw.strip()
    m = re.match(r"(\d{1,2}:\d{2})\s*[–\-]\s*(\d{1,2}:\d{2})", raw)
    if m:
        t1 = m.group(1).zfill(5)
        t2 = m.group(2).zfill(5)
        return t1, t2
    m = re.match(r"(\d{1,2}:\d{2})", raw)
    if m:
        return m.group(1).zfill(5), None
    return None, None


def parse_laps(raw: str) -> Optional[str]:
    raw = raw.strip()
    if not raw or raw in ("-", "—", "–"):
        return None
    return raw


def scrape_circuit_timetable(page, slug: str) -> list[dict]:
    url = f"https://btcc.net/circuit/{slug}/"
    print(f"    Fetching {url} …")
    try:
        page.goto(url, wait_until="networkidle", timeout=30_000)
        page.wait_for_timeout(2_000)
    except Exception as e:
        print(f"    Failed to load {url}: {e}", file=sys.stderr)
        return []

    # Extract raw rows via JavaScript DOM walk.
    # btcc.net circuit pages have day headings (h2/h3/p containing "Saturday"/"Sunday")
    # followed by <table> elements with timetable rows.
    #
    # Saturday tables have 4 columns: Time | Activity | Championship | Laps
    # Sunday tables may have 3 columns: Time | Championship/Activity | Laps
    # Some non-series rows (Lunch Break, Pit Lane Opens) have a blank championship column.
    raw_rows = page.evaluate("""() => {
        const result = [];
        const dayRe = /\\b(saturday|sunday)\\b/i;
        let currentDay = null;

        // Traverse the full body to track day headings then tables in document order
        function walk(el) {
            const tag = (el.tagName || '').toLowerCase();

            // Day heading detection: small elements whose text is predominantly a day name
            if (['h1','h2','h3','h4','h5','p','div','span','strong','b'].includes(tag)) {
                const text = (el.textContent || '').replace(/\\s+/g, ' ').trim();
                if (text.length < 80 && dayRe.test(text)) {
                    currentDay = /saturday/i.test(text) ? 'SAT' : 'SUN';
                }
            }

            if (tag === 'table' && currentDay) {
                const rows = Array.from(el.querySelectorAll('tbody tr'));
                rows.forEach(tr => {
                    const cells = Array.from(tr.querySelectorAll('td, th'))
                        .map(td => td.textContent.replace(/\\s+/g, ' ').trim());
                    if (cells.length >= 2) {
                        result.push({ day: currentDay, cells });
                    }
                });
                return; // don't recurse into table children for day heading
            }

            for (const child of el.children) {
                walk(child);
            }
        }

        walk(document.body);
        return result;
    }""")

    entries = []
    for row in raw_rows:
        cells = row["cells"]
        day = row["day"]

        # Determine column layout by count
        if len(cells) == 4:
            # Time | Activity | Championship | Laps
            raw_time, session, series_raw, raw_laps = cells[0], cells[1], cells[2], cells[3]
        elif len(cells) == 3:
            # Time | Activity-or-Championship | Laps
            # If the middle cell looks like a series name, treat it as series (session = "Race").
            # Otherwise it's a non-series event (Pit Lane Opens, Lunch Break, etc.).
            raw_time, mid, raw_laps = cells[0], cells[1], cells[2]
            if looks_like_series(mid):
                session, series_raw = "Race", mid
            else:
                session, series_raw = mid, ""
        else:
            continue

        start, end = parse_time(raw_time)
        if not start:
            continue

        session = session.strip()
        if not session or session in ("-", "—"):
            continue

        series_raw = series_raw.strip()
        series = None if series_raw in _NULL_SERIES else series_raw

        laps = parse_laps(raw_laps)

        entry: dict = {"day": day, "time": start}
        if end:
            entry["endTime"] = end
        entry["series"] = series
        entry["session"] = session
        entry["laps"] = laps

        entries.append(entry)

    # Deduplicate: btcc.net sometimes repeats rows if they appear in multiple DOM sections
    seen = set()
    deduped = []
    for e in entries:
        key = (e["day"], e["time"], e.get("series"), e["session"])
        if key not in seen:
            seen.add(key)
            deduped.append(e)

    return deduped


def main():
    ap = argparse.ArgumentParser(
        description="Scrape full weekend timetables from btcc.net circuit pages into data/calendar.json"
    )
    ap.add_argument("--dry-run", action="store_true", help="Print results only, do not write")
    ap.add_argument("--round", type=int, default=None, help="Only scrape a specific round number")
    args = ap.parse_args()

    with open(CALENDAR_JSON) as f:
        data = json.load(f)

    rounds = data.get("rounds", [])
    updated = 0

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        page = browser.new_page()

        for r in rounds:
            if args.round and r["round"] != args.round:
                continue

            venue = r.get("venue", "")
            slug = VENUE_SLUG.get(venue)
            if not slug:
                print(f"Round {r['round']} ({venue}): no slug mapping — skipping")
                continue

            print(f"Round {r['round']} — {venue}")
            entries = scrape_circuit_timetable(page, slug)

            if not entries:
                print(f"    No timetable found — leaving existing data unchanged")
                continue

            sat = sum(1 for e in entries if e["day"] == "SAT")
            sun = sum(1 for e in entries if e["day"] == "SUN")
            print(f"    {len(entries)} entries  (Sat: {sat}  Sun: {sun})")
            for e in entries:
                laps_str = f"  [{e['laps']}]" if e["laps"] else ""
                end_str = f" – {e['endTime']}" if e.get("endTime") else ""
                series_str = e["series"] or "(event)"
                print(f"      {e['day']}  {e['time']}{end_str}  {series_str} — {e['session']}{laps_str}")

            r["fullTimetable"] = entries
            updated += 1

        browser.close()

    if args.dry_run:
        print(f"\nDry run — {updated} round(s) would be updated.")
        return

    with open(CALENDAR_JSON, "w") as f:
        json.dump(data, f, indent=2)
    print(f"\nUpdated {updated} round(s) in {CALENDAR_JSON}")


if __name__ == "__main__":
    main()
