#!/usr/bin/env python3
"""Tests for scrape_articles.py's display-date parsing."""

import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import scrape_articles
from scrape_articles import (
    NEWS_URL,
    build_articles,
    fetch_article_body,
    needs_full_refetch,
    parse_display_date,
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

class TestFetchArticleBody(unittest.TestCase):

    @patch("scrape_articles.fetch_via_scrapfly", return_value=None)
    def test_returns_none_rather_than_raising_when_fetch_fails(self, mock_fetch):
        self.assertIsNone(fetch_article_body("some-slug"))

    @patch("scrape_articles.fetch_via_scrapfly")
    def test_passes_referer_and_extracts_body(self, mock_fetch):
        mock_fetch.return_value = '<div class="article-body">Full content.</div></article>'
        result = fetch_article_body("some-slug")
        self.assertEqual(mock_fetch.call_args.kwargs.get("referer"), NEWS_URL)
        self.assertEqual(result, "Full content.")


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
                posts = build_articles(refresh_all=False)
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
                 patch("scrape_articles.fetch_article_body", return_value="Full report."), \
                 patch("scrape_articles.fetch_image_smart", return_value=(b"bytes", "image/jpeg")) as mock_image, \
                 patch("scrape_articles.save_mirrored_image", return_value="abc123.jpg"):
                posts = build_articles(refresh_all=False)
        mock_image.assert_called_once()
        self.assertEqual(
            posts[0]["_embedded"]["wp:featuredmedia"][0]["source_url"],
            "https://raw.githubusercontent.com/yacobwood/BTCC/main/data/media/news/abc123.jpg",
        )


if __name__ == "__main__":
    unittest.main()
