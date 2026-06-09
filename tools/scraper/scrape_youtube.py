#!/usr/bin/env python3
"""
Find the ITV Sport Extra full-races compilation for the most recently completed
BTCC race weekend and detect Race 2 / Race 3 start timestamps via green-screen
detection. Writes youtubeUrls[1/2/3] into data/results2026.json (authoritative
long-term record) and also updates data/calendar.json (used by the track card
race buttons until the calendar rolls over to a new season).

Usage:
    python scrape_youtube.py                         # writes to results2026.json + calendar.json
    python scrape_youtube.py --dry-run               # prints detected URLs, no file changes
    python scrape_youtube.py --round 2 --dry-run     # target a specific round
    python scrape_youtube.py --cookies /path/cookies.txt  # use explicit cookies file

Authentication:
    - Locally: defaults to --cookies-from-browser safari
    - GitHub Actions: set YT_COOKIES_FILE env var pointing to a cookies.txt secret
"""

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from datetime import date, datetime
from pathlib import Path

ROOT          = Path(__file__).resolve().parent.parent.parent
CALENDAR_JSON = ROOT / "data" / "calendar.json"
RESULTS_JSON  = ROOT / "data" / "results2026.json"

ITV_CHANNEL   = "https://www.youtube.com/@ITVSportExtra/videos"
TITLE_PATTERN = re.compile(r"full races.*btcc 2026", re.IGNORECASE)

# --- green detection thresholds (BTCC title card) ---
GREEN_MIN_G      = 80
GREEN_MAX_R      = 100
GREEN_RATIO_RG   = 1.5   # G > R * ratio
GREEN_RATIO_BG   = 1.3   # G > B * ratio
GREEN_FRAME_FRAC = 0.45  # fraction of pixels that must be green

# Set once in main(), prepended to every yt-dlp call
_COOKIES_ARGS = []


def load_calendar():
    with open(CALENDAR_JSON) as f:
        return json.load(f)


def save_calendar(calendar):
    with open(CALENDAR_JSON, "w") as f:
        json.dump(calendar, f, indent=2)
        f.write("\n")


def load_results():
    with open(RESULTS_JSON) as f:
        return json.load(f)


def save_results(results):
    with open(RESULTS_JSON, "w") as f:
        json.dump(results, f, indent=2)
        f.write("\n")


def find_target_round(calendar, results):
    """Return the most recently completed round that lacks full race URLs in results2026.json."""
    today = date.today()
    completed = [
        r for r in calendar.get("rounds", [])
        if r.get("endDate") and datetime.strptime(r["endDate"], "%Y-%m-%d").date() <= today
    ]
    if not completed:
        return None
    completed.sort(key=lambda r: r["endDate"], reverse=True)
    results_by_round = {r["round"]: r for r in results.get("rounds", [])}
    for r in completed:
        result = results_by_round.get(r["round"], {})
        urls = result.get("youtubeUrls", [])
        if len(urls) >= 6 and all(urls[3:6]):
            print(f"Round {r['round']} ({r['venue']}) already has all race URLs, skipping.")
            continue
        return r
    return None


