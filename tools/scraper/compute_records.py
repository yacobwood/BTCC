#!/usr/bin/env python3
"""
BTCC All-Time Records Computer

Reads bundled season JSON files (src/assets/data/season_*.json, 2004-2025)
and live results files (data/results{year}.json for years beyond the bundles)
to compute all-time driver records for every stat shown on the RecordsScreen.

Writes data/records.json — fetched remotely by the app on every scrape run.

Usage:
    python compute_records.py
"""

import json
import glob
import sys
from collections import defaultdict
from pathlib import Path

REPO_ROOT  = Path(__file__).resolve().parent.parent.parent
SEASON_DIR = REPO_ROOT / "src" / "assets" / "data"
DATA_DIR   = REPO_ROOT / "data"
OUT_PATH   = DATA_DIR / "records.json"

POINTS_SESSIONS = {"Race 1", "Race 2", "Race 3", "Qualifying Race"}

# Official all-time wins from btcc.net/history/statistics/drivers/
# Used to override computed wins for drivers whose careers span pre-2004 seasons
OFFICIAL_WINS = {
    'Jason Plato': 97, 'Colin Turkington': 72, 'Matt Neal': 63, 'Gordon Shedden': 53,
    'Ashley Sutton': 50, 'Tom Ingram': 41, 'Mat Jackson': 31, 'Andrew Jordan': 26,
    'Fabrizio Giovanardi': 24, 'Jake Hill': 23, 'Josh Cook': 21, 'Tom Chilton': 18,
    'Dan Cammish': 16, 'Rob Collard': 15, 'Adam Morgan': 11, 'Rory Butcher': 11,
    'Sam Tordoff': 8, 'Tom Onslow-Cole': 7, 'Dan Eaves': 6, 'Darren Turner': 5,
    'Jack Goff': 5, 'Aiden Moffat': 5, 'Daniel Rowbottom': 5, 'Daniel Lloyd': 5,
    'Stephen Jelley': 4, 'Rob Huff': 4,
}

# Official championship counts from btcc.net/history/champions/btcc-titles/
OFFICIAL_CHAMPS_OVERRIDE = {
    'Jason Plato': 2, 'Tom Ingram': 2,
}

# BTCC Drivers' Champions — verified against season points totals
CHAMPIONS = {
    2004: "James Thompson",
    2005: "Matt Neal",
    2006: "Matt Neal",
    2007: "Fabrizio Giovanardi",
    2008: "Fabrizio Giovanardi",
    2009: "Colin Turkington",
    2010: "Jason Plato",
    2011: "Matt Neal",
    2012: "Gordon Shedden",
    2013: "Andrew Jordan",
    2014: "Colin Turkington",
    2015: "Gordon Shedden",
    2016: "Gordon Shedden",
    2017: "Ashley Sutton",
    2018: "Colin Turkington",
    2019: "Colin Turkington",
    2020: "Ashley Sutton",
    2021: "Ashley Sutton",
    2022: "Tom Ingram",
    2023: "Ashley Sutton",
    2024: "Jake Hill",
    2025: "Tom Ingram",
}


def title_case(name):
    """Convert TSL all-caps surname format 'Tom INGRAM' → 'Tom Ingram'."""
    return " ".join(w.capitalize() for w in name.split()) if name else name


def get_flag(result, short_key, long_key):
    return bool(result.get(short_key) or result.get(long_key))


def load_all_seasons():
    """
    Return list of (year, rounds, source) tuples sorted chronologically.

    Season JSONs (2004-2025): Race 1/2/3 only; flags fl (fastest lap), l (laps led), p (pole).
    Results JSONs (year > max bundled year): all sessions; flags fastestLap, leadLap, pole.
    Driver names in results JSONs use TSL all-caps surname format and are normalised here.
    """
    entries = []

    max_season_year = 0
    for f in sorted(glob.glob(str(SEASON_DIR / "season_*.json"))):
        data = json.load(open(f))
        year = int(data["season"])
        max_season_year = max(max_season_year, year)
        entries.append((year, data["rounds"], "season"))

    for f in sorted(glob.glob(str(DATA_DIR / "results*.json"))):
        data = json.load(open(f))
        year = int(data["season"])
        if year <= max_season_year:
            continue
        for rnd in data["rounds"]:
            for race in rnd["races"]:
                for r in race["results"]:
                    r["driver"] = title_case(r.get("driver", ""))
        entries.append((year, data["rounds"], "results"))

    return sorted(entries, key=lambda x: x[0])


