#!/usr/bin/env python3
"""
Checks whether today is a BTCC race day and, if so, dispatches
the session-watcher workflow with the correct round + day inputs.

Run daily via cron (e.g. 08:30 UTC). If today matches a Saturday or
Sunday in schedule2026.json, it triggers session-watcher.yml via the
GitHub Actions API.
"""
import json, os, sys, urllib.request
from datetime import datetime, timezone

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
YEAR      = int(os.environ.get("YEAR", "2026"))
GH_TOKEN  = os.environ.get("GH_TOKEN") or os.environ.get("GITHUB_TOKEN")
GH_REPO   = os.environ.get("GITHUB_REPOSITORY", "yacobwood/BTCC")

today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

with open(os.path.join(REPO_ROOT, "data", f"schedule{YEAR}.json")) as f:
    schedule = json.load(f)

match_round = None
match_day   = None
for rnd in schedule["rounds"]:
    if rnd.get("saturday_date") == today:
        match_round, match_day = rnd["round"], "saturday"
        break
    if rnd.get("sunday_date") == today:
        match_round, match_day = rnd["round"], "sunday"
        break

if not match_round:
    print(f"No race day found for {today} — nothing to start")
    sys.exit(0)

print(f"Race day! Round {match_round} ({match_day}) — dispatching session-watcher…")

if not GH_TOKEN:
    print("ERROR: GITHUB_TOKEN not set", file=sys.stderr)
    sys.exit(1)

payload = json.dumps({
    "ref": "main",
    "inputs": {
        "round": str(match_round),
        "day":   match_day,
        "year":  str(YEAR),
    },
}).encode()

req = urllib.request.Request(
    f"https://api.github.com/repos/{GH_REPO}/actions/workflows/session-watcher.yml/dispatches",
    data=payload,
    headers={
        "Authorization": f"Bearer {GH_TOKEN}",
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
