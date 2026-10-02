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
from unittest import mock

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


# ── parse_best_speeds ─────────────────────────────────────────────────────────

# Real sessions always have >=11 starters; _parse_best_speeds_block's POS-run
# anchor requires 5 consecutive "1".."5" lines to avoid false-positives
# elsewhere in the document, so every fixture below pads to >=5 entries.

def make_best_speeds_chunk(pos_names_int2, mph_int2, pos_names_finish, mph_finish,
                            finish_mph_header=True):
    """Build a synthetic Best Speeds text chunk in the real book-PDF shape:
    a variable-length header block (with Intermediate 1 absent, the real
    shape at every venue confirmed live so far), then a POS run, then
    Intermediate 2's "NO NAME" entries + MPH values, then Finish Line's.
    `pos_names_int2` is a list of strings, each either "no NAME" (single
    line) or "no\\nNAME" / "NAME\\nno" (the confirmed unstable wrap order)
    to simulate a wrapped surname."""
    n = len(pos_names_int2)
    header = "POS\n\nINTERMEDIATE 1\nNO SPEED TRAP INFORMATION\n\nINTERMEDIATE 2\n\nFINISH LINE\n\nNO NAME\n\nMPH\n\nNO NAME\n\n"
    pos_run = "".join(f"{i + 1}\n" for i in range(n))
    int2_names = "".join(f"{e}\n" for e in pos_names_int2)
    int2_mph = "".join(f"{v}\n" for v in mph_int2)
    finish_names = "".join(f"{e}\n" for e in pos_names_finish)
    finish_mph_hdr = "MPH\n\n" if finish_mph_header else ""
    finish_mph = "".join(f"{v}\n" for v in mph_finish)
    return header + pos_run + "\n" + int2_names + "\n" + int2_mph + "\n" + finish_names + "\n" + finish_mph_hdr + finish_mph


class TestDetectActiveTraps(unittest.TestCase):

    def test_marks_trap_inactive_when_no_speed_trap_info_follows(self):
        header = "POS\n\nINTERMEDIATE 1\nNO SPEED TRAP INFORMATION\n\nINTERMEDIATE 2\n\nFINISH LINE\n\nNO NAME\n\nMPH\n\nNO NAME\n\n"
        self.assertEqual(s._detect_active_traps(header), ['INTERMEDIATE 2', 'FINISH LINE'])

    def test_shortened_no_speed_trap_info_wording_also_recognized(self):
        # Confirmed live at one venue: "NO SPEED TRAP INFO", not the usual
        # "...INFORMATION" - both must be recognized as "inactive".
        header = "INTERMEDIATE 1\n\nPOS\n\nINTERMEDIATE 2\nNO SPEED TRAP INFO\n\nFINISH LINE\n\n"
        self.assertEqual(s._detect_active_traps(header), ['INTERMEDIATE 1', 'FINISH LINE'])

    def test_all_traps_active_when_no_marker_present(self):
        # Confirmed live: some venues wire up every trap they define, with no
        # "NO SPEED TRAP INFO" text anywhere in the header.
        header = "INTERMEDIATE 1\n\nINTERMEDIATE 2\n\nINTERMEDIATE 3\n\nFINISH LINE\n\nPOS\n\n"
        self.assertEqual(s._detect_active_traps(header), ['INTERMEDIATE 1', 'INTERMEDIATE 2', 'INTERMEDIATE 3', 'FINISH LINE'])

    def test_no_labels_found_returns_empty(self):
        self.assertEqual(s._detect_active_traps("POS\n\nNO NAME\n\n"), [])


