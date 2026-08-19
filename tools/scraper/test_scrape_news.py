#!/usr/bin/env python3
"""Tests for scrape_news.py - the single most business-critical scraper (it
drives live push notifications, runs every 5 minutes). Before this file
existed there was zero coverage of it at all - a real gap, since it also
had no retry: any single transient 429 skipped straight to failure rather
than riding it out (fixed by moving retry logic into RenderedFetcher, see
test_btcc_playwright.py, and giving this script retries=3)."""

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


class _FakeRenderedFetcher:
    """Stand-in for the `with RenderedFetcher(...) as fetcher:` context
    manager scrape_news() constructs internally - patched in via
    scrape_news.RenderedFetcher, since scrape_news() (unlike
    scrape_articles.py's per-item functions) doesn't take an injected
    fetcher and doesn't need to - it makes exactly one fetch."""

    def __init__(self, html=None, media=None, error=None):
        self._html = html
        self._media = media or {}
        self._error = error

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def get_with_media(self, *a, **k):
        if self._error:
            raise self._error
        return self._html, self._media


class TestScrapeNews(unittest.TestCase):

    def test_parses_the_latest_card_into_wp_rest_shape(self):
        with patch("scrape_news.RenderedFetcher", lambda **kw: _FakeRenderedFetcher(html=CARD_HTML)):
            posts = scrape_news()
        self.assertEqual(len(posts), 1)
        self.assertEqual(posts[0]["id"], "race-1-report")
        self.assertEqual(posts[0]["slug"], "race-1-report")
        self.assertEqual(posts[0]["title"]["rendered"], "Race 1 Report")

    def test_returns_none_rather_than_raising_when_fetch_ultimately_fails(self):
        error = RuntimeError("HTTP 429 fetching https://btcc.net/news/")
        with patch("scrape_news.RenderedFetcher", lambda **kw: _FakeRenderedFetcher(error=error)):
            result = scrape_news()
        self.assertIsNone(result)

    def test_returns_none_when_no_article_card_is_found(self):
        with patch("scrape_news.RenderedFetcher", lambda **kw: _FakeRenderedFetcher(html="<html></html>")):
            self.assertIsNone(scrape_news())

    def test_strips_a_nested_tag_wrapped_around_the_title(self):
        # 2026-08-18/19 overnight incident: 3 real scrape failures around a
        # breaking-news story, most likely because the title was briefly
        # wrapped in an inline tag (e.g. a "breaking" badge span) while the
        # CMS was actively re-publishing it - the old [^<]+ capture had zero
        # tolerance for that and hard-failed the whole scrape.
        html = CARD_HTML.replace(
            "<h3><a href=\"/race-1-report/\">Race 1 Report</a></h3>",
            "<h3><a href=\"/race-1-report/\"><span class=\"badge\">Breaking</span> Race 1 Report</a></h3>",
        )
        with patch("scrape_news.RenderedFetcher", lambda **kw: _FakeRenderedFetcher(html=html)):
            posts = scrape_news()
        self.assertEqual(posts[0]["title"]["rendered"], "Breaking Race 1 Report")

    def test_returns_none_when_title_is_tags_only(self):
        html = CARD_HTML.replace(
            "<h3><a href=\"/race-1-report/\">Race 1 Report</a></h3>",
            "<h3><a href=\"/race-1-report/\"><span></span></a></h3>",
        )
        with patch("scrape_news.RenderedFetcher", lambda **kw: _FakeRenderedFetcher(html=html)):
            self.assertIsNone(scrape_news())

    def test_constructs_fetcher_with_retries_3(self):
        # retries=3, not RenderedFetcher's own default of 2 - a missed
        # 5-minute tick has a direct notification-latency cost, so this
        # script deliberately asks for one more attempt than the default.
        captured = {}

        def fake(**kwargs):
            captured.update(kwargs)
            return _FakeRenderedFetcher(html=CARD_HTML)

        with patch("scrape_news.RenderedFetcher", fake):
            scrape_news()
        self.assertEqual(captured.get("retries"), 3)


if __name__ == "__main__":
    unittest.main()
