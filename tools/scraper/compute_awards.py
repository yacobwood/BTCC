#!/usr/bin/env python3
"""
BTCC Hub Season Awards Computer

Reads data/results{year}.json, data/standings.json, data/penalties{year}.json
and data/results{year-1}.json to compute the BTCC Hub end-of-season awards
shown on AwardsScreen.

Writes data/awards{year}.json with published=false. The app only shows the
Awards button once that flag is flipped to true by hand, so the generated
file can be reviewed before the reveal.

Championship awards come straight from the official standings tables - the
Independents, Teams and Manufacturers championships have their own scoring
rules, so summing race points gives the wrong answer (it put Hyundai top of
the 2026 manufacturers when the official table has Ford).

Run once per season, after the final race has been scraped. Not wired into
any workflow.

Usage:
    python compute_awards.py [--year 2026] [--provisional] [--out path]
"""

import argparse
import json
import re
import statistics
import sys
import unicodedata
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

from compute_records import title_case

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
DATA_DIR = REPO_ROOT / "data"

RACE_SESSIONS = ("Qualifying Race", "Race 1", "Race 2", "Race 3")
# Official BTCC win/podium counts (standings.json "wins"/"seconds"/"thirds")
# only cover the three main races, not the Qualifying Race. Win and podium
# awards must match that or fans will see a different number than btcc.net.
MAIN_RACES = ("Race 1", "Race 2", "Race 3")
RUNNERS_UP = 2
# Rate-based awards only consider drivers who started at least this share of
# races, so a one-off stand-in can't win Mr Consistent from 3 starts.
MIN_RACE_SHARE = 0.75

# CPRL was renamed mid-season (rounds 1-6 keep the old name on purpose in the
# results data), so team aggregation must fold the old name into the new one.
TEAM_ALIASES = {"Cataclean Plato Racing": "CPRL"}


def norm(name):
    """Name key that survives TSL ('Daryl DE LEON'), BARC ('Daryl DeLeon')
    and accent ('Árón' vs 'Áron') differences between data sources."""
    if not name:
        return ""
    s = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z]", "", s.lower())


def lap_secs(s):
    m = re.match(r"^(?:(\d+):)?(\d+(?:\.\d+)?)$", (s or "").strip())
    return int(m.group(1) or 0) * 60 + float(m.group(2)) if m else None


def gap_secs(s):
    try:
        return float(s)
    except (TypeError, ValueError):
        return None  # "1 Lap", "" etc.


def is_classified(result):
    # DNFs are stored as pos 0 - must never count as a finishing position.
    return isinstance(result.get("pos"), int) and result["pos"] > 0


def race_sessions(results):
    for rnd in results["rounds"]:
        for sess in rnd["races"]:
            if sess["label"] in RACE_SESSIONS and sess["results"]:
                yield rnd, sess


def season_complete(results):
    last = results["rounds"][-1] if results["rounds"] else None
    if not last:
        return False
    race3 = next((s for s in last["races"] if s["label"] == "Race 3"), None)
    return bool(race3 and race3["results"])


def ranked(counter, *, reverse=True, tiebreak=None):
    """Sort (driver, value) pairs best-first, ties broken by tiebreak(driver)
    (lower is better), then by name so output is deterministic."""
    tb = tiebreak or (lambda _d: 0)
    sign = -1 if reverse else 1
    return sorted(counter.items(), key=lambda kv: (sign * kv[1], tb(kv[0]), kv[0]))


def award(id_, title, category, icon, rows, fmt, detail="", team_of=None):
    """rows: best-first list of (name, value[, extra]). fmt(value, extra)->str."""
    if not rows:
        return None
    team_of = team_of or {}

    def entry(row):
        name, value, extra = (row + (None,))[:3]
        return {"driver": title_case(name), "team": team_of.get(name, ""), "stat": fmt(value, extra)}

    top = entry(rows[0])
    return {
        "id": id_,
        "title": title,
        "category": category,
        "icon": icon,
        "winner": top["driver"],
        "team": top["team"],
        "stat": top["stat"],
        "detail": detail,
        "runnersUp": [{"driver": e["driver"], "stat": e["stat"]} for e in map(entry, rows[1:1 + RUNNERS_UP])],
    }


