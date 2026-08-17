#!/usr/bin/env python3
"""Tests for scrape_team_stats.py - previously had zero coverage.

Two real gaps this closes: (1) _fetch_team_images (the /teams/ discovery
fetch) had no isolation at all - any failure crashed the whole script, even
though the per-team stats loop below it is an independently valuable data
source; (2) _fetch_team_stats never passed a referer despite following
directly from the /teams/ listing it just fetched."""

import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import scrape_team_stats as s
from scrape_team_stats import _fetch_team_stats

TEAM_STATS_HTML = "<strong>150</strong><h3>Races</h3><strong>12</strong><h3>Wins</h3>"


class FakeFetcher:
    def __init__(self, images_html="<html></html>", images_error=None, stats_html=TEAM_STATS_HTML, over_budget_after=None):
        self.images_html = images_html
        self.images_error = images_error
        self.stats_html = stats_html
        self.get_calls = []
        self._budget_calls = 0
        self.over_budget_after = over_budget_after

    def get_with_media(self, url, **kwargs):
        if self.images_error:
            raise self.images_error
        return self.images_html, {}

    def get(self, url, **kwargs):
        self.get_calls.append({"url": url, **kwargs})
        return self.stats_html

    def over_budget(self):
        if self.over_budget_after is None:
            return False
        self._budget_calls += 1
        return self._budget_calls > self.over_budget_after

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


class TestFetchTeamStats(unittest.TestCase):
    def test_parses_races_and_wins(self):
        fetcher = FakeFetcher()
        stats = _fetch_team_stats(fetcher, "napa-racing-uk")
        self.assertEqual(stats, {"races": 150, "wins": 12})

    def test_passes_referer_to_the_teams_listing(self):
        fetcher = FakeFetcher()
        _fetch_team_stats(fetcher, "napa-racing-uk")
        self.assertEqual(fetcher.get_calls[0]["referer"], s.TEAMS_LISTING_URL)


class TestMainIsolationAndBudget(unittest.TestCase):

    def _run_main_with(self, fetcher, teams):
        with tempfile.TemporaryDirectory() as tmp:
            drivers_path = Path(tmp) / "drivers.json"
            drivers_path.write_text(json.dumps({"teams": teams}))
            with patch.object(s, "RenderedFetcher", lambda **kw: fetcher), \
                 patch.object(s, "DRIVERS_PATH", drivers_path):
                s.main()
            return json.loads(drivers_path.read_text())

    def test_team_stats_still_update_when_image_discovery_fails(self):
        fetcher = FakeFetcher(images_error=RuntimeError("HTTP 429 fetching /teams/"))
        result = self._run_main_with(fetcher, [{"name": "NAPA Racing UK", "totalRaces": 0, "totalWins": 0}])
        self.assertEqual(result["teams"][0]["totalRaces"], 150)
        self.assertEqual(result["teams"][0]["totalWins"], 12)
        # No image data to apply, but that must not have blocked the stats update.
        self.assertEqual(result["teams"][0].get("carImageUrl"), "")

    def test_over_budget_stops_the_per_team_loop(self):
        # over_budget_after=0: the very first check inside the loop already
        # reports exhausted, so the team is skipped entirely (stats untouched).
        fetcher = FakeFetcher(over_budget_after=0)
        result = self._run_main_with(
            fetcher, [{"name": "NAPA Racing UK", "totalRaces": 5, "totalWins": 1}]
        )
        self.assertEqual(result["teams"][0]["totalRaces"], 5)  # unchanged - loop broke before fetching
        self.assertEqual(len(fetcher.get_calls), 0)

    def test_unmapped_team_name_is_skipped_without_error(self):
        fetcher = FakeFetcher()
        result = self._run_main_with(fetcher, [{"name": "Some Unmapped Team", "totalRaces": 0}])
        self.assertEqual(result["teams"][0]["totalRaces"], 0)


if __name__ == "__main__":
    unittest.main()