def build_timeline(seasons):
    """
    Build a flat chronological list of points-scoring race events.

    Each entry: {year, round, race_label, pole_driver, results}
    result fields: {driver, pos, points, fastestLap, lapsLed}
    """
    timeline = []

    for year, rounds, _source in seasons:
        for rnd in rounds:
            if not rnd.get("races"):
                continue
            round_num = rnd["round"]

            # Find the pole driver for this round (flag can live in any session)
            pole_driver = None
            for race in rnd["races"]:
                for r in race["results"]:
                    if get_flag(r, "p", "pole"):
                        pole_driver = r["driver"]
                        break
                if pole_driver:
                    break

            race_map = {race["label"]: race for race in rnd["races"]}
            for label in ["Qualifying Race", "Race 1", "Race 2", "Race 3"]:
                race = race_map.get(label)
                if not race or not race.get("results"):
                    continue
                results = [
                    {
                        "driver":     r.get("driver", ""),
                        "pos":        r.get("pos", 0),
                        "points":     r.get("points", 0),
                        "fastestLap": get_flag(r, "fl", "fastestLap"),
                        "lapsLed":    get_flag(r, "l", "leadLap"),
                    }
                    for r in race["results"]
                    if r.get("driver")
                ]
                if not results:
                    continue
                timeline.append({
                    "year":        year,
                    "round":       round_num,
                    "race_label":  label,
                    "pole_driver": pole_driver,
                    "results":     results,
                })

    return timeline


def new_stats():
    return {
        "starts": 0, "wins": 0, "podiums": 0, "poles": 0,
        "fastestLaps": 0, "dnfs": 0, "points": 0, "racesLed": 0,
        "hatTricks": 0, "season_set": set(),
        "season_wins": defaultdict(int),
        "season_podiums": defaultdict(int),
        "season_poles": defaultdict(int),
        "cur_win": 0,    "max_win": 0,
        "cur_pod": 0,    "max_pod": 0,
        "cur_pole": 0,   "max_pole": 0,
        "cur_consec": 0, "max_consec": 0,
        "cur_pts": 0,    "max_pts": 0,
    }


