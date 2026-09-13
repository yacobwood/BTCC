#!/usr/bin/env python3
"""Tests for scrape_circuit_images.py (on-demand only, admin panel CIRCUIT
IMAGES card, not cron-scheduled).

Rewritten 2026-09-09 for the script's Scrapfly migration (previously
btcc_playwright.RenderedFetcher, self-hosted-runner era) - modeled on
test_scrape_team_stats.py's own shape, the closest existing analog.

Used to also cover scrape_driver_backgrounds.py, scrape_driver_cutouts.py
and scrape_driver_images.py - those three were archived 2026-08-18 (see
tools/scraper/archive/README.md) along with their tests, in
tools/scraper/archive/test_driver_media_scrapers.py."""

import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import scrape_circuit_images as s

HERO_URL = "https://ylxmhtbmzvpwyvkmomex.supabase.co/storage/v1/object/sign/uploads/hero.png?token=abc"
HERO_HTML = f'<div class="circuit-profile-hero" style="background-image: url(&quot;{HERO_URL}&quot;);">'
NO_HERO_HTML = "<div>no hero here</div>"


class TestMainIsolation(unittest.TestCase):

    def _tracks_json(self, tracks: dict) -> Path:
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        path = Path(tmp.name) / "tracks.json"
        path.write_text(json.dumps(tracks))
        return path

    def test_updates_a_tracks_hero_image_correctly(self):
        path = self._tracks_json({"Snetterton": {"imageUrl": ""}})
        with patch.object(s, "TRACKS_PATH", path), \
             patch.object(s, "TRACK_SLUGS", {"Snetterton": "snetterton"}), \
             patch("scrape_circuit_images.fetch_via_scrapfly", return_value=HERO_HTML), \
             patch("scrape_circuit_images.fetch_image_smart", return_value=(b"bytes", "image/png")), \
             patch("scrape_circuit_images.save_mirrored_image", return_value="hero.png") as mock_save:
            s.main()
        result = json.loads(path.read_text())
        self.assertEqual(result["Snetterton"]["imageUrl"], f"{s.MEDIA_RAW_BASE}/hero.png")
        # save_mirrored_image gets the single on-demand-fetch shape, not a
        # RenderedFetcher-style multi-entry media dict.
        mock_save.assert_called_once_with({HERO_URL: (b"bytes", "image/png")}, HERO_URL, s.MEDIA_DIR)

    def test_a_venue_missing_from_tracks_json_is_skipped_without_error(self):
        path = self._tracks_json({})
        with patch.object(s, "TRACKS_PATH", path), \
             patch.object(s, "TRACK_SLUGS", {"Snetterton": "snetterton"}), \
             patch("scrape_circuit_images.fetch_via_scrapfly") as mock_fetch:
            s.main()  # must not raise
        mock_fetch.assert_not_called()

    def test_one_tracks_page_fetch_failure_does_not_abort_the_rest(self):
        path = self._tracks_json({
            "Snetterton": {"imageUrl": "old"},
            "Thruxton": {"imageUrl": "old"},
        })

        def fake_fetch(url, referer=None, label="", timeout=30, render_js=True, wait_for_selector=None):
            return None if label == "snetterton" else HERO_HTML

        with patch.object(s, "TRACKS_PATH", path), \
             patch.object(s, "TRACK_SLUGS", {"Snetterton": "snetterton", "Thruxton": "thruxton"}), \
             patch("scrape_circuit_images.fetch_via_scrapfly", side_effect=fake_fetch), \
             patch("scrape_circuit_images.fetch_image_smart", return_value=(b"bytes", "image/png")), \
             patch("scrape_circuit_images.save_mirrored_image", return_value="hero.png"):
            s.main()  # must not raise
        result = json.loads(path.read_text())
        self.assertEqual(result["Snetterton"]["imageUrl"], "old")  # unchanged - fetch failed, isolated
        self.assertEqual(result["Thruxton"]["imageUrl"], f"{s.MEDIA_RAW_BASE}/hero.png")

    def test_a_found_url_whose_image_fetch_fails_is_isolated_too(self):
        path = self._tracks_json({"Snetterton": {"imageUrl": "old"}})
        with patch.object(s, "TRACKS_PATH", path), \
             patch.object(s, "TRACK_SLUGS", {"Snetterton": "snetterton"}), \
             patch("scrape_circuit_images.fetch_via_scrapfly", return_value=HERO_HTML), \
             patch("scrape_circuit_images.fetch_image_smart", return_value=None):
            s.main()  # must not raise
        result = json.loads(path.read_text())
        self.assertEqual(result["Snetterton"]["imageUrl"], "old")

    def test_exits_nonzero_when_every_fetched_page_has_no_hero_image(self):
        # Mirrors scrape_team_stats.py's own "fetched fine but parsed
        # nothing" guard - a page that loads but whose markup no longer
        # matches HERO_RE (e.g. btcc.net redesign) is a real structure
        # change worth failing the run over, not silently ignored.
        path = self._tracks_json({"Snetterton": {"imageUrl": "old"}})
        with patch.object(s, "TRACKS_PATH", path), \
             patch.object(s, "TRACK_SLUGS", {"Snetterton": "snetterton"}), \
             patch("scrape_circuit_images.fetch_via_scrapfly", return_value=NO_HERO_HTML):
            with self.assertRaises(SystemExit) as ctx:
                s.main()
            self.assertNotEqual(ctx.exception.code, 0)
        # Fatal before the write - existing good data must survive on disk.
        unchanged = json.loads(path.read_text())
        self.assertEqual(unchanged["Snetterton"]["imageUrl"], "old")

    def test_does_not_exit_when_only_some_tracks_have_no_hero_but_others_do(self):
        path = self._tracks_json({
            "Snetterton": {"imageUrl": "old"},
            "Thruxton": {"imageUrl": "old"},
        })

        def fake_fetch(url, referer=None, label="", timeout=30, render_js=True, wait_for_selector=None):
            return NO_HERO_HTML if label == "snetterton" else HERO_HTML

        with patch.object(s, "TRACKS_PATH", path), \
             patch.object(s, "TRACK_SLUGS", {"Snetterton": "snetterton", "Thruxton": "thruxton"}), \
             patch("scrape_circuit_images.fetch_via_scrapfly", side_effect=fake_fetch), \
             patch("scrape_circuit_images.fetch_image_smart", return_value=(b"bytes", "image/png")), \
             patch("scrape_circuit_images.save_mirrored_image", return_value="hero.png"):
            s.main()  # must not raise
        result = json.loads(path.read_text())
        self.assertEqual(result["Snetterton"]["imageUrl"], "old")
        self.assertEqual(result["Thruxton"]["imageUrl"], f"{s.MEDIA_RAW_BASE}/hero.png")

    def test_passes_the_calendar_referer_and_wait_for_selector(self):
        path = self._tracks_json({"Snetterton": {"imageUrl": "old"}})
        with patch.object(s, "TRACKS_PATH", path), \
             patch.object(s, "TRACK_SLUGS", {"Snetterton": "snetterton"}), \
             patch("scrape_circuit_images.fetch_via_scrapfly", return_value=HERO_HTML) as mock_fetch, \
             patch("scrape_circuit_images.fetch_image_smart", return_value=(b"bytes", "image/png")), \
             patch("scrape_circuit_images.save_mirrored_image", return_value="hero.png"):
            s.main()
        self.assertEqual(mock_fetch.call_args.kwargs.get("referer"), s._CALENDAR_REFERER)
        self.assertEqual(mock_fetch.call_args.kwargs.get("wait_for_selector"), ".circuit-profile-hero")


class TestCircuitHeroRegex(unittest.TestCase):
    """Root-caused live 2026-08-17: several media scrapers' regexes only
    ever matched the /api/media/<uuid> redirector shape - confirmed live
    that btcc.net now sometimes serves a direct Supabase Storage signed URL
    instead. Confirms this one still matches both shapes. Unaffected by the
    2026-09-09 Scrapfly migration - pure regex against rendered HTML either
    way."""

    def test_circuit_hero_matches_css_background_image_url(self):
        from scrape_circuit_images import HERO_RE

        self.assertEqual(HERO_RE.search(HERO_HTML).group(1), HERO_URL)


if __name__ == "__main__":
    unittest.main()
