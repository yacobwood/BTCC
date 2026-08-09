#!/usr/bin/env python3
"""
Checks whether today is within a BTCC race round date range, and whether
the current UTC time falls within an active per-session scrape window.

Session times in the calendar are BST (UTC+1). A window opens 15 minutes
after each session's scheduled start time (when TSL PDFs are realistically
available) and closes 90 minutes after the session start. The window stays
active for its full duration even after results are committed, so that TSL
grid PDF amendments (e.g. corrected reverse-grid draw number) are re-fetched.

Outputs to GITHUB_OUTPUT:
  is_race_weekend=true/false    — today falls within any round's startDate..endDate
  is_race_sunday=true/false     — today is specifically a round's endDate (Sunday)
  in_session_window=true/false  — current UTC time is within any active session window
"""
import json
import os
from datetime import date, datetime, timedelta, timezone
from pathlib import Path


# Reg 3.4.1.a/b: each of these sessions' starting grid is published as soon as
# possible after the preceding session finishes - typically hours before the
# grid-bearing session itself starts (e.g. the Race 1 grid goes up once the
# Qualifying Race is over, the evening before Race 1 runs). Gating the window
# purely on the grid-bearing session's own start time meant the grid was only
# ever fetched after that session had already begun, too late to be useful.
PRECEDING_SESSION = {
    "Qualifying Race": "Qualifying",
    "Race 1":          "Qualifying Race",
    "Race 2":          "Race 1",
    "Race 3":          "Race 2",
}


def compute_session_windows(now_utc, day_sessions, already_scraped):
    """Return a list of (label, w_start, w_end, scraped, active) tuples.

    active is True when now_utc falls within [w_start, w_end], regardless of
    whether the session has already been scraped. This ensures that TSL grid PDF
    amendments committed after results land are still picked up within the window.

    For grid-bearing sessions, active is also True as soon as the preceding
    session's results are committed, all the way through to this session's own
    w_end - the grid is normally already public well before that point.
    """
    BST_OFFSET               = timedelta(hours=1)
    POST_SESSION_START_DELAY = timedelta(minutes=15)
    POST_SESSION_BUF         = timedelta(minutes=90)

    results = []
    for s in day_sessions:
        h, m = map(int, s["time"].split(":"))
        session_utc = datetime(now_utc.year, now_utc.month, now_utc.day, h, m, tzinfo=timezone.utc) - BST_OFFSET
        w_start = session_utc + POST_SESSION_START_DELAY
        w_end   = session_utc + POST_SESSION_BUF
        scraped = s["name"] in already_scraped
        preceding = PRECEDING_SESSION.get(s["name"])
        grid_ready_early = preceding is not None and preceding in already_scraped and now_utc <= w_end
        active  = grid_ready_early or (w_start <= now_utc <= w_end)
        results.append({"label": s["name"], "w_start": w_start, "w_end": w_end, "scraped": scraped, "active": active})
    return results

ROOT         = Path(__file__).parent.parent.parent
cal_path     = ROOT / "data" / "calendar.json"
schedule_path = ROOT / "data" / "schedule.json"

cal      = json.loads(cal_path.read_text(encoding="utf-8"))
today    = date.today()
now_utc  = datetime.now(timezone.utc)


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
        # Load already-committed results
        already_scraped = set()
        results_path = ROOT / "data" / f"results{now_utc.year}.json"
        if results_path.exists():
            results_data = json.loads(results_path.read_text(encoding="utf-8"))
            for rnd in results_data.get("rounds", []):
                if rnd.get("round") == today_round:
                    for race in rnd.get("races", []):
                        if race.get("results"):
                            already_scraped.add(race["label"])
                    break

        print(f"now: {now_utc.strftime('%H:%M')} UTC  |  already scraped: {sorted(already_scraped) or 'none'}")
        windows = compute_session_windows(now_utc, day_sessions, already_scraped)
        for w in windows:
            print(f"  {w['label']}: {w['w_start'].strftime('%H:%M')}–{w['w_end'].strftime('%H:%M')} UTC  scraped={w['scraped']}  active={w['active']}")

        in_session_window = any(w["active"] for w in windows)
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
