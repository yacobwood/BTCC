"""
Tests for scrape_penalties.py — covers the pure parsing/matching logic
(checkbox-to-option matching, sanction humanizing, session normalization,
notice filtering, exoneration detection, noticeboard slug resolution)
without touching the network.

The line-layout fixtures below are transcribed verbatim (y0, x0, text) from
real BARC judicial decision PDFs fetched live while building this scraper -
see project memory for the round/driver each one came from. Testing against
real layouts (rather than hand-simplified ones) is what caught several bugs
during development: fragile positional math, a number-extraction bug that
picked up an unrelated "round 19" instead of "five seconds", and a missing
exoneration filter.

Run with:
    python -m pytest tools/scraper/test_scrape_penalties.py -v
    # or
    python tools/scraper/test_scrape_penalties.py
"""

import sys
import unittest
from pathlib import Path

sys.argv = ["scrape_penalties.py", "2026"]
sys.path.insert(0, str(Path(__file__).parent))
import scrape_penalties as sp


# ── Real-document fixtures (template A: Rainford, Snetterton R3) ───────────

RAINFORD_LINES = [
    (786.7, 0.0, "BRITISH AUTOMOBILE RACING CLUB"),
    (747.7, 56.7, "JUDICIAL ACTION"),
    (714.0, 62.1, "From:"), (714.0, 305.7, "Venue:"),
    (702.0, 114.3, "Ian Watson  -  Clerk of the Course"), (702.0, 406.2, "Snetterton : Q. Race"),
    (679.6, 62.1, "To:"), (679.6, 305.7, "Licence No.:"),
    (667.5, 135.7, "Charles Rainford : Car 99"), (667.5, 437.1, "287961"),
    (645.0, 62.1, "Date:"), (645.0, 305.7, "Championship:"),
    (633.0, 160.7, "23rd May 2026"), (633.0, 436.7, "B.T.C.C."),
    (599.0, 56.7, "Following a hearing and reviewing video evidence, I find that you are guilty of contravening,"),
    (574.5, 56.7, "NCR 12.7.1.8  Causing a collision, repetition of serious mistakes or the appearance of a  lack of"),
    (559.9, 128.7, "control over the car"),
    (535.5, 56.7, "In  that  contact  was  made  with  car  3  at  the  entry  of  turn  6  causing  car  3  to  run  wide  and  lose"),
    (520.9, 56.7, "positions in the race"),
    (496.4, 56.7, "Therefore, under NCR 2.2.2 and CR 4.2, I order that you should:"),
    (459.8, 97.6, "Be verbally warned"), (458.8, 65.9, "X"),
    (430.5, 97.6, "Be officially reprimanded,"),
    (401.2, 97.6, "Be fined a sum of £ . . . . . . . .,"),
    (371.9, 97.6, "Be penalised by the addition of 5 seconds to your race time."),
    (342.6, 97.6, "Be penalised by means of a three place grid penalty for your next race"),
    (313.4, 97.6, "Be disqualified from the results of the race for championship round 30"),
    (283.9, 97.6, "This counts as a “strike”, CR 4.4.5 with the grid place penalty to be taken at Round …"),
    (240.0, 97.6, "Penalty points are awarded for this action, details of which will be recorded against your"),
    (230.8, 66.0, "0"),
    (225.4, 97.6, "licence records. You are reminded of your right of appeal."),
    (188.2, 56.7, "Signed:"),
]

