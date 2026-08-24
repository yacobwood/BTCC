"""
Tests for scrape_tsl.py — focuses on compute_standings and the bonus
point logic that has historically been broken by field renames.

Run with:
    python -m pytest tools/scraper/test_scrape_tsl.py -v
    # or
    python tools/scraper/test_scrape_tsl.py
"""

import json
import sys
import tempfile
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

    # Wins counting — QR results do NOT count towards wins/podiums

    def test_race_win_counted(self):
        r = make_result('Alice', pos=1, points=20)
        standings = self._standings([make_round(1, [make_race('Race 1', [r])])])
        self.assertEqual(standings['Alice']['wins'], 1)

    def test_qualifying_race_win_not_counted(self):
        """Regression (2026-07-14): QR wins were briefly counted, which was wrong —
        btcc.net reported Sutton's Oulton Park Race 2 win as his "fifth victory of
        2026", a tally that only reconciles when QR results are excluded from wins."""
        r = make_result('Alice', pos=1, points=10)
        standings = self._standings([make_round(1, [make_race('Qualifying Race', [r])])])
        self.assertEqual(standings['Alice']['wins'], 0,
            'QR wins must not be counted — only Race 1/2/3 count towards official wins/podiums')

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
        self.assertEqual(standings['Alice']['wins'], 1)

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

    def test_trailing_unit_suffix_still_parses(self):
        # Regression: some calendar.json records were manually seeded with a
        # trailing unit ("50.876s"), which used to make float(t) raise and
        # silently fall through to inf - treating a real record as "no record".
        self.assertAlmostEqual(s.lap_to_secs('50.876s'), 50.876)
        self.assertAlmostEqual(s.lap_to_secs('1:23.456s'), 83.456)


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


# ── parse_classification (BEST LAP column) ──────────────────────────────────
#
# Regression coverage for a live data-integrity bug (2026-08-24): the BEST LAP
# column's x-range (470 < x < 545) was wide enough to also catch the AVG SPEED
# column (x≈477, mph, e.g. "93.67") that races print just to its left. A
# classified row always has both cells, so a permissive lower bound "worked"
# there only because pdfminer happened to emit the true best-lap element after
# the avg-speed one in the same row (last write wins). A non-classified/DNF
# row - which TSL never computes a real best lap for after only 1-2 laps -
# has only the avg-speed cell, so it silently became the "best lap" instead:
# Donington Park GP round 7 recorded Daniel Rowbottom's Race 3 DNF as bestLap
# "83.35" (his partial-stint mph), and it briefly became the circuit's race
# lap record via update_calendar_records(). Verified against the real TSL PDF
# before fixing: the avg-speed cell sits at x≈477, the genuine best-lap cell
# at x≈503-509 - comfortably inside a narrower 495 < x < 545 window - for both
# normal ("M:SS.mmm") and sub-minute ("SS.mmm", Brands Hatch Indy/Knockhill)
# circuits alike.

def _row_elements(y, pos_text, driver, avg_speed=None, best_lap=None):
    """Build a synthetic (y, x, text) row matching real TSL PDF element
    positions, for monkeypatching _pdf_elements without needing a real PDF.
    pos_text is either a plain finish position ("1", car+class arrive as a
    separate x≈34 element) or a combined "DNF/DQ/NC/RET NNN C" anchor token
    (car+class embedded, x≈11.6, no separate element) - matching the two
    real anchor shapes parse_classification recognises."""
    is_anchor_combined = not pos_text[0].isdigit() or ' ' in pos_text
    elements = [(y, 11.6 if is_anchor_combined else 20.2, pos_text)]
    if not is_anchor_combined:
        elements.append((y, 34.4, '32 M'))
    elements += [
        (y, 87.7, f'{driver} (GBR)'),
        (y, 239.4, 'Mercedes A35 Saloon'),
        (y, 344.6, '14'),
    ]
    if avg_speed:
        elements.append((y, 477.4, avg_speed))
    if best_lap:
        elements.append((y, 503.5, best_lap))
    return elements


