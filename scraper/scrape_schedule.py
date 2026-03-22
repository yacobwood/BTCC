#!/usr/bin/env python3
"""
BTCC Session Schedule Scraper
Scrapes practice/qualifying/race times from each circuit page on btcc.net
and merges them into data/schedule.json.

Usage:
    python scrape_schedule.py [--season YEAR] [--dry-run]
"""

import argparse
import json
import re
import sys
from pathlib import Path

try:
    from playwright.sync_api import sync_playwright
except ImportError:
    print("Install playwright: pip install playwright && playwright install chromium", file=sys.stderr)
    sys.exit(1)

DATA_DIR      = Path(__file__).resolve().parent.parent / "data"
SCHEDULE_JSON = DATA_DIR / "schedule.json"
CALENDAR_JSON = DATA_DIR / "calendar.json"

# Map btcc.net circuit page slugs to round numbers via venue name matching
VENUE_SLUG_MAP = {
    "donington park":    "donington-park",
    "brands hatch indy": "brands-hatch",
    "brands hatch gp":   "brands-hatch",
    "snetterton":        "snetterton",
    "oulton park":       "oulton-park",
    "thruxton":          "thruxton",
    "knockhill":         "knockhill",
    "croft":             "croft",
    "silverstone":       "silverstone",
    "donington park gp": "donington-park",
}

# Sessions we care about — match against the "Championship" column text
BTCC_KEYWORDS = ["british touring car", "btcc", "kwik fit"]

# Day name → SAT/SUN
DAY_MAP = {
    "saturday": "SAT",
    "sunday":   "SUN",
    "friday":   "FRI",
}

TIME_RE = re.compile(r"^(\d{1,2}):(\d{2})")


def slug_for_venue(venue: str) -> str | None:
    return VENUE_SLUG_MAP.get(venue.lower().strip())


def scrape_circuit_page(page, slug: str, venue: str) -> list[dict]:
    url = f"https://btcc.net/circuit/{slug}/"
    print(f"  Fetching {url} …")
    try:
        page.goto(url, wait_until="networkidle", timeout=30_000)
        page.wait_for_timeout(1_500)
    except Exception as e:
        print(f"  ✗ Failed to load {url}: {e}", file=sys.stderr)
        return []

    # Extract the full timetable text from the page
    text = page.inner_text("body")

    sessions = []
    current_day = None

    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue

        # Detect day headers e.g. "Saturday, April 18" or "Sunday 19 April"
        lower = line.lower()
        for day_name, day_code in DAY_MAP.items():
            if lower.startswith(day_name):
                current_day = day_code
                break

        if current_day is None:
            continue

        # Look for lines containing a BTCC session — must have a time and "BTCC" keyword
        is_btcc = any(kw in lower for kw in BTCC_KEYWORDS)
        if not is_btcc:
            continue

        # Extract time — first HH:MM in the line
        time_match = TIME_RE.search(line)
        if not time_match:
            continue
        time_str = f"{int(time_match.group(1)):02d}:{time_match.group(2)}"

        # Determine session name
        name = classify_session(line)
        if name is None:
            continue

        # Avoid duplicates (same name + day)
        if not any(s["name"] == name and s["day"] == current_day for s in sessions):
            sessions.append({"name": name, "day": current_day, "time": time_str})
            print(f"    {current_day} {time_str}  {name}")

    if not sessions:
        print(f"  ⚠ No BTCC sessions found on {url}")

    return sessions


def classify_session(line: str) -> str | None:
    lower = line.lower()
    if "free practice" in lower:
        return "Free Practice"
    if "qualifying race" in lower:
        return "Qualifying Race"
    if "qualifying" in lower:
        return "Qualifying"
    # Race 1/2/3 — look for "race" followed by a number, or just "race" on its own
    race_match = re.search(r"\brace\s*(\d)\b", lower)
    if race_match:
        return f"Race {race_match.group(1)}"
    if re.search(r"\brace\b", lower):
        return "Race 1"  # fallback for single-race formats
    return None


def merge_schedule(scraped: dict[int, list[dict]], dry_run: bool) -> None:
    if not SCHEDULE_JSON.exists():
        print(f"  {SCHEDULE_JSON} not found — creating fresh file", file=sys.stderr)
        existing = {"season": "2026", "rounds": []}
    else:
        with open(SCHEDULE_JSON) as f:
            existing = json.load(f)

    rounds = {r["round"]: r for r in existing.get("rounds", [])}

    for round_num, sessions in scraped.items():
        if not sessions:
            continue
        if round_num in rounds:
            rounds[round_num]["sessions"] = sessions
        else:
            rounds[round_num] = {"round": round_num, "sessions": sessions}

    existing["rounds"] = sorted(rounds.values(), key=lambda r: r["round"])

    if dry_run:
        print("\nDry run — schedule.json not written.")
        print(json.dumps(existing, indent=2))
        return

    with open(SCHEDULE_JSON, "w") as f:
        json.dump(existing, f, indent=2)
    print(f"\nUpdated {SCHEDULE_JSON} with {len(scraped)} rounds.")


def load_rounds_from_calendar() -> list[dict]:
    if not CALENDAR_JSON.exists():
        return []
    with open(CALENDAR_JSON) as f:
        data = json.load(f)
    return data.get("rounds", [])


def main():
    ap = argparse.ArgumentParser(description="Scrape BTCC session times from btcc.net circuit pages")
    ap.add_argument("--season", type=int, default=2026)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    rounds = load_rounds_from_calendar()
    if not rounds:
        print("No rounds found in calendar.json — run scrape_calendar.py first.", file=sys.stderr)
        sys.exit(1)

    scraped: dict[int, list[dict]] = {}

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        page = browser.new_page()

        for r in rounds:
            round_num = r.get("round")
            venue     = r.get("venue", "")
            slug      = slug_for_venue(venue)
            if not slug:
                print(f"  Round {round_num} ({venue}): no slug mapping — skipping")
                continue
            print(f"\nRound {round_num}: {venue}")
            sessions = scrape_circuit_page(page, slug, venue)
            scraped[round_num] = sessions

        browser.close()

    merge_schedule(scraped, args.dry_run)


if __name__ == "__main__":
    main()
