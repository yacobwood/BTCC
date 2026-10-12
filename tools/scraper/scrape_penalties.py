#!/usr/bin/env python3
"""
BTCC Penalty/Judicial Decision Scraper — reads BARC's Online Noticeboard.

BARC (the BTCC's organising club) publishes every Clerk of the Course and
stewards' decision as a PDF on its online noticeboard. Since BARC relaunched
barc.net (between rounds 8 and 9 of 2026) that noticeboard lives on GT Apps
Race Control, and TOCA meetings have their own board with a JSON feed:
    https://racecontrol.gtapps.co.uk/barc/noticeboard/TOCA/documents
(the old barc.net WordPress noticeboard and every PDF it hosted now 404).

This script:
  1. Fetches that feed and picks the season event whose dates overlap the
     calendar round (see btcc_notices_for_round). A decision posted at a
     later meeting but tagged with an earlier venue in its title (seen live:
     two Croft decisions posted at Silverstone as "... (Croft)") is moved to
     that venue's round instead.
  2. Keeps every "... Decision" document (Judicial/Clerks/Stewards) whose
     title names the British Touring Car Championship - the board lists
     every series racing that weekend (Mini Challenge, British F4, Porsche
     Carrera Cup, etc.), so this filter is what keeps BTCC-only.
  3. Downloads each linked PDF and parses it into a driver/session/one-line
     summary using position-aware text extraction (same pdfminer technique
     scrape_tsl.py uses for the grid PDFs).

Several live document layouts have been observed within this same 2026
season (BARC changed their form between round 3 and round 7, and stewards'
appeal hearings use a different form again), so parsing is template-aware
with a safe generic fallback for anything that matches none - see
detect_template(). A row that can't be parsed in detail is still recorded
(driver + session + link), just without a detailed summary, rather than
being dropped or crashing the run.

Usage:
    python scrape_penalties.py 2026 --round 9           # scrape one round
    python scrape_penalties.py 2026 --round 9 --dry-run # print, don't write
"""

from __future__ import annotations

import datetime
import io
import json
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

try:
    from pdfminer.high_level import extract_pages
    from pdfminer.layout import LTTextContainer, LTTextLine
except ImportError:
    print("ERROR: pdfminer.six is required. Run: pip install pdfminer.six", file=sys.stderr)
    sys.exit(1)

YEAR         = int(sys.argv[1]) if len(sys.argv) > 1 else 2026
ROUND_FILTER = None
DRY_RUN      = "--dry-run" in sys.argv

for i, arg in enumerate(sys.argv):
    if arg == "--round" and i + 1 < len(sys.argv):
        ROUND_FILTER = int(sys.argv[i + 1])

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"
CALENDAR_PATH = DATA_DIR / "calendar.json"

NOTICEBOARD_FEED = "https://racecontrol.gtapps.co.uk/barc/noticeboard/TOCA/documents"
BARC_SERIES_MARKER = "British Touring Car Championship"  # excludes support series and the
                                                            # "BTCC" (abbreviated) grid/classification rows


# ── HTTP ─────────────────────────────────────────────────────────────────────

def _http_get(url, timeout=20):
    """Plain GET with a browser User-Agent. The GT Apps noticeboard (unlike
    btcc.net) has no JS bot-challenge and serves its document list as plain
    JSON, so this doesn't need Playwright/headless rendering - confirmed live."""
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        if r.status != 200:
            raise urllib.error.HTTPError(url, r.status, "non-200", r.headers, None)
        return r.read()


def fetch_json(url):
    try:
        return json.loads(_http_get(url).decode("utf-8"))
    except Exception as e:
        print(f"ERROR: could not fetch {url} ({e})", file=sys.stderr)
        return None


def fetch_pdf(url):
    try:
        return _http_get(url, timeout=30)
    except Exception as e:
        print(f"ERROR: could not fetch PDF {url} ({e})", file=sys.stderr)
        return None


# ── Step 1: pick this round's BTCC decisions from the noticeboard feed ─────

_PAGE_RE = re.compile(r"\s*Page\s+(\d+)\s+of\s+\d+", re.IGNORECASE)
_VENUE_TAG_RE = re.compile(r"\(([A-Za-z][A-Za-z .]*)\)")


def _venue_key(venue):
    """First word of a venue name, letters only - "Brands Hatch GP" and a
    "(Brands Hatch)" title tag both reduce to "brands"."""
    return re.sub(r"[^a-z]", "", venue.split()[0].lower()) if venue.strip() else ""