class TestParseClassificationBestLap(unittest.TestCase):

    def _parse(self, elements, label='Race 1'):
        import unittest.mock as mock
        with mock.patch.object(s, '_pdf_elements', return_value=elements):
            return s.parse_classification(b'fake-pdf-bytes', label)

    def test_classified_row_takes_best_lap_not_avg_speed(self):
        elements = _row_elements(717.3, pos_text='1', driver='Adam MORGAN',
                                  avg_speed='93.67', best_lap='1:33.766')
        results = self._parse(elements)
        self.assertEqual(results[0]['bestLap'], '1:33.766')

    def test_dnf_row_with_no_real_best_lap_stays_empty(self):
        # The exact Donington Park GP round 7 scenario: only the avg-speed
        # cell exists (no best-lap cell at all for an incomplete stint) -
        # must NOT fall back to treating avg speed as the lap time.
        elements = _row_elements(303.3, pos_text='DNF 32 M', driver='Daniel ROWBOTTOM',
                                  avg_speed='83.35', best_lap=None)
        results = self._parse(elements)
        self.assertEqual(results[0]['bestLap'], '')

    def test_dnf_row_with_genuine_sub_minute_best_lap_is_kept(self):
        # Brands Hatch Indy/Knockhill: a DNF driver can have set a real
        # sub-minute lap before retiring - must still be captured correctly,
        # not confused with the avg-speed cell alongside it.
        elements = _row_elements(697.5, pos_text='DNF 28 M', driver='Nicolas HAMILTON',
                                  avg_speed='66.87', best_lap='52.382')
        results = self._parse(elements)
        self.assertEqual(results[0]['bestLap'], '52.382')


# ── update_calendar_records ─────────────────────────────────────────────────
#
# Regression coverage for a live data-integrity bug (2026-08-09): Knockhill's
# calendar.json records had a trailing unit suffix baked into the stored time
# ("50.876s"), which lap_to_secs() used to fail to parse (see above), silently
# treating a genuine 2020 record as "no record" and letting a slower 2026 lap
# overwrite it as a false "new record". These tests write a real temp
# calendar.json (never the repo's own file) and drive update_calendar_records()
# against it end to end.

class TestUpdateCalendarRecords(unittest.TestCase):

    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmpdir.cleanup)
        self._orig_data_dir = s.DATA_DIR
        s.DATA_DIR = Path(self.tmpdir.name)
        self.addCleanup(lambda: setattr(s, 'DATA_DIR', self._orig_data_dir))
        self.calendar_path = s.DATA_DIR / 'calendar.json'

    def _write_calendar(self, qualifying_record, race_record):
        self.calendar_path.write_text(json.dumps({
            'rounds': [{
                'round': 1,
                'venue': 'Test Circuit',
                'lengthMiles': '1.0 miles',
                'qualifyingRecord': qualifying_record,
                'raceRecord': race_record,
            }],
        }))

    def _read_round(self):
        return json.loads(self.calendar_path.read_text())['rounds'][0]

    def test_does_not_overwrite_faster_stored_record_with_slower_new_time(self):
        # The exact live bug: stored records carry a trailing "s" suffix.
        self._write_calendar(
            qualifying_record={'driver': 'Rory Butcher', 'time': '50.451s', 'year': 2019},
            race_record={'driver': 'Ashley Sutton', 'time': '50.876s', 'year': 2020},
        )
        rounds = [make_round(1, [
            make_race('Qualifying', [make_result('New Driver', pos=1, bestLap='50.830')]),
            make_race('Race 1',     [make_result('New Driver', pos=1, bestLap='55.452')]),
        ])]
        s.update_calendar_records(rounds, 2026)
        rnd = self._read_round()
        self.assertEqual(rnd['qualifyingRecord']['driver'], 'Rory Butcher')
        self.assertEqual(rnd['raceRecord']['driver'], 'Ashley Sutton')

    def test_overwrites_when_new_time_is_genuinely_faster(self):
        self._write_calendar(
            qualifying_record={'driver': 'Rory Butcher', 'time': '50.451s', 'year': 2019},
            race_record={'driver': 'Ashley Sutton', 'time': '50.876s', 'year': 2020},
        )
        rounds = [make_round(1, [
            make_race('Qualifying', [make_result('New Driver', pos=1, bestLap='50.100')]),
            make_race('Race 1',     [make_result('New Driver', pos=1, bestLap='50.500')]),
        ])]
        s.update_calendar_records(rounds, 2026)
        rnd = self._read_round()
        self.assertEqual(rnd['qualifyingRecord']['driver'], 'New Driver')
        self.assertEqual(rnd['qualifyingRecord']['time'], '50.100')
        self.assertEqual(rnd['raceRecord']['driver'], 'New Driver')
        self.assertEqual(rnd['raceRecord']['time'], '50.500')

    def test_sets_a_record_when_none_was_stored(self):
        self._write_calendar(qualifying_record={}, race_record={})
        rounds = [make_round(1, [
            make_race('Qualifying', [make_result('New Driver', pos=1, bestLap='50.100')]),
        ])]
        s.update_calendar_records(rounds, 2026)
        rnd = self._read_round()
        self.assertEqual(rnd['qualifyingRecord']['driver'], 'New Driver')

    def test_uses_fastest_lap_across_race_1_2_and_3(self):
        self._write_calendar(qualifying_record={}, race_record={})
        rounds = [make_round(1, [
            make_race('Race 1', [make_result('Alice', pos=1, bestLap='51.000')]),
            make_race('Race 2', [make_result('Bob',   pos=1, bestLap='49.000')]),  # fastest overall
            make_race('Race 3', [make_result('Carol', pos=1, bestLap='50.000')]),
        ])]
        s.update_calendar_records(rounds, 2026)
        rnd = self._read_round()
        self.assertEqual(rnd['raceRecord']['driver'], 'Bob')
        self.assertEqual(rnd['raceRecord']['time'], '49.000')

    def test_returns_none_when_no_finishers(self):
        self.assertIsNone(s.fastest_lap_driver([]))