class TestParseBestSpeedsBlock(unittest.TestCase):

    def test_basic_block_with_no_intermediate1(self):
        chunk = make_best_speeds_chunk(
            ['10 ALPHA', '20 BETA', '30 GAMMA', '40 DELTA', '50 ECHO'], [150.0, 148.0, 146.0, 144.0, 142.0],
            ['20 BETA', '10 ALPHA', '30 GAMMA', '40 DELTA', '50 ECHO'], [130.0, 129.0, 129.0, 127.0, 126.0],
        )
        block = s._parse_best_speeds_block(chunk)
        self.assertIsNone(block['intermediate1'])
        self.assertEqual(block['intermediate2'][0], {'pos': 1, 'no': 10, 'mph': 150.0})
        self.assertEqual(len(block['intermediate2']), 5)
        self.assertEqual(len(block['finish']), 5)

    def test_tied_mph_values_kept_as_separate_ranked_rows(self):
        # Confirmed live behaviour: TSL does not merge ties into a shared
        # rank - two equal MPH values still get consecutive pos numbers.
        chunk = make_best_speeds_chunk(
            ['10 ALPHA', '20 BETA', '30 GAMMA', '40 DELTA', '50 ECHO'], [150.0, 148.0, 148.0, 144.0, 142.0],
            ['10 ALPHA', '20 BETA', '30 GAMMA', '40 DELTA', '50 ECHO'], [130.0, 129.0, 129.0, 127.0, 126.0],
        )
        block = s._parse_best_speeds_block(chunk)
        pos_mph = [(e['pos'], e['mph']) for e in block['intermediate2']]
        self.assertEqual(pos_mph, [(1, 150.0), (2, 148.0), (3, 148.0), (4, 144.0), (5, 142.0)])

    def test_wrapped_car_number_extracted_regardless_of_wrap_order(self):
        # Confirmed live: car 123/Daniel LLOYD's surname sometimes wraps as
        # "123" then "LLOYD", sometimes as "LLOYD" then "123" (same PDF,
        # different session pages) - the car number must come out right
        # either way. The name itself is never read from this page at all
        # (see _collect_numbers) - only the car number matters here.
        no_then_name = make_best_speeds_chunk(
            ['10 ALPHA', '123\nLLOYD', '30 GAMMA', '40 DELTA', '50 ECHO'], [150.0, 148.0, 146.0, 144.0, 142.0],
            ['10 ALPHA', '20 BETA', '30 GAMMA', '40 DELTA', '50 ECHO'], [130.0, 129.0, 128.0, 127.0, 126.0],
        )
        name_then_no = make_best_speeds_chunk(
            ['10 ALPHA', 'LLOYD\n123', '30 GAMMA', '40 DELTA', '50 ECHO'], [150.0, 148.0, 146.0, 144.0, 142.0],
            ['10 ALPHA', '20 BETA', '30 GAMMA', '40 DELTA', '50 ECHO'], [130.0, 129.0, 128.0, 127.0, 126.0],
        )
        for chunk in (no_then_name, name_then_no):
            block = s._parse_best_speeds_block(chunk)
            entry = next(e for e in block['intermediate2'] if e['no'] == 123)
            self.assertEqual(entry['mph'], 148.0)

    def test_intermediate1_parsed_when_present(self):
        # Untested live (every real venue seen so far prints "NO SPEED TRAP
        # INFORMATION" for Intermediate 1) - built directly rather than via
        # make_best_speeds_chunk, which only has two trap slots.
        chunk = (
            "POS\n\nINTERMEDIATE 1\n\nINTERMEDIATE 2\n\nFINISH LINE\n\nNO NAME\n\nMPH\n\nNO NAME\n\nMPH\n\nNO NAME\n\n"
            "1\n2\n3\n4\n5\n\n"
            "10 ALPHA\n20 BETA\n30 GAMMA\n40 DELTA\n50 ECHO\n\n"
            "150.0\n148.0\n146.0\n144.0\n142.0\n\n"
            "10 ALPHA\n20 BETA\n30 GAMMA\n40 DELTA\n50 ECHO\n\n"
            "130.0\n129.0\n128.0\n127.0\n126.0\n\n"
            "10 ALPHA\n20 BETA\n30 GAMMA\n40 DELTA\n50 ECHO\n\n"
            "110.0\n109.0\n108.0\n107.0\n106.0\n"
        )
        block = s._parse_best_speeds_block(chunk)
        self.assertIsNotNone(block['intermediate1'])
        self.assertEqual(block['intermediate1'][0]['no'], 10)
        self.assertEqual(block['intermediate1'][0]['mph'], 150.0)
        self.assertEqual(block['intermediate2'][0]['mph'], 130.0)
        self.assertEqual(block['finish'][0]['mph'], 110.0)

    def test_finish_mph_header_line_is_optional(self):
        # Confirmed live: a literal "MPH" line precedes Finish Line's values
        # on some pages but not others (pdfminer box-ordering quirk) - both
        # must parse identically.
        names = ['10 ALPHA', '20 BETA', '30 GAMMA', '40 DELTA', '50 ECHO']
        mph = [150.0, 148.0, 146.0, 144.0, 142.0]
        with_header = make_best_speeds_chunk(names, mph, names, mph, finish_mph_header=True)
        without_header = make_best_speeds_chunk(names, mph, names, mph, finish_mph_header=False)
        self.assertEqual(s._parse_best_speeds_block(with_header)['finish'],
                          s._parse_best_speeds_block(without_header)['finish'])

    def test_returns_none_when_no_pos_run_found(self):
        self.assertIsNone(s._parse_best_speeds_block("some unrelated text\nwith no table in it"))

    def test_trap_with_fewer_real_entries_than_the_pos_run_is_rejected_not_bled_into_next_trap(self):
        # A driver who retired before reaching a trap simply has no row for
        # it, so a trap's real entry count can be less than n (the POS
        # run's own length, i.e. the full classified field) - confirmed
        # live (Round 1/Donington, Race 2: Intermediate 1 had only 19 real
        # entries against n=21). _collect_numbers/_collect_mph don't know
        # "fewer than n" is possible - they scan forward, skipping
        # non-matching lines, until n matches accumulate, silently
        # absorbing the start of the NEXT trap's own numbers to pad out the
        # count. Here Intermediate 2 has only 3 real entries (30/40/50)
        # against a POS run of 5, with Finish Line's block (deliberately
        # starting with 30 and 40 again, a real car appearing at two
        # different finishing-ish ranks makes no sense but proves the
        # bleed) immediately after.
        header = "POS\n\nINTERMEDIATE 1\nNO SPEED TRAP INFORMATION\n\nINTERMEDIATE 2\n\nFINISH LINE\n\nNO NAME\n\nMPH\n\nNO NAME\n\n"
        pos_run = "1\n2\n3\n4\n5\n"
        int2_names = "30 GAMMA\n40 DELTA\n50 ECHO\n"  # only 3 real entries, not 5
        int2_mph = "146.0\n144.0\n142.0\n"
        finish_names = "30 GAMMA\n40 DELTA\n10 ALPHA\n20 BETA\n50 ECHO\n"
        finish_mph = "130.0\n129.0\n128.0\n127.0\n126.0\n"
        chunk = header + pos_run + "\n" + int2_names + "\n" + int2_mph + "\n" + finish_names + "\n" + finish_mph
        self.assertIsNone(s._parse_best_speeds_block(chunk))

    def test_mph_before_numbers_order_parsed_same_as_numbers_before_mph(self):
        # Confirmed live: a trap's own N-numbers/N-MPH pair can print in
        # either order, and both orders occur within the very same PDF
        # (2022 Donington Race 1 prints numbers then MPH; Race 2, same
        # file, prints MPH then numbers). Built directly rather than via
        # make_best_speeds_chunk, which only ever emits names-then-mph.
        header = "POS\n\nINTERMEDIATE 1\nNO SPEED TRAP INFORMATION\n\nINTERMEDIATE 2\n\nFINISH LINE\n\nNO NAME\n\nMPH\n\nNO NAME\n\n"
        pos_run = "1\n2\n3\n4\n5\n"
        int2_mph_first = "150.0\n148.0\n146.0\n144.0\n142.0\n"
        int2_names = "10 ALPHA\n20 BETA\n30 GAMMA\n40 DELTA\n50 ECHO\n"
        finish_names = "10 ALPHA\n20 BETA\n30 GAMMA\n40 DELTA\n50 ECHO\n"
        finish_mph = "130.0\n129.0\n128.0\n127.0\n126.0\n"
        chunk = header + pos_run + "\n" + int2_mph_first + "\n" + int2_names + "\n" + finish_names + "\n" + finish_mph
        block = s._parse_best_speeds_block(chunk)
        self.assertIsNotNone(block)
        self.assertEqual(block['intermediate2'][0], {'pos': 1, 'no': 10, 'mph': 150.0})
        self.assertEqual(len(block['intermediate2']), 5)
        self.assertEqual(block['finish'][0], {'pos': 1, 'no': 10, 'mph': 130.0})


class TestBestSpeedsHeadings(unittest.TestCase):
    """Regression coverage for real live PDF-formatting quirks that broke
    heading detection across the 2026 season (confirmed against every
    round's actual book PDF, not guessed)."""

    TITLE = "2026 Kwik Fit British Touring Car Championship"

    def test_tolerates_double_space_around_dash(self):
        # Confirmed live: "FREE PRACTICE SESSION  - BEST SPEEDS" (Brands
        # Hatch Indy) vs the usual single space elsewhere.
        text = f"{self.TITLE}\n\nFREE PRACTICE SESSION  - BEST SPEEDS\n\nPOS"
        label, pattern = next(p for p in s.BEST_SPEEDS_HEADINGS if p[0] == "Free Practice")
        self.assertIsNotNone(pattern.search(text))

    def test_tolerates_optional_embedded_round_number(self):
        # Confirmed live: some venues insert "- ROUND N" into the Qualifying
        # Part 1/2 headings, others don't - both must match.
        with_round = f"{self.TITLE}\n\nQUALIFYING - PART 1 - ROUND 4 - BEST SPEEDS\n\nPOS"
        without_round = f"{self.TITLE}\n\nQUALIFYING - PART 1 - BEST SPEEDS\n\nPOS"
        label, pattern = next(p for p in s.BEST_SPEEDS_HEADINGS if p[0] == "Qualifying Part 1")
        self.assertIsNotNone(pattern.search(with_round))
        self.assertIsNotNone(pattern.search(without_round))

    def test_qualifying_race_heading_without_round_number(self):
        # Confirmed live: Round 1's Qualifying Race heading omits the round
        # number entirely ("QUALIFYING RACE - BEST SPEEDS"), unlike every
        # other round ("QUALIFYING RACE - ROUND N - BEST SPEEDS").
        text = f"{self.TITLE}\n\nQUALIFYING RACE - BEST SPEEDS\n\nPOS"
        label, pattern = next(p for p in s.BEST_SPEEDS_HEADINGS if p[0] == "Qualifying Race")
        self.assertIsNotNone(pattern.search(text))

    def test_tolerates_a_different_era_title_sponsor(self):
        # Confirmed live: the title sponsor itself changes across years -
        # "Kwik Fit" from 2019 on, "Dunlop MSA" for 2010-2018 - and every
        # heading anchors on the page title, so a hardcoded sponsor name
        # broke heading detection entirely for the older era (not a partial
        # miss - zero reports parsed for any session, any year 2010-2018).
        older_era_title = "2016 Dunlop MSA British Touring Car Championship"
        text = f"{older_era_title}\n\nFREE PRACTICE SESSION - BEST SPEEDS\n\nPOS"
        label, pattern = next(p for p in s.BEST_SPEEDS_HEADINGS if p[0] == "Free Practice")
        self.assertIsNotNone(pattern.search(text))

    def test_title_case_is_ignored(self):
        # Confirmed live, same PDF: "championship" lowercase for Saturday
        # sessions, "Championship" capitalized for Sunday races - a TSL
        # template inconsistency.
        text = "2026 Kwik Fit British Touring Car championship\n\nFREE PRACTICE SESSION - BEST SPEEDS\n\nPOS"
        label, pattern = next(p for p in s.BEST_SPEEDS_HEADINGS if p[0] == "Free Practice")
        self.assertIsNotNone(pattern.search(text))

    def test_race_heading_not_confused_with_qualifying_race_heading(self):
        # The old lookbehind-based exclusion is gone (Python's re can't do a
        # variable-width lookbehind, which flexible whitespace would need) -
        # anchoring both patterns on the preceding title line instead makes
        # them mutually exclusive by construction: only one of "QUALIFYING
        # RACE" or "ROUND N" can immediately follow the title.
        text = (
            f"{self.TITLE}\n\nQUALIFYING RACE - ROUND 25 - BEST SPEEDS\n...\n"
            f"{self.TITLE}\n\nROUND 25 - BEST SPEEDS\n...\n"
            f"{self.TITLE}\n\nROUND 26 - BEST SPEEDS\n...\n"
            f"{self.TITLE}\n\nROUND 27 - BEST SPEEDS\n"
        )
        matches = [m.group(0).split("\n\n")[-1] for m in s.RACE_BEST_SPEEDS_RE.finditer(text)]
        self.assertEqual(matches, ['ROUND 25 - BEST SPEEDS', 'ROUND 26 - BEST SPEEDS', 'ROUND 27 - BEST SPEEDS'])


