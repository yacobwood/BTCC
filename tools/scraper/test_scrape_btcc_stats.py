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


class _FakeRenderedFetcher:
    """Stand-in for `with RenderedFetcher() as fetcher:` - routes by URL so
    one fetch can be scripted to fail while the other succeeds."""

    def __init__(self, wins_html=None, titles_html=None, wins_error=None, titles_error=None):
        self._wins_html = wins_html
        self._titles_html = titles_html
        self._wins_error = wins_error
        self._titles_error = titles_error
        self.calls = []

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def get(self, url, **kwargs):
        self.calls.append({"url": url, **kwargs})
        if url == s.WINS_URL:
            if self._wins_error:
                raise self._wins_error
            return self._wins_html
        if url == s.TITLES_URL:
            if self._titles_error:
                raise self._titles_error
            return self._titles_html
        raise AssertionError(f"unexpected url {url}")


class TestMainIsolation(unittest.TestCase):
    """Regression coverage for the isolation fix itself - previously a
    wins-fetch failure prevented titles from ever being attempted at all."""

    def _run_main_with(self, fetcher, initial_drivers):
        with tempfile.TemporaryDirectory() as tmp:
            records_path = Path(tmp) / "records.json"
            records_path.write_text(json.dumps({"drivers": initial_drivers}))
            with patch.object(s, "RenderedFetcher", lambda **kw: fetcher), \
                 patch.object(s, "RECORDS", records_path), \
                 patch.object(sys, "argv", ["scrape_btcc_stats.py"]):
                s.main()
            return json.loads(records_path.read_text())

    def test_titles_still_applied_when_wins_fetch_fails(self):
        fetcher = _FakeRenderedFetcher(
            wins_error=RuntimeError("HTTP 429 fetching wins"),
            titles_html=TITLES_HTML,
        )
        result = self._run_main_with(fetcher, [{"driver": "Jason Plato", "wins": 90, "starts": 300, "championships": 2}])
        self.assertEqual(result["drivers"][0]["championships"], 3)   # titles update landed
        self.assertEqual(result["drivers"][0]["wins"], 90)           # wins untouched, not zeroed

    def test_both_fetches_attempted_even_if_first_fails(self):
        # Confirms titles is still fetched (not skipped) after a wins failure.
        fetcher = _FakeRenderedFetcher(wins_error=RuntimeError("HTTP 429"), titles_html=TITLES_HTML)
        self._run_main_with(fetcher, [])
        self.assertEqual([c["url"] for c in fetcher.calls], [s.WINS_URL, s.TITLES_URL])

    def test_exits_nonzero_when_both_fetches_fail(self):
        fetcher = _FakeRenderedFetcher(
            wins_error=RuntimeError("HTTP 429"), titles_error=RuntimeError("HTTP 429"),
        )
        with self.assertRaises(SystemExit) as ctx:
            self._run_main_with(fetcher, [])
        self.assertNotEqual(ctx.exception.code, 0)

    def test_titles_referer_is_the_wins_url(self):
        fetcher = _FakeRenderedFetcher(wins_html=WINS_HTML, titles_html=TITLES_HTML)
        self._run_main_with(fetcher, [])
        titles_call = next(c for c in fetcher.calls if c["url"] == s.TITLES_URL)
        self.assertEqual(titles_call["referer"], s.WINS_URL)


if __name__ == "__main__":
    unittest.main()