def _title_driver(title):
    """Driver (or team) named in a noticeboard title. Titles are typed by
    hand and vary (all confirmed live): "British Touring Car Championship -
    Josh Cook", "...Championship -Tom Chilton", "... - No 3 Tom Chilton
    (Croft)", "... - Ricky Collard Page 1 of 2", "... - Arjen Kraling (2)".
    Only used as a fallback - the PDF's own driver field wins when parsed."""
    rest = title.split(BARC_SERIES_MARKER, 1)[-1]
    rest = _PAGE_RE.sub("", rest)
    rest = re.sub(r"\([^)]*\)", "", rest)
    driver = re.split(r"\s+-\s*|^\s*-\s*", rest.strip())[-1]
    driver = re.sub(r"^No\.?\s*\d+\s+", "", driver.strip(), flags=re.IGNORECASE)
    return re.sub(r"\s+", " ", driver).strip()


def btcc_notices_for_round(feed, round_info):
    """Return (event_found, [{title, pdf_url, driver}]) for one calendar round.

    A document belongs to the round when its season event's dates overlap
    the round's, unless its title carries a "(Venue)" tag - then it belongs
    to whichever round is at that venue. Seen live: the stewards ruled on
    two Croft incidents after the fact and posted them at Silverstone as
    "... - Sam Osborne (Croft)". Continuation pages ("Page 2 of 2" - the
    stewards' written reasons for a hearing) are skipped; page 1 carries the
    decision itself."""
    events = {}
    for season in feed.get("seasons", []):
        if str(YEAR) in str(season.get("name", "")):
            for e in season.get("events", []):
                events[e["uuid"]] = e
    host_events = {
        uuid for uuid, e in events.items()
        if e.get("event_from_date") and e.get("event_to_date")
        and datetime.date.fromisoformat(e["event_from_date"]) <= round_info["_end"]
        and datetime.date.fromisoformat(e["event_to_date"]) >= round_info["_start"]
    }
    round_key = _venue_key(round_info["venue"])

    notices, seen = [], set()
    for doc in feed.get("documents", []):
        title = re.sub(r"\s+", " ", doc.get("title") or "").strip()
        if "decision" not in (doc.get("category_name") or "").lower():
            continue
        if BARC_SERIES_MARKER.lower() not in title.lower():
            continue
        page = _PAGE_RE.search(title)
        if page and int(page.group(1)) > 1:
            continue
        tag = _VENUE_TAG_RE.search(title)
        if tag:
            belongs = _venue_key(tag.group(1)) == round_key
        else:
            belongs = doc.get("season_event_uuid") in host_events
        pdf_url = (doc.get("pdf_url") or "").split("#")[0]
        if not belongs or not pdf_url or pdf_url in seen:
            continue
        seen.add(pdf_url)
        notices.append({"title": title, "pdf_url": pdf_url, "driver": _title_driver(title)})
    return bool(host_events), notices


# ── Step 3: parse a judicial decision PDF ───────────────────────────────────

CHECKBOX_X_MAX = 90          # marker column (the "X") sits left of this; option text starts right of it
CONTINUATION_GAP = 18        # pt: a line within this of the previous option line is a wrapped continuation,
                              # not a new option (confirmed against 8 real documents: same-option wraps run
                              # ~12-15pt apart, distinct options run ~24-47pt apart)

SESSION_TOKEN = r"(?:Free Practice|Qualifying Race|Qualifying|Q\.?\s*Race|Race\s*[123]|R[123])"
# BARC's own writers aren't consistent about the separator between venue and
# session (confirmed live: some documents use ":", others an en-dash "–" or
# plain hyphen), so this accepts any of them rather than just ":".
_VENUE_SESSION_RE = re.compile(rf"^[A-Za-z][A-Za-z .]*?\s*[:–-]\s*({SESSION_TOKEN})\s*$", re.IGNORECASE)

SESSION_ALIASES = {
    "fp": "Free Practice", "free practice": "Free Practice",
    "q": "Qualifying", "qual": "Qualifying", "qualifying": "Qualifying",
    "q race": "Qualifying Race", "q. race": "Qualifying Race",
    "qualifying race": "Qualifying Race", "qr": "Qualifying Race",
    "race 1": "Race 1", "r1": "Race 1",
    "race 2": "Race 2", "r2": "Race 2",
    "race 3": "Race 3", "r3": "Race 3",
}

