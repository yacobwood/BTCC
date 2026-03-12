#!/usr/bin/env python3
"""
Generate season_YYYY.json from excelData/Drivers.xlsx and Teams.xlsx.
Single source of truth: each JSON has drivers, teams, and rounds (race results).
Output: app/src/main/assets/data/season_2014.json ... season_2025.json

Reads from Excel only. Run after csv_to_standings.py (or standalone). Requires openpyxl.
"""

import json
import os
import re

try:
    from openpyxl import load_workbook
except ImportError:
    print("Install openpyxl: pip install openpyxl")
    raise

# Reuse parsing helpers from csv_to_standings
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from csv_to_standings import (
    repo_root,
    get_excel_paths,
    get_excel_years,
    get_sheet_name_for_year,
    read_sheet_rows,
    parse_drivers_from_rows,
    parse_teams_from_rows,
    _row_to_strings,
    _DRIVER_STOP_NAMES,
    DRIVER_LOOKUP,
    escape_kotlin_string,
)

def position_from_cell(val):
    """Return (position_int, fastest_lap_bool). Ret/DSQ/etc -> 0."""
    if val is None:
        return 0, False
    v = str(val).strip()
    if not v:
        return 0, False
    fl = "*" in v
    v = v.replace("*", "").strip()
    if v.upper() in ("RET", "DSQ", "DNS", "NC", "WD", "DNF", "C", "DNP", "DNA", "EX", "DNQ", "DNPQ"):
        return 0, fl
    try:
        return int(float(v)), fl
    except (ValueError, TypeError):
        return 0, fl

# BTCC position points for computing points per result
POINTS_BY_POS = [20, 17, 15, 13, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]

def points_from_position(pos):
    return POINTS_BY_POS[pos - 1] if 1 <= pos <= 15 else 0

# Expand Excel column-header abbreviations to full venue names (matches data/results20XX.json style)
VENUE_FULL_NAMES = {
    "BHI": "Brands Hatch Indy",
    "BHGP": "Brands Hatch GP",
    "DON": "Donington Park",
    "DONGP": "Donington Park GP",
    "THR": "Thruxton",
    "OUL": "Oulton Park",
    "CRO": "Croft",
    "SNE": "Snetterton",
    "KNO": "Knockhill",
    "ROC": "Rockingham",
    "SIL": "Silverstone",
}

def expand_venue(venue):
    if not venue:
        return venue
    key = venue.strip().upper()
    return VENUE_FULL_NAMES.get(key, venue)

def load_results_json_rounds(root, year):
    """Load full rounds array from data/results{year}.json if it exists (for dates and time data)."""
    path = os.path.join(root, "data", f"results{year}.json")
    if not os.path.isfile(path):
        return None
    try:
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
        return data.get("rounds") or []
    except Exception:
        return None

def load_round_dates_from_results_json(root, year):
    """Load round number -> date string from data/results{year}.json if it exists."""
    rounds_arr = load_results_json_rounds(root, year)
    if not rounds_arr:
        return {}
    return {r["round"]: (r.get("date") or "") for r in rounds_arr if "round" in r}

def _normalize_driver_name(name):
    return (name or "").strip().lower()

def merge_times_and_teams_from_results_json(root, year, rounds):
    """
    Merge time, gap, bestLap, team, laps (and race date/fullRaceUrl) from data/results{year}.json
    into the Excel-built rounds. Matches by round number, race index, and driver name.
    """
    results_rounds = load_results_json_rounds(root, year)
    if not results_rounds:
        return
    by_round = {r["round"]: r for r in results_rounds if "round" in r}
    for round_obj in rounds:
        round_num = round_obj.get("round")
        src = by_round.get(round_num)
        if not src:
            continue
        src_races = src.get("races") or []
        for race_idx, race in enumerate(round_obj.get("races") or []):
            if race_idx >= len(src_races):
                break
            src_race = src_races[race_idx]
            if not race.get("date") and src_race.get("date"):
                race["date"] = src_race["date"]
            if src_race.get("fullRaceUrl"):
                race["fullRaceUrl"] = src_race["fullRaceUrl"]
            src_results = src_race.get("results") or []
            by_driver = {_normalize_driver_name(r.get("driver")): r for r in src_results}
            for res in race.get("results") or []:
                key = _normalize_driver_name(res.get("driver"))
                src_res = by_driver.get(key)
                if not src_res:
                    continue
                for field in ("time", "gap", "bestLap", "team", "laps"):
                    val = src_res.get(field)
                    if val is not None and (val != "" or field == "team"):
                        res[field] = val
                if "no" in src_res and src_res.get("no"):
                    res["no"] = src_res["no"]

def _format_gap(gap):
    """Format gap from leader for display: '+X.XXX' or None."""
    if gap is None or (isinstance(gap, str) and not gap.strip()):
        return None
    s = str(gap).strip()
    return s if s.startswith("+") else f"+{s}"