# Template B: Moffatt, Donington GP round 7 (labelled Car/Entrant/Session/Facts/Offence/Decision fields)
MOFFATT_LINES = [
    (787.0, 0.0, "BRITISH TOURING CAR CHAMPIONSHIP"),
    (767.5, 56.5, "JUDICIAL ACTION"),
    (727.9, 62.0, "From:"), (727.9, 305.8, "Venue:"),
    (717.4, 128.1, "Ian Watson  -  Clerk of the Course"), (717.4, 417.4, "Donington : Race 2"),
    (693.4, 62.0, "To:"), (693.4, 305.8, "Licence No.:"),
    (682.9, 150.6, "Aiden Moffatt : Car 16"), (682.9, 440.4, "258548"),
    (658.9, 62.0, "Date:"), (658.9, 305.8, "Time:"),
    (648.4, 161.6, "23rd August 2026"), (648.4, 444.4, "15:45"),
    (551.8, 56.5, "As a result of the hearing, I determine the following:"),
    (526.3, 56.5, "Car No / Driver  16 / Aiden Moffatt"),
    (501.8, 56.5, "Entrant"), (501.8, 128.6, "LKQ Car Parts with Power Maxed Racing"),
    (477.3, 56.5, "Session"), (477.3, 128.6, "Race 2"),
    (452.8, 56.5, "Facts"), (452.8, 128.6, "There was contact between car 16 and car 52"),
    (428.8, 56.5, "Offence"), (428.8, 128.6, "NCR 12.7.1.8"),
    (428.8, 200.7, "Causing a collision, repetition of serious mistakes or the appearance of a lack of"),
    (416.2, 200.7, "control over the car"),
    (391.7, 56.5, "Decision"), (391.7, 128.6, "Under NCR 2.2.2 and CR 4.2, I order that you should"),
    (358.7, 65.5, "X"), (357.7, 130.6, "Be penalised by a written reprimand"),
    (333.2, 130.6, "Be penalised by the addition of 10 seconds to your race time."),
    (308.7, 130.6, "Be penalised by means of a . . . place grid penalty for your next race"),
    (284.7, 130.6, "Be disqualified from the results of the race for championship round …"),
    (260.1, 130.6, "This counts as a “strike”, CR 4.4.5 with the grid place penalty to be taken at Round …"),
    (235.7, 65.5, "2"), (235.7, 130.6, "Penalty points are awarded for this action"),
    (199.1, 128.6, "In attempting a passing move on car  52 you made contact with car 52 causing him to run wide and"),
    (199.1, 56.5, "Reason"),
    (186.6, 128.6, "as a result you gained a position. The penalty imposed is in line with previous penalties applied for"),
    (136.3, 56.5, "Signed:"),
]

# Template A, prose sub-variant: Chilton, Brands Hatch R2 (false start, no checkbox list at all)
CHILTON_LINES = [
    (786.7, 0.0, "BRITISH AUTOMOBILE RACING CLUB"),
    (747.7, 56.7, "JUDICIAL ACTION"),
    (709.5, 62.1, "From:"), (709.5, 305.7, "Venue:"),
    (697.4, 114.3, "Ian Watson  -  Clerk of the Course"), (697.4, 401.0, "Brands Hatch – Race 1"),
    (675.0, 62.1, "To:"), (675.0, 305.7, "Licence No.:"),
    (663.0, 139.2, "Tom Chilton - Car No. 3"), (663.0, 437.1, "153629"),
    (640.5, 62.1, "Date:"), (640.5, 305.7, "Championship:"),
    (628.4, 160.8, "10th May 2026"), (628.4, 436.7, "B.T.C.C."),
    (588.9, 56.7, "Following a hearing and having viewed data evidence, I find that:"),
    (559.6, 56.7, "You are guilty of reversing on the grid at the start of the race"),
    (530.4, 56.7, "As a result, I order that you are guilty of making a false start and therefore a 5 second penalty be"),
    (515.7, 56.7, "applied to your race time for round 4 of the Championship."),
    (281.3, 87.3, "Penalty points are awarded for this action and you are advised of your right of appeal as laid"),
    (273.9, 61.5, "0"),
    (224.6, 56.7, "Signed:"),
]

# Template B, prose sub-variant: Dorlin points-deduction, no "Car No / Driver" header at all
# (two separate "To:" recipients instead) - confirms this stays a safe "unrecognised" case
# rather than mis-parsing, since it doesn't match template B's driver/car header shape.
DORLIN_POINTS_LINES = [
    (787.0, 0.0, "BRITISH TOURING CAR CHAMPIONSHIP"),
    (767.5, 56.5, "JUDICIAL ACTION"),
    (655.9, 165.1, "James Dorlin"),
    (567.4, 56.5, "Following  a  report  from  the  BTCC  Scrutineer  and  after  further  investigation,  I  find  that  you  are"),
    (552.8, 56.5, "guilty of contravening championship regulation CR 1.16:"),
    (508.8, 92.6, "Having changed an engine above the number permitted within 1.16.2"),
    (464.8, 56.5, "Therefore, under CR 1.16.9 I order that;"),
    (435.2, 92.6, "5 (five) points be deducted from the Drivers’ Championship for James Dorlin"),
    (391.7, 56.5, "You are reminded of your right of appeal as laid down within the regulations."),
    (334.7, 56.5, "Signed:"),
]

# No-action exoneration (template A) - must be excluded entirely, not recorded generically.
NO_ACTION_LINES = [
    (786.7, 0.0, "BRITISH AUTOMOBILE RACING CLUB"),
    (747.7, 56.7, "JUDICIAL ACTION"),
    (628.4, 153.3, "Charles Rainsford"),
    (525.2, 56.7, "Having held a hearing and reviewing all available video evidence I feel that I am unable to take any"),
    (510.4, 56.7, "judicial action with regard to an incident between your car and that of Ash Sutton (116)"),
    (437.2, 56.7, "You are reminded of your right of appeal"),
]


