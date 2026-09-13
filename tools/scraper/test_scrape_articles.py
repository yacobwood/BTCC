#!/usr/bin/env python3
"""Tests for scrape_articles.py's display-date parsing."""

import json
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch

import scrape_articles
from scrape_articles import (
    MEDIA_RAW_BASE,
    NEWS_URL,
    build_articles,
    extract_og_image,
    fetch_article_body,
    mirror_gallery_images,
    needs_full_refetch,
    needs_gallery_mirror,
    needs_image_retry,
    parse_display_date,
    prune_orphaned_images,
    publish_hold_expired,
    resolve_first_seen,
    scrape_card_list,
    scrape_pages,
    sort_posts,
)


class TestParseDisplayDate(unittest.TestCase):
    def test_ordinal_th(self):
        self.assertEqual(parse_display_date("30th July 2026"), "2026-07-30T00:00:00")

    def test_ordinal_st(self):
        self.assertEqual(parse_display_date("1st January 2026"), "2026-01-01T00:00:00")

    def test_ordinal_nd(self):
        self.assertEqual(parse_display_date("2nd March 2026"), "2026-03-02T00:00:00")

    def test_ordinal_rd(self):
        self.assertEqual(parse_display_date("23rd August 2026"), "2026-08-23T00:00:00")

    def test_unparseable_returns_empty_string(self):
        self.assertEqual(parse_display_date("Coming soon"), "")

    def test_unknown_month_returns_empty_string(self):
        self.assertEqual(parse_display_date("30th Julyary 2026"), "")


# ── needs_full_refetch ───────────────────────────────────────────────────────
#
# Regression coverage: articles btcc.net publishes with a "More to follow..."
# stub before the session result is in were being cached permanently on first
# scrape - two Snetterton reports sat unfinished for 2.5+ months before this
# check existed, since a slug with any content at all was treated as "done".

class TestNeedsFullRefetch(unittest.TestCase):

    def test_stub_content_always_needs_refetch(self):
        stub = "<p>Aiden Moffat led home Audi stablemate Dexter Patterson.</p><p>More to follow...</p>"
        self.assertTrue(needs_full_refetch(stub, refresh_all=False))

    def test_stub_detection_is_case_insensitive(self):
        stub = "<p>MORE TO FOLLOW</p>"
        self.assertTrue(needs_full_refetch(stub, refresh_all=False))

    def test_finished_content_does_not_need_refetch(self):
        finished = "<p>Aiden Moffat led home Audi stablemate Dexter Patterson to a Scottish one-two.</p>"
        self.assertFalse(needs_full_refetch(finished, refresh_all=False))

    def test_refresh_all_forces_refetch_even_for_finished_content(self):
        finished = "<p>A complete, fully-written article.</p>"
        self.assertTrue(needs_full_refetch(finished, refresh_all=True))

    def test_empty_content_does_not_need_refetch_via_this_check(self):
        # build_articles() itself handles the "no content at all yet" case via
        # `bool(prior_content)` - this function only governs the "we have
        # something, is it good enough" decision.
        self.assertFalse(needs_full_refetch("", refresh_all=False))


# ── resolve_first_seen ───────────────────────────────────────────────────────
#
# Regression coverage: btcc.net's /news/ listing only exposes a bare display
# date (no time) and doesn't reliably list newest-first across different
# content types - confirmed live, 2026-08-09: a same-day quotes/features
# piece outranked two later race-report articles because the final sort
# could only break same-day ties by whatever order that run's listing
# happened to present them in. firstSeenAt (this run's own clock, stamped
# once and never moved) is what actually fixes same-day ordering.

class TestNeedsImageRetry(unittest.TestCase):
    """needs_image_retry(first_seen) - broadened from `except ValueError` to
    `except (ValueError, TypeError)`: some legacy articles' firstSeenAt
    values (via resolve_first_seen's legacy fallback to parse_display_date)
    are naive "YYYY-MM-DDT00:00:00" strings with no UTC offset, and
    subtracting an aware datetime.now(timezone.utc) from a naive datetime
    raises TypeError, not ValueError - a dormant landmine the old except
    clause did not catch."""

    def test_naive_legacy_format_does_not_raise_and_falls_back_to_false(self):
        # A naive datetime (no UTC offset) can't be safely compared against
        # the aware datetime.now(timezone.utc) at all - subtracting them
        # raises TypeError, which is the actual regression this test
        # guards: it must be caught (not propagate) and fall back to the
        # same safe "no retry" default a ValueError already produced,
        # regardless of how recent the naive timestamp actually is.
        naive_recent = (datetime.now() - timedelta(hours=1)).strftime("%Y-%m-%dT%H:%M:%S")
        self.assertFalse(needs_image_retry(naive_recent))

    def test_naive_legacy_format_outside_window_does_not_raise(self):
        naive_old = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%dT%H:%M:%S")
        self.assertFalse(needs_image_retry(naive_old))

    def test_aware_recent_timestamp_is_true(self):
        recent = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
        self.assertTrue(needs_image_retry(recent))

    def test_aware_old_timestamp_is_false(self):
        old = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
        self.assertFalse(needs_image_retry(old))

    def test_none_is_false(self):
        self.assertFalse(needs_image_retry(None))

    def test_empty_string_is_false(self):
        self.assertFalse(needs_image_retry(""))

    def test_genuinely_unparseable_string_is_false(self):
        self.assertFalse(needs_image_retry("not-a-date"))


