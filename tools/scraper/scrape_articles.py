#!/usr/bin/env python3
"""
BTCC full article mirror scraper - mirrors btcc.net articles (title, full
content, image, category) into data/articles/ so the app's News tab and
article deep-links can read from GitHub instead of hitting btcc.net
directly.

btcc.net moved off WordPress entirely to a Vercel-hosted React app
(2026-07-31): the old /wp-json/ REST API, and the /feed/ RSS feed this
scraper used for full article content, are both gone. It also now issues
a Vercel BotID JS challenge (HTTP 429) to any request that can't execute
JavaScript, so every fetch here goes through headless Chromium (see
btcc_playwright.py) rather than a direct HTTP request.

Two btcc.net pages are used:
  - /news/, /news/page/<n>/   rendered listing pages - slug, title,
                       excerpt, date and featured image for each card
                       (~25 per load).
  - /<slug>/           each article's own page - full body HTML, fetched
                       only for slugs not already mirrored, UNLESS the
                       cached content is itself a "More to follow..."
                       stub (btcc.net's own convention for a live
                       race-weekend report published before the session
                       result lands) - see needs_full_refetch(). Without
                       that check a stub is "already mirrored" forever;
                       two Snetterton reports sat unfinished for 2.5+
                       months before this existed.

Output shape mirrors the old wp-json REST API's own per-page/per-slug
fetch granularity (see git history: fetchArticles() used to hit
`?per_page=20&page=N`, fetchArticleBySlug() hit `?slug=X`, each cached
under its own key) rather than one ever-growing blob - that's what let the
old system show a genuinely deep, lazily-loaded archive without every
page load paying for the whole thing:
  - data/articles/page_<n>.json   PAGE_SIZE articles each, newest first.
  - data/articles/index.json      {slug: page_number} for every mirrored
                                   article, so a slug-based lookup (deep
                                   links, notifications) only has to fetch
                                   this small index plus the one page file
                                   that actually contains it.
A prior version of this scraper wrote a single data/articles.json capped
at MAX_ARTICLES - that made every list fetch, search, and slug lookup
download the *entire* archive's full HTML content regardless of which
page was actually requested (checked: ~500 articles ≈ 3MB, re-fetched and
re-cached every 5 minutes whenever the News tab was open). Splitting into
per-page files fixes that: a normal list fetch only ever downloads the
one ~20-article page it asked for.

Each run's ~25 freshly-scraped cards are merged into whatever's already
mirrored (new slugs added, existing ones keep their cached content/image)
before being re-partitioned into page files - MAX_ARTICLES still bounds
total repo/image growth, oldest articles dropped past that.

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
    python scrape_articles.py [--dry-run] [--refresh-all] [--backfill-pages N]
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

from btcc_playwright import MEDIA_SRC_RE_FRAGMENT, RenderedFetcher, resolve_media_url, save_mirrored_image

NEWS_URL = "https://btcc.net/news/"
PAGE_SIZE = 20  # must match src/api/client.js's fetchArticles() perPage
MAX_ARTICLES = 500
DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"
ARTICLES_DIR = DATA_DIR / "articles"
INDEX_JSON = ARTICLES_DIR / "index.json"
# Every currently-installed app build still runs the pre-split client.js,
# which fetches this single flat file directly - deleting it the moment the
# per-page split shipped 404'd the News tab for every live user, since the
# fix (the new per-page client.js) can only reach devices via a store
# release. Keep writing it, unchanged in shape, until a release ships that
# no longer requests it - remove only after confirming via app version
# analytics that no build older than that release is still active.
LEGACY_ARTICLES_JSON = DATA_DIR / "articles.json"
MEDIA_DIR = DATA_DIR / "media" / "news"
MEDIA_RAW_BASE = "https://raw.githubusercontent.com/yacobwood/BTCC/main/data/media/news"

ARTICLE_RE = re.compile(r'<article class="news-card[^"]*"[^>]*>.*?</article>', re.DOTALL)
TITLE_RE = re.compile(r'<h3><a href="/([a-z0-9-]+)/">([^<]+)</a></h3>')
IMAGE_RE = re.compile(r'<img[^>]*src="(' + MEDIA_SRC_RE_FRAGMENT + r')"')
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


def scrape_card_list(fetcher: RenderedFetcher, url: str = NEWS_URL) -> tuple[list[dict], dict]:
    """Fetch a /news/ listing page (page 1 or /news/page/<n>/) and return card
    metadata for every article found, plus the captured media dict (see
    btcc_playwright.get_with_media) for mirroring.

    scroll_through=True: the listing's card images use loading="lazy" - without
    scrolling, only the hero card (already in the initial viewport) actually
    gets its image requested/captured; every card lower down silently gets
    media_url=None. Since a successfully-captured image is what gets carried
    forward on later runs (not a missing one), any article whose *first* scrape
    happens to land it below the fold - e.g. two other articles already
    published ahead of it that day - is missing an image permanently, with
    nothing to ever retrigger a re-capture. Confirmed live: two Race 1 reports
    both missing images the same day they were first scraped."""
    html, media = fetcher.get_with_media(url, wait_selector="article.news-card", scroll_through=True)
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
            "media_url": resolve_media_url(image_m.group(1)) if image_m else None,
            "excerpt": excerpt_m.group(1).strip() if excerpt_m else "",
            "date": parse_display_date(date_m.group(1)) if date_m else "",
        })
    return cards, media


def scrape_pages(fetcher: RenderedFetcher, num_pages: int) -> tuple[list[dict], dict]:
    """Load /news/ and click its in-page "Next" link up to num_pages-1 times,
    each click appending another ~25-card batch to the same DOM (confirmed:
    a direct page.goto("/news/page/<n>/") does NOT work - it silently
    re-renders page 1's content instead of page n's; only clicking the
    listing's own pagination link actually advances it). Used only for a
    one-off deep backfill - the routine 5-minute run only ever needs page 1.

    In practice this listing's own infinite-scroll component hits an
    unrecoverable client-side bug after 2 successful clicks (confirmed: a
    real "Minified React error #419" hydration mismatch, not anything on
    our end) and every click after that succeeds with no further effect -
    get_with_media_paginated stops early once a click stops growing the
    card count, so num_pages beyond what btcc.net can actually deliver is
    harmless to ask for, just capped at whatever it actually yields (as of
    2026-08 that's ~75 cards / 3 pages worth, not num_pages*25)."""
    html, media = fetcher.get_with_media_paginated(
        NEWS_URL, next_selector='nav.pagination a:has-text("Next")',
        max_clicks=num_pages - 1, wait_selector="article.news-card",
    )
    cards = []
    seen_slugs = set()
    for m in ARTICLE_RE.finditer(html):
        block = m.group(0)
        title_m = TITLE_RE.search(block)
        if not title_m or title_m.group(1) in seen_slugs:
            continue
        seen_slugs.add(title_m.group(1))
        slug, title = title_m.group(1), title_m.group(2)
        image_m = IMAGE_RE.search(block)
        excerpt_m = EXCERPT_RE.search(block)
        date_m = DATE_RE.search(block)
        cards.append({
            "slug": slug,
            "title": title,
            "media_url": resolve_media_url(image_m.group(1)) if image_m else None,
            "excerpt": excerpt_m.group(1).strip() if excerpt_m else "",
            "date": parse_display_date(date_m.group(1)) if date_m else "",
        })
    return cards, media


def fetch_article_body(fetcher: RenderedFetcher, slug: str, retries: int = 2) -> str | None:
    """Fetch a single article page and return its body's inner HTML, or None
    if every attempt failed.

    Retries with a short backoff before giving up rather than raising -
    confirmed 2026-08-14 that an individual article fetch can still
    intermittently hit Vercel's BotID challenge even with a persisted
    session, the correct (bare, not www.) hostname, and referer=NEWS_URL
    set (a real visitor reaches this page by clicking a card link on the
    listing page, not by teleporting to it) - none of those individually
    or combined made it fully reliable. Callers should treat None as "try
    again next run", not something that should crash the whole batch."""
    url = f"https://btcc.net/{slug}/"
    last_error: Exception | None = None
    for attempt in range(retries + 1):
        try:
            html = fetcher.get(url, wait_selector="div.article-body", referer=NEWS_URL)
            m = BODY_RE.search(html)
            return m.group(1).strip() if m else ""
        except Exception as e:  # noqa: BLE001 - genuinely want to retry any failure here
            last_error = e
            if attempt < retries:
                time.sleep(5 * (attempt + 1))
    print(f"  WARNING: giving up on {slug} after {retries + 1} attempt(s): {last_error}", file=sys.stderr)
    return None


def load_existing() -> dict:
    """Read every data/articles/page_<n>.json and return {slug: post} across
    all of them - the full previously-mirrored archive, regardless of how
    many pages it currently spans."""
    existing = {}
    if not ARTICLES_DIR.exists():
        return existing
    for page_file in ARTICLES_DIR.glob("page_*.json"):
        try:
            posts = json.loads(page_file.read_text())
        except (json.JSONDecodeError, OSError):
            continue
        for p in posts:
            if p.get("slug"):
                existing[p["slug"]] = p
    return existing


def needs_full_refetch(prior_content_html: str, refresh_all: bool) -> bool:
    """True when a slug's cached content should be re-fetched even though we
    already have something stored for it: either the caller explicitly asked
    for a full refresh, or the cached content is itself a placeholder btcc.net
    hasn't finished writing yet. "More to follow..." is btcc.net's own literal
    convention for a live race-weekend report published before the session
    result is in - without this check, once a stub like that is scraped it's
    treated as fully cached forever (confirmed: two Snetterton reports sat
    unfinished for 2.5+ months before this existed, since nothing ever told
    the scraper to look again)."""
    if refresh_all:
        return True
    return "more to follow" in prior_content_html.lower()


def sort_posts(posts: list[dict]) -> list[dict]:
    """Sort posts newest-first by firstSeenAt (falling back to date for
    anything mirrored before that field existed), tie-breaking on the
    article's own date when firstSeenAt is identical.

    The tie-break matters more than it looks: `now_iso` in build_articles is
    computed once per scrape run and reused for every slug resolve_first_seen
    stamps as newly-seen that run - so any run that first-discovers more than
    one new article (routine on a busy race weekend, not just a one-off
    backfill) ties them all at the exact same instant. Confirmed live
    2026-08-10: a single bulk firstSeenAt backfill the day before tied ~9
    articles spanning 26 Jul-9 Aug at one identical timestamp, and sorting on
    firstSeenAt alone left them ordered by arbitrary dict-insertion order
    instead of date - "Ingram takes top spot at Thruxton" (26 Jul) outranked
    "Moffat leads Scottish one-two at Knockhill" (8 Aug) in the News tab
    hero slot for hours, self-reinforcing on every re-scrape since a stub
    getting its full content filled in via needs_full_refetch does not
    change its already-stamped firstSeenAt. date alone can't fully replace
    firstSeenAt (same-day articles need it - see resolve_first_seen), but as
    a tie-break it correctly separates anything firstSeenAt can't."""
    return sorted(posts, key=lambda p: (p.get("firstSeenAt") or p["date"], p.get("date") or ""), reverse=True)


def resolve_first_seen(prior: dict | None, now_iso: str, date_iso: str = "") -> str:
    """Returns the timestamp a post should sort by: an already-mirrored
    article keeps whatever it was first stamped with (so re-scraping it on a
    later run never reshuffles its position), a genuinely new one gets this
    run's own current time.

    btcc.net's /news/ listing only exposes a bare display date (no time of
    day) and - confirmed live, 2026-08-09 - doesn't reliably list newest
    first across different content types either: a same-day quotes/features
    piece ("Qualifying in Quotes: Knockhill", published ~10:30) outranked
    two later race-report articles (published ~20:00 and ~22:40) because the
    final sort below can only break same-day ties by whatever order the
    listing page happened to present them in that run. Our own scrape
    cadence (every 5 minutes) tracks true publish order far more precisely
    than the site's own day-only date field ever could, so firstSeenAt - not
    "date" - is what actually lets same-day articles sort correctly relative
    to each other. See project_notification_delay_fix memory.

    Crucially: an already-known slug (prior is not None) that simply
    predates firstSeenAt existing yet falls back to date_iso, NOT now_iso -
    confirmed live 2026-08-10: firstSeenAt shipped the day before this, so
    the very next routine run found ~20 already-mirrored articles (spanning
    real dates from 26 Jul to 8 Aug) all still missing the new field and,
    under the old `prior and prior.get("firstSeenAt")` check, treated every
    one of them as "genuinely new" - stamping all ~20 with that single run's
    one shared now_iso and letting them outrank even the 5 correctly
    ground-truth-backfilled Knockhill articles from hours earlier that same
    day. now_iso must stay reserved for slugs with no prior entry at all."""
    if prior is not None:
        return prior.get("firstSeenAt") or date_iso
    return now_iso


def build_articles(refresh_all: bool, backfill_pages: int = 1) -> list[dict]:
    # Always load the full accumulated archive - refresh_all forces today's
    # listing cards to refetch their content below, but must never wipe out
    # everything older than today's ~25 cards that's already been accumulated.
    existing = load_existing()

    now_iso = datetime.now(timezone.utc).isoformat()

    with RenderedFetcher() as fetcher:
        if backfill_pages > 1:
            cards, media = scrape_pages(fetcher, backfill_pages)
        else:
            cards, media = scrape_card_list(fetcher)
        if not cards:
            return []

        merged = dict(existing)
        for i, card in enumerate(cards):
            if backfill_pages > 1 and i % 25 == 0:
                print(f"  Processing article {i + 1}/{len(cards)}...")
            slug = card["slug"]
            prior = existing.get(slug)
            prior_content = prior.get("content", {}).get("rendered", "") if prior else ""
            has_content = bool(prior_content) and not needs_full_refetch(prior_content, refresh_all)

            if has_content:
                content_html = prior["content"]["rendered"]
                date_iso = prior.get("date") or card["date"]
                category = prior.get("_embedded", {}).get("wp:term", [[{}]])[0][0].get("name", "")
            else:
                print(f"  Fetching full content: {slug}")
                content_html = fetch_article_body(fetcher, slug)
                if content_html is None:
                    # Every attempt failed (see fetch_article_body's retry) -
                    # don't let one flaky article sink every other card in
                    # this batch. Keep serving whatever was cached before
                    # (a stale stub is still better than nothing, and this
                    # slug gets retried fresh next run); if there's nothing
                    # cached at all, skip it entirely this run rather than
                    # writing a broken/empty entry - the card is still in
                    # `cards` so the next run tries it again from scratch.
                    if prior_content:
                        content_html = prior_content
                        date_iso = prior.get("date") or card["date"]
                        category = prior.get("_embedded", {}).get("wp:term", [[{}]])[0][0].get("name", "")
                    else:
                        continue
                else:
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

            merged[slug] = {
                "id": slug,
                "slug": slug,
                "link": f"https://btcc.net/{slug}/",
                "date": date_iso,
                "firstSeenAt": resolve_first_seen(prior, now_iso, date_iso),
                "title": {"rendered": card["title"]},
                "excerpt": {"rendered": card["excerpt"]},
                "content": {"rendered": content_html},
                "_embedded": embedded,
            }

    # firstSeenAt (not date) is the primary sort key - see resolve_first_seen
    # and sort_posts (date tie-break).
    posts = sort_posts(list(merged.values()))
    return posts[:MAX_ARTICLES]


def prune_orphaned_images(posts: list[dict]) -> int:
    """Delete mirrored images that no longer belong to any current post - once
    an article ages out past MAX_ARTICLES its image is now orphaned and would
    otherwise sit in the repo forever. Returns the number removed."""
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


def write_pages(posts: list[dict]) -> int:
    """Partition posts (already sorted newest-first) into page_<n>.json files
    of PAGE_SIZE each, write index.json mapping slug -> page number, and
    remove any stale page files left over from a previously-larger archive.
    Returns the number of page files written."""
    ARTICLES_DIR.mkdir(parents=True, exist_ok=True)

    num_pages = max(1, -(-len(posts) // PAGE_SIZE))  # ceil division
    index = {}
    for page_num in range(1, num_pages + 1):
        chunk = posts[(page_num - 1) * PAGE_SIZE : page_num * PAGE_SIZE]
        with open(ARTICLES_DIR / f"page_{page_num}.json", "w") as f:
            json.dump(chunk, f, indent=2)
        for p in chunk:
            index[p["slug"]] = page_num

    # Remove page files beyond the current count (archive shrank, or a prior
    # run wrote more pages than this one needs).
    for f in ARTICLES_DIR.glob("page_*.json"):
        n = int(f.stem.split("_")[1])
        if n > num_pages:
            f.unlink()

    with open(INDEX_JSON, "w") as f:
        json.dump(index, f, indent=2)

    return num_pages


def write_legacy_flat_file(posts: list[dict]) -> None:
    """Compatibility shim - see LEGACY_ARTICLES_JSON comment above."""
    with open(LEGACY_ARTICLES_JSON, "w") as f:
        json.dump(posts, f, indent=2)


def main():
    ap = argparse.ArgumentParser(description="Mirror BTCC articles into data/articles/page_<n>.json + index.json")
    ap.add_argument("--dry-run", action="store_true", help="Print result only, do not write")
    ap.add_argument("--refresh-all", action="store_true", help="Re-fetch full content for today's listing cards even if already cached (does not affect older accumulated articles)")
    ap.add_argument("--backfill-pages", type=int, default=1, help="Crawl this many /news/ listing pages (~25 articles each) instead of just page 1 - one-off deep backfill, not for routine runs")
    args = ap.parse_args()

    posts = build_articles(args.refresh_all, args.backfill_pages)
    if not posts:
        print("ERROR: scraped zero articles - refusing to overwrite data/articles/", file=sys.stderr)
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

    num_pages = write_pages(posts)
    print(f"Wrote {num_pages} page file(s) + index.json to {ARTICLES_DIR}")

    write_legacy_flat_file(posts)
    print(f"Wrote {LEGACY_ARTICLES_JSON} (compatibility shim for pre-split app builds)")


if __name__ == "__main__":
    main()
