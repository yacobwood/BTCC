"""
Tests for find_race_day() in start_race_day.py.

Regression coverage for the 2026-09-02 bug: the old code matched against
data/schedule.json's `saturday_date`/`sunday_date` fields, which never
existed there - every real race Saturday/Sunday this season (confirmed via
live run logs for rounds 6 and 7) silently found no match and did nothing.
The fix reads data/calendar.json's startDate/endDate instead - real data
from this repo is used below (not a hand-built fixture) so a future data
shape change that broke this again would show up here too.

Run with:
    python -m pytest .github/scripts/test_start_race_day.py -v
    # or
    python .github/scripts/test_start_race_day.py
"""

import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from start_race_day import find_race_day

REPO_ROOT = Path(__file__).parent.parent.parent
REAL_CALENDAR = json.loads((REPO_ROOT / "data" / "calendar.json").read_text())


class TestFindRaceDay(unittest.TestCase):

    def test_matches_a_rounds_start_date_as_saturday(self):
        calendar = {"rounds": [{"round": 3, "startDate": "2026-05-23", "endDate": "2026-05-24"}]}
        self.assertEqual(find_race_day(calendar, "2026-05-23"), (3, "saturday"))

    def test_matches_a_rounds_end_date_as_sunday(self):
        calendar = {"rounds": [{"round": 3, "startDate": "2026-05-23", "endDate": "2026-05-24"}]}
        self.assertEqual(find_race_day(calendar, "2026-05-24"), (3, "sunday"))

    def test_no_match_for_a_date_outside_every_round(self):
        calendar = {"rounds": [{"round": 3, "startDate": "2026-05-23", "endDate": "2026-05-24"}]}
        self.assertEqual(find_race_day(calendar, "2026-05-25"), (None, None))

    def test_no_match_on_empty_rounds_list(self):
        self.assertEqual(find_race_day({"rounds": []}, "2026-05-23"), (None, None))

    def test_tolerates_a_round_missing_date_fields_entirely(self):
        # Confirmed live 2026-09-02: this is exactly the shape schedule.json's
        # own "rounds" entries have (round + sessions, no dates at all) - the
        # original bug read that file. A round dict missing startDate/endDate
        # must be skipped, not raise.
        calendar = {"rounds": [{"round": 1, "sessions": []}]}
        self.assertEqual(find_race_day(calendar, "2026-05-23"), (None, None))

    # ── against this repo's real, live calendar.json ──────────────────────

    def test_every_real_round_start_date_resolves_to_saturday(self):
        for rnd in REAL_CALENDAR["rounds"]:
            with self.subTest(round=rnd["round"]):
                self.assertEqual(
                    find_race_day(REAL_CALENDAR, rnd["startDate"]),
                    (rnd["round"], "saturday"),
                )

    def test_every_real_round_end_date_resolves_to_sunday(self):
        for rnd in REAL_CALENDAR["rounds"]:
            with self.subTest(round=rnd["round"]):
                self.assertEqual(
                    find_race_day(REAL_CALENDAR, rnd["endDate"]),
                    (rnd["round"], "sunday"),
                )

    def test_this_weekends_croft_round_resolves_correctly(self):
        # Round 8, Croft, 2026-09-05/06 - the round this fix was found and
        # shipped just ahead of. Pinned explicitly (not just covered by the
        # loop above) so this specific date landing wrong would fail loudly.
        self.assertEqual(find_race_day(REAL_CALENDAR, "2026-09-05"), (8, "saturday"))
        self.assertEqual(find_race_day(REAL_CALENDAR, "2026-09-06"), (8, "sunday"))


if __name__ == "__main__":
    unittest.main()
