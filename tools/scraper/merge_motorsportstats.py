#!/usr/bin/env python3
"""
Merge motorsportstats summary data into data/drivers.json.

For each driver, replaces the hand-maintained `history` array with
data from the motorsportstats summaries (which have accurate wins,
podiums, poles, fastest laps, points, championship position, etc.).

Preserves all other driver fields (number, name, team, car, imageUrl,
nationality, bio, dateOfBirth, birthplace).

Usage:
    python merge_motorsportstats.py           # merge and write
    python merge_motorsportstats.py --dry-run # preview without writing
"""

import argparse
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
DRIVERS_JSON = ROOT / "data" / "drivers.json"
SUMMARIES_DIR = ROOT / "data" / "motorsportstats" / "summaries"

# Map driver names to motorsportstats slugs
NAME_TO_SLUG = {
    "Tom Chilton":        "tom-chilton",
    "Aiden Moffat":       "aiden-moffat",
    "Dexter Patterson":   "dexter-patterson",
    "Chris Smiley":       "chris-smiley",
    "Dan Cammish":        "dan-cammish",
    "Daniel Rowbottom":   "daniel-rowbottom",
    "Adam Morgan":        "adam-morgan",
    "Árón Taylor-Smith":  "aron-taylor-smith",
    "Tom Ingram":         "tom-ingram",
    "Jake Hill":          "jake-hill",
    "Ash Sutton":         "ash-sutton",
    "Ashley Sutton":      "ash-sutton",
    "Colin Turkington":   "colin-turkington",
    "Josh Cook":          "josh-cook",
    "Gordon Shedden":     "gordon-shedden",
    "Rory Butcher":       "rory-butcher",
    "Bobby Thompson":     "bobby-thompson",
    "Dan Lloyd":          "daniel-lloyd",
    "Tom Oliphant":       "tom-oliphant",
    "Max Sherrin":        "max-sherrin",
    "Nic Hamilton":       "nicolas-hamilton",
    # No motorsportstats pages for these drivers
    "Max Buxton":         None,
    "James Dorlin":       None,
    "Sam Osborne":        None,
    "Mikey Doble":        None,
    "Lewis Selby":        None,
}


def parse_champ_pos(text: str) -> int:
    """Convert championship position text to integer. 'WC' → 1, '2nd' → 2, etc."""
    if not text:
        return 0
    text = text.strip()
    if text.upper() == "WC":
        return 1
    m = re.match(r"(\d+)", text)
    return int(m.group(1)) if m else 0


def is_champion(text: str) -> bool:
    return text.strip().upper() == "WC" if text else False


def build_history_from_summary(summary: dict) -> list[dict]:
    """
    Convert motorsportstats summary seasons into the app's history format.
    Summary season keys: year, entrant, RS, W, PD, PP, FL, BR, BG, AF, AG, P, DNF, championshipPos
    App history keys: year, team, car, pos, points, wins, podiums, poles, fastestLaps, champion
    """
    history = []
    for season in summary.get("seasons", []):
        year = season.get("year", 0)
        entrant = season.get("entrant", "")
        champ_text = season.get("championshipPos", "")

        entry = {
            "year": year,
            "team": entrant,
            "car": "",  # motorsportstats doesn't provide car info
            "pos": parse_champ_pos(champ_text),
            "points": season.get("P", 0) if isinstance(season.get("P", 0), (int, float)) else 0,
            "wins": season.get("W", 0) if isinstance(season.get("W", 0), (int, float)) else 0,
            "podiums": season.get("PD", 0) if isinstance(season.get("PD", 0), (int, float)) else 0,
            "poles": season.get("PP", 0) if isinstance(season.get("PP", 0), (int, float)) else 0,
            "fastestLaps": season.get("FL", 0) if isinstance(season.get("FL", 0), (int, float)) else 0,
        }

        if is_champion(champ_text):
            entry["champion"] = True

        # Skip seasons with no meaningful data (0 points, no position, no stats)
        has_stats = (
            entry["pos"] > 0
            or entry["points"] > 0
            or entry["wins"] > 0
            or entry["podiums"] > 0
            or entry["poles"] > 0
            or entry["fastestLaps"] > 0
        )
        if not has_stats:
            continue


        history.append(entry)

    return history


def merge_history(existing_history: list[dict], new_history: list[dict]) -> list[dict]:
    """
    Merge new motorsportstats history into existing history.
    - For years that exist in both: update stats from motorsportstats but keep
      existing 'car' and 'teams' fields (motorsportstats doesn't have these).
    - For years only in motorsportstats: add them (without car info).
    - For years only in existing: keep them as-is.
    """
    existing_by_year = {h["year"]: h for h in existing_history}
    new_by_year = {h["year"]: h for h in new_history}

    merged = []
    all_years = sorted(set(list(existing_by_year.keys()) + list(new_by_year.keys())), reverse=True)

    for year in all_years:
        old = existing_by_year.get(year)
        new = new_by_year.get(year)

        if new and old:
            # Update stats from motorsportstats, keep car/teams from existing
            entry = {
                "year": year,
                "team": new["team"] or old.get("team", ""),
                "car": old.get("car", ""),
                "pos": new["pos"] if new["pos"] else old.get("pos", 0),
                "points": new["points"] if new["points"] else old.get("points", 0),
                "wins": new["wins"],
                "podiums": new["podiums"],
                "poles": new["poles"],
                "fastestLaps": new["fastestLaps"],
            }
            if new.get("champion"):
                entry["champion"] = True
            # Preserve teams array for mid-season moves
            if old.get("teams"):
                entry["teams"] = old["teams"]
            merged.append(entry)
        elif new:
            merged.append(new)
        elif old:
            merged.append(old)

    return merged


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    # Load existing drivers.json
    with open(DRIVERS_JSON) as f:
        data = json.load(f)

    # Load summaries from individual files
    summaries_by_slug = {}
    if SUMMARIES_DIR.exists():
        for f in sorted(SUMMARIES_DIR.glob("*.json")):
            with open(f) as fh:
                s = json.load(fh)
            summaries_by_slug[s["slug"]] = s

    print(f"Loaded {len(summaries_by_slug)} summaries")
    print(f"Loaded {len(data.get('drivers', []))} drivers from drivers.json\n")

    updated = 0
    for driver in data.get("drivers", []):
        name = driver["name"]
        slug = NAME_TO_SLUG.get(name)

        if not slug:
            print(f"  {name}: no slug mapping, skipping")
            continue

        summary = summaries_by_slug.get(slug)
        if not summary or not summary.get("seasons"):
            print(f"  {name}: no summary data found for slug '{slug}'")
            continue

        old_history = driver.get("history", [])
        new_history = build_history_from_summary(summary)
        merged = merge_history(old_history, new_history)

        old_years = len(old_history)
        new_years = len(merged)

        driver["history"] = merged
        updated += 1
        print(f"  {name}: {old_years} → {new_years} seasons")

    print(f"\nUpdated {updated} drivers")

    if args.dry_run:
        print("\n[DRY RUN] No files written.")
    else:
        with open(DRIVERS_JSON, "w") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        print(f"\nWrote {DRIVERS_JSON}")


if __name__ == "__main__":
    main()
