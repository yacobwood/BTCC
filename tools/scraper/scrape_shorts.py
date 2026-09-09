#!/usr/bin/env python3
"""
scrape_shorts.py
Mirrors the "Latest BTCC Shorts" carousel from btcc.net's own homepage into
data/shorts.json - the first scraper in this repo to fetch btcc.net's bare
root URL (every other scraper targets a specific subpath: /news/, /calendar/,
/driver/<slug>/, etc.).

Confirmed live 2026-09-08 (real markup, via a user-supplied screenshot +
copied outerHTML of btcc.net's homepage):
    <a class="short-card" href="https://www.youtube.com/shorts/<id>">
      <span class="short-card-image"><img src="https://i.ytimg.com/vi/<id>/hqdefault.jpg"></span>
    </a>

Only the page fetch itself needs Scrapfly (btcc.net is behind Vercel's BotID
challenge, same as every other page on the site) - the thumbnail URL is
YouTube's own public CDN (i.ytimg.com), not signed, not expiring, and not
behind any challenge, so it's derived directly from the video ID rather than
scraped separately or mirrored as image bytes. That's also why this script
never imports media_utils/scrapfly_fallback's image-fetch helpers - there's
nothing to download, just a URL to construct from an ID already confirmed
stable and public.

Each run replaces data/shorts.json's contents wholesale with whatever's
currently showing on the homepage - this mirrors a rotating "latest N
shorts" widget, not an accumulating archive, so there's no merge/append step
(unlike scrape_calendar.py's merge-into-existing-rounds logic).

Usage:
    python scrape_shorts.py
"""

from __future__ import annotations

import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

from scrapfly_fallback import fetch_via_scrapfly

HOMEPAGE_URL = "https://btcc.net/"
DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"
SHORTS_JSON = DATA_DIR / "shorts.json"

# Matches every <a class="short-card" href="https://www.youtube.com/shorts/<id>">
# on the homepage - the video ID is the only thing worth capturing, since the
# thumbnail URL is derived from it (see module docstring) rather than scraped
# from the paired <img src>.
SHORT_RE = re.compile(r'class="[^"]*short-card[^"]*"[^>]*href="https://www\.youtube\.com/shorts/([A-Za-z0-9_-]+)"')


def extract_short_ids(html: str) -> list[str]:
    """Pure parse step, kept separate from any I/O so it's cheaply testable
    against a real HTML fixture. Dedupes while preserving page order - two
    identical hrefs would be a markup oddity, not two genuinely different
    shorts, so a duplicate ID must never produce two entries."""
    seen = set()
    ids = []
    for video_id in SHORT_RE.findall(html):
        if video_id not in seen:
            seen.add(video_id)
            ids.append(video_id)
    return ids


def build_short(video_id: str) -> dict:
    return {
        "videoId": video_id,
        "url": f"https://www.youtube.com/shorts/{video_id}",
        "thumbnailUrl": f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg",
    }


def main() -> None:
    print(f"Fetching {HOMEPAGE_URL} …")
    # wait_for_selector added 2026-09-09, same reasoning as
    # scrape_driver_media.py's own call - waits for the actual carousel
    # content to be rendered rather than trusting Scrapfly's generic
    # render-complete heuristic.
    html = fetch_via_scrapfly(HOMEPAGE_URL, render_js=True, label="shorts", wait_for_selector=".short-card")
    if html is None:
        print(f"ERROR: could not fetch {HOMEPAGE_URL} (Scrapfly fetch failed)", file=sys.stderr)
        sys.exit(1)

    ids = extract_short_ids(html)
    if not ids:
        print("ERROR: no shorts found - page structure may have changed", file=sys.stderr)
        sys.exit(1)

    data = {
        "updatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "shorts": [build_short(video_id) for video_id in ids],
    }

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    SHORTS_JSON.write_text(json.dumps(data, indent=2), encoding="utf-8")
    print(f"Wrote {len(ids)} short(s) to {SHORTS_JSON}")


if __name__ == "__main__":
    main()