def championship_awards(standings):
    def driver_table(key):
        return [(r["driver"], r["points"]) for r in standings.get(key) or []]

    def team_table(key, name_key):
        return [(r[name_key], r["points"]) for r in standings.get(key) or []]

    def pts(v, _):
        return f"{v} pts"

    team_of = {r["driver"]: r.get("team", "") for k in ("standings", "independents", "jst") for r in standings.get(k) or []}
    # Team/manufacturer winners are not drivers - title_case would mangle
    # 'NAPA Racing UK', so keep their names exactly as the standings give them.
    out = [
        award("champion", "Champion", "championship", "emoji-events", driver_table("standings"), pts,
              "Drivers' Championship winner", team_of),
        award("independent", "Independent of the Year", "championship", "workspace-premium", driver_table("independents"), pts,
              "Independents' Trophy", team_of),
        award("jst", "Jack Sears Trophy", "championship", "school", driver_table("jst"), pts,
              "Jack Sears Trophy", team_of),
    ]
    for id_, title, key, name_key, icon in (
        ("team", "Team of the Year", "teams", "team", "groups"),
        ("independentTeam", "Independent Team of the Year", "independentsTeams", "team", "group-work"),
        ("manufacturer", "Manufacturer of the Year", "manufacturers", "manufacturer", "precision-manufacturing"),
    ):
        rows = team_table(key, name_key)
        if rows:
            out.append({
                "id": id_, "title": title, "category": "championship", "icon": icon,
                "winner": rows[0][0], "team": "", "stat": f"{rows[0][1]} pts", "detail": "Official standings",
                "runnersUp": [{"driver": n, "stat": f"{p} pts"} for n, p in rows[1:1 + RUNNERS_UP]],
            })
    return [a for a in out if a]


