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
JavaScript. Fetches through Scrapfly's paid Scrape API (see
scrapfly_fallback.py) as of 2026-09-01 rather than local headless Chromium -
`asp=true` clears the challenge from any IP (confirmed live), so this now
runs on GitHub-hosted ubuntu-latest instead of needing the self-hosted
runner's residential IP reputation. btcc_playwright.py's RenderedFetcher is
deliberately left completely intact and unused in the repo - dormant, not
deleted, in case Scrapfly ever needs to be swapped back out.

Two btcc.net pages are used:
  - /news/, /page/<n>/   rendered listing pages - slug, title, excerpt,
                       date and featured image for each card (~25 per
                       load). NOTE: the pagination URL is /page/<n>/, NOT
                       /news/page/<n>/ - confirmed live 2026-09-01 via the
                       listing's own <nav class="pagination"> markup, after
                       an earlier version of this scraper spent months
                       thinking direct-URL pagination didn't work at all
                       (it was just testing the wrong URL) and worked
                       around it with a click-based approach that hit a
                       real site bug after 2 clicks. Confirmed real content
                       all the way to page 201 (~November 2013).
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
report. Images are mirrored into data/media/news/ during the scrape and
served from GitHub raw instead - only for articles without an
already-mirrored image, fetched on demand via scrapfly_fallback.
fetch_image_smart (Scrapfly for btcc.net's own /api/media/ shape, ~225
credits, confirmed live 2026-09-01 - a plain free request for a
Supabase-hosted image, which isn't behind the Vercel challenge at all).

Usage:
    python scrape_articles.py [--dry-run] [--refresh-all] [--backfill-pages N]
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

from media_utils import MEDIA_SRC_RE_FRAGMENT, resolve_media_url, save_mirrored_image
from scrapfly_fallback import fetch_image_smart, fetch_via_scrapfly

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
# [\s\S]*? + tag-strip, not [^<]+: see the matching comment in scrape_news.py
# (2026-08-18/19, 7 intermittent failures across ~9.5 hours) - tolerates a
# title briefly wrapped in an inline tag (e.g. a "breaking" badge span)
# instead of silently dropping the whole card.
TITLE_RE = re.compile(r'<h3><a href="/([a-z0-9-]+)/">([\s\S]*?)</a></h3>')
TAG_RE = re.compile(r"<[^>]+>")
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


def _parse_cards(html: str) -> list[dict]:
    """Shared parsing core for scrape_card_list/scrape_pages - extracts card
    metadata (slug/title/media_url/excerpt/date) from a listing page's raw
    HTML, deduped by slug within this one page's cards."""
    cards = []
    seen_slugs = set()
    for m in ARTICLE_RE.finditer(html):
        block = m.group(0)
        title_m = TITLE_RE.search(block)
        if not title_m or title_m.group(1) in seen_slugs:
            continue
        seen_slugs.add(title_m.group(1))
        slug, title = title_m.group(1), TAG_RE.sub("", title_m.group(2)).strip()
        if not title:
            continue
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
    return cards


def scrape_card_list(url: str = NEWS_URL) -> list[dict]:
    """Fetch btcc.net/news/ (page 1) via Scrapfly and return card metadata
    for every article found. Unlike the pre-Scrapfly version, this does NOT
    also capture image bytes - that's now a separate, on-demand fetch (see
    build_articles' prior_image check) only for cards that actually need a
    fresh image, since Scrapfly bills each image independently (~225
    credits, confirmed live 2026-09-01) rather than capturing every image on
    a page for free as a side effect of rendering it once, the way
    Playwright did."""
    html = fetch_via_scrapfly(url, render_js=True, label="news-listing")
    if html is None:
        return []
    return _parse_cards(html)


def scrape_pages(num_pages: int) -> list[dict]:
    """Fetch num_pages of btcc.net's /news/ listing (page 1, then
    https://btcc.net/page/2/, /page/3/, ... - NOT /news/page/<n>/, which
    404s) and return deduped card metadata across all of them, for a one-off
    deep backfill.

    The real pagination URL was only discovered live 2026-09-01, while
    investigating a completely different question (Scrapfly cost planning):
    the previous version of this function assumed page.goto("/news/page/
    <n>/") silently re-rendered page 1 (based on a real observation) and
    worked around it with in-page "Next"-link clicking instead, which then
    hit a genuine site bug after 2 clicks (a "Minified React error #419"
    hydration mismatch) and could never reach past ~75 cards / 3 pages.
    Confirmed live via the listing's own <nav class="pagination"> markup
    that its real links are /page/<n>/, not /news/page/<n>/ - the old
    function was quietly testing the wrong URL the whole time. Direct
    fetches of the correct URL work cleanly with no click-based workaround
    needed at all, and were confirmed to return genuinely distinct,
    chronologically-ordered content all the way to page 201 (~November
    2013) - the full backfill depth was never actually blocked by btcc.net,
    only by this bug."""
    all_cards: list[dict] = []
    seen_slugs = set()
    for page in range(1, num_pages + 1):
        url = NEWS_URL if page == 1 else f"https://btcc.net/page/{page}/"
        html = fetch_via_scrapfly(url, render_js=True, label=f"news-listing-page-{page}")
        if html is None:
            print(f"  WARNING: could not fetch page {page} - stopping backfill here", file=sys.stderr)
            break
        page_cards = _parse_cards(html)
        if not page_cards:
            print(f"  page {page} had no cards - stopping backfill here")
            break
        new_count = 0
        for card in page_cards:
            if card["slug"] in seen_slugs:
                continue
            seen_slugs.add(card["slug"])
            all_cards.append(card)
            new_count += 1
        if new_count == 0:
            # Every card on this page was already seen - btcc.net has fewer
            # real pages of distinct content than num_pages asked for.
            print(f"  page {page} had no new cards - stopping backfill here")
            break
    return all_cards


def fetch_article_body(slug: str) -> str | None:
    """Fetch a single article page via Scrapfly and return its body's inner
    HTML, or None if the fetch failed. Callers should treat None as "try
    again next run", not something that should crash the whole batch."""
    url = f"https://btcc.net/{slug}/"
    html = fetch_via_scrapfly(url, referer=NEWS_URL, render_js=True, label=slug)
    if html is None:
        return None
    m = BODY_RE.search(html)
    return m.group(1).strip() if m else ""


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

    if backfill_pages > 1:
        cards = scrape_pages(backfill_pages)
    else:
        cards = scrape_card_list()
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
            content_html = fetch_article_body(slug)

            if content_html is None:
                # Fetch failed - don't let it sink every other card in this
                # batch. Keep serving whatever was cached before (a stale
                # stub is still better than nothing, and this slug gets
                # retried fresh next run); if there's nothing cached at all,
                # skip it entirely this run rather than writing a broken/
                # empty entry - the card is still in `cards` so the next run
                # tries it again from scratch.
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
        elif card["media_url"]:
            # On-demand, not eagerly-captured: Scrapfly bills each image
            # independently (~225 credits for btcc.net's own /api/media/
            # shape, confirmed live 2026-09-01) rather than capturing every
            # image on a page for free during render the way Playwright did,
            # so this only ever runs for a card that genuinely lacks an
            # already-mirrored image.
            fetched = fetch_image_smart(card["media_url"], label=slug)
            if fetched:
                filename = save_mirrored_image({card["media_url"]: fetched}, card["media_url"], MEDIA_DIR)
                image_url = f"{MEDIA_RAW_BASE}/{filename}" if filename else None
            else:
                image_url = None
        else:
            image_url = None

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
