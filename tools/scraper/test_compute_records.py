"""
Tests for compute_records.py.

title_case() had zero coverage before this and silently split Árón
Taylor-Smith's career stats across two rows in records.json
(str.capitalize() doesn't respect a '-' word boundary the way str.title()
does). compute_records()/build_timeline() also had zero coverage before
this and silently counted Qualifying Race as a full Championship Round in
every stat, inflating starts/wins/podiums/poles/fastestLaps for every
current driver - see TestQualifyingRaceExcludedFromChampionshipStats.

Run with:
    python -m pytest tools/scraper/test_compute_records.py -v
    # or
    python tools/scraper/test_compute_records.py
"""

import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import compute_records as cr


class TestTitleCase(unittest.TestCase):
    def test_plain_two_word_name(self):
        self.assertEqual(cr.title_case("TOM INGRAM"), "Tom Ingram")

    def test_hyphenated_surname(self):
        # The actual live bug: .capitalize() gave "Taylor-smith".
        self.assertEqual(cr.title_case("ÁRON TAYLOR-SMITH"), "Áron Taylor-Smith")

    def test_apostrophe_surname(self):
        self.assertEqual(cr.title_case("SENNA O'BRIEN"), "Senna O'Brien")

    def test_already_title_case_is_unchanged(self):
        # Bundled season_*.json files are already natural title case going in -
        # must be a no-op, not just idempotent-looking (re-running through
        # capitalize() would still have passed this one, which is exactly why
        # the hyphen case above is the load-bearing assertion here).
        self.assertEqual(cr.title_case("Tom Ingram"), "Tom Ingram")
        self.assertEqual(cr.title_case("Áron Taylor-Smith"), "Áron Taylor-Smith")

    def test_empty_and_none(self):
        self.assertEqual(cr.title_case(""), "")
        self.assertIsNone(cr.title_case(None))


def _event(year, round_num, label, results, pole_driver=None):
    return {"year": year, "round": round_num, "race_label": label, "pole_driver": pole_driver, "results": results}


def _result(driver, pos, points, fastest_lap=False, laps_led=False):
    return {"driver": driver, "pos": pos, "points": points, "fastestLap": fastest_lap, "lapsLed": laps_led}


