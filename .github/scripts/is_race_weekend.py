#!/usr/bin/env python3
"""
Checks whether today is within a BTCC race round date range, and whether
the current UTC time falls within the active session window for the day.

Session times in the calendar are BST (UTC+1). The active window runs from
5 minutes before the first session of the day to 90 minutes after the last
(to allow TSL time to publish result PDFs).

Outputs to GITHUB_OUTPUT:
  is_race_weekend=true/false    — today falls within any round's startDate..endDate
  is_race_sunday=true/false     — today is specifically a round's endDate (Sunday)
  in_session_window=true/false  — current UTC time is within today's session window
"""
import json
import os
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

ROOT         = Path(__file__).parent.parent.parent
cal_path     = ROOT / "data" / "calendar.json"
schedule_path = ROOT / "data" / "schedule.json"

cal      = json.loads(cal_path.read_text(encoding="utf-8"))
today    = date.today()
now_utc  = datetime.now(timezone.utc)

BST_OFFSET      = timedelta(hours=1)   # BST = UTC+1 (all BTCC rounds are in BST)
PRE_SESSION_BUF = timedelta(minutes=5)
POST_SESSION_BUF = timedelta(minutes=90)

is_race_weekend   = False
is_race_sunday    = False
in_session_window = False
today_round       = None

for r in cal.get("rounds", []):
    try:
        start = date.fromisoformat(r["startDate"])
        end   = date.fromisoformat(r["endDate"])
    except (KeyError, ValueError):
        continue
    if start <= today <= end:
        is_race_weekend = True
        is_race_sunday  = today == end
        today_round     = r["round"]
        break

if is_race_weekend and today_round is not None and schedule_path.exists():
    schedule = json.loads(schedule_path.read_text(encoding="utf-8"))
    today_day = "SUN" if is_race_sunday else "SAT"

    round_sessions = next(
        (r["sessions"] for r in schedule.get("rounds", []) if r["round"] == today_round),
        []
    )
    day_sessions = [s for s in round_sessions if s.get("day") == today_day and s.get("time")]

    if day_sessions:
        def bst_to_utc(t):
            h, m = map(int, t.split(":"))
            bst = datetime(now_utc.year, now_utc.month, now_utc.day, h, m, tzinfo=timezone.utc) - BST_OFFSET
            return bst

        times_utc = [bst_to_utc(s["time"]) for s in day_sessions]
        window_start = min(times_utc) - PRE_SESSION_BUF
        window_end   = max(times_utc) + POST_SESSION_BUF

        in_session_window = window_start <= now_utc <= window_end
        print(f"Session window: {window_start.strftime('%H:%M')}–{window_end.strftime('%H:%M')} UTC  |  now: {now_utc.strftime('%H:%M')} UTC  |  active: {in_session_window}")
    else:
        print(f"No sessions found for round {today_round} {today_day}")
else:
    print("Not a race weekend or no schedule data.")

rw_str  = "true" if is_race_weekend   else "false"
rs_str  = "true" if is_race_sunday    else "false"
sw_str  = "true" if in_session_window else "false"

github_output = os.environ.get("GITHUB_OUTPUT", "")
if github_output:
    with open(github_output, "a", encoding="utf-8") as f:
        f.write(f"is_race_weekend={rw_str}\n")
        f.write(f"is_race_sunday={rs_str}\n")
        f.write(f"in_session_window={sw_str}\n")

print(f"Race weekend: {is_race_weekend}, Race Sunday: {is_race_sunday}, In window: {in_session_window}")
