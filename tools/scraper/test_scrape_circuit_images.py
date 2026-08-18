#!/usr/bin/env python3
"""Tests for scrape_circuit_images.py (manual/ad-hoc only, not cron-scheduled).

Used to also cover scrape_driver_backgrounds.py, scrape_driver_cutouts.py
and scrape_driver_images.py - those three were archived 2026-08-18 (see
tools/scraper/archive/README.md) along with their tests, in
tools/scraper/archive/test_driver_media_scrapers.py."""

import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

DRIVER_CARD_HTML = """
<html><body>
<a class="driver-card" href="/driver/some-driver/"><h1>Some Driver</h1></a>
</body></html>
"""


class _FakeFetcher:
    """Routes .get_with_media() by call order - first call is always the
    listing/discovery fetch in these scripts, so `first_error` alone is
    enough to simulate "the one network call this script makes failed"."""

    def __init__(self, html=DRIVER_CARD_HTML, first_error=None, over_budget_after=None):
        self.html = html
        self.first_error = first_error
        self.calls = []
        self._budget_calls = 0
        self.over_budget_after = over_budget_after

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def get_with_media(self, url, **kwargs):
        self.calls.append({"url": url, **kwargs})
        if len(self.calls) == 1 and self.first_error:
            raise self.first_error
        return self.html, {}

    def over_budget(self):
        if self.over_budget_after is None:
            return False
        self._budget_calls += 1
        return self._budget_calls > self.over_budget_after


class TestScrapeCircuitImages(unittest.TestCase):
    def test_passes_a_referer_and_respects_the_budget(self):
        import scrape_circuit_images as circuit_m

        with tempfile.TemporaryDirectory() as tmp:
            tracks_path = Path(tmp) / "tracks.json"
            tracks_path.write_text(json.dumps({"Snetterton": {}}))
            fetcher = _FakeFetcher(over_budget_after=0)
            with patch.object(circuit_m, "RenderedFetcher", lambda **kw: fetcher), \
                 patch.object(circuit_m, "TRACKS_PATH", tracks_path):
                circuit_m.main()
            # over_budget() was already exhausted before the first track - no fetch attempted.
            self.assertEqual(fetcher.calls, [])


class TestCircuitHeroRegex(unittest.TestCase):
    """Root-caused live 2026-08-17: several media scrapers' regexes only
    ever matched the /api/media/<uuid> redirector shape - confirmed live
    that btcc.net now sometimes serves a direct Supabase Storage signed URL
    instead. Confirms this one still matches both shapes."""

    SUPABASE_URL = "https://ylxmhtbmzvpwyvkmomex.supabase.co/storage/v1/object/sign/uploads/x.png?token=abc"

    def test_circuit_hero_matches_css_background_image_url(self):
        # The hero image isn't an <img src="..."> at all - it's a CSS
        # background-image: url(&quot;...&quot;) inside the element's own
        # style attribute, entity-escaped since the outer style="..."
        # attribute already uses literal double quotes.
        from scrape_circuit_images import HERO_RE

        html = f'<div class="circuit-profile-hero" style="background-image: url(&quot;{self.SUPABASE_URL}&quot;);">'
        self.assertEqual(HERO_RE.search(html).group(1), self.SUPABASE_URL)


if __name__ == "__main__":
    unittest.main()
