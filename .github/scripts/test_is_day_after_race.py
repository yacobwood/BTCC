"""
Tests for find_round_ending_on() in is_day_after_race.py.

Run with:
    python -m pytest .github/scripts/test_is_day_after_race.py -v
    # or
    python .github/scripts/test_is_day_after_race.py
"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from is_day_after_race import find_round_ending_on
from datetime import date

ROUNDS = [
    {"round": 6, "venue": "Knockhill", "startDate": "2026-08-08", "endDate": "2026-08-09"},
    {"round": 7, "venue": "Donington Park GP", "startDate": "2026-08-22", "endDate": "2026-08-23"},
]


class TestFindRoundEndingOn(unittest.TestCase):
    def test_matches_the_monday_after_a_round(self):
        self.assertEqual(find_round_ending_on(ROUNDS, date(2026, 8, 23)), 7)

    def test_no_match_on_an_ordinary_day(self):
        self.assertIsNone(find_round_ending_on(ROUNDS, date(2026, 8, 15)))

    def test_no_match_on_the_round_start_date(self):
        # startDate (Saturday) isn't the gate - only endDate (Sunday) is.
        self.assertIsNone(find_round_ending_on(ROUNDS, date(2026, 8, 22)))

    def test_handles_malformed_round_entries(self):
        malformed = [{"round": 1, "venue": "X", "startDate": "2026-01-01"}]  # missing endDate
        self.assertIsNone(find_round_ending_on(malformed, date(2026, 1, 2)))


if __name__ == "__main__":
    unittest.main()