class TestResolveFirstSeen(unittest.TestCase):

    def test_new_article_gets_this_runs_current_time(self):
        self.assertEqual(resolve_first_seen(None, "2026-08-09T22:39:03+00:00"), "2026-08-09T22:39:03+00:00")

    def test_already_mirrored_article_keeps_its_original_stamp(self):
        prior = {"firstSeenAt": "2026-08-09T09:30:02+00:00"}
        self.assertEqual(resolve_first_seen(prior, "2026-08-09T22:39:03+00:00"), "2026-08-09T09:30:02+00:00")

    def test_prior_without_firstseenat_falls_back_to_date_not_now(self):
        # Regression coverage: confirmed live 2026-08-10 - firstSeenAt shipped
        # the day before this, so the very next routine run found ~20
        # already-mirrored articles (real dates spanning 26 Jul-8 Aug) still
        # missing the new field. The old code treated "already known but not
        # yet stamped" the same as "genuinely new" and gave all ~20 that
        # run's one shared now_iso, letting them outrank even hours-old
        # ground-truth-backfilled same-day articles. An already-known slug
        # (prior is not None) must fall back to its own date, never now_iso -
        # only a slug with no prior entry at all is genuinely new.
        prior = {"date": "2026-08-08T00:00:00"}
        self.assertEqual(
            resolve_first_seen(prior, "2026-08-09T22:39:03+00:00", "2026-08-08T00:00:00"),
            "2026-08-08T00:00:00",
        )

    def test_prior_without_firstseenat_or_date_falls_back_to_passed_date_iso(self):
        # date_iso is build_articles' already-resolved date for this slug
        # (prior's stored date, or the freshly-scraped card's date if prior
        # somehow has neither) - resolve_first_seen doesn't need its own
        # fallback chain for it, just needs to prefer it over now_iso.
        prior = {}
        self.assertEqual(
            resolve_first_seen(prior, "2026-08-09T22:39:03+00:00", "2026-08-05T00:00:00"),
            "2026-08-05T00:00:00",
        )


# ── sort_posts ───────────────────────────────────────────────────────────────
#
# Regression coverage: confirmed live 2026-08-10 - a single bulk firstSeenAt
# backfill tied ~9 articles spanning 26 Jul-9 Aug at one identical timestamp
# (resolve_first_seen preserves a slug's original stamp forever, and
# build_articles computes `now_iso` once per run and reuses it for every
# newly-discovered slug that run, so any run that first-discovers more than
# one new article ties them the same way - not just a one-off backfill
# artifact). Sorting on firstSeenAt alone left the tied group ordered by
# arbitrary dict-insertion order instead of date: a 26 Jul article outranked
# an 8 Aug one in the News tab hero slot for hours, and kept doing so on
# every re-scrape since a stub getting its full content filled in via
# needs_full_refetch does not change its already-stamped firstSeenAt.

class TestSortPosts(unittest.TestCase):

    def test_sorts_by_first_seen_when_distinct(self):
        older = {"slug": "a", "date": "2026-08-01T00:00:00", "firstSeenAt": "2026-08-01T10:00:00+00:00"}
        newer = {"slug": "b", "date": "2026-08-02T00:00:00", "firstSeenAt": "2026-08-02T10:00:00+00:00"}
        self.assertEqual([p["slug"] for p in sort_posts([older, newer])], ["b", "a"])

    def test_breaks_tied_first_seen_by_date(self):
        # Reproduces the live 2026-08-10 bug: three articles tied at the exact
        # same firstSeenAt (a shared bulk-backfill/single-run-discovery
        # instant) must still land in true calendar-date order, not whatever
        # order they happened to be inserted in.
        tied = "2026-08-09T23:47:15+00:00"
        thruxton = {"slug": "ingram-thruxton", "date": "2026-07-26T00:00:00", "firstSeenAt": tied}
        knockhill_moffat = {"slug": "moffat-knockhill", "date": "2026-08-08T00:00:00", "firstSeenAt": tied}
        knockhill_chilton = {"slug": "chilton-knockhill", "date": "2026-08-09T00:00:00", "firstSeenAt": tied}
        result = sort_posts([thruxton, knockhill_moffat, knockhill_chilton])
        self.assertEqual(
            [p["slug"] for p in result],
            ["chilton-knockhill", "moffat-knockhill", "ingram-thruxton"],
        )

    def test_distinct_first_seen_wins_over_date_even_if_older_by_date(self):
        # firstSeenAt stays the primary key - a same-day quotes piece
        # first-seen earlier in the day must still rank below a later
        # same-day race report that was first-seen after it, which is the
        # whole reason firstSeenAt exists over date (see resolve_first_seen).
        # Here the two aren't same-day, to isolate that firstSeenAt still
        # wins over date's own ordering, not just over an exact date tie.
        seen_first_but_dated_later = {
            "slug": "dated-later", "date": "2026-08-10T00:00:00", "firstSeenAt": "2026-08-09T09:00:00+00:00",
        }
        seen_second_but_dated_earlier = {
            "slug": "dated-earlier", "date": "2026-08-01T00:00:00", "firstSeenAt": "2026-08-09T22:00:00+00:00",
        }
        result = sort_posts([seen_first_but_dated_later, seen_second_but_dated_earlier])
        self.assertEqual([p["slug"] for p in result], ["dated-earlier", "dated-later"])

    def test_falls_back_to_date_when_first_seen_missing(self):
        # Anything mirrored before firstSeenAt existed - resolve_first_seen's
        # own fallback, exercised here through the full sort.
        no_stamp = {"slug": "legacy", "date": "2026-08-05T00:00:00"}
        stamped = {"slug": "current", "date": "2026-08-01T00:00:00", "firstSeenAt": "2026-08-09T00:00:00+00:00"}
        result = sort_posts([no_stamp, stamped])
        self.assertEqual([p["slug"] for p in result], ["current", "legacy"])


# ── scrape_card_list / scrape_pages ──────────────────────────────────────────

class TestScrapeCardList(unittest.TestCase):

    @patch("scrape_articles.fetch_via_scrapfly", return_value=None)
    def test_returns_empty_list_when_fetch_fails(self, mock_fetch):
        self.assertEqual(scrape_card_list(), [])

    @patch("scrape_articles.fetch_via_scrapfly")
    def test_strips_a_nested_tag_wrapped_around_the_title(self, mock_fetch):
        # 2026-08-18/19 overnight incident: see the matching comment on
        # TITLE_RE - a title briefly wrapped in an inline tag (e.g. a
        # "breaking" badge span) used to make the whole card silently
        # unparseable instead of just losing the badge markup.
        mock_fetch.return_value = (
            '<article class="news-card">'
            '<h3><a href="/a-statement/"><span class="badge">Breaking</span> A Statement</a></h3>'
            '</article>'
        )
        cards = scrape_card_list()
        self.assertEqual(len(cards), 1)
        self.assertEqual(cards[0]['title'], 'Breaking A Statement')

    @patch("scrape_articles.fetch_via_scrapfly")
    def test_skips_a_card_whose_title_is_tags_only(self, mock_fetch):
        mock_fetch.return_value = (
            '<article class="news-card">'
            '<h3><a href="/a-statement/"><span></span></a></h3>'
            '</article>'
        )
        self.assertEqual(scrape_card_list(), [])