class TestMergeBestSpeedsBlocks(unittest.TestCase):

    def test_merges_resorts_and_reindexes(self):
        part1 = {'intermediate1': None,
                  'intermediate2': [{'pos': 1, 'no': 1, 'mph': 140.0}],
                  'finish': [{'pos': 1, 'no': 1, 'mph': 120.0}]}
        part2 = {'intermediate1': None,
                  'intermediate2': [{'pos': 1, 'no': 2, 'mph': 145.0}],
                  'finish': [{'pos': 1, 'no': 2, 'mph': 118.0}]}
        merged = s._merge_best_speeds_blocks(part1, part2)
        self.assertEqual([(e['pos'], e['no']) for e in merged['intermediate2']], [(1, 2), (2, 1)])
        self.assertEqual([(e['pos'], e['no']) for e in merged['finish']], [(1, 1), (2, 2)])
        self.assertIsNone(merged['intermediate1'])


class TestResolveBestSpeeds(unittest.TestCase):

    def test_resolves_car_number_to_canonical_driver_and_team(self):
        block = {'intermediate1': None,
                 'intermediate2': [{'pos': 1, 'no': 3, 'mph': 143.3}],
                 'finish': [{'pos': 1, 'no': 3, 'mph': 128.9}]}
        number_map = {3: ('Tom CHILTON', 'Team VERTU')}
        resolved = s._resolve_best_speeds(block, number_map)
        self.assertEqual(resolved['intermediate2'][0]['driver'], 'Tom CHILTON')
        self.assertEqual(resolved['intermediate2'][0]['team'], 'Team VERTU')

    def test_falls_back_to_placeholder_when_car_number_unresolved(self):
        block = {'intermediate1': None,
                 'intermediate2': [{'pos': 1, 'no': 999, 'mph': 140.0}],
                 'finish': [{'pos': 1, 'no': 999, 'mph': 120.0}]}
        resolved = s._resolve_best_speeds(block, {})
        self.assertEqual(resolved['intermediate2'][0]['driver'], 'Car 999')
        self.assertEqual(resolved['intermediate2'][0]['team'], '')

    def test_returns_none_for_none_block(self):
        self.assertIsNone(s._resolve_best_speeds(None, {}))


class TestNumberDriverMap(unittest.TestCase):

    def test_builds_from_results(self):
        race = {'results': [{'no': 3, 'driver': 'Tom CHILTON', 'team': 'Team VERTU'}], 'grid': []}
        self.assertEqual(s._number_driver_map(race), {3: ('Tom CHILTON', 'Team VERTU')})

    def test_falls_back_to_grid_when_no_results(self):
        race = {'results': [], 'grid': [{'no': 3, 'driver': 'Tom CHILTON', 'team': 'Team VERTU'}]}
        self.assertEqual(s._number_driver_map(race), {3: ('Tom CHILTON', 'Team VERTU')})


# ── weather ──────────────────────────────────────────────────────────────────

class TestParseWeatherLine(unittest.TestCase):

    def test_extracts_condition_and_track(self):
        chunk = "some report text\nWeather / Track : Cloudy / Dry\nmore text\n"
        self.assertEqual(s._parse_weather_line(chunk), {'condition': 'Cloudy', 'track': 'Dry'})

    def test_distinguishes_wet_race_from_dry_sessions(self):
        # Confirmed live, Round 9/Silverstone: Race 3 alone ran wet.
        chunk = "Weather / Track : Rain / Wet\n"
        self.assertEqual(s._parse_weather_line(chunk), {'condition': 'Rain', 'track': 'Wet'})

    def test_returns_none_when_no_weather_line_present(self):
        self.assertIsNone(s._parse_weather_line("no weather info here"))


class TestParseWeather(unittest.TestCase):

    TITLE = "2026 Kwik Fit British Touring Car Championship"

    def test_parses_free_practice_and_race_weather(self):
        text = (
            f"{self.TITLE}\n\nFREE PRACTICE SESSION - BEST SPEEDS\n\nPOS\n"
            f"Weather / Track : Cloudy / Dry\n\n"
            f"{self.TITLE}\n\nROUND 9 - BEST SPEEDS\n\nPOS\n"
            f"Weather / Track : Rain / Wet\n"
        )
        result = s.parse_weather(text)
        self.assertEqual(result['Free Practice'], {'condition': 'Cloudy', 'track': 'Dry'})
        self.assertEqual(result['Race 1'], {'condition': 'Rain', 'track': 'Wet'})
        self.assertIsNone(result['Race 2'])

    def test_qualifying_uses_part1_falling_back_to_part2(self):
        text = (
            f"{self.TITLE}\n\nQUALIFYING - PART 1 - BEST SPEEDS\n\nPOS\n"
            f"Weather / Track : Bright / Dry\n\n"
            f"{self.TITLE}\n\nQUALIFYING - PART 2 - BEST SPEEDS\n\nPOS\n"
            f"Weather / Track : Overcast / Dry\n"
        )
        self.assertEqual(s.parse_weather(text)['Qualifying'], {'condition': 'Bright', 'track': 'Dry'})

    def test_qualifying_falls_back_to_part2_when_part1_missing(self):
        text = (
            f"{self.TITLE}\n\nQUALIFYING - PART 2 - BEST SPEEDS\n\nPOS\n"
            f"Weather / Track : Overcast / Dry\n"
        )
        self.assertEqual(s.parse_weather(text)['Qualifying'], {'condition': 'Overcast', 'track': 'Dry'})


# ── flag statistics ─────────────────────────────────────────────────────────

class TestParseFlagStatsBlock(unittest.TestCase):

    def test_extracts_all_four_counts(self):
        chunk = "Flag Statistics\nTYPE\nGreen\nRed\nSafety Car\nFCY\nCOUNT\n1\n0\n1\n2\n"
        self.assertEqual(s._parse_flag_stats_block(chunk), {'green': 1, 'red': 0, 'safetyCar': 1, 'fcy': 2})

    def test_all_zero_counts_for_an_incident_free_session(self):
        chunk = "Flag Statistics\nTYPE\nGreen\nRed\nSafety Car\nFCY\nCOUNT\n1\n0\n0\n0\n"
        self.assertEqual(s._parse_flag_stats_block(chunk), {'green': 1, 'red': 0, 'safetyCar': 0, 'fcy': 0})

    def test_returns_none_when_no_flag_statistics_block_present(self):
        self.assertIsNone(s._parse_flag_stats_block("no flag data here"))


