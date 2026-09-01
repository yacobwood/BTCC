#!/usr/bin/env python3
"""Tests for scrape_full_timetable.py - previously had zero coverage at all.

scrape_circuit_timetable() fetches via Scrapfly (see scrapfly_fallback.py)
as of 2026-09-01 rather than local Playwright - the old wait_state=
"attached"/"visible" distinction (needed because #timetable sits in an
inactive tab, confirmed live 2026-08-17) doesn't apply here, since Scrapfly
returns the fully post-JS-render DOM regardless of what's currently
CSS-visible."""

import unittest
from unittest.mock import patch

from scrape_full_timetable import looks_like_series, parse_laps, parse_time, scrape_circuit_timetable

TIMETABLE_HTML = """
<html><body>
<h2>Saturday</h2>
<table id="timetable">
  <tr><td>09:00 – 09:10</td><td>Qualifying</td><td>BTCC</td><td>-</td></tr>
</table>
</body></html>
"""


class TestScrapeCircuitTimetable(unittest.TestCase):

    @patch("scrape_full_timetable.fetch_via_scrapfly", return_value=TIMETABLE_HTML)
    def test_parses_a_saturday_row(self, mock_fetch):
        entries = scrape_circuit_timetable("donington-park")
        self.assertEqual(len(entries), 1)
        self.assertEqual(entries[0]["day"], "SAT")
        self.assertEqual(entries[0]["time"], "09:00")
        self.assertEqual(entries[0]["endTime"], "09:10")
        self.assertEqual(entries[0]["session"], "Qualifying")

    @patch("scrape_full_timetable.fetch_via_scrapfly", return_value=TIMETABLE_HTML)
    def test_passes_referer_to_the_fetcher(self, mock_fetch):
        scrape_circuit_timetable("donington-park", referer="https://btcc.net/calendar/")
        self.assertEqual(mock_fetch.call_args.kwargs.get("referer"), "https://btcc.net/calendar/")

    @patch("scrape_full_timetable.fetch_via_scrapfly", return_value=TIMETABLE_HTML)
    def test_referer_defaults_to_none(self, mock_fetch):
        scrape_circuit_timetable("donington-park")
        self.assertIsNone(mock_fetch.call_args.kwargs.get("referer"))

    @patch("scrape_full_timetable.fetch_via_scrapfly", return_value=None)
    def test_returns_empty_list_rather_than_raising_on_fetch_failure(self, mock_fetch):
        self.assertEqual(scrape_circuit_timetable("donington-park"), [])


class TestParseTime(unittest.TestCase):
    def test_range(self):
        self.assertEqual(parse_time("09:00 – 09:10"), ("09:00", "09:10"))

    def test_single_time(self):
        self.assertEqual(parse_time("11:40"), ("11:40", None))


class TestParseLaps(unittest.TestCase):
    def test_dash_is_none(self):
        self.assertIsNone(parse_laps("-"))

    def test_number_passes_through(self):
        self.assertEqual(parse_laps("12"), "12")


class TestLooksLikeSeries(unittest.TestCase):
    def test_matches_known_marker(self):
        self.assertTrue(looks_like_series("Ginetta GT Academy Championship"))

    def test_does_not_match_plain_session_name(self):
        self.assertFalse(looks_like_series("Race"))


if __name__ == "__main__":
    unittest.main()
