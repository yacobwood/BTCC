#!/usr/bin/env python3
"""
BTCC Calendar Scraper — race schedule from btcc.net/calendar/.
Parses round order, venue names, and date ranges, then merges them into
data/calendar.json (updating only dates and venues; keeps track guides, images, etc.).

Usage:
    python scrape_calendar.py [--season YEAR] [--dry-run]
"""

import argparse
import json
import re
import sys
from pathlib import Path

try:
    from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout
except ImportError:
    print("Install playwright: pip install playwright && playwright install chromium", file=sys.stderr)
    sys.exit(1)

CALENDAR_URL = "https://btcc.net/calendar/"
DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"
CALENDAR_JSON = DATA_DIR / "calendar.json"
SCHEDULE_JSON = DATA_DIR / "calendar_schedule.json"

MONTH = {
    "jan": "01", "feb": "02", "mar": "03", "apr": "04", "may": "05", "jun": "06",
    "jul": "07", "aug": "08", "sep": "09", "oct": "10", "nov": "11", "dec": "12",
}


def parse_date_range(text: str, year: int) -> tuple[str, str] | None:
    """
    Parse e.g. "18 Apr-19 Apr" or "18 Apr - 19 Apr" into (startDate, endDate) as ISO.
    """
    text = text.strip()
    # e.g. "18 Apr-19 Apr" or "18 Apr - 19 Apr"
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


def scrape_calendar(page, year: int) -> list[dict]:
    """Fetch btcc.net calendar and return list of {round, venue, startDate, endDate}."""
    print(f"Fetching {CALENDAR_URL} …")
    page.goto(CALENDAR_URL, wait_until="networkidle", timeout=30_000)
    page.wait_for_timeout(2_000)

    # Calendar page: links like "18 Apr-19 Apr Donington Park" or similar
    # We'll get all links that look like calendar events (contain a date pattern and venue)
    text = page.content()
    # Fallback: evaluate in page to find links with date-like text
    events = page.evaluate("""(year) => {
        const links = Array.from(document.querySelectorAll('a[href*="circuit"]'));
        const out = [];
        const monthMap = { jan:'01', feb:'02', mar:'03', apr:'04', may:'05', jun:'06',
            jul:'07', aug:'08', sep:'09', oct:'10', nov:'11', dec:'12' };
        links.forEach((a, i) => {
            let t = a.textContent.replace(/\\s+/g, ' ').trim();
            const match = t.match(/(\\d{1,2})\\s*([A-Za-z]{3})\\s*[-–]\\s*(\\d{1,2})\\s*([A-Za-z]{3})\\s*(.+)/);
            if (match) {
                const [, d1, m1, d2, m2, venue] = match;
                const mon = (s) => (monthMap[s.toLowerCase().slice(0,3)] || '01');
                out.push({
                    round: i + 1,
                    venue: venue.trim(),
                    startDate: year + '-' + mon(m1) + '-' + d1.padStart(2,'0'),
                    endDate:   year + '-' + mon(m2) + '-' + d2.padStart(2,'0')
                });
            }
        });
        return out;
    }""", year)

    if events:
        return events

    # Fallback: regex on full page text
    results = []
    # Pattern: "18 Apr-19 Apr" or "18 Apr - 19 Apr" followed by venue name (until next link or end)
    pattern = re.compile(
        r"(\d{1,2})\s*([A-Za-z]{3})\s*[-–]\s*(\d{1,2})\s*([A-Za-z]{3})\s*([A-Za-z][^\n\[\]]*?)(?=\s*\[\d|$)",
        re.IGNORECASE,
    )
    for m in pattern.finditer(text):
        d1, mon1, d2, mon2, venue = m.groups()
        venue = venue.strip()
        if len(venue) < 3:
            continue
        mon1 = mon1.lower()[:3]
        mon2 = mon2.lower()[:3]
        m1, m2 = MONTH.get(mon1), MONTH.get(mon2)
        if m1 and m2:
            results.append({
                "round": len(results) + 1,
                "venue": venue,
                "startDate": f"{year}-{m1}-{int(d1):02d}",
                "endDate": f"{year}-{m2}-{int(d2):02d}",
            })
    return results


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
            old = rounds[i]
            rounds[i]["startDate"] = s["startDate"]
            rounds[i]["endDate"] = s["endDate"]
            rounds[i]["venue"] = s["venue"]
            if not dry_run:
                print(f"  Round {s['round']}: {s['venue']}  {s['startDate']} → {s['endDate']}")
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

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        page = browser.new_page()
        schedule = scrape_calendar(page, args.season)
        browser.close()

    if not schedule:
        print("No calendar events scraped — check btcc.net/calendar/ structure.", file=sys.stderr)
        sys.exit(1)

    print(f"Scraped {len(schedule)} rounds for {args.season}")
    for s in schedule:
        print(f"  {s['round']}. {s['venue']}  {s['startDate']} – {s['endDate']}")

    merge_into_calendar(schedule, args.dry_run)


if __name__ == "__main__":
    main()