class TestParseFlagStats(unittest.TestCase):

    TITLE = "2026 Kwik Fit British Touring Car Championship"

    def test_race_with_safety_car_distinguished_from_clean_race(self):
        # Confirmed live, Round 9: Qualifying Race ran behind a real Safety
        # Car while every other session that weekend was flag-incident-free.
        text = (
            f"{self.TITLE}\n\nQUALIFYING RACE - BEST SPEEDS\n\nPOS\n"
            f"Flag Statistics\nTYPE\nGreen\nRed\nSafety Car\nFCY\nCOUNT\n1\n0\n1\n0\n\n"
            f"{self.TITLE}\n\nROUND 9 - BEST SPEEDS\n\nPOS\n"
            f"Flag Statistics\nTYPE\nGreen\nRed\nSafety Car\nFCY\nCOUNT\n1\n0\n0\n0\n"
        )
        result = s.parse_flag_stats(text)
        self.assertEqual(result['Qualifying Race'], {'green': 1, 'red': 0, 'safetyCar': 1, 'fcy': 0})
        self.assertEqual(result['Race 1'], {'green': 1, 'red': 0, 'safetyCar': 0, 'fcy': 0})

    def test_qualifying_sums_part1_and_part2_counts(self):
        text = (
            f"{self.TITLE}\n\nQUALIFYING - PART 1 - BEST SPEEDS\n\nPOS\n"
            f"Flag Statistics\nTYPE\nGreen\nRed\nSafety Car\nFCY\nCOUNT\n1\n0\n0\n1\n\n"
            f"{self.TITLE}\n\nQUALIFYING - PART 2 - BEST SPEEDS\n\nPOS\n"
            f"Flag Statistics\nTYPE\nGreen\nRed\nSafety Car\nFCY\nCOUNT\n1\n0\n1\n0\n"
        )
        self.assertEqual(s.parse_flag_stats(text)['Qualifying'], {'green': 2, 'red': 0, 'safetyCar': 1, 'fcy': 1})


# ── best sectors (Perfect Lap) ──────────────────────────────────────────────

def make_best_sectors_chunk(numbers, names, ideal, best, diff, is_race, extra_ideal=None):
    """Build a synthetic Best Sectors text chunk in the real book-PDF shape:
    a leaderboard POS run (content irrelevant, only its length matters for
    the anchor-skip logic) + filler, then the REAL POS run immediately
    preceding this table, then N car numbers, N surname lines, an optional
    session-summary lap time (non-race sessions only, confirmed live),
    then N IDEAL, N BEST, N DIFF lines."""
    n = len(numbers)
    leaderboard_pos_run = "".join(f"{i + 1}\n" for i in range(n))
    filler = "".join(f"{10 + i}.000\n" for i in range(n)) + "".join(f"{20 + i}.000\n" for i in range(n))
    real_pos_run = "".join(f"{i + 1}\n" for i in range(n))
    number_lines = "".join(f"{no}\n" for no in numbers)
    name_lines = "".join(f"{name}\n" for name in names)
    extra = f"{extra_ideal}\n" if (not is_race and extra_ideal is not None) else ""
    ideal_lines = "".join(f"{v}\n" for v in ideal)
    best_lines = "".join(f"{v}\n" for v in best)
    diff_lines = "".join(f"{v}\n" for v in diff)
    return (leaderboard_pos_run + filler + real_pos_run + number_lines + name_lines
            + extra + ideal_lines + best_lines + diff_lines)


class TestParseBestSectorsBlock(unittest.TestCase):

    NOS = [10, 20, 30, 40, 50]
    NAMES = ['ALPHA', 'BETA', 'GAMMA', 'DELTA', 'ECHO']

    def test_non_race_session_skips_leading_theoretical_summary_value(self):
        # Confirmed live: non-race sessions print one extra lap time (the
        # session's fastest S1+S2+S3 combined, from up to three different
        # drivers) before the real per-driver IDEAL column begins.
        chunk = make_best_sectors_chunk(
            self.NOS, self.NAMES,
            ideal=[56.500, 56.600, 56.700, 56.800, 56.900],
            best=[56.800, 56.900, 57.000, 57.100, 57.200],
            diff=[0.300, 0.300, 0.300, 0.300, 0.300],
            is_race=False, extra_ideal=56.100,
        )
        block = s._parse_best_sectors_block(chunk, is_race=False)
        self.assertEqual(block[0], {'no': 10, 'ideal': 56.500, 'best': 56.800, 'diff': 0.300})
        self.assertEqual(len(block), 5)

    def test_race_session_has_no_leading_summary_value(self):
        # Confirmed live: races never print that extra leading value -
        # skipping it unconditionally would discard a real driver's ideal.
        chunk = make_best_sectors_chunk(
            self.NOS, self.NAMES,
            ideal=[56.500, 56.600, 56.700, 56.800, 56.900],
            best=[56.800, 56.900, 57.000, 57.100, 57.200],
            diff=[0.300, 0.300, 0.300, 0.300, 0.300],
            is_race=True,
        )
        block = s._parse_best_sectors_block(chunk, is_race=True)
        self.assertEqual(block[0], {'no': 10, 'ideal': 56.500, 'best': 56.800, 'diff': 0.300})

    def test_race_session_best_lap_over_a_minute_parsed_as_mmss(self):
        # Confirmed live: a driver's BEST lap can print as "1:01.112"
        # (M:SS.mmm) rather than plain seconds when it exceeds 60s - a plain
        # decimal-only scan silently drops that line and shifts every value
        # after it by one position.
        chunk = make_best_sectors_chunk(
            self.NOS, self.NAMES,
            ideal=[56.500, 56.600, 56.700, 56.800, 56.900],
            best=['1:01.112', 57.000, 57.100, 57.200, 57.300],
            diff=[4.612, 0.400, 0.400, 0.400, 0.400],
            is_race=True,
        )
        block = s._parse_best_sectors_block(chunk, is_race=True)
        self.assertEqual(block[0], {'no': 10, 'ideal': 56.500, 'best': 61.112, 'diff': 4.612})

    def test_entry_failing_diff_equals_best_minus_ideal_invariant_is_dropped(self):
        # Confirmed live (Round 9, all three races): exactly one row per
        # race session fails this hard invariant by a huge, physically
        # impossible margin. Rather than discard an otherwise-good table
        # over one bad row, that row alone is filtered out.
        chunk = make_best_sectors_chunk(
            self.NOS, self.NAMES,
            ideal=[56.500, 56.600, 56.700, 56.800, 56.900],
            best=[56.800, 56.900, 57.000, 57.100, 57.200],
            diff=[99.900, 0.300, 0.300, 0.300, 0.300],
            is_race=True,
        )
        block = s._parse_best_sectors_block(chunk, is_race=True)
        self.assertEqual([e['no'] for e in block], [20, 30, 40, 50])

    def test_returns_none_when_fewer_than_two_pos_runs_found(self):
        self.assertIsNone(s._parse_best_sectors_block("some unrelated text\nwith no table in it", is_race=False))


class TestBestSectorsHeadings(unittest.TestCase):

    TITLE = "2026 Kwik Fit British Touring Car Championship"

    def test_free_practice_heading_matches(self):
        text = f"{self.TITLE}\n\nFREE PRACTICE SESSION - BEST SECTORS\n\nPOS"
        label, pattern = next(p for p in s.BEST_SECTORS_HEADINGS if p[0] == "Free Practice")
        self.assertIsNotNone(pattern.search(text))

    def test_race_heading_matches_and_is_not_confused_with_qualifying_race(self):
        text = (
            f"{self.TITLE}\n\nQUALIFYING RACE - ROUND 9 - BEST SECTORS\n...\n"
            f"{self.TITLE}\n\nROUND 9 - BEST SECTORS\n"
        )
        matches = [m.group(0).split("\n\n")[-1] for m in s.RACE_BEST_SECTORS_RE.finditer(text)]
        self.assertEqual(matches, ['ROUND 9 - BEST SECTORS'])