class TestDetectTemplate(unittest.TestCase):
    def test_template_a(self):
        self.assertEqual(sp.detect_template(RAINFORD_LINES), "A")

    def test_template_b(self):
        self.assertEqual(sp.detect_template(MOFFATT_LINES), "B")

    def test_unknown_template(self):
        self.assertIsNone(sp.detect_template([(786.7, 0.0, "SOME OTHER ORGANISATION")]))


class TestParseTemplateA(unittest.TestCase):
    def test_full_checkbox_form(self):
        result = sp.parse_template_a(RAINFORD_LINES)
        self.assertEqual(result["driver"], "Charles Rainford")
        self.assertEqual(result["carNo"], 99)
        self.assertEqual(result["sessionRaw"], "Q. Race")
        self.assertEqual(result["ruleRef"], "NCR 12.7.1.8")
        self.assertIn("contact was made with car 3", result["facts"])
        # "Offence" is the rule citation on its own, split out from "Facts" at
        # "In that" - must not also contain the incident description.
        self.assertEqual(result["offence"], "NCR 12.7.1.8 Causing a collision, repetition of serious mistakes or the appearance of a lack of control over the car")
        self.assertEqual(result["decision"], "Be verbally warned")
        self.assertEqual(result["sanction"], "Verbal warning")

    def test_prose_only_variant_still_yields_driver_and_sanction(self):
        # Chilton's document has no rule citation or checkbox list at all -
        # confirms driver/car/session survive even when that portion is absent,
        # and the "I order that" fallback recovers a real sanction. There's no
        # structural seam to split facts from offence here, so both stay None
        # and the whole order sentence goes into "decision" instead.
        result = sp.parse_template_a(CHILTON_LINES)
        self.assertEqual(result["driver"], "Tom Chilton")
        self.assertEqual(result["carNo"], 3)
        self.assertEqual(result["sessionRaw"], "Race 1")
        self.assertEqual(result["sanction"], "5s time penalty")
        self.assertIsNone(result["facts"])
        self.assertIsNotNone(result["decision"])

    def test_no_driver_header_is_not_template_a(self):
        self.assertIsNone(sp.parse_template_a([(786.7, 0.0, "BRITISH AUTOMOBILE RACING CLUB")]))


class TestParseTemplateB(unittest.TestCase):
    def test_full_labelled_form(self):
        result = sp.parse_template_b(MOFFATT_LINES)
        self.assertEqual(result["driver"], "Aiden Moffatt")
        self.assertEqual(result["carNo"], 16)
        self.assertEqual(result["sessionRaw"], "Race 2")
        self.assertEqual(result["ruleRef"], "NCR 12.7.1.8")
        self.assertEqual(result["facts"], "There was contact between car 16 and car 52")
        self.assertEqual(result["offence"], "NCR 12.7.1.8 Causing a collision, repetition of serious mistakes or the appearance of a lack of control over the car")
        self.assertEqual(result["decision"], "Be penalised by a written reprimand")
        self.assertEqual(result["sanction"], "Written reprimand")

    def test_missing_driver_header_shape_returns_none(self):
        # Dorlin's points-deduction doc uses two separate "To:" recipients
        # instead of the standard "Car No / Driver" line - this must fail
        # cleanly (caller falls back to a minimal entry) rather than
        # fabricate a wrong driver/car.
        self.assertIsNone(sp.parse_template_b(DORLIN_POINTS_LINES))


class TestNoAction(unittest.TestCase):
    def test_detects_exoneration(self):
        self.assertTrue(sp._is_no_action(NO_ACTION_LINES))

    def test_normal_penalty_is_not_no_action(self):
        self.assertFalse(sp._is_no_action(RAINFORD_LINES))


