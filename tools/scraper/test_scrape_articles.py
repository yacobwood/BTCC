#!/usr/bin/env python3
"""Tests for scrape_articles.py's display-date parsing."""

import unittest

from scrape_articles import needs_full_refetch, parse_display_date


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


if __name__ == "__main__":
    unittest.main()
