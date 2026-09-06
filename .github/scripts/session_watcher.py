#!/usr/bin/env python3
"""
BTCC Session Watcher
====================
Connects to TSL SignalR live timing for a race weekend, then, when TSL
fires `sessioncomplete`, scrapes the results PDF, commits the data, and
sends that session's spoiler-specific results notification
(results_race1/results_qualifying/etc.) - the one notification nothing
else in the pipeline sends. See functions/scraperAdmin.js's
notifyResultsUpdate for the separate, deliberately spoiler-safe generic
"a result just dropped" push that already goes out reliably regardless of
whether this script runs.

Does NOT send pre-session "starting in 15 minutes" alerts any more (fixed
2026-09-02, removed the same day the race-day-start.yml dispatch bug that
had kept this script from ever running was found) - functions/
sessionNotifications.js's sendSessionNotifications already sends those
reliably on a completely separate, always-running Firebase schedule, using
the exact same topic names (pre_fp, pre_race1, etc.) this script used to
also send to. Keeping both would have meant every pre-session alert
arriving twice the first weekend this script's dispatch actually worked.

Usage (from repo root, typically run via GitHub Actions):
  python .github/scripts/session_watcher.py --round 1 --day saturday
  python .github/scripts/session_watcher.py --round 1 --day sunday

Required env vars:
  FIREBASE_SERVICE_ACCOUNT  – Firebase service account JSON string
  GITHUB_TOKEN              – GitHub token with contents:write (for git push)
                              (automatically set in GitHub Actions)
"""

import argparse, json, logging, os, subprocess, sys, threading, time
import urllib.request, urllib.parse, http.cookiejar
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

import websocket

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("watcher")

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Deliberately duplicated from tools/scraper/scrape_tsl.py's own
# SESSION_SUFFIXES, not imported - that script parses sys.argv directly at
# module level (YEAR = int(sys.argv[1]) ...) by design, since it's always
# invoked as a subprocess (see run_scraper() below), never imported
# elsewhere in this codebase. Importing it here would read *this* script's
# own argv ("--round", "8", ...) instead and crash on `int("--round")` -
# confirmed live. Keep this dict in sync with scrape_tsl.py's if either
# changes - both are small and rarely touched (session names are stable
# across a season; TOCA/TSL don't rename their own PDF suffixes mid-year).
SESSION_SUFFIXES = {
    "Free Practice":   "fp1",
    "Qualifying":      "qu1",
    "Qualifying Race": "qra",
    "Race 1":          "rc1",
    "Race 2":          "rc2",
    "Race 3":          "rc3",
}

RESULTS_TOPICS = {
    "Free Practice":   "results_fp",
    "Qualifying":      "results_qualifying",
    "Qualifying Race": "results_qrace",
    "Race 1":          "results_race1",
    "Race 2":          "results_race2",
    "Race 3":          "results_race3",
}


# ── Argument parsing ──────────────────────────────────────────────────────────

def parse_args():
    p = argparse.ArgumentParser()
    p.add_argument("--round", type=int, required=True, help="Round number (1–10)")
    p.add_argument("--day",   choices=["saturday", "sunday"], required=True)
    p.add_argument("--year",  type=int, default=2026)
    return p.parse_args()


# ── Time conversion ───────────────────────────────────────────────────────────

def session_to_utc(date_str, time_str):
    """Mirrors functions/shared.js's sessionToUTC(): session times in
    calendar.json/schedule.json are local UK clock time. Uses zoneinfo
    rather than a hardcoded BST offset so a round landing right on a
    DST boundary is never silently wrong, even though BTCC's April-October
    season is in practice always BST."""
    year, month, day = map(int, date_str.split("-"))
    hour, minute = map(int, time_str.split(":"))
    local = datetime(year, month, day, hour, minute, tzinfo=ZoneInfo("Europe/London"))
    return local.astimezone(timezone.utc)


# ── Schedule loading ──────────────────────────────────────────────────────────

def load_sessions(year, round_num, day):
    """Reads data/calendar.json - NOT schedule.json. Fixed 2026-09-02:
    this used to read schedule.json expecting rnd["tsl"], rnd["venue"], and
    rnd["sessions"] as a dict keyed by "saturday"/"sunday" with each
    session carrying its own suffix/start_utc/notify flags - none of which
    schedule.json actually has (confirmed live: rnd["tsl"] raised KeyError
    immediately). calendar.json has the real tslEventId/venue per round and
    a flat sessions list of {name, day, time} - the suffix and UTC start
    time are derived here instead of expected pre-computed."""
    calendar_path = os.path.join(REPO_ROOT, "data", "calendar.json")
    with open(calendar_path) as f:
        cal = json.load(f)
    rnd = next((r for r in cal["rounds"] if r["round"] == round_num), None)
    if not rnd:
        log.error(f"Round {round_num} not found in calendar.json")
        sys.exit(1)

    date_str = rnd["startDate"] if day == "saturday" else rnd["endDate"]
    day_code = "SAT" if day == "saturday" else "SUN"
    day_sessions = [s for s in rnd.get("sessions", []) if s.get("day") == day_code and s.get("time")]

    sessions = []
    for s in day_sessions:
        label = s["name"]
        sessions.append({
            "label":     label,
            "suffix":    SESSION_SUFFIXES.get(label),
            "start_utc": session_to_utc(date_str, s["time"]),
        })

    return rnd["tslEventId"], rnd["venue"], sessions


