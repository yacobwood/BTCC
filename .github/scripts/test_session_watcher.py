"""
Tests for load_sessions() and session_to_utc() in session_watcher.py.

Regression coverage for the 2026-09-02 bug: the old load_sessions() read
data/schedule.json expecting rnd["tsl"], rnd["venue"], and rnd["sessions"]
as a dict keyed by "saturday"/"sunday" with per-session suffix/start_utc/
notify flags baked in - none of which schedule.json actually has, so any
real dispatch raised KeyError immediately, before sending any notification.
The fix reads data/calendar.json (tslEventId/venue/sessions are real there)
and derives suffix (from scrape_tsl.py's own SESSION_SUFFIXES) and
start_utc (via session_to_utc) instead of expecting them pre-computed.

Run with:
    python -m pytest .github/scripts/test_session_watcher.py -v
    # or
    python .github/scripts/test_session_watcher.py
"""

import json
import sys
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).parent))
import session_watcher
from session_watcher import load_sessions, session_to_utc

REPO_ROOT = Path(__file__).parent.parent.parent
REAL_CALENDAR = json.loads((REPO_ROOT / "data" / "calendar.json").read_text())


class TestImportSafety(unittest.TestCase):
    """Regression coverage for a real bug found while writing this fix:
    session_watcher.py used to import SESSION_SUFFIXES directly from
    scrape_tsl.py, which parses sys.argv at module level by design (it's
    always invoked as a subprocess, never imported elsewhere in this
    codebase). Importing it under session_watcher's own real argv
    (--round 8 --day saturday) crashed immediately with
    ValueError: invalid literal for int() with base 10: '--round' - this
    module was reimportable in the test file itself, so the crash was
    caught by every other test in this file failing to even collect, not
    a dedicated assertion. Pinned explicitly here so it can't regress
    silently as a "some other test happens to also cover it" situation."""

    def test_importing_session_watcher_survives_a_realistic_argv(self):
        with patch.object(sys, "argv", ["session_watcher.py", "--round", "8", "--day", "saturday"]):
            import importlib
            importlib.reload(session_watcher)


class TestSessionToUTC(unittest.TestCase):

    def test_bst_date_converts_one_hour_back(self):
        # Round 8 (Croft) Saturday, Free Practice at 10:15 local (BST, UTC+1)
        result = session_to_utc("2026-09-05", "10:15")
        self.assertEqual(result, datetime(2026, 9, 5, 9, 15, tzinfo=timezone.utc))

    def test_result_is_timezone_aware_utc(self):
        result = session_to_utc("2026-09-05", "10:15")
        self.assertEqual(result.utcoffset().total_seconds(), 0)

    def test_gmt_date_has_no_offset(self):
        # Outside BST (BTCC's season never actually runs here, but the
        # function itself must still be correct for any date - a hardcoded
        # +1 offset would silently give a wrong answer for a GMT date).
        result = session_to_utc("2026-01-15", "10:15")
        self.assertEqual(result, datetime(2026, 1, 15, 10, 15, tzinfo=timezone.utc))


class TestLoadSessions(unittest.TestCase):

    def _with_calendar(self, calendar):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        data_dir = Path(tmp.name) / "data"
        data_dir.mkdir()
        (data_dir / "calendar.json").write_text(json.dumps(calendar))
        return patch.object(session_watcher, "REPO_ROOT", tmp.name)

    def test_returns_event_id_venue_and_saturday_sessions(self):
        calendar = {"rounds": [{
            "round": 3, "tslEventId": 12345, "venue": "Snetterton",
            "startDate": "2026-05-23", "endDate": "2026-05-24",
            "sessions": [
                {"name": "Free Practice", "day": "SAT", "time": "10:00"},
                {"name": "Race 1", "day": "SUN", "time": "11:00"},
            ],
        }]}
        with self._with_calendar(calendar):
            event_id, venue, sessions = load_sessions(2026, 3, "saturday")
        self.assertEqual(event_id, 12345)
        self.assertEqual(venue, "Snetterton")
        self.assertEqual([s["label"] for s in sessions], ["Free Practice"])

    def test_sunday_uses_end_date_not_start_date(self):
        calendar = {"rounds": [{
            "round": 3, "tslEventId": 12345, "venue": "Snetterton",
            "startDate": "2026-05-23", "endDate": "2026-05-24",
            "sessions": [{"name": "Race 1", "day": "SUN", "time": "11:00"}],
        }]}
        with self._with_calendar(calendar):
            _, _, sessions = load_sessions(2026, 3, "sunday")
        self.assertEqual(sessions[0]["start_utc"].date().isoformat(), "2026-05-24")

    def test_each_session_gets_its_pdf_suffix(self):
        calendar = {"rounds": [{
            "round": 3, "tslEventId": 12345, "venue": "Snetterton",
            "startDate": "2026-05-23", "endDate": "2026-05-24",
            "sessions": [{"name": "Race 2", "day": "SUN", "time": "14:00"}],
        }]}
        with self._with_calendar(calendar):
            _, _, sessions = load_sessions(2026, 3, "sunday")
        self.assertEqual(sessions[0]["suffix"], "rc2")

    def test_unknown_round_exits_rather_than_crashing_on_a_missing_key(self):
        calendar = {"rounds": [{"round": 1, "tslEventId": 1, "venue": "X",
                                 "startDate": "2026-04-18", "endDate": "2026-04-19", "sessions": []}]}
        with self._with_calendar(calendar):
            with self.assertRaises(SystemExit):
                load_sessions(2026, 99, "saturday")

    # ── against this repo's real, live calendar.json ──────────────────────

    def test_real_round_8_croft_saturday_matches_expected_sessions(self):
        rnd = next(r for r in REAL_CALENDAR["rounds"] if r["round"] == 8)
        with patch.object(session_watcher, "REPO_ROOT", str(REPO_ROOT)):
            event_id, venue, sessions = load_sessions(2026, 8, "saturday")
        self.assertEqual(event_id, rnd["tslEventId"])
        self.assertEqual(venue, rnd["venue"])
        self.assertEqual(
            [s["label"] for s in sessions],
            ["Free Practice", "Qualifying", "Qualifying Race"],
        )
        self.assertTrue(all(s["suffix"] for s in sessions))

    def test_real_round_8_croft_sunday_matches_expected_sessions(self):
        with patch.object(session_watcher, "REPO_ROOT", str(REPO_ROOT)):
            _, _, sessions = load_sessions(2026, 8, "sunday")
        self.assertEqual(
            [s["label"] for s in sessions],
            ["Race 1", "Race 2", "Race 3"],
        )
        self.assertTrue(all(s["suffix"] for s in sessions))

    def test_every_real_round_resolves_without_error(self):
        with patch.object(session_watcher, "REPO_ROOT", str(REPO_ROOT)):
            for rnd in REAL_CALENDAR["rounds"]:
                with self.subTest(round=rnd["round"]):
                    event_id, venue, sat_sessions = load_sessions(2026, rnd["round"], "saturday")
                    self.assertEqual(event_id, rnd["tslEventId"])
                    _, _, sun_sessions = load_sessions(2026, rnd["round"], "sunday")
                    # Every real round this season has sessions on both days
                    self.assertTrue(sat_sessions)
                    self.assertTrue(sun_sessions)


if __name__ == "__main__":
    unittest.main()