class TestMergeBestSectorsBlocks(unittest.TestCase):

    def test_merges_and_resorts_by_ideal_ascending(self):
        part1 = [{'no': 1, 'ideal': 57.0, 'best': 57.2, 'diff': 0.2}]
        part2 = [{'no': 2, 'ideal': 56.5, 'best': 56.8, 'diff': 0.3}]
        merged = s._merge_best_sectors_blocks(part1, part2)
        self.assertEqual([e['no'] for e in merged], [2, 1])


class TestResolveBestSectors(unittest.TestCase):

    def test_resolves_car_number_to_canonical_driver_and_team(self):
        entries = [{'no': 3, 'ideal': 56.5, 'best': 56.8, 'diff': 0.3}]
        resolved = s._resolve_best_sectors(entries, {3: ('Tom CHILTON', 'Team VERTU')})
        self.assertEqual(resolved[0]['driver'], 'Tom CHILTON')
        self.assertEqual(resolved[0]['team'], 'Team VERTU')

    def test_falls_back_to_placeholder_when_car_number_unresolved(self):
        entries = [{'no': 999, 'ideal': 56.5, 'best': 56.8, 'diff': 0.3}]
        resolved = s._resolve_best_sectors(entries, {})
        self.assertEqual(resolved[0]['driver'], 'Car 999')
        self.assertEqual(resolved[0]['team'], '')

    def test_returns_none_for_empty_entries(self):
        self.assertIsNone(s._resolve_best_sectors(None, {}))
        self.assertIsNone(s._resolve_best_sectors([], {}))


# ── merge_scraped_with_existing ───────────────────────────────────────────────

def make_grid(*car_nos):
    """Build a minimal grid list from an ordered sequence of car numbers."""
    return [{'pos': i + 1, 'no': no, 'cl': '', 'driver': f'Driver{no}', 'team': ''} for i, no in enumerate(car_nos)]

def make_scraped_round(r3_grid=None, r3_results=None, r3_draw=None, r3_best_speeds=None,
                        r3_weather=None, r3_flag_stats=None, r3_best_sectors=None):
    r3 = {'label': 'Race 3', 'results': r3_results or [], 'grid': r3_grid or []}
    if r3_draw is not None:
        r3['reverseGridDraw'] = r3_draw
    if r3_best_speeds is not None:
        r3['bestSpeeds'] = r3_best_speeds
    if r3_weather is not None:
        r3['weather'] = r3_weather
    if r3_flag_stats is not None:
        r3['flagStats'] = r3_flag_stats
    if r3_best_sectors is not None:
        r3['bestSectors'] = r3_best_sectors
    return {
        'round': 1, 'venue': 'Test', 'date': '01 Jan', 'youtubeUrls': [],
        'races': [{'label': 'Race 1', 'results': [], 'grid': []}, r3],
    }

def make_existing_round(r3_grid=None, r3_results=None, r3_draw=None, youtube=None, r3_best_speeds=None,
                         r3_weather=None, r3_flag_stats=None, r3_best_sectors=None):
    r3 = {'label': 'Race 3', 'results': r3_results or [], 'grid': r3_grid or []}
    if r3_draw is not None:
        r3['reverseGridDraw'] = r3_draw
    if r3_best_speeds is not None:
        r3['bestSpeeds'] = r3_best_speeds
    if r3_weather is not None:
        r3['weather'] = r3_weather
    if r3_flag_stats is not None:
        r3['flagStats'] = r3_flag_stats
    if r3_best_sectors is not None:
        r3['bestSectors'] = r3_best_sectors
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

    def test_old_best_speeds_preserved_when_book_fetch_fails(self):
        # Transient book-fetch failure this tick shouldn't wipe previously-
        # scraped speed data.
        old_speeds = {'intermediate1': None, 'intermediate2': [], 'finish': []}
        scraped  = make_scraped_round()  # no bestSpeeds this run
        existing = make_existing_round(r3_best_speeds=old_speeds)
        s.merge_scraped_with_existing(scraped, existing)
        self.assertEqual(self._r3(scraped)['bestSpeeds'], old_speeds)

    def test_new_best_speeds_not_overwritten_by_old(self):
        old_speeds = {'intermediate1': None, 'intermediate2': [{'pos': 1, 'no': 1, 'name': 'OLD', 'mph': 100.0}], 'finish': []}
        new_speeds = {'intermediate1': None, 'intermediate2': [{'pos': 1, 'no': 1, 'name': 'NEW', 'mph': 140.0}], 'finish': []}
        scraped  = make_scraped_round(r3_best_speeds=new_speeds)
        existing = make_existing_round(r3_best_speeds=old_speeds)
        s.merge_scraped_with_existing(scraped, existing)
        self.assertEqual(self._r3(scraped)['bestSpeeds']['intermediate2'][0]['name'], 'NEW')

    def test_old_weather_flag_stats_best_sectors_preserved_when_book_fetch_fails(self):
        old_weather = {'condition': 'Rain', 'track': 'Wet'}
        old_flags = {'green': 1, 'red': 0, 'safetyCar': 1, 'fcy': 0}
        old_sectors = [{'no': 1, 'driver': 'OLD', 'team': '', 'ideal': 56.5, 'best': 56.8, 'diff': 0.3}]
        scraped  = make_scraped_round()  # no book data this run
        existing = make_existing_round(r3_weather=old_weather, r3_flag_stats=old_flags, r3_best_sectors=old_sectors)
        s.merge_scraped_with_existing(scraped, existing)
        r3 = self._r3(scraped)
        self.assertEqual(r3['weather'], old_weather)
        self.assertEqual(r3['flagStats'], old_flags)
        self.assertEqual(r3['bestSectors'], old_sectors)

    def test_new_weather_flag_stats_best_sectors_not_overwritten_by_old(self):
        new_weather = {'condition': 'Cloudy', 'track': 'Dry'}
        new_flags = {'green': 1, 'red': 0, 'safetyCar': 0, 'fcy': 0}
        new_sectors = [{'no': 1, 'driver': 'NEW', 'team': '', 'ideal': 56.5, 'best': 56.8, 'diff': 0.3}]
        scraped  = make_scraped_round(r3_weather=new_weather, r3_flag_stats=new_flags, r3_best_sectors=new_sectors)
        existing = make_existing_round(
            r3_weather={'condition': 'Rain', 'track': 'Wet'},
            r3_flag_stats={'green': 1, 'red': 0, 'safetyCar': 1, 'fcy': 0},
            r3_best_sectors=[{'no': 1, 'driver': 'OLD', 'team': '', 'ideal': 56.5, 'best': 56.8, 'diff': 0.3}],
        )
        s.merge_scraped_with_existing(scraped, existing)
        r3 = self._r3(scraped)
        self.assertEqual(r3['weather'], new_weather)
        self.assertEqual(r3['flagStats'], new_flags)
        self.assertEqual(r3['bestSectors'], new_sectors)


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


