#!/usr/bin/env python3
"""
Fetch historical BTCC season data from the Motorsport Stats API and generate
three files per year:

  motorsportstats/{year}.json              — raw MSS API response (mirrors
                                             the existing 2014-2025 files)
  data/results{year}.json                  — round-by-round race results
                                             (fetched from GitHub at runtime)
  app/src/main/assets/data/season_{year}.json  — standings + rounds bundled
                                             in the APK

Usage:
    python scripts/fetch_mss_historical.py            # all years 2004-2013
    python scripts/fetch_mss_historical.py 2004       # single year
    python scripts/fetch_mss_historical.py 2004 2008  # year range (inclusive)

Notes:
  - Car numbers and lap-by-lap timing are not available from this API.
    Run motorsportstats/inject_timing.js afterwards to enrich timing fields.
  - Team standings API is unavailable for pre-2014 years; teams are computed
    from driver data (points/wins/podiums summed per team).
  - Dates are approximate (month + year) derived from known BTCC calendar.
"""

import json
import sys
import time
import urllib.request
from collections import defaultdict
from pathlib import Path

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

REPO_ROOT  = Path(__file__).parent.parent
MSS_DIR    = REPO_ROOT / "motorsportstats"
DATA_DIR   = REPO_ROOT / "data"
ASSETS_DIR = REPO_ROOT / "app" / "src" / "main" / "assets" / "data"

# ---------------------------------------------------------------------------
# Known approximate round dates per year
# These are "Month YYYY" strings used for display only.
# Sourced from historical BTCC calendars.
# ---------------------------------------------------------------------------

ROUND_DATES: dict[int, list[str]] = {
    2004: ["Apr 2004","May 2004","May 2004","Jun 2004","Jul 2004","Jul 2004","Aug 2004","Sep 2004","Sep 2004","Oct 2004"],
    2005: ["Apr 2005","May 2005","May 2005","Jun 2005","Jul 2005","Jul 2005","Aug 2005","Sep 2005","Sep 2005","Oct 2005"],
    2006: ["Apr 2006","May 2006","May 2006","Jun 2006","Jul 2006","Jul 2006","Aug 2006","Sep 2006","Sep 2006","Oct 2006"],
    2007: ["Apr 2007","May 2007","May 2007","Jun 2007","Jul 2007","Jul 2007","Aug 2007","Sep 2007","Sep 2007","Oct 2007"],
    2008: ["Apr 2008","May 2008","May 2008","Jun 2008","Jul 2008","Jul 2008","Aug 2008","Sep 2008","Sep 2008","Oct 2008"],
    2009: ["Apr 2009","May 2009","May 2009","Jun 2009","Jul 2009","Jul 2009","Aug 2009","Sep 2009","Sep 2009","Oct 2009"],
    2010: ["Apr 2010","May 2010","May 2010","Jun 2010","Jul 2010","Jul 2010","Aug 2010","Sep 2010","Sep 2010","Oct 2010"],
    2011: ["Apr 2011","May 2011","May 2011","Jun 2011","Jul 2011","Jul 2011","Aug 2011","Sep 2011","Sep 2011","Oct 2011"],
    2012: ["Apr 2012","May 2012","May 2012","Jun 2012","Jul 2012","Jul 2012","Aug 2012","Sep 2012","Sep 2012","Oct 2012"],
    2013: ["Apr 2013","May 2013","May 2013","Jun 2013","Jul 2013","Jul 2013","Aug 2013","Sep 2013","Sep 2013","Oct 2013"],
}

# ---------------------------------------------------------------------------
# HTTP helper
# ---------------------------------------------------------------------------

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) "
                  "Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json",
    "Referer": "https://www.motorsportstats.com/",
}