def yt_dlp(*args):
    result = subprocess.run(
        ["yt-dlp", *_COOKIES_ARGS, *args],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        print("yt-dlp stderr:", result.stderr[-2000:])
        result.check_returncode()
    return result


def resolve_cookies(cookies_arg):
    """
    Return yt-dlp cookie flags as a list.
    Priority: --cookies arg > YT_COOKIES_FILE env > cookies-from-browser safari (local).
    """
    if cookies_arg:
        print(f"Using cookies file: {cookies_arg}")
        return ["--cookies", cookies_arg]

    env_file = os.environ.get("YT_COOKIES_FILE")
    if env_file:
        print(f"Using cookies file from YT_COOKIES_FILE: {env_file}")
        return ["--cookies", env_file]

    # Local fallback - read from Safari
    print("Using cookies from Safari browser.")
    return ["--cookies-from-browser", "safari"]


def _parse_yt_dlp_entries(stdout, venue_words, source_label):
    """Parse yt-dlp --dump-json output and return (video_id, title) for the first matching entry."""
    lines = stdout.strip().splitlines()
    print(f"yt-dlp returned {len(lines)} lines of output ({source_label})")
    for line in lines:
        try:
            entry = json.loads(line)
        except json.JSONDecodeError:
            print(f"  [skip] non-JSON line: {line[:80]}")
            continue
        title = entry.get("title", "")
        print(f"  [check] '{title}'")
        if not TITLE_PATTERN.search(title):
            print(f"          ^ no TITLE_PATTERN match")
            continue
        title_lower = title.lower()
        if any(w in title_lower for w in venue_words):
            video_id = entry.get("id") or entry.get("url", "").split("v=")[-1]
            print(f"Found: '{title}' (id={video_id})")
            return video_id, title
        print(f"          ^ title matched but venue words {venue_words} not found")
    return None, None


def get_uploads_url():
    """Return the uploads playlist URL for ITV Sport Extra.

    Every YouTube channel has an uploads playlist at UU{channel_id[2:]} which
    returns all uploads in strict reverse-chronological order - unlike the
    channel /videos tab which yt-dlp fetches as a mixed shelf.
    """
    result = yt_dlp(
        "--flat-playlist",
        "--dump-json",
        "--playlist-items", "1",
        ITV_CHANNEL,
    )
    for line in result.stdout.strip().splitlines():
        try:
            entry = json.loads(line)
            cid = entry.get("channel_id", "")
            if cid.startswith("UC"):
                return f"https://www.youtube.com/playlist?list=UU{cid[2:]}"
        except json.JSONDecodeError:
            pass
    return None


def search_itv_channel(venue):
    """Return (video_id, title) for the BTCC full-races video matching venue.

    Fetches the 5 most recent uploads from ITV Sport Extra via the channel's
    uploads playlist (UU...), which is always sorted newest-first. Falls back
    to the general channel feed if the uploads URL cannot be resolved.
    """
    venue_words = [w.lower() for w in venue.split() if len(w) > 3]

    uploads_url = get_uploads_url()
    if uploads_url:
        print(f"Searching ITV Sport Extra recent uploads for '{venue}'...")
        result = yt_dlp(
            "--flat-playlist",
            "--dump-json",
            "--playlist-end", "5",
            uploads_url,
        )
        video_id, title = _parse_yt_dlp_entries(result.stdout, venue_words, "recent uploads")
        if video_id:
            return video_id, title
        print("No match in recent uploads - falling back to channel feed...")

    result = yt_dlp(
        "--flat-playlist",
        "--dump-json",
        "--playlist-end", "40",
        ITV_CHANNEL,
    )
    return _parse_yt_dlp_entries(result.stdout, venue_words, "channel feed")


def get_chapters(video_id):
    """Return list of chapter dicts from yt-dlp metadata, or []."""
    url = f"https://www.youtube.com/watch?v={video_id}"
    result = yt_dlp("--dump-json", "--no-playlist", url)
    info = json.loads(result.stdout)
    return info.get("chapters") or []


def chapters_to_timestamps(chapters):
    """Extract Race 1/2/3 start times from chapter list. Returns (t1, t2, t3) or None."""
    race_times = {}
    for ch in chapters:
        title = ch.get("title", "").lower()
        for n in (1, 2, 3):
            if f"race {n}" in title:
                race_times[n] = int(ch["start_time"])
    if 2 in race_times and 3 in race_times:
        return race_times.get(1, 0), race_times[2], race_times[3]
    return None


def is_green_frame(img_array):
    """Return True if >GREEN_FRAME_FRAC of pixels match the BTCC green card colour."""
    import numpy as np
    r = img_array[:, :, 0].astype(int)
    g = img_array[:, :, 1].astype(int)
    b = img_array[:, :, 2].astype(int)
    mask = (
        (g > GREEN_MIN_G) &
        (r < GREEN_MAX_R) &
        (g > r * GREEN_RATIO_RG) &
        (g > b * GREEN_RATIO_BG)
    )
    return mask.mean() > GREEN_FRAME_FRAC


def detect_green_clusters(frames_dir):
    """
    Scan 1fps frames (named %05d.jpg starting at 00001 = t=0s).
    Returns list of (start_second, end_second) for green clusters after t=60s.
    """
    from PIL import Image
    import numpy as np

    frame_files = sorted(Path(frames_dir).glob("*.jpg"))
    in_cluster = False
    cluster_start = None
    clusters = []

    for frame_file in frame_files:
        t = int(frame_file.stem) - 1  # 00001.jpg = t=0
        img = Image.open(frame_file).convert("RGB")
        arr = np.array(img)
        green = is_green_frame(arr)

        if green and not in_cluster:
            in_cluster = True
            cluster_start = t
        elif not green and in_cluster:
            in_cluster = False
            if cluster_start >= 60:
                clusters.append((cluster_start, t - 1))

    if in_cluster and cluster_start >= 60:
        clusters.append((cluster_start, int(frame_files[-1].stem) - 1))

    return clusters


def detect_race_timestamps(video_id):
    """Download 144p video, extract 1fps frames, find green clusters. Returns (t2, t3) seconds."""
    url = f"https://www.youtube.com/watch?v={video_id}"
    tmpdir = tempfile.mkdtemp(prefix="btcc_yt_")
    video_path = os.path.join(tmpdir, "race.mp4")
    frames_dir = os.path.join(tmpdir, "frames")
    os.makedirs(frames_dir)

    try:
        print("Downloading video (360p, ~300MB - this will take several minutes)...")
        yt_dlp(
            "-f", "18/worst",
            "--extractor-args", "youtube:player_client=android",
            "-o", video_path,
            "--no-playlist",
            url,
        )

        print("Extracting 1fps frames at 80x45...")
        subprocess.run(
            [
                "ffmpeg", "-i", video_path,
                "-vf", "fps=1,scale=80:45",
                "-q:v", "5",
                os.path.join(frames_dir, "%05d.jpg"),
            ],
            check=True,
            capture_output=True,
        )

        print("Scanning frames for BTCC green title card...")
        clusters = detect_green_clusters(frames_dir)
        print(f"Green clusters found (t>=60s): {clusters}")

        if len(clusters) < 2:
            print("ERROR: fewer than 2 green clusters detected after t=60s")
            return None, None

        t2 = clusters[0][0]
        t3 = clusters[1][0]
        return t2, t3

    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)