# ── _build_results_output ────────────────────────────────────────────────────
# Regression coverage for a season-long bug fixed 2026-09-09: main() used to
# serialize+write results{year}.json immediately after output_rounds was
# assembled, then apply the championship-PDF per-race override to
# output_rounds afterward once the PDF had been fetched - so the override
# was always computed correctly but never reached the file. Every per-race
# point value on disk stayed the locally-reconstructed one (this file's own
# fastestLap/leadLap-bonus detection), letting results{year}.json's summed
# points drift from standings.json's official total for several drivers
# despite the override itself being correct. _build_results_output exists
# specifically so the override is applied to whatever gets returned, before
# any caller can serialize it - not something a caller can get wrong by
# sequencing two separate steps in the wrong order.
class TestBuildResultsOutput(unittest.TestCase):

    def _rounds_with_one_result(self, points):
        return [{
            'round': 1, 'venue': 'Test', 'date': '01 Jan', 'youtubeUrls': [],
            'races': [{'label': 'Race 1', 'results': [
                {'driver': 'Tom INGRAM', 'pos': 2, 'points': points},
            ], 'grid': []}],
        }]

    def test_the_returned_dict_already_reflects_the_championship_pdf_override(self):
        rounds = self._rounds_with_one_result(points=17)  # locally-computed (wrong) value
        per_race = {'Tom INGRAM': {(1, 'Race 1'): 18}}     # authoritative PDF value
        out = s._build_results_output(2026, rounds, per_race, {(1, 'Race 1')})
        result = out['rounds'][0]['races'][0]['results'][0]
        self.assertEqual(result['points'], 18)

    def test_mutates_and_returns_the_same_rounds_object_the_caller_passed_in(self):
        # Confirms there's no second, un-overridden copy anywhere a future
        # caller could accidentally serialize instead of this one.
        rounds = self._rounds_with_one_result(points=17)
        per_race = {'Tom INGRAM': {(1, 'Race 1'): 18}}
        out = s._build_results_output(2026, rounds, per_race, {(1, 'Race 1')})
        self.assertIs(out['rounds'], rounds)
        self.assertEqual(rounds[0]['races'][0]['results'][0]['points'], 18)

    def test_is_a_safe_no_op_when_no_championship_pdf_was_available(self):
        # Matches main()'s own per_race={}, scored_sessions=set() default when
        # every championship-PDF fetch attempt failed - must leave the
        # locally-computed points untouched, not wipe them to 0.
        rounds = self._rounds_with_one_result(points=17)
        out = s._build_results_output(2026, rounds, {}, set())
        self.assertEqual(out['rounds'][0]['races'][0]['results'][0]['points'], 17)

    def test_includes_the_season_key(self):
        out = s._build_results_output(2026, self._rounds_with_one_result(points=17), {}, set())
        self.assertEqual(out['season'], '2026')


# ── _normalize_team_entries ──────────────────────────────────────────────────
# Regression: 2026-08-22, Donington Park GP round 7 - the official TSL teams
# championship PDF listed "Cataclean Plato Racing" (282pts) and its renamed
# successor "CPRL" (0pts) as two separate rows for the same team, corrupting
# the Teams tab with a phantom last-place duplicate.

class TestNormalizeTeamEntries(unittest.TestCase):
    # TEAM_NAME_ALIASES ships empty as of 2026-08-28 (see its own comment -
    # the one alias it used to hold, Cataclean Plato Racing -> CPRL, is now a
    # deliberate permanent split the app mirrors rather than merges). The
    # merge mechanism itself is still real, reusable machinery for a genuinely
    # transient future duplicate, so these tests configure a throwaway alias
    # via mock.patch.dict rather than asserting on that one specific pair.

    def test_merges_aliased_name_into_canonical_name(self):
        entries = [
            {'pos': 4, 'team': 'Old Team Name', 'points': 282},
            {'pos': 10, 'team': 'New Team Name', 'points': 0},
        ]
        with mock.patch.dict(s.TEAM_NAME_ALIASES, {'Old Team Name': 'New Team Name'}, clear=True):
            result = s._normalize_team_entries(entries)
        self.assertEqual([e['team'] for e in result].count('New Team Name'), 1)
        self.assertEqual([e for e in result if e['team'] == 'New Team Name'][0]['points'], 282)

    def test_reranks_contiguously_by_points_after_merge(self):
        entries = [
            {'pos': 1, 'team': 'Team VERTU', 'points': 333},
            {'pos': 4, 'team': 'Old Team Name', 'points': 282},
            {'pos': 5, 'team': 'Restart Racing', 'points': 187},
            {'pos': 10, 'team': 'New Team Name', 'points': 0},
        ]
        with mock.patch.dict(s.TEAM_NAME_ALIASES, {'Old Team Name': 'New Team Name'}, clear=True):
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
            {'pos': 3, 'team': 'Old Team Name', 'points': 200},
            {'pos': 7, 'team': 'New Team Name', 'points': 50},
        ]
        with mock.patch.dict(s.TEAM_NAME_ALIASES, {'Old Team Name': 'New Team Name'}, clear=True):
            result = s._normalize_team_entries(entries)
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0], {'pos': 1, 'team': 'New Team Name', 'points': 250})

    def test_ships_with_no_aliases_configured(self):
        # Cataclean Plato Racing / CPRL is a deliberate permanent split, not
        # an alias to merge - guards against it (or any other pair) silently
        # creeping back into the default config.
        self.assertEqual(s.TEAM_NAME_ALIASES, {})


class TestMergeStandingsTimestamp(unittest.TestCase):
    """Regression coverage for the 2026-09-06 fix: standings.json's `updated`
    field used to get re-stamped on every scrape tick regardless of whether
    anything else actually changed, so git-auto-commit-action committed this
    file on essentially every 2-minute tick during a raceday (confirmed live:
    round 7/Donington GP weekend logged 193 commits to this file, all but ~8
    of them differing from their predecessor only in this one field)."""

    def test_reverts_to_existing_timestamp_when_nothing_else_changed(self):
        existing = {'season': '2026', 'round': 8, 'standings': [{'driver': 'A', 'points': 20}], 'updated': '2026-09-06T09:00:00Z'}
        new = {'season': '2026', 'round': 8, 'standings': [{'driver': 'A', 'points': 20}], 'updated': '2026-09-06T09:02:00Z'}
        result = s.merge_standings_timestamp(new, existing)
        self.assertEqual(result['updated'], '2026-09-06T09:00:00Z')

    def test_keeps_fresh_timestamp_when_standings_data_genuinely_changed(self):
        existing = {'season': '2026', 'round': 8, 'standings': [{'driver': 'A', 'points': 20}], 'updated': '2026-09-06T09:00:00Z'}
        new = {'season': '2026', 'round': 8, 'standings': [{'driver': 'A', 'points': 40}], 'updated': '2026-09-06T09:02:00Z'}
        result = s.merge_standings_timestamp(new, existing)
        self.assertEqual(result['updated'], '2026-09-06T09:02:00Z')

    def test_keeps_fresh_timestamp_on_first_ever_run(self):
        new = {'season': '2026', 'round': 8, 'standings': [{'driver': 'A', 'points': 20}], 'updated': '2026-09-06T09:02:00Z'}
        result = s.merge_standings_timestamp(new, None)
        self.assertEqual(result['updated'], '2026-09-06T09:02:00Z')

    def test_keeps_fresh_timestamp_when_round_or_venue_changed(self):
        # Same standings values, but a new round has started - a real change
        # even though `standings` itself is unchanged.
        existing = {'season': '2026', 'round': 7, 'venue': 'Donington Park GP', 'standings': [{'driver': 'A', 'points': 20}], 'updated': '2026-09-06T09:00:00Z'}
        new = {'season': '2026', 'round': 8, 'venue': 'Croft', 'standings': [{'driver': 'A', 'points': 20}], 'updated': '2026-09-06T09:02:00Z'}
        result = s.merge_standings_timestamp(new, existing)
        self.assertEqual(result['updated'], '2026-09-06T09:02:00Z')

    def test_does_not_mutate_the_existing_dict(self):
        existing = {'season': '2026', 'standings': [], 'updated': '2026-09-06T09:00:00Z'}
        existing_copy = dict(existing)
        new = {'season': '2026', 'standings': [], 'updated': '2026-09-06T09:02:00Z'}
        s.merge_standings_timestamp(new, existing)
        self.assertEqual(existing, existing_copy)


