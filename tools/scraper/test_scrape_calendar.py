#!/usr/bin/env python3
"""
Tests for scrape_calendar.py's date parsing, round ordering, and merge.

Regression coverage: btcc.net's calendar page abbreviates most months to
3 letters ("18 APR") but September to 4 ("5 SEPT") - a real inconsistency
on the live site that silently dropped Croft and Silverstone from every
calendar scrape until caught by testing against the actual rendered page
(2026-07-31 Vercel migration fix).
"""

import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import scrape_calendar as scrape_calendar_module
from scrape_calendar import merge_into_calendar, parse_date_range, scrape_calendar


class TestParseDateRange(unittest.TestCase):
    def test_standard_three_letter_months(self):
        self.assertEqual(
            parse_date_range("18 Apr-19 Apr", 2026),
            ("2026-04-18", "2026-04-19"),
        )

    def test_spaced_dash(self):
        self.assertEqual(
            parse_date_range("6 Jun - 7 Jun", 2026),
            ("2026-06-06", "2026-06-07"),
        )

    def test_four_letter_september_abbreviation(self):
        """Regression: btcc.net uses "SEPT" (4 letters) for September,
        unlike every other month's 3-letter form - this silently dropped
        Croft and Silverstone before the {3,4} widening fix."""
        self.assertEqual(
            parse_date_range("5 SEPT-6 SEPT", 2026),
            ("2026-09-05", "2026-09-06"),
        )

    def test_case_insensitive(self):
        self.assertEqual(
            parse_date_range("10 oct-11 OCT", 2026),
            ("2026-10-10", "2026-10-11"),
        )

    def test_unparseable_text_returns_none(self):
        self.assertIsNone(parse_date_range("TBC", 2026))

    def test_unknown_month_returns_none(self):
        self.assertIsNone(parse_date_range("18 Xyz-19 Xyz", 2026))


class TestScrapeCalendarOrdering(unittest.TestCase):
    """The calendar page's card order is NOT chronological (a grid/layout
    artifact) - scrape_calendar() must sort by date before assigning round
    numbers rather than trusting encounter order."""

    CALENDAR_HTML = """
    <div class="calendar-grid">
      <a class="calendar-card" href="/circuit/thruxton/">
        <div class="calendar-date"><span>25 JUL</span><span class="calendar-date-separator">-</span><span>26 JUL</span></div>
        <h2>Thruxton</h2>
      </a>
      <a class="calendar-card" href="/circuit/donington-park/">
        <div class="calendar-date"><span>18 APR</span><span class="calendar-date-separator">-</span><span>19 APR</span></div>
        <h2>Donington Park</h2>
      </a>
      <a class="calendar-card" href="/circuit/croft/">
        <div class="calendar-date"><span>5 SEPT</span><span class="calendar-date-separator">-</span><span>6 SEPT</span></div>
        <h2>Croft</h2>
      </a>
    </div>
    """

    @patch("scrape_calendar.fetch_via_scrapfly")
    def test_rounds_sorted_chronologically_not_by_dom_order(self, mock_fetch):
        mock_fetch.return_value = self.CALENDAR_HTML
        events = scrape_calendar(2026)
        self.assertEqual([e["venue"] for e in events], ["Donington Park", "Thruxton", "Croft"])
        self.assertEqual([e["round"] for e in events], [1, 2, 3])

    @patch("scrape_calendar.fetch_via_scrapfly")
    def test_september_round_not_dropped(self, mock_fetch):
        mock_fetch.return_value = self.CALENDAR_HTML
        events = scrape_calendar(2026)
        venues = [e["venue"] for e in events]
        self.assertIn("Croft", venues)

    @patch("scrape_calendar.fetch_via_scrapfly", return_value=None)
    def test_returns_none_rather_than_raising_on_fetch_failure(self, mock_fetch):
        self.assertIsNone(scrape_calendar(2026))


