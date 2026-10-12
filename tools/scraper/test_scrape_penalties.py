"""
Tests for scrape_penalties.py — covers the pure parsing/matching logic
(checkbox-to-option matching, sanction humanizing, session normalization,
noticeboard feed filtering and round assignment, exoneration detection)
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

import json
import sys
import tempfile
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

# Same recipient-form shape, full page: Chilton engine change, Silverstone R9 2026
# (GT Apps noticeboard) - the team and car sit under the first "To:", the driver under the second.
CHILTON_POINTS_LINES = [
    (786.7, 0.0, "BRITISH TOURING CAR CHAMPIONSHIP"),
    (767.1, 56.7, "JUDICIAL ACTION"),
    (737.2, 62.1, "From:"), (737.2, 305.7, "Venue:"),
    (725.1, 114.3, "Ian Watson  -  Clerk of the Course"), (725.1, 428.4, "Silverstone"),
    (702.7, 62.1, "To:"), (702.7, 305.7, "Licence No.:"),
    (698.0, 167.3, "Team Vertu"), (690.7, 437.1, "374558"),
    (683.4, 183.4, "Car 3"),
    (668.2, 62.1, "To:"), (668.2, 305.7, "Licence No:"),
    (656.1, 166.2, "Tom Chilton"), (656.1, 437.1, "153629"),
    (633.7, 62.1, "Date:"), (633.7, 305.7, "Time:"),
    (621.7, 144.6, "26th September 2026"), (621.7, 441.7, "08.00"),
    (567.5, 56.7, "Following  a  report  from  the  BTCC  Scrutineer  and  after  further  investigation,  I  find  that  you  are"),
    (552.9, 56.7, "guilty of contravening championship regulation CR 1.16:"),
    (508.9, 92.7, "Having changed an engine above the number permitted within 1.16.2"),
    (464.9, 56.7, "Therefore, under CR 1.16.9 I order that;"),
    (435.6, 92.7, "5 (five) points be deducted from the Drivers’ Championship for Tom Chilton and,"),
    (377.1, 56.7, "You are reminded of your right of appeal as laid down within the regulations."),
    (319.2, 56.7, "Signed:"),
]

# Stewards' appeal hearing form: Collard, Brands Hatch GP R10 2026 (page 1 of 2).
COLLARD_HEARING_LINES = [
    (738.1, 49.7, "DECISION OF THE STEWARDS HEARING"),
    (712.6, 157.8, "BARC (Head Office)"), (712.6, 406.1, "11th October 2026"),
    (712.0, 47.6, "Organising Club"), (712.0, 353.0, "Date"),
    (656.3, 49.7, "Reason for hearing:  Appeal"), (656.3, 183.8, "Referral from Clerk of the Course"),
    (604.0, 200.6, "Team Vertu / Ricky Collard"), (603.3, 47.6, "Name:"),
    (589.3, 200.6, "191337"), (588.7, 47.6, "Competition / Entrant Licence No:"),
    (574.1, 47.6, "Issuing ASN (If not Motorsport UK):"),
    (560.0, 200.6, "11"), (559.5, 47.6, "Competition Number in Event:"),
    (545.2, 199.9, "British Touring Car Championship"), (544.8, 47.6, "Race / Class:"),
    (513.4, 49.7, "The Stewards heard evidence from the following persons:"),
    (494.3, 54.6, "David Tredinnick (Team Manager #11) and Ricky Collard (Driver #11)"),
    (418.5, 49.7, "The Stewards decision is:"),
    (399.3, 55.2, "1. The Appeal is deemed admissible, following the competitor's commitment to pay the appeal fee."),
    (387.0, 55.2, "2. The appeal is rejected"),
    (374.6, 55.2, "3.The Clerk of the Course decision is upheld."),
    (323.7, 49.7, "Reason(s) for this decision:"),
    (300.8, 55.2, "See 'Reasons' document attached."),
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
        # instead of the standard "Car No / Driver" line - template B itself
        # must not fabricate a driver/car from it (parse_recipient_form
        # handles this shape instead).
        self.assertIsNone(sp.parse_template_b(DORLIN_POINTS_LINES))


class TestParseRecipientForm(unittest.TestCase):
    def test_points_deduction(self):
        result = sp.parse_recipient_form(CHILTON_POINTS_LINES)
        self.assertIsNone(result["driver"])  # caller fills it from the noticeboard title
        self.assertEqual(result["carNo"], 3)
        self.assertIsNone(result["sessionRaw"])
        self.assertEqual(result["ruleRef"], "CR 1.16")
        self.assertEqual(result["offence"], "championship regulation CR 1.16")
        self.assertEqual(result["facts"], "Having changed an engine above the number permitted within 1.16.2")
        self.assertEqual(result["decision"], "5 (five) points be deducted from the Drivers’ Championship for Tom Chilton")
        self.assertEqual(result["sanction"], "5 points deducted")

    def test_truncated_layout_without_car_line(self):
        result = sp.parse_recipient_form(DORLIN_POINTS_LINES)
        self.assertIsNone(result["carNo"])
        self.assertEqual(result["sanction"], "5 points deducted")

    def test_dispatch_uses_title_driver(self):
        original = sp.extract_pdf_lines
        sp.extract_pdf_lines = lambda _pdf_bytes: CHILTON_POINTS_LINES
        try:
            result = sp.parse_penalty_pdf(b"unused", "Tom Chilton", "https://example.com/x")
        finally:
            sp.extract_pdf_lines = original
        self.assertEqual(result["driver"], "Tom Chilton")
        self.assertEqual(result["confidence"], "full")


class TestParseStewardsHearing(unittest.TestCase):
    def test_detected_as_hearing(self):
        self.assertEqual(sp.detect_template(COLLARD_HEARING_LINES), "H")

    def test_appeal_rejected(self):
        result = sp.parse_stewards_hearing(COLLARD_HEARING_LINES)
        self.assertEqual(result["driver"], "Ricky Collard")
        self.assertEqual(result["carNo"], 11)
        self.assertIsNone(result["sessionRaw"])
        self.assertTrue(result["decision"].startswith("1. The Appeal is deemed admissible"))
        self.assertTrue(result["decision"].endswith("decision is upheld."))
        self.assertEqual(result["sanction"], "Appeal rejected - penalty upheld")


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

    def test_hyphenated_result_place_penalty(self):
        text = "By means of a three-place penalty for the result of the Qualifying Race"
        self.assertEqual(sp.humanize_sanction(text), "3-place penalty")

    def test_appeal_outcomes(self):
        self.assertEqual(sp.humanize_sanction("2. The appeal is rejected 3.The Clerk of the Course decision is upheld."),
                         "Appeal rejected - penalty upheld")
        self.assertEqual(sp.humanize_sanction("The appeal is upheld"), "Appeal upheld")

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


def _doc(title, event="silverstone", category="Judicial Decision", uuid=None):
    uuid = uuid or title
    return {"title": title, "category_name": category, "season_event_uuid": event,
            "pdf_url": f"https://example.com/{uuid}/pdf#zoom=page-width"}


FEED_EVENTS = {"seasons": [{"name": "2026 Season", "events": [
    {"uuid": "silverstone", "event_from_date": "2026-09-26", "event_to_date": "2026-09-27"},
    {"uuid": "brands", "event_from_date": "2026-10-10", "event_to_date": "2026-10-11"},
]}]}


def _round(num, venue, start, end):
    import datetime
    return {"round": num, "venue": venue,
            "_start": datetime.date.fromisoformat(start), "_end": datetime.date.fromisoformat(end)}


SILVERSTONE = _round(9, "Silverstone", "2026-09-26", "2026-09-27")
CROFT = _round(8, "Croft", "2026-09-05", "2026-09-06")
DONINGTON = _round(7, "Donington Park GP", "2026-08-22", "2026-08-23")


class TestBtccNoticesForRound(unittest.TestCase):
    """Feed fixtures mirror the live GT Apps TOCA board (10-12): every series'
    documents mixed together, BTCC decisions identified by title."""

    def _feed(self, docs):
        return {**FEED_EVENTS, "documents": docs}

    def test_filters_to_btcc_decisions_at_this_event(self):
        feed = self._feed([
            _doc("British Touring Car Championship - Josh Cook"),
            _doc("British F4 - Roman Felber"),
            _doc("British Touring Car Championship - Race 1 Classification", category="Race Classification"),
            _doc("British Touring Car Championship - Lewis Selby", event="brands", category="Clerks Decision"),
        ])
        found, notices = sp.btcc_notices_for_round(feed, SILVERSTONE)
        self.assertTrue(found)
        self.assertEqual([n["driver"] for n in notices], ["Josh Cook"])
        self.assertEqual(notices[0]["pdf_url"], "https://example.com/British Touring Car Championship - Josh Cook/pdf")

    def test_clerks_and_stewards_decisions_count(self):
        feed = self._feed([
            _doc("British Touring Car Championship - Tom Chilton", event="brands", category="Clerks Decision"),
            _doc("British Touring Car Championship - Ricky Collard", event="brands", category="Stewards Decision"),
        ])
        _, notices = sp.btcc_notices_for_round(feed, _round(10, "Brands Hatch GP", "2026-10-10", "2026-10-11"))
        self.assertEqual(len(notices), 2)

    def test_venue_tag_moves_decision_to_that_round(self):
        feed = self._feed([
            _doc("British Touring Car Championship - Sam Osborne (Croft)"),
            _doc("British Touring Car Championship - Josh Cook"),
        ])
        found, croft = sp.btcc_notices_for_round(feed, CROFT)
        self.assertFalse(found)  # Croft itself predates the board
        self.assertEqual([n["driver"] for n in croft], ["Sam Osborne"])
        _, silverstone = sp.btcc_notices_for_round(feed, SILVERSTONE)
        self.assertEqual([n["driver"] for n in silverstone], ["Josh Cook"])

    def test_skips_continuation_pages(self):
        feed = self._feed([
            _doc("British Touring Car Championship - Ricky Collard Page 1 of 2", uuid="p1"),
            _doc("British Touring Car Championship - Ricky Collard Page 2 of 2", uuid="p2"),
        ])
        _, notices = sp.btcc_notices_for_round(feed, SILVERSTONE)
        self.assertEqual([(n["driver"], n["pdf_url"]) for n in notices], [("Ricky Collard", "https://example.com/p1/pdf")])

    def test_round_not_on_board(self):
        found, notices = sp.btcc_notices_for_round(self._feed([]), DONINGTON)
        self.assertFalse(found)
        self.assertEqual(notices, [])


class TestTitleDriver(unittest.TestCase):
    def test_live_title_variants(self):
        cases = {
            "British Touring Car Championship - Josh Cook": "Josh Cook",
            "British Touring Car Championship -Tom Chilton": "Tom Chilton",
            "British Touring Car Championship  - Aron Taylor-Smith": "Aron Taylor-Smith",
            "British Touring Car Championship - No 3 Tom Chilton (Croft)": "Tom Chilton",
            "British Touring Car Championship - Ricky Collard Page 1 of 2": "Ricky Collard",
            "British Touring Car Championship - Restart Racing - Chris Smiley": "Chris Smiley",
            "British Touring Car Championship - Tom Ingram (2)": "Tom Ingram",
        }
        for title, driver in cases.items():
            self.assertEqual(sp._title_driver(title), driver, title)


class TestInheritAppealSessions(unittest.TestCase):
    def test_appeal_takes_the_original_decision_session(self):
        penalties = [
            {"driver": "Ricky Collard", "session": "Race 3", "sanction": "5s time penalty"},
            {"driver": "Ricky Collard", "session": None, "sanction": "Appeal rejected - penalty upheld"},
        ]
        sp._inherit_appeal_sessions(penalties)
        self.assertEqual(penalties[1]["session"], "Race 3")

    def test_ambiguous_appeal_stays_unassigned(self):
        penalties = [
            {"driver": "A", "session": "Race 1", "sanction": "Written reprimand"},
            {"driver": "A", "session": "Race 2", "sanction": "5s time penalty"},
            {"driver": "A", "session": None, "sanction": "Appeal rejected - penalty upheld"},
        ]
        sp._inherit_appeal_sessions(penalties)
        self.assertIsNone(penalties[2]["session"])


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


class TestMainEmptyResultDoesNotOverwriteExistingData(unittest.TestCase):
    """main() must not let a round that scrapes to zero penalties silently
    overwrite real, non-empty data already on file for that round - the
    noticeboard feed fetching fine but BARC_SERIES_MARKER matching nothing
    (e.g. BARC changes its title wording) looks identical to a genuinely
    penalty-free weekend from the empty list alone, so an empty result can
    only be trusted when there was nothing already on file to lose."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.data_dir = Path(self.tmp.name)
        self.calendar_path = self.data_dir / "calendar.json"
        self.penalties_path = self.data_dir / "penalties2026.json"

        calendar = {"rounds": [
            {"round": 99, "venue": "Testville", "startDate": "2026-09-26", "endDate": "2026-09-27"},
        ]}
        self.calendar_path.write_text(json.dumps(calendar))

        self._orig_calendar_path = sp.CALENDAR_PATH
        self._orig_data_dir = sp.DATA_DIR
        self._orig_scrape_round_penalties = sp.scrape_round_penalties
        self._orig_fetch_noticeboard = sp.fetch_noticeboard
        sp.fetch_noticeboard = lambda: {"documents": []}
        sp.CALENDAR_PATH = self.calendar_path
        sp.DATA_DIR = self.data_dir

    def tearDown(self):
        sp.CALENDAR_PATH = self._orig_calendar_path
        sp.DATA_DIR = self._orig_data_dir
        sp.scrape_round_penalties = self._orig_scrape_round_penalties
        sp.fetch_noticeboard = self._orig_fetch_noticeboard

    def _write_existing_penalties(self, round_num, penalties):
        self.penalties_path.write_text(json.dumps(
            {"season": "2026", "rounds": [{"round": round_num, "penalties": penalties}]}
        ))

    def test_existing_data_preserved_and_run_fails_when_new_scrape_is_empty(self):
        existing_penalty = {"driver": "Chris Smiley", "summary": "5s time penalty"}
        self._write_existing_penalties(99, [existing_penalty])
        sp.scrape_round_penalties = lambda round_info, feed: []

        with self.assertRaises(SystemExit) as ctx:
            sp.main()
        self.assertNotEqual(ctx.exception.code, 0)

        # Fatal, and crucially the existing on-file data for round 99 must
        # not have been overwritten with the empty result.
        on_disk = json.loads(self.penalties_path.read_text())
        round_99 = next(r for r in on_disk["rounds"] if r["round"] == 99)
        self.assertEqual(round_99["penalties"], [existing_penalty])

    def test_confirmed_zero_is_accepted_when_nothing_was_on_file_before(self):
        # No prior penalties.json at all for this round - an empty result is
        # the only information we have, so it's accepted as legitimate
        # rather than treated as a suspected failure.
        sp.scrape_round_penalties = lambda round_info, feed: []

        sp.main()  # must not raise

        on_disk = json.loads(self.penalties_path.read_text())
        round_99 = next(r for r in on_disk["rounds"] if r["round"] == 99)
        self.assertEqual(round_99["penalties"], [])

    def test_non_empty_new_result_still_overwrites_normally(self):
        self._write_existing_penalties(99, [{"driver": "Old Driver", "summary": "Old penalty"}])
        new_penalty = {"driver": "New Driver", "summary": "New penalty"}
        sp.scrape_round_penalties = lambda round_info, feed: [new_penalty]

        sp.main()  # must not raise - a real, non-empty new result is a normal update

        on_disk = json.loads(self.penalties_path.read_text())
        round_99 = next(r for r in on_disk["rounds"] if r["round"] == 99)
        self.assertEqual(round_99["penalties"], [new_penalty])

    def test_round_missing_from_noticeboard_fails_the_run(self):
        # The old barc.net source vanished and four weekly runs went green
        # with nothing scraped - a round that can't be found must now fail.
        self._write_existing_penalties(99, [{"driver": "Kept"}])
        sp.scrape_round_penalties = lambda round_info, feed: None

        with self.assertRaises(SystemExit) as ctx:
            sp.main()
        self.assertNotEqual(ctx.exception.code, 0)
        on_disk = json.loads(self.penalties_path.read_text())
        self.assertEqual(on_disk["rounds"][0]["penalties"], [{"driver": "Kept"}])

    def test_unreachable_feed_fails_the_run(self):
        sp.fetch_noticeboard = lambda: None
        with self.assertRaises(SystemExit) as ctx:
            sp.main()
        self.assertNotEqual(ctx.exception.code, 0)


if __name__ == "__main__":
    unittest.main()
