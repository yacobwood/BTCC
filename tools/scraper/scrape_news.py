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

Before attempting that fetch at all, _archive_mirrored_image() checks
whether scrape_articles.py's own full mirror (data/articles/, run right
after this script in the same job) already has this exact slug's image
mirrored from an earlier run - a free, reliable second source that can't
time out. Added 2026-09-02 after a run where this script's own fetch of an
already-known headline's image kept hitting ordinary transient timeouts
while the identical image sat already-mirrored in the archive the whole
time.

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
ARTICLES_DIR = DATA_DIR / "articles"
ARTICLES_INDEX = ARTICLES_DIR / "index.json"

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


def _archive_mirrored_image(slug: str) -> str | None:
    """The full article mirror (scrape_articles.py, run right after this
    script within the same job - see scrape-news.yml) tracks every known
    slug's own mirrored image independently in data/articles/, and once a
    fetch has succeeded there it stays cached indefinitely (gated on "does
    this article already have one mirrored", same idea as this script's own
    gate). That makes it a free, reliable second source worth checking
    before paying for (or retrying) this script's own separate Scrapfly
    fetch of the exact same file.

    Confirmed live 2026-09-02: croft-takes-centre-stage-as-btcc-season-
    enters-final-stretch's hero image kept hitting ordinary transient
    Scrapfly timeouts here on repeated retries, while the identical
    /api/media/<uuid> image had already succeeded and sat mirrored in the
    article archive the whole time from an earlier run - this script just
    never looked. Returns None if the slug isn't in the archive at all
    (most likely a genuinely brand-new headline that scrape_articles.py
    hasn't reached yet this run - it runs after this script, so a headline
    appearing for the very first time won't be there yet) or has no image
    of its own there either."""
    try:
        index = json.loads(ARTICLES_INDEX.read_text())
        page_num = index.get(slug)
        if page_num is None:
            return None
        page = json.loads((ARTICLES_DIR / f"page_{page_num}.json").read_text())
        for article in page:
            if article.get("slug") == slug:
                return article.get("_embedded", {}).get("wp:featuredmedia", [{}])[0].get("source_url")
    except (OSError, json.JSONDecodeError, AttributeError, TypeError):
        pass
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

    current_slug = _current_slug()
    image_url = None
    if slug == current_slug:
        # Same article as what's already committed - default to reusing
        # whatever image (if any) is already there, whether or not we're
        # about to attempt a fresh fetch below. Only meaningful when the
        # slug matches: an existing image belongs to THIS article, so it's
        # a safe fallback; it would be actively wrong to reuse it as a
        # placeholder for a genuinely different (new) headline below.
        try:
            existing = json.loads(NEWS_JSON.read_text())
            image_url = existing[0].get("_embedded", {}).get("wp:featuredmedia", [{}])[0].get("source_url")
        except (OSError, json.JSONDecodeError, IndexError, AttributeError):
            pass

    if not image_url:
        # Free, reliable second source before paying for (or retrying) our
        # own fetch of the same file - see _archive_mirrored_image's own
        # docstring for the incident this closes.
        image_url = _archive_mirrored_image(slug)

    if force or slug != current_slug:
        # Either a genuinely new headline (always worth trying once), or a
        # forced re-check of an unchanged one. Confirmed live 2026-09-02: a
        # failed fetch here must fall through to whatever image_url was
        # already set to above, NOT reset to None - an earlier version of
        # this function defaulted to None unconditionally whenever a fetch
        # was attempted, so a single transient Scrapfly failure during a
        # --force run silently wiped out an image that had been working
        # fine moments before.
        image_m = IMAGE_RE.search(block)
        if image_m:
            media_url = resolve_media_url(image_m.group(1))
            fetched = fetch_image_smart(media_url, label=slug)
            if fetched:
                filename = save_mirrored_image({media_url: fetched}, media_url, MEDIA_DIR)
                if filename:
                    image_url = f"{MEDIA_RAW_BASE}/{filename}"

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