class TestScrapeCalendarDeduplication(unittest.TestCase):
    """Regression (2026-08-24): btcc.net rendered every event's card twice -
    a responsive layout puts the same card in two DOM sections, one hidden
    by CSS depending on viewport, both present in the raw HTML this regex
    scans. That doubled every round (10 real rounds -> 20 parsed "events"),
    and merge_into_calendar()'s by-index merge silently overwrote 5 real
    rounds' venue/dates with an earlier round's and dropped the other 5
    entirely - shipped straight to production undetected."""

    DUPED_HTML = """
    <div class="calendar-grid-mobile">
      <a class="calendar-card" href="/circuit/donington-park/">
        <div class="calendar-date"><span>18 APR</span><span>-</span><span>19 APR</span></div>
        <h2>Donington Park</h2>
      </a>
      <a class="calendar-card" href="/circuit/thruxton/">
        <div class="calendar-date"><span>25 JUL</span><span>-</span><span>26 JUL</span></div>
        <h2>Thruxton</h2>
      </a>
    </div>
    <div class="calendar-grid-desktop">
      <a class="calendar-card" href="/circuit/donington-park/">
        <div class="calendar-date"><span>18 APR</span><span>-</span><span>19 APR</span></div>
        <h2>Donington Park</h2>
      </a>
      <a class="calendar-card" href="/circuit/thruxton/">
        <div class="calendar-date"><span>25 JUL</span><span>-</span><span>26 JUL</span></div>
        <h2>Thruxton</h2>
      </a>
    </div>
    """

    @patch("scrape_calendar.fetch_via_scrapfly")
    def test_duplicate_cards_collapsed_to_one_event_each(self, mock_fetch):
        mock_fetch.return_value = self.DUPED_HTML
        events = scrape_calendar(2026)
        self.assertEqual([e["venue"] for e in events], ["Donington Park", "Thruxton"])
        self.assertEqual([e["round"] for e in events], [1, 2])

    @patch("scrape_calendar.fetch_via_scrapfly")
    def test_same_venue_different_dates_not_treated_as_duplicate(self, mock_fetch):
        # Two genuinely different rounds can share a venue (e.g. Donington
        # Park hosts both an early-season National round and a later GP
        # round) - only an exact (venue, startDate, endDate) match is a
        # duplicate card, not a same-venue coincidence.
        mock_fetch.return_value = """
        <a href="/circuit/donington-park/">
          <div class="calendar-date"><span>18 APR</span><span>-</span><span>19 APR</span></div>
          <h2>Donington Park</h2>
        </a>
        <a href="/circuit/donington-park-gp/">
          <div class="calendar-date"><span>22 AUG</span><span>-</span><span>23 AUG</span></div>
          <h2>Donington Park GP</h2>
        </a>
        """
        events = scrape_calendar(2026)
        self.assertEqual(len(events), 2)


class TestMergeIntoCalendarCountMismatch(unittest.TestCase):
    """Regression (2026-08-24): a count mismatch used to print a warning and
    still merge by index (and still exit 0), which is exactly how the
    duplicate-card bug above reached production without
    reportScraperFailure ever firing - that alert only runs `if:
    failure()` in scrape-calendar.yml. A mismatch must now hard-fail instead
    of silently writing partial/misaligned data."""

    def setUp(self):
        self._orig_calendar_json = scrape_calendar_module.CALENDAR_JSON
        self._tmpdir = tempfile.TemporaryDirectory()
        calendar_path = Path(self._tmpdir.name) / "calendar.json"
        calendar_path.write_text(json.dumps({
            "rounds": [
                {"round": 1, "venue": "Donington Park", "startDate": "2026-04-18", "endDate": "2026-04-19"},
                {"round": 2, "venue": "Brands Hatch Indy", "startDate": "2026-05-09", "endDate": "2026-05-10"},
            ]
        }))
        scrape_calendar_module.CALENDAR_JSON = calendar_path
        self._calendar_path = calendar_path

    def tearDown(self):
        scrape_calendar_module.CALENDAR_JSON = self._orig_calendar_json
        self._tmpdir.cleanup()

    def test_exits_nonzero_on_count_mismatch(self):
        schedule = [
            {"round": 1, "venue": "Donington Park", "startDate": "2026-04-18", "endDate": "2026-04-19"},
        ]  # only 1 scraped, calendar.json has 2 rounds
        with self.assertRaises(SystemExit) as ctx:
            merge_into_calendar(schedule, dry_run=False)
        self.assertNotEqual(ctx.exception.code, 0)

    def test_does_not_write_file_on_count_mismatch(self):
        before = self._calendar_path.read_text()
        schedule = [
            {"round": 1, "venue": "Donington Park", "startDate": "2026-04-18", "endDate": "2026-04-19"},
        ]
        with self.assertRaises(SystemExit):
            merge_into_calendar(schedule, dry_run=False)
        self.assertEqual(self._calendar_path.read_text(), before)

    def test_merges_cleanly_when_counts_match(self):
        schedule = [
            {"round": 1, "venue": "Donington Park", "startDate": "2026-04-18", "endDate": "2026-04-19"},
            {"round": 2, "venue": "Brands Hatch Indy", "startDate": "2026-05-10", "endDate": "2026-05-11"},
        ]
        merge_into_calendar(schedule, dry_run=False)
        written = json.loads(self._calendar_path.read_text())
        self.assertEqual(written["rounds"][1]["endDate"], "2026-05-11")


if __name__ == "__main__":
    unittest.main()