def fetch_json(url: str) -> dict | None:
    req = urllib.request.Request(url, headers=HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            body = resp.read()
            if not body.strip():
                return None
            return json.loads(body)
    except Exception as e:
        print(f"    ERROR fetching {url}: {e}")
        return None


def fetch_driver_standings(year: int) -> dict | None:
    url = (
        f"https://www.motorsportstats.com/api/series-standings"
        f"?seasonUuid=british-touring-car-championship_{year}"
        f"&standingsType=driver&seriesClass="
    )
    return fetch_json(url)


# ---------------------------------------------------------------------------
# Processing helpers
# ---------------------------------------------------------------------------

def build_race_index(races: list[dict]) -> dict[int, dict]:
    """
    Maps raceNumberInSeason → {eventNumber, eventName, eventSlug,
                                raceNumber, raceNumberInSeason}.
    """
    return {r["raceNumberInSeason"]: r for r in races}


def invert_to_per_race(standings: list[dict]) -> dict[int, list[dict]]:
    """
    Returns a map: raceNumberInSeason → sorted list of driver results.
    Each entry: {driver, team, finishPos, gridPos, points, fl, classified, retirement}
    """
    per_race: dict[int, list[dict]] = defaultdict(list)
    for st in standings:
        driver_name = st["driver"]["name"]
        team_name   = st["teams"][0]["name"] if st.get("teams") else ""
        for r in st.get("races", []):
            per_race[r["raceNumberInSeason"]].append({
                "driver":     driver_name,
                "team":       team_name,
                "finishPos":  r["finishPosition"],
                "gridPos":    r["gridPosition"],
                "points":     r["points"],
                "fl":         bool(r.get("fastestLap")),
                "classified": r.get("classified", "CLA"),
                "retirement": r.get("retirement"),
            })

    # Sort each race: classified first by position, then unclassified
    for race_num, entries in per_race.items():
        entries.sort(key=lambda e: (
            0 if e["classified"] == "CLA" else 1,
            e["finishPos"] if e["classified"] == "CLA" else 999,
        ))

    return per_race


def build_rounds(
    races: list[dict],
    per_race: dict[int, list[dict]],
    year: int,
) -> list[dict]:
    """
    Groups races into rounds (events) and formats them for results{year}.json.
    """
    # Build ordered event list
    seen_events: dict[int, dict] = {}
    for r in races:
        ev_num = r["eventNumber"]
        if ev_num not in seen_events:
            seen_events[ev_num] = r

    dates = ROUND_DATES.get(year, [])
    rounds = []

    for ev_num in sorted(seen_events):
        ev = seen_events[ev_num]
        ev_slug  = ev["event"]["slug"]
        ev_name  = ev["event"]["name"]
        round_no = ev_num
        date_str = dates[ev_num - 1] if ev_num - 1 < len(dates) else f"{year}"

        # Find all raceNumberInSeason for this event
        ev_races = sorted(
            [r for r in races if r["eventNumber"] == ev_num],
            key=lambda r: r["raceNumber"],
        )

        built_races = []
        for ev_race in ev_races:
            race_num_in_ev  = ev_race["raceNumber"]
            race_num_in_sea = ev_race["raceNumberInSeason"]
            label = f"Race {race_num_in_ev}"

            entries = per_race.get(race_num_in_sea, [])
            results = []
            for e in entries:
                pos = e["finishPos"] if e["classified"] == "CLA" else 0
                results.append({
                    "pos":      pos,
                    "no":       0,            # not available from API
                    "driver":   e["driver"],
                    "team":     e["team"],
                    "laps":     0,            # not available from API
                    "time":     "",           # not available from API
                    "gap":      "",           # not available from API
                    "bestLap":  "",           # not available from API
                    "points":   e["points"],
                    "fl":       e["fl"],
                    "p":        e["gridPos"] == 1 and race_num_in_ev == 1,
                    "avgLapSpeed": "",        # not available from API
                })

            built_races.append({"label": label, "results": results})

        rounds.append({
            "round":  round_no,
            "venue":  ev_name,
            "date":   date_str,
            "races":  built_races,
        })

    return rounds


def build_driver_standings(
    standings: list[dict],
    per_race: dict[int, list[dict]],
) -> list[dict]:
    """Formats driver standings for season_{year}.json drivers array."""
    result = []
    for st in standings:
        wins = seconds = thirds = 0
        for r in st.get("races", []):
            if r.get("classified") == "CLA":
                if r["finishPosition"] == 1:   wins += 1
                elif r["finishPosition"] == 2: seconds += 1
                elif r["finishPosition"] == 3: thirds += 1
        result.append({
            "position": st["position"],
            "name":     st["driver"]["name"],
            "team":     st["teams"][0]["name"] if st.get("teams") else "",
            "points":   st["totalPoints"],
            "wins":     wins,
            "seconds":  seconds,
            "thirds":   thirds,
            "car":      "",    # not available from API
        })
    return result


def build_team_standings(standings: list[dict]) -> list[dict]:
    """Computes team standings by summing driver points, wins, etc."""
    teams: dict[str, dict] = {}
    for st in standings:
        team_name = st["teams"][0]["name"] if st.get("teams") else ""
        if not team_name:
            continue
        if team_name not in teams:
            teams[team_name] = {"points": 0, "wins": 0, "seconds": 0, "thirds": 0}
        t = teams[team_name]
        t["points"] += st["totalPoints"]
        for r in st.get("races", []):
            if r.get("classified") == "CLA":
                if r["finishPosition"] == 1:   t["wins"] += 1
                elif r["finishPosition"] == 2: t["seconds"] += 1
                elif r["finishPosition"] == 3: t["thirds"] += 1

    sorted_teams = sorted(teams.items(), key=lambda x: -x[1]["points"])
    return [
        {
            "position": i + 1,
            "name":     name,
            "points":   t["points"],
            "wins":     t["wins"],
            "seconds":  t["seconds"],
            "thirds":   t["thirds"],
        }
        for i, (name, t) in enumerate(sorted_teams)
    ]


def build_driver_stats(standings: list[dict], races: list[dict]) -> list[dict]:
    """Builds driverStats array for season_{year}.json."""
    # Map raceNumber in event → whether grid is Race 1 (qualifying result)
    # We need total counts per driver
    result = []
    for st in standings:
        driver_races = st.get("races", [])
        total   = len(driver_races)
        wins    = 0
        podiums = 0
        poles   = 0    # grid P1 in Race 1 of each event
        dnfs    = 0
        team_name = st["teams"][0]["name"] if st.get("teams") else ""

        # Build raceNumInSeason → raceNumber mapping from races
        race_num_map = {r["raceNumberInSeason"]: r["raceNumber"] for r in races}

        for r in driver_races:
            race_num_in_ev = race_num_map.get(r["raceNumberInSeason"], 1)
            if r.get("classified") == "CLA":
                if r["finishPosition"] == 1: wins += 1
                if r["finishPosition"] <= 3: podiums += 1
            else:
                dnfs += 1
            if r.get("gridPosition") == 1 and race_num_in_ev == 1:
                poles += 1

        result.append({
            "driver":  st["driver"]["name"],
            "team":    team_name,
            "races":   total,
            "wins":    wins,
            "podiums": podiums,
            "poles":   poles,
            "dnfs":    dnfs,
        })
    return result


def build_progression(standings: list[dict], races: list[dict]) -> list[dict]:
    """Builds cumulativePointsByRound for each driver."""
    # Map raceNumberInSeason → eventNumber
    race_to_event = {r["raceNumberInSeason"]: r["eventNumber"] for r in races}
    num_events    = max((r["eventNumber"] for r in races), default=0)

    result = []
    for st in standings:
        # Sum points per event
        points_by_event = defaultdict(int)
        for r in st.get("races", []):
            ev = race_to_event.get(r["raceNumberInSeason"], 0)
            points_by_event[ev] += r.get("points", 0)

        cumulative = []
        running = 0
        for ev_num in range(1, num_events + 1):
            running += points_by_event.get(ev_num, 0)
            cumulative.append(running)

        team_name = st["teams"][0]["name"] if st.get("teams") else ""
        result.append({
            "driver": st["driver"]["name"],
            "team":   team_name,
            "cumulativePointsByRound": cumulative,
        })
    return result


# ---------------------------------------------------------------------------
# Main per-year processor
# ---------------------------------------------------------------------------

def process_year(year: int) -> bool:
    print(f"\n{'='*55}\n  {year}\n{'='*55}")

    data = fetch_driver_standings(year)
    if not data:
        print(f"  SKIP — no data returned for {year}")
        return False

    races     = data.get("races", [])
    standings = data.get("standings", [])

    if not races or not standings:
        print(f"  SKIP — empty races or standings for {year}")
        return False

    print(f"  Races: {len(races)}  |  Drivers: {len(standings)}")

    per_race       = invert_to_per_race(standings)
    rounds         = build_rounds(races, per_race, year)
    driver_std     = build_driver_standings(standings, per_race)
    team_std       = build_team_standings(standings)
    driver_stats   = build_driver_stats(standings, races)
    progression    = build_progression(standings, races)

    # ---- motorsportstats/{year}.json (raw MSS format) ----
    mss_out = {
        "season":    data["season"],
        "races":     races,
        "standings": standings,
    }
    mss_path = MSS_DIR / f"{year}.json"
    mss_path.write_text(json.dumps(mss_out, indent=2))
    print(f"  ✓ motorsportstats/{year}.json")

    # ---- data/results{year}.json ----
    results_out = {
        "season": str(year),
        "rounds": rounds,
    }
    results_path = DATA_DIR / f"results{year}.json"
    results_path.write_text(json.dumps(results_out, indent=2))
    print(f"  ✓ data/results{year}.json")

    # ---- app/src/main/assets/data/season_{year}.json ----
    season_out = {
        "season":      str(year),
        "drivers":     driver_std,
        "teams":       team_std,
        "rounds":      rounds,
        "driverStats": driver_stats,
        "progression": progression,
    }
    season_path = ASSETS_DIR / f"season_{year}.json"
    season_path.write_text(json.dumps(season_out, indent=2))
    print(f"  ✓ app/.../data/season_{year}.json")

    return True


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main():
    args = sys.argv[1:]

    if len(args) == 0:
        years = list(range(2004, 2014))
    elif len(args) == 1:
        years = [int(args[0])]
    elif len(args) == 2:
        years = list(range(int(args[0]), int(args[1]) + 1))
    else:
        print("Usage: fetch_mss_historical.py [start_year [end_year]]")
        sys.exit(1)

    print(f"Processing years: {years}")

    for year in years:
        ok = process_year(year)
        if ok and year != years[-1]:
            time.sleep(1)  # be polite to the API

    print("\nDone. Run motorsportstats/inject_timing.js to enrich timing data.")


if __name__ == "__main__":
    main()
