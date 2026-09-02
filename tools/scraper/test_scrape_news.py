#!/usr/bin/env python3
"""Tests for scrape_news.py - the single most business-critical scraper (it
drives live push notifications). Covers the cost-critical property first:
when the fetched slug already matches what's committed, the ~225-credit
image fetch must never be attempted - that's the whole reason this exists
as a gated check rather than an unconditional fetch (see the function's own
docstring for why that distinction didn't matter under the old Playwright
implementation but matters a great deal under Scrapfly's per-resource
billing)."""

import json
import unittest
from unittest.mock import patch

from scrape_news import scrape_news

CARD_HTML = """
<html><body>
<article class="news-card">
  <img src="/api/media/abc123">
  <h3><a href="/race-1-report/">Race 1 Report</a></h3>
</article>
</body></html>
"""

CARD_HTML_NO_IMAGE = """
<html><body>
<article class="news-card">
  <h3><a href="/where-to-watch-croft-2/">Where to Watch: Croft</a></h3>
</article>
</body></html>
"""


class TestScrapeNews(unittest.TestCase):

    @patch("scrape_news._current_slug", return_value="some-older-article")
    @patch("scrape_news.fetch_via_scrapfly", return_value=CARD_HTML)
    @patch("scrape_news.fetch_image_smart", return_value=(b"bytes", "image/jpeg"))
    @patch("scrape_news.save_mirrored_image", return_value="abc123.jpg")
    def test_parses_the_latest_card_into_wp_rest_shape(self, mock_save, mock_image, mock_fetch, mock_slug):
        posts = scrape_news()
        self.assertEqual(len(posts), 1)
        self.assertEqual(posts[0]["id"], "race-1-report")
        self.assertEqual(posts[0]["slug"], "race-1-report")
        self.assertEqual(posts[0]["title"]["rendered"], "Race 1 Report")
        self.assertEqual(
            posts[0]["_embedded"]["wp:featuredmedia"][0]["source_url"],
            "https://raw.githubusercontent.com/yacobwood/BTCC/main/data/media/news/abc123.jpg",
        )

    @patch("scrape_news._current_slug", return_value="race-1-report")
    @patch("scrape_news.fetch_via_scrapfly", return_value=CARD_HTML)
    @patch("scrape_news.fetch_image_smart")
    def test_matching_slug_never_touches_the_expensive_image_fetch(self, mock_image, mock_fetch, mock_slug):
        """The cost-critical property: a headline that hasn't changed since
        the last run must not re-pay the ~225-credit image fetch."""
        with patch("pathlib.Path.read_text", return_value=json.dumps([
            {"slug": "race-1-report", "_embedded": {"wp:featuredmedia": [{"source_url": "https://example.com/existing.jpg"}]}}
        ])):
            posts = scrape_news()
        mock_image.assert_not_called()
        self.assertEqual(
            posts[0]["_embedded"]["wp:featuredmedia"][0]["source_url"],
            "https://example.com/existing.jpg",
        )

    @patch("scrape_news._current_slug", return_value="race-1-report")
    @patch("scrape_news.fetch_via_scrapfly", return_value=CARD_HTML)
    @patch("scrape_news.fetch_image_smart", return_value=(b"bytes", "image/jpeg"))
    @patch("scrape_news.save_mirrored_image", return_value="abc123.jpg")
    def test_force_refetches_even_when_slug_matches(self, mock_save, mock_image, mock_fetch, mock_slug):
        # save_mirrored_image mocked (not just fetch_image_smart) - left
        # unmocked here once, this called the real function against the
        # real repo path and left a stray data/media/news/abc123.jpg
        # committed nowhere but sitting on disk on every test run.
        scrape_news(force=True)
        mock_image.assert_called_once()

    @patch("scrape_news._current_slug", return_value="race-1-report")
    @patch("scrape_news.fetch_via_scrapfly", return_value=CARD_HTML)
    @patch("scrape_news.fetch_image_smart", return_value=None)
    def test_force_falls_back_to_existing_image_when_refetch_fails(self, mock_image, mock_fetch, mock_slug):
        """Regression coverage: confirmed live 2026-09-02 - a --force run
        that hits a transient Scrapfly failure used to silently wipe out an
        already-good image back to none, since the old code only ever set
        image_url from a fresh fetch attempt and defaulted to None
        everywhere else. A failed re-fetch of the SAME article must fall
        back to whatever was already committed, not lose it."""
        with patch("pathlib.Path.read_text", return_value=json.dumps([
            {"slug": "race-1-report", "_embedded": {"wp:featuredmedia": [{"source_url": "https://example.com/existing.jpg"}]}}
        ])):
            posts = scrape_news(force=True)
        mock_image.assert_called_once()  # the retry was genuinely attempted...
        self.assertEqual(
            posts[0]["_embedded"]["wp:featuredmedia"][0]["source_url"],
            "https://example.com/existing.jpg",  # ...but the existing image survives its failure
        )

    @patch("scrape_news._current_slug", return_value="some-older-article")
    @patch("scrape_news.fetch_via_scrapfly", return_value=CARD_HTML)
    @patch("scrape_news.fetch_image_smart", return_value=None)
    def test_new_headline_with_failed_fetch_never_reuses_a_different_articles_image(self, mock_image, mock_fetch, mock_slug):
        """The fallback-to-existing-image behavior above is scoped to the
        SAME article only - a genuinely new headline whose image fetch
        fails must show no image, never the previous (different) article's
        one, even though data/news.json still has that old entry sitting
        there when this runs."""
        with patch("pathlib.Path.read_text", return_value=json.dumps([
            {"slug": "some-older-article", "_embedded": {"wp:featuredmedia": [{"source_url": "https://example.com/old-article.jpg"}]}}
        ])):
            posts = scrape_news()
        self.assertEqual(posts[0]["slug"], "race-1-report")
        self.assertEqual(posts[0]["_embedded"], {})

    @patch("scrape_news._current_slug", return_value="some-older-article")
    @patch("scrape_news.fetch_via_scrapfly", return_value=CARD_HTML_NO_IMAGE)
    @patch("scrape_news.fetch_image_smart")
    def test_no_image_in_card_means_no_image_fetch_attempted(self, mock_image, mock_fetch, mock_slug):
        posts = scrape_news()
        mock_image.assert_not_called()
        self.assertEqual(posts[0]["_embedded"], {})

    @patch("scrape_news.fetch_via_scrapfly", return_value=None)
    def test_returns_none_rather_than_raising_when_fetch_fails(self, mock_fetch):
        self.assertIsNone(scrape_news())

    @patch("scrape_news.fetch_via_scrapfly", return_value="<html><body>no cards here</body></html>")
    def test_returns_none_when_no_article_card_found(self, mock_fetch):
        self.assertIsNone(scrape_news())

    @patch("scrape_news._current_slug", return_value="some-older-article")
    @patch("scrape_news.fetch_via_scrapfly", return_value='<html><body><article class="news-card"><img src="/api/media/x"><h3><a href="/x/"></a></h3></article></body></html>')
    def test_returns_none_when_title_is_empty(self, mock_fetch, mock_slug):
        self.assertIsNone(scrape_news())


if __name__ == "__main__":
    unittest.main()
