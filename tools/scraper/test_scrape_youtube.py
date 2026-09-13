#!/usr/bin/env python3
"""
Tests for scrape_youtube.py.

Covers find_target_round's "is this round done" detection, and the
main()-level fix for a genuine race-timestamp-detection failure: when
detect_race_timestamps() returns (None, None) - a real detection miss, or a
geo-restricted/failed video download, not a confirmed "these races start at
t=0" - the old code still fell back to t1,t2,t3 = 0,0,0 and wrote those
placeholder URLs unconditionally. Because build_urls() always returns
non-empty strings even for t=0, find_target_round's own "already has all
race URLs" check (`len(urls) >= 6 and all(urls[3:6])`) then saw the round as
permanently complete and never retried it - Race 2/3 deep links stayed
wrong forever with no automatic retry path. main() must now leave a round's
existing youtubeUrls untouched (and not call save_results at all) whenever
detection genuinely fails, so a future run retries it.

All network/subprocess calls (search_itv_channel, get_chapters,
detect_race_timestamps, yt_dlp) are mocked - no real video download or
yt-dlp invocation happens in these tests.
"""

import sys
import unittest
from datetime import date, timedelta
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).parent))
import scrape_youtube as sy
from scrape_youtube import find_target_round

_PAST_END_DATE = (date.today() - timedelta(days=7)).isoformat()


def _round(num, venue="Testville", end_date=None):
    end_date = end_date or _PAST_END_DATE
    return {"round": num, "venue": venue, "startDate": "2020-01-01", "endDate": end_date}


class TestFindTargetRound(unittest.TestCase):

    def test_identifies_a_completed_round_with_no_urls_at_all(self):
        calendar = {"rounds": [_round(2)]}
        results = {"rounds": [{"round": 2, "youtubeUrls": []}]}
        target = find_target_round(calendar, results)
        self.assertIsNotNone(target)
        self.assertEqual(target["round"], 2)

    def test_identifies_a_completed_round_with_partial_race_urls(self):
        # 6 slots present but Race 2/3 (indices 4, 5) are blank - incomplete.
        calendar = {"rounds": [_round(2)]}
        results = {"rounds": [{"round": 2, "youtubeUrls": ["a", "b", "c", "d", "", ""]}]}
        target = find_target_round(calendar, results)
        self.assertIsNotNone(target)
        self.assertEqual(target["round"], 2)

    def test_skips_a_round_whose_race_urls_are_all_populated(self):
        calendar = {"rounds": [_round(2)]}
        results = {"rounds": [{"round": 2, "youtubeUrls": ["a", "b", "c", "d", "e", "f"]}]}
        self.assertIsNone(find_target_round(calendar, results))

    def test_returns_none_when_no_round_has_completed_yet(self):
        calendar = {"rounds": [_round(2, end_date="2099-01-01")]}
        results = {"rounds": []}
        self.assertIsNone(find_target_round(calendar, results))

    def test_picks_the_most_recently_completed_round_first(self):
        calendar = {"rounds": [_round(1, end_date="2026-05-01"), _round(2, end_date="2026-09-01")]}
        results = {"rounds": []}
        target = find_target_round(calendar, results)
        self.assertEqual(target["round"], 2)


class TestMainDetectionFailureDoesNotPersist(unittest.TestCase):
    """The actual fix: a genuine detect_race_timestamps() failure must not
    be written as if it were a successful, complete result."""

    def _run_main(self, detect_return, existing_urls=None):
        calendar = {"rounds": [_round(2)]}
        results = {"rounds": [{"round": 2, "youtubeUrls": existing_urls or []}]}

        with patch.object(sys, "argv", ["scrape_youtube.py", "--round", "2"]), \
             patch("scrape_youtube.load_calendar", return_value=calendar), \
             patch("scrape_youtube.load_results", return_value=results), \
             patch("scrape_youtube.resolve_cookies", return_value=[]), \
             patch("scrape_youtube.search_itv_channel", return_value=("vid123", "Full Races BTCC 2026 - Testville")), \
             patch("scrape_youtube.get_chapters", return_value=[]), \
             patch("scrape_youtube.detect_race_timestamps", return_value=detect_return), \
             patch("scrape_youtube.save_results") as mock_save:
            try:
                sy.main()
                exit_code = 0
            except SystemExit as e:
                exit_code = e.code
        return exit_code, mock_save

    def test_genuine_detection_failure_does_not_call_save_results(self):
        exit_code, mock_save = self._run_main(detect_return=(None, None), existing_urls=["", "", "", "old-r1", "old-r2", "old-r3"])
        mock_save.assert_not_called()
        # Non-fatal - this is "retry later", the same shape as the existing
        # "no video found yet" early-exit just above it in main().
        self.assertEqual(exit_code, 0)

    def test_genuine_detection_failure_does_not_mutate_results_dict_either(self):
        # Guards against a version of the fix that skips the *write* but
        # still mutates the in-memory dict with t=0 URLs before returning -
        # results["rounds"][0] must be left completely alone.
        calendar = {"rounds": [_round(2)]}
        original_urls = ["", "", "", "old-r1", "old-r2", "old-r3"]
        results = {"rounds": [{"round": 2, "youtubeUrls": list(original_urls)}]}

        with patch.object(sys, "argv", ["scrape_youtube.py", "--round", "2"]), \
             patch("scrape_youtube.load_calendar", return_value=calendar), \
             patch("scrape_youtube.load_results", return_value=results), \
             patch("scrape_youtube.resolve_cookies", return_value=[]), \
             patch("scrape_youtube.search_itv_channel", return_value=("vid123", "Full Races BTCC 2026 - Testville")), \
             patch("scrape_youtube.get_chapters", return_value=[]), \
             patch("scrape_youtube.detect_race_timestamps", return_value=(None, None)), \
             patch("scrape_youtube.save_results"):
            with self.assertRaises(SystemExit):
                sy.main()

        self.assertEqual(results["rounds"][0]["youtubeUrls"], original_urls)

    def test_successful_detection_still_writes_normally(self):
        # Sanity/regression check: the fix must not break the working path.
        exit_code, mock_save = self._run_main(detect_return=(100, 200))
        mock_save.assert_called_once()
        written = mock_save.call_args.args[0]
        round_2 = next(r for r in written["rounds"] if r["round"] == 2)
        self.assertTrue(round_2["youtubeUrls"][4])  # Race 2 URL populated
        self.assertTrue(round_2["youtubeUrls"][5])  # Race 3 URL populated
        self.assertIn("t=100", round_2["youtubeUrls"][4])
        self.assertIn("t=200", round_2["youtubeUrls"][5])


if __name__ == "__main__":
    unittest.main()
