#!/usr/bin/env python3
"""Tests for scrape_articles.py's display-date parsing."""

import unittest

from scrape_articles import needs_full_refetch, parse_display_date, resolve_first_seen, scrape_card_list


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

    def test_prior_without_firstseenat_falls_back_to_now(self):
        # A slug mirrored before this field existed - treat it like new
        # rather than crashing on a missing key.
        prior = {"date": "2026-08-08T00:00:00"}
        self.assertEqual(resolve_first_seen(prior, "2026-08-09T22:39:03+00:00"), "2026-08-09T22:39:03+00:00")


# ── scrape_card_list ─────────────────────────────────────────────────────────
#
# Regression coverage: the /news/ listing's card images use loading="lazy" -
# without scrolling, only the hero card (already in the initial viewport)
# actually gets its image requested and captured; every card lower down
# silently got media_url=None, permanently, since a missing image is never
# retried once a slug is otherwise fully scraped. Confirmed live: two Race 1
# reports both missing images the same day they were first scraped.

class FakeFetcher:
    """Minimal stand-in for RenderedFetcher - scrape_card_list only ever calls
    .get_with_media(url, **kwargs) on whatever fetcher it's given, so a real
    Playwright browser isn't needed to test the call itself."""
    def __init__(self, html='<html><body></body></html>', media=None):
        self.html = html
        self.media = media or {}
        self.calls = []

    def get_with_media(self, url, **kwargs):
        self.calls.append({'url': url, **kwargs})
        return self.html, self.media


class TestScrapeCardList(unittest.TestCase):

    def test_requests_scroll_through_to_capture_lazy_loaded_images(self):
        fetcher = FakeFetcher()
        scrape_card_list(fetcher)
        self.assertEqual(len(fetcher.calls), 1)
        self.assertTrue(fetcher.calls[0].get('scroll_through'))


if __name__ == "__main__":
    unittest.main()
