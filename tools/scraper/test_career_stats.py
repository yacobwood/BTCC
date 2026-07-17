"""
Tests for career_stats.py — focuses on name normalization (results{year}.json's
all-caps-surname convention vs season_{year}.json's natural title case) and the
whole-round-blank DNF heuristic, both of which have already caused real bugs.

Run with:
    python -m pytest tools/scraper/test_career_stats.py -v
    # or
    python tools/scraper/test_career_stats.py
"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import career_stats as cs


class TestNormalizeName(unittest.TestCase):

    def test_leaves_already_title_case_names_unchanged(self):
        self.assertEqual(cs.normalize_name('Tom Ingram'), 'Tom Ingram')

    def test_titles_an_all_caps_surname(self):
        # results{year}.json's convention (e.g. "Max BUXTON")
        self.assertEqual(cs.normalize_name('Max BUXTON'), 'Max Buxton')

    def test_titles_a_multi_word_all_caps_surname(self):
        self.assertEqual(cs.normalize_name('Daryl DE LEON'), 'Daryl De Leon')

    def test_titles_a_hyphenated_all_caps_surname(self):
        self.assertEqual(cs.normalize_name('Árón TAYLOR-SMITH'), 'Árón Taylor-Smith')

    def test_empty_string_is_unchanged(self):
        self.assertEqual(cs.normalize_name(''), '')


class TestGetDriverAliasOrdering(unittest.TestCase):
    # Regression: DRIVER_NAME_ALIASES is keyed by each bundle's *raw* spelling
    # (e.g. "Daryl DeLeon", mixed-case with no space before "Leon"). Running
    # normalize_name() before the alias lookup silently breaks the match,
    # since .title() turns "DeLeon" into "Deleon", not "DeLeon".

    def test_alias_matches_before_normalization_would_mangle_it(self):
        result = {'driver': 'Daryl DeLeon'}
        self.assertEqual(cs.get_driver(result), 'Daryl De Leon')

    def test_non_aliased_all_caps_name_still_gets_normalized(self):
        result = {'driver': 'Max BUXTON'}
        self.assertEqual(cs.get_driver(result), 'Max Buxton')


class TestWholeRoundBlankHeuristic(unittest.TestCase):

    def _round(self, race_entries):
        return {'races': [
            {'label': label, 'results': entries}
            for label, entries in race_entries.items()
        ]}

    def test_driver_absent_all_round_contributes_zero_dnfs(self):
        # Matches the real Dan Cammish 2021 case: a driver who left the series
        # mid-season keeps a blank pos=0/laps=0 placeholder entry for every
        # remaining round - none of those should count as a DNF.
        rounds = [self._round({
            'Race 1': [{'driver': 'A Driver', 'pos': 0, 'laps': 0, 'points': 0}],
            'Race 2': [{'driver': 'A Driver', 'pos': 0, 'laps': 0, 'points': 0}],
            'Race 3': [{'driver': 'A Driver', 'pos': 0, 'laps': 0, 'points': 0}],
        })]
        standings = cs.compute_year_standings(rounds)
        self.assertEqual(standings['A Driver']['dnfs'], 0)

    def test_genuine_dnf_within_an_otherwise_raced_round_still_counts(self):
        rounds = [self._round({
            'Race 1': [{'driver': 'A Driver', 'pos': 5, 'laps': 20, 'points': 11}],
            'Race 2': [{'driver': 'A Driver', 'pos': 0, 'laps': 8, 'points': 0}],  # retired mid-race
            'Race 3': [{'driver': 'A Driver', 'pos': 7, 'laps': 20, 'points': 9}],
        })]
        standings = cs.compute_year_standings(rounds)
        self.assertEqual(standings['A Driver']['dnfs'], 1)

    def test_dns_style_zero_laps_entry_within_a_raced_round_still_counts(self):
        # Same round, driver raced Race 1 but has a laps=0 blank in Race 3 -
        # round is NOT whole-round-blank, so this entry still counts as a DNF
        # (matches the real Halstead 2025 round-5 case verified this session).
        rounds = [self._round({
            'Race 1': [{'driver': 'A Driver', 'pos': 5, 'laps': 20, 'points': 11}],
            'Race 2': [{'driver': 'A Driver', 'pos': 0, 'laps': 14, 'points': 0}],
            'Race 3': [{'driver': 'A Driver', 'pos': 0, 'laps': 0, 'points': 0}],
        })]
        standings = cs.compute_year_standings(rounds)
        self.assertEqual(standings['A Driver']['dnfs'], 2)


if __name__ == '__main__':
    unittest.main()
