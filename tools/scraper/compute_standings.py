#!/usr/bin/env python3
"""Compute championship standings from race results JSON files.
   Reads data/results{year}.json and prints to stdout; with --write writes data/standings.json
   for the app (used by cron to push new scraped data)."""
import json
import sys
from pathlib import Path
from collections import defaultdict

POINTS_QUALIFYING = {1: 10, 2: 9, 3: 8, 4: 7, 5: 6, 6: 5, 7: 4, 8: 3, 9: 2, 10: 1}
POINTS_RACE       = {1: 20, 2: 17, 3: 15, 4: 13, 5: 11, 6: 10, 7: 9, 8: 8, 9: 7, 10: 6, 11: 5, 12: 4, 13: 3, 14: 2, 15: 1}

# Repo root (parent of scraper/)
REPO_ROOT = Path(__file__).resolve().parent.parent.parent
DATA_DIR = REPO_ROOT / "data"


def fastest_lap(results: list):
    """Return the driver name with the fastest bestLap among classified finishers."""
    def to_secs(t):
        try:
            m, s = t.split(":")
            return int(m) * 60 + float(s)
        except Exception:
            return float("inf")

    finishers = [r for r in results if r.get("pos", 0) > 0 and r.get("bestLap")]
    if not finishers:
        return None
    return min(finishers, key=lambda r: to_secs(r["bestLap"]))["driver"]


def compute(year: int, data: dict):
    driver_points = defaultdict(int)
    driver_wins = defaultdict(int)
    driver_seconds = defaultdict(int)
    driver_thirds = defaultdict(int)
    driver_team = {}
    driver_car = {}
    team_points = defaultdict(int)
    last_round = 0
    last_venue = ""

    for rnd in data["rounds"]:
        if any(race.get("results") for race in rnd["races"]):
            last_round = rnd["round"]
            last_venue = rnd.get("venue", "")
        for race in rnd["races"]:
            is_qualifying = "qualifying" in race.get("label", "").lower()
            pts_table = POINTS_QUALIFYING if is_qualifying else POINTS_RACE
            fl_driver = fastest_lap(race["results"]) if not is_qualifying else None
            for r in race["results"]:
                d = r["driver"]
                pos = r["pos"]
                pts = pts_table.get(pos, 0) if pos > 0 else 0
                if d == fl_driver:
                    pts += 1  # fastest lap bonus
                driver_points[d] += pts
                driver_team[d] = r.get("team", "")
                driver_car[d] = str(r.get("no", ""))
                if not is_qualifying:
                    if pos == 1:
                        driver_wins[d] += 1
                    elif pos == 2:
                        driver_seconds[d] += 1
                    elif pos == 3:
                        driver_thirds[d] += 1
                team_points[r.get("team", "")] += pts

    drivers = sorted(driver_points.items(), key=lambda x: -x[1])
    teams = sorted(team_points.items(), key=lambda x: -x[1])

    return {
        "drivers": [
            {
                "pos": i,
                "driver": name,
                "team": driver_team[name],
                "car": driver_car[name],
                "points": pts,
                "wins": driver_wins[name],
                "seconds": driver_seconds[name],
                "thirds": driver_thirds[name],
            }
            for i, (name, pts) in enumerate(drivers, 1)
        ],
        "teams": [
            {"pos": i, "team": name, "points": pts}
            for i, (name, pts) in enumerate(teams, 1)
        ],
        "last_round": last_round,
        "last_venue": last_venue,
    }


def main():
    write_mode = "--write" in sys.argv
    args = [a for a in sys.argv[1:] if a != "--write"]
    year = int(args[0]) if args else 2026

    path = DATA_DIR / f"results{year}.json"
    if not path.exists():
        print(f"Error: {path} not found. Run scraper to produce results{year}.json first.", file=sys.stderr)
        sys.exit(1)

    data = json.loads(path.read_text())
    out = compute(year, data)

    if write_mode:
        standings_path = DATA_DIR / "standings.json"
        payload = {
            "season": str(year),
            "round": out["last_round"],
            "venue": out["last_venue"],
            "standings": out["drivers"],
            "teams": out["teams"],
        }
        standings_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        print(f"Wrote {standings_path}", file=sys.stderr)
    else:
        print(f"\n=== {year} Driver Standings ===")
        for i, (name, pts) in enumerate(
            [(d["driver"], d["points"]) for d in out["drivers"][:25]], 1
        ):
            wins = next(d["wins"] for d in out["drivers"] if d["driver"] == name)
            car = next(d["car"] for d in out["drivers"] if d["driver"] == name)
            print(f"  {i:2d}. {name:30s} #{car:4s}  {pts:4d} pts  {wins} wins")
        print(f"\n=== {year} Team Standings ===")
        for t in out["teams"][:12]:
            print(f"  {t['pos']:2d}. {t['team']:45s}  {t['points']:4d} pts")


if __name__ == "__main__":
    main()
