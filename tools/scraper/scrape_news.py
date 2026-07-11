#!/usr/bin/env python3
"""
BTCC News Scraper - latest article from btcc.net's news page.
Writes a WordPress-REST-API-shaped array to data/news.json so the
sendSessionNotifications Cloud Function can read it from GitHub instead of
hitting btcc.net directly (Cloudflare blocks the Cloud Function's runtime
fetch, which cannot impersonate a browser TLS fingerprint).

Scrapes the rendered /news/ page rather than the /wp-json/ REST API: the
REST endpoint returns 403 from GitHub Actions' runner IPs even with
curl_cffi's Chrome impersonation, while the plain HTML page (like the
calendar/stats pages the other scrapers already use) does not.

Usage:
    python scrape_news.py [--dry-run]
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

from curl_cffi import requests as cffi_requests

NEWS_URL = "https://www.btcc.net/news/"
DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"
NEWS_JSON = DATA_DIR / "news.json"

ARTICLE_RE = re.compile(r'<article class="wpgb-card[^"]*wpgb-post-(\d+)".*?</article>', re.DOTALL)
TITLE_RE = re.compile(r'blogBlockTitle"><a href="https://btcc\.net/([a-z0-9-]+)/">([^<]+)</a>')
IMAGE_RE = re.compile(r'<a href="(https://btcc\.net/wp-content/uploads/[^"]+)"[^>]*data-type="image"')


def _fetch(url: str) -> str:
    r = cffi_requests.get(url, impersonate="chrome120", timeout=15)
    r.raise_for_status()
    return r.text


def scrape_news() -> list | None:
    """Fetch btcc.net/news/ and return the latest article in WP-REST-API shape, or None on failure."""
    print(f"Fetching {NEWS_URL} …")
    try:
        html = _fetch(NEWS_URL)
    except Exception as e:
        print(f"ERROR: could not fetch news ({e})", file=sys.stderr)
        return None

    article_m = ARTICLE_RE.search(html)
    if not article_m:
        print("ERROR: no article card found - page structure may have changed", file=sys.stderr)
        return None
    post_id, block = article_m.group(1), article_m.group(0)

    title_m = TITLE_RE.search(block)
    if not title_m:
        print("ERROR: could not extract title/slug from article card", file=sys.stderr)
        return None
    slug, title = title_m.group(1), title_m.group(2)

    image_m = IMAGE_RE.search(block)
    image_url = image_m.group(1) if image_m else None

    post = {
        "id": int(post_id),
        "slug": slug,
        "title": {"rendered": title},
        "_embedded": {"wp:featuredmedia": [{"source_url": image_url}]} if image_url else {},
    }
    return [post]


def main():
    ap = argparse.ArgumentParser(description="Scrape latest BTCC news post into data/news.json")
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