def stat_awards(results, prev_results=None, penalties=None):
    wins, podiums, poles, fastest, laps_led, dnfs, starts = (Counter() for _ in range(7))
    points, gained = Counter(), Counter()
    finishes = defaultdict(list)
    qual_pos = defaultdict(list)
    ideal_diff = defaultdict(list)
    win_venues = defaultdict(set)
    streak, best_streak = Counter(), Counter()
    team_of, top_speed = {}, {}
    climbs, wins_from_grid, margins = [], [], []
    total_races = 0

    for rnd in results["rounds"]:
        qual = next((s for s in rnd["races"] if s["label"] == "Qualifying"), None)
        for r in (qual or {}).get("results") or []:
            if is_classified(r):
                qual_pos[r["driver"]].append(r["pos"])
                if r["pos"] == 1:
                    poles[r["driver"]] += 1

    for rnd, sess in race_sessions(results):
        total_races += 1
        venue, label = rnd["venue"], sess["label"]
        grid = {g["driver"]: g["pos"] for g in sess.get("grid") or [] if g.get("pos")}
        best = None
        flagged = None
        for r in sess["results"]:
            d = r["driver"]
            team_of[d] = TEAM_ALIASES.get(r.get("team"), r.get("team", ""))
            starts[d] += 1
            points[d] += r.get("points") or 0
            # Fallback only, for sessions with no official fastestLap flag.
            # Only classified finishers count: the official flag went to
            # Chilton at Croft R3 2026 although Sutton (retired) was quicker.
            t = lap_secs(r.get("bestLap"))
            if t and is_classified(r) and (best is None or t < best[0]):
                best = (t, d)
            if r.get("fastestLap"):
                flagged = d
            if not is_classified(r):
                # Retirements count Races 1-3 only, same as wins/podiums.
                if label in MAIN_RACES:
                    dnfs[d] += 1
                streak[d] = 0
                continue
            p = r["pos"]
            finishes[d].append(p)
            main = label in MAIN_RACES
            if p == 1 and main:
                wins[d] += 1
                win_venues[d].add(venue)
                if d in grid:
                    wins_from_grid.append((d, grid[d], f"{venue} {label}"))
            if p <= 3 and main:
                podiums[d] += 1
            if (r.get("points") or 0) > 0:
                streak[d] += 1
                best_streak[d] = max(best_streak[d], streak[d])
            else:
                streak[d] = 0
            if d in grid:
                gained[d] += grid[d] - p
                climbs.append((d, grid[d] - p, (grid[d], p, f"{venue} {label}")))
        if label in MAIN_RACES:
            if flagged:
                fastest[flagged] += 1
            elif best:
                fastest[best[1]] += 1
        res = sess["results"]
        if len(res) > 1 and is_classified(res[1]):
            g = gap_secs(res[1].get("gap"))
            if g is not None:
                margins.append((res[0]["driver"], g, (res[1]["driver"], f"{venue} {label}")))
        for lap in sess.get("lapChart") or []:
            if lap.get("order"):
                laps_led[lap["order"][0]["driver"]] += 1
        for b in sess.get("bestSectors") or []:
            if b.get("diff") is not None:
                ideal_diff[b["driver"]].append(b["diff"])
        for trap in (sess.get("bestSpeeds") or {}).values():
            for e in trap or []:
                if e.get("mph") and e["mph"] > top_speed.get(e["driver"], (0,))[0]:
                    top_speed[e["driver"]] = (e["mph"], venue)

    min_starts = total_races * MIN_RACE_SHARE

    def pts_tb(d):
        return -points[d]

    def avg_qual(d):
        q = qual_pos.get(d)
        return sum(q) / len(q) if q else 99

    def plural(n, word):
        return f"{n} {word}{'' if n == 1 else 's'}"

    avg_finish = {d: sum(v) / len(v) for d, v in finishes.items() if starts[d] >= min_starts and v}
    # Median, not mean: one disrupted race can leave a best lap 10s+ off the
    # ideal (Morgan, Thruxton R3 2026: 16.7s) and swamp a whole season.
    avg_ideal = {d: statistics.median(v) for d, v in ideal_diff.items() if starts[d] >= min_starts and v}

    climbs.sort(key=lambda c: (-c[1], c[2][1], c[0]))
    wins_from_grid.sort(key=lambda w: (-w[1], w[0]))
    margins_close = sorted(margins, key=lambda m: m[1])
    margins_big = sorted(margins, key=lambda m: -m[1])
    speeds = sorted(((d, v[0], v[1]) for d, v in top_speed.items()), key=lambda s: (-s[1], s[0]))

    T = team_of
    out = [
        award("wins", "Race Winner of the Year", "stat", "flag", ranked(wins, tiebreak=pts_tb),
              lambda v, _: plural(v, "win"), "Most race wins", T),
        award("podiums", "Podium King", "stat", "military-tech", ranked(podiums, tiebreak=pts_tb),
              lambda v, _: plural(v, "podium"), "Most top-three finishes", T),
        award("poles", "Pole Position Award", "stat", "timer", ranked(poles, tiebreak=avg_qual),
              lambda v, _: plural(v, "pole"), "Most poles - ties split on average qualifying position", T),
        award("fastestLaps", "Fastest Lap King", "stat", "speed", ranked(fastest, tiebreak=pts_tb),
              lambda v, _: plural(v, "fastest lap"), "Most official race fastest laps (Races 1-3)", T),
        award("lapsLed", "Front-runner", "stat", "trending-up", ranked(laps_led, tiebreak=pts_tb),
              lambda v, _: plural(v, "lap") + " led", "Most laps led", T),
        award("consistent", "Mr Consistent", "stat", "straighten", ranked(avg_finish, reverse=False, tiebreak=pts_tb),
              lambda v, _: f"P{v:.2f} average", "Best average finishing position", T),
        award("ironMan", "Iron Man", "stat", "bolt", ranked(best_streak, tiebreak=pts_tb),
              lambda v, _: plural(v, "race") + " in a row", "Longest run of points finishes", T),
        award("overtaker", "Overtaker of the Year", "stat", "swap-vert", ranked(gained, tiebreak=pts_tb),
              lambda v, _: f"+{v} places", "Most places gained from grid to flag", T),
        award("charge", "Charge of the Year", "stat", "rocket-launch", climbs,
              lambda v, x: f"P{x[0]} to P{x[1]}, {x[2]}", "Biggest climb in a single race", T),
        award("furthestBack", "Win from Furthest Back", "stat", "keyboard-double-arrow-up",
              [(d, g, venue) for d, g, venue in wins_from_grid],
              lambda v, x: f"Won from P{v}, {x}", "Lowest grid slot converted into a win", T),
        award("closestFinish", "Closest Finish", "stat", "compare-arrows", margins_close,
              lambda v, x: f"by {v:.3f}s over {title_case(x[0])}, {x[1]}", "Smallest winning margin", T),
        award("dominantWin", "Most Dominant Win", "stat", "flash-on", margins_big,
              lambda v, x: f"by {v:.3f}s, {x[1]}", "Biggest winning margin", T),
        award("perfectLap", "Perfect Lap", "stat", "gps-fixed", ranked(avg_ideal, reverse=False, tiebreak=pts_tb),
              lambda v, _: f"{v:.3f}s off ideal", "Best lap closest to their ideal lap (season median)", T),
        award("topSpeed", "Top Speed", "stat", "speed", speeds,
              lambda v, x: f"{v:.1f} mph, {x}", "Fastest speed-trap reading of the season", T),
        award("hardLuck", "Hard Luck Award", "stat", "car-crash", ranked(dnfs, tiebreak=pts_tb),
              lambda v, _: plural(v, "DNF"), "Most retirements", T),
    ]

    if prev_results:
        prev_pts = Counter()
        for _rnd, sess in race_sessions(prev_results):
            for r in sess["results"]:
                prev_pts[norm(r["driver"])] += r.get("points") or 0
        prev_rank = {k: i + 1 for i, (k, _) in enumerate(prev_pts.most_common())}
        cur_rank = {d: i + 1 for i, (d, _) in enumerate(ranked(points))}
        improved = Counter()
        positions = {}
        for d, pos in cur_rank.items():
            if norm(d) in prev_rank:
                improved[d] = prev_rank[norm(d)] - pos
                positions[d] = (prev_rank[norm(d)], pos)
        rows = [(d, v, positions[d]) for d, v in ranked(improved, tiebreak=pts_tb) if v > 0]
        out.append(award("improved", "Most Improved", "stat", "show-chart", rows,
                         lambda v, x: f"P{x[0]} to P{x[1]}", "Biggest championship climb on last season", T))

    if penalties:
        display = {norm(d): d for d in starts}
        pen = Counter()
        for rnd in penalties.get("rounds") or []:
            for p in rnd.get("penalties") or []:
                pen[display.get(norm(p.get("driver")), p.get("driver"))] += 1
        out.append(award("naughtyStep", "Naughty Step", "stat", "gavel", ranked(pen, tiebreak=pts_tb),
                         lambda v, _: plural(v, "penalty").replace("penaltys", "penalties"),
                         "Most stewards' decisions", T))

    return [a for a in out if a]