class TestScrapePages(unittest.TestCase):
    """Regression coverage for the 2026-09-01 fix: the real pagination URL
    is /page/<n>/, not /news/page/<n>/ (which 404s) - confirmed live via the
    listing's own <nav class="pagination"> markup. These confirm the correct
    URLs are requested and that a stop condition (fetch failure, empty page,
    or no new slugs) ends the backfill early rather than looping forever."""

    def _card_html(self, slug):
        return f'<article class="news-card"><h3><a href="/{slug}/">{slug}</a></h3></article>'

    @patch("scrape_articles.fetch_via_scrapfly")
    def test_requests_the_correct_page_urls(self, mock_fetch):
        mock_fetch.side_effect = [self._card_html(f"article-{p}") for p in range(1, 4)]
        scrape_pages(3)
        requested_urls = [c.args[0] for c in mock_fetch.call_args_list]
        self.assertEqual(requested_urls, [NEWS_URL, "https://btcc.net/page/2/", "https://btcc.net/page/3/"])

    @patch("scrape_articles.fetch_via_scrapfly")
    def test_dedupes_slugs_across_pages(self, mock_fetch):
        mock_fetch.side_effect = [self._card_html("dup"), self._card_html("dup")]
        cards = scrape_pages(2)
        self.assertEqual(len(cards), 1)

    @patch("scrape_articles.fetch_via_scrapfly")
    def test_stops_early_when_a_page_fetch_fails(self, mock_fetch):
        mock_fetch.side_effect = [self._card_html("article-1"), None, self._card_html("article-3")]
        cards = scrape_pages(3)
        self.assertEqual([c["slug"] for c in cards], ["article-1"])
        self.assertEqual(mock_fetch.call_count, 2)  # never attempted page 3

    @patch("scrape_articles.fetch_via_scrapfly")
    def test_stops_early_when_a_page_has_no_new_cards(self, mock_fetch):
        # btcc.net has fewer real distinct pages than num_pages asked for -
        # every card on page 2 is identical to page 1's.
        mock_fetch.side_effect = [self._card_html("article-1"), self._card_html("article-1")]
        cards = scrape_pages(5)
        self.assertEqual(len(cards), 1)
        self.assertEqual(mock_fetch.call_count, 2)


# ── fetch_article_body / build_articles ──────────────────────────────────────

class TestExtractOgImage(unittest.TestCase):

    def test_finds_property_before_content(self):
        html = '<meta property="og:image" content="https://btcc.net/api/media/abc123">'
        self.assertEqual(extract_og_image(html), "https://btcc.net/api/media/abc123")

    def test_finds_content_before_property(self):
        html = '<meta content="https://btcc.net/api/media/abc123" property="og:image">'
        self.assertEqual(extract_og_image(html), "https://btcc.net/api/media/abc123")

    def test_none_when_no_og_image_tag(self):
        self.assertIsNone(extract_og_image('<meta property="og:title" content="A title">'))


class TestFetchArticleBody(unittest.TestCase):

    @patch("scrape_articles.fetch_via_scrapfly", return_value=None)
    def test_returns_none_rather_than_raising_when_fetch_fails(self, mock_fetch):
        self.assertEqual(fetch_article_body("some-slug"), (None, None))

    @patch("scrape_articles.fetch_via_scrapfly")
    def test_passes_referer_and_extracts_body_and_og_image(self, mock_fetch):
        mock_fetch.return_value = (
            '<meta property="og:image" content="https://btcc.net/api/media/abc123">'
            '<div class="article-body">Full content.</div></article>'
        )
        content_html, og_image = fetch_article_body("some-slug")
        self.assertEqual(mock_fetch.call_args.kwargs.get("referer"), NEWS_URL)
        self.assertEqual(content_html, "Full content.")
        self.assertEqual(og_image, "https://btcc.net/api/media/abc123")


