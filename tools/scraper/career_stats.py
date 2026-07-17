#!/usr/bin/env python3
"""
Compute a driver's per-year career stats (points, wins, podiums, poles, fastest
laps, DNFs, final championship position) directly from the season/results
archives, rather than trusting hand-typed data/drivers.json history entries.

Ground rules, verified against the official 2026 BTCC Sporting Regulations
(regulations/2026-BTCC-Regulations.pdf, section 1.6):
  - Points include every session (Qualifying Race included - reg 1.6.2.a).
  - Wins/podiums/fastest laps only count Race 1/2/3 ("Championship Rounds").
    Reg 1.6.9-1.6.10's tiebreak is explicitly scoped to "(Championship Round)
    first places", excluding Qualifying Race - confirmed independently against
    live reporting (a driver's win was captioned "5th victory of the season",
    which only reconciles if QR wins aren't counted).
  - No season_{year}.json bundle (2004-2025) has a Qualifying Race session at
    all; only the live results2026.json does. So this distinction is a no-op
    for every historical year and only matters for the current season.
  - Final position ties are broken by (points, wins, seconds, thirds, ...) per
    reg 1.6.9-1.6.10. Verified: this ranking correctly identifies the actual
    champion for all 22 years 2004-2025, matching CHAMPIONS below exactly -
    run `python career_stats.py --verify-champions` to reproduce.

Known source-data gaps (not bugs in this script - see project memory):
  - Pole flags are missing for a large fraction of historical driver-years
    (confirmed: e.g. Tom Chilton's 2004 season has zero pole flags set
    anywhere despite being on record elsewhere as a 2-pole season). Computed
    poles are a floor, not a ceiling, for years before this was cross-checked
    externally.
  - A bare pos=0 result is ambiguous (retired vs. never entered a round). This
    script uses a whole-round-blank heuristic: if every one of a driver's
    Race 1/2/3 entries in a round is blank (pos=0 and laps=0), the round was
    never entered and contributes zero DNFs, rather than counting each blank
    entry as a DNF. Residual risk: a driver who retires in Race 1 and can't
    start Races 2-3 of that same round is still undercounted for that round -
    no source field distinguishes this case from "never entered" today.

Usage:
    python career_stats.py "Nick Halstead" 2021 2023 2024 2025
    python career_stats.py --verify-champions
"""
import json
import sys
from collections import defaultdict
from pathlib import Path

REPO_ROOT  = Path(__file__).resolve().parent.parent.parent
SEASON_DIR = REPO_ROOT / "src" / "assets" / "data"
DATA_DIR   = REPO_ROOT / "data"

# "Championship Rounds" only - see module docstring for why Qualifying Race is
# excluded from wins/podiums/fastest-laps/poles but not from points.
PODIUM_SESSIONS = {"Race 1", "Race 2", "Race 3"}

# Historical name variants found in season_{year}.json bundles that don't match
# the current drivers.json spelling - confirmed by checking why an expected
# driver-year returned no result. Keyed by the bundle's spelling.
DRIVER_NAME_ALIASES = {
    "Daryl DeLeon": "Daryl De Leon",   # season_2025.json spells it without a space
    "Árón Smith": "Árón Taylor-Smith",  # season_2014/2015/2016.json - pre-"Taylor-" era
}

# Independently-curated champions list, duplicated from compute_records.py on
# purpose (used here only to self-verify this module's tiebreak logic against
# a second source - not imported, to keep both scripts independently runnable).
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


def get_flag(result, short_key, long_key):
    return bool(result.get(short_key) or result.get(long_key))


def get_pos(result):
    return result.get("pos", result.get("position", 0)) or 0


def normalize_name(name):
    """Convert "Firstname SURNAME" (TSL/results{year}.json convention, e.g.
    "Max BUXTON", "Daryl DE LEON") to the natural title-case drivers.json
    itself uses (e.g. "Max Buxton", "Daryl De Leon"). season_{year}.json
    bundles are already title-case, so this is a no-op for them - but without
    it, this module silently fails to match ANY driver from the current
    season's results{year}.json, which uses the all-caps-surname convention."""
    parts = name.split()
    if not parts:
        return name
    return parts[0] + ' ' + ' '.join(w.title() for w in parts[1:])


def get_driver(result):
    # Alias lookup happens on the raw (stripped, un-normalized) name first -
    # DRIVER_NAME_ALIASES is keyed by each bundle's exact original spelling
    # (e.g. "Daryl DeLeon", not title-cased "Deleon"), so normalizing before
    # the alias check would silently break the match.
    raw = (result.get("driver") or "").strip()
    if raw in DRIVER_NAME_ALIASES:
        return DRIVER_NAME_ALIASES[raw]
    return normalize_name(raw)


def load_year_rounds(year):
    """Return raw `rounds` for a year, or None if no source file exists."""
    season_file = SEASON_DIR / f"season_{year}.json"
    if season_file.exists():
        return json.loads(season_file.read_text())["rounds"]
    results_file = DATA_DIR / f"results{year}.json"
    if results_file.exists():
        return json.loads(results_file.read_text())["rounds"]
    return None


def _new_stats():
    return {
        "points": 0, "wins": 0, "seconds": 0, "thirds": 0, "podiums": 0,
        "poles": 0, "fastestLaps": 0, "dnfs": 0,
    }


