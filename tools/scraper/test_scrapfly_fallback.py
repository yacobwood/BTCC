#!/usr/bin/env python3
"""Tests for scrapfly_fallback.py - the bounded, measured trial fallback
for scrape_articles.py's individual article-body fetch. Confirms the most
important property first: with no SCRAPFLY_API_KEY configured (the default,
common state - this is a trial, not a permanent feature), it's a true
no-op that never even attempts a network call."""

import json
import unittest
from io import BytesIO
from unittest.mock import patch

from scrapfly_fallback import fetch_via_scrapfly


class TestFetchViaScrapfly(unittest.TestCase):

    @patch.dict("os.environ", {}, clear=True)
    @patch("scrapfly_fallback.urllib.request.urlopen")
    def test_is_a_true_noop_when_api_key_is_unset(self, mock_urlopen):
        result = fetch_via_scrapfly("https://btcc.net/some-article/")
        self.assertIsNone(result)
        mock_urlopen.assert_not_called()

    @patch.dict("os.environ", {"SCRAPFLY_API_KEY": "test-key"}, clear=True)
    @patch("scrapfly_fallback.urllib.request.urlopen")
    def test_returns_content_on_success(self, mock_urlopen):
        mock_urlopen.return_value.__enter__.return_value = BytesIO(
            json.dumps({"result": {"content": "<div>Full content.</div>"}}).encode()
        )
        result = fetch_via_scrapfly("https://btcc.net/some-article/")
        self.assertEqual(result, "<div>Full content.</div>")

    @patch.dict("os.environ", {"SCRAPFLY_API_KEY": "test-key"}, clear=True)
    @patch("scrapfly_fallback.urllib.request.urlopen")
    def test_passes_api_key_url_and_asp_render_js_flags(self, mock_urlopen):
        mock_urlopen.return_value.__enter__.return_value = BytesIO(
            json.dumps({"result": {"content": "ok"}}).encode()
        )
        fetch_via_scrapfly("https://btcc.net/some-article/", referer="https://btcc.net/news/")
        requested_url = mock_urlopen.call_args[0][0]
        self.assertIn("key=test-key", requested_url)
        self.assertIn("asp=true", requested_url)
        self.assertIn("render_js=true", requested_url)
        self.assertIn("headers%5BReferer%5D", requested_url)  # headers[Referer]=... URL-encoded

    @patch.dict("os.environ", {"SCRAPFLY_API_KEY": "test-key"}, clear=True)
    @patch("scrapfly_fallback.urllib.request.urlopen")
    def test_returns_none_rather_than_raising_on_any_failure(self, mock_urlopen):
        mock_urlopen.side_effect = RuntimeError("connection reset")
        self.assertIsNone(fetch_via_scrapfly("https://btcc.net/some-article/"))


if __name__ == "__main__":
    unittest.main()
