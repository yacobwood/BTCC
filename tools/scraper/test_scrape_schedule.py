#!/usr/bin/env python3
"""
Tests for scrape_schedule.py's session classification.

Regression coverage: this used to independently re-fetch every circuit
page (duplicating scrape_calendar.py, which already fetches the same
pages), doubling load on btcc.net for no reason. Now a pure local
transform of calendar.json's fullTimetable - these tests exercise that
transform directly, with no network involved.
"""

import unittest

from scrape_schedule import classify_btcc_sessions


class TestClassifyBtccSessions(unittest.TestCase):
    FULL_TIMETABLE = [
        {"day": "SAT", "time": "09:00", "series": "Mairon Motorsport MINI CHALLENGE Trophy", "session": "Qualifying", "laps": None},
        {"day": "SAT", "time": "10:25", "series": "Kwik Fit British Touring Car Championship", "session": "Free Practice", "laps": None},
        {"day": "SAT", "time": "14:00", "series": "Kwik Fit British Touring Car Championship", "session": "Qualifying", "laps": None},
        {"day": "SAT", "time": "15:05", "series": "Kwik Fit British Touring Car Championship", "session": "Qualifying Race", "laps": "12"},
        {"day": "SUN", "time": "11:45", "series": "Kwik Fit British Touring Car Championship", "session": "Race", "laps": "16"},
        {"day": "SUN", "time": "13:20", "series": "Kwik Fit British Touring Car Championship", "session": "Race", "laps": "16"},
        {"day": "SUN", "time": "15:00", "series": "Kwik Fit British Touring Car Championship", "session": "Race", "laps": "16"},
    ]

    def test_filters_out_support_series(self):
        sessions = classify_btcc_sessions(self.FULL_TIMETABLE)
        self.assertEqual(len(sessions), 6)  # 6 BTCC rows, 1 Mini Challenge row dropped

    def test_races_numbered_in_order(self):
        sessions = classify_btcc_sessions(self.FULL_TIMETABLE)
        race_names = [s["name"] for s in sessions if s["name"].startswith("Race")]
        self.assertEqual(race_names, ["Race 1", "Race 2", "Race 3"])

    def test_session_names_and_times_preserved(self):
        sessions = classify_btcc_sessions(self.FULL_TIMETABLE)
        by_name = {s["name"]: s for s in sessions}
        self.assertEqual(by_name["Free Practice"]["time"], "10:25")
        self.assertEqual(by_name["Qualifying"]["day"], "SAT")
        self.assertEqual(by_name["Qualifying Race"]["time"], "15:05")

    def test_empty_timetable_yields_no_sessions(self):
        self.assertEqual(classify_btcc_sessions([]), [])

    def test_series_matching_is_case_insensitive(self):
        entries = [{"day": "SAT", "time": "10:00", "series": "KWIK FIT BRITISH TOURING CAR CHAMPIONSHIP", "session": "Free Practice", "laps": None}]
        sessions = classify_btcc_sessions(entries)
        self.assertEqual(len(sessions), 1)


if __name__ == "__main__":
    unittest.main()
