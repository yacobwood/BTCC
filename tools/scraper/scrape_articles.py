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
  - data/articles/pending.json    scraper-internal only, never read by the
                                   app or website - brand-new articles held
                                   back from the two files above while an
                                   image is retried (see PUBLISH_HOLD_WINDOW).
                                   A slug absent from index.json reads as
                                   "not mirrored yet" to everything
                                   downstream (functions/newsCheck.js's
                                   mirroredImageUrl included), so holding a
                                   slug out of index.json is what actually
                                   suppresses both its News tab/website
                                   appearance and its push notification
                                   until the hold releases.
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
from datetime import datetime, timedelta, timezone
from pathlib import Path

from media_utils import MEDIA_SRC_RE_FRAGMENT, resolve_media_url, save_mirrored_image
from scrapfly_fallback import fetch_image_smart, fetch_via_scrapfly

NEWS_URL = "https://btcc.net/news/"
PAGE_SIZE = 20  # must match src/api/client.js's fetchArticles() perPage
MAX_ARTICLES = 500
# How long a mirrored article with no image keeps getting a fresh full-page
# refetch (see build_articles' needs_image_retry) purely to give
# extract_og_image another chance at it - bounded rather than forever, since
# an article that genuinely has no image on btcc.net at all would otherwise
# re-pay a full Scrapfly page fetch every single scheduled run (every 5
# minutes in-hours) with nothing to ever find. Self-terminating once an
# image is found (prior_image then short-circuits it), same shape as
# needs_full_refetch's stub-marker check just below.
IMAGE_RETRY_WINDOW = timedelta(days=3)
# How long a genuinely brand-new article (no prior entry at all) is held
# back from publication - not written to any page_<n>.json/index.json, so it
# appears in neither the News tab/website nor a push notification (see
# functions/newsCheck.js's mirroredImageUrl, which only fires once the slug
# is actually present in index.json) - while its image fetch is retried.
# Bounded, not indefinite, for the same reason IMAGE_RETRY_WINDOW is: an
# article that genuinely has no image at all (e.g. "Darlington UK meets
# Darlington USA") must still publish eventually, just without one, rather
# than sit invisible forever. ~3-4 scrape cycles at the in-hours 5-minute
# cadence (see scrape-news.yml) - long enough to absorb an ordinary
# transient Scrapfly failure (confirmed self-resolving within a run or two
# for other articles the same day this was added), short enough that a live
# race-weekend report is never held back for more than ~20 minutes.
PUBLISH_HOLD_WINDOW = timedelta(minutes=20)
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
# Fallback source of a featured image for an article whose /news/ listing
# card has no <img> matching IMAGE_RE at all (confirmed live 2026-09-04:
# "Darlington UK meets Darlington USA", a Goodyear press-release repost,
# has no image anywhere in its news-card markup and so never got a
# mirrored image - the app's HeroCard/GridRow just render blank when
# imageUrl is falsy). An article's own page nearly always carries a
# normal <meta property="og:image"> tag even when its listing-card
# thumbnail is missing/differently-shaped, so this is checked against the
# full page fetched for fetch_article_body's content extraction - no
# extra Scrapfly request. Two attribute orders since HTML doesn't
# guarantee property= comes before content=.
OG_IMAGE_RE = re.compile(
    r'<meta[^>]+property="og:image"[^>]+content="([^"]+)"'
    r'|<meta[^>]+content="([^"]+)"[^>]+property="og:image"'
)


def extract_og_image(html: str) -> str | None:
    m = OG_IMAGE_RE.search(html)
    if not m:
        return None
    return m.group(1) or m.group(2)


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


def fetch_article_body(slug: str) -> tuple[str | None, str | None]:
    """Fetch a single article page via Scrapfly and return
    (content_html, og_image_url). content_html is None if the fetch failed -
    callers should treat that as "try again next run", not something that
    should crash the whole batch. og_image_url (see OG_IMAGE_RE above) is
    the featured-image fallback for a card whose listing-page thumbnail was
    missing/unmatched; it's None whenever content_html is None too, and may
    also be None if the page genuinely has no og:image tag."""
    url = f"https://btcc.net/{slug}/"
    html = fetch_via_scrapfly(url, referer=NEWS_URL, render_js=True, label=slug)
    if html is None:
        return None, None
    m = BODY_RE.search(html)
    return (m.group(1).strip() if m else ""), extract_og_image(html)


