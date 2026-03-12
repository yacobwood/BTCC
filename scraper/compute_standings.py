#!/usr/bin/env python3
"""Compute championship standings from race results JSON files."""
import json, sys
from pathlib import Path
from collections import defaultdict

POINTS = {1:25, 2:20, 3:16, 4:13, 5:11, 6:10, 7:9, 8:8, 9:7, 10:6, 11:5, 12:4, 13:3, 14:2, 15:1}

def compute(year):
    path = Path(f"/Users/jakewood/Documents/Sites/BTCC/data/results{year}.json")
    data = json.loads(path.read_text())
    
    driver_points = defaultdict(int)
    driver_wins = defaultdict(int)
    driver_team = {}
    driver_car = {}
    team_points = defaultdict(int)
    
    for rnd in data["rounds"]:
        for race in rnd["races"]:
            for r in race["results"]:
                d = r["driver"]
                pos = r["pos"]
                pts = POINTS.get(pos, 0)
                driver_points[d] += pts
                driver_team[d] = r["team"]
                driver_car[d] = str(r["no"])
                if pos == 1:
                    driver_wins[d] += 1
                team_points[r["team"]] += pts
    
    drivers = sorted(driver_points.items(), key=lambda x: -x[1])
    teams = sorted(team_points.items(), key=lambda x: -x[1])
    
    print(f"\n=== {year} Driver Standings ===")
    for i, (name, pts) in enumerate(drivers[:25], 1):
        wins = driver_wins[name]
        car = driver_car[name]
        print(f"  {i:2d}. {name:30s} #{car:4s}  {pts:4d} pts  {wins} wins")
    
    print(f"\n=== {year} Team Standings ===")
    for i, (name, pts) in enumerate(teams[:12], 1):
        print(f"  {i:2d}. {name:45s}  {pts:4d} pts")

year = int(sys.argv[1]) if len(sys.argv) > 1 else 2022
compute(year)
