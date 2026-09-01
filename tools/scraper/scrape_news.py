#!/usr/bin/env python3
"""
BTCC News Scraper - latest article from btcc.net's news page.
Writes a WordPress-REST-API-shaped array to data/news.json so the
sendSessionNotifications Cloud Function can read it from GitHub instead of
hitting btcc.net directly at runtime.

btcc.net moved off WordPress entirely to a Vercel-hosted React app
(2026-07-31). It now issues a Vercel BotID JS challenge (HTTP 429) to any
request that can't execute JavaScript. Fetches through Scrapfly's paid
Scrape API (see scrapfly_fallback.py) rather than local Playwright as of
2026-09-01 - `asp=true` clears the challenge from any IP (confirmed live),
so this runs on GitHub-hosted ubuntu-latest instead of needing the
self-hosted runner's residential IP reputation. See
project_scrapfly_full_migration memory for the cost reasoning behind the
07:00-20:00 UTC / hourly-overnight cadence this now runs on (see
scrape-news.yml), and why the image fetch below is gated on "does this
article already have one mirrored" rather than attempted every run - that
gate used to be free with Playwright (an image capture was a side effect of
rendering the page anyway) but costs ~225 credits a time here, ~7.5x a
plain page fetch, so re-fetching an already-mirrored image on every 5-
minute tick would be enormously wasteful.

Article images (btcc.net/api/media/<uuid>) are behind the exact same
Vercel challenge as the page itself, so the app's own Image component
(a plain HTTPS GET from the user's phone, no JS engine) can't load them
directly either - confirmed as the cause of a live "no article images"
report. Images are mirrored into data/media/news/ during the scrape and
served from GitHub raw instead, same as every other piece of scraped data.
A Supabase Storage-hosted image (a shape some pages now use directly - see
MEDIA_SRC_RE_FRAGMENT) needs no Scrapfly at all - confirmed via
scrape-gallery.yml's own comment that host isn't behind btcc.net's Vercel
challenge, so a plain, free request works.

Usage:
    python scrape_news.py [--dry-run] [--force]
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

from media_utils import MEDIA_SRC_RE_FRAGMENT, resolve_media_url, save_mirrored_image
from scrapfly_fallback import fetch_image_smart, fetch_via_scrapfly

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


def _current_slug() -> str | None:
    """Whatever slug data/news.json currently holds, or None if it's
    missing/empty/unreadable - treated the same as "definitely new"."""
    try:
        posts = json.loads(NEWS_JSON.read_text())
        return posts[0].get("slug") if posts else None
    except (OSError, json.JSONDecodeError, IndexError, AttributeError):
        return None


def scrape_news(force: bool = False) -> list | None:
    """Fetch btcc.net/news/ and return the latest article in WP-REST-API
    shape, or None on failure. force=True always (re-)fetches the image
    even if the slug already matches what's committed - for testing, not
    routine use (costs the ~225-credit image fetch every time)."""
    print(f"Fetching {NEWS_URL} …")
    html = fetch_via_scrapfly(NEWS_URL, render_js=True, label="news-listing")
    if html is None:
        print("ERROR: could not fetch news (Scrapfly fetch failed)", file=sys.stderr)
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

    image_url = None
    if not force and slug == _current_slug():
        # Already the current post - reuse whatever image (if any) is
        # already committed rather than re-fetching. Avoids paying the
        # ~225-credit image fetch on every single run for a headline that
        # hasn't changed (confirmed this was a real, unbounded cost bug in
        # the pre-Scrapfly version of this function - harmless there since
        # RenderedFetcher captured images for free as a side effect of
        # rendering the page anyway).
        try:
            existing = json.loads(NEWS_JSON.read_text())
            image_url = existing[0].get("_embedded", {}).get("wp:featuredmedia", [{}])[0].get("source_url")
        except (OSError, json.JSONDecodeError, IndexError, AttributeError):
            pass
    else:
        image_m = IMAGE_RE.search(block)
        if image_m:
            media_url = resolve_media_url(image_m.group(1))
            fetched = fetch_image_smart(media_url, label=slug)
            if fetched:
                filename = save_mirrored_image({media_url: fetched}, media_url, MEDIA_DIR)
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
    ap.add_argument("--force", action="store_true", help="Re-fetch the image even if the slug already matches (for testing - costs the image fetch every time)")
    args = ap.parse_args()

    posts = scrape_news(force=args.force)
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