def compute_year_standings(rounds):
    """
    Given one year's raw `rounds`, return {driver_name: {points, wins,
    seconds, thirds, podiums, poles, fastestLaps, dnfs, pos, champion}}.
    """
    stats = defaultdict(_new_stats)

    # Pass 1: points (every session) + wins/podiums/fastestLaps (podium
    # sessions only).
    for rnd in rounds:
        for race in rnd.get("races", []):
            label = race.get("label")
            for r in race.get("results", []):
                driver = get_driver(r)
                if not driver:
                    continue
                s = stats[driver]
                s["points"] += r.get("points", 0) or 0
                if label not in PODIUM_SESSIONS:
                    continue
                pos = get_pos(r)
                if pos == 1:
                    s["wins"] += 1
                    s["podiums"] += 1
                elif pos == 2:
                    s["seconds"] += 1
                    s["podiums"] += 1
                elif pos == 3:
                    s["thirds"] += 1
                    s["podiums"] += 1
                if get_flag(r, "fl", "fastestLap"):
                    s["fastestLaps"] += 1

    # Pass 2: poles - one per round, credited to whoever has the flag set in
    # any podium session of that round (matches compute_records.py's
    # approach; guards against double-counting if the flag were ever
    # redundantly set on more than one entry in the same round).
    for rnd in rounds:
        pole_driver = None
        for race in rnd.get("races", []):
            if race.get("label") not in PODIUM_SESSIONS:
                continue
            for r in race.get("results", []):
                if get_flag(r, "p", "pole"):
                    pole_driver = get_driver(r)
                    break
            if pole_driver:
                break
        if pole_driver:
            stats[pole_driver]["poles"] += 1

    # Pass 3: DNFs, grouped by (driver, round) to apply the whole-round-blank
    # heuristic described in the module docstring.
    for rnd in rounds:
        driver_entries = defaultdict(list)
        for race in rnd.get("races", []):
            if race.get("label") not in PODIUM_SESSIONS:
                continue
            for r in race.get("results", []):
                driver = get_driver(r)
                if not driver:
                    continue
                driver_entries[driver].append(r)
        for driver, entries in driver_entries.items():
            whole_round_blank = all(
                get_pos(e) == 0 and (e.get("laps", 0) or 0) == 0
                for e in entries
            )
            if whole_round_blank:
                continue
            for e in entries:
                if get_pos(e) == 0:
                    stats[driver]["dnfs"] += 1

    # Rank by (points desc, wins desc, seconds desc, thirds desc) per reg
    # 1.6.9-1.6.10 ("...and so on until a winner emerges"). A full tie beyond
    # thirds has never been observed at this level; name is the final,
    # arbitrary-but-deterministic tiebreak so output never depends on dict
    # iteration order.
    ranked = sorted(
        stats.items(),
        key=lambda kv: (-kv[1]["points"], -kv[1]["wins"], -kv[1]["seconds"], -kv[1]["thirds"], kv[0]),
    )
    result = {}
    for i, (driver, s) in enumerate(ranked, 1):
        s["pos"] = i
        s["champion"] = (i == 1)
        result[driver] = s
    return result


def compute_driver_history(driver_name, years):
    """For each requested year, return the computed entry, or None if no
    source file exists, or None if the driver didn't race that year."""
    out = {}
    for year in years:
        rounds = load_year_rounds(year)
        if rounds is None:
            out[year] = None
            continue
        out[year] = compute_year_standings(rounds).get(driver_name)
    return out


def verify_champions():
    """Cross-check: does this module's ranking correctly identify the actual
    champion for every year, independently of CHAMPIONS? Returns a list of
    (year, expected, computed) mismatches - empty if everything agrees."""
    mismatches = []
    for year, expected in CHAMPIONS.items():
        rounds = load_year_rounds(year)
        if rounds is None:
            mismatches.append((year, expected, "NO SOURCE FILE"))
            continue
        standings = compute_year_standings(rounds)
        champions_this_year = [d for d, s in standings.items() if s["pos"] == 1]
        computed = champions_this_year[0] if champions_this_year else None
        if computed != expected:
            mismatches.append((year, expected, computed))
    return mismatches


def _main():
    if len(sys.argv) > 1 and sys.argv[1] == "--verify-champions":
        mismatches = verify_champions()
        if mismatches:
            print(f"{len(CHAMPIONS) - len(mismatches)}/{len(CHAMPIONS)} correct")
            for year, expected, computed in mismatches:
                print(f"  MISMATCH {year}: expected {expected}, computed {computed}")
            sys.exit(1)
        print(f"{len(CHAMPIONS)}/{len(CHAMPIONS)} champions verified correctly")
        return

    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    driver_name = sys.argv[1]
    years = [int(y) for y in sys.argv[2:]] if len(sys.argv) > 2 else list(range(2004, 2026))
    history = compute_driver_history(driver_name, years)
    for year in years:
        entry = history[year]
        if entry is None:
            continue
        print(f"{year}: pos={entry['pos']} points={entry['points']} wins={entry['wins']} "
              f"podiums={entry['podiums']} poles={entry['poles']} "
              f"fastestLaps={entry['fastestLaps']} dnfs={entry['dnfs']} "
              f"champion={entry['champion']}")


if __name__ == "__main__":
    _main()
