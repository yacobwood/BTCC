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

from media_utils import MEDIA_SRC_RE_FRAGMENT, resolve_media_url, save_mirrored_image

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

    def test_unwraps_next_js_image_optimization_proxy(self):
        """Regression coverage: confirmed live 2026-09-02, btcc.net's
        news-card markup switched to Next.js's own <Image> component, which
        wraps the real /api/media/<uuid> URL as a url= query param on
        /_next/image/? instead of linking it directly - this was silently
        producing zero images for every card (IMAGE_RE simply didn't match
        the new shape at all) until both the regex and this unwrap were
        added. Uses the exact real captured markup, HTML-entity-escaped
        &amp;s and all - not a simplified fixture."""
        proxy_url = (
            "https://btcc.net/_next/image/?url=%2Fapi%2Fmedia%2F87f9a9c2-1e0e-496a-8c98-95ccbb686bee"
            "%3Fimage-optimizer%3D1&amp;w=1920&amp;q=75&amp;dpl=dpl_5Y8w8WJXhB4gZeZAKpLAsoKwLtg2"
        )
        self.assertEqual(
            resolve_media_url(proxy_url),
            "https://btcc.net/api/media/87f9a9c2-1e0e-496a-8c98-95ccbb686bee?image-optimizer=1",
        )


class TestMediaSrcReFragment(unittest.TestCase):
    """The regex needs to actually match the new proxy shape in a real <img>
    tag - a passing resolve_media_url test alone doesn't prove IMAGE_RE
    (which wraps this fragment) ever captures it in the first place."""

    def _search(self, html):
        import re
        return re.search(r'<img[^>]*src="(' + MEDIA_SRC_RE_FRAGMENT + r')"', html)

    def test_matches_the_next_js_proxy_shape(self):
        html = (
            '<img src="https://btcc.net/_next/image/?url=%2Fapi%2Fmedia%2Fabc123'
            '&amp;w=1920&amp;q=75&amp;dpl=dpl_xyz">'
        )
        m = self._search(html)
        self.assertIsNotNone(m)
        self.assertTrue(m.group(1).startswith("https://btcc.net/_next/image/?url="))

    def test_still_matches_the_old_direct_shape(self):
        m = self._search('<img src="/api/media/abc123">')
        self.assertEqual(m.group(1), "/api/media/abc123")

    def test_still_matches_supabase_shape(self):
        url = "https://x.supabase.co/storage/v1/object/sign/photo.jpg?token=abc"
        m = self._search(f'<img src="{url}">')
        self.assertEqual(m.group(1), url)


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