# ── FCM notification ──────────────────────────────────────────────────────────

def send_fcm(topic, title, body, channel, extra_data=None):
    """Send a topic push via FCM HTTP v1 API using the service account."""
    sa_json = os.environ.get("FIREBASE_SERVICE_ACCOUNT")
    if not sa_json:
        log.warning("FIREBASE_SERVICE_ACCOUNT not set — skipping notification")
        return

    try:
        import google.oauth2.service_account
        import google.auth.transport.requests
        import requests as req_lib

        sa = json.loads(sa_json)
        project_id = sa["project_id"]

        creds = google.oauth2.service_account.Credentials.from_service_account_info(
            sa,
            scopes=["https://www.googleapis.com/auth/firebase.messaging"],
        )
        creds.refresh(google.auth.transport.requests.Request())

        data_payload = {"channel": channel, "title": title, "body": body}
        if extra_data:
            data_payload.update(extra_data)

        message = {
            "message": {
                "topic": topic,
                "android": {"priority": "high"},
                "apns": {
                    "payload": {
                        "aps": {"alert": {"title": title, "body": body}, "sound": "default"}
                    }
                },
                "data": data_payload,
            }
        }

        resp = req_lib.post(
            f"https://fcm.googleapis.com/v1/projects/{project_id}/messages:send",
            headers={"Authorization": f"Bearer {creds.token}", "Content-Type": "application/json"},
            json=message,
            timeout=10,
        )
        if resp.ok:
            log.info(f"FCM sent to '{topic}': {title}")
        else:
            log.error(f"FCM error {resp.status_code}: {resp.text}")

    except Exception as e:
        log.error(f"FCM exception: {e}")


# ── Results scraping + commit ─────────────────────────────────────────────────

def run_scraper(year, round_num):
    log.info(f"Running scraper for Round {round_num}…")
    result = subprocess.run(
        ["python3", "tools/scraper/scrape_tsl.py", str(year), "--round", str(round_num)],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
    )
    if result.stdout:
        log.info(result.stdout.strip())
    if result.returncode != 0:
        log.error(result.stderr.strip())
    return result.returncode == 0


def commit_and_push(round_num):
    cmds = [
        ["git", "config", "user.email", "github-actions[bot]@users.noreply.github.com"],
        ["git", "config", "user.name",  "github-actions[bot]"],
        ["git", "add", "data/results2026.json", "data/standings.json"],
    ]
    for cmd in cmds:
        subprocess.run(cmd, cwd=REPO_ROOT, capture_output=True)

    diff = subprocess.run(
        ["git", "diff", "--cached", "--quiet"],
        cwd=REPO_ROOT,
    )
    if diff.returncode == 0:
        log.info("No data changes — nothing to commit")
        return False

    # Pathspec-scoped rather than a bare `git commit`: a bare commit sweeps
    # in the WHOLE index, not just what was just `git add`-ed above, if
    # anything else happens to be staged (known project gotcha).
    subprocess.run(
        ["git", "commit", "-m", f"chore: update Round {round_num} results [skip ci]",
         "--", "data/results2026.json", "data/standings.json"],
        cwd=REPO_ROOT, capture_output=True,
    )

    # This script can genuinely race against scrape-results.yml writing the
    # same two files during a live session - they're in different
    # concurrency groups and not serialized against each other. Rebase onto
    # whatever landed on main since checkout before pushing, same safety net
    # most scrape-*.yml workflows already have (e.g. scrape-news.yml's own
    # "Pull latest before article commit" step).
    pull = subprocess.run(
        ["git", "pull", "--rebase", "--autostash", "origin", "main"],
        cwd=REPO_ROOT, capture_output=True, text=True,
    )
    if pull.returncode != 0:
        log.error(f"git pull --rebase failed before push: {pull.stderr.strip()}")

    push = subprocess.run(["git", "push"], cwd=REPO_ROOT, capture_output=True, text=True)
    if push.returncode != 0:
        log.error(f"git push failed (results/standings committed locally but NOT pushed): {push.stderr.strip()}")
        return False

    log.info("Committed and pushed results")
    return True


def get_top_finisher(year, round_num, label):
    try:
        path = os.path.join(REPO_ROOT, "data", f"results{year}.json")
        with open(path) as f:
            data = json.load(f)
        rnd = next((r for r in data["rounds"] if r["round"] == round_num), None)
        if not rnd:
            return None
        session = next((r for r in rnd["races"] if r["label"] == label), None)
        if not session or not session["results"]:
            return None
        top = session["results"][0]
        return top["driver"]
    except Exception:
        return None


# ── Session-complete handler ──────────────────────────────────────────────────

