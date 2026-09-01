#!/usr/bin/env python3
"""Tests for scrape_btcc_stats.py.

parse_wins/parse_titles/apply_updates had no coverage before this file -
added as a straightforward bonus alongside the actual ask: confirming the
wins and titles fetches are now isolated from each other (previously a
wins-fetch failure sys.exit(1)'d before even attempting titles, so a titles
update was thrown away too even when titles itself fetched fine)."""

import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import scrape_btcc_stats as s
from scrape_btcc_stats import apply_updates, parse_titles, parse_wins

WINS_HTML = "<html><body><p>1. Jason Plato, 97</p><p>=8. Alain Menu, 36</p></body></html>"
TITLES_HTML = (
    "<html><body><table>"
    "<tr><th>Driver</th><th>Years</th><th>Titles</th></tr>"
    "<tr><td>Jason Plato</td><td>2001</td><td>3</td></tr>"
    "</table></body></html>"
)


class TestParseWins(unittest.TestCase):
    def test_parses_plain_and_shared_positions(self):
        self.assertEqual(parse_wins(WINS_HTML), {"Jason Plato": 97, "Alain Menu": 36})


class TestParseTitles(unittest.TestCase):
    def test_parses_row_skipping_header(self):
        self.assertEqual(parse_titles(TITLES_HTML), {"Jason Plato": 3})


class TestApplyUpdates(unittest.TestCase):
    def test_updates_existing_driver_wins_and_titles(self):
        drivers = [{"driver": "Jason Plato", "wins": 90, "starts": 300, "championships": 2}]
        updated, changes = apply_updates(drivers, {"Jason Plato": 97}, {"Jason Plato": 3})
        self.assertEqual(updated[0]["wins"], 97)
        self.assertEqual(updated[0]["championships"], 3)
        self.assertEqual(len(changes), 2)

    def test_adds_new_historical_driver_not_already_present(self):
        updated, changes = apply_updates([], {"Some Historical Driver": 5}, {})
        self.assertEqual(len(updated), 1)
        self.assertEqual(updated[0]["wins"], 5)
        self.assertTrue(updated[0]["historical"])

    def test_no_change_yields_empty_change_log(self):
        drivers = [{"driver": "Jason Plato", "wins": 97, "starts": 300, "championships": 3}]
        _, changes = apply_updates(drivers, {"Jason Plato": 97}, {"Jason Plato": 3})
        self.assertEqual(changes, [])


class TestMainIsolation(unittest.TestCase):
    """Regression coverage for the isolation fix itself - previously a
    wins-fetch failure prevented titles from ever being attempted at all."""

    def _run_main_with(self, initial_drivers, wins_return=None, titles_return=None):
        with tempfile.TemporaryDirectory() as tmp:
            records_path = Path(tmp) / "records.json"
            records_path.write_text(json.dumps({"drivers": initial_drivers}))

            def fake_fetch(url, **kwargs):
                return wins_return if url == s.WINS_URL else titles_return

            with patch.object(s, "RECORDS", records_path), \
                 patch.object(sys, "argv", ["scrape_btcc_stats.py"]), \
                 patch("scrape_btcc_stats.fetch_via_scrapfly", side_effect=fake_fetch) as mock_fetch:
                s.main()
            return json.loads(records_path.read_text()), mock_fetch

    def test_titles_still_applied_when_wins_fetch_fails(self):
        result, _ = self._run_main_with(
            [{"driver": "Jason Plato", "wins": 90, "starts": 300, "championships": 2}],
            wins_return=None, titles_return=TITLES_HTML,
        )
        self.assertEqual(result["drivers"][0]["championships"], 3)   # titles update landed
        self.assertEqual(result["drivers"][0]["wins"], 90)           # wins untouched, not zeroed

    def test_both_fetches_attempted_even_if_first_fails(self):
        # Confirms titles is still fetched (not skipped) after a wins failure.
        _, mock_fetch = self._run_main_with([], wins_return=None, titles_return=TITLES_HTML)
        self.assertEqual([c.args[0] for c in mock_fetch.call_args_list], [s.WINS_URL, s.TITLES_URL])

    def test_exits_nonzero_when_both_fetches_fail(self):
        with self.assertRaises(SystemExit) as ctx:
            self._run_main_with([], wins_return=None, titles_return=None)
        self.assertNotEqual(ctx.exception.code, 0)

    def test_titles_referer_is_the_wins_url(self):
        _, mock_fetch = self._run_main_with([], wins_return=WINS_HTML, titles_return=TITLES_HTML)
        titles_call = next(c for c in mock_fetch.call_args_list if c.args[0] == s.TITLES_URL)
        self.assertEqual(titles_call.kwargs.get("referer"), s.WINS_URL)


if __name__ == "__main__":
    unittest.main()
