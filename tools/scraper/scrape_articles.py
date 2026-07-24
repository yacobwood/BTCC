#!/usr/bin/env python3
"""
BTCC full article mirror scraper - mirrors the latest ~50 btcc.net articles
(title, full content, image, category) to data/articles.json so the app's
News tab and article deep-links can read from GitHub instead of hitting
btcc.net's WordPress REST API directly. That REST API (/wp-json/*) now
returns 401 Unauthorized for every client, unauthenticated or not, while
plain HTML pages still load fine - see project_wp_rest_api_lockdown memory.

Two btcc.net endpoints are used instead, neither of them wp-json:
  - /news/            HTML listing page - gives slug + featured image for
                       the latest ~50 articles in a single request.
  - /feed/?paged=N     WordPress RSS feed - gives full HTML content
                       (content:encoded), ~10 items per page, not blocked.

Merged by slug into a WP-REST-API-shaped array matching what
src/api/parsers.js's parseArticle() already expects, so the client only
needed a new data source, not a new parser.

Fetches through the btcc-relay Cloudflare Worker (see btcc_relay.py) since
btcc.net's origin separately blocks GitHub Actions/GCP IPs with a 403.

Usage:
    python scrape_articles.py [--dry-run]
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from email.utils import parsedate_to_datetime
from pathlib import Path
from urllib.parse import urlparse, parse_qs
from xml.etree import ElementTree

from btcc_relay import fetch_via_relay

NEWS_URL = "https://www.btcc.net/news/"
FEED_URL = "https://www.btcc.net/feed/"
DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"
ARTICLES_JSON = DATA_DIR / "articles.json"

MAX_RSS_PAGES = 6   # ~60 items fetched - comfortably covers the /news/ page's 50 cards
TARGET_COUNT = 50   # matches the number of cards the /news/ listing page returns

ARTICLE_RE = re.compile(r'<article class="wpgb-card[^"]*wpgb-post-(\d+)".*?</article>', re.DOTALL)
TITLE_RE = re.compile(r'blogBlockTitle"><a href="https://btcc\.net/([a-z0-9-]+)/">([^<]+)</a>')
IMAGE_RE = re.compile(r'<a href="(https://btcc\.net/wp-content/uploads/[^"]+)"[^>]*data-type="image"')

CONTENT_TAG = "{http://purl.org/rss/1.0/modules/content/}encoded"


def _fetch(url: str) -> str:
    return fetch_via_relay(url).text


def scrape_images_by_slug() -> dict:
    """Fetch /news/ and return {slug: image_url} for every article card found."""
    try:
        html = _fetch(NEWS_URL)
    except Exception as e:
        print(f"WARNING: could not fetch news listing ({e}) - articles will have no images", file=sys.stderr)
        return {}
    images = {}
    for m in ARTICLE_RE.finditer(html):
        block = m.group(0)
        title_m = TITLE_RE.search(block)
        if not title_m:
            continue
        image_m = IMAGE_RE.search(block)
        if image_m:
            images[title_m.group(1)] = image_m.group(1)
    return images


def _slug_from_link(link: str) -> str:
    return link.rstrip("/").rsplit("/", 1)[-1]


def _id_from_guid(guid: str) -> int:
    qs = parse_qs(urlparse(guid).query)
    return int(qs["p"][0]) if "p" in qs else 0


def scrape_rss_items() -> list:
    """Fetch RSS feed pages until TARGET_COUNT items are gathered or a page runs short."""
    items_by_id = {}
    for page in range(1, MAX_RSS_PAGES + 1):
        url = FEED_URL if page == 1 else f"{FEED_URL}?paged={page}"
        try:
            xml_text = _fetch(url)
        except Exception as e:
            print(f"WARNING: could not fetch feed page {page} ({e})", file=sys.stderr)
            break
        try:
            root = ElementTree.fromstring(xml_text)
        except ElementTree.ParseError as e:
            print(f"WARNING: feed page {page} did not parse as XML ({e})", file=sys.stderr)
            break
        page_items = root.findall("./channel/item")
        if not page_items:
            break
        for item in page_items:
            link = (item.findtext("link") or "").strip()
            guid = (item.findtext("guid") or "").strip()
            post_id = _id_from_guid(guid)
            if not link or not post_id:
                continue
            pub_date_raw = (item.findtext("pubDate") or "").strip()
            try:
                date_iso = parsedate_to_datetime(pub_date_raw).isoformat()
            except (TypeError, ValueError):
                date_iso = ""
            items_by_id[post_id] = {
                "id": post_id,
                "slug": _slug_from_link(link),
                "link": link,
                "title": (item.findtext("title") or "").strip(),
                "date": date_iso,
                "category": (item.findtext("category") or "").strip(),
                "description": (item.findtext("description") or "").strip(),
                "content": (item.findtext(CONTENT_TAG) or "").strip(),
            }
        if len(page_items) < 10 or len(items_by_id) >= TARGET_COUNT:
            break
    return list(items_by_id.values())


def build_articles() -> list:
    images = scrape_images_by_slug()
    items = scrape_rss_items()

    posts = []
    for it in items:
        embedded = {}
        image_url = images.get(it["slug"])
        if image_url:
            embedded["wp:featuredmedia"] = [{"source_url": image_url}]
        if it["category"]:
            embedded["wp:term"] = [[{"name": it["category"]}]]
        posts.append({
            "id": it["id"],
            "slug": it["slug"],
            "link": it["link"],
            "date": it["date"],
            "title": {"rendered": it["title"]},
            "excerpt": {"rendered": it["description"]},
            "content": {"rendered": it["content"]},
            "_embedded": embedded,
        })

    posts.sort(key=lambda p: p["date"], reverse=True)
    return posts[:TARGET_COUNT]


def main():
    ap = argparse.ArgumentParser(description="Mirror the latest BTCC articles into data/articles.json")
    ap.add_argument("--dry-run", action="store_true", help="Print result only, do not write")
    args = ap.parse_args()

    posts = build_articles()
    if not posts:
        print("ERROR: scraped zero articles - refusing to overwrite data/articles.json", file=sys.stderr)
        sys.exit(1)

    print(f"Scraped {len(posts)} article(s)")
    for p in posts[:5]:
        print(f"  {p['id']}: {p['title']['rendered']}")

    if args.dry_run:
        print("Dry run - no file written.")
        return

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with open(ARTICLES_JSON, "w") as f:
        json.dump(posts, f, indent=2)
    print(f"Wrote {ARTICLES_JSON}")


if __name__ == "__main__":
    main()
