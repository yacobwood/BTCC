#!/usr/bin/env python3
"""
BTCC full article mirror scraper - mirrors the latest btcc.net articles
(title, full content, image, category) to data/articles.json so the app's
News tab and article deep-links can read from GitHub instead of hitting
btcc.net directly.

btcc.net moved off WordPress entirely to a Vercel-hosted React app
(2026-07-31): the old /wp-json/ REST API, and the /feed/ RSS feed this
scraper used for full article content, are both gone. It also now issues
a Vercel BotID JS challenge (HTTP 429) to any request that can't execute
JavaScript, so every fetch here goes through headless Chromium (see
btcc_playwright.py) rather than a direct HTTP request.

Two btcc.net pages are used instead:
  - /news/            rendered listing page - slug, title, excerpt, date
                       and featured image for each card (~25 per load).
  - /<slug>/           each article's own page - full body HTML, fetched
                       only for slugs not already in data/articles.json
                       (existing articles keep their cached content; a
                       full-site backfill only happens once).

There are no more WordPress post IDs, so `id` is now the article slug -
safe, since every consumer of article.id (NewsScreen, DigestsScreen,
digestRead.js, newsCheck.js) already treats it as an opaque string, never
a number.

Article images (btcc.net/api/media/<uuid>) are behind the exact same
Vercel challenge as the page itself, so the app's own Image component
(a plain HTTPS GET from the user's phone, no JS engine) can't load them
directly either - confirmed as the cause of a live "no article images"
report. Images are mirrored into data/media/news/ during the scrape (see
btcc_playwright.get_with_media/save_mirrored_image) and served from
GitHub raw instead - only for articles without an already-mirrored image,
same bounded-cost pattern as the full-content fetch below.

Usage:
    python scrape_articles.py [--dry-run] [--refresh-all]
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

from btcc_playwright import RenderedFetcher, save_mirrored_image

NEWS_URL = "https://www.btcc.net/news/"
DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"
ARTICLES_JSON = DATA_DIR / "articles.json"
MEDIA_DIR = DATA_DIR / "media" / "news"
MEDIA_RAW_BASE = "https://raw.githubusercontent.com/yacobwood/BTCC/main/data/media/news"

ARTICLE_RE = re.compile(r'<article class="news-card[^"]*"[^>]*>.*?</article>', re.DOTALL)
TITLE_RE = re.compile(r'<h3><a href="/([a-z0-9-]+)/">([^<]+)</a></h3>')
IMAGE_RE = re.compile(r'<img[^>]*src="(/api/media/[^"]+)"')
EXCERPT_RE = re.compile(r'<div class="news-card-footer"><p>([^<]*)</p>')
DATE_RE = re.compile(r'<time class="date">([^<]+)</time>')
BODY_RE = re.compile(r'<div class="article-body">(.*?)</div>\s*</article>', re.DOTALL)

_DISPLAY_DATE_RE = re.compile(r"(\d{1,2})(?:st|nd|rd|th)\s+([A-Za-z]+)\s+(\d{4})")
_MONTHS = {
    "january": 1, "february": 2, "march": 3, "april": 4, "may": 5, "june": 6,
    "july": 7, "august": 8, "september": 9, "october": 10, "november": 11, "december": 12,
}


def parse_display_date(text: str) -> str:
    """Parse "30th July 2026" into an ISO date string, or '' if unparseable."""
    m = _DISPLAY_DATE_RE.search(text)
    if not m:
        return ""
    day, month_name, year = m.groups()
    month = _MONTHS.get(month_name.lower())
    if not month:
        return ""
    return f"{year}-{month:02d}-{int(day):02d}T00:00:00"


def scrape_card_list(fetcher: RenderedFetcher) -> tuple[list[dict], dict]:
    """Fetch /news/ and return card metadata for every article found, plus the
    captured media dict (see btcc_playwright.get_with_media) for mirroring."""
    html, media = fetcher.get_with_media(NEWS_URL, wait_selector="article.news-card")
    cards = []
    for m in ARTICLE_RE.finditer(html):
        block = m.group(0)
        title_m = TITLE_RE.search(block)
        if not title_m:
            continue
        slug, title = title_m.group(1), title_m.group(2)
        image_m = IMAGE_RE.search(block)
        excerpt_m = EXCERPT_RE.search(block)
        date_m = DATE_RE.search(block)
        cards.append({
            "slug": slug,
            "title": title,
            "media_url": f"https://btcc.net{image_m.group(1)}" if image_m else None,
            "excerpt": excerpt_m.group(1).strip() if excerpt_m else "",
            "date": parse_display_date(date_m.group(1)) if date_m else "",
        })
    return cards, media


def fetch_article_body(fetcher: RenderedFetcher, slug: str) -> str:
    """Fetch a single article page and return its body's inner HTML."""
    url = f"https://btcc.net/{slug}/"
    html = fetcher.get(url, wait_selector="div.article-body")
    m = BODY_RE.search(html)
    return m.group(1).strip() if m else ""


