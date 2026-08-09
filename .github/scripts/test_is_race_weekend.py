"""
Tests for compute_session_windows() in is_race_weekend.py.

Covers the key invariant introduced to catch TSL grid PDF amendments:
windows stay active for their full duration even after results are committed.

Run with:
    python -m pytest .github/scripts/test_is_race_weekend.py -v
    # or
    python .github/scripts/test_is_race_weekend.py
"""

import sys
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from is_race_weekend import compute_session_windows


# BST sessions used across tests: Race 3 at 16:00 BST = 15:00 UTC
# Window opens 15:15 UTC, closes 16:30 UTC
R3_SESSION = [{"name": "Race 3", "day": "SUN", "time": "16:00"}]


def utc(h, m):
    return datetime(2026, 6, 8, h, m, tzinfo=timezone.utc)


class TestComputeSessionWindows(unittest.TestCase):

    # ── basic window boundaries ───────────────────────────────────────────────

    def test_active_inside_window(self):
        windows = compute_session_windows(utc(15, 30), R3_SESSION, already_scraped=set())
        self.assertTrue(windows[0]["active"])

    def test_inactive_before_window_opens(self):
        # 15:14 UTC — window not open yet (opens 15:15)
        windows = compute_session_windows(utc(15, 14), R3_SESSION, already_scraped=set())
        self.assertFalse(windows[0]["active"])

    def test_inactive_after_window_closes(self):
        # 16:31 UTC — window closed at 16:30
        windows = compute_session_windows(utc(16, 31), R3_SESSION, already_scraped=set())
        self.assertFalse(windows[0]["active"])

    def test_active_at_window_start_boundary(self):
        windows = compute_session_windows(utc(15, 15), R3_SESSION, already_scraped=set())
        self.assertTrue(windows[0]["active"])

    def test_active_at_window_end_boundary(self):
        windows = compute_session_windows(utc(16, 30), R3_SESSION, already_scraped=set())
        self.assertTrue(windows[0]["active"])

    # ── grid amendment scenario ───────────────────────────────────────────────

    def test_window_stays_active_after_results_committed(self):
        # Core fail-safe: results committed mid-window must NOT close the window.
        # TSL may amend the grid PDF after results land; we need to keep re-fetching.
        already_scraped = {"Race 3"}
        windows = compute_session_windows(utc(16, 0), R3_SESSION, already_scraped=already_scraped)
        w = windows[0]
        self.assertTrue(w["scraped"])
        self.assertTrue(w["active"],
            "Window must stay active after results commit so grid amendments are picked up")

    def test_scraped_flag_reflects_committed_results(self):
        already_scraped = {"Race 3"}
        windows = compute_session_windows(utc(15, 30), R3_SESSION, already_scraped=already_scraped)
        self.assertTrue(windows[0]["scraped"])

    def test_scraped_false_when_no_results_committed(self):
        windows = compute_session_windows(utc(15, 30), R3_SESSION, already_scraped=set())
        self.assertFalse(windows[0]["scraped"])

    # ── multi-session Sunday ─────────────────────────────────────────────────

    def test_multiple_sessions_only_active_one_in_window(self):
        # Race 1 at 10:20 BST, Race 2 at 11:55 BST, Race 3 at 16:00 BST
        sessions = [
            {"name": "Race 1", "day": "SUN", "time": "10:20"},
            {"name": "Race 2", "day": "SUN", "time": "11:55"},
            {"name": "Race 3", "day": "SUN", "time": "16:00"},
        ]
        # 15:30 UTC is inside Race 3 window only
        windows = compute_session_windows(utc(15, 30), sessions, already_scraped=set())
        active = [w["label"] for w in windows if w["active"]]
        self.assertEqual(active, ["Race 3"])

    def test_in_session_window_true_when_any_active(self):
        sessions = [
            {"name": "Race 2", "day": "SUN", "time": "11:55"},
            {"name": "Race 3", "day": "SUN", "time": "16:00"},
        ]
        windows = compute_session_windows(utc(15, 30), sessions, already_scraped={"Race 2", "Race 3"})
        # Race 3 results committed but window open (15:15–16:30); 15:30 is inside
        in_window = any(w["active"] for w in windows)
        self.assertTrue(in_window)

    def test_all_windows_closed_outside_any_session(self):
        sessions = [
            {"name": "Race 1", "day": "SUN", "time": "10:20"},
            {"name": "Race 2", "day": "SUN", "time": "11:55"},
        ]
        # 14:00 UTC — between Race 2 close (13:25) and any Race 3 window
        windows = compute_session_windows(utc(14, 0), sessions, already_scraped=set())
        self.assertFalse(any(w["active"] for w in windows))

    # ── grid published early (reg 3.4.1.a/b) ────────────────────────────────────
    #
    # A grid-bearing session's official grid PDF is published as soon as the
    # preceding session finishes, normally hours before the grid-bearing session
    # itself starts. The window must open then, not wait for the session's own
    # start time - otherwise the grid is only ever fetched after that race has
    # already begun.

    def test_race_1_window_opens_early_once_qualifying_race_is_scraped(self):
        # Race 1 at 11:30 BST = 10:30 UTC — own window would be 10:45–12:00 UTC.
        # Qualifying Race already committed (e.g. run the evening before) — the
        # Race 1 grid should already be fetchable well before 10:45.
        sessions = [{"name": "Race 1", "day": "SUN", "time": "11:30"}]
        windows = compute_session_windows(utc(9, 0), sessions, already_scraped={"Qualifying Race"})
        self.assertTrue(windows[0]["active"],
            "Race 1 grid window must open once Qualifying Race is committed, not wait for Race 1's own start")

    def test_race_1_window_stays_closed_before_qualifying_race_is_scraped(self):
        # Same time, but Qualifying Race hasn't landed yet — nothing to fetch early for.
        sessions = [{"name": "Race 1", "day": "SUN", "time": "11:30"}]
        windows = compute_session_windows(utc(9, 0), sessions, already_scraped=set())
        self.assertFalse(windows[0]["active"])

    def test_early_grid_window_still_respects_upper_bound(self):
        # Qualifying Race committed, but we're now past Race 1's own w_end (12:00 UTC) -
        # should not stay active forever.
        sessions = [{"name": "Race 1", "day": "SUN", "time": "11:30"}]
        windows = compute_session_windows(utc(12, 1), sessions, already_scraped={"Qualifying Race"})
        self.assertFalse(windows[0]["active"])

    def test_race_2_and_race_3_also_open_early_from_their_own_precedent(self):
        sessions = [
            {"name": "Race 1", "day": "SUN", "time": "10:20"},
            {"name": "Race 2", "day": "SUN", "time": "11:55"},
            {"name": "Race 3", "day": "SUN", "time": "16:00"},
        ]
        # 09:00 UTC: well before any session's own window, but Race 1 has already
        # run (its grid was itself opened early by the same mechanism) - Race 2's
        # grid should already be fetchable; Race 3's should not (Race 2 not run yet).
        windows = compute_session_windows(utc(9, 0), sessions, already_scraped={"Qualifying Race", "Race 1"})
        active = {w["label"] for w in windows if w["active"]}
        self.assertIn("Race 2", active)
        self.assertNotIn("Race 3", active)

    def test_qualifying_has_no_preceding_grid_session(self):
        # "Qualifying" isn't a grid-bearing session (no entry in PRECEDING_SESSION) -
        # committing Free Practice results must not open an early window for it.
        sessions = [{"name": "Qualifying", "day": "SAT", "time": "10:00"}]
        windows = compute_session_windows(utc(8, 0), sessions, already_scraped={"Free Practice"})
        self.assertFalse(windows[0]["active"])


if __name__ == "__main__":
    unittest.main()