SESSION_SLUGS = {"Qualifying Race": "qualifying-race", "Race 1": "race-1", "Race 2": "race-2", "Race 3": "race-3"}
WET_TRACK = ("Wet", "Damp")


def load_analysis(year, results, data_dir=None):
    """{(round, label): analysis json} for the main races that have one."""
    base = (data_dir or DATA_DIR) / "analysis" / str(year)
    out = {}
    for rnd in results["rounds"]:
        for label in MAIN_RACES:
            f = base / f"round{rnd['round']}" / f"{SESSION_SLUGS[label]}.json"
            if f.exists():
                out[(rnd["round"], label)] = json.loads(f.read_text())
    return out


def extra_awards(results, analysis=None):
    """Awards added 2026-10-11: everything here uses Races 1-3 only."""
    analysis = analysis or {}
    team_of, points, wins, podiums, r3_points, starts = {}, Counter(), Counter(), Counter(), Counter(), Counter()
    qual_pos, wet_pos = defaultdict(list), defaultdict(list)
    h2h = defaultdict(lambda: [0, 0])
    sectors, launch, spread = Counter(), Counter(), defaultdict(list)

    for rnd in results["rounds"]:
        qual = next((s for s in rnd["races"] if s["label"] == "Qualifying"), None)
        for r in (qual or {}).get("results") or []:
            if is_classified(r):
                qual_pos[r["driver"]].append(r["pos"])
        for sess in rnd["races"]:
            label = sess["label"]
            if label not in MAIN_RACES or not sess["results"]:
                continue
            wet = (sess.get("weather") or {}).get("track") in WET_TRACK
            by_team = defaultdict(list)
            for r in sess["results"]:
                d = r["driver"]
                team_of[d] = TEAM_ALIASES.get(r.get("team"), r.get("team", ""))
                starts[d] += 1
                points[d] += r.get("points") or 0
                if label == "Race 3":
                    r3_points[d] += r.get("points") or 0
                if not is_classified(r):
                    continue
                if r["pos"] == 1:
                    wins[d] += 1
                if r["pos"] <= 3:
                    podiums[d] += 1
                if wet:
                    wet_pos[d].append(r["pos"])
                by_team[team_of[d]].append((r["pos"], d))
            # Team-mate head-to-head only counts races both cars finished.
            for cars in by_team.values():
                cars.sort()
                for i in range(len(cars)):
                    for j in range(i + 1, len(cars)):
                        key = tuple(sorted((cars[i][1], cars[j][1])))
                        h2h[key][0 if key[0] == cars[i][1] else 1] += 1

            an = analysis.get((rnd["round"], label))
            if not an:
                continue
            no2d = {r["no"]: r["driver"] for r in sess["results"]}
            grid = {g["driver"]: g["pos"] for g in sess.get("grid") or [] if g.get("pos")}
            best = {}
            lap1 = []
            for e in an.get("laps") or []:
                d = no2d.get(e["no"])
                if not d:
                    continue
                laps = [l for l in e["laps"] if l.get("t")]
                if laps:
                    lap1.append((laps[0]["t"], d))
                for l in e["laps"]:
                    for i, v in enumerate(l.get("s") or []):
                        if v and (i not in best or v < best[i][0]):
                            best[i] = (v, d)
                # Lap-time spread: ignore the opening laps and anything 3%
                # off the driver's median (safety cars, incidents, pit lane).
                ts = [l["t"] for l in laps[2:]]
                if len(ts) >= 8:
                    med = statistics.median(ts)
                    clean = [t for t in ts if t < med * 1.03]
                    if len(clean) >= 8:
                        spread[d].append(statistics.pstdev(clean))
            for _v, d in best.values():
                sectors[d] += 1
            for pos, (_t, d) in enumerate(sorted(lap1), start=1):
                if d in grid:
                    launch[d] += grid[d] - pos

    def pts_tb(d):
        return -points[d]

    def plural(n, word):
        return f"{n} {word}{'' if n == 1 else 's'}"

    min_starts = max(starts.values(), default=0) * MIN_RACE_SHARE
    T = team_of
    out = [
        award("knockingOnTheDoor", "Knocking on the Door", "stat", "door-front",
              ranked(Counter({d: n for d, n in podiums.items() if not wins[d]}), tiebreak=pts_tb),
              lambda v, _: plural(v, "podium") + ", no wins", "Most podiums without a win", T),
        award("sectorKing", "Sector King", "stat", "timer", ranked(sectors, tiebreak=pts_tb),
              lambda v, _: plural(v, "sector"), "Most fastest sectors in races", T),
        award("reverseGrid", "Reverse Grid King", "stat", "swap-vert", ranked(r3_points, tiebreak=pts_tb),
              lambda v, _: f"{v} pts", "Most points from the reverse grid Race 3s", T),
        award("saturday", "Saturday Specialist", "stat", "event",
              ranked({d: sum(v) / len(v) for d, v in qual_pos.items() if len(v) >= len(results["rounds"]) * MIN_RACE_SHARE},
                     reverse=False, tiebreak=pts_tb),
              lambda v, _: f"P{v:.1f} average", "Best average qualifying position", T),
        award("launch", "Launch Control", "stat", "rocket-launch", ranked(launch, tiebreak=pts_tb),
              lambda v, _: f"+{v} places", "Most places gained on the opening lap", T),
        award("rain", "Rain Master", "stat", "water-drop",
              ranked({d: sum(v) / len(v) for d, v in wet_pos.items() if len(v) >= 3}, reverse=False, tiebreak=pts_tb),
              lambda v, _: f"P{v:.1f} average", "Best average finish in wet or damp races (min 3)", T),
        award("metronome", "Metronome", "stat", "av-timer",
              ranked({d: sum(v) / len(v) for d, v in spread.items() if starts[d] >= min_starts and len(v) >= 10},
                     reverse=False, tiebreak=pts_tb),
              lambda v, _: f"{v:.2f}s lap spread", "Most consistent race lap times", T),
    ]
    pairs = [(abs(a - b), a + b, key, (a, b)) for key, (a, b) in h2h.items() if a + b >= 15]
    if pairs:
        pairs.sort(key=lambda p: (p[0], -p[1], p[2]))
        out.append({
            "id": "closestTeammates", "title": "Closest Team-mates", "category": "stat", "icon": "people",
            "winner": " and ".join(title_case(n) for n in pairs[0][2]),
            "team": team_of.get(pairs[0][2][0], ""),
            "stat": f"{max(pairs[0][3])}-{min(pairs[0][3])}",
            "detail": "Tightest head-to-head in races both cars finished",
            "runnersUp": [{"driver": " and ".join(title_case(n) for n in k), "stat": f"{max(sc)}-{min(sc)}"}
                          for _d, _n, k, sc in pairs[1:1 + RUNNERS_UP]],
        })
    return [a for a in out if a]