class TestParseLapsLed(unittest.TestCase):
    """parse_laps_led had zero test coverage before this - a real bug (see
    _session_leader_history_label) shipped and wasn't caught until a much
    later backfill turned up wrong championship points."""

    TITLE = "2026 Kwik Fit British Touring Car Championship"

    def _leader_block(self, names):
        return "Session Leader History\n\nNAME\n\n" + "".join(f"{n}\n" for n in names) + "FROM LAP\n\n1\n"

    def test_labels_by_nearest_preceding_statistics_heading_not_position(self):
        # Confirmed live (2019): a year with no Qualifying Race has only 3
        # Session Leader History sections, not 4 - assuming position i
        # always maps to BOOK_SESSION_ORDER[i] skipped the first real
        # section as "Qualifying Race" and lost Race 3 entirely.
        text = (
            f"{self.TITLE}\n\nROUND 1 - STATISTICS\n\n" + self._leader_block(["Ashley SUTTON"]) +
            f"{self.TITLE}\n\nROUND 2 - STATISTICS\n\n" + self._leader_block(["Josh COOK"]) +
            f"{self.TITLE}\n\nROUND 3 - STATISTICS\n\n" + self._leader_block(["Tom INGRAM"])
        )
        result = s.parse_laps_led(text)
        self.assertEqual(result.get("Race 1"), {"Ashley SUTTON"})
        self.assertEqual(result.get("Race 2"), {"Josh COOK"})
        self.assertEqual(result.get("Race 3"), {"Tom INGRAM"})

    def test_qualifying_race_is_skipped_but_races_after_it_still_label_correctly(self):
        text = (
            f"{self.TITLE}\n\nQUALIFYING RACE - STATISTICS\n\n" + self._leader_block(["Dan CAMMISH"]) +
            f"{self.TITLE}\n\nROUND 1 - STATISTICS\n\n" + self._leader_block(["Ashley SUTTON"]) +
            f"{self.TITLE}\n\nROUND 2 - STATISTICS\n\n" + self._leader_block(["Josh COOK"])
        )
        result = s.parse_laps_led(text)
        self.assertNotIn("Qualifying Race", result)
        self.assertEqual(result.get("Race 1"), {"Ashley SUTTON"})
        self.assertEqual(result.get("Race 2"), {"Josh COOK"})

    def test_returns_empty_when_no_statistics_heading_exists_at_all(self):
        # Confirmed live (2014-2018): some years' book PDFs never had a
        # STATISTICS report at all - no anchor to label against, so this
        # must degrade to "no data" rather than guessing a label.
        text = "Session Leader History\n\nNAME\n\nAshley SUTTON\nFROM LAP\n\n1\n"
        self.assertEqual(s.parse_laps_led(text), {})


def make_lap_chart_page(lap_blocks):
    """Build a synthetic single-page Lap Chart text chunk in the real
    book-PDF shape (confirmed live via pdfminer.extract_text on the 2026
    Donington GP and 2019 Silverstone book PDFs): every page's own
    "LAP N" / "@ timestamp" header pairs are grouped together up front, in
    order, followed by one repeat of "NO BEHIND LAP TIME" per block, then
    the blocks' own column-grouped data in sequence (N car numbers, N-1
    gaps, N lap times per block).

    `lap_blocks` is a list of (lap_no, timestamp, rows) where rows is a
    list of (car_no, gap, lap_time) - gap is None for the leader's row, a
    float/str("M:SS.mmm") for a real gap, or ("lapped", n) for a lapped
    car's "n Lap(s)" marker; lap_time is a float seconds value or a literal
    "M:SS.mmm" string."""
    headers = "".join(f"LAP {lap_no}\n\n@ {ts}\n\n" for lap_no, ts, _ in lap_blocks)
    labels = "NO BEHIND LAP TIME\n\n" * len(lap_blocks)
    blocks = ""
    for _, _, rows in lap_blocks:
        blocks += "".join(f"{no}\n" for no, _gap, _t in rows)
        for _no, gap, _t in rows[1:]:
            if isinstance(gap, tuple):
                blocks += f"{gap[1]} Laps\n"
            else:
                blocks += f"{gap}\n"
        for _no, _gap, t in rows:
            blocks += f"{t}\n"
    return headers + labels + blocks


class TestCollectConsecutiveInts(unittest.TestCase):

    def test_stops_at_first_non_integer_line_no_preknown_count(self):
        lines = ["33", "32", "66", "0.409", "1:39.503"]
        numbers, idx = s._collect_consecutive_ints(lines, 0)
        self.assertEqual(numbers, [33, 32, 66])
        self.assertEqual(idx, 3)

    def test_skip_to_next_int_line_passes_over_header_labels(self):
        lines = ["NO BEHIND LAP TIME", "NO BEHIND LAP TIME", "33"]
        idx = s._skip_to_next_int_line(lines, 0)
        self.assertEqual(idx, 2)


class TestCollectLapChartGaps(unittest.TestCase):

    def test_plain_float_gap(self):
        values, idx = s._collect_lap_chart_gaps(["0.409", "1.226"], 0, 2)
        self.assertEqual(values, [0.409, 1.226])
        self.assertEqual(idx, 2)

    def test_lapped_marker_replaces_gap(self):
        values, idx = s._collect_lap_chart_gaps(["0.409", "2 Laps", "1.551"], 0, 3)
        self.assertEqual(values, [0.409, ("lapped", 2), 1.551])

    def test_singular_lap_marker(self):
        values, _ = s._collect_lap_chart_gaps(["1 Lap"], 0, 1)
        self.assertEqual(values, [("lapped", 1)])

    def test_gap_over_a_minute_parsed_as_mmss(self):
        # Confirmed live (Round 7/Donington GP, Race 3 page 2): a gap can
        # exceed 60 seconds before the car is marked a full lap down, and
        # prints as "M:SS.mmm" same as an over-a-minute lap time does. This
        # was the real bug: without it, the collector stopped one entry
        # short, under-filling this n-sized collection, which then failed
        # the caller's len(gaps) == n-1 check and silently discarded every
        # remaining lap on the page.
        values, idx = s._collect_lap_chart_gaps(["5.147", "1:29.453"], 0, 2)
        self.assertEqual(values, [5.147, 89.453])
        self.assertEqual(idx, 2)

    def test_stops_short_rather_than_skip_past_unrelated_footer_text(self):
        values, idx = s._collect_lap_chart_gaps(["0.409", "Weather / Track : Dry"], 0, 2)
        self.assertEqual(values, [0.409])
        self.assertEqual(idx, 1)


