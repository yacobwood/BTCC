#!/usr/bin/env python3
"""
Fetch MSS classification pages for historical seasons and inject timing data
(time, gap, bestLap, laps, car number) into both:
  data/results{year}.json
  app/src/main/assets/data/season_{year}.json

Uses plain HTTP requests — no Puppeteer required.
Reads __NEXT_DATA__ from server-side-rendered MSS classification pages.

Usage:
    python3 scripts/fetch_mss_timing.py          # all years 2004-2013
    python3 scripts/fetch_mss_timing.py 2004     # single year
    python3 scripts/fetch_mss_timing.py 2004 2008
"""

import json
import re
import sys
import time
import unicodedata
import urllib.request
from pathlib import Path

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

REPO_ROOT  = Path(__file__).parent.parent
MSS_DIR    = REPO_ROOT / "motorsportstats"
DATA_DIR   = REPO_ROOT / "data"
ASSETS_DIR = REPO_ROOT / "app" / "src" / "main" / "assets" / "data"

MSS_BASE = "https://www.motorsportstats.com/results/british-touring-car-championship"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml",
}

# ---------------------------------------------------------------------------
# HTTP + __NEXT_DATA__ helpers
# ---------------------------------------------------------------------------

def fetch_html(url: str) -> str | None:
    req = urllib.request.Request(url, headers=HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.read().decode("utf-8", errors="replace")
    except Exception as e:
        print(f"    HTTP error [{url}]: {e}")
        return None


def extract_next_data(html: str) -> dict | None:
    m = re.search(r'id="__NEXT_DATA__" type="application/json">(.+?)</script>', html)
    if not m:
        return None
    try:
        return json.loads(m.group(1))
    except Exception:
        return None

# ---------------------------------------------------------------------------
# Time formatting (milliseconds → strings)
# ---------------------------------------------------------------------------

def ms_to_race_time(ms: int) -> str:
    """1_575_638 → '26:15.638'"""
    if not ms or ms <= 0:
        return ""
    m   = ms // 60000
    s   = (ms % 60000) // 1000
    rem = ms % 1000
    return f"{m}:{s:02d}.{rem:03d}"


def ms_to_lap_time(ms: int) -> str:
    """49_290 → '0:49.290'"""
    if not ms or ms <= 0:
        return ""
    m   = ms // 60000
    s   = (ms % 60000) // 1000
    rem = ms % 1000
    return f"{m}:{s:02d}.{rem:03d}"


def ms_to_gap(ms: int, laps_behind: int = 0) -> str:
    """329 → '+0.329', 2 laps → '+2 Laps'"""
    if laps_behind > 0:
        return f"+{laps_behind} Lap{'s' if laps_behind > 1 else ''}"
    if not ms or ms <= 0:
        return ""
    s   = ms // 1000
    rem = ms % 1000
    return f"+{s}.{rem:03d}"

# ---------------------------------------------------------------------------
# Name matching
# ---------------------------------------------------------------------------

SHORT_FORMS: dict[str, str] = {
    "ash sutton":        "ashley sutton",
    "rob collard":       "robert collard",
    "derek palmer jr":   "derek palmer",
    "derek palmer jr.":  "derek palmer",
    "tom onslow-cole":   "tom onslow cole",
}


def norm(name: str) -> str:
    nfd = unicodedata.normalize("NFD", name)
    stripped = "".join(c for c in nfd if unicodedata.category(c) != "Mn")
    return re.sub(r"\s+", " ", re.sub(r"[^a-z\s]", "", stripped.lower())).strip()


def find_match(mss_name: str, timing_map: dict[str, dict]) -> dict | None:
    n = norm(mss_name)
    r = SHORT_FORMS.get(n, n)
    last = r.split()[-1]
    # Exact normalised match
    for key, val in timing_map.items():
        if key == n or key == r:
            return val
    # Last-name fallback
    for key, val in timing_map.items():
        resolved = SHORT_FORMS.get(key, key)
        if resolved.split()[-1] == last:
            return val
    return None

# ---------------------------------------------------------------------------
# MSS page scraping
# ---------------------------------------------------------------------------

def get_race_session_slugs(year: int, event_slug: str) -> list[str]:
    """Fetch the classification overview page; return race-only session slugs."""
    url = f"{MSS_BASE}/{year}/{event_slug}/classification"
    html = fetch_html(url)
    if not html:
        return []
    data = extract_next_data(html)
    if not data:
        return []
    sessions = data.get("props", {}).get("pageProps", {}).get("sessions", [])
    slugs = []
    for s in sessions:
        name = (s.get("session") or s).get("name", "")
        if re.search(r"race", name, re.IGNORECASE) and "qualifying" not in name.lower():
            full = (s.get("session") or s).get("slug", "")
            short = full.split("_")[-1]   # e.g. "race-1", "race-2"
            if short:
                slugs.append(short)
    return slugs


def fetch_race_timing(year: int, event_slug: str, session_slug: str) -> dict[str, dict]:
    """
    Fetch a classification page; return norm(driver_name) → timing dict.
    Prefers sessionAllClassification (full grid) over sessionClassification.
    """
    url = f"{MSS_BASE}/{year}/{event_slug}/classification/{session_slug}"
    html = fetch_html(url)
    if not html:
        return {}
    data = extract_next_data(html)
    if not data:
        return {}
    pp = data.get("props", {}).get("pageProps", {})
    sc = pp.get("sessionAllClassification") or pp.get("sessionClassification") or {}
    details = sc.get("details", [])

    timing: dict[str, dict] = {}
    for e in details:
        drivers = e.get("drivers") or []
        if not drivers:
            continue
        drv_name = drivers[0].get("name", "")
        if not drv_name:
            continue

        pos        = e.get("finishPosition", 0) or 0
        classified = (e.get("classifiedStatus") or "CLA") == "CLA"
        is_p1      = (pos == 1 and classified)

        laps     = int(e.get("lapsCount") or e.get("laps") or 0)
        raw_time = int(e.get("time") or 0)
        time_str = ms_to_race_time(raw_time) if is_p1 else ""

        raw_gap      = e.get("gap") or {}
        gap_laps     = int(raw_gap.get("lapsToLead") or 0)
        gap_ms       = int(raw_gap.get("timeToLead") or 0)
        gap_str      = "" if is_p1 else ms_to_gap(gap_ms, gap_laps)

        bl        = e.get("bestLap") or {}
        bl_ms     = int(bl.get("time") or 0)
        bl_str    = ms_to_lap_time(bl_ms)
        fl        = bool(bl.get("fastest"))

        car_no = str(e.get("carNumber") or "")

        timing[norm(drv_name)] = {
            "no":      int(car_no) if car_no.isdigit() else 0,
            "laps":    laps,
            "time":    time_str,
            "gap":     gap_str,
            "bestLap": bl_str,
            "fl":      fl,
        }
    return timing

# ---------------------------------------------------------------------------
# Per-year processing
# ---------------------------------------------------------------------------

def process_year(year: int) -> bool:
    print(f"\n{'='*55}\n  {year}\n{'='*55}")

    mss_path     = MSS_DIR / f"{year}.json"
    results_path = DATA_DIR / f"results{year}.json"
    season_path  = ASSETS_DIR / f"season_{year}.json"

    for p, label in [(mss_path, f"motorsportstats/{year}.json"),
                     (results_path, f"data/results{year}.json"),
                     (season_path, f"season_{year}.json")]:
        if not p.exists():
            print(f"  SKIP — {label} not found. Run fetch_mss_historical.py first.")
            return False

    mss_data   = json.loads(mss_path.read_text())
    results    = json.loads(results_path.read_text())
    season     = json.loads(season_path.read_text())

    # Map round number → MSS event short-slug
    event_slug_by_round: dict[int, str] = {}
    for r in mss_data.get("races", []):
        ev_num = r["eventNumber"]
        if ev_num not in event_slug_by_round:
            full = r["event"]["slug"]
            event_slug_by_round[ev_num] = full.replace(
                f"british-touring-car-championship_{year}_", ""
            )

    total_injected = 0

    for rd in results["rounds"]:
        ev_num     = rd["round"]
        event_slug = event_slug_by_round.get(ev_num)
        if not event_slug:
            print(f"  Round {ev_num}: no MSS slug — skip")
            continue

        print(f"  Round {ev_num} ({rd['venue']}) → {event_slug}")
        time.sleep(0.8)

        session_slugs = get_race_session_slugs(year, event_slug)
        if not session_slugs:
            print(f"    No race sessions found")
            continue
        print(f"    Sessions: {session_slugs}")

        races = [r for r in rd.get("races", []) if r.get("results")]
        for i, race in enumerate(races):
            if i >= len(session_slugs):
                break
            s_slug = session_slugs[i]
            print(f"    {race['label']} → {s_slug}")
            time.sleep(0.5)

            timing_map = fetch_race_timing(year, event_slug, s_slug)
            if not timing_map:
                print(f"      No timing data")
                continue

            injected = 0
            for dr in race["results"]:
                t = find_match(dr["driver"], timing_map)
                if not t:
                    continue
                if t["no"]:      dr["no"]      = t["no"]
                if t["laps"]:    dr["laps"]    = t["laps"]
                if t["time"]:    dr["time"]    = t["time"]
                if t["gap"]:     dr["gap"]     = t["gap"]
                if t["bestLap"]: dr["bestLap"] = t["bestLap"]
                dr["fl"] = t["fl"]
                injected += 1
            total_injected += injected
            print(f"      Injected {injected}/{len(race['results'])} drivers")

    # Save updated results file
    results_path.write_text(json.dumps(results, indent=2, ensure_ascii=False))
    print(f"\n  ✓ Saved data/results{year}.json")

    # Merge timing from results into season asset
    results_by_venue = {norm(r["venue"]): r for r in results["rounds"]}
    season_updated = 0
    for s_rd in season.get("rounds", []):
        r_rd = results_by_venue.get(norm(s_rd["venue"]))
        if not r_rd:
            continue
        r_races = {rc["label"]: rc for rc in r_rd.get("races", [])}
        for s_race in s_rd.get("races", []):
            r_race = r_races.get(s_race["label"])
            if not r_race:
                continue
            r_drivers = {norm(d["driver"]): d for d in r_race.get("results", [])}
            for s_dr in s_race.get("results", []):
                r_dr = r_drivers.get(norm(s_dr["driver"]))
                if not r_dr:
                    continue
                if r_dr.get("no"):      s_dr["no"]      = r_dr["no"]
                if r_dr.get("laps"):    s_dr["laps"]    = r_dr["laps"]
                if r_dr.get("time"):    s_dr["time"]    = r_dr["time"]
                if r_dr.get("gap"):     s_dr["gap"]     = r_dr["gap"]
                if r_dr.get("bestLap"): s_dr["bestLap"] = r_dr["bestLap"]
                s_dr["fl"] = r_dr.get("fl", s_dr.get("fl", False))
                season_updated += 1

    season_path.write_text(json.dumps(season, indent=2, ensure_ascii=False))
    print(f"  ✓ Saved season_{year}.json ({season_updated} entries updated)")
    return True

# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main():
    args = sys.argv[1:]
    if not args:
        years = list(range(2004, 2014))
    elif len(args) == 1:
        years = [int(args[0])]
    else:
        years = list(range(int(args[0]), int(args[1]) + 1))

    print(f"Fetching MSS timing for: {years}")
    for year in years:
        process_year(year)
        if year != years[-1]:
            time.sleep(1)
    print("\nDone. Rebuild app to pick up updated season assets.")


if __name__ == "__main__":
    main()
