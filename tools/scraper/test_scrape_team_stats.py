#!/usr/bin/env python3
"""Tests for scrape_team_stats.py.

Covers _fetch_team_stats' referer/parsing and main()'s per-team isolation
(one team's fetch failing doesn't abort the rest).

Used to also cover _fetch_team_images (the /teams/ card-background/car-photo
mirror) - removed 2026-08-18 along with that function, when team
cardBgUrl/carImageUrl moved to the hand-curated data/backgroundImages and
data/carImages sets referenced directly from drivers.json instead."""

import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import scrape_team_stats as s
from scrape_team_stats import _fetch_team_stats

TEAM_STATS_HTML = "<strong>150</strong><h3>Races</h3><strong>12</strong><h3>Wins</h3>"


class TestFetchTeamStats(unittest.TestCase):

    @patch("scrape_team_stats.fetch_via_scrapfly", return_value=TEAM_STATS_HTML)
    def test_parses_races_and_wins(self, mock_fetch):
        stats = _fetch_team_stats("napa-racing-uk")
        self.assertEqual(stats, {"races": 150, "wins": 12})

    @patch("scrape_team_stats.fetch_via_scrapfly", return_value=TEAM_STATS_HTML)
    def test_passes_referer_to_the_teams_listing(self, mock_fetch):
        _fetch_team_stats("napa-racing-uk")
        self.assertEqual(mock_fetch.call_args.kwargs.get("referer"), s.TEAMS_LISTING_URL)

    @patch("scrape_team_stats.fetch_via_scrapfly", return_value=None)
    def test_raises_when_fetch_fails(self, mock_fetch):
        with self.assertRaises(RuntimeError):
            _fetch_team_stats("napa-racing-uk")


class TestMainIsolation(unittest.TestCase):

    def _run_main_with(self, teams, fetch_return=TEAM_STATS_HTML):
        with tempfile.TemporaryDirectory() as tmp:
            drivers_path = Path(tmp) / "drivers.json"
            drivers_path.write_text(json.dumps({"teams": teams}))
            with patch.object(s, "DRIVERS_PATH", drivers_path), \
                 patch("scrape_team_stats.fetch_via_scrapfly", return_value=fetch_return):
                s.main()
            return json.loads(drivers_path.read_text())

    def test_team_stats_update_correctly(self):
        result = self._run_main_with([{"name": "NAPA Racing UK", "totalRaces": 0, "totalWins": 0}])
        self.assertEqual(result["teams"][0]["totalRaces"], 150)
        self.assertEqual(result["teams"][0]["totalWins"], 12)

    def test_one_teams_fetch_failure_does_not_abort_the_rest(self):
        result = self._run_main_with(
            [{"name": "NAPA Racing UK", "totalRaces": 5, "totalWins": 1}], fetch_return=None,
        )
        self.assertEqual(result["teams"][0]["totalRaces"], 5)  # unchanged - fetch failed, isolated

    def test_unmapped_team_name_is_skipped_without_error(self):
        result = self._run_main_with([{"name": "Some Unmapped Team", "totalRaces": 0}])
        self.assertEqual(result["teams"][0]["totalRaces"], 0)


if __name__ == "__main__":
    unittest.main()
