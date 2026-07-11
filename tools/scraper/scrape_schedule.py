#!/usr/bin/env python3
"""
BTCC Session Schedule Scraper
Extracts BTCC's own session times (Free Practice, Qualifying, Qualifying
Race, Race 1/2/3) from each circuit page's weekend timetable and merges
them into data/schedule.json.

Reuses scrape_full_timetable.py's page parser (fetched through the
btcc-relay Cloudflare Worker - see btcc_relay.py) since the same timetable
already contains BTCC's own rows alongside support-series ones; this just
filters them down and assigns session names.

Usage:
    python scrape_schedule.py [--dry-run]
"""

import argparse
import importlib.util
import json
import sys
from pathlib import Path

DATA_DIR      = Path(__file__).resolve().parent.parent.parent / "data"
SCHEDULE_JSON = DATA_DIR / "schedule.json"
CALENDAR_JSON = DATA_DIR / "calendar.json"

BTCC_KEYWORDS = ("british touring car", "btcc", "kwik fit")


def _load_full_timetable_module():
    spec = importlib.util.spec_from_file_location(
        "scrape_full_timetable", Path(__file__).parent / "scrape_full_timetable.py"
    )
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def classify_btcc_sessions(entries):
    """Filter timetable entries down to BTCC's own sessions, named
    Free Practice / Qualifying / Qualifying Race / Race 1-3 in order."""
    sessions = []
    race_count = 0
    for e in entries:
        series = (e.get("series") or "").lower()
        if not any(kw in series for kw in BTCC_KEYWORDS):
            continue
        name = e["session"]
        if name == "Race":
            race_count += 1
            name = f"Race {race_count}"
        elif name not in ("Free Practice", "Qualifying", "Qualifying Race"):
            continue
        sessions.append({"name": name, "day": e["day"], "time": e["time"]})
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

    ft = _load_full_timetable_module()

    scraped = {}
    for r in rounds:
        round_num = r.get("round")
        venue     = r.get("venue", "")
        slug      = ft.VENUE_SLUG.get(venue)
        if not slug:
            print(f"  Round {round_num} ({venue}): no slug mapping - skipping")
            continue
        print(f"\nRound {round_num}: {venue}")
        entries = ft.scrape_circuit_timetable(slug)
        sessions = classify_btcc_sessions(entries)
        for s in sessions:
            print(f"    {s['day']} {s['time']}  {s['name']}")
        scraped[round_num] = sessions

    merge_schedule(scraped, args.dry_run)


if __name__ == "__main__":
    main()
