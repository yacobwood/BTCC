"""
Tests for the Race 3 grid-order notification helpers in session_watcher.py.

Covers the key invariant this feature is built around: Race 3's grid needs
both Race 2's finishing order AND a separately-timed reversal-count draw
(BTCC reg 3.4.1.b) - so "grid ready" must check Race 3's own `grid` field,
not just whether Race 2 has results.

Run with:
    python -m pytest .github/scripts/test_session_watcher.py -v
    # or
    python .github/scripts/test_session_watcher.py

Requires websocket-client installed (session_watcher.py imports it at
module level) - see .github/workflows/session-watcher.yml's pip install
step for the same dependency in CI.
"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from session_watcher import find_race3, race3_grid_ready, race3_pole_sitter


def make_results(round_num=5, races=None):
    return {"rounds": [{"round": round_num, "races": races or []}]}


class TestFindRace3(unittest.TestCase):

    def test_finds_race3_by_label_within_the_matching_round(self):
        race3 = {"label": "Race 3", "grid": []}
        data = make_results(5, [{"label": "Race 2", "grid": []}, race3])
        self.assertIs(find_race3(data, 5), race3)

    def test_returns_none_when_round_not_found(self):
        data = make_results(5, [{"label": "Race 3", "grid": []}])
        self.assertIsNone(find_race3(data, 6))

    def test_returns_none_when_round_has_no_race3(self):
        data = make_results(5, [{"label": "Race 2", "grid": []}])
        self.assertIsNone(find_race3(data, 5))

    def test_returns_none_on_empty_rounds_list(self):
        self.assertIsNone(find_race3({"rounds": []}, 5))

    def test_returns_none_on_missing_rounds_key(self):
        self.assertIsNone(find_race3({}, 5))


class TestRace3GridReady(unittest.TestCase):

    def test_false_when_race3_has_no_grid_field_at_all(self):
        # This is the exact scenario the feature exists for: Race 2's
        # finishing order is in, but Race 3's grid (which needs the
        # separately-drawn reversal count too) hasn't been published yet.
        data = make_results(5, [{"label": "Race 3", "results": [{"driver": "X"}]}])
        self.assertFalse(race3_grid_ready(data, 5))

    def test_false_when_grid_is_an_empty_list(self):
        data = make_results(5, [{"label": "Race 3", "grid": []}])
        self.assertFalse(race3_grid_ready(data, 5))

    def test_true_when_grid_is_populated(self):
        data = make_results(5, [{"label": "Race 3", "grid": [{"pos": 1, "driver": "Tom Chilton"}]}])
        self.assertTrue(race3_grid_ready(data, 5))

    def test_false_when_race3_does_not_exist_yet(self):
        data = make_results(5, [{"label": "Race 2", "grid": [{"pos": 1, "driver": "X"}]}])
        self.assertFalse(race3_grid_ready(data, 5))


class TestRace3PoleSitter(unittest.TestCase):

    def test_returns_driver_at_grid_position_1(self):
        grid = [
            {"pos": 2, "driver": "Ash Sutton"},
            {"pos": 1, "driver": "Tom Chilton"},
            {"pos": 3, "driver": "Adam Morgan"},
        ]
        data = make_results(5, [{"label": "Race 3", "grid": grid}])
        self.assertEqual(race3_pole_sitter(data, 5), "Tom Chilton")

    def test_none_when_grid_not_published(self):
        data = make_results(5, [{"label": "Race 3", "grid": []}])
        self.assertIsNone(race3_pole_sitter(data, 5))

    def test_none_when_grid_has_no_pos_1_entry(self):
        # Defensive - shouldn't happen with real TSL data, but the
        # notification body must fall back gracefully rather than crash.
        grid = [{"pos": 2, "driver": "Ash Sutton"}]
        data = make_results(5, [{"label": "Race 3", "grid": grid}])
        self.assertIsNone(race3_pole_sitter(data, 5))

    def test_none_when_race3_does_not_exist(self):
        data = make_results(5, [{"label": "Race 2", "grid": [{"pos": 1, "driver": "X"}]}])
        self.assertIsNone(race3_pole_sitter(data, 5))


if __name__ == "__main__":
    unittest.main()