class TestQualifyingRaceExcludedFromChampionshipStats(unittest.TestCase):
    """Cross-checked 2026-09-15 against insidebtcc.com/drivers/ (255-driver
    all-time table): with Qualifying Race counted like a normal race, every
    current driver's starts (and several drivers' wins/podiums/poles/
    fastestLaps) came out higher than that reference. Points is the one
    stat that's *supposed* to include Qualifying Race, per career_stats.py's
    regulation-verified docstring (reg 1.6.2.a) - these tests pin that split
    exactly, since compute_records() had zero coverage of this before."""

    def test_qualifying_race_points_count_but_nothing_else_does(self):
        timeline = [
            _event(2026, 1, "Qualifying Race", [_result("Tom Ingram", 1, 10, fastest_lap=True, laps_led=True)]),
            _event(2026, 1, "Race 1", [_result("Tom Ingram", 5, 8)]),
        ]
        [d] = cr.compute_records(timeline)
        self.assertEqual(d["points"], 18)       # both sessions
        self.assertEqual(d["starts"], 1)        # Race 1 only
        self.assertEqual(d["wins"], 0)          # QR win doesn't count
        self.assertEqual(d["podiums"], 0)
        self.assertEqual(d["fastestLaps"], 0)   # QR fastest lap doesn't count
        self.assertEqual(d["racesLed"], 0)      # QR laps-led doesn't count

    def test_qualifying_race_dnf_does_not_count(self):
        timeline = [_event(2026, 1, "Qualifying Race", [_result("Tom Ingram", 0, 0)])]
        [d] = cr.compute_records(timeline)
        self.assertEqual(d["starts"], 0)
        self.assertEqual(d["dnfs"], 0)

    def test_qualifying_race_does_not_break_a_win_streak(self):
        # A DNF in a real Championship Round should break the streak; a
        # Qualifying Race DNF sandwiched between two wins should not, since
        # it's skipped entirely rather than counted as a non-win.
        timeline = [
            _event(2026, 1, "Race 1",           [_result("Tom Ingram", 1, 25)]),
            _event(2026, 2, "Qualifying Race",   [_result("Tom Ingram", 0, 0)]),
            _event(2026, 2, "Race 1",           [_result("Tom Ingram", 1, 25)]),
        ]
        [d] = cr.compute_records(timeline)
        self.assertEqual(d["winStreak"], 2)
        self.assertEqual(d["starts"], 2)

    def test_qualifying_race_pole_does_not_count(self):
        # Pole tracking is separately gated on label == "Race 1" already
        # (unchanged by this fix) - a Qualifying Race pole flag must still
        # be ignored.
        timeline = [_event(
            2026, 1, "Qualifying Race",
            [{**_result("Tom Ingram", 1, 10), "p": True}],
            pole_driver="Tom Ingram",
        )]
        [d] = cr.compute_records(timeline)
        self.assertEqual(d["poles"], 0)

    def test_build_timeline_still_includes_qualifying_race_events(self):
        # The gate lives in compute_records(), not in which events reach it -
        # build_timeline() must keep emitting Qualifying Race so its points
        # are still seen at all.
        rounds = [{
            "round": 1,
            "races": [
                {"label": "Qualifying Race", "results": [{"driver": "Tom Ingram", "pos": 1, "points": 10}]},
                {"label": "Race 1", "results": [{"driver": "Tom Ingram", "pos": 1, "points": 25}]},
            ],
        }]
        timeline = cr.build_timeline([(2026, rounds, "results")])
        labels = [e["race_label"] for e in timeline]
        self.assertIn("Qualifying Race", labels)
        self.assertIn("Race 1", labels)


class TestLoadHistoricalEntries(unittest.TestCase):
    """load_historical_entries() - previously main() itself swallowed any
    exception from re-reading records.json (`except Exception: pass`) and
    silently substituted an empty list, which would have permanently
    dropped every pre-2004 historical entry on the next write if
    records.json was ever transiently corrupt/partially written. A corrupt
    file must now be fatal, not silently treated as "no historical entries
    exist"."""

    def test_missing_file_returns_empty_list(self):
        with tempfile.TemporaryDirectory() as tmp:
            missing_path = Path(tmp) / "records.json"
            self.assertEqual(cr.load_historical_entries(missing_path), [])

    def test_valid_file_returns_only_historical_entries(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "records.json"
            path.write_text(json.dumps({"drivers": [
                {"driver": "Old Timer", "historical": True},
                {"driver": "Tom Ingram", "historical": False},
                {"driver": "Modern Driver"},
            ]}))
            result = cr.load_historical_entries(path)
        self.assertEqual(result, [{"driver": "Old Timer", "historical": True}])

    def test_corrupt_json_is_fatal_not_silently_empty(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "records.json"
            path.write_text("{not valid json at all")
            with self.assertRaises(SystemExit) as ctx:
                cr.load_historical_entries(path)
            self.assertNotEqual(ctx.exception.code, 0)

    def test_valid_json_but_wrong_shape_is_fatal(self):
        # A file that parses as JSON but isn't the expected {"drivers": [...]}
        # shape (e.g. truncated mid-write to a bare list) must also fail
        # loudly rather than have .get("drivers", []) silently used skip it -
        # here .get would raise AttributeError on a list, still caught by the
        # broad except and made fatal.
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "records.json"
            path.write_text("[]")
            with self.assertRaises(SystemExit) as ctx:
                cr.load_historical_entries(path)
            self.assertNotEqual(ctx.exception.code, 0)


if __name__ == "__main__":
    unittest.main()
