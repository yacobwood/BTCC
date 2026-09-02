#!/usr/bin/env python3
"""
Checks whether today is a BTCC race day and, if so, dispatches
the session-watcher workflow with the correct round + day inputs.

Run daily via cron (e.g. 08:30 UTC). If today matches a round's startDate
or endDate in calendar.json, it triggers session-watcher.yml via the
GitHub Actions API.

Bug found + fixed 2026-09-02: this used to read data/schedule.json's
`saturday_date`/`sunday_date` fields, which don't exist there at all -
schedule.json only ever carries each round's per-session day-of-week/time
(paired with a round number from elsewhere), never a calendar date. Every
`race-day-start.yml` run since the season started had silently found "no
race day" and done nothing, confirmed on rounds 6/7's actual Saturdays and
Sundays via real run logs - so session-watcher.yml (pre-session "starts in
15 minutes" pushes, and the only sender of the spoiler-specific
results_race1/results_qualifying/etc. notifications - see
functions/scraperAdmin.js's notifyResultsUpdate comment, which is
deliberately NOT that) had never been auto-dispatched all season, only the
two cancelled manual attempts back in round 2. Results themselves were
unaffected - scrape-results.yml's own independent polling cron + its
generic results_live/results_teaser push are a separate, working path.
Fixed by reading data/calendar.json's startDate/endDate instead, the same
source is_race_weekend.py already uses correctly (confirmed all 10 rounds
this season: startDate is always Saturday, endDate always Sunday).

find_race_day() is a pure function specifically so it can be unit tested
(test_start_race_day.py) without also triggering the real dispatch POST
below - unlike is_race_weekend.py's module-level style, importing this
module for its matching logic alone must never risk a live API call.
"""
import json, os, sys, urllib.error, urllib.request
from datetime import datetime, timezone


def find_race_day(calendar, today):
    """Return (round, day) - day is "saturday"/"sunday" - for the round
    whose startDate/endDate matches today, or (None, None) if today isn't
    any round's start or end date."""
    for rnd in calendar.get("rounds", []):
        if rnd.get("startDate") == today:
            return rnd["round"], "saturday"
        if rnd.get("endDate") == today:
            return rnd["round"], "sunday"
    return None, None


def main():
    repo_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    year      = int(os.environ.get("YEAR", "2026"))
    gh_token  = os.environ.get("GH_TOKEN") or os.environ.get("GITHUB_TOKEN")
    gh_repo   = os.environ.get("GITHUB_REPOSITORY", "yacobwood/BTCC")

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    with open(os.path.join(repo_root, "data", "calendar.json")) as f:
        calendar = json.load(f)

    match_round, match_day = find_race_day(calendar, today)

    if not match_round:
        print(f"No race day found for {today} — nothing to start")
        return

    print(f"Race day! Round {match_round} ({match_day}) — dispatching session-watcher…")

    if not gh_token:
        print("ERROR: GITHUB_TOKEN not set", file=sys.stderr)
        sys.exit(1)

    payload = json.dumps({
        "ref": "main",
        "inputs": {
            "round": str(match_round),
            "day":   match_day,
            "year":  str(year),
        },
    }).encode()

    req = urllib.request.Request(
        f"https://api.github.com/repos/{gh_repo}/actions/workflows/session-watcher.yml/dispatches",
        data=payload,
        headers={
            "Authorization": f"Bearer {gh_token}",
            "Accept":        "application/vnd.github+json",
            "Content-Type":  "application/json",
            "X-GitHub-Api-Version": "2022-11-28",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            print(f"Dispatched — HTTP {r.status}")
    except urllib.error.HTTPError as e:
        print(f"ERROR dispatching: {e.status} {e.read().decode()}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
