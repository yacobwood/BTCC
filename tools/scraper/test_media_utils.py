#!/usr/bin/env python3
"""Tests for media_utils.py - split out of btcc_playwright.py on 2026-09-01
specifically so scrape_news.py/scrape_articles.py can use these without also
importing Playwright (see the module's own docstring - that unconditional
import broke live on GitHub-hosted ubuntu-latest right after the Scrapfly
migration: ModuleNotFoundError for PIL, which was only ever installed
because RenderedFetcher needed it, not these pure-Python helpers). Confirms
the module itself imports cleanly with just Pillow - no Playwright - since
that's the entire point of the split, not something the tests below exercise
directly (they run in this dev venv where both happen to be installed)."""

import tempfile
import unittest
from pathlib import Path

from media_utils import resolve_media_url, save_mirrored_image

# A 2x2 red PNG, small enough to embed as a literal.
_TINY_PNG = bytes.fromhex(
    "89504e470d0a1a0a0000000d494844520000000200000002080600000072b60d24"
    "0000001a4944415478da6364606060f80f0409068180313000d1000000000049454e44ae426082"
)


class TestResolveMediaUrl(unittest.TestCase):
    def test_prefixes_btcc_net_onto_a_relative_path(self):
        self.assertEqual(resolve_media_url("/api/media/abc123"), "https://btcc.net/api/media/abc123")

    def test_leaves_an_already_absolute_url_unchanged(self):
        url = "https://x.supabase.co/storage/v1/object/sign/photo.jpg?token=abc"
        self.assertEqual(resolve_media_url(url), url)


class TestSaveMirroredImage(unittest.TestCase):
    def test_returns_none_when_media_url_is_falsy(self):
        with tempfile.TemporaryDirectory() as tmp:
            self.assertIsNone(save_mirrored_image({}, None, Path(tmp)))

    def test_returns_none_when_url_was_not_captured(self):
        with tempfile.TemporaryDirectory() as tmp:
            self.assertIsNone(save_mirrored_image({}, "https://btcc.net/api/media/abc123", Path(tmp)))

    def test_saves_bytes_and_derives_extension_from_content_type(self):
        with tempfile.TemporaryDirectory() as tmp:
            out_dir = Path(tmp)
            media = {"https://btcc.net/api/media/abc123": (_TINY_PNG, "image/png")}
            filename = save_mirrored_image(media, "https://btcc.net/api/media/abc123", out_dir)
            self.assertEqual(filename, "abc123.png")
            self.assertTrue((out_dir / filename).exists())

    def test_strips_query_string_and_existing_extension_from_supabase_url(self):
        with tempfile.TemporaryDirectory() as tmp:
            out_dir = Path(tmp)
            url = "https://x.supabase.co/storage/v1/object/sign/uploads/photo.jpg?token=abc123"
            media = {url: (_TINY_PNG, "image/jpeg")}
            filename = save_mirrored_image(media, url, out_dir)
            # "photo.jpg" (query stripped) -> stem "photo" + derived ".jpg",
            # not "photo.jpg.jpg".
            self.assertEqual(filename, "photo.jpg")

    def test_small_image_is_written_unchanged(self):
        with tempfile.TemporaryDirectory() as tmp:
            out_dir = Path(tmp)
            media = {"url": (_TINY_PNG, "image/png")}
            filename = save_mirrored_image(media, "url", out_dir)
            self.assertEqual((out_dir / filename).read_bytes(), _TINY_PNG)

    def test_malformed_bytes_are_written_verbatim_rather_than_crashing(self):
        with tempfile.TemporaryDirectory() as tmp:
            out_dir = Path(tmp)
            media = {"url": (b"not a real image", "image/jpeg")}
            filename = save_mirrored_image(media, "url", out_dir)
            self.assertEqual((out_dir / filename).read_bytes(), b"not a real image")


if __name__ == "__main__":
    unittest.main()