# ── merge_scraped_with_existing ───────────────────────────────────────────────

def make_grid(*car_nos):
    """Build a minimal grid list from an ordered sequence of car numbers."""
    return [{'pos': i + 1, 'no': no, 'cl': '', 'driver': f'Driver{no}', 'team': ''} for i, no in enumerate(car_nos)]

def make_scraped_round(r3_grid=None, r3_results=None, r3_draw=None):
    r3 = {'label': 'Race 3', 'results': r3_results or [], 'grid': r3_grid or []}
    if r3_draw is not None:
        r3['reverseGridDraw'] = r3_draw
    return {
        'round': 1, 'venue': 'Test', 'date': '01 Jan', 'youtubeUrls': [],
        'races': [{'label': 'Race 1', 'results': [], 'grid': []}, r3],
    }

def make_existing_round(r3_grid=None, r3_results=None, r3_draw=None, youtube=None):
    r3 = {'label': 'Race 3', 'results': r3_results or [], 'grid': r3_grid or []}
    if r3_draw is not None:
        r3['reverseGridDraw'] = r3_draw
    return {
        'round': 1, 'venue': 'Test', 'date': '01 Jan',
        'youtubeUrls': youtube or ['https://yt/r1', None, None, None, None, None],
        'races': [{'label': 'Race 1', 'results': [], 'grid': []}, r3],
    }


class TestMergeScrapedWithExisting(unittest.TestCase):

    def _r3(self, scraped):
        return next(r for r in scraped['races'] if r['label'] == 'Race 3')

    def test_new_grid_overwrites_old_when_fetch_succeeds(self):
        # TSL amendment scenario: new fetch returns a different grid
        old_grid = make_grid(10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 11, 12)  # top-10 reversed (wrong)
        new_grid = make_grid(11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 12)  # top-11 reversed (correct)
        scraped  = make_scraped_round(r3_grid=new_grid)
        existing = make_existing_round(r3_grid=old_grid)
        s.merge_scraped_with_existing(scraped, existing)
        result_nos = [g['no'] for g in self._r3(scraped)['grid']]
        self.assertEqual(result_nos[0], 11)  # Smiley (R2 P11) at P1

    def test_old_grid_preserved_when_new_fetch_empty(self):
        # Transient fetch failure: new scrape returns empty grid
        old_grid = make_grid(11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 12)
        scraped  = make_scraped_round(r3_grid=[])
        existing = make_existing_round(r3_grid=old_grid)
        s.merge_scraped_with_existing(scraped, existing)
        result_nos = [g['no'] for g in self._r3(scraped)['grid']]
        self.assertEqual(result_nos[0], 11)

    def test_grid_change_detection_logs_warning(self, ):
        # Grid change between runs should print a warning
        import io
        old_grid = make_grid(10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 11, 12)
        new_grid = make_grid(11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 12)
        scraped  = make_scraped_round(r3_grid=new_grid)
        existing = make_existing_round(r3_grid=old_grid)
        import unittest.mock as mock
        with mock.patch('builtins.print') as mock_print:
            s.merge_scraped_with_existing(scraped, existing)
        printed = ' '.join(str(c) for c in mock_print.call_args_list)
        self.assertIn('grid CHANGED', printed)

    def test_reverseGridDraw_preserved_from_existing(self):
        # Explicit override carried forward when new scrape has no draw set
        old_grid = make_grid(11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 12)
        scraped  = make_scraped_round(r3_grid=old_grid)
        existing = make_existing_round(r3_grid=old_grid, r3_draw=11)
        s.merge_scraped_with_existing(scraped, existing)
        self.assertEqual(self._r3(scraped).get('reverseGridDraw'), 11)

    def test_reverseGridDraw_not_overwritten_when_new_has_value(self):
        # New scrape already has a draw value; existing's value must not clobber it
        old_grid = make_grid(11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 12)
        scraped  = make_scraped_round(r3_grid=old_grid, r3_draw=11)
        existing = make_existing_round(r3_grid=old_grid, r3_draw=8)
        s.merge_scraped_with_existing(scraped, existing)
        self.assertEqual(self._r3(scraped).get('reverseGridDraw'), 11)

    def test_youtube_urls_carried_forward(self):
        urls = ['https://yt/r1', 'https://yt/r2', None, None, None, None]
        scraped  = make_scraped_round()
        existing = make_existing_round(youtube=urls)
        s.merge_scraped_with_existing(scraped, existing)
        self.assertEqual(scraped['youtubeUrls'], urls)

    def test_old_results_preserved_when_new_empty(self):
        results = [make_result('Sutton', 1)]
        scraped  = make_scraped_round(r3_results=[])
        existing = make_existing_round(r3_results=results)
        s.merge_scraped_with_existing(scraped, existing)
        self.assertEqual(self._r3(scraped)['results'], results)

    def test_new_results_not_overwritten_by_old(self):
        old_results = [make_result('Sutton', 1)]
        new_results = [make_result('Ingram', 1)]
        scraped  = make_scraped_round(r3_results=new_results)
        existing = make_existing_round(r3_results=old_results)
        s.merge_scraped_with_existing(scraped, existing)
        self.assertEqual(self._r3(scraped)['results'][0]['driver'], 'Ingram')


