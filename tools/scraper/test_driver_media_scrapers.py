#!/usr/bin/env python3
"""Tests for the four mechanically-similar image/media scrapers that aren't
cron-scheduled (manual/ad-hoc only): scrape_driver_backgrounds.py,
scrape_driver_cutouts.py, scrape_circuit_images.py, scrape_driver_images.py.
None had any coverage before this file - lightweight, proportionate to how
rarely they actually run: confirms a previously-unguarded top-level/
discovery fetch now exits cleanly (not an unhandled traceback) on failure,
and that referer is passed where a real listing->detail relationship
exists."""

import json
import sys
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


class TestScrapeDriverBackgrounds(unittest.TestCase):
    def test_exits_cleanly_rather_than_raising_when_the_listing_fetch_fails(self):
        import scrape_driver_backgrounds as m

        with tempfile.TemporaryDirectory() as tmp:
            drivers_path = Path(tmp) / "drivers.json"
            drivers_path.write_text(json.dumps({"drivers": []}))
            fetcher = _FakeFetcher(first_error=RuntimeError("HTTP 429 fetching /drivers/"))
            with patch.object(m, "RenderedFetcher", lambda **kw: fetcher), \
                 patch.object(m, "DRIVERS_PATH", drivers_path):
                with self.assertRaises(SystemExit) as ctx:
                    m.main()
                self.assertNotEqual(ctx.exception.code, 0)


class TestScrapeDriverCutouts(unittest.TestCase):
    def test_exits_cleanly_when_discovery_fetch_fails(self):
        import scrape_driver_cutouts as m

        with tempfile.TemporaryDirectory() as tmp:
            drivers_path = Path(tmp) / "drivers.json"
            drivers_path.write_text(json.dumps({"drivers": []}))
            images_dir = Path(tmp) / "images"
            images_dir.mkdir()
            fetcher = _FakeFetcher(first_error=RuntimeError("HTTP 429 fetching /drivers/"))
            with patch.object(m, "RenderedFetcher", lambda **kw: fetcher), \
                 patch.object(m, "DRIVERS_PATH", drivers_path), \
                 patch.object(m, "IMAGES_DIR", images_dir):
                with self.assertRaises(SystemExit) as ctx:
                    m.main()
                self.assertNotEqual(ctx.exception.code, 0)

    def test_passes_referer_to_the_per_driver_cutout_fetch(self):
        import scrape_driver_cutouts as m

        with tempfile.TemporaryDirectory() as tmp:
            images_dir = Path(tmp) / "images"
            images_dir.mkdir()
            (images_dir / "5.webp").write_bytes(b"")  # bundled_numbers = {5}
            drivers_path = Path(tmp) / "drivers.json"
            drivers_path.write_text(json.dumps({"drivers": [{"name": "Some Driver", "number": 5}]}))
            fetcher = _FakeFetcher(html='<img src="/driver/some-driver/"><a class="driver-card" '
                                        'href="/driver/some-driver/"><h1>Some Driver</h1></a>')
            with patch.object(m, "RenderedFetcher", lambda **kw: fetcher), \
                 patch.object(m, "DRIVERS_PATH", drivers_path), \
                 patch.object(m, "IMAGES_DIR", images_dir):
                m.main()
            # calls[0] = discovery, calls[1] = the per-driver cutout fetch
            self.assertEqual(fetcher.calls[1]["referer"], m.DRIVERS_LISTING_URL)


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


class TestScrapeDriverImages(unittest.TestCase):
    def test_passes_referer_to_the_per_driver_fetch(self):
        import scrape_driver_images as m

        with tempfile.TemporaryDirectory() as tmp:
            drivers_path = Path(tmp) / "drivers.json"
            drivers_path.write_text(json.dumps({"drivers": [{"name": "Ryan Bensley"}]}))
            fetcher = _FakeFetcher()
            with patch.object(m, "RenderedFetcher", lambda **kw: fetcher), \
                 patch.object(m, "DRIVERS_PATH", drivers_path):
                m.main()
            self.assertEqual(fetcher.calls[0]["referer"], "https://btcc.net/drivers/")


class TestDualShapeMediaRegexes(unittest.TestCase):
    """Root-caused live 2026-08-17: several of these scripts' media regexes
    only ever matched the /api/media/<uuid> redirector shape - confirmed
    live that btcc.net now sometimes serves a direct Supabase Storage
    signed URL instead (driver-card backgrounds, team-card backgrounds/car
    photos, driver profile cutouts all observed doing this), which every
    one of these regexes was silently failing to match at all. Confirms
    each now matches both shapes, using real fixture HTML shaped like what
    was actually observed live, not hypothetical examples."""

    SUPABASE_URL = "https://ylxmhtbmzvpwyvkmomex.supabase.co/storage/v1/object/sign/uploads/x.png?token=abc"

    def test_driver_card_bg_matches_old_and_new_shape(self):
        from scrape_driver_backgrounds import CARD_BG_RE

        old = f'<span class="driver-card-background"><img src="/api/media/abc123"></span>'
        new = f'<span class="driver-card-background"><img src="{self.SUPABASE_URL}"></span>'
        self.assertEqual(CARD_BG_RE.search(old).group(1), "/api/media/abc123")
        self.assertEqual(CARD_BG_RE.search(new).group(1), self.SUPABASE_URL)

    def test_driver_profile_cutout_matches_old_and_new_shape(self):
        from scrape_driver_cutouts import CUTOUT_RE

        old = f'<img class="driver-profile-cutout" alt="" src="/api/media/abc123">'
        new = f'<img class="driver-profile-cutout" alt="" src="{self.SUPABASE_URL}">'
        self.assertEqual(CUTOUT_RE.search(old).group(1), "/api/media/abc123")
        self.assertEqual(CUTOUT_RE.search(new).group(1), self.SUPABASE_URL)

    def test_team_card_bg_and_car_match_old_and_new_shape(self):
        from scrape_team_stats import TEAM_CARD_BG_RE, TEAM_CARD_CAR_RE

        new = f'<span class="team-card-background"><img src="{self.SUPABASE_URL}"></span>'
        self.assertEqual(TEAM_CARD_BG_RE.search(new).group(1), self.SUPABASE_URL)
        new_car = f'<span class="team-card-logo"><img src="{self.SUPABASE_URL}"></span>'
        self.assertEqual(TEAM_CARD_CAR_RE.search(new_car).group(1), self.SUPABASE_URL)

    def test_circuit_hero_matches_css_background_image_url(self):
        # Root-caused live 2026-08-17: the hero image isn't an <img src="...">
        # at all - it's a CSS background-image: url(&quot;...&quot;) inside
        # the element's own style attribute, entity-escaped since the outer
        # style="..." attribute already uses literal double quotes.
        from scrape_circuit_images import HERO_RE

        html = f'<div class="circuit-profile-hero" style="background-image: url(&quot;{self.SUPABASE_URL}&quot;);">'
        self.assertEqual(HERO_RE.search(html).group(1), self.SUPABASE_URL)


if __name__ == "__main__":
    unittest.main()
