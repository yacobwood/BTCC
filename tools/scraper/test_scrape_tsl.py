"""
Tests for scrape_tsl.py — focuses on compute_standings and the bonus
point logic that has historically been broken by field renames.

Run with:
    python -m pytest tools/scraper/test_scrape_tsl.py -v
    # or
    python tools/scraper/test_scrape_tsl.py
"""

import sys
import unittest
from pathlib import Path

# Allow importing scrape_tsl without running main()
sys.argv = ['scrape_tsl.py', '2026']
sys.path.insert(0, str(Path(__file__).parent))
import scrape_tsl as s


# ── Helpers ───────────────────────────────────────────────────────────────────

def make_result(driver, pos, points=0, bestLap='', laps=10,
                fastestLap=False, leadLap=False, pole=False,
                team='Team A', no=1, cl='M'):
    return {
        'driver': driver, 'pos': pos, 'points': points,
        'bestLap': bestLap, 'laps': laps, 'time': '',
        'fastestLap': fastestLap, 'leadLap': leadLap, 'pole': pole,
        'team': team, 'no': no, 'cl': cl,
    }

def make_round(round_num, races):
    return {'round': round_num, 'venue': 'Test Circuit', 'date': '01 Jan 2026', 'races': races}

def make_race(label, results):
    return {'label': label, 'results': results, 'grid': []}


# ── compute_standings_fallback ────────────────────────────────────────────────

class TestComputeStandingsFallback(unittest.TestCase):

    def _standings(self, rounds):
        result = s.compute_standings_fallback(rounds)
        return {d['driver']: d for d in result['standings']}

    # Basic points

    def test_race_winner_gets_20_points(self):
        r1 = make_result('Alice', pos=1, points=20)
        standings = self._standings([make_round(1, [make_race('Race 1', [r1])])])
        self.assertEqual(standings['Alice']['points'], 20)

    def test_multiple_races_sum_correctly(self):
        r1 = make_result('Alice', pos=1, points=20)
        r2 = make_result('Alice', pos=2, points=17)
        rounds = [make_round(1, [make_race('Race 1', [r1]), make_race('Race 2', [r2])])]
        standings = self._standings(rounds)
        self.assertEqual(standings['Alice']['points'], 37)

    def test_no_points_sessions_excluded(self):
        fp = make_result('Alice', pos=1, points=0)
        qual = make_result('Alice', pos=1, points=0)
        rounds = [make_round(1, [
            make_race('Free Practice', [fp]),
            make_race('Qualifying', [qual]),
        ])]
        standings = self._standings(rounds)
        self.assertNotIn('Alice', standings)

    # Fastest lap bonus — the field that was renamed and broke silently

    def test_fastest_lap_adds_1_point(self):
        r = make_result('Alice', pos=2, points=17, bestLap='47.500', fastestLap=True)
        standings = self._standings([make_round(1, [make_race('Race 1', [r])])])
        self.assertEqual(standings['Alice']['points'], 18)

    def test_fastest_lap_field_name_is_fastestLap(self):
        """Regression: field was renamed ledLap→leadLap; fastestLap must match compute_standings."""
        r = make_result('Alice', pos=3, points=15, bestLap='47.100', fastestLap=True)
        standings = self._standings([make_round(1, [make_race('Race 1', [r])])])
        # Without the correct field name this returns 15, not 16
        self.assertEqual(standings['Alice']['points'], 16,
            'fastestLap field name mismatch — compute_standings is not reading the correct key')

    def test_no_fastest_lap_no_bonus(self):
        r = make_result('Alice', pos=2, points=17)
        standings = self._standings([make_round(1, [make_race('Race 1', [r])])])
        self.assertEqual(standings['Alice']['points'], 17)

    # Laps led bonus — the field that was renamed and broke silently

    def test_lead_lap_adds_1_point(self):
        r = make_result('Alice', pos=1, points=20, leadLap=True)
        standings = self._standings([make_round(1, [make_race('Race 1', [r])])])
        self.assertEqual(standings['Alice']['points'], 21)

    def test_lead_lap_field_name_is_leadLap(self):
        """Regression: was ledLap, renamed to leadLap. If compute_standings reads the
        old name the bonus silently disappears and points are understated."""
        r = make_result('Alice', pos=2, points=17, leadLap=True)
        standings = self._standings([make_round(1, [make_race('Race 1', [r])])])
        # Without the correct field name this returns 17, not 18
        self.assertEqual(standings['Alice']['points'], 18,
            'leadLap field name mismatch — compute_standings is reading "ledLap" (old name)')

    def test_both_bonuses_stack(self):
        # bestLap required — compute_standings re-derives FL from lap times, not the fastestLap flag
        r = make_result('Alice', pos=1, points=20, bestLap='47.500', fastestLap=True, leadLap=True)
        standings = self._standings([make_round(1, [make_race('Race 1', [r])])])
        self.assertEqual(standings['Alice']['points'], 22)

    # QR uses a different points table — fastest lap bonus does NOT apply

    def test_qualifying_race_no_fastest_lap_bonus(self):
        r = make_result('Alice', pos=1, points=10, fastestLap=True)
        standings = self._standings([make_round(1, [make_race('Qualifying Race', [r])])])
        self.assertEqual(standings['Alice']['points'], 10)

    def test_qualifying_race_lead_lap_no_bonus(self):
        """Reg 1.6.2.a: PP, FL and laps-led bonus points are not awarded in the QR."""
        r = make_result('Alice', pos=1, points=10, leadLap=True)
        standings = self._standings([make_round(1, [make_race('Qualifying Race', [r])])])
        self.assertEqual(standings['Alice']['points'], 10)

    # Wins counting — QR wins now count

    def test_race_win_counted(self):
        r = make_result('Alice', pos=1, points=20)
        standings = self._standings([make_round(1, [make_race('Race 1', [r])])])
        self.assertEqual(standings['Alice']['wins'], 1)

    def test_qualifying_race_win_counted(self):
        """Regression: QR wins were previously excluded. They now count."""
        r = make_result('Alice', pos=1, points=10)
        standings = self._standings([make_round(1, [make_race('Qualifying Race', [r])])])
        self.assertEqual(standings['Alice']['wins'], 1,
            'QR wins should be counted — removed the is_qual_race guard on driver_wins')

    def test_wins_across_sessions_cumulate(self):
        qr = make_result('Alice', pos=1, points=10)
        r1 = make_result('Alice', pos=1, points=20)
        r2 = make_result('Alice', pos=2, points=17)
        rounds = [make_round(1, [
            make_race('Qualifying Race', [qr]),
            make_race('Race 1', [r1]),
            make_race('Race 2', [r2]),
        ])]
        standings = self._standings(rounds)
        self.assertEqual(standings['Alice']['wins'], 2)

    def test_podiums_counted_for_non_winners(self):
        r = make_result('Bob', pos=2, points=17)
        standings = self._standings([make_round(1, [make_race('Race 1', [r])])])
        self.assertEqual(standings['Bob']['seconds'], 1)
        self.assertEqual(standings['Bob']['wins'], 0)

    # Standings ordering

    def test_drivers_sorted_by_points_descending(self):
        r1 = make_result('Alice', pos=1, points=20)
        r2 = make_result('Bob', pos=2, points=17)
        result = s.compute_standings_fallback([make_round(1, [make_race('Race 1', [r1, r2])])])
        self.assertEqual(result['standings'][0]['driver'], 'Alice')
        self.assertEqual(result['standings'][1]['driver'], 'Bob')