def add_display_times_to_rounds(rounds):
    """
    Set displayTime on each result so the app can show it without calculation.
    P1: leader's full time (time or bestLap). P2+: '+X.XXX' (gap from leader).
    """
    for round_obj in rounds:
        for race in round_obj.get("races") or []:
            results = race.get("results") or []
            if not results:
                continue
            first = results[0]
            leader_display = (first.get("time") or "").strip() or (first.get("bestLap") or "").strip() or "—"
            for i, res in enumerate(results):
                if i == 0:
                    res["displayTime"] = leader_display
                else:
                    res["displayTime"] = _format_gap(res.get("gap")) or "—"

def build_rounds_from_driver_sheet(header_row, data_rows, round_dates=None):
    """Build rounds[] from header and data rows."""
    header = _row_to_strings(header_row)
    n_cols = len(header)
    pts_col = n_cols - 1
    n_race_cols = pts_col - 2
    if n_race_cols < 3 or n_race_cols % 3 != 0:
        return []
    n_rounds = n_race_cols // 3
    rounds = []
    for r in range(n_rounds):
        raw_venue = (header[2 + r * 3] or "").strip() or f"Round {r+1}"
        venue = expand_venue(raw_venue) if len(raw_venue) <= 6 else raw_venue
        races = []
        for race_idx in range(3):
            col = 2 + r * 3 + race_idx
            results = []
            for row in data_rows:
                row = _row_to_strings(row)
                if len(row) <= col:
                    continue
                name = (row[1] or "").strip()
                if not name or name.lower() in _DRIVER_STOP_NAMES:
                    break
                pos_val = row[col] if col < len(row) else ""
                pos, fl = position_from_cell(pos_val)
                pts = points_from_position(pos) + (1 if fl else 0)
                results.append({
                    "pos": pos,
                    "no": 0,
                    "driver": name,
                    "team": "",
                    "laps": 0,
                    "time": "",
                    "gap": "",
                    "bestLap": "",
                    "points": pts,
                    "fl": fl,
                })
            # Sort: position 1,2,3... first, then 0 (Ret etc)
            results.sort(key=lambda x: (x["pos"] == 0, x["pos"]))
            for i, res in enumerate(results):
                res["no"] = i + 1
            races.append({"label": f"Race {race_idx + 1}", "results": results})
        round_num = r + 1
        date = (round_dates or {}).get(round_num, "")
        rounds.append({
            "round": round_num,
            "venue": venue,
            "date": date,
            "races": races,
        })
    return rounds

def driver_standings_to_json(drivers, year):
    """Convert (pos, name, pts, wins) list to JSON driver standings with team/car from lookup."""
    lookup = DRIVER_LOOKUP.get(year, {})
    out = []
    for pos, name, pts, wins in drivers:
        team, car, team_sec = lookup.get(name, ("", "", None))
        team_sec = team_sec or ""
        o = {"position": pos, "name": name, "team": team, "points": pts, "wins": wins}
        if car:
            o["car"] = car
        if team_sec:
            o["teamSecondary"] = team_sec
        out.append(o)
    return out

def team_standings_to_json(teams):
    return [{"position": pos, "name": team, "points": pts} for pos, team, pts in teams]

def main():
    root = repo_root()
    drivers_path, teams_path = get_excel_paths(root)
    if not drivers_path or not teams_path:
        print("Put Drivers.xlsx and Teams.xlsx in excelData/")
        return 1
    years = get_excel_years(root)
    if not years:
        print("No year sheets found")
        return 1

    out_dir = os.path.join(root, "app", "src", "main", "assets", "data")
    os.makedirs(out_dir, exist_ok=True)

    wb_d = load_workbook(drivers_path, read_only=True, data_only=True)
    wb_t = load_workbook(teams_path, read_only=True, data_only=True)

    for year in years:
        sheet_d = get_sheet_name_for_year(wb_d, year)
        sheet_t = get_sheet_name_for_year(wb_t, year)
        if not sheet_d or not sheet_t:
            continue
        header_d, data_d = read_sheet_rows(wb_d, sheet_d)
        header_t, data_t = read_sheet_rows(wb_t, sheet_t)
        if not header_d or not data_d:
            continue
        if not header_t or not data_t:
            continue

        drivers = parse_drivers_from_rows(data_d, header_d)
        teams = parse_teams_from_rows(data_t, header_t)
        if not drivers:
            continue

        round_dates = load_round_dates_from_results_json(root, year)
        rounds = build_rounds_from_driver_sheet(header_d, data_d, round_dates)
        merge_times_and_teams_from_results_json(root, year, rounds)
        add_display_times_to_rounds(rounds)

        payload = {
            "season": str(year),
            "drivers": driver_standings_to_json(drivers, year),
            "teams": team_standings_to_json(teams),
            "rounds": rounds,
        }
        path = os.path.join(out_dir, f"season_{year}.json")
        with open(path, "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=2, ensure_ascii=False)
        print(f"Wrote {path} ({len(drivers)} drivers, {len(teams)} teams, {len(rounds)} rounds)", flush=True)

    wb_d.close()
    wb_t.close()
    return 0

if __name__ == "__main__":
    sys.exit(main() or 0)
