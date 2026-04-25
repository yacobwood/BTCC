#!/usr/bin/env python3
"""
BTCC Session Watcher
====================
Connects to TSL SignalR live timing for a race weekend, then:

  - Sends a push notification 15 minutes before each session starts
  - When TSL fires `sessioncomplete`, scrapes the results PDF, commits
    the data, and (for the appropriate sessions) sends a results notification

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
from datetime import datetime, timezone, timedelta

import websocket

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("watcher")

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


# ── Argument parsing ──────────────────────────────────────────────────────────

def parse_args():
    p = argparse.ArgumentParser()
    p.add_argument("--round", type=int, required=True, help="Round number (1–10)")
    p.add_argument("--day",   choices=["saturday", "sunday"], required=True)
    p.add_argument("--year",  type=int, default=2026)
    return p.parse_args()


# ── Schedule loading ──────────────────────────────────────────────────────────

def load_sessions(year, round_num, day):
    schedule_path = os.path.join(REPO_ROOT, "data", f"schedule{year}.json")
    with open(schedule_path) as f:
        sched = json.load(f)
    rnd = next((r for r in sched["rounds"] if r["round"] == round_num), None)
    if not rnd:
        log.error(f"Round {round_num} not found in schedule{year}.json")
        sys.exit(1)
    return rnd["tsl"], rnd["venue"], rnd["sessions"][day]


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

    subprocess.run(
        ["git", "commit", "-m", f"chore: update Round {round_num} results [skip ci]"],
        cwd=REPO_ROOT, capture_output=True,
    )
    subprocess.run(["git", "push"], cwd=REPO_ROOT, capture_output=True)
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
    label     = session["label"]
    suffix    = session.get("suffix")
    topic     = session.get("topic")
    channel   = session.get("channel", "general")
    is_q1     = session.get("is_q1", False)
    do_notify = session.get("notify_results", True) and not is_q1

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

    if not do_notify:
        log.info(f"  No results notification for {label} (Q1 partial or disabled)")
        return

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


# ── Pre-session notification thread ──────────────────────────────────────────

def pre_session_notifier(sessions, round_num, venue):
    """Fires 15 min before each session with a notify_pre start time."""
    for sess in sessions:
        start_str = sess.get("start_utc")
        if not start_str or not sess.get("notify_pre"):
            continue

        start_utc = datetime.fromisoformat(start_str.replace("Z", "+00:00"))
        notify_at = start_utc - timedelta(minutes=15)
        now = datetime.now(timezone.utc)

        if notify_at <= now:
            log.info(f"Pre-session: {sess['label']} window already passed")
            continue

        wait_secs = (notify_at - now).total_seconds()
        log.info(f"Pre-session: will notify for {sess['label']} in {wait_secs/60:.0f} min")
        time.sleep(wait_secs)

        label    = sess.get("pre_label", sess["label"])  # Q1 uses "Qualifying" as pre_label
        topic    = sess.get("topic") or "race_alerts"
        channel  = sess.get("channel") or "general"
        start_bst = (start_utc + timedelta(hours=1)).strftime("%H:%M")  # rough BST display

        if label == "Free Practice":
            title = f"Free Practice — Round {round_num}"
            body  = f"{venue} · Free Practice starts at {start_bst} BST"
            topic = "fp_alerts"
            channel = "free_practice"
        elif "Qualifying Race" in label:
            title = f"Qualifying Race — Round {round_num}"
            body  = f"{venue} · Qualifying Race starts at {start_bst} BST"
        elif "Qualifying" in label:
            title = f"Qualifying — Round {round_num}"
            body  = f"{venue} · Qualifying starts at {start_bst} BST"
        else:
            race_num = label.split()[-1]
            title = f"Race {race_num} — Round {round_num}"
            body  = f"{venue} · Race {race_num} starts at {start_bst} BST"

        send_fcm(topic, title, body, channel)


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

    # Start pre-session notification thread
    threading.Thread(
        target=pre_session_notifier,
        args=(sessions, args.round, venue),
        daemon=True,
    ).start()

    # Connect to TSL and watch for sessioncomplete events
    connect_and_watch(event_id, sessions, args.year, args.round, venue)


if __name__ == "__main__":
    main()
