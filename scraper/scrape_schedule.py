#!/usr/bin/env python3
"""
BTCC Session Schedule Scraper
Scrapes practice/qualifying/race times from each circuit page on btcc.net
and merges them into data/schedule.json.

Usage:
    python scrape_schedule.py [--dry-run]
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

BTCC_KEYWORDS = ["british touring car", "btcc", "kwik fit"]
DAY_MAP = {"saturday": "SAT", "sunday": "SUN", "friday": "FRI"}

VENUE_SLUG_MAP = {
    "donington park":    "donington-park",
    "donington park gp": "donington-park",
    "brands hatch indy": "brands-hatch",
    "brands hatch gp":   "brands-hatch",
    "snetterton":        "snetterton",
    "oulton park":       "oulton-park",
    "thruxton":          "thruxton",
    "knockhill":         "knockhill",
    "croft":             "croft",
    "silverstone":       "silverstone",
}


def slug_for_venue(venue):
    return VENUE_SLUG_MAP.get(venue.lower().strip())


def classify_activity(activity, championship, sessions_so_far):
    lower = activity.lower().strip()
    champ_lower = championship.lower().strip()
    if "pit lane" in champ_lower or "pit lane" in lower or "autograph" in champ_lower or "paddock" in champ_lower:
        return None
    if "free practice" in lower:
        return "Free Practice"
    if "qualifying race" in lower:
        return "Qualifying Race"
    if "qualifying" in lower:
        return "Qualifying"
    if not lower:
        race_num = sum(1 for s in sessions_so_far if s["name"].startswith("Race")) + 1
        if race_num <= 3:
            return f"Race {race_num}"
    return None


def scrape_circuit_page(page, slug, venue):
    url = f"https://btcc.net/circuit/{slug}/"
    print(f"  Fetching {url} ...")
    try:
        page.goto(url, wait_until="networkidle", timeout=30000)
        page.wait_for_timeout(1500)
    except Exception as e:
        print(f"  Failed to load {url}: {e}", file=sys.stderr)
        return []

    JS = """
() => {
    const results = [];
    let currentDay = null;
    const dayMap = { saturday: 'SAT', sunday: 'SUN', friday: 'FRI' };
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
    let node = walker.nextNode();
    while (node) {
        const tag = node.tagName.toLowerCase();
        if (['h1','h2','h3','h4'].includes(tag)) {
            const txt = node.textContent.trim().toLowerCase();
            for (const [day, code] of Object.entries(dayMap)) {
                if (txt.startsWith(day)) { currentDay = code; break; }
            }
        }
        if (tag === 'tr' && currentDay) {
            const cells = Array.from(node.querySelectorAll('td,th'))
                .map(c => c.textContent.replace(/\\s+/g, ' ').trim());
            if (cells.length >= 2) {
                results.push({ day: currentDay, cells: cells });
            }
        }
        node = walker.nextNode();
    }
    return results;
}
"""
    rows = page.evaluate(JS)

    sessions = []
    time_re = re.compile(r"(\d{1,2}):(\d{2})")

    for row in rows:
        day   = row["day"]
        cells = row["cells"]
        if len(cells) < 2:
            continue

        m = time_re.search(cells[0])
        if not m:
            continue
        time_str = f"{int(m.group(1)):02d}:{m.group(2)}"

        # SAT: Time | Activity | Championship | Laps  -> btcc_idx == 2
        # SUN: Time | Championship | Laps             -> btcc_idx == 1
        btcc_idx = None
        for idx in range(1, len(cells)):
            if any(kw in cells[idx].lower() for kw in BTCC_KEYWORDS):
                btcc_idx = idx
                break
        if btcc_idx is None:
            continue

        championship = cells[btcc_idx]
        activity     = cells[btcc_idx - 1] if btcc_idx >= 2 else ""

        name = classify_activity(activity, championship, sessions)
        if name is None:
            continue

        if not any(s["name"] == name and s["day"] == day for s in sessions):
            sessions.append({"name": name, "day": day, "time": time_str})
            print(f"    {day} {time_str}  {name}")

    if not sessions:
        print(f"  No BTCC sessions found on {url}")

    return sessions


def merge_schedule(scraped, dry_run):
    if not SCHEDULE_JSON.exists():
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
        print("\nDry run - schedule.json not written.")
        print(json.dumps(existing, indent=2))
        return

    with open(SCHEDULE_JSON, "w") as f:
        json.dump(existing, f, indent=2)
    print(f"\nUpdated {SCHEDULE_JSON} with {len(scraped)} rounds.")


def load_rounds_from_calendar():
    if not CALENDAR_JSON.exists():
        return []
    with open(CALENDAR_JSON) as f:
        data = json.load(f)
    return data.get("rounds", [])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    rounds = load_rounds_from_calendar()
    if not rounds:
        print("No rounds in calendar.json - run scrape_calendar.py first.", file=sys.stderr)
        sys.exit(1)

    scraped = {}

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        page = browser.new_page()

        for r in rounds:
            round_num = r.get("round")
            venue     = r.get("venue", "")
            slug      = slug_for_venue(venue)
            if not slug:
                print(f"  Round {round_num} ({venue}): no slug mapping - skipping")
                continue
            print(f"\nRound {round_num}: {venue}")
            sessions = scrape_circuit_page(page, slug, venue)
            scraped[round_num] = sessions

        browser.close()

    merge_schedule(scraped, args.dry_run)


if __name__ == "__main__":
    main()