NUM_WORDS = {"one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
             "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10}


def normalize_session(raw):
    """Map a BARC session string (e.g. "Race 2", or a full "Donington :
    Race 2" venue-prefixed value) onto the race.label vocabulary
    results{year}.json already uses, so the app can match a penalty straight
    to its session tab. Falls back to the trimmed raw string (better than
    nothing) if it isn't a recognised alias."""
    if not raw:
        return None
    value = raw.split(":")[-1].strip()  # tolerate an un-stripped "Venue : Session" value too
    key = re.sub(r"\s+", " ", value.lower())
    return SESSION_ALIASES.get(key, value)


def extract_pdf_lines(pdf_bytes):
    """Return every text line on page 1 as (y0, x0, text), top to bottom (and
    left to right for same-row ties) - the same layout-aware approach
    scrape_tsl.py uses for grid PDFs. Returns [] (not an exception) on a
    corrupt/unreadable PDF so callers can degrade gracefully instead of
    aborting the whole scrape run."""
    try:
        lines = []
        for page_layout in extract_pages(io.BytesIO(pdf_bytes)):
            for element in page_layout:
                if isinstance(element, LTTextContainer):
                    for line in element:
                        if isinstance(line, LTTextLine):
                            text = line.get_text().strip()
                            if text:
                                lines.append((round(line.y0, 1), round(line.x0, 1), text))
            break  # decisions are always a single page
        lines.sort(key=lambda t: (-t[0], t[1]))
        return lines
    except Exception as e:
        print(f"WARNING: could not extract text from PDF ({e})", file=sys.stderr)
        return []


def _find_line(lines, substr, y_max=None, y_min=None):
    """First line (top to bottom) containing substr (case-insensitive),
    optionally bounded to a y0 window."""
    for y0, x0, text in lines:
        if (y_max is None or y0 <= y_max) and (y_min is None or y0 >= y_min) and substr.lower() in text.lower():
            return (y0, x0, text)
    return None


def _find_session_line(lines):
    """Finds a standalone "Venue : Session" line (e.g. "Snetterton : Q.
    Race") anywhere on the page - used by template A, whose venue/session
    field isn't otherwise easy to isolate positionally (two-column form with
    label and value on different rows to their neighbours)."""
    for _, _, text in lines:
        m = _VENUE_SESSION_RE.match(text.strip())
        if m:
            return m.group(1)
    return None


def _find_checked_option(lines, block_top, block_bottom):
    """Shared checkbox-matching logic for both known templates: within the
    given y-range, find the literal "X" marker in the narrow left "marker"
    column, group the indented option lines into paragraphs (merging wrapped
    continuation lines), then return whichever option paragraph starts
    closest to the X. Confirmed against 8 real documents across both
    templates: the X always lands within ~1-9pt of its option's first line -
    comfortably closer than any neighbouring option - so a generously wide
    block window (which may pick up a line or two from an adjacent field) is
    safe: those strays never win the nearest-distance comparison.

    Returns the matched option's cleaned text, or None if no "X" was found
    (e.g. an unfilled form, or a sanction layout this doesn't recognise)."""
    markers = [(y0, x0, t) for y0, x0, t in lines
               if block_top >= y0 >= block_bottom and x0 < CHECKBOX_X_MAX and t.strip().upper() == "X"]
    if not markers:
        return None

    option_lines = [(y0, x0, t) for y0, x0, t in lines
                     if block_top >= y0 >= block_bottom and x0 >= CHECKBOX_X_MAX]
    if not option_lines:
        return None

    groups = []  # [{"y0": first line's y0, "text": [lines]}], built in top-to-bottom order
    for y0, x0, text in option_lines:
        if groups and (groups[-1]["y0"] - y0) <= CONTINUATION_GAP:
            groups[-1]["text"].append(text)
        else:
            groups.append({"y0": y0, "text": [text]})

    marker_y0 = markers[0][0]
    nearest = min(groups, key=lambda g: abs(g["y0"] - marker_y0))
    return re.sub(r"\s+", " ", " ".join(nearest["text"])).strip()


def _number_near(text, keyword_pattern):
    """A digit or spelled-out number ("five") sitting close before
    keyword_pattern (e.g. "seconds?", "place") - anchored like this rather
    than "any number in the sentence" so an unrelated number elsewhere (a
    document was seen citing "...elapsed time for round 19" right after the
    actual "five second" penalty) doesn't get picked up instead. The gap
    tolerates a short parenthetical duplicate ("5 (five) points", seen live)
    without matching across an unrelated word, or a hyphenated compound
    ("three-place penalty", seen live)."""
    m = re.search(r"\b(\d+|" + "|".join(NUM_WORDS) + r")\b[\s()A-Za-z-]{0,15}?" + keyword_pattern, text, re.IGNORECASE)
    if not m:
        return None
    val = m.group(1).lower()
    return NUM_WORDS.get(val) or (int(val) if val.isdigit() else None)


def _prose_order_text(lines):
    """Fallback for decisions that state the sanction directly in a plain
    sentence rather than via a checkbox list - confirmed live across both
    templates: false-start penalties, penalty rescindments on appeal, and
    championship point deductions are all written this way instead. Returns
    the text starting at "I order that", trimmed at the first sentence-like
    boundary so it doesn't run on into unrelated boilerplate."""
    full_text = re.sub(r"\s+", " ", " ".join(t for _, x0, t in lines if x0 > 50)).strip()
    m = re.search(r"I order that.{0,200}", full_text, re.IGNORECASE)
    if not m:
        return None
    text = m.group(0)
    # "Reason" is template B's next labelled field - a prose decision with
    # no closing full stop otherwise runs straight on into it (seen live).
    cut = re.search(r"\.\s|\.$|You are reminded|Penalty points|No penalty points|Signed:|\bReason\b", text)
    return (text[:cut.start()] if cut else text).strip()


def humanize_sanction(raw_text):
    """Turn a checked option's raw form text (e.g. "Be penalised by the
    addition of 5 seconds to your race time.") into a short display label.
    Falls back to a lightly-cleaned version of the raw text for any phrasing
    this doesn't specifically recognise, rather than dropping it."""
    if not raw_text:
        return None
    t = re.sub(r"(\.\s*){2,}", " ", raw_text)  # collapse ". . . ." blank-fill placeholders
    t = re.sub(r"…", "", t).strip().rstrip(",:;.")
    tl = t.lower()

    if "appeal" in tl and "reject" in tl:
        return "Appeal rejected - penalty upheld"
    if "appeal" in tl and "upheld" in tl:
        return "Appeal upheld"
    if "rescind" in tl:
        return "Penalty rescinded"
    if "disqualif" in tl:
        return "Disqualified from the results"
    if "strike" in tl:
        return "Strike issued"
    if "deduct" in tl and "point" in tl:
        n = _number_near(t, r"points?")
        return f"{n} points deducted" if n else "Points deducted"
    if "second" in tl and ("penalt" in tl or "elapsed time" in tl or "race time" in tl):
        n = _number_near(t, r"seconds?")
        return f"{n}s time penalty" if n else "Time penalty"
    if "place" in tl and "penalty" in tl and "result" in tl and "grid" not in tl:
        # Applied to a finishing position, not the next race's grid (seen
        # live: "a three-place penalty for the result of the Qualifying Race").
        n = _number_near(t, r"place")
        return f"{n}-place penalty" if n else "Place penalty"
    if "grid penalty" in tl or ("place" in tl and "penalty" in tl):
        n = _number_near(t, r"place")
        return f"{n}-place grid penalty" if n else "Grid penalty"
    if "written reprimand" in tl or "officially reprimanded" in tl:
        return "Written reprimand"
    if "reprimand" in tl:
        return "Reprimand"
    if "verbal" in tl and "warn" in tl:
        return "Verbal warning"
    if "fine" in tl or "fined" in tl:
        m = re.search(r"£\s*([\d.]+)", t)
        return f"Fined £{m.group(1)}" if m and m.group(1).strip(".") else "Fine"
    if "forfeit" in tl and "point" in tl:
        n = _number_near(t, r"points?")
        return f"Forfeited {n} points" if n else "Points forfeited"

    cleaned = re.sub(r"^(be |by means of a |by the addition of )", "", t, flags=re.IGNORECASE).strip()
    return (cleaned[0].upper() + cleaned[1:]) if cleaned else None


def detect_template(lines):
    """Two live templates confirmed within this season (BARC changed their
    form between round 3 and round 7): "A" headed BRITISH AUTOMOBILE RACING
    CLUB with inline "I find that ... In that ..." prose, "B" headed BRITISH
    TOURING CAR CHAMPIONSHIP with labelled Car/Entrant/Session/Facts/Offence/
    Decision fields. Returns None for anything else so callers can degrade
    to a minimal entry instead of guessing at an unknown layout."""
    header = " ".join(t for y0, x0, t in lines if y0 > 730)
    if "BRITISH AUTOMOBILE RACING CLUB" in header:
        return "A"
    if "BRITISH TOURING CAR CHAMPIONSHIP" in header:
        return "B"
    if "DECISION OF THE STEWARDS HEARING" in header.upper():
        return "H"
    return None


def parse_template_a(lines):
    """Prose form: "...I find that you are guilty of contravening, {RULE}
    ... In that {facts} ... Therefore, under NCR ..., I order that you
    should: {checkbox list}". A second sub-variant (confirmed live: false
    starts, and appeal rulings that rescind an earlier penalty) skips the
    rule citation and checkbox list entirely and states the sanction as a
    plain sentence instead - see the "I order that" fallback below.

    Driver/car/session are extracted unconditionally; the rule/checkbox
    portion is genuinely optional so its absence never discards otherwise-
    good driver/session data by falling back to a template-wide None."""
    header_line = _find_line(lines, "car", y_max=800, y_min=630)  # e.g. "Charles Rainford : Car 99"
    m = re.search(r"^(.*?)\s*[:\-]\s*Car\s*(?:No\.?:?)?\s*:?\s*(\d+)", header_line[2], re.IGNORECASE) if header_line else None
    if not m:
        return None  # doesn't even match this template's driver/car header shape - not template A after all
    driver = m.group(1).strip()
    car_no = int(m.group(2))

    session_raw = _find_session_line(lines)

    rule_ref = facts = offence = decision = sanction = None
    guilty_line = _find_line(lines, "guilty of contravening") or _find_line(lines, "you have contravened")
    order_line = _find_line(lines, "i order that you should")
    if guilty_line and order_line:
        # Rule citation + facts: everything strictly between the "guilty of
        # ..." anchor and the "I order ..." anchor, split at "In that" - the
        # part before is the rule citation ("Offence"), the part after is the
        # plain-English incident description ("Facts").
        body = [(y0, x0, t) for y0, x0, t in lines if guilty_line[0] > y0 > order_line[0] + 5]
        body_text = re.sub(r"\s+", " ", " ".join(t for _, _, t in body)).strip()
        split_m = re.search(r"(.*?)\bIn that\b\s*(.+)", body_text, re.IGNORECASE)
        offence, facts = (split_m.group(1).strip(), split_m.group(2).strip()) if split_m else (body_text, None)
        rule_m = re.match(r"(NCR|TR)\s*[\d.A-Za-z]+", offence)
        rule_ref = rule_m.group(0) if rule_m else None
        decision = _find_checked_option(lines, order_line[0] - 1, order_line[0] - 260)
        sanction = humanize_sanction(decision)

    if sanction is None and decision is None:
        prose = _prose_order_text(lines)
        if prose:
            # This template's prose sub-variant states facts/offence/decision
            # as one free-running sentence with no structural seam to split
            # on - closest in spirit to "Decision" (it IS the operative
            # sanction statement), so facts/offence stay unset here rather
            # than guessing at a split that isn't really there.
            decision = re.sub(r"^I order that[:;]?\s*", "", prose, flags=re.IGNORECASE).strip(" ;:.")
            sanction = humanize_sanction(prose)

    return {"driver": driver, "carNo": car_no, "sessionRaw": session_raw,
            "ruleRef": rule_ref, "facts": facts, "offence": offence,
            "decision": decision, "sanction": sanction}


def parse_template_b(lines):
    """Labelled-field form: "Car No / Driver", "Entrant", "Session", "Facts",
    "Offence", "Decision" rows, each a (label, value) pair on the same y0,
    followed by the checkbox list under "Decision". Each field's value is
    bounded by its own label's y0 down to the next label's y0, so a
    multi-line value never bleeds into the following field.

    Every field below "Car No / Driver" is genuinely optional in practice -
    a confirmed live example (a championship point deduction) has no
    "Decision" checkbox row at all and states the outcome as a plain
    sentence instead, handled by the "I order that" fallback below."""
    def field_y(label):
        return next((y0 for y0, x0, t in lines if t.strip() == label), None)

    driver_line = next((t for y0, x0, t in lines if re.match(r"Car No / Driver", t)), None)
    m = re.search(r"(\d+)\s*/\s*(.+)", driver_line) if driver_line else None
    if not m:
        return None  # doesn't match this template's driver/car header shape - not template B after all
    car_no = int(m.group(1))
    driver = m.group(2).strip()

    session_y = field_y("Session")
    facts_y = field_y("Facts")
    offence_y = field_y("Offence")
    decision_y = field_y("Decision")

    def value_between(top_y, bottom_y):
        if top_y is None:
            return None
        bottom = bottom_y if bottom_y is not None else top_y - 200
        vals = [t for y0, x0, t in lines if x0 > CHECKBOX_X_MAX and top_y >= y0 > bottom]
        return re.sub(r"\s+", " ", " ".join(vals)).strip() or None

    session_raw = value_between(session_y, facts_y) or _find_session_line(lines)
    facts = value_between(facts_y, offence_y)
    offence = value_between(offence_y, decision_y)
    rule_m = re.match(r"(NCR|TR)\s*[\d.A-Za-z]+", offence) if offence else None
    rule_ref = rule_m.group(0) if rule_m else None

    decision = _find_checked_option(lines, decision_y - 1, decision_y - 200) if decision_y else None
    sanction = humanize_sanction(decision)

    if sanction is None and decision is None:
        prose = _prose_order_text(lines)
        if prose:
            # See the equivalent branch in parse_template_a for why this goes
            # into "decision" rather than "facts"/"offence".
            decision = re.sub(r"^I order that[:;]?\s*", "", prose, flags=re.IGNORECASE).strip(" ;:.")
            sanction = humanize_sanction(prose)

    return {"driver": driver, "carNo": car_no, "sessionRaw": session_raw,
            "ruleRef": rule_ref, "facts": facts, "offence": offence,
            "decision": decision, "sanction": sanction}


def parse_recipient_form(lines):
    """Template B's header with two separate "To:" recipients (team, then
    driver) in place of the "Car No / Driver" row - used for championship
    points deductions after a scrutineering report (confirmed live: Dorlin
    and Chilton engine changes). Prose only: "...guilty of contravening
    {RULE}: {facts} Therefore, under ... I order that; {decision}". Not tied
    to a session, so sessionRaw stays None. Driver is left None for the
    caller to fill from the noticeboard title - the recipient names sit in
    a free-form column with nothing marking which one is the driver."""
    guilty_line = _find_line(lines, "guilty of contravening")
    therefore_line = _find_line(lines, "therefore")
    prose = _prose_order_text(lines)
    if not (guilty_line and therefore_line and prose):
        return None
    car_line = next((t for _, _, t in lines if re.fullmatch(r"Car\s*(?:No\.?)?\s*\d+", t.strip())), None)
    car_no = int(re.search(r"\d+", car_line).group(0)) if car_line else None

    body = [t for y0, _, t in lines if guilty_line[0] >= y0 > therefore_line[0]]
    body_text = re.sub(r"\s+", " ", " ".join(body)).strip()
    body_text = re.sub(r"^.*?guilty of contravening\s*", "", body_text, flags=re.IGNORECASE)
    rule_m = re.search(r"\b(?:NCR|TR|CR)\s*[\d.]*\d", body_text)
    offence, _, facts = body_text.partition(":")
    decision = re.sub(r"^I order that[:;]?\s*", "", prose, flags=re.IGNORECASE)
    decision = re.sub(r"\s*\band,?$", "", decision.strip(" ;:.,")).strip(" ;:.,")
    return {"driver": None, "carNo": car_no, "sessionRaw": None,
            "ruleRef": rule_m.group(0) if rule_m else None,
            "facts": facts.strip() or None, "offence": offence.strip() or None,
            "decision": decision, "sanction": humanize_sanction(prose)}


def parse_stewards_hearing(lines):
    """"DECISION OF THE STEWARDS HEARING" form (confirmed live: Collard's
    appeal at Brands GP 2026). Labelled rows - "Name:" ("Team / Driver"),
    "Competition Number in Event:" - with each value on the same baseline
    to the right of its label, then a numbered "The Stewards decision is:"
    list. Facts sit in a separate "Reasons" document (posted as page 2,
    which the noticeboard step skips), so facts stays None here."""
    def value_right_of(label):
        lab = _find_line(lines, label)
        if not lab:
            return None
        vals = [t for y0, x0, t in lines if abs(y0 - lab[0]) <= 2 and x0 > lab[1] + 100]
        return vals[0].strip() if vals else None

    name = value_right_of("Name:")
    car = value_right_of("Competition Number in Event")
    top = _find_line(lines, "The Stewards decision is")
    if not (name or car) or not top:
        return None
    bottom = _find_line(lines, "Reason(s) for this decision")
    bottom_y = bottom[0] if bottom else top[0] - 150
    items = [t for y0, _, t in lines if top[0] > y0 > bottom_y]
    decision = re.sub(r"\s+", " ", " ".join(items)).strip() or None
    return {"driver": name.split("/")[-1].strip() if name else None,
            "carNo": int(car) if car and car.isdigit() else None, "sessionRaw": None,
            "ruleRef": None, "facts": None, "offence": None,
            "decision": decision, "sanction": humanize_sanction(decision)}


def build_one_liner(driver, car_no, sanction, facts):
    """A compact one-line fallback summary - used as accessibility text and
    for the minimal-confidence case where facts/offence/decision aren't
    individually available. The app's own UI shows facts/offence/decision as
    separate labelled fields rather than this collapsed form when it has them."""
    car_part = f" (No. {car_no})" if car_no else ""
    desc = re.sub(r"\s+", " ", facts or "").strip()
    if len(desc) > 160:
        desc = desc[:157].rstrip() + "…"
    label = sanction or "Judicial decision"
    return f"{driver}{car_part}: {label} - {desc}" if desc else f"{driver}{car_part}: {label}"


NO_ACTION_PHRASES = (
    "unable to take any judicial action", "no further action",
    "no action is required", "decided to take no action",
)


def _is_no_action(lines):
    """Some notices are an exoneration, not a penalty (confirmed live: "I
    feel that I am unable to take any judicial action with regard to an
    incident..."). These must be dropped entirely rather than recorded with
    a generic "judicial decision issued" summary - that phrasing would
    misleadingly read as a penalty on a driver who was actually cleared."""
    full_text = " ".join(t for _, _, t in lines).lower()
    return any(p in full_text for p in NO_ACTION_PHRASES)


def parse_penalty_pdf(pdf_bytes, fallback_driver, pdf_url):
    """Returns a usable entry for any real penalty - a fully-detailed one
    when the PDF matches a known template, otherwise a minimal driver/link-
    only one so a document in an unrecognised layout is still surfaced
    rather than lost. Returns None (skip this notice entirely) for a
    confirmed exoneration - see _is_no_action."""
    lines = extract_pdf_lines(pdf_bytes)
    if lines and _is_no_action(lines):
        print(f"INFO: {fallback_driver} ({pdf_url}) - no judicial action taken, excluding from penalties", file=sys.stderr)
        return None
    template = detect_template(lines) if lines else None
    parsed = None
    if template == "A":
        parsed = parse_template_a(lines)
    elif template == "B":
        parsed = parse_template_b(lines) or parse_recipient_form(lines)
    elif template == "H":
        parsed = parse_stewards_hearing(lines)

    if not parsed:
        print(f"WARNING: unrecognised judicial decision layout for {fallback_driver} ({pdf_url}) - "
              "recording without a detailed summary", file=sys.stderr)
        return {
            "driver": fallback_driver, "carNo": None, "session": None,
            "ruleRef": None, "facts": None, "offence": None, "decision": None, "sanction": None,
            "oneLiner": f"{fallback_driver}: judicial decision issued - view document for details",
            "pdfUrl": pdf_url, "confidence": "minimal",
        }

    driver = parsed["driver"] or fallback_driver
    session = normalize_session(parsed["sessionRaw"])
    return {
        "driver": driver, "carNo": parsed["carNo"], "session": session,
        "ruleRef": parsed["ruleRef"], "facts": parsed["facts"], "offence": parsed["offence"],
        "decision": parsed["decision"], "sanction": parsed["sanction"],
        "oneLiner": build_one_liner(driver, parsed["carNo"], parsed["sanction"], parsed["facts"]),
        "pdfUrl": pdf_url, "confidence": "full" if parsed["sanction"] else "partial",
    }


# ── Orchestration ────────────────────────────────────────────────────────────

def fetch_noticeboard():
    feed = fetch_json(NOTICEBOARD_FEED)
    if not isinstance(feed, dict) or "documents" not in feed:
        print(f"ERROR: unexpected noticeboard feed shape from {NOTICEBOARD_FEED}", file=sys.stderr)
        return None
    return feed


def _inherit_appeal_sessions(penalties):
    """A stewards' appeal hearing never names the session - it rules on an
    earlier Clerk's decision. When that driver has exactly one other
    decision this round, the appeal is about it, so it takes that session
    (confirmed live: Collard's Brands GP Race 3 restart penalty + appeal)."""
    for p in penalties:
        if p["session"] or not (p["sanction"] or "").startswith("Appeal"):
            continue
        sessions = {q["session"] for q in penalties if q is not p and q["driver"] == p["driver"] and q["session"]}
        if len(sessions) == 1:
            p["session"] = sessions.pop()


def scrape_round_penalties(round_info, feed):
    """Returns the round's penalties, or None when the round isn't on the
    noticeboard at all (main() treats that as a failure, not a quiet zero)."""
    event_found, notices = btcc_notices_for_round(feed, round_info)
    if not event_found and not notices:
        print(f"WARNING: round {round_info['round']} ({round_info['venue']}, "
              f"{round_info['_start']}–{round_info['_end']}) is not on the noticeboard", file=sys.stderr)
        return None
    print(f"Round {round_info['round']} ({round_info['venue']}): {len(notices)} BTCC decision notice(s)", file=sys.stderr)

    penalties = []
    for notice in notices:
        pdf_bytes = fetch_pdf(notice["pdf_url"])
        if not pdf_bytes:
            print(f"WARNING: could not download {notice['pdf_url']} - skipping", file=sys.stderr)
            continue
        entry = parse_penalty_pdf(pdf_bytes, notice["driver"], notice["pdf_url"])
        if entry is not None:  # None = confirmed exoneration, not a penalty - see _is_no_action
            penalties.append(entry)
    _inherit_appeal_sessions(penalties)
    return penalties


def main():
    calendar = json.loads(CALENDAR_PATH.read_text(encoding="utf-8"))
    rounds = calendar.get("rounds", [])
    if ROUND_FILTER is not None:
        rounds = [r for r in rounds if r["round"] == ROUND_FILTER]
    if not rounds:
        print(f"No matching round(s) in calendar.json for round={ROUND_FILTER}", file=sys.stderr)
        sys.exit(1)

    for r in rounds:
        r["_start"] = datetime.date.fromisoformat(r["startDate"])
        r["_end"] = datetime.date.fromisoformat(r["endDate"])

    penalties_path = DATA_DIR / f"penalties{YEAR}.json"
    existing = json.loads(penalties_path.read_text(encoding="utf-8")) if penalties_path.exists() else {"season": str(YEAR), "rounds": []}
    output_rounds = {r["round"]: r for r in existing.get("rounds", [])}

    feed = fetch_noticeboard()
    if feed is None:
        sys.exit(1)

    any_scraped = False
    suspected_failures = []
    not_found = []
    for round_info in rounds:
        penalties = scrape_round_penalties(round_info, feed)
        if penalties is None:
            # Existing data (if any) is preserved, but this still fails the
            # run below - the old barc.net source vanished in a site relaunch
            # and four weekly runs went green with nothing scraped.
            not_found.append(round_info["round"])
            continue
        existing_round = output_rounds.get(round_info["round"])
        existing_penalties = existing_round.get("penalties") if existing_round else None
        if not penalties and existing_penalties:
            # scrape_round_penalties returns [] both when a round genuinely
            # had zero BTCC judicial notices this weekend AND when the
            # noticeboard page's markup changed and _ROW_RE/BARC_SERIES_MARKER
            # silently matched nothing - an empty list alone can't tell those
            # apart. We already have real, non-empty data on file for this
            # round, so treat the new empty result as a suspected parse
            # failure rather than a confirmed legitimate zero: don't
            # overwrite known-good data with it.
            print(
                f"WARNING: round {round_info['round']} scraped 0 penalties but "
                f"{len(existing_penalties)} existing penalty entr"
                f"{'y' if len(existing_penalties) == 1 else 'ies'} already on file - "
                "suspected parse failure, not overwriting",
                file=sys.stderr,
            )
            suspected_failures.append(round_info["round"])
            continue
        output_rounds[round_info["round"]] = {"round": round_info["round"], "penalties": penalties}
        any_scraped = True

    result = {"season": str(YEAR), "rounds": [output_rounds[k] for k in sorted(output_rounds)]}

    if DRY_RUN:
        print(json.dumps(result, indent=2))
    elif any_scraped:
        penalties_path.write_text(json.dumps(result, indent=2))
        print(f"\nWrote {penalties_path}")
    else:
        print("\nNo rounds scraped successfully - leaving existing data untouched")

    if not_found:
        print(f"\nERROR: round(s) {not_found} not found on the noticeboard - failing the run "
              "so the retry/alert path fires", file=sys.stderr)
    if suspected_failures:
        print(
            f"\nERROR: suspected parse failure(s) for round(s) {suspected_failures} - "
            "preserved existing data on file but failing the run so the retry/alert path fires",
            file=sys.stderr,
        )
    if not_found or suspected_failures:
        sys.exit(1)


if __name__ == "__main__":
    main()