# ── lap_to_secs ───────────────────────────────────────────────────────────────

class TestLapToSecs(unittest.TestCase):

    def test_standard_format(self):
        self.assertAlmostEqual(s.lap_to_secs('1:23.456'), 83.456)

    def test_sub_minute_format(self):
        self.assertAlmostEqual(s.lap_to_secs('47.360'), 47.360)

    def test_invalid_returns_inf(self):
        self.assertEqual(s.lap_to_secs(''), float('inf'))
        self.assertEqual(s.lap_to_secs('DNS'), float('inf'))


# ── fastest_lap_driver ────────────────────────────────────────────────────────

class TestFastestLapDriver(unittest.TestCase):

    def test_picks_driver_with_lowest_lap_time(self):
        results = [
            make_result('Alice', pos=1, bestLap='47.500'),
            make_result('Bob',   pos=2, bestLap='47.100'),
            make_result('Carol', pos=3, bestLap='47.800'),
        ]
        self.assertEqual(s.fastest_lap_driver(results), 'Bob')

    def test_ignores_drivers_with_no_bestlap(self):
        results = [
            make_result('Alice', pos=1, bestLap=''),
            make_result('Bob',   pos=2, bestLap='47.100'),
        ]
        self.assertEqual(s.fastest_lap_driver(results), 'Bob')

    def test_ignores_non_finishers(self):
        results = [
            make_result('Alice', pos=0, bestLap='46.000'),  # DNF/DNS
            make_result('Bob',   pos=2, bestLap='47.100'),
        ]
        self.assertEqual(s.fastest_lap_driver(results), 'Bob')

    def test_returns_none_when_no_finishers(self):
        self.assertIsNone(s.fastest_lap_driver([]))


if __name__ == '__main__':
    sys.argv = sys.argv[:1]  # strip the '2026' arg before unittest.main() parses argv
    unittest.main()
