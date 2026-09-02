#!/usr/bin/env python3
"""Tests for scrapfly_fallback.py - the Scrapfly-backed fetch functions
every btcc.net-facing scraper uses as of the 2026-09-01 migration (see
project_scrapfly_full_migration memory). Confirms the most important
property first: with no SCRAPFLY_API_KEY configured (the default state on
most CI environments), every fetch function is a true no-op that never
even attempts a network call."""

import base64
import json
import unittest
from io import BytesIO
from unittest.mock import patch

from scrapfly_fallback import fetch_image_smart, fetch_image_via_scrapfly, fetch_via_scrapfly


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

    @patch.dict("os.environ", {"SCRAPFLY_API_KEY": "test-key"}, clear=True)
    @patch("scrapfly_fallback.urllib.request.urlopen")
    def test_render_js_false_is_passed_through(self, mock_urlopen):
        # scrape_news_scrapfly_fallback.py's HTML check always wants
        # render_js=True (the default); this confirms the override actually
        # reaches the request rather than being silently ignored.
        mock_urlopen.return_value.__enter__.return_value = BytesIO(
            json.dumps({"result": {"content": "ok"}}).encode()
        )
        fetch_via_scrapfly("https://btcc.net/api/media/abc123", render_js=False)
        requested_url = mock_urlopen.call_args[0][0]
        self.assertIn("render_js=false", requested_url)


class TestFetchImageViaScrapfly(unittest.TestCase):

    @patch.dict("os.environ", {}, clear=True)
    @patch("scrapfly_fallback.urllib.request.urlopen")
    def test_is_a_true_noop_when_api_key_is_unset(self, mock_urlopen):
        result = fetch_image_via_scrapfly("https://btcc.net/api/media/abc123")
        self.assertIsNone(result)
        mock_urlopen.assert_not_called()

    @patch.dict("os.environ", {"SCRAPFLY_API_KEY": "test-key"}, clear=True)
    @patch("scrapfly_fallback.urllib.request.urlopen")
    def test_decodes_base64_content_and_returns_bytes_plus_content_type(self, mock_urlopen):
        raw_bytes = b"\xff\xd8\xff\xe0fake-jpeg-bytes"
        mock_urlopen.return_value.__enter__.return_value = BytesIO(json.dumps({
            "result": {
                "content": base64.b64encode(raw_bytes).decode(),
                "content_type": "image/jpeg",
            }
        }).encode())
        result = fetch_image_via_scrapfly("https://btcc.net/api/media/abc123")
        self.assertEqual(result, (raw_bytes, "image/jpeg"))

    @patch.dict("os.environ", {"SCRAPFLY_API_KEY": "test-key"}, clear=True)
    @patch("scrapfly_fallback.urllib.request.urlopen")
    def test_falls_back_to_response_headers_when_content_type_field_missing(self, mock_urlopen):
        # Confirmed live (2026-09-01) Scrapfly reports content-type one of
        # two ways depending on target - this is the other one.
        raw_bytes = b"fake-png-bytes"
        mock_urlopen.return_value.__enter__.return_value = BytesIO(json.dumps({
            "result": {
                "content": base64.b64encode(raw_bytes).decode(),
                "response_headers": {"content-type": "image/png; charset=binary"},
            }
        }).encode())
        result = fetch_image_via_scrapfly("https://btcc.net/api/media/abc123")
        self.assertEqual(result, (raw_bytes, "image/png"))

    @patch.dict("os.environ", {"SCRAPFLY_API_KEY": "test-key"}, clear=True)
    @patch("scrapfly_fallback.urllib.request.urlopen")
    def test_requests_asp_true_render_js_false(self, mock_urlopen):
        # render_js=True against a raw image URL confirmed live (2026-09-01)
        # to return an empty 302 instead of the image - False is required.
        mock_urlopen.return_value.__enter__.return_value = BytesIO(json.dumps({
            "result": {"content": base64.b64encode(b"x").decode(), "content_type": "image/jpeg"}
        }).encode())
        fetch_image_via_scrapfly("https://btcc.net/api/media/abc123")
        requested_url = mock_urlopen.call_args[0][0]
        self.assertIn("asp=true", requested_url)
        self.assertIn("render_js=false", requested_url)

    @patch.dict("os.environ", {"SCRAPFLY_API_KEY": "test-key"}, clear=True)
    @patch("scrapfly_fallback.urllib.request.urlopen")
    def test_returns_none_rather_than_raising_on_any_failure(self, mock_urlopen):
        mock_urlopen.side_effect = RuntimeError("connection reset")
        self.assertIsNone(fetch_image_via_scrapfly("https://btcc.net/api/media/abc123"))

    @patch.dict("os.environ", {"SCRAPFLY_API_KEY": "test-key"}, clear=True)
    @patch("scrapfly_fallback.urllib.request.urlopen")
    def test_fetches_large_object_reference_instead_of_decoding_it_as_base64(self, mock_urlopen):
        """Regression coverage: confirmed live 2026-09-02 on a genuine
        4.1MB image - Scrapfly returns a large_object reference URL in
        `content` instead of inline base64 once a response crosses some
        size threshold. The old code tried to base64-decode that URL
        string itself and failed with an opaque "Incorrect padding" that
        looked like intermittent flakiness across many retries before the
        real, 100%-reproducible cause was found."""
        large_object_url = "https://api.scrapfly.io/scrape/large_object/01M1GFGJTN2YQJMXCC60N1PEKE"
        real_image_bytes = b"\xff\xd8\xff\xe0fake-large-jpeg-bytes"

        api_response = BytesIO(json.dumps({
            "result": {"content": large_object_url, "content_type": "image/jpeg", "success": True},
        }).encode())
        large_object_response = BytesIO(real_image_bytes)
        # urlopen used as a context manager both times - .read() must work
        # on whichever BytesIO __enter__ returns for that call.
        mock_urlopen.return_value.__enter__.side_effect = [api_response, large_object_response]

        result = fetch_image_via_scrapfly("https://btcc.net/api/media/2f0991ab-...")
        self.assertEqual(result, (real_image_bytes, "image/jpeg"))
        # The second request must be authenticated - a bare fetch of the
        # large_object URL returns 401 (confirmed live).
        second_call_url = mock_urlopen.call_args_list[1].args[0]
        self.assertIn("key=test-key", second_call_url)
        self.assertTrue(second_call_url.startswith(large_object_url))

    @patch.dict("os.environ", {"SCRAPFLY_API_KEY": "test-key"}, clear=True)
    @patch("scrapfly_fallback.urllib.request.urlopen")
    def test_success_false_response_reports_the_real_error_not_a_decode_failure(self, mock_urlopen):
        mock_urlopen.return_value.__enter__.return_value = BytesIO(json.dumps({
            "result": {"success": False, "error": {"message": "target site blocked the request"}},
        }).encode())
        result = fetch_image_via_scrapfly("https://btcc.net/api/media/abc123")
        self.assertIsNone(result)