def load_pending() -> dict:
    """Read data/articles/pending.json - {slug: {"firstSeenAt": iso}} for
    brand-new articles currently being held back from publication (see
    PUBLISH_HOLD_WINDOW) while their image fetch is retried. Scraper-internal
    state only - unlike everything else in data/articles/, this is never
    read by the app or website, so it's fine for it to hold nothing more
    than the one timestamp needed to bound the hold."""
    try:
        return json.loads((ARTICLES_DIR / "pending.json").read_text())
    except (OSError, json.JSONDecodeError):
        return {}


def save_pending(pending: dict) -> None:
    ARTICLES_DIR.mkdir(parents=True, exist_ok=True)
    with open(ARTICLES_DIR / "pending.json", "w") as f:
        json.dump(pending, f, indent=2)


def publish_hold_expired(first_seen: str) -> bool:
    """True once PUBLISH_HOLD_WINDOW has elapsed since a held-back article's
    first sighting, at which point it publishes regardless of whether an
    image was ever found - mirrors needs_image_retry's aware/naive
    TypeError guard, though pending.json's timestamps are always aware
    (stamped by this same script, never legacy data) so this is defensive,
    not a known live case. An unparseable timestamp fails open (True, i.e.
    publish now) rather than holding forever on corrupt state.

    One accepted gap: a pending slug is only ever released (published or
    dropped) by build_articles' main loop, which only visits slugs still
    present in this run's freshly-scraped `cards` - if a held-back article
    somehow fell off btcc.net's /news/ listing entirely within the ~20-
    minute hold window (meaning 20+ newer articles published faster than
    this site has ever been observed to), it would sit in pending.json
    unreleased indefinitely rather than ever hitting this check. Not worth
    guarding against given how implausible that is at this site's real
    publish cadence."""
    try:
        return datetime.now(timezone.utc) - datetime.fromisoformat(first_seen) >= PUBLISH_HOLD_WINDOW
    except (ValueError, TypeError):
        return True


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


def needs_image_retry(first_seen: str | None) -> bool:
    """Whether a mirrored, still-image-less article is still within
    IMAGE_RETRY_WINDOW of its first sighting and so should get one more
    full-page fetch for extract_og_image to have a shot at it.

    first_seen is normally an aware ISO string, but some legacy articles'
    firstSeenAt values (via resolve_first_seen's legacy fallback to
    parse_display_date, which produces a naive "YYYY-MM-DDT00:00:00" with no
    UTC offset) are naive - subtracting an aware datetime.now(timezone.utc)
    from a naive datetime raises TypeError, not ValueError, so both must be
    caught here rather than just the one (confirmed: TypeError was NOT
    caught by the old `except ValueError` alone, a dormant landmine for any
    legacy first_seen value)."""
    if not first_seen:
        return False
    try:
        return datetime.now(timezone.utc) - datetime.fromisoformat(first_seen) < IMAGE_RETRY_WINDOW
    except (ValueError, TypeError):
        return False


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