def handle_session_complete(session, year, round_num, venue):
    label   = session["label"]
    suffix  = session.get("suffix")
    topic   = RESULTS_TOPICS.get(label)
    channel = label.lower().replace(" ", "_")
    # Every session in the current 6-session format (Free Practice,
    # Qualifying, Qualifying Race, Race 1-3) gets its own full results
    # notification - confirmed against the 2026 regs (no Q1/Q2 partial-
    # qualifying split anywhere in them) that the old is_q1/notify_results
    # exception this used to check was dead logic from an earlier format,
    # not something the current season can actually hit. Removed rather
    # than carried forward silently.

    log.info(f"▶ session complete: {label}")

    if not suffix:
        log.info(f"  No PDF suffix for {label} — skipping scrape")
        return

    # TSL PDFs typically appear 2–5 minutes after the chequered flag
    log.info("  Waiting 3 minutes for PDF publication…")
    time.sleep(180)

    if not run_scraper(year, round_num):
        log.error(f"  Scraper failed for {label}")
        return

    commit_and_push(round_num)

    top = get_top_finisher(year, round_num, label)
    race_num = label.split()[-1] if label.startswith("Race") else None

    if label == "Free Practice":
        title = f"Free Practice Results — Round {round_num}"
        body  = f"{top} leads FP at {venue}" if top else f"FP results available"
    elif label == "Qualifying":
        title = f"Qualifying Results — Round {round_num}"
        body  = f"{top} takes pole at {venue}" if top else f"Qualifying results available"
    elif label == "Qualifying Race":
        title = f"Qualifying Race Result — Round {round_num}"
        body  = f"{top} wins the Qualifying Race" if top else f"Qualifying Race result available"
    else:
        title = f"Race {race_num} Result — Round {round_num}"
        body  = f"{top} wins Race {race_num} at {venue}" if top else f"Race {race_num} result available"

    send_fcm(
        topic, title, body, channel,
        extra_data={"type": "results", "round": str(round_num), "year": str(year)},
    )


# ── TSL SignalR connection ────────────────────────────────────────────────────

def connect_and_watch(event_id, sessions, year, round_num, venue):
    session_queue = list(sessions)
    registered    = [False]
    lock          = threading.Lock()

    def on_open(ws):
        log.info("WebSocket open — sending SignalR handshake")
        ws.send(json.dumps({"protocol": "json", "version": 1}) + "\x1e")

    def on_message(ws, msg):
        # Detect handshake ack ({} + record separator)
        if not registered[0] and msg.strip("\x1e") == "{}":
            inv = json.dumps({"type": 1, "target": "registerForEvent", "arguments": [event_id]}) + "\x1e"
            ws.send(inv)
            registered[0] = True
            log.info(f"Registered for TSL event {event_id}")
            return

        if "sessioncomplete" in msg:
            log.info(f"sessioncomplete received — raw: {msg[:200]}")
            with lock:
                if not session_queue:
                    log.warning("sessioncomplete fired but session queue is empty")
                    return
                sess = session_queue.pop(0)

            threading.Thread(
                target=handle_session_complete,
                args=(sess, year, round_num, venue),
                daemon=True,
            ).start()

            if not session_queue:
                log.info("All sessions for this day complete — watcher done")

    def on_error(ws, err):
        log.error(f"WebSocket error: {err}")

    def on_close(ws, code, reason):
        log.warning(f"WebSocket closed ({code}: {reason})")

    while True:
        try:
            # Negotiate
            neg_url = "https://livetiming.tsl-timing.com/tracking/live/negotiate?negotiateVersion=1"
            req = urllib.request.Request(
                neg_url, method="POST", headers={"Content-Type": "application/json"}
            )
            with urllib.request.urlopen(req, timeout=15) as r:
                neg   = json.loads(r.read())
                token = urllib.parse.quote(neg["connectionToken"])

            ws_url = f"wss://livetiming.tsl-timing.com/tracking/live?id={token}"
            registered[0] = False

            log.info(f"Connecting to {ws_url[:60]}…")
            app = websocket.WebSocketApp(
                ws_url,
                on_open=on_open,
                on_message=on_message,
                on_error=on_error,
                on_close=on_close,
            )
            app.run_forever(ping_interval=30, ping_timeout=10)

        except Exception as e:
            log.error(f"Connection error: {e}")

        if not session_queue:
            log.info("Session queue empty — exiting")
            break

        log.info("Reconnecting in 15 s…")
        time.sleep(15)


# ── Entry point ───────────────────────────────────────────────────────────────

def main():
    args = parse_args()
    event_id, venue, sessions = load_sessions(args.year, args.round, args.day)

    log.info(f"Session watcher: Round {args.round} ({args.day}) — {venue} — TSL event {event_id}")
    log.info(f"Sessions: {[s['label'] for s in sessions]}")

    # No pre-session notification thread any more - sendSessionNotifications
    # (functions/sessionNotifications.js, a separate always-running Firebase
    # schedule) already sends those reliably. See this file's own module
    # docstring for why running both would double-send every pre-session
    # alert.

    # Connect to TSL and watch for sessioncomplete events
    connect_and_watch(event_id, sessions, args.year, args.round, venue)


if __name__ == "__main__":
    main()