class TestFetchImageSmart(unittest.TestCase):
    """Shared by scrape_news.py and scrape_articles.py - the branch that
    decides which of the two image fetch paths (free plain request vs. paid
    Scrapfly) a given URL actually needs."""

    @patch("scrapfly_fallback.urllib.request.urlopen")
    def test_supabase_url_uses_plain_free_fetch_not_scrapfly(self, mock_urlopen):
        mock_urlopen.return_value.__enter__.return_value.read.return_value = b"raw-bytes"
        mock_urlopen.return_value.__enter__.return_value.headers.get.return_value = "image/jpeg"
        with patch("scrapfly_fallback.fetch_image_via_scrapfly") as mock_scrapfly:
            result = fetch_image_smart(
                "https://ylxmhtbmzvpwyvkmomex.supabase.co/storage/v1/object/sign/uploads/photo.jpg?token=abc",
                label="race-1-report",
            )
            mock_scrapfly.assert_not_called()
        self.assertEqual(result, (b"raw-bytes", "image/jpeg"))

    @patch("scrapfly_fallback.fetch_image_via_scrapfly", return_value=(b"bytes", "image/jpeg"))
    def test_btcc_net_media_url_uses_scrapfly(self, mock_scrapfly):
        result = fetch_image_smart("https://btcc.net/api/media/abc123", label="race-1-report")
        mock_scrapfly.assert_called_once()
        self.assertEqual(result, (b"bytes", "image/jpeg"))

    @patch("scrapfly_fallback.urllib.request.urlopen", side_effect=RuntimeError("connection reset"))
    def test_supabase_fetch_failure_returns_none_rather_than_raising(self, mock_urlopen):
        result = fetch_image_smart(
            "https://ylxmhtbmzvpwyvkmomex.supabase.co/storage/v1/object/sign/uploads/photo.jpg?token=abc",
            label="race-1-report",
        )
        self.assertIsNone(result)


if __name__ == "__main__":
    unittest.main()