def build_articles(refresh_all: bool, backfill_pages: int = 1) -> tuple[list[dict], dict]:
    # Always load the full accumulated archive - refresh_all forces today's
    # listing cards to refetch their content below, but must never wipe out
    # everything older than today's ~25 cards that's already been accumulated.
    existing = load_existing()
    # Brand-new articles currently being held back from publication pending
    # an image - see PUBLISH_HOLD_WINDOW/load_pending.
    pending = load_pending()

    now_iso = datetime.now(timezone.utc).isoformat()

    if backfill_pages > 1:
        cards = scrape_pages(backfill_pages)
    else:
        cards = scrape_card_list()
    if not cards:
        return [], pending

    merged = dict(existing)
    for i, card in enumerate(cards):
        if backfill_pages > 1 and i % 25 == 0:
            print(f"  Processing article {i + 1}/{len(cards)}...")
        slug = card["slug"]
        prior = existing.get(slug)
        prior_content = prior.get("content", {}).get("rendered", "") if prior else ""
        prior_image = prior.get("_embedded", {}).get("wp:featuredmedia", [{}])[0].get("source_url") if prior else None
        # A held-back article's first-ever detection time (see
        # PUBLISH_HOLD_WINDOW) - None for both a normal already-mirrored
        # article (prior is not None, resolve_first_seen handles it below)
        # and a genuinely first-sighting-ever new one (pending has nothing
        # for it yet either, so it gets now_iso like any other new article).
        pending_first_seen = pending.get(slug, {}).get("firstSeenAt") if prior is None else None

        # A mirrored article with no image at all (neither a prior mirrored
        # one nor anything on the current listing card) gets treated like a
        # content stub - worth one more full-page fetch so extract_og_image
        # gets a shot at it, bounded to IMAGE_RETRY_WINDOW of its first
        # sighting so a genuinely image-less article doesn't re-pay that
        # fetch forever (see IMAGE_RETRY_WINDOW above).
        image_retry_needed = False
        if prior is not None and not prior_image and not card["media_url"]:
            image_retry_needed = needs_image_retry(prior.get("firstSeenAt"))

        has_content = (
            bool(prior_content)
            and not needs_full_refetch(prior_content, refresh_all)
            and not image_retry_needed
        )

        if has_content:
            content_html = prior["content"]["rendered"]
            date_iso = prior.get("date") or card["date"]
            category = prior.get("_embedded", {}).get("wp:term", [[{}]])[0][0].get("name", "")
            og_image = None
        else:
            print(f"  Fetching full content: {slug}")
            content_html, og_image = fetch_article_body(slug)

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

        if prior_image and prior_image.startswith(MEDIA_RAW_BASE):
            image_url = prior_image
        else:
            # On-demand, not eagerly-captured: Scrapfly bills each image
            # independently (~225 credits for btcc.net's own /api/media/
            # shape, confirmed live 2026-09-01) rather than capturing every
            # image on a page for free during render the way Playwright did,
            # so this only ever runs for a card that genuinely lacks an
            # already-mirrored image. card["media_url"] (the listing-card
            # thumbnail) is preferred when present; og_image (the article's
            # own og:image meta tag, only populated when content_html was
            # just freshly fetched above) is the fallback for a card whose
            # listing thumbnail is missing/unmatched entirely.
            source_url = card["media_url"] or (resolve_media_url(og_image) if og_image else None)
            fetched = fetch_image_smart(source_url, label=slug) if source_url else None
            if fetched:
                filename = save_mirrored_image({source_url: fetched}, source_url, MEDIA_DIR)
                image_url = f"{MEDIA_RAW_BASE}/{filename}" if filename else None
            else:
                image_url = None

        if prior is None and not image_url:
            # Genuinely new (never published) and still no image this cycle -
            # hold it back rather than publish text-only immediately, unless
            # PUBLISH_HOLD_WINDOW has already run out. first_seen is the
            # TRUE first-detection time even when this is a repeat cycle of
            # an already-held slug - never now_iso in that case, since
            # releasing it would then misreport how new the article
            # actually is (see sort_posts' own comment on why firstSeenAt
            # accuracy matters for same-day ordering).
            first_seen = pending_first_seen or now_iso
            if not publish_hold_expired(first_seen):
                pending[slug] = {"firstSeenAt": first_seen}
                continue
            # Hold window expired - publish anyway, text-only; falls through.

        # Either published normally or a hold that just expired - either way
        # this slug is no longer pending.
        pending.pop(slug, None)

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
            # resolve_first_seen only ever sees prior, not pending - a slug
            # released from a publish hold must keep the timestamp of its
            # TRUE first sighting (pending_first_seen) - not this run's
            # now_iso, which would misreport how new it actually is.
            "firstSeenAt": resolve_first_seen(prior, now_iso, date_iso) if prior is not None else (pending_first_seen or now_iso),
            "title": {"rendered": card["title"]},
            "excerpt": {"rendered": card["excerpt"]},
            "content": {"rendered": content_html},
            "_embedded": embedded,
        }

    # firstSeenAt (not date) is the primary sort key - see resolve_first_seen
    # and sort_posts (date tie-break).
    posts = sort_posts(list(merged.values()))
    return posts[:MAX_ARTICLES], pending


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

    posts, pending = build_articles(args.refresh_all, args.backfill_pages)

    if pending:
        # Held back this run pending an image - see PUBLISH_HOLD_WINDOW.
        # Not an error: neither the app/website nor a push notification can
        # see these slugs yet (functions/newsCheck.js's mirroredImageUrl only
        # fires once a slug is actually in index.json), which is the point.
        # Saved even if the zero-posts guard below exits right after - a
        # from-scratch/empty-archive bootstrap where every freshly-scraped
        # card is genuinely brand-new could otherwise legitimately hit that
        # guard while still needing this run's holds persisted - skip this
        # and their firstSeenAt timers would silently reset next run for no
        # reason.
        print(f"Holding {len(pending)} new article(s) pending an image (publishes anyway once PUBLISH_HOLD_WINDOW elapses):")
        for slug in pending:
            print(f"  {slug}")
        if not args.dry_run:
            save_pending(pending)

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