class TestParsePenaltyPdfDispatch(unittest.TestCase):
    """Exercises parse_penalty_pdf's own dispatch/fallback logic directly
    against pre-extracted lines, monkeypatching extract_pdf_lines so these
    don't need a real PDF file."""

    def _parse(self, lines, fallback_driver="Fallback Name", url="https://example.com/x.pdf"):
        original = sp.extract_pdf_lines
        sp.extract_pdf_lines = lambda _pdf_bytes: lines
        try:
            return sp.parse_penalty_pdf(b"unused", fallback_driver, url)
        finally:
            sp.extract_pdf_lines = original

    def test_full_template_a_document(self):
        result = self._parse(RAINFORD_LINES, "Charles Rainford")
        self.assertEqual(result["confidence"], "full")
        self.assertEqual(result["session"], "Qualifying Race")
        self.assertIn("Charles Rainford (No. 99): Verbal warning", result["oneLiner"])

    def test_no_action_returns_none(self):
        self.assertIsNone(self._parse(NO_ACTION_LINES, "Charles Rainford"))

    def test_unrecognised_layout_falls_back_to_minimal(self):
        result = self._parse([(786.7, 0.0, "SOMETHING ELSE ENTIRELY")], "Some Driver", "https://example.com/y.pdf")
        self.assertEqual(result["confidence"], "minimal")
        self.assertEqual(result["driver"], "Some Driver")
        self.assertIn("Some Driver", result["oneLiner"])
        self.assertEqual(result["pdfUrl"], "https://example.com/y.pdf")

    def test_unreadable_pdf_falls_back_to_minimal(self):
        # extract_pdf_lines itself returns [] on a corrupt/unreadable PDF -
        # this must still produce a usable (if minimal) entry, not crash.
        result = self._parse([], "Some Driver")
        self.assertEqual(result["confidence"], "minimal")


class TestNormalizeSession(unittest.TestCase):
    def test_known_aliases(self):
        self.assertEqual(sp.normalize_session("Q. Race"), "Qualifying Race")
        self.assertEqual(sp.normalize_session("Race 2"), "Race 2")
        self.assertEqual(sp.normalize_session("R3"), "Race 3")
        self.assertEqual(sp.normalize_session("free practice"), "Free Practice")

    def test_venue_prefix_is_stripped(self):
        self.assertEqual(sp.normalize_session("Donington : Race 2"), "Race 2")

    def test_unknown_value_passed_through(self):
        self.assertEqual(sp.normalize_session("Warm-up"), "Warm-up")

    def test_none_input(self):
        self.assertIsNone(sp.normalize_session(None))


class TestHumanizeSanction(unittest.TestCase):
    def test_time_penalty_digit(self):
        self.assertEqual(sp.humanize_sanction("Be penalised by the addition of 5 seconds to your race time."), "5s time penalty")

    def test_time_penalty_avoids_unrelated_number(self):
        # Confirmed live bug: a trailing "for round 19" must not be picked up
        # instead of the real "five second" figure.
        text = "Be given a five second time penalty added to your elapsed time for round 19"
        self.assertEqual(sp.humanize_sanction(text), "5s time penalty")

    def test_grid_penalty_word_number(self):
        self.assertEqual(sp.humanize_sanction("Be penalised by means of a three place grid penalty for your next race"), "3-place grid penalty")

    def test_grid_penalty_no_number_present(self):
        self.assertEqual(sp.humanize_sanction("Be penalised by means of a . . . . . place grid penalty for your next race"), "Grid penalty")

    def test_written_reprimand(self):
        self.assertEqual(sp.humanize_sanction("Be penalised by a written reprimand"), "Written reprimand")

    def test_verbal_warning(self):
        self.assertEqual(sp.humanize_sanction("Be verbally warned"), "Verbal warning")

    def test_disqualified(self):
        self.assertEqual(sp.humanize_sanction("Be disqualified from the results of the race for championship round 30"), "Disqualified from the results")

    def test_fine_with_amount(self):
        self.assertEqual(sp.humanize_sanction("Be fined a sum of £300 (minimum £300)"), "Fined £300")

    def test_fine_blank_placeholder(self):
        self.assertEqual(sp.humanize_sanction("Be fined a sum of £ . . . . . . . .,"), "Fine")

    def test_points_deducted_with_parenthetical_duplicate(self):
        self.assertEqual(sp.humanize_sanction("5 (five) points be deducted from the Drivers’ Championship for James Dorlin"), "5 points deducted")

    def test_rescinded(self):
        self.assertEqual(sp.humanize_sanction("the ten second penalty applied during the race be rescinded"), "Penalty rescinded")

    def test_forfeit_points_no_number(self):
        self.assertEqual(sp.humanize_sanction("Forfeit a total of . . . points from all Championships concerned."), "Points forfeited")

    def test_unrecognised_text_falls_back_to_cleaned_original(self):
        self.assertEqual(sp.humanize_sanction("be moved to the back of the grid"), "Moved to the back of the grid")

    def test_none_input(self):
        self.assertIsNone(sp.humanize_sanction(None))


