"""
Tests for book_tables.py - positional parsers for the TSL event book.

Pages are built by hand as rows of (x0, x1, text) cells with x-positions
measured off the real 2026 Brands Hatch GP / Silverstone books, so column
assignment is exercised the same way the live PDF exercises it.

Run with:
    python -m pytest tools/scraper/test_book_tables.py -v
"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import book_tables as bt  # noqa: E402

TITLE = bt.make_row((17.6, 292.1, "2026 Kwik Fit British Touring Car Championship"))


def heading(text):
    return bt.make_row((17.7, 350.0, text))


def page(head, *rows):
    return [TITLE, heading(head), *rows]


# ── Sector analysis fixtures (x-positions from the live book) ─────────────────

SECTOR_HEADER = bt.make_row(
    (31.1, 46.3, "LAP"), (70.8, 110.7, "SECTOR 1"), (147.4, 187.2, "SECTOR 2"),
    (226.8, 266.6, "SECTOR 3"), (306.1, 346.0, "SECTOR 4"), (377.0, 413.3, "LAP TIME"),
    (439.4, 457.2, "MPH"), (490.4, 508.2, "DIFF"), (518.8, 569.6, "TIME OF DAY"),
)


def driver_header(pos, no, cl, name):
    return bt.make_row((28.6, 40.8, f"P{pos}"), (62.2, 73.3, str(no)), (79.6, 82.4, cl), (125.0, 196.5, name))


def ideal_row(ideal, best):
    return bt.make_row((28.3, 94.1, "IDEAL LAP TIME :"), (98.3, 129.4, ideal),
                       (161.6, 225.2, "BEST LAP TIME :"), (229.3, 260.4, best),
                       (294.8, 350.2, "DIFFERENCE :"), (354.4, 374.4, "0.149"))


def lap_row(lap, s1=None, v1=None, s2=None, v2=None, s3=None, v3=None, s4=None, v4=None,
            lap_time=None, rank=None, flag=None, mph=None, diff=None, tod=None):
    cells = [(33.8, 43.0, f"{lap}-")]
    for text, x1 in ((s1, 90.4), (v1, 121.5), (s2, 170.1), (v2, 198.4),
                     (s3, 249.4), (v3, 277.8), (s4, 328.8), (v4, 357.2)):
        if text is not None:
            cells.append((x1 - 24, x1, text))
    if lap_time:
        cells.append((382.7, 413.9, lap_time))
    if rank:
        cells.append((418.9, 428.7, rank))
    if flag:
        cells.append((418.9, 423.0, flag))
    if mph:
        cells.append((439.2, 459.2, mph))
    if diff:
        cells.append((493.1, 513.1, diff))
    if tod:
        cells.append((525.9, 572.6, tod))
    return bt.make_row(*cells)


class TestTimeToSecs(unittest.TestCase):
    def test_formats(self):
        self.assertEqual(bt.time_to_secs("1:29.940"), 89.94)
        self.assertEqual(bt.time_to_secs("28.955"), 28.955)
        self.assertEqual(bt.time_to_secs("22:03.076"), 1323.076)
        self.assertIsNone(bt.time_to_secs("OUTLAP"))
        self.assertIsNone(bt.time_to_secs(""))


class TestPageHeading(unittest.TestCase):
    def test_sessions(self):
        cases = {
            "FREE PRACTICE SESSION - SECTOR ANALYSIS": ("Free Practice", "SECTOR ANALYSIS", None),
            "QUALIFYING - PART 2 - TYRE COMPOUNDS": ("Qualifying Part 2", "TYRE COMPOUNDS", None),
            "QUALIFYING RACE - ROUND 28 - STATISTICS": ("Qualifying Race", "STATISTICS", None),
            "ROUND 25 - TOP SPEEDS @ INTERMEDIATE 2": (("race", 25), "TOP SPEEDS", "Intermediate 2"),
        }
        for head, expected in cases.items():
            self.assertEqual(bt._page_heading(page(head)), expected, head)

    def test_tolerates_title_typo(self):
        # "Brtish": every Free Practice page of the 2026 Brands Hatch GP book
        p = [bt.make_row((17.6, 292.1, "2026 Kwik Fit Brtish Touring Car Championship")),
             heading("FREE PRACTICE SESSION - TYRE COMPOUNDS")]
        self.assertEqual(bt._page_heading(p)[0], "Free Practice")

    def test_tolerates_qualifying_dash_race_typo(self):
        # "QUALIFYING -RACE": every QR page of the 2026 Donington GP book
        self.assertEqual(bt._page_heading(page("QUALIFYING -RACE - ROUND 19 - TYRE COMPOUNDS"))[0],
                         "Qualifying Race")

    def test_unrelated_reports_and_cover_ignored(self):
        self.assertIsNone(bt._page_heading(page("ROUND 25 - LAP CHART")))
        self.assertIsNone(bt._page_heading(page("QUALIFYING - PART 1 - BEST SPEEDS")))
        self.assertIsNone(bt._page_heading([heading("TOURING CAR CHAMPIONSHIP")]))


class TestIndexReports(unittest.TestCase):
    def test_race_rounds_map_to_race_1_2_3_by_first_appearance(self):
        # 2026 books print the championship round (25/26/27), not 1/2/3
        pages = [
            page("ROUND 25 - TYRE COMPOUNDS"),
            page("ROUND 25 - STATISTICS"),
            page("ROUND 26 - TYRE COMPOUNDS"),
            page("ROUND 27 - TYRE COMPOUNDS"),
            page("QUALIFYING RACE - ROUND 25 - TYRE COMPOUNDS"),
        ]
        idx = bt.index_reports(pages)
        self.assertEqual(sorted(k for k in idx if k[1] == "TYRE COMPOUNDS"), [
            ("Qualifying Race", "TYRE COMPOUNDS"), ("Race 1", "TYRE COMPOUNDS"),
            ("Race 2", "TYRE COMPOUNDS"), ("Race 3", "TYRE COMPOUNDS"),
        ])

    def test_multi_page_report_pages_grouped(self):
        idx = bt.index_reports([page("ROUND 25 - SECTOR ANALYSIS"), page("ROUND 25 - SECTOR ANALYSIS")])
        self.assertEqual(len(idx[("Race 1", "SECTOR ANALYSIS")]["pages"]), 2)


class TestParseTyreCompounds(unittest.TestCase):
    HEADER = bt.make_row((19.8, 31.8, "NO"), (41.1, 64.2, "NAME"), (150.2, 177.2, "ENTRY"),
                         (316.6, 370.9, "COMPOUND 1"), (380.4, 434.6, "COMPOUND 2"), (444.0, 498.0, "COMPOUND 3"))

    def test_compounds_in_order_and_long_entry_not_glued_on(self):
        p = page(
            "FREE PRACTICE SESSION - TYRE COMPOUNDS", self.HEADER,
            bt.make_row((29.2, 33.7, "2"), (41.1, 98.9, "Daryl DE LEON"), (150.0, 216.7, "BMW 330i M Sport - WSR"),
                        (330.0, 350.0, "Soft"), (390.0, 420.0, "Medium")),
            bt.make_row((24.8, 33.7, "29"), (41.1, 100.0, "Lewis GILBERT"), (150.0, 216.7, "BMW 330i M Sport - WSR"),
                        (328.6, 358.9, "Medium"), (395.0, 415.0, "Hard"), (460.0, 480.0, "Soft")),
            # entry runs right up to the compound column (text-stream parse glued these)
            bt.make_row((24.8, 33.7, "52"), (41.1, 111.3, "Gordon SHEDDEN"),
                        (150.0, 318.5, "Toyota Corolla GR Sport - Laser Tools Racing with MB Motorsport"),
                        (328.6, 358.9, "Medium")),
            bt.make_row((20.0, 400.0, "Weather / Track : Bright / Dry")),
        )
        self.assertEqual(bt.parse_tyre_compounds([p]), [
            {"no": 2, "compounds": ["Soft", "Medium"]},
            {"no": 29, "compounds": ["Medium", "Hard", "Soft"]},
            {"no": 52, "compounds": ["Medium"]},
        ])

    def test_no_rows_returns_none(self):
        self.assertIsNone(bt.parse_tyre_compounds([page("ROUND 25 - TYRE COMPOUNDS", self.HEADER)]))


class TestParseTopSpeeds(unittest.TestCase):
    def test_rows_last_two_values_are_avg_then_best(self):
        p = page(
            "QUALIFYING RACE - ROUND 28 - TOP SPEEDS @ INTERMEDIATE 2",
            bt.make_row((10, 30, "POS NO NAME"), (200, 240, "VEHICLE"), (300, 400, "TOP 5 SPEEDS (MPH)"), (420, 440, "AVG"), (460, 480, "BEST")),
            bt.make_row((10, 15, "1"), (20, 28, "11"), (40, 80, "COLLARD"), (200, 260, "Hyundai i30N"),
                        (300, 320, "146.8"), (325, 345, "146.5"), (350, 370, "146.2"), (375, 395, "145.8"),
                        (400, 420, "145.8"), (425, 445, "146.2"), (460, 480, "146.8")),
            # 3-digit car number merged into the name cell; only 2 timed passes
            bt.make_row((10, 15, "2"), (18, 80, "123 LLOYD"), (200, 260, "Hyundai i30N"),
                        (300, 320, "142.7"), (325, 345, "141.5"), (425, 445, "142.1"), (460, 480, "142.7")),
        )
        self.assertEqual(bt.parse_top_speeds([p]), [
            {"pos": 1, "no": 11, "speeds": [146.8, 146.5, 146.2, 145.8, 145.8], "avg": 146.2, "best": 146.8},
            {"pos": 2, "no": 123, "speeds": [142.7, 141.5], "avg": 142.1, "best": 142.7},
        ])

    def test_vehicle_with_digits_is_not_a_speed(self):
        p = page("ROUND 25 - TOP SPEEDS @ INTERMEDIATE 2",
                 bt.make_row((10, 15, "1"), (20, 28, "29"), (40, 80, "GILBERT"), (200, 260, "BMW 330i M Sport"),
                             (300, 320, "144.9"), (425, 445, "144.9"), (460, 480, "144.9")))
        self.assertEqual(bt.parse_top_speeds([p])[0]["speeds"], [144.9])


class TestParseStatistics(unittest.TestCase):
    def _kv(self, key, value):
        return bt.make_row((20, 120, key), (180, 300, value))

    def _fl(self, no, cl, name, t, tod, lap):
        cells = [(20, 30, str(no))]
        if cl:
            cells.append((60, 70, cl))
        cells += [(100, 180, name), (230, 260, t), (290, 340, tod), (370, 375, str(lap)), (420, 480, "Audi A3 Saloon")]
        return bt.make_row(*cells)

    def test_summary_history_and_classes(self):
        p1 = page(
            "QUALIFYING RACE - ROUND 28 - STATISTICS",
            self._kv("Competitors Started", "23"),
            self._kv("Planned Start", "2026-10-10 @ 14:50:00.000"),
            self._kv("Actual Start", "2026-10-10 @ 15:09:48.060"),
            self._kv("Finish Time", "2026-10-10 @ 15:24:57.454"),
            self._kv("Track Length", "2.4332mi."),
            self._kv("Total Laps", "230"),
            self._kv("Total Distance Covered", "559.6566mi."),
            bt.make_row((20, 200, "Session Fastest Lap History")),
            bt.make_row((20, 30, "NO"), (60, 70, "CL"), (100, 130, "NAME"), (230, 260, "LAP TIME")),
            self._fl(16, "I", "Aiden MOFFAT", "1:37.529", "15:11:25.590", 1),
            self._fl(16, "I", "Aiden MOFFAT", "1:29.940", "15:14:25.539", 3),
            bt.make_row((20, 200, "Session Leader History")),
            bt.make_row((20, 30, "16"), (60, 70, "I"), (100, 180, "Aiden MOFFAT"), (250, 255, "1"), (300, 305, "10")),
        )
        p2 = page(
            "QUALIFYING RACE - ROUND 28 - STATISTICS",
            bt.make_row((20, 80, "CLASS : M"), (400, 460, "12 Starters")),
            bt.make_row((20, 200, "Fastest Lap History")),
            self._fl(80, None, "Tom INGRAM", "1:38.210", "15:11:26.271", 1),
            self._fl(80, None, "Tom INGRAM", "1:29.958", "15:14:26.398", 3),
            bt.make_row((20, 200, "Leader History")),
            bt.make_row((20, 30, "80"), (100, 180, "Tom INGRAM"), (250, 255, "1"), (300, 305, "10")),
        )
        stats = bt.parse_statistics([p1, p2])
        self.assertEqual(stats["competitors"], 23)
        self.assertEqual(stats["plannedStart"], "2026-10-10T14:50:00")
        self.assertEqual(stats["actualStart"], "2026-10-10T15:09:48")
        self.assertEqual(stats["startDelayMins"], 20)
        self.assertEqual(stats["trackLength"], 2.4332)
        self.assertEqual(stats["totalDistance"], 559.6566)
        self.assertEqual(stats["totalLaps"], 230)
        self.assertEqual([e["time"] for e in stats["fastestLapHistory"]], ["1:37.529", "1:29.940"])
        self.assertEqual(stats["fastestLapHistory"][1], {"no": 16, "time": "1:29.940", "secs": 89.94,
                                                         "timeOfDay": "15:14:25", "lap": 3})
        # leader history rows don't leak into the fastest-lap history
        self.assertEqual(len(stats["fastestLapHistory"]), 2)
        self.assertEqual(stats["classes"]["M"]["starters"], 12)
        self.assertEqual(stats["classes"]["M"]["fastestLap"]["time"], "1:29.958")

    def test_early_start_gives_negative_delay(self):
        p = page("FREE PRACTICE SESSION - STATISTICS",
                 self._kv("Planned Start", "2026-09-26 @ 10:10:00.000"),
                 self._kv("Actual Start", "2026-09-26 @ 10:05:01.333"))
        self.assertEqual(bt.parse_statistics([p])["startDelayMins"], -5)

    def test_empty_returns_none(self):
        self.assertIsNone(bt.parse_statistics([page("ROUND 25 - STATISTICS")]))


class TestParseSectorAnalysis(unittest.TestCase):
    def test_values_land_in_their_columns_with_blank_cells(self):
        p = page(
            "QUALIFYING RACE - ROUND 28 - SECTOR ANALYSIS",
            driver_header(1, 16, "I", "Aiden MOFFAT"),
            ideal_row("1:29.791", "1:29.940"),
            SECTOR_HEADER,
            # lap 1: no Sector 1 time (standing start), speed still present
            lap_row(1, v1="106.3", s2="16.742", v2="140.1", s3="23.664", v3="96.5", s4="21.561", v4="132.8",
                    lap_time="1:37.529", mph="89.81", diff="7.589", tod="15:11:25.590"),
            lap_row(3, s1="28.860", v1="112.4", s2="16.250", v2="141.8", s3="23.436", v3="100.9",
                    s4="21.394", v4="135.5", lap_time="1:29.940", rank="(1)", mph="97.39", tod="15:14:25.539"),
            # blank Sector 3 (2026 Donington row, confirmed live)
            lap_row(6, s1="28.880", v1="106.3", s2="16.220", v2="142.1", s4="33.238", v4="81.3",
                    lap_time="1:57.529", mph="74.53", diff="28.006", tod="14:01:46.837"),
        )
        [drv] = bt.parse_sector_analysis([p])
        self.assertEqual((drv["no"], drv["ideal"], drv["best"]), (16, 89.791, 89.94))
        lap1, lap3, lap6 = drv["laps"]
        self.assertEqual(lap1["s"], [None, 16.742, 23.664, 21.561])
        self.assertEqual(lap1["v"], [106.3, 140.1, 96.5, 132.8])
        self.assertEqual(lap1["t"], 97.529)
        self.assertEqual(lap1["tod"], "15:11:25")
        self.assertEqual(lap3["s"], [28.86, 16.25, 23.436, 21.394])
        self.assertAlmostEqual(sum(lap3["s"]), lap3["t"], places=3)
        self.assertEqual(lap6["s"], [28.88, 16.22, None, 33.238])
        self.assertEqual(lap6["v"], [106.3, 142.1, None, 81.3])

    def test_outlap_in_pit_pit_lane_and_deleted_flags(self):
        p = page(
            "FREE PRACTICE SESSION - SECTOR ANALYSIS",
            driver_header(5, 2, "I", "Daryl DE LEON"),
            ideal_row("1:29.500", "1:29.900"),
            SECTOR_HEADER,
            bt.make_row((33.8, 43.0, "1-"), (60.0, 92.0, "OUTLAP"), (101.5, 121.5, "91.3"),
                        (145.6, 170.1, "19.999"), (178.4, 198.4, "99.5"), (225.0, 249.4, "30.569"),
                        (262.2, 277.8, "69.5"), (300.0, 330.0, "IN PIT"), (382.7, 413.9, "3:39.174"),
                        (418.9, 423.0, "P"), (439.2, 459.2, "39.96"), (493.1, 513.1, "2:10.192"),
                        (525.9, 572.6, "10:14:40.244")),
            lap_row(3, s1="29.067", v1="107.3", s2="16.346", v2="145.8", s3="23.655", v3="97.3",
                    s4="21.417", v4="133.9", lap_time="1:30.485", flag="D", mph="96.80", tod="13:56:22.253"),
        )
        [drv] = bt.parse_sector_analysis([p])
        out, deleted = drv["laps"]
        self.assertTrue(out["out"] and out["in"] and out["pit"])
        self.assertEqual(out["s"], [None, 19.999, 30.569, None])
        self.assertEqual(out["t"], 219.174)
        self.assertTrue(deleted["deleted"])
        self.assertNotIn("pit", deleted)

    def test_block_continues_across_page_break_and_next_driver_starts(self):
        p1 = page("ROUND 25 - SECTOR ANALYSIS",
                  driver_header(1, 80, "M", "Tom INGRAM"), ideal_row("56.500", "56.560"), SECTOR_HEADER,
                  lap_row(1, v1="100.0", s2="16.0", lap_time="1:02.000"))
        p2 = page("ROUND 25 - SECTOR ANALYSIS",
                  lap_row(2, s1="14.000", s2="16.000", s3="13.000", s4="13.560", lap_time="56.560"),
                  driver_header(2, 3, "M", "Tom CHILTON"), ideal_row("56.600", "56.700"), SECTOR_HEADER,
                  lap_row(1, s2="16.100", lap_time="1:03.000"))
        drivers = bt.parse_sector_analysis([p1, p2])
        self.assertEqual([d["no"] for d in drivers], [80, 3])
        self.assertEqual([l["lap"] for l in drivers[0]["laps"]], [1, 2])
        self.assertEqual(drivers[0]["laps"][1]["t"], 56.56)

    def test_driver_with_no_laps_dropped(self):
        p = page("ROUND 25 - SECTOR ANALYSIS", driver_header(23, 28, "M", "Nicolas HAMILTON"),
                 ideal_row("", ""), SECTOR_HEADER)
        self.assertIsNone(bt.parse_sector_analysis([p]))


class TestParseBookTables(unittest.TestCase):
    TYRE_HEADER = TestParseTyreCompounds.HEADER

    def _tyre_page(self, head, *rows):
        return page(head, self.TYRE_HEADER, *[
            bt.make_row((24.8, 33.7, str(no)), (41.1, 90.0, "X"), (328.6, 358.9, c)) for no, c in rows
        ])

    def _speed_page(self, head, *rows):
        return page(head, *[
            bt.make_row((10, 15, str(i + 1)), (20, 28, str(no)), (40, 80, "NAME"), (200, 260, "Car"),
                        (300, 320, f"{best:.1f}"), (425, 445, f"{avg:.1f}"), (460, 480, f"{best:.1f}"))
            for i, (no, avg, best) in enumerate(rows)
        ])

    def test_qualifying_parts_merged(self):
        pages = [
            self._tyre_page("QUALIFYING - PART 1 - TYRE COMPOUNDS", (1, "Soft"), (2, "Soft")),
            self._tyre_page("QUALIFYING - PART 2 - TYRE COMPOUNDS", (3, "Medium")),
            self._speed_page("QUALIFYING - PART 1 - TOP SPEEDS @ INTERMEDIATE 1", (1, 140.0, 141.0)),
            self._speed_page("QUALIFYING - PART 2 - TOP SPEEDS @ INTERMEDIATE 1", (3, 142.0, 143.0)),
        ]
        out = bt.parse_book_tables(pages)["Qualifying"]
        self.assertEqual([e["no"] for e in out["tyres"]], [1, 2, 3])
        # merged top speeds re-ranked by best, positions re-numbered
        self.assertEqual([(e["pos"], e["no"]) for e in out["topSpeeds"]], [(1, 3), (2, 1)])
        self.assertEqual(out["topSpeedsTrap"], "Intermediate 1")

    def test_missing_reports_absent(self):
        out = bt.parse_book_tables([self._tyre_page("ROUND 25 - TYRE COMPOUNDS", (1, "Soft"))])
        self.assertEqual(list(out), ["Race 1"])
        self.assertEqual(list(out["Race 1"]), ["tyres"])


class TestMergeQualifyingStats(unittest.TestCase):
    def test_sums_and_tags_each_groups_history(self):
        p1 = {"competitors": 12, "plannedStart": "2026-09-26T14:05:00", "actualStart": "2026-09-26T14:07:01",
              "startDelayMins": 2, "finishTime": "2026-09-26T14:20:00", "trackLength": 1.6, "totalLaps": 90,
              "totalDistance": 144.0, "fastestLapHistory": [{"no": 1, "secs": 57.0}],
              "classes": {"M": {"starters": 8, "fastestLap": {"no": 1, "secs": 57.0}}}}
        p2 = {"competitors": 11, "plannedStart": "2026-09-26T14:25:00", "actualStart": "2026-09-26T14:26:00",
              "startDelayMins": 1, "finishTime": "2026-09-26T14:40:00", "trackLength": 1.6, "totalLaps": 80,
              "totalDistance": 128.0, "fastestLapHistory": [{"no": 2, "secs": 56.5}],
              "classes": {"M": {"starters": 4, "fastestLap": {"no": 2, "secs": 56.5}}}}
        m = bt._merge_qualifying(p1, p2, "stats")
        self.assertEqual(m["competitors"], 23)
        self.assertEqual(m["totalLaps"], 170)
        self.assertEqual(m["plannedStart"], "2026-09-26T14:05:00")
        self.assertEqual(m["finishTime"], "2026-09-26T14:40:00")
        self.assertEqual([(e["no"], e["group"]) for e in m["fastestLapHistory"]], [(1, 1), (2, 2)])
        self.assertEqual(m["classes"]["M"], {"starters": 12, "fastestLap": {"no": 2, "secs": 56.5}})


if __name__ == "__main__":
    unittest.main()