def build_urls(video_id, t1, t2, t3):
    base = f"https://www.youtube.com/watch?v={video_id}"
    r1 = f"{base}&t={t1}"
    r2 = f"{base}&t={t2}"
    r3 = f"{base}&t={t3}"
    return r1, r2, r3


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="Print results without writing results2026.json")
    parser.add_argument("--round", type=int, help="Target a specific round number (bypasses auto-detection)")
    parser.add_argument("--video-id", help="YouTube video ID to use directly (bypasses channel search)")
    parser.add_argument("--cookies", help="Path to a Netscape cookies.txt file for YouTube auth")
    args = parser.parse_args()

    global _COOKIES_ARGS
    if args.video_id and args.round is None:
        print("ERROR: --video-id requires --round to avoid targeting the wrong round.")
        sys.exit(1)

    _COOKIES_ARGS = resolve_cookies(args.cookies)

    calendar = load_calendar()
    results = load_results()

    if args.round is not None:
        rounds = calendar.get("rounds", [])
        target = next((r for r in rounds if r["round"] == args.round), None)
        if target is None:
            print(f"ERROR: Round {args.round} not found in calendar.json")
            sys.exit(1)
        print(f"Forcing round {args.round} ({target['venue']}) via --round flag")
    else:
        target = find_target_round(calendar, results)

    if target is None:
        print("No round needs YouTube URLs.")
        sys.exit(0)

    venue = target["venue"]
    round_num = target["round"]
    print(f"Target: Round {round_num} - {venue}")

    if args.video_id:
        video_id = args.video_id
        print(f"Using supplied video ID: {video_id}")
    else:
        video_id, title = search_itv_channel(venue)
        if not video_id:
            print(f"No ITV Sport Extra video found yet for venue '{venue}' - will retry on next run.")
            print(f"Tip: find the video manually and re-run with --video-id <id>")
            sys.exit(0)

    print("Checking for YouTube chapters...")
    chapters = get_chapters(video_id)
    timestamps = chapters_to_timestamps(chapters) if chapters else None

    if timestamps:
        t1, t2, t3 = timestamps
        print(f"Chapters found - Race 1: {t1}s, Race 2: {t2}s, Race 3: {t3}s")
    else:
        print("No chapters found - falling back to green-screen detection.")
        t2, t3 = detect_race_timestamps(video_id)
        if t2 is None:
            print("ERROR: Could not detect race timestamps.")
            sys.exit(1)
        t1 = 0
        print(f"Detected - Race 1: 0s (start), Race 2: {t2}s, Race 3: {t3}s")

    r1_url, r2_url, r3_url = build_urls(video_id, t1, t2, t3)

    # results2026.json format: [fp, qual, qualRace, r1, r2, r3]  (RoundResultsScreen + TrackDetailScreen)
    # Scraper only captures full-race URLs; preserve existing fp/qual/qualRace slots.
    results = load_results()
    existing_result = next((r for r in results["rounds"] if r["round"] == round_num), {})
    existing_result_urls = existing_result.get("youtubeUrls", ["", "", "", "", "", ""])
    results_urls = [
        existing_result_urls[0] if len(existing_result_urls) > 0 else "",
        existing_result_urls[1] if len(existing_result_urls) > 1 else "",
        existing_result_urls[2] if len(existing_result_urls) > 2 else "",
        r1_url, r2_url, r3_url,
    ]

    print("\nDetected YouTube URLs:")
    print(f"  results  [3] Race 1      : {results_urls[3]}")
    print(f"  results  [4] Race 2      : {results_urls[4]}")
    print(f"  results  [5] Race 3      : {results_urls[5]}")

    if args.dry_run:
        print("\n--dry-run: no files were modified.")
        return

    for r in results["rounds"]:
        if r["round"] == round_num:
            r["youtubeUrls"] = results_urls
            break

    save_results(results)
    print(f"\nWritten to results2026.json for Round {round_num} ({venue}).")


if __name__ == "__main__":
    main()