# ── apply_draw_override ───────────────────────────────────────────────────────

class TestApplyDrawOverride(unittest.TestCase):

    def _r3(self, rounds, round_num=1):
        rnd = next(r for r in rounds if r['round'] == round_num)
        return next(r for r in rnd['races'] if r['label'] == 'Race 3')

    def test_sets_reverseGridDraw_on_race3(self):
        rounds = [make_scraped_round()]
        s.apply_draw_override(rounds, round_num=1, draw=11)
        self.assertEqual(self._r3(rounds).get('reverseGridDraw'), 11)

    def test_overwrites_existing_draw_value(self):
        rounds = [make_scraped_round(r3_draw=10)]
        s.apply_draw_override(rounds, round_num=1, draw=11)
        self.assertEqual(self._r3(rounds).get('reverseGridDraw'), 11)

    def test_does_not_touch_other_rounds(self):
        r1 = make_scraped_round()
        r2 = {**make_scraped_round(), 'round': 2}
        s.apply_draw_override([r1, r2], round_num=1, draw=11)
        r2_r3 = next(r for r in r2['races'] if r['label'] == 'Race 3')
        self.assertIsNone(r2_r3.get('reverseGridDraw'))


# ── _normalize_team_entries ──────────────────────────────────────────────────
# Regression: 2026-08-22, Donington Park GP round 7 - the official TSL teams
# championship PDF listed "Cataclean Plato Racing" (282pts) and its renamed
# successor "CPRL" (0pts) as two separate rows for the same team, corrupting
# the Teams tab with a phantom last-place duplicate.

class TestNormalizeTeamEntries(unittest.TestCase):

    def test_merges_aliased_name_into_canonical_name(self):
        entries = [
            {'pos': 4, 'team': 'Cataclean Plato Racing', 'points': 282},
            {'pos': 10, 'team': 'CPRL', 'points': 0},
        ]
        result = s._normalize_team_entries(entries)
        self.assertEqual([e['team'] for e in result].count('CPRL'), 1)
        self.assertEqual([e for e in result if e['team'] == 'CPRL'][0]['points'], 282)

    def test_reranks_contiguously_by_points_after_merge(self):
        entries = [
            {'pos': 1, 'team': 'Team VERTU', 'points': 333},
            {'pos': 4, 'team': 'Cataclean Plato Racing', 'points': 282},
            {'pos': 5, 'team': 'Restart Racing', 'points': 187},
            {'pos': 10, 'team': 'CPRL', 'points': 0},
        ]
        result = s._normalize_team_entries(entries)
        self.assertEqual([e['pos'] for e in result], [1, 2, 3])
        self.assertEqual([e['points'] for e in result], sorted([e['points'] for e in result], reverse=True))

    def test_no_op_when_no_alias_present(self):
        entries = [
            {'pos': 1, 'team': 'Team VERTU', 'points': 333},
            {'pos': 2, 'team': 'WSR', 'points': 293},
        ]
        result = s._normalize_team_entries(entries)
        self.assertEqual(result, entries)

    def test_sums_points_of_multiple_rows_sharing_the_alias_target_name(self):
        # Guards against a future alias mapping many old names onto one
        # canonical name all appearing in the same table at once.
        entries = [
            {'pos': 3, 'team': 'Cataclean Plato Racing', 'points': 200},
            {'pos': 7, 'team': 'CPRL', 'points': 50},
        ]
        result = s._normalize_team_entries(entries)
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0], {'pos': 1, 'team': 'CPRL', 'points': 250})


if __name__ == '__main__':
    sys.argv = sys.argv[:1]  # strip the '2026' arg before unittest.main() parses argv
    unittest.main()
