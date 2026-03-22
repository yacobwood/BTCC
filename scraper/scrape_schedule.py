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

    text = page.inner_text("body")
    # Collapse whitespace to single spaces — page often renders as one long line
    text = re.sub(r"\s+", " ", text)

    sessions = []

    # Pattern: optional time range or single time, then session name, then "Kwik Fit" / "BTCC"
    # e.g. "10:35 – 11:15Free PracticeKwik Fit British Touring Car Championship"
    # e.g. "15:05Qualifying RaceKwik Fit British Touring Car Championship13"
    # e.g. "11:30Kwik Fit British Touring Car Championship18"  (Race 1/2/3 — no explicit name before)

    # Split on day headers to get SAT/SUN context
    day_pattern = re.compile(
        r"(Saturday|Sunday)[^A-Z]*?(?=Saturday|Sunday|$)",
        re.IGNORECASE
    )

    # Find all day sections
    day_sections = []
    for m in re.finditer(
        r"(Saturday|Sunday)[\s,]*[A-Za-z]* ?\d+[^S]*?(?=Saturday|Sunday|$)",
        text, re.IGNORECASE
    ):
        day_word = m.group(1).lower()
        day_code = "SAT" if day_word == "saturday" else "SUN"
        day_sections.append((day_code, m.group(0)))

    if not day_sections:
        print(f"  ⚠ No day sections found on {url}")
        return []

    race_counter = 0

    for day_code, section in day_sections:
        # Find all BTCC entries in this section
        # Match: time (HH:MM or HH:MM – HH:MM) + optional session name + BTCC keyword
        entry_re = re.compile(
            r"(\d{1,2}:\d{2})(?:\s*[–\-]\s*\d{1,2}:\d{2})?"  # time (range optional)
            r"\s*([A-Za-z][^0-9]*?)"                            # activity text
            r"(?=Kwik Fit|BTCC|British Touring Car)",
            re.IGNORECASE
        )
        for m in entry_re.finditer(section):
            time_str = m.group(1)
            # Normalise to HH:MM
            h, mi = time_str.split(":")
            time_str = f"{int(h):02d}:{mi}"
            activity = m.group(2).strip().rstrip("–- ")

            name = classify_btcc_entry(activity, sessions)
            if name is None:
                continue

            # Avoid duplicates
            if not any(s["name"] == name and s["day"] == day_code for s in sessions):
                sessions.append({"name": name, "day": day_code, "time": time_str})
                print(f"    {day_code} {time_str}  {name}")

    if not sessions:
        print(f"  ⚠ No BTCC sessions found on {url}")

    return sessions


def classify_session(activity: str, following: str = "") -> str | None:
    lower = activity.lower()
    following_lower = following.lower()[:60]

    if "free practice" in lower:
        return "Free Practice"
    if "qualifying race" in lower:
        return "Qualifying Race"
    if "qualifying" in lower:
        return "Qualifying"

    # Race rows: activity is blank or just whitespace — look at what follows the BTCC keyword
    # e.g. "11:30Kwik Fit British Touring Car Championship18" — this is a race
    # Count how many races we've already added to determine Race 1/2/3
    if not lower.strip() or "pit lane" in lower:
        return None  # pit lane open notices, not sessions

    # Explicit race number in activity
    race_match = re.search(r"\brace\s*(\d)\b", lower)
    if race_match:
        return f"Race {race_match.group(1)}"

    return None


# Track race counter per call to merge_schedule — reset per round
_race_counter = 0


def classify_btcc_entry(activity: str, sessions_so_far: list) -> str | None:
    """Classify a BTCC timetable entry, counting races sequentially."""
    lower = activity.lower().strip()

    if "free practice" in lower:
        return "Free Practice"
    if "qualifying race" in lower:
        return "Qualifying Race"
    if "qualifying" in lower:
        return "Qualifying"

    # Blank activity = standalone race entry (just "Kwik Fit British Touring Car Championship")
    race_num = sum(1 for s in sessions_so_far if s["name"].startswith("Race")) + 1
    if race_num <= 3:
        return f"Race {race_num}"

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
