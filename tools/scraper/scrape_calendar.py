#!/usr/bin/env python3
"""
BTCC Calendar Scraper — race schedule from btcc.net/calendar/.
Parses round order, venue names, and date ranges, then merges them into
data/calendar.json (updating only dates and venues; keeps track guides, images, etc.).

Usage:
    python scrape_calendar.py [--season YEAR] [--dry-run]
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import re
import sys
from pathlib import Path

from curl_cffi import requests as cffi_requests

CALENDAR_URL = "https://btcc.net/calendar/"
DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"
CALENDAR_JSON = DATA_DIR / "calendar.json"
SCHEDULE_JSON = DATA_DIR / "calendar_schedule.json"

MONTH = {
    "jan": "01", "feb": "02", "mar": "03", "apr": "04", "may": "05", "jun": "06",
    "jul": "07", "aug": "08", "sep": "09", "oct": "10", "nov": "11", "dec": "12",
}

def _fetch(url: str) -> str:
    r = cffi_requests.get(url, impersonate="chrome120", timeout=15)
    r.raise_for_status()
    return r.text


def parse_date_range(text: str, year: int) -> tuple[str, str] | None:
    """Parse e.g. "18 Apr-19 Apr" or "18 Apr - 19 Apr" into (startDate, endDate) as ISO."""
    text = text.strip()
    m = re.match(r"(\d{1,2})\s*([A-Za-z]{3})\s*[-–]\s*(\d{1,2})\s*([A-Za-z]{3})", text)
    if not m:
        return None
    d1, mon1, d2, mon2 = m.groups()
    mon1 = mon1.lower()[:3]
    mon2 = mon2.lower()[:3]
    m1 = MONTH.get(mon1)
    m2 = MONTH.get(mon2)
    if not m1 or not m2:
        return None
    return (
        f"{year}-{m1}-{int(d1):02d}",
        f"{year}-{m2}-{int(d2):02d}",
    )


def scrape_calendar(year: int) -> list[dict] | None:
    """Fetch btcc.net/calendar/ and return list of {round, venue, startDate, endDate}, or None on fetch failure."""
    print(f"Fetching {CALENDAR_URL} …")
    try:
        html = _fetch(CALENDAR_URL)
    except Exception as e:
        print(f"WARNING: could not fetch calendar ({e}) — skipping update", file=sys.stderr)
        return None

    events = []
    # Each round is an <a href="https://btcc.net/circuit/..."> block.
    # Dates live in two ct-span elements inside circuitDatesText divs.
    # Venue is in a mainHeading text block.
    for block_m in re.finditer(
        r'<a\b[^>]*href="https://btcc\.net/circuit/([^"]+)"[^>]*>(.*?)</a>',
        html, re.DOTALL
    ):
        _slug, content = block_m.groups()

        date_spans = re.findall(r'class="ct-span"[^>]*>\s*(\d{1,2}\s+[A-Za-z]{3})\s*<', content)
        venue_m = re.search(r'mainHeading"[^>]*>.*?<span[^>]*>\s*([^<]+)\s*</span>', content, re.DOTALL)

        if len(date_spans) >= 2 and venue_m:
            d1, d2 = date_spans[0].strip(), date_spans[1].strip()
            venue = venue_m.group(1).strip()
            parsed = parse_date_range(f"{d1}-{d2}", year)
            if parsed:
                events.append({
                    "round": len(events) + 1,
                    "venue": venue,
                    "startDate": parsed[0],
                    "endDate": parsed[1],
                })

    return events


def merge_into_calendar(schedule: list[dict], dry_run: bool) -> None:
    """Update data/calendar.json rounds with schedule (dates + venue)."""
    if not CALENDAR_JSON.exists():
        print(f"{CALENDAR_JSON} not found — write schedule only to {SCHEDULE_JSON}", file=sys.stderr)
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        with open(SCHEDULE_JSON, "w") as f:
            json.dump({"season": schedule[0]["startDate"][:4], "rounds": schedule}, f, indent=2)
        print(f"Wrote {SCHEDULE_JSON}")
        return

    with open(CALENDAR_JSON) as f:
        data = json.load(f)

    rounds = data.get("rounds", [])
    if len(schedule) != len(rounds):
        print(
            f"Warning: scraped {len(schedule)} rounds, calendar has {len(rounds)}. "
            "Updating by index; extra rounds left unchanged.",
            file=sys.stderr,
        )

    for i, s in enumerate(schedule):
        if i < len(rounds):
            rounds[i]["startDate"] = s["startDate"]
            rounds[i]["endDate"] = s["endDate"]
            rounds[i]["venue"] = s["venue"]
            if "fullTimetable" in s:
                rounds[i]["fullTimetable"] = s["fullTimetable"]
            if not dry_run:
                ft_count = len(s.get("fullTimetable") or [])
                ft_str = f"  ({ft_count} timetable entries)" if ft_count else ""
                print(f"  Round {s['round']}: {s['venue']}  {s['startDate']} → {s['endDate']}{ft_str}")
        else:
            print(f"  Round {s['round']}: {s['venue']} (no existing slot, skipped)")

    if dry_run:
        print("Dry run — no file written.")
        return

    with open(CALENDAR_JSON, "w") as f:
        json.dump(data, f, indent=2)
    print(f"\nUpdated {min(len(schedule), len(rounds))} rounds in {CALENDAR_JSON}")


def main():
    ap = argparse.ArgumentParser(description="Scrape BTCC calendar and merge into data/calendar.json")
    ap.add_argument("--season", type=int, default=2026, help="Season year (default 2026)")
    ap.add_argument("--dry-run", action="store_true", help="Print updates only, do not write")
    args = ap.parse_args()

    _spec = importlib.util.spec_from_file_location(
        "scrape_full_timetable",
        Path(__file__).parent / "scrape_full_timetable.py",
    )
    _ft = importlib.util.module_from_spec(_spec)
    _spec.loader.exec_module(_ft)

    schedule = scrape_calendar(args.season)
    if schedule is None:
        sys.exit(0)
    if not schedule:
        print("WARNING: no calendar events parsed — page structure may have changed", file=sys.stderr)
        sys.exit(0)

    print(f"\nScraped {len(schedule)} rounds for {args.season}")
    for s in schedule:
        print(f"  {s['round']}. {s['venue']}  {s['startDate']} – {s['endDate']}")

    print("\nScraping full weekend timetables …")
    for s in schedule:
        slug = _ft.VENUE_SLUG.get(s["venue"])
        if not slug:
            continue
        entries = _ft.scrape_circuit_timetable(slug)
        if entries:
            s["fullTimetable"] = entries

    merge_into_calendar(schedule, args.dry_run)


if __name__ == "__main__":
    main()
