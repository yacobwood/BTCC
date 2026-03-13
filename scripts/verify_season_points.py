#!/usr/bin/env python3
"""
Verify season JSONs for point consistency.
- Driver total (drivers[].points) must equal sum of points from all rounds.
- Progression cumulativePointsByRound must match cumulative sum of points per round.
Reports any mismatches for spot-checking.
"""
import json
import os

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS_DIR = os.path.join(REPO_ROOT, "app", "src", "main", "assets", "data")

# Same aliases and title-case as excel_to_season_json (Excel name -> name in rounds)
def _title_case_driver(name):
    s = (name or "").strip()
    if not s:
        return s
    return " ".join("-".join(p.capitalize() for p in w.split("-")) for w in s.split())

DRIVER_NAME_ALIASES = {
    2014: {"Rob Collard": "Robert Collard", "Árón Smith": "Aron Taylor-Smith", "Daniel Welch": "Dan Welch"},
    2015: {"Rob Collard": "Robert Collard", "Árón Smith": "Aron Taylor-Smith", "Daniel Welch": "Dan Welch", "Derek Palmer Jr.": "Derek Palmer"},
    2016: {"Rob Collard": "Robert Collard", "Árón Smith": "Aron Taylor-Smith"},
    2017: {"Rob Collard": "Robert Collard", "Robert Huff": "Rob Huff", "Árón Taylor-Smith": "Aron Taylor-Smith"},
    2018: {"Rob Collard": "Robert Collard"},
    2019: {"Rob Collard": "Robert Collard"},
    2020: {"Nicolas Hamilton": "Nic Hamilton"},
    2021: {"Árón Taylor-Smith": "Aron Taylor-Smith"},
    2022: {"Árón Taylor-Smith": "Aron Taylor-Smith"},
    2023: {"Árón Taylor-Smith": "Aron Taylor-Smith", "Nicolas Hamilton": "Nic Hamilton", "Robert Huff": "Rob Huff", "Daryl DeLeon": "Daryl Deleon"},
    2024: {"Daryl DeLeon": "Daryl Deleon"},
    2025: {"Daryl DeLeon": "Daryl Deleon"},
}


def driver_totals_from_rounds(rounds):
    """Same logic as excel_to_season_json: sum points per driver across all rounds."""
    totals = {}
    for round_obj in rounds:
        for race in round_obj.get("races") or []:
            for res in race.get("results") or []:
                name = (res.get("driver") or "").strip()
                if name:
                    totals[name] = totals.get(name, 0) + res.get("points", 0)
    return totals


def cumulative_by_round_from_rounds(rounds):
    """Same logic as compute_progression: cumulative points per round per driver."""
    sorted_rounds = sorted(rounds, key=lambda r: r.get("round", 0))
    points_per_round = {}
    for round_obj in sorted_rounds:
        for race in round_obj.get("races") or []:
            for res in race.get("results") or []:
                name = (res.get("driver") or "").strip()
                if name and name not in points_per_round:
                    points_per_round[name] = []
    for round_obj in sorted_rounds:
        round_pts = {}
        for race in round_obj.get("races") or []:
            for res in race.get("results") or []:
                name = (res.get("driver") or "").strip()
                if name:
                    round_pts[name] = round_pts.get(name, 0) + res.get("points", 0)
        for name in points_per_round:
            points_per_round[name].append(round_pts.get(name, 0))
    cumulative = {}
    for driver, per_round in points_per_round.items():
        s = 0
        cum = []
        for p in per_round:
            s += p
            cum.append(s)
        cumulative[driver] = cum
    return cumulative


def verify_season(path, year=None):
    if year is None:
        try:
            basename = os.path.basename(path)
            year = int(basename.replace("season_", "").replace(".json", ""))
        except ValueError:
            year = 0
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    rounds = data.get("rounds") or []
    drivers = data.get("drivers") or []
    progression = {p["driver"]: p.get("cumulativePointsByRound", []) for p in data.get("progression") or []}

    recomputed_totals = driver_totals_from_rounds(rounds)
    recomputed_cum = cumulative_by_round_from_rounds(rounds)

    errors = []

    def get_computed_total(driver_name):
        key = driver_name
        if key in recomputed_totals:
            return recomputed_totals[key]
        key = DRIVER_NAME_ALIASES.get(year, {}).get(driver_name)
        if key and key in recomputed_totals:
            return recomputed_totals[key]
        key = _title_case_driver(driver_name)
        return recomputed_totals.get(key, 0)

    # Check each driver's total
    for d in drivers:
        name = (d.get("name") or "").strip()
        if not name:
            continue
        stored = d.get("points", 0)
        computed = get_computed_total(name)
        if stored != computed:
            errors.append(f"  Driver total: {name!r} stored={stored} computed={computed}")

    # Compare progression cumulativePointsByRound (progression uses round names / title case)
    def get_computed_cum(driver_name):
        if driver_name in recomputed_cum:
            return recomputed_cum[driver_name]
        key = DRIVER_NAME_ALIASES.get(year, {}).get(driver_name)
        if key and key in recomputed_cum:
            return recomputed_cum[key]
        return recomputed_cum.get(_title_case_driver(driver_name), [])

    for driver, stored_cum in progression.items():
        computed_cum = get_computed_cum(driver)
        if stored_cum != computed_cum:
            errors.append(
                f"  Progression: {driver!r} stored={stored_cum} computed={computed_cum}"
            )

    return errors


def main():
    if not os.path.isdir(ASSETS_DIR):
        print("Assets dir not found:", ASSETS_DIR)
        return
    years = []
    for name in sorted(os.listdir(ASSETS_DIR)):
        if name.startswith("season_") and name.endswith(".json"):
            try:
                y = int(name.replace("season_", "").replace(".json", ""))
                years.append((y, os.path.join(ASSETS_DIR, name)))
            except ValueError:
                pass
    if not years:
        print("No season_YYYY.json files found")
        return
    total_errors = 0
    for year, path in years:
        errs = verify_season(path, year=year)
        if errs:
            print(f"{year}: {len(errs)} error(s)")
            for e in errs:
                print(e)
            total_errors += len(errs)
        else:
            print(f"{year}: OK")
    if total_errors:
        print(f"\nTotal: {total_errors} discrepancy(ies)")
    else:
        print("\nAll seasons consistent (totals and progression match round data).")


if __name__ == "__main__":
    main()
