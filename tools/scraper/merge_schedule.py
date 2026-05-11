#!/usr/bin/env python3
"""
Merge scraped session times from data/schedule.json into src/data/calendar.json.

Run after scrape_schedule.py — reads the freshly-scraped sessions by round
and overwrites the sessions array for each matching round in the app calendar.
Rounds with no scraped sessions are left untouched.
"""

import json
from pathlib import Path

ROOT         = Path(__file__).resolve().parent.parent.parent
SCHEDULE_JSON  = ROOT / "data" / "schedule.json"
CALENDAR_JSON  = ROOT / "data" / "calendar.json"


def main():
    with open(SCHEDULE_JSON) as f:
        schedule = json.load(f)
    with open(CALENDAR_JSON) as f:
        calendar = json.load(f)

    scraped = {r["round"]: r["sessions"] for r in schedule.get("rounds", []) if r.get("sessions")}

    changed = []
    for r in calendar.get("rounds", []):
        round_num = r["round"]
        if round_num in scraped:
            if r.get("sessions") != scraped[round_num]:
                r["sessions"] = scraped[round_num]
                changed.append(round_num)

    if not changed:
        print("No session times changed.")
        return

    with open(CALENDAR_JSON, "w") as f:
        json.dump(calendar, f, indent=2)
        f.write("\n")

    print(f"Updated sessions for round(s): {', '.join(str(n) for n in changed)}")


if __name__ == "__main__":
    main()