class TestParseLapChartPage(unittest.TestCase):

    def test_parses_multiple_blocks_with_lap_numbers_and_timestamps(self):
        page = make_lap_chart_page([
            (1, "15:14:06.496", [(33, None, 99.094), (32, 0.409, 99.503), (66, 0.949, 100.043)]),
            (2, "15:15:47.175", [(33, None, 100.679), (32, 0.427, 100.697), (66, 1.221, 100.951)]),
        ])
        blocks = s._parse_lap_chart_page(page)
        self.assertEqual(len(blocks), 2)
        self.assertEqual(blocks[0]["lap"], 1)
        self.assertEqual(blocks[0]["timeOfDay"], "15:14:06.496")
        self.assertEqual(blocks[0]["order"][0], {"no": 33, "gapSeconds": None, "lapsDown": None, "lapTimeSeconds": 99.094})
        self.assertEqual(blocks[0]["order"][1], {"no": 32, "gapSeconds": 0.409, "lapsDown": None, "lapTimeSeconds": 99.503})
        self.assertEqual(blocks[1]["lap"], 2)

    def test_lapped_car_marker_sets_laps_down_not_gap(self):
        page = make_lap_chart_page([
            (6, "15:23:46.785", [(33, None, 100.0), (32, 0.251, 101.0), (2, ("lapped", 2), 354.668)]),
        ])
        blocks = s._parse_lap_chart_page(page)
        row = blocks[0]["order"][2]
        self.assertEqual(row, {"no": 2, "gapSeconds": None, "lapsDown": 2, "lapTimeSeconds": 354.668})

    def test_trailing_pit_marker_is_consumed_and_does_not_corrupt_next_block(self):
        # Confirmed live: a literal "P" can print right after a block's own
        # lap times (pit visit that lap). It isn't attributable to a
        # specific row from text order alone (see docstring), but it MUST
        # be consumed - otherwise it gets misread as the next lap-block's
        # own leading car number.
        page = (
            "LAP 6\n\n@ 15:23:46.785\n\nLAP 7\n\n@ 15:25:22.092\n\n"
            "NO BEHIND LAP TIME\n\nNO BEHIND LAP TIME\n\n"
            "33\n2\n\n0.251\n\n100.0\n354.668\n\nP\n\n"
            "33\n50\n\n0.5\n\n101.0\n102.0\n"
        )
        blocks = s._parse_lap_chart_page(page)
        self.assertEqual(len(blocks), 2)
        self.assertEqual([r["no"] for r in blocks[1]["order"]], [33, 50])

    def test_shrinking_car_count_across_blocks_is_handled(self):
        # Confirmed live: a car can retire mid-race, so a later lap-block's
        # own car count can be less than an earlier one's - no fixed n is
        # assumed across blocks.
        page = make_lap_chart_page([
            (1, "15:14:06.496", [(33, None, 90.0), (32, 0.4, 90.5), (66, 0.9, 91.0)]),
            (2, "15:15:47.175", [(33, None, 90.1), (32, 0.5, 90.6)]),
        ])
        blocks = s._parse_lap_chart_page(page)
        self.assertEqual(len(blocks[0]["order"]), 3)
        self.assertEqual(len(blocks[1]["order"]), 2)

    def test_no_lap_chart_headers_returns_empty_list(self):
        self.assertEqual(s._parse_lap_chart_page("some unrelated page text\nwith no table in it"), [])

    def test_truncated_final_block_is_dropped_not_misparsed(self):
        # A page cut off mid-block (e.g. a malformed/partial fetch) must
        # come back with only the complete blocks before it, not a
        # corrupted partial one.
        page = (
            "LAP 1\n\n@ 15:14:06.496\n\nLAP 2\n\n@ 15:15:47.175\n\n"
            "NO BEHIND LAP TIME\n\nNO BEHIND LAP TIME\n\n"
            "33\n32\n\n0.4\n\n90.0\n90.5\n\n"
            "33\n32\n\n0.5\n\n90.1\n"  # missing the second lap time entirely
        )
        blocks = s._parse_lap_chart_page(page)
        self.assertEqual(len(blocks), 1)
        self.assertEqual(blocks[0]["lap"], 1)


class TestParseLapChart(unittest.TestCase):

    TITLE = "2026 Kwik Fit British Touring Car Championship"

    def _page(self, round_no, lap_blocks):
        header = f"{self.TITLE}\n\nROUND {round_no} - LAP CHART\n\n"
        return header + make_lap_chart_page(lap_blocks)

    def test_groups_pages_by_first_seen_round_digit_into_race_1_2_3(self):
        # Confirmed live: the heading's own digit is this book's internal
        # session counter (e.g. "ROUND 19/20/21"), never the literal race
        # number - races are told apart by which distinct digit is seen
        # first/second/third, not by the digit's value.
        text = "\x0c".join([
            self._page("19", [(1, "15:14:06.496", [(33, None, 90.0), (32, 0.4, 90.5)])]),
            self._page("19", [(2, "15:15:47.175", [(33, None, 90.1), (32, 0.5, 90.6)])]),
            self._page("20", [(1, "14:53:09.752", [(50, None, 91.0), (17, 0.3, 91.3)])]),
            self._page("21", [(1, "17:42:42.538", [(80, None, 92.0), (22, 0.2, 92.2)])]),
        ])
        result = s.parse_lap_chart(text)
        self.assertEqual(sorted(result.keys()), ["Race 1", "Race 2", "Race 3"])
        self.assertEqual(len(result["Race 1"]), 2)  # both round-19 pages concatenated
        self.assertEqual(len(result["Race 2"]), 1)
        self.assertEqual(result["Race 2"][0]["order"][0]["no"], 50)
        self.assertEqual(result["Race 3"][0]["order"][0]["no"], 80)

    def test_qualifying_race_prefixed_heading_is_excluded(self):
        # Confirmed live (Round 7/Donington GP): the Qualifying Race's own
        # Lap Chart heading prints as "QUALIFYING -RACE - ROUND N - LAP
        # CHART" - RACE_LAP_CHART_RE (same pattern already trusted for
        # Best Speeds/Sectors/Statistics) must not confuse it with a plain
        # "ROUND N -" Race 1/2/3 heading.
        qr_page = f"{self.TITLE}\n\nQUALIFYING -RACE - ROUND 19 - LAP CHART\n\n" + make_lap_chart_page(
            [(1, "15:14:06.496", [(5, None, 80.0), (6, 0.1, 80.1)])]
        )
        race1_page = self._page("20", [(1, "14:53:09.752", [(33, None, 90.0), (32, 0.4, 90.5)])])
        result = s.parse_lap_chart(qr_page + "\x0c" + race1_page)
        self.assertNotIn("Race 1", {k: v for k, v in result.items() if v and v[0]["order"][0]["no"] == 5})
        self.assertEqual(result["Race 1"][0]["order"][0]["no"], 33)

    def test_no_lap_chart_in_text_returns_empty_dict(self):
        self.assertEqual(s.parse_lap_chart("no lap chart data here at all"), {})


class TestResolveLapChart(unittest.TestCase):

    def test_resolves_car_number_to_canonical_driver_and_team(self):
        laps = [{"lap": 1, "timeOfDay": "t1", "order": [
            {"no": 3, "gapSeconds": None, "lapsDown": None, "lapTimeSeconds": 90.0},
        ]}]
        resolved = s._resolve_lap_chart(laps, {3: ("Tom CHILTON", "Team VERTU")})
        self.assertEqual(resolved[0]["order"][0]["driver"], "Tom CHILTON")
        self.assertEqual(resolved[0]["order"][0]["team"], "Team VERTU")

    def test_missing_car_gets_placeholder_name_warned_once_not_per_lap(self):
        laps = [
            {"lap": 1, "timeOfDay": "t1", "order": [{"no": 99, "gapSeconds": None, "lapsDown": None, "lapTimeSeconds": 90.0}]},
            {"lap": 2, "timeOfDay": "t2", "order": [{"no": 99, "gapSeconds": None, "lapsDown": None, "lapTimeSeconds": 90.1}]},
        ]
        with mock.patch("builtins.print") as mock_print:
            resolved = s._resolve_lap_chart(laps, {})
        self.assertEqual(resolved[0]["order"][0]["driver"], "Car 99")
        self.assertEqual(resolved[1]["order"][0]["driver"], "Car 99")
        warn_calls = [c for c in mock_print.call_args_list if "not in session results/grid" in str(c)]
        self.assertEqual(len(warn_calls), 1)


if __name__ == '__main__':
    sys.argv = sys.argv[:1]  # strip the '2026' arg before unittest.main() parses argv
    unittest.main()
