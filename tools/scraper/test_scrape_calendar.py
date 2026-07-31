#!/usr/bin/env python3
"""
Tests for scrape_calendar.py's date parsing and round ordering.

Regression coverage: btcc.net's calendar page abbreviates most months to
3 letters ("18 APR") but September to 4 ("5 SEPT") - a real inconsistency
on the live site that silently dropped Croft and Silverstone from every
calendar scrape until caught by testing against the actual rendered page
(2026-07-31 Vercel migration fix).
"""

import unittest
from unittest.mock import patch

from scrape_calendar import parse_date_range, scrape_calendar


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

    @patch("scrape_calendar._fetch")
    def test_rounds_sorted_chronologically_not_by_dom_order(self, mock_fetch):
        mock_fetch.return_value = self.CALENDAR_HTML
        events = scrape_calendar(2026)
        self.assertEqual([e["venue"] for e in events], ["Donington Park", "Thruxton", "Croft"])
        self.assertEqual([e["round"] for e in events], [1, 2, 3])

    @patch("scrape_calendar._fetch")
    def test_september_round_not_dropped(self, mock_fetch):
        mock_fetch.return_value = self.CALENDAR_HTML
        events = scrape_calendar(2026)
        venues = [e["venue"] for e in events]
        self.assertIn("Croft", venues)


if __name__ == "__main__":
    unittest.main()
