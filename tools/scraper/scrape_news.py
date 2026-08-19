#!/usr/bin/env python3
"""
BTCC News Scraper - latest article from btcc.net's news page.
Writes a WordPress-REST-API-shaped array to data/news.json so the
sendSessionNotifications Cloud Function can read it from GitHub instead of
hitting btcc.net directly at runtime.

btcc.net moved off WordPress entirely to a Vercel-hosted React app
(2026-07-31). It now issues a Vercel BotID JS challenge (HTTP 429) to any
request that can't execute JavaScript, so this fetches through headless
Chromium (see btcc_playwright.py) rather than a direct/relayed HTTP
request. The /news/ page's card markup is also entirely new - no more
WordPress post IDs, so `id` is now the article slug (safe: every consumer
of article.id already treats it as an opaque string - see
project_wp_rest_api_lockdown / project_vercel_migration memory).

Article images (btcc.net/api/media/<uuid>) are behind the exact same
Vercel challenge as the page itself, so the app's own Image component
(a plain HTTPS GET from the user's phone, no JS engine) can't load them
directly either - confirmed as the cause of a live "no article images"
report. Images are mirrored into data/media/news/ during the scrape (see
btcc_playwright.get_with_media/save_mirrored_image) and served from
GitHub raw instead, same as every other piece of scraped data.

Usage:
    python scrape_news.py [--dry-run]
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

from btcc_playwright import MEDIA_SRC_RE_FRAGMENT, RenderedFetcher, resolve_media_url, save_mirrored_image

NEWS_URL = "https://btcc.net/news/"
DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"
NEWS_JSON = DATA_DIR / "news.json"
MEDIA_DIR = DATA_DIR / "media" / "news"
MEDIA_RAW_BASE = "https://raw.githubusercontent.com/yacobwood/BTCC/main/data/media/news"

ARTICLE_RE = re.compile(r'<article class="news-card[^"]*"[^>]*>.*?</article>', re.DOTALL)
# Title capture is deliberately permissive ([\s\S]*?, not [^<]+) and stripped
# of tags afterwards - 2026-08-18/19: "could not extract title/slug" hit 7
# times spread across ~9.5 hours that evening (14:56 through 00:23), so this
# is a recurring intermittent fragility, not a one-off tied to a single
# story edit - most plausibly the CMS occasionally renders the title wrapped
# in an inline tag (e.g. a "breaking" badge span) that the old [^<]+ capture
# had zero tolerance for. Not reproducible on demand (page markup was back
# to the plain <h3><a>Title</a></h3> shape by the time this was diagnosed),
# so this is hardening against a recurrence, not a confirmed fix for a known
# live cause.
TITLE_RE = re.compile(r'<h3><a href="/([a-z0-9-]+)/">([\s\S]*?)</a></h3>')
TAG_RE = re.compile(r"<[^>]+>")
IMAGE_RE = re.compile(r'<img[^>]*src="(' + MEDIA_SRC_RE_FRAGMENT + r')"')


def scrape_news() -> list | None:
    """Fetch btcc.net/news/ and return the latest article in WP-REST-API shape, or None on failure."""
    print(f"Fetching {NEWS_URL} …")
    try:
        # retries=3 (one more than RenderedFetcher's own default of 2): this
        # is the single most business-critical scrape - it drives live push
        # notifications and runs every 5 minutes - so a missed tick has a
        # direct notification-latency cost, and the extra attempt costs
        # well under a minute against this workflow's 10-minute timeout.
        with RenderedFetcher(retries=3) as fetcher:
            html, media = fetcher.get_with_media(NEWS_URL, wait_selector="article.news-card")
    except Exception as e:
        print(f"ERROR: could not fetch news ({e})", file=sys.stderr)
        return None

    article_m = ARTICLE_RE.search(html)
    if not article_m:
        print("ERROR: no article card found - page structure may have changed", file=sys.stderr)
        return None
    block = article_m.group(0)

    title_m = TITLE_RE.search(block)
    if not title_m:
        print("ERROR: could not extract title/slug from article card", file=sys.stderr)
        return None
    slug, title = title_m.group(1), TAG_RE.sub("", title_m.group(2)).strip()
    if not title:
        print("ERROR: could not extract title/slug from article card", file=sys.stderr)
        return None

    image_m = IMAGE_RE.search(block)
    media_url = resolve_media_url(image_m.group(1)) if image_m else None
    filename = save_mirrored_image(media, media_url, MEDIA_DIR)
    image_url = f"{MEDIA_RAW_BASE}/{filename}" if filename else None

    post = {
        "id": slug,
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
