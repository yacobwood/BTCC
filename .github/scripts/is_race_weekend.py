#!/usr/bin/env python3
"""
Checks whether today is within a BTCC race round date range.

Outputs to GITHUB_OUTPUT (when running in Actions):
  is_race_weekend=true/false   — today falls within any round's startDate..endDate
  is_race_sunday=true/false    — today is specifically a round's endDate (Sunday)

Always exits 0 so callers use the output values, not the exit code, to decide.
"""
import json
import os
from datetime import date
from pathlib import Path

cal_path = Path(__file__).parent.parent.parent / "data" / "calendar.json"
cal = json.loads(cal_path.read_text(encoding="utf-8"))
today = date.today()

is_race_weekend = False
is_race_sunday = False

for r in cal.get("rounds", []):
    try:
        start = date.fromisoformat(r["startDate"])
        end = date.fromisoformat(r["endDate"])
    except (KeyError, ValueError):
        continue
    if start <= today <= end:
        is_race_weekend = True
        is_race_sunday = today == end
        break

rw_str = "true" if is_race_weekend else "false"
rs_str = "true" if is_race_sunday else "false"

github_output = os.environ.get("GITHUB_OUTPUT", "")
if github_output:
    with open(github_output, "a", encoding="utf-8") as f:
        f.write(f"is_race_weekend={rw_str}\n")
        f.write(f"is_race_sunday={rs_str}\n")

print(f"Race weekend: {is_race_weekend}, Race Sunday: {is_race_sunday}")