def build_awards(year, results, standings, prev_results=None, penalties=None, analysis=None):
    if str(standings.get("season")) != str(year):
        raise ValueError(f"standings.json is for season {standings.get('season')}, not {year}")
    return {
        "season": year,
        "generatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "published": False,
        "awards": championship_awards(standings) + stat_awards(results, prev_results, penalties)
                  + extra_awards(results, analysis),
    }


def load(path):
    return json.loads(path.read_text()) if path.exists() else None


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--year", type=int, default=datetime.now().year)
    ap.add_argument("--provisional", action="store_true",
                    help="write even though the final race has no results yet")
    ap.add_argument("--out", type=Path, help="output path (default data/awards{year}.json)")
    args = ap.parse_args(argv)

    results = load(DATA_DIR / f"results{args.year}.json")
    standings = load(DATA_DIR / "standings.json")
    if not results or not standings:
        print("Missing results or standings file", file=sys.stderr)
        return 1
    if not season_complete(results) and not args.provisional:
        print("Final round Race 3 has no results yet - rerun after it is scraped, "
              "or pass --provisional", file=sys.stderr)
        return 1

    data = build_awards(args.year, results, standings,
                        load(DATA_DIR / f"results{args.year - 1}.json"),
                        load(DATA_DIR / f"penalties{args.year}.json"),
                        load_analysis(args.year, results))
    out = args.out or DATA_DIR / f"awards{args.year}.json"
    existing = load(out)
    if existing and existing.get("published"):
        # Never silently un-publish a live file on a rerun.
        data["published"] = True
    out.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
    print(f"Wrote {out} ({len(data['awards'])} awards, published={data['published']})")
    for a in data["awards"]:
        print(f"  {a['title']:<30} {a['winner']:<28} {a['stat']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