def load_existing() -> dict:
    if not ARTICLES_JSON.exists():
        return {}
    try:
        posts = json.loads(ARTICLES_JSON.read_text())
    except (json.JSONDecodeError, OSError):
        return {}
    return {p["slug"]: p for p in posts if p.get("slug")}


def build_articles(refresh_all: bool) -> list[dict]:
    existing = load_existing() if not refresh_all else {}

    with RenderedFetcher() as fetcher:
        cards, media = scrape_card_list(fetcher)
        if not cards:
            return []

        posts = []
        for card in cards:
            slug = card["slug"]
            prior = existing.get(slug)
            has_content = bool(prior and prior.get("content", {}).get("rendered"))

            if has_content:
                content_html = prior["content"]["rendered"]
                date_iso = prior.get("date") or card["date"]
                category = prior.get("_embedded", {}).get("wp:term", [[{}]])[0][0].get("name", "")
            else:
                print(f"  Fetching full content: {slug}")
                content_html = fetch_article_body(fetcher, slug)
                date_iso = card["date"]
                category = ""

            prior_image = prior.get("_embedded", {}).get("wp:featuredmedia", [{}])[0].get("source_url") if prior else None
            if prior_image and prior_image.startswith(MEDIA_RAW_BASE):
                image_url = prior_image
            else:
                filename = save_mirrored_image(media, card["media_url"], MEDIA_DIR)
                image_url = f"{MEDIA_RAW_BASE}/{filename}" if filename else None

            embedded = {}
            if image_url:
                embedded["wp:featuredmedia"] = [{"source_url": image_url}]
            if category:
                embedded["wp:term"] = [[{"name": category}]]

            posts.append({
                "id": slug,
                "slug": slug,
                "link": f"https://btcc.net/{slug}/",
                "date": date_iso,
                "title": {"rendered": card["title"]},
                "excerpt": {"rendered": card["excerpt"]},
                "content": {"rendered": content_html},
                "_embedded": embedded,
            })

    posts.sort(key=lambda p: p["date"], reverse=True)
    return posts


def prune_orphaned_images(posts: list[dict]) -> int:
    """Delete mirrored images that no longer belong to any current post - the
    /news/ page only ever shows ~25 cards, so old articles' images would
    otherwise accumulate in the repo forever. Returns the number removed."""
    if not MEDIA_DIR.exists():
        return 0
    referenced = set()
    for p in posts:
        url = p.get("_embedded", {}).get("wp:featuredmedia", [{}])[0].get("source_url")
        if url and url.startswith(MEDIA_RAW_BASE):
            referenced.add(url.rsplit("/", 1)[-1])
    removed = 0
    for f in MEDIA_DIR.iterdir():
        if f.is_file() and f.name not in referenced:
            f.unlink()
            removed += 1
    return removed


def main():
    ap = argparse.ArgumentParser(description="Mirror the latest BTCC articles into data/articles.json")
    ap.add_argument("--dry-run", action="store_true", help="Print result only, do not write")
    ap.add_argument("--refresh-all", action="store_true", help="Re-fetch full content for every article, not just new ones")
    args = ap.parse_args()

    posts = build_articles(args.refresh_all)
    if not posts:
        print("ERROR: scraped zero articles - refusing to overwrite data/articles.json", file=sys.stderr)
        sys.exit(1)

    print(f"Scraped {len(posts)} article(s)")
    for p in posts[:5]:
        print(f"  {p['id']}: {p['title']['rendered']}")

    if args.dry_run:
        print("Dry run - no file written.")
        return

    removed = prune_orphaned_images(posts)
    if removed:
        print(f"Pruned {removed} orphaned mirrored image(s)")

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with open(ARTICLES_JSON, "w") as f:
        json.dump(posts, f, indent=2)
    print(f"Wrote {ARTICLES_JSON}")


if __name__ == "__main__":
    main()
