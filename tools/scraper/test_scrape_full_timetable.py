#!/usr/bin/env python3
"""Tests for scrape_full_timetable.py - previously had zero coverage at all.

scrape_circuit_timetable() used to fetch via fetch_rendered() (a one-off
helper that opens a brand-new browser, plus its own 0-45s startup jitter,
every single call) - called once per round from scrape_calendar.py's loop,
so a routine 10-round run opened up to 10 separate browser sessions just for
this step. Fixed by taking a shared RenderedFetcher instance instead - these
tests confirm the call shape (fetcher.get with the right selector/referer),
not the real network behavior.
"""

import unittest

from scrape_full_timetable import looks_like_series, parse_laps, parse_time, scrape_circuit_timetable

TIMETABLE_HTML = """
<html><body>
<h2>Saturday</h2>
<table id="timetable">
  <tr><td>09:00 – 09:10</td><td>Qualifying</td><td>BTCC</td><td>-</td></tr>
</table>
</body></html>
"""


class FakeFetcher:
    """Minimal stand-in for RenderedFetcher - scrape_circuit_timetable only
    ever calls .get(url, **kwargs), matching the FakeFetcher convention used
    elsewhere in this test suite (see test_scrape_calendar.py)."""
    def __init__(self, html):
        self.html = html
        self.calls = []

    def get(self, url, **kwargs):
        self.calls.append({"url": url, **kwargs})
        return self.html


class TestScrapeCircuitTimetable(unittest.TestCase):

    def test_parses_a_saturday_row(self):
        entries = scrape_circuit_timetable(FakeFetcher(TIMETABLE_HTML), "donington-park")
        self.assertEqual(len(entries), 1)
        self.assertEqual(entries[0]["day"], "SAT")
        self.assertEqual(entries[0]["time"], "09:00")
        self.assertEqual(entries[0]["endTime"], "09:10")
        self.assertEqual(entries[0]["session"], "Qualifying")

    def test_passes_wait_selector_and_referer_to_the_fetcher(self):
        fetcher = FakeFetcher(TIMETABLE_HTML)
        scrape_circuit_timetable(fetcher, "donington-park", referer="https://btcc.net/calendar/")
        self.assertEqual(fetcher.calls[0]["wait_selector"], "#timetable")
        self.assertEqual(fetcher.calls[0]["referer"], "https://btcc.net/calendar/")

    def test_waits_for_attached_not_visible(self):
        # Root-caused live 2026-08-17: #timetable sits in an inactive tab and
        # never becomes CSS-visible without a click, even though the content
        # is already present in the DOM this parser reads from.
        fetcher = FakeFetcher(TIMETABLE_HTML)
        scrape_circuit_timetable(fetcher, "donington-park")
        self.assertEqual(fetcher.calls[0]["wait_state"], "attached")

    def test_referer_defaults_to_none(self):
        fetcher = FakeFetcher(TIMETABLE_HTML)
        scrape_circuit_timetable(fetcher, "donington-park")
        self.assertIsNone(fetcher.calls[0]["referer"])

    def test_returns_empty_list_rather_than_raising_on_fetch_failure(self):
        class _RaisingFetcher:
            def get(self, url, **kwargs):
                raise RuntimeError("HTTP 429 fetching https://btcc.net/circuit/donington-park/")

        self.assertEqual(scrape_circuit_timetable(_RaisingFetcher(), "donington-park"), [])


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
