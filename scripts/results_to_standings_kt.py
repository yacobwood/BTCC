#!/usr/bin/env python3
"""Generate Standings{year}.kt from results{year}.json for all years without team/car data."""
import json
import sys
import re
from pathlib import Path
from collections import defaultdict

REPO = Path(__file__).resolve().parent.parent
DATA_DIR = REPO / "data"
KT_DIR = REPO / "app/src/main/java/com/btccfanhub/data"

POINTS = {1: 25, 2: 20, 3: 16, 4: 13, 5: 11, 6: 10, 7: 9, 8: 8, 9: 7, 10: 6,
          11: 5, 12: 4, 13: 3, 14: 2, 15: 1}


def normalise_name(name: str) -> str:
    """Title-case all-caps names like 'Tom INGRAM' → 'Tom Ingram'."""
    parts = name.split()
    return " ".join(p.capitalize() if p.isupper() else p for p in parts)


def normalise_team(team: str) -> str:
    """Strip 'Team ' prefix and title-case all-caps multi-word team names."""
    t = re.sub(r'^Team\s+', '', team, flags=re.IGNORECASE).strip()
    # Only title-case if it's a multi-word all-caps string (not an abbreviation like BMW)
    if t.isupper() and len(t) > 5:
        t = t.title()
    return t


def compute(data: dict):
    driver_points = defaultdict(int)
    driver_wins = defaultdict(int)
    driver_team: dict[str, str] = {}
    driver_car: dict[str, str] = {}
    team_points: dict[str, int] = defaultdict(int)

    for rnd in data["rounds"]:
        for race in rnd["races"]:
            for r in race["results"]:
                d = normalise_name(r["driver"])
                pos = r["pos"]
                pts = POINTS.get(pos, 0)
                driver_points[d] += pts
                driver_team[d] = normalise_team(r.get("team", ""))
                driver_car[d] = str(r.get("no", ""))
                if pos == 1:
                    driver_wins[d] += 1
                team_points[normalise_team(r.get("team", ""))] += pts

    drivers = sorted(driver_points.items(), key=lambda x: -x[1])
    teams = sorted(team_points.items(), key=lambda x: -x[1])
    return drivers, teams, driver_team, driver_car, driver_wins


def kt_escape(s: str) -> str:
    return s.replace('"', '\\"')


def generate_kt(year: int, drivers, teams, driver_team, driver_car, driver_wins) -> str:
    lines = [
        f"package com.btccfanhub.data",
        "",
        "import com.btccfanhub.data.model.DriverStanding",
        "import com.btccfanhub.data.model.TeamStanding",
        "",
        f"/** Final {year} BTCC standings from race results. */",
        f"object Standings{year} {{",
        "",
        "    val drivers: List<DriverStanding> = listOf(",
    ]
    for i, (name, pts) in enumerate(drivers, 1):
        team = kt_escape(driver_team.get(name, ""))
        car = kt_escape(driver_car.get(name, ""))
        wins = driver_wins.get(name, 0)
        pad = max(1, 3 - len(str(i)))
        lines.append(
            f'        DriverStanding(position = {" " * pad}{i}, name = "{kt_escape(name)}", '
            f'team = "{team}", car = "{car}", points = {pts}, wins = {wins}),'
        )
    lines += [
        "    )",
        "",
        "    val teams: List<TeamStanding> = listOf(",
    ]
    for i, (name, pts) in enumerate(teams, 1):
        pad = max(1, 3 - len(str(i)))
        lines.append(
            f'        TeamStanding(position = {" " * pad}{i}, name = "{kt_escape(name)}", points = {pts}),'
        )
    lines += [
        "    )",
        "}",
        "",
    ]
    return "\n".join(lines)


def main():
    years = [int(a) for a in sys.argv[1:]] if len(sys.argv) > 1 else list(range(2015, 2026))

    for year in years:
        path = DATA_DIR / f"results{year}.json"
        if not path.exists():
            print(f"  skip {year}: no results file")
            continue
        data = json.loads(path.read_text())
        drivers, teams, driver_team, driver_car, driver_wins = compute(data)
        kt = generate_kt(year, drivers, teams, driver_team, driver_car, driver_wins)
        out = KT_DIR / f"Standings{year}.kt"
        out.write_text(kt, encoding="utf-8")
        print(f"  wrote {out.name}  ({len(drivers)} drivers, {len(teams)} teams)")


if __name__ == "__main__":
    main()
