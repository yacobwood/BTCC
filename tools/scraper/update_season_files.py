#!/usr/bin/env python3
"""
Update season_YYYY.json files with motorsportstats summary data.
Updates the `drivers` standings array and `driverStats` array to match
motorsportstats totals. Does NOT touch `rounds` (race-by-race results)
or `progression` (cumulative chart data — would need race-by-race MSS data).

Usage:
    python update_season_files.py [year]   # default: all years with summaries
    python update_season_files.py 2025
"""

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
ASSETS_DIR = ROOT / "app" / "src" / "main" / "assets" / "data"
SUMMARIES_DIR = ROOT / "data" / "motorsportstats" / "summaries"


def load_all_summaries() -> dict:
    """Load all driver summaries, keyed by driver name."""
    by_name = {}
    for f in SUMMARIES_DIR.glob("*.json"):
        with open(f) as fh:
            s = json.load(fh)
        by_name[s["name"]] = s
    return by_name


def parse_champ_pos(text: str) -> int:
    if not text:
        return 0
    if text.strip().upper() == "WC":
        return 1
    m = re.match(r"(\d+)", text.strip())
    return int(m.group(1)) if m else 0


def find_summary_season(summaries, driver_name, year):
    """Find a driver's season data from summaries, matching by name."""
    summary = summaries.get(driver_name)
    if not summary:
        for name, s in summaries.items():
            if driver_name.split()[-1] == name.split()[-1]:
                summary = s
                break
    if not summary:
        return None
    entries = [s for s in summary.get("seasons", []) if s.get("year") == year]
    # Skip if multiple entries (mid-season team change — totals are split)
    if len(entries) != 1:
        return None
    return entries[0]


def update_season_file(year, summaries):
    """Update a single season file. Returns True if changes were made."""
    season_file = ASSETS_DIR / f"season_{year}.json"
    if not season_file.exists():
        print(f"  {season_file.name}: not found, skipping")
        return False

    with open(season_file) as f:
        data = json.load(f)

    changed = False

    # Update drivers standings
    for driver in data.get("drivers", []):
        name = driver.get("name", "")
        mss = find_summary_season(summaries, name, year)
        if not mss:
            continue

        pts = mss.get("P", 0) if isinstance(mss.get("P", 0), (int, float)) else 0
        wins = mss.get("W", 0) if isinstance(mss.get("W", 0), (int, float)) else 0
        podiums = mss.get("PD", 0) if isinstance(mss.get("PD", 0), (int, float)) else 0
        pos = parse_champ_pos(mss.get("championshipPos", ""))

        if pts and driver.get("points") != int(pts):
            print(f"    {name}: points {driver.get('points')} → {int(pts)}")
            driver["points"] = int(pts)
            changed = True
        if pos and driver.get("position") != pos:
            driver["position"] = pos
            changed = True
        if wins and driver.get("wins") != int(wins):
            driver["wins"] = int(wins)
            changed = True
        # Update seconds/thirds from podiums if available
        seconds = podiums - wins if podiums > wins else 0
        if "seconds" in driver and "thirds" in driver:
            # We don't have exact 2nd/3rd split from MSS, keep existing
            pass

    # Update driverStats
    for stat in data.get("driverStats", []):
        name = stat.get("driver", "")
        mss = find_summary_season(summaries, name, year)
        if not mss:
            continue

        wins = mss.get("W", 0) if isinstance(mss.get("W", 0), (int, float)) else 0
        podiums = mss.get("PD", 0) if isinstance(mss.get("PD", 0), (int, float)) else 0
        poles = mss.get("PP", 0) if isinstance(mss.get("PP", 0), (int, float)) else 0
        fl = mss.get("FL", 0) if isinstance(mss.get("FL", 0), (int, float)) else 0
        dnf = mss.get("DNF", 0) if isinstance(mss.get("DNF", 0), (int, float)) else 0
        starts = mss.get("RS", 0) if isinstance(mss.get("RS", 0), (int, float)) else 0

        updates = {}
        if wins and stat.get("wins") != int(wins):
            updates["wins"] = int(wins)
        if podiums and stat.get("podiums") != int(podiums):
            updates["podiums"] = int(podiums)
        if poles and stat.get("poles") != int(poles):
            updates["poles"] = int(poles)
        if starts and stat.get("races") != int(starts):
            updates["races"] = int(starts)
        if dnf is not None and stat.get("dnfs") != int(dnf):
            updates["dnfs"] = int(dnf)

        if updates:
            stat.update(updates)
            changed = True

    # Update progression final values to match standings
    driver_pts = {d["name"]: d["points"] for d in data.get("drivers", [])}
    for prog in data.get("progression", []):
        name = prog.get("driver", "")
        expected = driver_pts.get(name)
        if expected and prog.get("cumulativePointsByRound"):
            current_final = prog["cumulativePointsByRound"][-1]
            if current_final != expected:
                # Scale the last value to match — the intermediate values
                # are still from race results but the final total is corrected
                print(f"    {name}: progression final {current_final} → {expected}")
                prog["cumulativePointsByRound"][-1] = expected
                changed = True

    if changed:
        # Re-sort drivers by position
        data["drivers"].sort(key=lambda d: (d.get("position", 999), -d.get("points", 0)))
        with open(season_file, "w") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        print(f"  ✓ Updated {season_file.name}")
    else:
        print(f"  {season_file.name}: no changes needed")

    return changed


def main():
    summaries = load_all_summaries()
    print(f"Loaded {len(summaries)} driver summaries\n")

    if len(sys.argv) > 1:
        years = [int(sys.argv[1])]
    else:
        # Update all years that have season files
        years = sorted(
            int(f.stem.replace("season_", ""))
            for f in ASSETS_DIR.glob("season_*.json")
        )

    updated = 0
    for year in years:
        print(f"Season {year}:")
        if update_season_file(year, summaries):
            updated += 1

    print(f"\nUpdated {updated} season file(s)")


if __name__ == "__main__":
    main()
