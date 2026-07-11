#!/usr/bin/env python3
"""
BTCC News Scraper - latest WordPress posts from btcc.net's REST API.
Writes the raw response to data/news.json so the sendSessionNotifications
Cloud Function can read it from GitHub instead of hitting btcc.net directly
(Cloudflare blocks non-browser TLS clients, which the Cloud Function's
runtime fetch cannot impersonate).

Usage:
    python scrape_news.py [--dry-run]
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from curl_cffi import requests as cffi_requests

NEWS_URL = (
    "https://www.btcc.net/wp-json/wp/v2/posts"
    "?per_page=1&_fields=id,title,slug,featured_media,_links"
    "&_embed=wp:featuredmedia"
)
DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"
NEWS_JSON = DATA_DIR / "news.json"


def _fetch(url: str) -> list:
    r = cffi_requests.get(url, impersonate="chrome120", timeout=15)
    r.raise_for_status()
    return r.json()


def scrape_news() -> list | None:
    """Fetch the latest btcc.net posts, or None on fetch failure."""
    print(f"Fetching {NEWS_URL} …")
    try:
        posts = _fetch(NEWS_URL)
    except Exception as e:
        print(f"ERROR: could not fetch news ({e})", file=sys.stderr)
        return None

    if not isinstance(posts, list):
        print(f"ERROR: unexpected response shape", file=sys.stderr)
        return None

    return posts


def main():
    ap = argparse.ArgumentParser(description="Scrape latest BTCC news posts into data/news.json")
    ap.add_argument("--dry-run", action="store_true", help="Print result only, do not write")
    args = ap.parse_args()

    posts = scrape_news()
    if posts is None:
        sys.exit(1)

    print(f"Scraped {len(posts)} post(s)")
    for p in posts:
        title = p.get("title", {}).get("rendered", "?")
        print(f"  {p.get('id')}: {title}")

    if args.dry_run:
        print("Dry run - no file written.")
        return

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with open(NEWS_JSON, "w") as f:
        json.dump(posts, f, indent=2)
    print(f"Wrote {NEWS_JSON}")


if __name__ == "__main__":
    main()