class TestBuildArticlesImageFetch(unittest.TestCase):
    """The cost-critical property, same shape as scrape_news.py's own
    coverage: an article that already has a mirrored image must never
    re-pay the ~225-credit image fetch, since build_articles runs on
    every 5-minute tick and re-processes every already-mirrored article
    each time."""

    NEWS_CARD_HTML = (
        '<article class="news-card">'
        '<img src="/api/media/abc123">'
        '<h3><a href="/race-1-report/">Race 1 Report</a></h3>'
        '<time class="date">1st August 2026</time>'
        '</article>'
    )

    def test_skips_image_fetch_when_already_mirrored(self):
        with tempfile.TemporaryDirectory() as tmp:
            articles_dir = Path(tmp) / "articles"
            articles_dir.mkdir()
            existing_post = {
                "id": "race-1-report", "slug": "race-1-report", "date": "2026-08-01T00:00:00",
                "firstSeenAt": "2026-08-01T00:00:00", "title": {"rendered": "Race 1 Report"},
                "excerpt": {"rendered": ""}, "content": {"rendered": "Full report."},
                "_embedded": {"wp:featuredmedia": [{
                    "source_url": "https://raw.githubusercontent.com/yacobwood/BTCC/main/data/media/news/abc123.jpg",
                }]},
            }
            (articles_dir / "page_1.json").write_text(json.dumps([existing_post]))
            with patch.object(scrape_articles, "ARTICLES_DIR", articles_dir), \
                 patch.object(scrape_articles, "MEDIA_DIR", Path(tmp) / "media"), \
                 patch("scrape_articles.scrape_card_list", return_value=[{
                     "slug": "race-1-report", "title": "Race 1 Report",
                     "media_url": "https://btcc.net/api/media/abc123",
                     "excerpt": "", "date": "2026-08-01T00:00:00",
                 }]), \
                 patch("scrape_articles.fetch_image_smart") as mock_image:
                posts, pending = build_articles(refresh_all=False)
        mock_image.assert_not_called()
        self.assertEqual(
            posts[0]["_embedded"]["wp:featuredmedia"][0]["source_url"],
            "https://raw.githubusercontent.com/yacobwood/BTCC/main/data/media/news/abc123.jpg",
        )

    def test_fetches_image_for_a_genuinely_new_article(self):
        with tempfile.TemporaryDirectory() as tmp:
            with patch.object(scrape_articles, "ARTICLES_DIR", Path(tmp) / "articles"), \
                 patch.object(scrape_articles, "MEDIA_DIR", Path(tmp) / "media"), \
                 patch("scrape_articles.scrape_card_list", return_value=[{
                     "slug": "race-1-report", "title": "Race 1 Report",
                     "media_url": "https://btcc.net/api/media/abc123",
                     "excerpt": "", "date": "2026-08-01T00:00:00",
                 }]), \
                 patch("scrape_articles.fetch_article_body", return_value=("Full report.", None)), \
                 patch("scrape_articles.fetch_image_smart", return_value=(b"bytes", "image/jpeg")) as mock_image, \
                 patch("scrape_articles.save_mirrored_image", return_value="abc123.jpg"):
                posts, pending = build_articles(refresh_all=False)
        mock_image.assert_called_once()
        self.assertEqual(
            posts[0]["_embedded"]["wp:featuredmedia"][0]["source_url"],
            "https://raw.githubusercontent.com/yacobwood/BTCC/main/data/media/news/abc123.jpg",
        )

    def test_falls_back_to_og_image_when_listing_card_has_no_thumbnail(self):
        """Confirmed live 2026-09-04: "Darlington UK meets Darlington USA"
        (a Goodyear press-release repost) had no <img> anywhere in its
        /news/ listing card, so card["media_url"] was None and it never
        got a mirrored image at all - despite its own article page
        carrying a normal og:image. This is the fix's actual reason to
        exist, not just the tuple-return plumbing above."""
        with tempfile.TemporaryDirectory() as tmp:
            with patch.object(scrape_articles, "ARTICLES_DIR", Path(tmp) / "articles"), \
                 patch.object(scrape_articles, "MEDIA_DIR", Path(tmp) / "media"), \
                 patch("scrape_articles.scrape_card_list", return_value=[{
                     "slug": "darlington-uk-meets-darlington-usa", "title": "Darlington UK meets Darlington USA",
                     "media_url": None,
                     "excerpt": "", "date": "2026-09-04T00:00:00",
                 }]), \
                 patch("scrape_articles.fetch_article_body",
                       return_value=("Full report.", "https://btcc.net/api/media/def456")), \
                 patch("scrape_articles.fetch_image_smart", return_value=(b"bytes", "image/jpeg")) as mock_image, \
                 patch("scrape_articles.save_mirrored_image", return_value="def456.jpg"):
                posts, pending = build_articles(refresh_all=False)
        mock_image.assert_called_once_with("https://btcc.net/api/media/def456", label="darlington-uk-meets-darlington-usa")
        self.assertEqual(
            posts[0]["_embedded"]["wp:featuredmedia"][0]["source_url"],
            "https://raw.githubusercontent.com/yacobwood/BTCC/main/data/media/news/def456.jpg",
        )

    def test_no_image_anywhere_on_an_already_mirrored_article_leaves_embedded_empty(self):
        """Distinct from a genuinely brand-new article (see TestPublishHold
        below) - this one already has a prior entry, so PUBLISH_HOLD_WINDOW
        (which only ever applies to slugs with no prior entry at all) never
        applies; needs_image_retry's own IMAGE_RETRY_WINDOW governs it
        instead, publishing text-only immediately either way."""
        with tempfile.TemporaryDirectory() as tmp:
            articles_dir = Path(tmp) / "articles"
            articles_dir.mkdir()
            existing_post = {
                "id": "wire-story", "slug": "wire-story", "date": "2026-09-04T00:00:00",
                "firstSeenAt": (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat(),
                "title": {"rendered": "Wire Story"}, "excerpt": {"rendered": ""},
                "content": {"rendered": "Full report."}, "_embedded": {},
            }
            (articles_dir / "page_1.json").write_text(json.dumps([existing_post]))
            with patch.object(scrape_articles, "ARTICLES_DIR", articles_dir), \
                 patch.object(scrape_articles, "MEDIA_DIR", Path(tmp) / "media"), \
                 patch("scrape_articles.scrape_card_list", return_value=[{
                     "slug": "wire-story", "title": "Wire Story",
                     "media_url": None,
                     "excerpt": "", "date": "2026-09-04T00:00:00",
                 }]), \
                 patch("scrape_articles.fetch_article_body", return_value=("Full report.", None)), \
                 patch("scrape_articles.fetch_image_smart") as mock_image:
                posts, pending = build_articles(refresh_all=False)
        mock_image.assert_not_called()
        self.assertNotIn("wp:featuredmedia", posts[0]["_embedded"])

    def test_retries_a_recent_mirrored_article_still_missing_an_image(self):
        """The self-terminating retry: a mirrored article whose card and prior
        entry both still lack an image gets a fresh fetch_article_body call
        (a second chance at og_image) as long as it's within
        IMAGE_RETRY_WINDOW of its firstSeenAt - mirrors needs_full_refetch's
        stub-marker check just above it."""
        with tempfile.TemporaryDirectory() as tmp:
            articles_dir = Path(tmp) / "articles"
            articles_dir.mkdir()
            recent = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
            existing_post = {
                "id": "darlington-uk-meets-darlington-usa", "slug": "darlington-uk-meets-darlington-usa",
                "date": "2026-09-04T00:00:00", "firstSeenAt": recent,
                "title": {"rendered": "Darlington UK meets Darlington USA"},
                "excerpt": {"rendered": ""}, "content": {"rendered": "Full report."},
                "_embedded": {},
            }
            (articles_dir / "page_1.json").write_text(json.dumps([existing_post]))
            with patch.object(scrape_articles, "ARTICLES_DIR", articles_dir), \
                 patch.object(scrape_articles, "MEDIA_DIR", Path(tmp) / "media"), \
                 patch("scrape_articles.scrape_card_list", return_value=[{
                     "slug": "darlington-uk-meets-darlington-usa", "title": "Darlington UK meets Darlington USA",
                     "media_url": None,
                     "excerpt": "", "date": "2026-09-04T00:00:00",
                 }]), \
                 patch("scrape_articles.fetch_article_body",
                       return_value=("Full report.", "https://btcc.net/api/media/def456")) as mock_body, \
                 patch("scrape_articles.fetch_image_smart", return_value=(b"bytes", "image/jpeg")), \
                 patch("scrape_articles.save_mirrored_image", return_value="def456.jpg"):
                posts, pending = build_articles(refresh_all=False)
        mock_body.assert_called_once()
        self.assertEqual(
            posts[0]["_embedded"]["wp:featuredmedia"][0]["source_url"],
            "https://raw.githubusercontent.com/yacobwood/BTCC/main/data/media/news/def456.jpg",
        )

    def test_stops_retrying_an_old_image_less_article(self):
        """Past IMAGE_RETRY_WINDOW, an image-less mirrored article stops
        paying for a fresh full-page fetch every run - the cost-control half
        of the fix, same reasoning as IMAGE_RETRY_WINDOW's own comment."""
        with tempfile.TemporaryDirectory() as tmp:
            articles_dir = Path(tmp) / "articles"
            articles_dir.mkdir()
            old = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
            existing_post = {
                "id": "old-wire-story", "slug": "old-wire-story",
                "date": "2026-08-05T00:00:00", "firstSeenAt": old,
                "title": {"rendered": "Old Wire Story"},
                "excerpt": {"rendered": ""}, "content": {"rendered": "Full report."},
                "_embedded": {},
            }
            (articles_dir / "page_1.json").write_text(json.dumps([existing_post]))
            with patch.object(scrape_articles, "ARTICLES_DIR", articles_dir), \
                 patch.object(scrape_articles, "MEDIA_DIR", Path(tmp) / "media"), \
                 patch("scrape_articles.scrape_card_list", return_value=[{
                     "slug": "old-wire-story", "title": "Old Wire Story",
                     "media_url": None,
                     "excerpt": "", "date": "2026-08-05T00:00:00",
                 }]), \
                 patch("scrape_articles.fetch_article_body") as mock_body:
                posts, pending = build_articles(refresh_all=False)
        mock_body.assert_not_called()
        self.assertNotIn("wp:featuredmedia", posts[0]["_embedded"])


# ── publish_hold_expired ─────────────────────────────────────────────────────

class TestPublishHoldExpired(unittest.TestCase):

    def test_recent_timestamp_is_not_expired(self):
        recent = (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat()
        self.assertFalse(publish_hold_expired(recent))

    def test_timestamp_past_the_window_is_expired(self):
        old = (datetime.now(timezone.utc) - timedelta(minutes=25)).isoformat()
        self.assertTrue(publish_hold_expired(old))

    def test_unparseable_timestamp_fails_open_as_expired(self):
        # Corrupt pending.json state must never hold a slug back forever.
        self.assertTrue(publish_hold_expired("not-a-date"))


# ── build_articles: publish-hold for a brand-new, still image-less article ──
#
# Requested 2026-09-06 after "Qualifying in Quotes: Croft" published (and
# notified) with no image while its own image fetch kept hitting Scrapfly
# 422s - the app/website and push notification should not go out ahead of
# the image for a genuinely brand-new article, but must still publish
# eventually rather than hold a truly image-less one forever (see
# PUBLISH_HOLD_WINDOW). This is a distinct, new-article-only behaviour from
# needs_image_retry/IMAGE_RETRY_WINDOW above, which only ever applies once a
# slug already has a prior published entry.

class TestPublishHold(unittest.TestCase):

    def _card(self, slug="new-article", media_url=None, date="2026-09-06T00:00:00"):
        return {"slug": slug, "title": "New Article", "media_url": media_url, "excerpt": "", "date": date}

    def test_brand_new_article_with_no_image_is_held_back_not_published(self):
        with tempfile.TemporaryDirectory() as tmp:
            with patch.object(scrape_articles, "ARTICLES_DIR", Path(tmp) / "articles"), \
                 patch.object(scrape_articles, "MEDIA_DIR", Path(tmp) / "media"), \
                 patch("scrape_articles.scrape_card_list", return_value=[self._card()]), \
                 patch("scrape_articles.fetch_article_body", return_value=("Full report.", None)), \
                 patch("scrape_articles.fetch_image_smart") as mock_image:
                posts, pending = build_articles(refresh_all=False)
        mock_image.assert_not_called()
        self.assertEqual(posts, [])
        self.assertIn("new-article", pending)
        self.assertIn("firstSeenAt", pending["new-article"])

    def test_held_article_keeps_retrying_content_every_cycle_while_pending(self):
        # Unlike an already-published stub (has_content can cache the prior
        # content and skip straight to just re-trying the image), a pending
        # article has no prior entry to cache from at all - every cycle it's
        # held re-runs fetch_article_body, giving extract_og_image another
        # real shot, not just card["media_url"].
        with tempfile.TemporaryDirectory() as tmp:
            articles_dir = Path(tmp) / "articles"
            articles_dir.mkdir()
            recent = (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat()
            (articles_dir / "pending.json").write_text(json.dumps({"new-article": {"firstSeenAt": recent}}))
            with patch.object(scrape_articles, "ARTICLES_DIR", articles_dir), \
                 patch.object(scrape_articles, "MEDIA_DIR", Path(tmp) / "media"), \
                 patch("scrape_articles.scrape_card_list", return_value=[self._card()]), \
                 patch("scrape_articles.fetch_article_body", return_value=("Full report.", None)) as mock_body:
                posts, pending = build_articles(refresh_all=False)
        mock_body.assert_called_once()
        self.assertEqual(posts, [])
        self.assertEqual(pending["new-article"]["firstSeenAt"], recent)

    def test_held_article_releases_with_image_once_found_on_a_later_cycle(self):
        with tempfile.TemporaryDirectory() as tmp:
            articles_dir = Path(tmp) / "articles"
            articles_dir.mkdir()
            original_first_seen = (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat()
            (articles_dir / "pending.json").write_text(json.dumps({"new-article": {"firstSeenAt": original_first_seen}}))
            with patch.object(scrape_articles, "ARTICLES_DIR", articles_dir), \
                 patch.object(scrape_articles, "MEDIA_DIR", Path(tmp) / "media"), \
                 patch("scrape_articles.scrape_card_list", return_value=[self._card()]), \
                 patch("scrape_articles.fetch_article_body",
                       return_value=("Full report.", "https://btcc.net/api/media/def456")), \
                 patch("scrape_articles.fetch_image_smart", return_value=(b"bytes", "image/jpeg")), \
                 patch("scrape_articles.save_mirrored_image", return_value="def456.jpg"):
                posts, pending = build_articles(refresh_all=False)
        self.assertNotIn("new-article", pending)
        self.assertEqual(len(posts), 1)
        self.assertEqual(
            posts[0]["_embedded"]["wp:featuredmedia"][0]["source_url"],
            "https://raw.githubusercontent.com/yacobwood/BTCC/main/data/media/news/def456.jpg",
        )
        # Must keep the TRUE first-detection time, not this run's now_iso -
        # otherwise a held article would look freshly-discovered at release
        # time instead of when it actually first appeared (see sort_posts'
        # own comment on why firstSeenAt accuracy matters for ordering).
        self.assertEqual(posts[0]["firstSeenAt"], original_first_seen)

    def test_held_article_publishes_text_only_once_hold_window_expires(self):
        with tempfile.TemporaryDirectory() as tmp:
            articles_dir = Path(tmp) / "articles"
            articles_dir.mkdir()
            expired_first_seen = (datetime.now(timezone.utc) - timedelta(minutes=25)).isoformat()
            (articles_dir / "pending.json").write_text(json.dumps({"new-article": {"firstSeenAt": expired_first_seen}}))
            with patch.object(scrape_articles, "ARTICLES_DIR", articles_dir), \
                 patch.object(scrape_articles, "MEDIA_DIR", Path(tmp) / "media"), \
                 patch("scrape_articles.scrape_card_list", return_value=[self._card()]), \
                 patch("scrape_articles.fetch_article_body", return_value=("Full report.", None)), \
                 patch("scrape_articles.fetch_image_smart") as mock_image:
                posts, pending = build_articles(refresh_all=False)
        mock_image.assert_not_called()
        self.assertNotIn("new-article", pending)
        self.assertEqual(len(posts), 1)
        self.assertNotIn("wp:featuredmedia", posts[0]["_embedded"])
        self.assertEqual(posts[0]["firstSeenAt"], expired_first_seen)


# ── btcc-gallery body images: mirroring + the retry-window cost bound ───────
#
# Confirmed live 2026-09-11 (on-device, two articles seven weeks apart) that
# the app's ArticleScreen WebView renders every btcc-gallery image as a
# broken icon - unlike the article's own featured/hero image, these were
# never mirrored at all, just hotlinked live from btcc.net's own
# /site-assets/<path>. See scrape_articles.py's GALLERY_IMG_RE/
# mirror_gallery_images and media_utils.py's MEDIA_SRC_RE_FRAGMENT.

class TestNeedsGalleryMirror(unittest.TestCase):

    def test_no_gallery_images_in_content_never_needs_mirroring(self):
        self.assertFalse(needs_gallery_mirror("<p>No images here.</p>", None, just_fetched=True))

    def test_just_fetched_always_gets_one_attempt_regardless_of_age(self):
        html = '<img src="/site-assets/2026/07/pic.jpg">'
        old = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
        self.assertTrue(needs_gallery_mirror(html, old, just_fetched=True))

    def test_cached_content_within_retry_window_still_tries(self):
        html = '<img src="/site-assets/2026/09/pic.jpg">'
        recent = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
        self.assertTrue(needs_gallery_mirror(html, recent, just_fetched=False))

    def test_cached_content_past_retry_window_stops_trying(self):
        # The cost-control half: a genuinely-dead gallery image must not
        # re-bill Scrapfly every 5-minute cycle forever, same reasoning as
        # IMAGE_RETRY_WINDOW's own for the hero image.
        html = '<img src="/site-assets/2026/07/pic.jpg">'
        old = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
        self.assertFalse(needs_gallery_mirror(html, old, just_fetched=False))


class TestMirrorGalleryImages(unittest.TestCase):

    def test_mirrors_a_gallery_image_and_rewrites_its_src(self):
        html = '<figure><img src="/site-assets/2026/09/a.jpg" alt="A"></figure>'
        with patch("scrape_articles.fetch_image_smart", return_value=(b"bytes", "image/jpeg")) as mock_image, \
             patch("scrape_articles.save_mirrored_image", return_value="a.jpg"):
            result = mirror_gallery_images(html, "some-article")
        mock_image.assert_called_once_with("https://btcc.net/site-assets/2026/09/a.jpg", label="some-article-gallery")
        self.assertEqual(result, f'<figure><img src="{MEDIA_RAW_BASE}/a.jpg" alt="A"></figure>')

    def test_dedupes_a_src_repeated_more_than_once(self):
        html = (
            '<img src="/site-assets/2026/09/a.jpg">'
            '<img src="/site-assets/2026/09/a.jpg">'
        )
        with patch("scrape_articles.fetch_image_smart", return_value=(b"bytes", "image/jpeg")) as mock_image, \
             patch("scrape_articles.save_mirrored_image", return_value="a.jpg"):
            result = mirror_gallery_images(html, "some-article")
        mock_image.assert_called_once()
        self.assertEqual(result.count(f'"{MEDIA_RAW_BASE}/a.jpg"'), 2)

    def test_a_failed_fetch_leaves_the_raw_src_untouched(self):
        html = '<img src="/site-assets/2026/09/dead.jpg">'
        with patch("scrape_articles.fetch_image_smart", return_value=None):
            result = mirror_gallery_images(html, "some-article")
        self.assertEqual(result, html)

    def test_a_non_gallery_img_shape_is_left_alone(self):
        # Only the confirmed-broken /site-assets/ shape gets this treatment -
        # a Supabase URL embedded directly in body content already loads
        # live in the WebView without issue.
        html = '<img src="https://xyz.supabase.co/storage/v1/object/public/a.jpg">'
        with patch("scrape_articles.fetch_image_smart") as mock_image:
            result = mirror_gallery_images(html, "some-article")
        mock_image.assert_not_called()
        self.assertEqual(result, html)


class TestBuildArticlesGalleryImages(unittest.TestCase):

    def test_mirrors_gallery_images_in_a_freshly_fetched_article(self):
        content = '<p>Report.</p><img src="/site-assets/2026/09/a.jpg">'
        with tempfile.TemporaryDirectory() as tmp:
            with patch.object(scrape_articles, "ARTICLES_DIR", Path(tmp) / "articles"), \
                 patch.object(scrape_articles, "MEDIA_DIR", Path(tmp) / "media"), \
                 patch("scrape_articles.scrape_card_list", return_value=[{
                     "slug": "gallery-story", "title": "Gallery Story",
                     "media_url": "https://btcc.net/api/media/hero123",
                     "excerpt": "", "date": "2026-09-11T00:00:00",
                 }]), \
                 patch("scrape_articles.fetch_article_body", return_value=(content, None)), \
                 patch("scrape_articles.fetch_image_smart", return_value=(b"bytes", "image/jpeg")), \
                 patch("scrape_articles.save_mirrored_image", side_effect=["a.jpg", "hero123.jpg"]):
                # save_mirrored_image is called once for the gallery image
                # (mirror_gallery_images runs first) and once for the card's
                # own hero image (resolved after) - side_effect order above
                # matches that call order.
                posts, pending = build_articles(refresh_all=False)
        self.assertIn(f'{MEDIA_RAW_BASE}/a.jpg', posts[0]["content"]["rendered"])
        self.assertNotIn("/site-assets/", posts[0]["content"]["rendered"])

    def test_falls_back_to_first_gallery_image_when_no_hero_or_og_image(self):
        """Confirmed live 2026-09-11: "BTCC visit Darlington Memorial
        Hospital..." had no listing-card thumbnail and no og:image at all -
        only its own inline btcc-gallery - so its hero rendered as a blank
        black background in the app. Tier 3 of the fallback chain (tiers 1-2
        are card thumbnail / og:image, see
        project_article_missing_image_ogimage_fallback memory)."""
        content = '<p>Report.</p><img src="/site-assets/2026/09/a.jpg" alt="A">'
        with tempfile.TemporaryDirectory() as tmp:
            with patch.object(scrape_articles, "ARTICLES_DIR", Path(tmp) / "articles"), \
                 patch.object(scrape_articles, "MEDIA_DIR", Path(tmp) / "media"), \
                 patch("scrape_articles.scrape_card_list", return_value=[{
                     "slug": "hospital-visit", "title": "Hospital Visit",
                     "media_url": None,
                     "excerpt": "", "date": "2026-09-11T00:00:00",
                 }]), \
                 patch("scrape_articles.fetch_article_body", return_value=(content, None)), \
                 patch("scrape_articles.fetch_image_smart", return_value=(b"bytes", "image/jpeg")), \
                 patch("scrape_articles.save_mirrored_image", return_value="a.jpg"):
                posts, pending = build_articles(refresh_all=False)
        self.assertEqual(
            posts[0]["_embedded"]["wp:featuredmedia"][0]["source_url"],
            f"{MEDIA_RAW_BASE}/a.jpg",
        )
        # A guess, not confirmed - see TestHeroSourceRetry below for why
        # this marker has to survive so a later run can keep trying for
        # the real card/og image instead of treating this as final.
        self.assertEqual(posts[0]["_embedded"]["heroSource"], "gallery")

    def test_stops_retrying_gallery_images_on_an_old_already_mirrored_article(self):
        """The cost-control half at the build_articles integration level -
        mirrors test_stops_retrying_an_old_image_less_article above, but for
        gallery images: past IMAGE_RETRY_WINDOW, a cached article's own
        still-broken gallery src stops paying for a fresh image fetch every
        run."""
        with tempfile.TemporaryDirectory() as tmp:
            articles_dir = Path(tmp) / "articles"
            articles_dir.mkdir()
            old = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
            existing_post = {
                "id": "old-gallery-story", "slug": "old-gallery-story",
                "date": "2026-08-05T00:00:00", "firstSeenAt": old,
                "title": {"rendered": "Old Gallery Story"}, "excerpt": {"rendered": ""},
                "content": {"rendered": '<img src="/site-assets/2026/08/a.jpg">'},
                "_embedded": {"wp:featuredmedia": [{"source_url": f"{MEDIA_RAW_BASE}/hero.jpg"}]},
            }
            (articles_dir / "page_1.json").write_text(json.dumps([existing_post]))
            with patch.object(scrape_articles, "ARTICLES_DIR", articles_dir), \
                 patch.object(scrape_articles, "MEDIA_DIR", Path(tmp) / "media"), \
                 patch("scrape_articles.scrape_card_list", return_value=[{
                     "slug": "old-gallery-story", "title": "Old Gallery Story",
                     "media_url": "https://btcc.net/api/media/hero.jpg",
                     "excerpt": "", "date": "2026-08-05T00:00:00",
                 }]), \
                 patch("scrape_articles.fetch_image_smart") as mock_image:
                posts, pending = build_articles(refresh_all=False)
        mock_image.assert_not_called()
        self.assertIn("/site-assets/", posts[0]["content"]["rendered"])


# ── heroSource: a gallery-fallback hero must stay retryable ─────────────────
#
# Confirmed live 2026-09-11, same day as the gallery-mirroring fix shipped:
# the user compared "BTCC visit Darlington Memorial Hospital..." against the
# real btcc.net page directly and it showed a different, correct hero photo -
# meaning a real og:image DID exist, this run's fetch of it had just failed
# transiently (the same live per-request Scrapfly flakiness already hit twice
# the same day - see project_gallery_image_mirroring_fix memory), and the
# tier-3 gallery fallback then permanently blocked ever trying again, since a
# gallery-derived MEDIA_RAW_BASE URL looked identical to a confirmed one.

class TestHeroSourceRetry(unittest.TestCase):

    def _existing_gallery_hero(self, first_seen):
        # content.rendered already has its gallery src mirrored (realistic
        # persisted state - mirror_gallery_images already ran successfully
        # on some earlier cycle), matching what real committed data looks
        # like after a successful mirror.
        return {
            "id": "hospital-visit", "slug": "hospital-visit",
            "date": "2026-09-11T00:00:00", "firstSeenAt": first_seen,
            "title": {"rendered": "Hospital Visit"}, "excerpt": {"rendered": ""},
            "content": {"rendered": f'<img src="{MEDIA_RAW_BASE}/a.jpg">'},
            "_embedded": {
                "wp:featuredmedia": [{"source_url": f"{MEDIA_RAW_BASE}/a.jpg"}],
                "heroSource": "gallery",
            },
        }

    def test_a_recent_gallery_sourced_hero_gets_retried_and_upgrades_to_the_real_og_image(self):
        with tempfile.TemporaryDirectory() as tmp:
            articles_dir = Path(tmp) / "articles"
            articles_dir.mkdir()
            recent = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
            (articles_dir / "page_1.json").write_text(json.dumps([self._existing_gallery_hero(recent)]))
            with patch.object(scrape_articles, "ARTICLES_DIR", articles_dir), \
                 patch.object(scrape_articles, "MEDIA_DIR", Path(tmp) / "media"), \
                 patch("scrape_articles.scrape_card_list", return_value=[{
                     "slug": "hospital-visit", "title": "Hospital Visit",
                     "media_url": None,
                     "excerpt": "", "date": "2026-09-11T00:00:00",
                 }]), \
                 patch("scrape_articles.fetch_article_body",
                       return_value=('<img src="/site-assets/2026/09/a.jpg">', "https://btcc.net/api/media/real789")) as mock_body, \
                 patch("scrape_articles.fetch_image_smart", return_value=(b"bytes", "image/jpeg")), \
                 patch("scrape_articles.save_mirrored_image", return_value="real789.jpg"):
                posts, pending = build_articles(refresh_all=False)
        mock_body.assert_called_once()
        self.assertEqual(
            posts[0]["_embedded"]["wp:featuredmedia"][0]["source_url"],
            f"{MEDIA_RAW_BASE}/real789.jpg",
        )
        self.assertNotIn("heroSource", posts[0]["_embedded"])

    def test_a_recent_gallery_sourced_hero_stays_gallery_when_the_retry_still_finds_nothing(self):
        with tempfile.TemporaryDirectory() as tmp:
            articles_dir = Path(tmp) / "articles"
            articles_dir.mkdir()
            recent = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
            (articles_dir / "page_1.json").write_text(json.dumps([self._existing_gallery_hero(recent)]))
            with patch.object(scrape_articles, "ARTICLES_DIR", articles_dir), \
                 patch.object(scrape_articles, "MEDIA_DIR", Path(tmp) / "media"), \
                 patch("scrape_articles.scrape_card_list", return_value=[{
                     "slug": "hospital-visit", "title": "Hospital Visit",
                     "media_url": None,
                     "excerpt": "", "date": "2026-09-11T00:00:00",
                 }]), \
                 patch("scrape_articles.fetch_article_body",
                       return_value=('<img src="/site-assets/2026/09/a.jpg">', None)) as mock_body, \
                 patch("scrape_articles.fetch_image_smart", return_value=(b"bytes", "image/jpeg")), \
                 patch("scrape_articles.save_mirrored_image", return_value="a.jpg"):
                posts, pending = build_articles(refresh_all=False)
        mock_body.assert_called_once()
        self.assertEqual(
            posts[0]["_embedded"]["wp:featuredmedia"][0]["source_url"],
            f"{MEDIA_RAW_BASE}/a.jpg",
        )
        self.assertEqual(posts[0]["_embedded"]["heroSource"], "gallery")

    def test_stops_retrying_a_gallery_sourced_hero_past_the_retry_window(self):
        """Same cost-control shape as test_stops_retrying_an_old_image_less_article -
        a gallery guess this old stops paying for a fresh full-page fetch on
        every run, same as a fully image-less article would."""
        with tempfile.TemporaryDirectory() as tmp:
            articles_dir = Path(tmp) / "articles"
            articles_dir.mkdir()
            old = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
            (articles_dir / "page_1.json").write_text(json.dumps([self._existing_gallery_hero(old)]))
            with patch.object(scrape_articles, "ARTICLES_DIR", articles_dir), \
                 patch.object(scrape_articles, "MEDIA_DIR", Path(tmp) / "media"), \
                 patch("scrape_articles.scrape_card_list", return_value=[{
                     "slug": "hospital-visit", "title": "Hospital Visit",
                     "media_url": None,
                     "excerpt": "", "date": "2026-09-11T00:00:00",
                 }]), \
                 patch("scrape_articles.fetch_article_body") as mock_body:
                posts, pending = build_articles(refresh_all=False)
        mock_body.assert_not_called()
        self.assertEqual(
            posts[0]["_embedded"]["wp:featuredmedia"][0]["source_url"],
            f"{MEDIA_RAW_BASE}/a.jpg",
        )
        self.assertEqual(posts[0]["_embedded"]["heroSource"], "gallery")

    def test_a_confirmed_hero_image_is_never_reattempted(self):
        """The pre-existing, unchanged behaviour for every article mirrored
        before heroSource existed (or any real card/og image) - absent
        heroSource must keep short-circuiting exactly as it always did."""
        with tempfile.TemporaryDirectory() as tmp:
            articles_dir = Path(tmp) / "articles"
            articles_dir.mkdir()
            recent = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
            existing_post = {
                "id": "race-report", "slug": "race-report",
                "date": "2026-09-11T00:00:00", "firstSeenAt": recent,
                "title": {"rendered": "Race Report"}, "excerpt": {"rendered": ""},
                "content": {"rendered": "Full report."},
                "_embedded": {"wp:featuredmedia": [{"source_url": f"{MEDIA_RAW_BASE}/real.jpg"}]},
            }
            (articles_dir / "page_1.json").write_text(json.dumps([existing_post]))
            with patch.object(scrape_articles, "ARTICLES_DIR", articles_dir), \
                 patch.object(scrape_articles, "MEDIA_DIR", Path(tmp) / "media"), \
                 patch("scrape_articles.scrape_card_list", return_value=[{
                     "slug": "race-report", "title": "Race Report",
                     "media_url": None,
                     "excerpt": "", "date": "2026-09-11T00:00:00",
                 }]), \
                 patch("scrape_articles.fetch_article_body") as mock_body:
                posts, pending = build_articles(refresh_all=False)
        mock_body.assert_not_called()
        self.assertEqual(
            posts[0]["_embedded"]["wp:featuredmedia"][0]["source_url"],
            f"{MEDIA_RAW_BASE}/real.jpg",
        )
        self.assertNotIn("heroSource", posts[0]["_embedded"])


class TestPruneOrphanedImages(unittest.TestCase):

    def test_a_gallery_referenced_image_survives_pruning(self):
        # Without accounting for content.rendered, this looks orphaned to
        # prune_orphaned_images (it's not in any post's _embedded) and would
        # get deleted on the very same run that just mirrored it.
        with tempfile.TemporaryDirectory() as tmp:
            media_dir = Path(tmp) / "media"
            media_dir.mkdir()
            (media_dir / "a.jpg").write_bytes(b"fake")
            (media_dir / "orphan.jpg").write_bytes(b"fake")
            posts = [{
                "slug": "gallery-story",
                "content": {"rendered": f'<img src="{MEDIA_RAW_BASE}/a.jpg">'},
                "_embedded": {},
            }]
            with patch.object(scrape_articles, "MEDIA_DIR", media_dir):
                removed = prune_orphaned_images(posts)
            self.assertEqual(removed, 1)
            self.assertTrue((media_dir / "a.jpg").exists())
            self.assertFalse((media_dir / "orphan.jpg").exists())


if __name__ == "__main__":
    unittest.main()