class TestFindCheckedOption(unittest.TestCase):
    def test_matches_option_nearest_the_x(self):
        checked = sp._find_checked_option(RAINFORD_LINES, 495.4, 236.4)
        self.assertEqual(checked, "Be verbally warned")

    def test_no_x_returns_none(self):
        no_x_lines = [l for l in RAINFORD_LINES if l[2].strip().upper() != "X"]
        self.assertIsNone(sp._find_checked_option(no_x_lines, 495.4, 236.4))

    def test_merges_wrapped_continuation_lines(self):
        # Smiley's checked option ("...for the result of the Qualifying" +
        # continuation "Race") must be merged into one string.
        lines = [
            (510.8, 56.7, "Therefore, under NCR 2.2.2 and CR 4.2, I order that you should be penalised:"),
            (474.2, 101.9, "By the addition of 5 seconds to your race time for the result of the Qualifying"),
            (468.5, 67.9, "X"),
            (459.6, 101.9, "Race"),
            (416.8, 101.9, "By means of a one place penalty for the result of Championship round ,,,"),
        ]
        checked = sp._find_checked_option(lines, 509.8, 250.8)
        self.assertEqual(checked, "By the addition of 5 seconds to your race time for the result of the Qualifying Race")


class TestExtractBtccNotices(unittest.TestCase):
    ROW = '<div class="row aligned-row"><h4>{heading}</h4><a target="_blank" href="{url}" class="btn noticeboard btn-download">CLICK TO VIEW</a></div>'

    def _page(self, rows):
        return "<div>" + "".join(self.ROW.format(heading=h, url=u) for h, u in rows) + "</div>"

    def test_filters_to_btcc_only(self):
        page = self._page([
            ("British Touring Car Championship - Charles Rainford", "a.pdf"),
            ("Mini Challenge - Sam Gornall", "b.pdf"),
            ("BTCC - Round 19 - Grid", "c.pdf"),  # abbreviated form: results/grid, not a decision
        ])
        notices = sp.extract_btcc_notices(page)
        self.assertEqual(len(notices), 1)
        self.assertEqual(notices[0]["driver"], "Charles Rainford")
        self.assertEqual(notices[0]["pdf_url"], "a.pdf")

    def test_three_part_heading_uses_last_segment_as_driver(self):
        page = self._page([("British Touring Car Championship - Restart Racing - Chris Smiley", "a.pdf")])
        self.assertEqual(sp.extract_btcc_notices(page)[0]["driver"], "Chris Smiley")

    def test_strips_wordpress_dedup_suffix(self):
        page = self._page([("British Touring Car Championship - Tom Ingram (2)", "a.pdf")])
        self.assertEqual(sp.extract_btcc_notices(page)[0]["driver"], "Tom Ingram")


class TestFindNoticeboardEntry(unittest.TestCase):
    """find_noticeboard_entry's HTTP call is monkeypatched so this tests the
    slug-matching logic (venue keyword + month + both day tokens) without
    touching the network."""

    def _entries(self, slugs):
        return [{"id": i, "slug": s, "link": f"https://example.com/{s}/", "date": "2025-12-01"} for i, s in enumerate(slugs)]

    def test_matches_correct_slug_and_ignores_adjacent_date_event(self):
        import datetime
        entries = self._entries([
            "2026-donington-park-grand-prix-august-22-23",
            "donington-park-august-21-22",  # confirmed-live false-positive risk: shares day "22" only
        ])
        original = sp.fetch_json
        sp.fetch_json = lambda url, _entries=entries: (_entries if "page=1" in url else [])
        try:
            result = sp.find_noticeboard_entry("Donington Park GP", datetime.date(2026, 8, 22), datetime.date(2026, 8, 23))
        finally:
            sp.fetch_json = original
        self.assertEqual(result["slug"], "2026-donington-park-grand-prix-august-22-23")

    def test_no_match_returns_none(self):
        import datetime
        original = sp.fetch_json
        sp.fetch_json = lambda url: []
        try:
            result = sp.find_noticeboard_entry("Silverstone", datetime.date(2026, 9, 26), datetime.date(2026, 9, 27))
        finally:
            sp.fetch_json = original
        self.assertIsNone(result)


class TestBuildOneLiner(unittest.TestCase):
    def test_with_car_number(self):
        self.assertEqual(
            sp.build_one_liner("Chris Smiley", 22, "5s time penalty", "gained an advantage"),
            "Chris Smiley (No. 22): 5s time penalty - gained an advantage",
        )

    def test_without_car_number(self):
        self.assertEqual(sp.build_one_liner("NAPA Racing", None, "Fine", "late briefing"), "NAPA Racing: Fine - late briefing")

    def test_truncates_long_description(self):
        long_desc = "x" * 200
        result = sp.build_one_liner("Driver", 1, "Reprimand", long_desc)
        self.assertLessEqual(len(result), 200)
        self.assertTrue(result.endswith("…"))


if __name__ == "__main__":
    unittest.main()