def compute_records(timeline):
    stats = defaultdict(new_stats)

    for event in timeline:
        year      = event["year"]
        label     = event["race_label"]
        pole_drv  = event["pole_driver"]
        results   = event["results"]

        drivers_in_race = {r["driver"] for r in results}

        for r in results:
            d   = r["driver"]
            pos = r["pos"]
            pts = r["points"]
            fl  = r["fastestLap"]
            ll  = r["lapsLed"]
            s   = stats[d]

            s["starts"]  += 1
            s["points"]  += pts
            s["season_set"].add(year)

            is_finish = pos > 0
            is_win    = pos == 1
            is_podium = 1 <= pos <= 3

            if is_win:
                s["wins"] += 1
                s["season_wins"][year] += 1
            if is_podium:
                s["podiums"] += 1
                s["season_podiums"][year] += 1
            if fl:
                s["fastestLaps"] += 1
            if ll:
                s["racesLed"] += 1
            if pos == 0:
                s["dnfs"] += 1

            # Hat trick: win + pole + fastest lap in Race 1 (only Race 1 uses qualifying grid)
            if label == "Race 1" and is_win and fl and pole_drv == d:
                s["hatTricks"] += 1

            # Win streak
            if is_win:
                s["cur_win"] += 1
                s["max_win"] = max(s["max_win"], s["cur_win"])
            else:
                s["cur_win"] = 0

            # Podium streak
            if is_podium:
                s["cur_pod"] += 1
                s["max_pod"] = max(s["max_pod"], s["cur_pod"])
            else:
                s["cur_pod"] = 0

            # Consecutive finishes (not DNF)
            if is_finish:
                s["cur_consec"] += 1
                s["max_consec"] = max(s["max_consec"], s["cur_consec"])
            else:
                s["cur_consec"] = 0

            # Consecutive points finishes
            if pts > 0:
                s["cur_pts"] += 1
                s["max_pts"] = max(s["max_pts"], s["cur_pts"])
            else:
                s["cur_pts"] = 0

        # Pole tracking is per-round via Race 1 (only Race 1 starts from qualifying grid)
        if label == "Race 1":
            for d in drivers_in_race:
                got_pole = (pole_drv == d)
                s = stats[d]
                if got_pole:
                    s["poles"] += 1
                    s["season_poles"][year] += 1
                    s["cur_pole"] += 1
                    s["max_pole"] = max(s["max_pole"], s["cur_pole"])
                else:
                    s["cur_pole"] = 0

    champ_counts = defaultdict(int)
    for champ in CHAMPIONS.values():
        champ_counts[champ] += 1

    drivers = []
    for driver, s in stats.items():
        starts = s["starts"]
        wins   = s["wins"]
        drivers.append({
            "driver":             driver,
            "starts":             starts,
            "wins":               wins,
            "podiums":            s["podiums"],
            "poles":              s["poles"],
            "fastestLaps":        s["fastestLaps"],
            "dnfs":               s["dnfs"],
            "points":             s["points"],
            "seasons":            len(s["season_set"]),
            "championships":      champ_counts.get(driver, 0),
            "bestSeasonWins":     max(s["season_wins"].values(), default=0),
            "bestSeasonPodiums":  max(s["season_podiums"].values(), default=0),
            "bestSeasonPoles":    max(s["season_poles"].values(), default=0),
            "winStreak":          s["max_win"],
            "podiumStreak":       s["max_pod"],
            "poleStreak":         s["max_pole"],
            "consecutive":        s["max_consec"],
            "consecutivePoints":  s["max_pts"],
            "racesLed":           s["racesLed"],
            "hatTricks":          s["hatTricks"],
            "winPct":             wins / starts if starts > 0 else 0,
            "podiumPct":          s["podiums"] / starts if starts > 0 else 0,
            "pointsPerStart":     s["points"] / starts if starts > 0 else 0,
            "dnfPct":             s["dnfs"] / starts if starts > 0 else 0,
        })

    drivers.sort(key=lambda d: d["starts"], reverse=True)
    return drivers


def main():
    print("Loading season data...")
    seasons = load_all_seasons()
    year_list = [y for y, _, _ in seasons]
    print(f"  {len(seasons)} seasons: {year_list[0]}–{year_list[-1]}")

    print("Building timeline...")
    timeline = build_timeline(seasons)
    print(f"  {len(timeline)} race events")

    print("Computing records...")
    drivers = compute_records(timeline)
    print(f"  {len(drivers)} drivers")

    # Apply official wins/championships overrides for modern drivers
    by_name = {d["driver"]: d for d in drivers}
    for driver, official_w in OFFICIAL_WINS.items():
        if driver in by_name:
            by_name[driver]["wins"] = official_w
            s = by_name[driver]["starts"]
            by_name[driver]["winPct"] = official_w / s if s > 0 else 0
    for driver, official_c in OFFICIAL_CHAMPS_OVERRIDE.items():
        if driver in by_name:
            by_name[driver]["championships"] = official_c

    for name in ["Jason Plato", "Colin Turkington", "Tom Ingram"]:
        if name in by_name:
            d = by_name[name]
            print(f"  {name}: {d['wins']}W {d['championships']}T "
                  f"streak={d['winStreak']} consecutive={d['consecutive']} starts={d['starts']}")

    # Preserve historical=True entries from previous records.json (pre-2004 era drivers)
    historical_entries = []
    if OUT_PATH.exists():
        try:
            prev = json.loads(OUT_PATH.read_text())
            historical_entries = [d for d in prev.get("drivers", []) if d.get("historical")]
        except Exception:
            pass

    all_drivers = list(by_name.values()) + historical_entries
    OUT_PATH.write_text(json.dumps({"drivers": all_drivers}, indent=2))
    print(f"\nWrote {OUT_PATH}  ({len(by_name)} modern + {len(historical_entries)} historical = {len(all_drivers)} total drivers)")


if __name__ == "__main__":
    main()
