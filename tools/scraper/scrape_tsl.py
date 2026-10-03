#!/usr/bin/env python3
"""
BTCC Results Scraper — reads directly from TSL Timing PDFs.

TSL publishes PDFs within minutes of the chequered flag, long before
btcc.net updates. This script fetches each race PDF, parses the
classification, extracts laps-led data from the event book, and writes
data/results{year}.json + data/standings.json with no dependency on
any third-party website other than tsl-timing.com.

Usage:
    python scrape_tsl.py [year]              # scrape all rounds
    python scrape_tsl.py [year] --round N   # scrape specific round only
"""

import datetime
import json
import re
import sys
import tempfile
import urllib.request
from pathlib import Path

try:
    from pdfminer.high_level import extract_pages, extract_text as pdf_to_text
    from pdfminer.layout import LTTextBox, LTTextLine
except ImportError:
    print("ERROR: pdfminer.six is required. Run: pip install pdfminer.six", file=sys.stderr)
    sys.exit(1)

YEAR = int(sys.argv[1]) if len(sys.argv) > 1 else 2026
ROUND_FILTER    = None
SESSION_FILTER  = None  # None = all sessions; set of labels = only those
TODAY_MODE      = "--today" in sys.argv
SET_DRAW        = None  # --set-draw N: write reverseGridDraw on Race 3 of ROUND_FILTER

for i, arg in enumerate(sys.argv):
    if arg == "--round" and i + 1 < len(sys.argv):
        ROUND_FILTER = int(sys.argv[i + 1])
    if arg == "--set-draw" and i + 1 < len(sys.argv):
        SET_DRAW = int(sys.argv[i + 1])

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
DATA_DIR   = REPO_ROOT / "data"

if TODAY_MODE and ROUND_FILTER is None:
    # Auto-detect today's round and restrict scraping to today's incomplete sessions
    _cal = json.loads((REPO_ROOT / "data" / "calendar.json").read_text())
    _today = datetime.date.today()
    _today_round = None
    _is_sunday   = False
    for _r in _cal.get("rounds", []):
        try:
            _start = datetime.date.fromisoformat(_r["startDate"])
            _end   = datetime.date.fromisoformat(_r["endDate"])
        except (KeyError, ValueError):
            continue
        if _start <= _today <= _end:
            _today_round = _r["round"]
            _is_sunday   = _today == _end
            break

    if _today_round is None:
        print("--today: no race today — exiting")
        sys.exit(0)

    ROUND_FILTER = _today_round
    _today_day   = "SUN" if _is_sunday else "SAT"

    _sched = json.loads((REPO_ROOT / "data" / "schedule.json").read_text())
    _round_sessions = next(
        (r["sessions"] for r in _sched.get("rounds", []) if r["round"] == _today_round),
        []
    )
    _today_labels = {s["name"] for s in _round_sessions if s.get("day") == _today_day}

    _results_path = REPO_ROOT / "data" / f"results{YEAR}.json"
    _already_done = set()
    if _results_path.exists():
        _existing = json.loads(_results_path.read_text())
        for _rnd in _existing.get("rounds", []):
            if _rnd.get("round") == _today_round:
                for _race in _rnd.get("races", []):
                    if _race.get("results"):
                        _already_done.add(_race["label"])
                break

    # Sessions needing results fetched (not yet committed)
    _needs_results = _today_labels - _already_done
    # Sessions with grid PDFs always stay in the filter even after results land —
    # TSL occasionally amends grid PDFs (e.g. corrected reverse-grid draw number)
    # and we need to re-fetch within the scrape window to catch those updates.
    _grid_labels = {"Qualifying Race", "Race 1", "Race 2", "Race 3"}
    SESSION_FILTER = _needs_results | (_today_labels & _grid_labels)
    if not SESSION_FILTER:
        print(f"--today: all sessions for Round {_today_round} {_today_day} already scraped — exiting")
        sys.exit(0)

    print(f"--today: Round {_today_round} {_today_day}, sessions to scrape: {sorted(SESSION_FILTER)}")

TSL_BASE = "https://www.tsl-timing.com/file/?f=TOCA/{year}/{tsl}{suffix}.pdf"

# Suffix for each session PDF (order determines tab order in the app)
SESSION_SUFFIXES = {
    "Free Practice":   "fp1",
    "Qualifying":      "qu1",
    "Qualifying Race": "qra",
    "Race 1":          "rc1",
    "Race 2":          "rc2",
    "Race 3":          "rc3",
}

# Heading text for each session's "Best Speeds" (speed trap leaderboard) page
# inside the book PDF. Qualifying Part 1 and Part 2 are merged into a single
# "Qualifying" entry after parsing (see _merge_best_speeds_blocks), since the
# app has one Qualifying session, not two groups.
#
# Every heading is confirmed live to follow "...{title sponsor} British
# Touring Car Championship" (the book's own repeated page title) - anchoring
# on the sponsor-independent tail rather than trying to match each heading's
# own text precisely sidesteps three real-world quirks: (1) inconsistent
# whitespace around dashes (e.g. "FREE PRACTICE SESSION  - BEST SPEEDS",
# double space, confirmed at one venue); (2) an optional "- ROUND N" segment
# some venues insert into the Free Practice/Qualifying Part 1/Part 2/
# Qualifying Race headings and others don't (confirmed live both ways,
# including Round 1's Qualifying Race heading, which omits it entirely:
# "QUALIFYING RACE - BEST SPEEDS", no round number at all); (3) the title
# sponsor itself changes over the years - confirmed live "Kwik Fit" from
# 2019 on, "Dunlop MSA" for 2010-2018 - so the prefix before "British
# Touring Car Championship" is a wildcard, not a fixed sponsor name, rather
# than an ever-growing hardcoded list of every sponsor BTCC has ever had.
# Anchoring here also means the plain "ROUND N - BEST SPEEDS" heading used
# by Race 1/2/3 can't be confused with "QUALIFYING RACE - ROUND N - BEST
# SPEEDS" (a real substring-collision risk otherwise, confirmed live)
# without needing a lookbehind, since only one of the two ever follows the
# title line directly.
# Case-insensitive throughout: the book's own title text is confirmed to
# vary between "Championship" and "championship" within the SAME PDF
# (Saturday sessions vs Sunday races, at one venue) - a TSL template
# inconsistency, not something to chase variant-by-variant.
# "Champ(?:ionship|inship)" also tolerates a confirmed-live literal typo
# in the 2018 Donington National book ("Champinship") that otherwise
# silently drops every report heading for 2 of that event's 3 races.
_TITLE = r"[^\n]*?British Touring Car Champ(?:ionship|inship)\s+"
_DASH  = r"\s*-\s*"
_ROUND_OPT = rf"(?:{_DASH}ROUND\s*\d+)?"


def _session_heading_patterns(report_name):
    """Build the same 4-heading family (FP/Qual Part 1/Qual Part 2/Qualifying
    Race) as BEST_SPEEDS_HEADINGS, for any other book-PDF report that follows
    the identical "{session} - {report_name}" shape (confirmed live for BEST
    SECTORS and STATISTICS too, same title-anchoring, same whitespace/
    round-number/case quirks)."""
    return [
        ("Free Practice",     re.compile(rf"{_TITLE}FREE PRACTICE SESSION{_ROUND_OPT}{_DASH}{report_name}", re.IGNORECASE)),
        ("Qualifying Part 1", re.compile(rf"{_TITLE}QUALIFYING{_DASH}PART 1{_ROUND_OPT}{_DASH}{report_name}", re.IGNORECASE)),
        ("Qualifying Part 2", re.compile(rf"{_TITLE}QUALIFYING{_DASH}PART 2{_ROUND_OPT}{_DASH}{report_name}", re.IGNORECASE)),
        ("Qualifying Race",   re.compile(rf"{_TITLE}QUALIFYING RACE{_ROUND_OPT}{_DASH}{report_name}", re.IGNORECASE)),
    ]


def _race_heading_pattern(report_name):
    """The plain "ROUND N - {report_name}" heading Race 1/2/3 use, for any
    book-PDF report following the same shape as BEST SPEEDS (see
    RACE_BEST_SPEEDS_RE's own docstring history for why this needs no
    lookbehind despite the substring-collision risk with the Qualifying
    Race heading above). "ROUND N" here is confirmed live to be the RACE
    number within the event (1/2/3), not the championship round number -
    captured as a group so a caller can read the race number directly off
    a match (e.g. _session_leader_history_label) rather than assuming a
    fixed count/order of headings always precedes it, which breaks the
    moment a report spans multiple pages with a repeated running header."""
    return re.compile(rf"{_TITLE}ROUND\s*(\d+){_DASH}{report_name}", re.IGNORECASE)


BEST_SPEEDS_HEADINGS = _session_heading_patterns("BEST SPEEDS")
RACE_BEST_SPEEDS_RE = _race_heading_pattern("BEST SPEEDS")

BEST_SECTORS_HEADINGS = _session_heading_patterns("BEST SECTORS")
RACE_BEST_SECTORS_RE = _race_heading_pattern("BEST SECTORS")

STATISTICS_HEADINGS = _session_heading_patterns("STATISTICS")
RACE_STATISTICS_RE = _race_heading_pattern("STATISTICS")

# Grid PDF suffix for each race session (published before the race starts)
GRID_SUFFIXES = {
    "Qualifying Race": "gqr",
    "Race 1":          "grd",
    "Race 2":          "gr2",
    "Race 3":          "gr3",
}

# Championship standings PDF suffix
CHAMPIONSHIP_SUFFIX = "ptstrg"

# Sessions that award no championship points
NO_POINTS_SESSIONS = {"Free Practice", "Qualifying"}

POINTS_QUALIFYING = {1:10, 2:9, 3:8, 4:7, 5:6, 6:5, 7:5, 8:4, 9:4, 10:3, 11:3, 12:2, 13:2, 14:1, 15:1}
POINTS_RACE       = {1:20, 2:17, 3:15, 4:13, 5:11, 6:10, 7:9, 8:8, 9:7, 10:6, 11:5, 12:4, 13:3, 14:2, 15:1}

# Driver name corrections (TSL → canonical)
DRIVER_NAME_MAP = {
    "Daryl DELEON": "Daryl DE LEON",
}

ROUNDS = {
    2026: [
        {"round": 1,  "venue": "Donington Park",    "date": "18 Apr 2026", "tsl": "261603"},
        {"round": 2,  "venue": "Brands Hatch Indy", "date": "09 May 2026", "tsl": "261903"},
        {"round": 3,  "venue": "Snetterton",        "date": "23 May 2026", "tsl": "262103"},
        {"round": 4,  "venue": "Oulton Park",       "date": "06 Jun 2026", "tsl": "262303"},
        {"round": 5,  "venue": "Thruxton",          "date": "25 Jul 2026", "tsl": "263003"},
        {"round": 6,  "venue": "Knockhill",         "date": "08 Aug 2026", "tsl": "263203"},
        {"round": 7,  "venue": "Donington Park GP", "date": "22 Aug 2026", "tsl": "263403"},
        {"round": 8,  "venue": "Croft",             "date": "05 Sep 2026", "tsl": "263603"},
        {"round": 9,  "venue": "Silverstone",       "date": "26 Sep 2026", "tsl": "263903"},
        {"round": 10, "venue": "Brands Hatch GP",   "date": "10 Oct 2026", "tsl": "264103"},
    ],
}


# ── PDF download ──────────────────────────────────────────────────────────────

def fetch_pdf(url):
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=20) as r:
            if r.status != 200:
                return None
            return r.read()
    except Exception:
        return None


def _pdf_elements(pdf_bytes):
    """Return list of (y0, x0, text) for all text lines in the PDF."""
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f:
        f.write(pdf_bytes)
        path = f.name
    try:
        elements = []
        for page_layout in extract_pages(path):
            for element in page_layout:
                if isinstance(element, LTTextBox):
                    for line in element:
                        if isinstance(line, LTTextLine):
                            txt = line.get_text().strip()
                            if txt:
                                elements.append((round(line.y0, 1), round(line.x0, 1), txt))
        return elements
    except Exception:
        return []
    finally:
        Path(path).unlink(missing_ok=True)


def _pdf_text(pdf_bytes):
    """Extract plain text from a PDF (used for book laps-led parsing)."""
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f:
        f.write(pdf_bytes)
        path = f.name
    try:
        return pdf_to_text(path)
    except Exception:
        return ""
    finally:
        Path(path).unlink(missing_ok=True)


# ── Grid parser ──────────────────────────────────────────────────────────────

def parse_grid(pdf_bytes):
    """
    Parse a TSL starting grid PDF into a list of grid position dicts.

    Grid PDFs use a two-column side-by-side layout (odd positions on the
    left, even on the right) rather than the single-column classification
    layout.  Column x-boundaries determined from live PDFs:

      Left column:   position x≈73–82  car-number x≈86–97  driver x≈105–250
      Right column:  position x≈313–322  car-number x≈325–340  driver x≈340–430
    """
    elements = _pdf_elements(pdf_bytes)

    def collect(pos_x_lo, pos_x_hi, no_x_lo, no_x_hi, drv_x_lo, drv_x_hi):
        entries = []
        seen = set()
        for y, x, t in elements:
            if not (pos_x_lo < x < pos_x_hi and re.match(r"^\d{1,2}$", t)):
                continue
            pos = int(t)
            if pos in seen:
                continue
            seen.add(pos)
            no, driver = 0, ""
            for y2, x2, t2 in elements:
                if abs(y2 - y) > 10:
                    continue
                if no_x_lo < x2 < no_x_hi and re.match(r"^\d+$", t2):
                    no = int(t2)
                elif drv_x_lo < x2 < drv_x_hi and " " in t2 and t2[0].isupper():
                    driver = t2
            if driver:
                driver = DRIVER_NAME_MAP.get(driver, driver)
                entries.append({"pos": pos, "no": no, "cl": "", "driver": driver, "team": ""})
        return entries

    left  = collect(73, 82, 86, 97, 105, 250)
    right = collect(313, 322, 325, 340, 340, 430)
    return sorted(left + right, key=lambda e: e["pos"])


# ── Classification parser ─────────────────────────────────────────────────────

# TSL PDF column x-boundaries (approximate):
#   POS       x < 30         (position number, or "DNF 116 M", or "15 132 I")
#   NO_CL     30 < x < 75   (car number + class, e.g. "32 M", "88 I")
#   DRIVER    85 < x < 235  (driver "(GBR)" or team name, 2 sub-rows)
#   CAR       235 < x < 340 (car model)
#   LAPS      340 < x < 380 (integer)
#   AVG SPEED x≈477 for races (mph, e.g. "93.67") - NOT captured into any field
#             below; deliberately excluded from the BEST LAP range since its
#             format ("SS.mmm", no colon) is indistinguishable by regex alone
#             from a genuine sub-minute lap time (see BEST LAP note).
#   BEST LAP  495 < x < 545 for races (x≈503-509), m:ss.mmm or bare ss.mmm at
#             sub-minute circuits (Brands Hatch Indy, Knockhill)

def parse_classification(pdf_bytes, label):
    """
    Parse a TSL classification PDF into a list of result dicts.

    TSL PDFs use a fixed multi-column layout. pdfminer extracts each column
    element at its (x, y) coordinate. We identify each result row by its
    position anchor (x < 30), then collect all elements within ±8 y-units.
    """
    elements = _pdf_elements(pdf_bytes)
    if label in NO_POINTS_SESSIONS:
        pts_table = {}
    elif label == "Qualifying Race":
        pts_table = POINTS_QUALIFYING
    else:
        pts_table = POINTS_RACE

    # Find row anchor elements: positioned at x < 30
    #   "1" .. "20"     → numeric finish position
    #   "15 132 I"      → pos + 3-digit car number + class (combined when no space)
    #   "DNF 116 M"     → non-finish with car number and class
    anchors = []  # (y, pos_int, no_int_or_None, cl_or_None, status_or_None)
    for y, x, t in elements:
        if x >= 30:
            continue
        if t.startswith("*") or not t[0].isdigit() and not t.startswith(("DNF", "DQ", "NC", "RET")):
            continue
        # "DNF/DQ/NC/RET NNN C" — non-finish with car+class embedded in one token
        m = re.match(r"^(DNF|DQ|NC|RET)\s+(\d+)\s+([MI])", t)
        if m:
            anchors.append((y, 0, int(m.group(2)), m.group(3), m.group(1)))
            continue
        # Standalone "DNF/DQ/NC/RET" — car+class appear in separate elements on the same row
        if re.match(r"^(DNF|DQ|NC|RET)$", t):
            anchors.append((y, 0, None, None, t))
            continue
        # "PP NNN C" — pos + 3-digit car + class (car number too wide for separate column)
        m = re.match(r"^(\d{1,2})\s+(\d+)\s+([MI])$", t)
        if m:
            anchors.append((y, int(m.group(1)), int(m.group(2)), m.group(3), None))
            continue
        # Just a position number
        if re.match(r"^\d{1,2}$", t):
            anchors.append((y, int(t), None, None, None))

    anchors.sort(key=lambda a: -a[0])  # top-to-bottom (highest y first)

    results = []
    for anchor_y, pos, anchor_no, anchor_cl, anchor_status in anchors:
        y_min = anchor_y - 8
        y_max = anchor_y + 8

        row = [(y, x, t) for y, x, t in elements if y_min <= y <= y_max]

        driver = ""
        team = ""
        car_name = ""
        no = anchor_no or 0
        cl = anchor_cl or ""
        laps = 0
        race_time = ""
        gap = ""
        best_lap = ""
        is_race = label not in NO_POINTS_SESSIONS

        for _, x, t in row:
            if 30 < x < 75 and not no:
                # Car number + class (e.g. "32 M", "88 I")
                m = re.match(r"^(\d+)\s+([MI])", t)
                if m:
                    no = int(m.group(1))
                    cl = m.group(2)
            elif 85 < x < 235:
                if re.search(r"\(\w{3}\)", t):
                    # Driver name "Firstname SURNAME (NAT)"
                    m = re.match(r"^(.*?)\s*\(\w{3}\)", t)
                    if m:
                        driver = m.group(1).strip()
                elif t and not t.startswith("*") and not t.startswith("Car "):
                    if not team:
                        # Strip PIC (position-in-class) number prefix e.g. "1 Team VERTU"
                        team = re.sub(r"^\d+\s+", "", t)
            elif 235 < x < 340:
                car_name = t
            elif 340 < x < 360:
                if re.match(r"^\d+$", t):
                    laps = int(t)
            elif is_race and 360 < x < 400:
                # Race total time column (x≈374): e.g. "26:01.652"
                if re.match(r"^\d+:\d{2}\.\d+$", t):
                    race_time = t
            elif is_race and 400 < x < 440:
                # Gap to leader column (x≈418): e.g. "1.749", "12.034"
                if re.match(r"^\d+\.\d+$", t):
                    gap = t
            elif 495 < x < 545:
                # BEST LAP column (x≈503-509 for races). Lower bound must stay
                # above the AVG SPEED column at x≈477 (mph, e.g. "93.67") -
                # widening this to 470 (2026-05-09, sub-minute-circuit fix)
                # let a non-classified/DNF row's avg-speed figure get
                # mistaken for its best lap whenever that row has no genuine
                # best-lap cell of its own (TSL doesn't compute one for a
                # retirement after only 1-2 laps): classified rows always
                # have both cells, so a permissive lower bound "worked" there
                # only by accident of element order, but a DNF row with
                # nothing at x≈503-509 has just the avg-speed text sitting
                # alone in the wider window (seen 2026-08-24, Donington Park
                # GP round 7 - Rowbottom's Race 3 DNF recorded "83.35", his
                # partial-stint mph, as a "1:23.35" lap and briefly became the
                # circuit's race lap record). Confirmed against real PDFs that
                # this narrower bound still catches genuine sub-minute race
                # laps at Brands Hatch Indy/Knockhill (x≈509 there too,
                # regardless of "M:SS.mmm" vs bare "SS.mmm" format).
                if re.match(r"^(?:\d+:)?\d{2}\.\d+$", t):
                    best_lap = t
            elif not is_race and 380 < x < 470:
                # FP/Qualifying best lap column (x≈411 for FP, x≈468 for qualifying)
                # Sub-minute tracks emit "SS.mmm"; others "M:SS.mmm"
                if re.match(r"^(?:\d+:)?\d{2}\.\d+$", t):
                    best_lap = t

        # Normalise driver name
        driver = DRIVER_NAME_MAP.get(driver, driver)

        pts = pts_table.get(pos, 0) if pos > 0 else 0
        entry = {
            "pos":     pos,
            "no":      no,
            "cl":      cl,
            "driver":  driver,
            "team":    team,
            "car":     car_name,
            "laps":    laps,
            "time":    race_time,
            "gap":     gap,
            "bestLap": best_lap,
            "points":  pts,
        }
        if anchor_status:
            entry["status"] = anchor_status
        results.append(entry)

    # Compute gap to P1 for FP/Qualifying (PDF has no gap column for QUAL; derive from bestLap)
    if label in NO_POINTS_SESSIONS and results:
        p1 = next((r for r in results if r['pos'] == 1 and r.get('bestLap')), None)
        p1_secs = lap_to_secs(p1['bestLap']) if p1 else None
        if p1_secs and p1_secs < float('inf'):
            for r in results:
                if r['pos'] != 1 and r.get('bestLap'):
                    diff = lap_to_secs(r['bestLap']) - p1_secs
                    r['gap'] = f'{diff:.3f}' if diff >= 0 else ''

    return results


# ── Laps led from book PDF ────────────────────────────────────────────────────

BOOK_SESSION_ORDER = ["Qualifying Race", "Race 1", "Race 2", "Race 3"]


def _session_leader_history_label(text, section_start):
    """Which session a "Session Leader History" table belongs to, by finding
    the nearest preceding STATISTICS heading rather than assuming a fixed
    BOOK_SESSION_ORDER position. The book always prints Leader History right
    after that same session's own STATISTICS page - confirmed live across
    both a 4-session year (2026: Qualifying Race + Race 1/2/3) and a
    3-session year with no Qualifying Race at all (2019: Race 1/2/3 only).
    Assuming position `i` in the book always corresponds to
    BOOK_SESSION_ORDER[i] broke the moment a year didn't have every session
    in that fixed list - 2019's 3 real sections (Race 1/2/3) silently became
    (skipped as "Qualifying Race", Race 1, Race 2), losing Race 3's leaders
    entirely and misattributing the other two. Returns None if no STATISTICS
    heading precedes this section at all (year predates that report, or the
    match is spurious)."""
    # Bounded to a window immediately before this section rather than
    # rescanning the whole document from position 0 every time: the book's
    # own page-header text (matched by every heading pattern's leading
    # wildcard) repeats on every page, so an unbounded re-scan from 0 is
    # effectively quadratic over a several-hundred-page book - confirmed
    # live, this made a 10-round, 10-year sweep take 20+ minutes without
    # finishing even the first year. A Statistics heading has always been
    # found within a few thousand characters of its own Leader History
    # table (confirmed live); 15000 is a generous margin, matching the same
    # lookahead window every other book-PDF report parser here already uses.
    window_start = max(0, section_start - 15000)
    window = text[window_start:section_start]
    best_label, best_pos = None, -1
    for label, pattern in STATISTICS_HEADINGS:
        for m in pattern.finditer(window):
            if m.start() > best_pos:
                best_pos, best_label = m.start(), label
    for m in RACE_STATISTICS_RE.finditer(window):
        if m.start() > best_pos:
            # The heading's own captured digit IS the race number (confirmed
            # live: "ROUND 2 - STATISTICS" means Race 2) - read it directly
            # rather than counting how many race headings precede this one,
            # which overcounts the moment STATISTICS spans multiple pages
            # with a repeated running header (confirmed live: this broke
            # Race 2 entirely, double-counting into "Race 3" instead).
            best_pos, best_label = m.start(), f"Race {m.group(1)}"
    return best_label


def parse_laps_led(text):
    """
    Extract drivers who led at least one lap in each Sunday race.
    Returns {label: set_of_driver_names}.

    The book PDF "Session Leader History" table is columnar; pdfminer extracts
    it as: ...NAME\\n\\n<names>\\nFROM LAP\\n\\n...
    Names are the lines between the NAME and FROM LAP column headers.
    """
    sections = list(re.finditer(r"Session Leader History", text))
    result = {}
    for i, m in enumerate(sections):
        label = _session_leader_history_label(text, m.start())
        if not label or label == "Qualifying Race":
            continue
        end = sections[i + 1].start() if i + 1 < len(sections) else m.start() + 3000
        chunk = text[m.start():end]

        # The Session Leader History table has columns: NAME, FROM LAP, LAPS LED,
        # DISTANCE, VEHICLE. pdfminer may emit them in two different orderings
        # depending on the page layout:
        #   Mode A (row-interleaved): NAME\n\n<names>\n\nFROM LAP\n\n...
        #   Mode B (column-grouped):  NAME\n\nFROM LAP\n\n...\n\nVEHICLE\n\n<names>\n\n<numbers>
        # Try Mode A first; if the capture is empty, fall back to Mode B.
        names_block = ""
        name_m = re.search(r"NAME\n\n(.*?)FROM LAP", chunk, re.DOTALL)
        if name_m and name_m.group(1).strip():
            names_block = name_m.group(1)
        else:
            # Mode B: names appear right after VEHICLE header, before the first number block
            veh_m = re.search(r"VEHICLE\n\n(.*?)\n\n\d", chunk, re.DOTALL)
            if veh_m:
                names_block = veh_m.group(1)

        leaders = set()
        for line in names_block.split("\n"):
            name = line.strip()
            if not name or " " not in name:
                continue
            parts = name.split()
            if (len(parts) >= 2
                    and len(parts[0]) >= 2
                    and parts[0][0].isupper()
                    and parts[0][1].islower()
                    and any(p.isupper() and len(p) > 1 for p in parts)):
                name = DRIVER_NAME_MAP.get(name, name)
                leaders.add(name)
        result[label] = leaders
        print(f"    [laps led] {label}: {leaders}")
    return result


# ── Best Speeds from book PDF ─────────────────────────────────────────────────

# Circuits have anywhere from 2 to 5 trap points in practice (confirmed live
# across the 2026 season: Silverstone/Knockhill only wire up Intermediate
# 2+Finish; Snetterton/Croft add Intermediate 1; Oulton Park/Thruxton wire up
# Intermediate 1/2/3+Finish; Donington Park/Donington GP define up to
# Intermediate 4, with only some of them active) - this app surfaces just 3
# of the possible trap points. A venue with real Intermediate 3/4 data still
# has it parsed (to keep the line position correct for whatever trap
# follows) but dropped here, a deliberate scope limit.
_TRAP_SCHEMA_KEYS = {"INTERMEDIATE 1": "intermediate1", "INTERMEDIATE 2": "intermediate2", "FINISH LINE": "finish"}


def _detect_active_traps(header_text):
    """
    Scan the column-header block preceding a Best Speeds table's POS run for
    every "INTERMEDIATE N" / "FINISH LINE" trap label, in the order printed,
    and return only the ones with real recorded data - excluding any marked
    "NO SPEED TRAP INFO" or "NO SPEED TRAP INFORMATION" (both wordings
    confirmed live, varying by venue) between it and the next label. The
    header's own shape varies too (labels can print before, after, or
    interspersed with the POS/NO/NAME/MPH column headers) - never assumed.
    """
    spans = list(re.finditer(r"INTERMEDIATE \d+|FINISH LINE", header_text))
    active = []
    for i, m in enumerate(spans):
        end = spans[i + 1].start() if i + 1 < len(spans) else len(header_text)
        if "NO SPEED TRAP INFO" not in header_text[m.end():end]:
            active.append(m.group(0))
    return active


def _collect_numbers(lines, idx, n):
    """Collect the next n leading/standalone integers as car numbers,
    skipping every other line. TSL lays a trap's N entries out two different
    ways depending on venue (confirmed live): paired "NO NAME" per line (e.g.
    "3 CHILTON"), or every car's number first as N separate lines followed by
    every name as N separate lines - and a wrapped surname's own number can
    print either before or after it (confirmed live, same PDF, both orders).
    Scanning for the leading integer alone and ignoring name text entirely
    handles every one of those variants without caring which is in play -
    the name itself is always re-derived from the session's own results/grid
    via car-number join in _resolve_best_speeds, never read off this page.

    Bounded to 1-3 digits: every real 2026 car number is confirmed <=132,
    and when a block's real entries run out before reaching n (a driver
    retired before this trap - see the duplicate-number check in
    _parse_best_speeds_block), the scan can otherwise run into an unrelated
    page-footer line like "2026 Kwik Fit British Touring Car Championship"
    and misread the year itself as a car number - confirmed live
    (Round 2/Brands Hatch Indy). A 4+ digit match is never a real car
    number, so it's excluded here rather than surfacing as a bogus
    "Car 2026" placeholder downstream."""
    numbers = []
    while len(numbers) < n and idx < len(lines):
        m = re.match(r"^(\d{1,3})(?:\s|$)", lines[idx])
        if m:
            numbers.append(int(m.group(1)))
        idx += 1
    return numbers, idx


def _peek_speed_block_order(lines, idx):
    """A trap's own N-car-numbers/N-MPH-values pair can print in either
    order - confirmed live, both occur within the very same PDF (2022
    Donington: Race 1 prints numbers before MPH, Race 2 prints MPH before
    numbers). Peeking forward for whichever pattern appears first (skipping
    a literal "MPH" header line or anything else non-matching, same as
    _collect_numbers/_collect_mph themselves do) tells the caller which
    collector to run first - the two patterns are mutually exclusive (an
    MPH line always has a decimal point immediately after 1+ digits, a car
    number is 1-3 digits followed by whitespace/end/a name), so there's no
    ambiguity. Returns "mph", "numbers", or None if neither is found (the
    caller then treats this trap as unavailable, same as an empty scan
    already did before this existed)."""
    for i in range(idx, len(lines)):
        if re.match(r"^\d+\.\d+$", lines[i]):
            return "mph"
        if re.match(r"^\d{1,3}(?:\s|$)", lines[i]):
            return "numbers"
    return None


def _collect_mph(lines, idx, n):
    """Collect the next n MPH float lines, skipping everything else -
    including a literal "MPH" header line, which precedes a given trap's
    values on some pages but not others (pdfminer box-ordering quirk,
    confirmed live) and needs no special-casing under a skip-non-matching
    approach."""
    values = []
    while len(values) < n and idx < len(lines):
        if re.match(r"^\d+\.\d+$", lines[idx]):
            values.append(float(lines[idx]))
        idx += 1
    return values, idx


def _collect_lap_time(lines, idx, n):
    """Like _collect_mph, but for lap-time columns (Best Sectors' IDEAL/BEST/
    DIFF), which can exceed 60 seconds - confirmed live in a Race session's
    BEST column ("1:01.112", a driver's slowest-of-the-weekend best lap,
    likely after being held up) - and print as M:SS.mmm rather than SS.mmm
    when they do. A plain _collect_mph skips that line as non-matching,
    silently dropping a real value and shifting every value after it by one
    position. Both formats are accepted and normalised to total seconds."""
    values = []
    while len(values) < n and idx < len(lines):
        if re.match(r"^\d+\.\d+$", lines[idx]):
            values.append(float(lines[idx]))
        else:
            m = re.match(r"^(\d+):(\d+\.\d+)$", lines[idx])
            if m:
                values.append(int(m.group(1)) * 60 + float(m.group(2)))
        idx += 1
    return values, idx


def _parse_best_speeds_block(chunk):
    """
    Parse one session's Best Speeds table from the text immediately following
    its heading. Confirmed live across the full 2026 season: the heading is
    followed by a variable-length, unpredictably-ordered column-header block
    naming each trap point before the actual POS list (1..N) begins - the
    header's shape isn't relied on; the POS run is located by scanning for 5
    consecutive lines "1".."5" instead. After the POS run, one block per
    active trap (see _detect_active_traps), in the order printed: N car
    numbers (see _collect_numbers) then N MPH values (see _collect_mph).
    """
    lines = [l.strip() for l in chunk.split("\n")]
    lines = [l for l in lines if l]  # blank lines are a pdfminer layout artifact

    start = None
    for i in range(len(lines) - 4):
        if all(lines[i + k] == str(k + 1) for k in range(5)):
            start = i
            break
    if start is None:
        return None
    header_text = "\n".join(lines[:start])

    n = 0
    for i in range(start, len(lines)):
        if lines[i] == str(i - start + 1):
            n = i - start + 1
        else:
            break
    if n == 0:
        return None

    active_traps = _detect_active_traps(header_text)
    if not active_traps:
        return None

    idx = start + n  # past the POS run
    result = {"intermediate1": None, "intermediate2": None, "finish": None}
    for label in active_traps:
        order = _peek_speed_block_order(lines, idx)
        if order == "mph":
            mph, idx = _collect_mph(lines, idx, n)
            numbers, idx = _collect_numbers(lines, idx, n)
        else:
            numbers, idx = _collect_numbers(lines, idx, n)
            mph, idx = _collect_mph(lines, idx, n)
        if len(numbers) != n or len(mph) != n:
            return None  # malformed/truncated chunk - caller treats as "not available yet"
        # A driver who retired before reaching a trap simply has no row for
        # it, so a trap's real entry count can be LESS than n (the POS
        # run's own length, i.e. the full classified field) - confirmed
        # live (Round 1/Donington, Race 2: Intermediate 1 only had 19 real
        # entries against n=21). _collect_numbers/_collect_mph don't know
        # that "fewer than n" is possible - they keep scanning forward
        # past the real block, skipping non-matching lines, until they've
        # accumulated n matches regardless of source, silently absorbing
        # the START of the NEXT trap's own numbers into this one's tail
        # (confirmed: the last entries duplicated car numbers already seen
        # earlier in the very same list). A trap's own car numbers can
        # never legitimately repeat (each driver crosses it once) - any
        # duplicate is proof this trap's block ran past its real end, and
        # every trap after it in this chunk is misaligned the same way, so
        # the whole block is treated as unreliable rather than shipping it.
        if len(set(numbers)) != len(numbers):
            return None
        key = _TRAP_SCHEMA_KEYS.get(label)
        if key:
            result[key] = _zip_speed_entries(numbers, mph)

    return result


def _zip_speed_entries(numbers, mph_values):
    # pos is the literal row index as printed by TSL (1..N), not a
    # re-computed dense rank. Ties are not merged in the source table (e.g.
    # pos 1 "52 SHEDDEN 128.9", pos 2 "3 CHILTON 128.9", same MPH).
    return [{"pos": i + 1, "no": no, "mph": mph}
            for i, (no, mph) in enumerate(zip(numbers, mph_values))]


def _merge_best_speeds_blocks(part1, part2):
    """Combine Qualifying Part 1 + Part 2 (the book's own two-group split)
    into one ranked list per trap, re-sorted by MPH descending and
    re-indexed 1..total - the app has a single Qualifying session, not two
    groups."""
    def merge_trap(key):
        combined = sorted((part1.get(key) or []) + (part2.get(key) or []), key=lambda e: -e["mph"])
        return [{**e, "pos": i + 1} for i, e in enumerate(combined)]
    has_int1 = bool(part1.get("intermediate1") and part2.get("intermediate1"))
    return {
        "intermediate1": merge_trap("intermediate1") if has_int1 else None,
        "intermediate2": merge_trap("intermediate2"),
        "finish":        merge_trap("finish"),
    }


def parse_best_speeds(text):
    """
    Extract every session's Best Speeds table from the book PDF's plain text.
    Returns {label: {"intermediate1": [...]|None, "intermediate2": [...], "finish": [...]} | None}
    keyed by the app's 6 session labels (SESSION_SUFFIXES) - Qualifying is
    already merged from the book's own Part 1/Part 2 pages. A label maps to
    None when that session's page isn't in the book yet.
    """
    result = {label: None for label in SESSION_SUFFIXES}
    qual_parts = {}

    for label, pattern in BEST_SPEEDS_HEADINGS:
        m = pattern.search(text)
        if not m:
            continue
        # Wide enough for a 5-trap venue's worth of entries (confirmed live,
        # Donington GP defines Intermediate 1-4 + Finish) without spilling
        # into the next session's own heading.
        block = _parse_best_speeds_block(text[m.end():m.end() + 15000])
        if label == "Qualifying Part 1":
            qual_parts["part1"] = block
        elif label == "Qualifying Part 2":
            qual_parts["part2"] = block
        else:
            result[label] = block

    if qual_parts.get("part1") and qual_parts.get("part2"):
        result["Qualifying"] = _merge_best_speeds_blocks(qual_parts["part1"], qual_parts["part2"])

    for label, m in zip(["Race 1", "Race 2", "Race 3"], RACE_BEST_SPEEDS_RE.finditer(text)):
        result[label] = _parse_best_speeds_block(text[m.end():m.end() + 15000])

    return result


def _parse_weather_line(chunk):
    """"Weather / Track : {condition} / {track}" - confirmed live to print as
    a one-line footer directly beneath every report page for a session (not
    just its own WEATHER CONDITIONS page), so this is found within whichever
    chunk is passed in rather than needing its own heading search."""
    m = re.search(r"Weather\s*/\s*Track\s*:\s*([^/\n]+?)\s*/\s*([^\n]+?)\s*\n", chunk)
    if not m:
        return None
    return {"condition": m.group(1).strip(), "track": m.group(2).strip()}


def parse_weather(text):
    """
    Extract each session's weather/track condition tag. Confirmed live: a
    genuinely wet race is distinguishable from every other dry session at
    the same venue/weekend (Round 9/Silverstone Race 3: "Rain / Wet", every
    other session "Cloudy / Dry" or "Bright / Dry"). Piggybacks on the same
    Best Speeds heading search (BEST_SPEEDS_HEADINGS/RACE_BEST_SPEEDS_RE) -
    no separate heading lookup needed, since the weather line sits within
    that same chunk already. Qualifying's Part 1/Part 2 readings are
    confirmed identical in practice (same session, minutes apart) - Part 1's
    is used, falling back to Part 2's only if Part 1's page isn't found.
    Returns {label: {"condition": str, "track": str} | None}.
    """
    result = {label: None for label in SESSION_SUFFIXES}
    qual_parts = {}

    for label, pattern in BEST_SPEEDS_HEADINGS:
        m = pattern.search(text)
        if not m:
            continue
        weather = _parse_weather_line(text[m.end():m.end() + 15000])
        if label == "Qualifying Part 1":
            qual_parts["part1"] = weather
        elif label == "Qualifying Part 2":
            qual_parts["part2"] = weather
        else:
            result[label] = weather

    result["Qualifying"] = qual_parts.get("part1") or qual_parts.get("part2")

    for label, m in zip(["Race 1", "Race 2", "Race 3"], RACE_BEST_SPEEDS_RE.finditer(text)):
        result[label] = _parse_weather_line(text[m.end():m.end() + 15000])

    return result


def _parse_flag_stats_block(chunk):
    """Flag Statistics: a fixed 4-row table (always exactly Green/Red/Safety
    Car/FCY, confirmed live in that order every time) giving each flag
    type's COUNT for the session. Deliberately scoped to just COUNT - the
    same block's TOTAL LAPS/TOTAL TIME rows are confirmed live to sometimes
    sit much further down the page (a session with extra class-specific
    breakdown content pushes them past a lot of unrelated intervening text),
    while COUNT is confirmed to always immediately follow the fixed
    Green/Red/Safety Car/FCY label run - too fragile a position to rely on
    for the extra fields, whereas COUNT alone already answers the real
    question ("was there a Safety Car, how many periods").
    """
    m = re.search(
        r"Flag Statistics\s*TYPE\s*Green\s*Red\s*Safety Car\s*FCY\s*COUNT\s*"
        r"(\d+)\s*(\d+)\s*(\d+)\s*(\d+)",
        chunk,
    )
    if not m:
        return None
    green, red, safety_car, fcy = (int(x) for x in m.groups())
    return {"green": green, "red": red, "safetyCar": safety_car, "fcy": fcy}


def parse_flag_stats(text):
    """
    Extract each session's flag-type counts (Green/Red/Safety Car/FCY).
    Confirmed live: Round 9's Qualifying Race really did run behind a Safety
    Car (1 period, per its own Flag Statistics block) while every other
    session that weekend shows all-zero incident counts. Piggybacks on the
    same Best Speeds heading search as parse_weather - no separate heading
    lookup needed. Qualifying's Part 1/Part 2 counts are summed (both halves
    of the same session, any incident in either belongs to it).
    Returns {label: {"green", "red", "safetyCar", "fcy"} | None}.
    """
    result = {label: None for label in SESSION_SUFFIXES}
    qual_parts = {}

    for label, pattern in BEST_SPEEDS_HEADINGS:
        m = pattern.search(text)
        if not m:
            continue
        flags = _parse_flag_stats_block(text[m.end():m.end() + 15000])
        if label == "Qualifying Part 1":
            qual_parts["part1"] = flags
        elif label == "Qualifying Part 2":
            qual_parts["part2"] = flags
        else:
            result[label] = flags

    p1, p2 = qual_parts.get("part1"), qual_parts.get("part2")
    if p1 and p2:
        result["Qualifying"] = {k: p1[k] + p2[k] for k in p1}
    else:
        result["Qualifying"] = p1 or p2

    for label, m in zip(["Race 1", "Race 2", "Race 3"], RACE_BEST_SPEEDS_RE.finditer(text)):
        result[label] = _parse_flag_stats_block(text[m.end():m.end() + 15000])

    return result


def _parse_best_sectors_block(chunk, is_race):
    """
    Perfect Lap (theoretical best lap): each driver's IDEAL lap (sum of their
    own best individual sectors) vs their actual BEST lap and the DIFF - a
    classic "what they left on the table" broadcast stat. Confirmed live,
    this shares its page with a Sector 1/2/3 leaderboard this app doesn't
    surface (out of scope - too dense for mobile, and would need real
    per-lap row reconstruction, unlike this fixed-length comparison table).

    Confirmed live (by dumping raw chunk lines, not guessed) that the page's
    own "PERFECT LAP" column label sits in the header block, before EVEN the
    first of the page's two POS (1..N) runs (the header lists every column
    across the whole page up front) - so it can't be used to anchor past the
    Sector 1/2/3 leaderboard, which genuinely comes FIRST on this page, with
    this Perfect Lap table's own POS run second. A third run found beyond
    that belongs to the next report's page (Best Speeds, or for races, a
    further "TOP 5 SPEEDS" report) having bled into this chunk, and is
    ignored by only ever taking the second run found.

    Body shape after that second POS run: N car numbers, then N surname
    lines (both skippable via the same "scan for the right token type"
    approach - _collect_numbers only matches leading integers, _collect_mph
    only matches floats, so interleaved text is naturally skipped without
    being told to). Confirmed live, non-race sessions then carry ONE extra
    float before the real per-driver IDEAL column starts: it equals the
    SESSION's own theoretical perfect lap (fastest S1 + fastest S2 + fastest
    S3, from three different drivers, not any one driver's own row) that TSL
    prints once as a summary before the per-driver breakdown. Race sessions
    (confirmed live, all three) never carry this extra value - the real
    IDEAL block starts immediately. Skipping it unconditionally cascaded a
    real driver's own ideal value out of the results for races (the first
    "real" IDEAL got discarded as if it were the summary value), so is_race
    controls whether that skip happens. After the IDEAL column (present or
    not): N IDEAL values, N BEST values, N DIFF values, in that fixed order
    - same "scan for the next N floats, skip everything else" approach as
    _collect_mph, reused directly since the field boundaries are the same
    shape (a run of decimal numbers with nothing else interleaved).
    """
    lines = [l.strip() for l in chunk.split("\n")]
    lines = [l for l in lines if l]

    pos_runs = []
    i = 0
    while i < len(lines) - 4 and len(pos_runs) < 2:
        if all(lines[i + k] == str(k + 1) for k in range(5)):
            n = 0
            for j in range(i, len(lines)):
                if lines[j] == str(j - i + 1):
                    n = j - i + 1
                else:
                    break
            pos_runs.append((i, n))
            i += n
        else:
            i += 1
    if len(pos_runs) < 2:
        return None
    start, n = pos_runs[1]

    pos = start + n
    numbers, pos = _collect_numbers(lines, pos, n)
    if not is_race:
        _, pos = _collect_lap_time(lines, pos, 1)  # discard the session's theoretical perfect-lap summary value
    ideal, pos = _collect_lap_time(lines, pos, n)
    best, pos = _collect_lap_time(lines, pos, n)
    diff, pos = _collect_lap_time(lines, pos, n)
    if len(numbers) != n or len(ideal) != n or len(best) != n or len(diff) != n:
        return None  # malformed/truncated chunk - caller treats as "not available yet"

    # DIFF is defined as BEST - IDEAL, a hard invariant true for every
    # confirmed-good row across a full season of live data. Confirmed live,
    # exactly one row per race session (always position 0, a different car
    # each time - car 66/116/80 across Round 9's three races) fails this by
    # a huge margin (a "diff" over 60 seconds, which is physically
    # impossible for a real lap - it would mean the driver's actual lap
    # took nearly double their own theoretical best), while every other row
    # in the same table matches to the rounding digit. Root cause not fully
    # isolated - dropping just the failing row keeps the rest of a
    # genuinely good table rather than discarding it over one bad entry.
    return [
        {"no": no, "ideal": i, "best": b, "diff": d}
        for no, i, b, d in zip(numbers, ideal, best, diff)
        if abs(d - (b - i)) <= 0.5
    ]


def _merge_best_sectors_blocks(part1, part2):
    """Qualifying's Part 1/Part 2 driver pools never overlap (two disjoint
    qualifying groups, confirmed live) - simple concatenation, re-sorted by
    IDEAL ascending (fastest theoretical lap first) to give the merged list
    a consistent, meaningful order."""
    combined = (part1 or []) + (part2 or [])
    return sorted(combined, key=lambda e: e["ideal"])


def parse_best_sectors(text):
    """
    Extract every session's Perfect Lap (theoretical best lap) table.
    Returns {label: [{"no", "ideal", "best", "diff"}] | None}.
    """
    result = {label: None for label in SESSION_SUFFIXES}
    qual_parts = {}

    for label, pattern in BEST_SECTORS_HEADINGS:
        m = pattern.search(text)
        if not m:
            continue
        block = _parse_best_sectors_block(text[m.end():m.end() + 15000], is_race=False)
        if label == "Qualifying Part 1":
            qual_parts["part1"] = block
        elif label == "Qualifying Part 2":
            qual_parts["part2"] = block
        else:
            result[label] = block

    if qual_parts.get("part1") or qual_parts.get("part2"):
        result["Qualifying"] = _merge_best_sectors_blocks(qual_parts.get("part1"), qual_parts.get("part2"))

    for label, m in zip(["Race 1", "Race 2", "Race 3"], RACE_BEST_SECTORS_RE.finditer(text)):
        result[label] = _parse_best_sectors_block(text[m.end():m.end() + 15000], is_race=True)

    return result


def _resolve_best_sectors(entries, number_map):
    """Same car-number join as _resolve_best_speeds - the page's own driver
    identification is never used, only the car number."""
    if not entries:
        return None
    out = []
    for e in entries:
        driver, team = number_map.get(e["no"], ("", ""))
        if not driver:
            driver = f"Car {e['no']}"
            print(f"    [best sectors] car {e['no']} not in session results/grid - using placeholder name")
        out.append({"no": e["no"], "driver": driver, "team": team, "ideal": e["ideal"], "best": e["best"], "diff": e["diff"]})
    return out


# ── Lap Chart from book PDF ───────────────────────────────────────────────────

# Confirmed live: only Race 1/2/3 ever print a Lap Chart page - Free
# Practice/Qualifying/Qualifying Race are about one flying lap each, not a
# race-long running order, so _session_heading_patterns' FP/Qualifying Part
# 1/2/Qualifying Race headings never match "LAP CHART" at all.
RACE_LAP_CHART_RE = _race_heading_pattern("LAP CHART")

_LAP_HEADER_RE = re.compile(r"^LAP\s+(\d+)$", re.IGNORECASE)
_LAP_TIMESTAMP_RE = re.compile(r"^@\s*([\d:.]+)$")
_LAPPED_RE = re.compile(r"^(\d+)\s+Laps?$", re.IGNORECASE)
_INT_LINE_RE = re.compile(r"^\d{1,3}$")
_LAP_CHART_VALUE_RE = re.compile(r"^\d{1,3}$|^\d+\.\d+$|^\d+:\d+\.\d+$|^\d+\s+Laps?$", re.IGNORECASE)


def _split_merged_lap_chart_line(line):
    """pdfminer can merge two adjacent values onto a single output line
    with no line break between them - confirmed live, pre-2013 books only
    (e.g. 2009: "12.667  1:01.346", a gap and the following car's own lap
    time, two spaces apart). Splits back into two lines whenever a line is
    exactly two whitespace-separated halves and each one, independently,
    already matches a real NO/BEHIND/LAP TIME column value shape - never
    splits on a single space (that's legitimate within one value, e.g.
    "2 Laps") or a line that doesn't cleanly resolve to two real values."""
    parts = line.split()
    if len(parts) == 2 and _LAP_CHART_VALUE_RE.match(parts[0]) and _LAP_CHART_VALUE_RE.match(parts[1]):
        return parts
    # A three-way merge confirmed live (pre-2013 books, around a pit visit):
    # a value, the trailing "P" pit marker, and the next block's own
    # leading car number, all glued onto one line (e.g. "1:06.511 P 6").
    if (len(parts) == 3 and parts[1].upper() == "P"
            and _LAP_CHART_VALUE_RE.match(parts[0]) and _LAP_CHART_VALUE_RE.match(parts[2])):
        return parts
    return [line]


def _skip_to_next_int_line(lines, idx):
    while idx < len(lines) and not _INT_LINE_RE.match(lines[idx]):
        idx += 1
    return idx


def _collect_consecutive_ints(lines, idx):
    """Collect every immediately-consecutive 1-3 digit integer line (a lap-
    block's own NO column never has anything interspersed within it - only
    the labels/headers *before* it do), stopping at the first line that
    isn't one. Unlike _collect_numbers (which keeps scanning past noise
    toward a pre-known target count), there IS no pre-known count here -
    this IS how a block's own car count is discovered - so stopping at the
    first non-match is the only way to find the real boundary rather than
    guessing how far to scan."""
    numbers = []
    while idx < len(lines) and _INT_LINE_RE.match(lines[idx]):
        numbers.append(int(lines[idx]))
        idx += 1
    return numbers, idx


def _collect_lap_chart_gaps(lines, idx, n):
    """Collect a lap-block's n BEHIND-column entries (the leader's own
    blank entry is never included - n is always one less than that block's
    car count). Each entry is a gap-to-car-ahead float, a lapped car's
    "N Lap(s)" marker (confirmed live, replaces the gap entirely - never
    both), or - confirmed live, a gap can exceed 60 seconds without the car
    yet being marked a full lap down - "M:SS.mmm" (same format
    _collect_lap_time already handles for the LAP TIME column; omitting it
    here silently truncated the gap collection one entry short, which then
    broke this block's own n-check and silently discarded every remaining
    lap on the page). Stops at the first non-matching line rather than
    skipping past it (same rationale as _collect_consecutive_ints): a
    short/malformed block must come back short, not silently swallow the
    next block's own car numbers or a page-footer float (e.g. "2.4873"
    from the track-length line) looking for n entries that aren't really
    there."""
    values = []
    while len(values) < n and idx < len(lines):
        line = lines[idx]
        m = _LAPPED_RE.match(line)
        if m:
            values.append(("lapped", int(m.group(1))))
        elif re.match(r"^\d+\.\d+$", line):
            values.append(float(line))
        else:
            m2 = re.match(r"^(\d+):(\d+\.\d+)$", line)
            if m2:
                values.append(int(m2.group(1)) * 60 + float(m2.group(2)))
            else:
                break
        idx += 1
    return values, idx


def _parse_lap_chart_page(page_text):
    """
    Parse every lap-block on a single book-PDF page of a Lap Chart report.
    Confirmed live: TSL prints up to 5 laps side by side per page (fewer on
    a race's last page), each headed "LAP N" (case varies by era - "Lap N"
    pre-2013, "LAP N" 2013 on, confirmed live) optionally followed by
    "@ HH:MM:SS.mmm" - a per-lap timestamp wasn't always printed (confirmed
    live: entirely absent 2004-2014, present every year sampled from 2015
    on) - pdfminer groups a page's own lap header (+ timestamp, where
    present) pairs together first, in order, ahead of the page's "NO BEHIND
    LAP TIME"-family column labels (repeated once per block, wording and
    line-grouping both vary by era but neither is read - see
    _skip_to_next_int_line) and the block data itself. Each block is then,
    in the same column-grouped shape _parse_best_speeds_block already
    handles for Best Speeds' trap columns (just 3 columns instead of 2,
    repeated per lap instead of per trap): N car numbers (NO, the running
    position order - index 0 is the race leader), N-1 gap values (BEHIND),
    then N lap times (LAP TIME).

    A literal "P" token can also print immediately after a block's own lap
    times, flagging a pit visit that lap - confirmed live, it trails the
    whole block rather than sitting inline with the pitted car's own row,
    so which row it belongs to isn't reliably recoverable from text order
    alone. It's consumed (so it doesn't get misread as the next block's
    leading car number) and otherwise discarded rather than guessed at.

    Returns a list of {"lap": int, "timeOfDay": str, "order": [{"no",
    "gapSeconds", "lapsDown", "lapTimeSeconds"}]} dicts, one per lap-block
    found on this page (empty if this page has none).
    """
    lines = []
    for raw in page_text.split("\n"):
        stripped = raw.strip()
        if stripped:
            lines.extend(_split_merged_lap_chart_line(stripped))

    headers = []
    idx = 0
    while idx < len(lines):
        m_lap = _LAP_HEADER_RE.match(lines[idx])
        if not m_lap:
            break
        lap_no = int(m_lap.group(1))
        timestamp = None
        if idx + 1 < len(lines):
            m_ts = _LAP_TIMESTAMP_RE.match(lines[idx + 1])
            if m_ts:
                timestamp = m_ts.group(1)
                idx += 1  # also consume the timestamp line
        headers.append((lap_no, timestamp))
        idx += 1
    if not headers:
        return []

    blocks = []
    for lap_no, timestamp in headers:
        idx = _skip_to_next_int_line(lines, idx)
        numbers, idx = _collect_consecutive_ints(lines, idx)
        if not numbers:
            break  # malformed/truncated page - stop rather than misparse
        n = len(numbers)
        gaps, idx = _collect_lap_chart_gaps(lines, idx, n - 1)
        times, idx = _collect_lap_time(lines, idx, n)
        if len(gaps) != n - 1 or len(times) != n:
            break

        order = [{"no": numbers[0], "gapSeconds": None, "lapsDown": None, "lapTimeSeconds": times[0]}]
        for no, gap, time in zip(numbers[1:], gaps, times[1:]):
            if isinstance(gap, tuple):
                order.append({"no": no, "gapSeconds": None, "lapsDown": gap[1], "lapTimeSeconds": time})
            else:
                order.append({"no": no, "gapSeconds": gap, "lapsDown": None, "lapTimeSeconds": time})
        blocks.append({"lap": lap_no, "timeOfDay": timestamp, "order": order})

        if idx < len(lines) and lines[idx] == "P":
            idx += 1
    return blocks


def parse_lap_chart(text):
    """
    Extract each race's full Lap Chart (running order, gap-to-car-ahead and
    lap time for every lap) from the book PDF's plain text. Returns
    {label: [...]} for Race 1/2/3 only.

    Unlike every other book-PDF report parsed here, a single race's own Lap
    Chart spans MULTIPLE physical pages (confirmed live: up to 5 laps per
    page) rather than one - so pages are grouped by race first, then each
    page's own lap-blocks are parsed and concatenated in page order.
    Grouping uses the heading's own "ROUND N" digit (shared with Best
    Speeds/Best Sectors/Statistics/Grid/Classification's headings, via
    RACE_LAP_CHART_RE), by first-seen order rather than by its literal
    value - confirmed live, 2026 Donington GP prints "ROUND 19/20/21" for
    its own Race 1/2/3, not "ROUND 1/2/3": the digit is this book's own
    internal session counter, never the literal race number, same as every
    other report's RACE_*_RE already assumes implicitly by zip-ordering
    finditer() matches rather than reading the digit's value.
    """
    race_pages = {}
    for page in text.split("\x0c"):
        m = RACE_LAP_CHART_RE.search(page)
        if m:
            race_pages.setdefault(m.group(1), []).append(page[m.end():])

    result = {}
    for label, pages in zip(["Race 1", "Race 2", "Race 3"], race_pages.values()):
        laps = []
        for page in pages:
            laps.extend(_parse_lap_chart_page(page))
        if laps:
            result[label] = laps
    return result


def _resolve_lap_chart(laps, number_map):
    """Same car-number join as _resolve_best_speeds/_resolve_best_sectors -
    the page's own driver identification is never used, only the car
    number. A missing car is warned about once per car, not once per lap
    (a race-long Lap Chart repeats every car on every lap, so the naive
    per-row warning used elsewhere would print dozens of times for one
    genuinely-missing car)."""
    warned = set()
    out = []
    for entry in laps:
        order = []
        for row in entry["order"]:
            driver, team = number_map.get(row["no"], ("", ""))
            if not driver:
                driver = f"Car {row['no']}"
                if row["no"] not in warned:
                    warned.add(row["no"])
                    print(f"    [lap chart] car {row['no']} not in session results/grid - using placeholder name")
            order.append({**row, "driver": driver, "team": team})
        out.append({**entry, "order": order})
    return out


def _number_driver_map(race):
    """car number -> (driver, team) from this session's own parsed results
    (falls back to grid, for a session with a grid but no results yet)."""
    m = {}
    for r in race.get("results") or []:
        if r.get("no"):
            m[r["no"]] = (r.get("driver", ""), r.get("team", ""))
    if not m:
        for g in race.get("grid") or []:
            if g.get("no"):
                m[g["no"]] = (g.get("driver", ""), g.get("team", ""))
    return m


def _resolve_best_speeds(block, number_map):
    """Joins each Best Speeds entry's car number to the canonical
    "Firstname SURNAME" driver string + team already resolved by
    parse_classification()/parse_grid() for this same session - the parser
    never reads a driver name off the Best Speeds page itself (see
    _collect_numbers), only the car number, so this join is the only place
    a name is attached at all."""
    if not block:
        return None
    def resolve(entries):
        if entries is None:
            return None
        out = []
        for e in entries:
            driver, team = number_map.get(e["no"], ("", ""))
            if not driver:
                driver = f"Car {e['no']}"  # unresolved car number - a session/grid data gap, not expected in practice
                print(f"    [best speeds] car {e['no']} not in session results/grid - using placeholder name")
            out.append({"pos": e["pos"], "no": e["no"], "driver": driver, "team": team, "mph": e["mph"]})
        return out
    return {
        "intermediate1": resolve(block.get("intermediate1")),
        "intermediate2": resolve(block.get("intermediate2")),
        "finish":        resolve(block.get("finish")),
    }


# ── Round scraper ─────────────────────────────────────────────────────────────

def scrape_round(info, session_filter=None):
    tsl = info["tsl"]
    print(f"\nRound {info['round']}: {info['venue']}  (TSL {tsl})")

    # Download and parse each session PDF (+ grid PDF where available)
    races = []
    any_results = False
    for label, suffix in SESSION_SUFFIXES.items():
        if session_filter is not None and label not in session_filter:
            races.append({"label": label, "results": [], "grid": []})
            continue
        url = TSL_BASE.format(year=YEAR, tsl=tsl, suffix=f"{suffix}trg")
        print(f"  {label} → {url}")
        data = fetch_pdf(url)
        results = []
        if not data:
            print(f"    not available yet")
        else:
            results = parse_classification(data, label)
            print(f"    parsed {len(results)} entries")
            if results:
                any_results = True

        grid = []
        grid_suffix = GRID_SUFFIXES.get(label)
        if grid_suffix:
            grid_url = TSL_BASE.format(year=YEAR, tsl=tsl, suffix=f"{grid_suffix}trg")
            print(f"  {label} grid → {grid_url}")
            grid_data = fetch_pdf(grid_url)
            if grid_data:
                grid = parse_grid(grid_data)
                print(f"    grid: {len(grid)} entries")
            else:
                print(f"    grid not available yet")

        races.append({"label": label, "results": results, "grid": grid})

    if not any_results:
        print(f"  No results available yet — skipping")
        return None

    # Download book PDF for laps led + best speeds
    book_url = TSL_BASE.format(year=YEAR, tsl=tsl, suffix="trg")
    print(f"  [book] → {book_url}")
    book_data = fetch_pdf(book_url)
    book_text = _pdf_text(book_data) if book_data else ""
    laps_led = parse_laps_led(book_text) if book_data else {}

    best_speeds_raw = parse_best_speeds(book_text) if book_data else {}
    for race in races:
        raw = best_speeds_raw.get(race["label"])
        if raw:
            race["bestSpeeds"] = _resolve_best_speeds(raw, _number_driver_map(race))
            print(f"    [best speeds] {race['label']}: parsed")

    weather_raw = parse_weather(book_text) if book_data else {}
    for race in races:
        weather = weather_raw.get(race["label"])
        if weather:
            race["weather"] = weather
            print(f"    [weather] {race['label']}: {weather['condition']} / {weather['track']}")

    flag_stats_raw = parse_flag_stats(book_text) if book_data else {}
    for race in races:
        flags = flag_stats_raw.get(race["label"])
        if flags:
            race["flagStats"] = flags
            print(f"    [flag stats] {race['label']}: parsed")

    best_sectors_raw = parse_best_sectors(book_text) if book_data else {}
    for race in races:
        raw = best_sectors_raw.get(race["label"])
        if raw:
            race["bestSectors"] = _resolve_best_sectors(raw, _number_driver_map(race))
            print(f"    [best sectors] {race['label']}: parsed")

    lap_chart_raw = parse_lap_chart(book_text) if book_data else {}
    for race in races:
        raw = lap_chart_raw.get(race["label"])
        if raw:
            race["lapChart"] = _resolve_lap_chart(raw, _number_driver_map(race))
            print(f"    [lap chart] {race['label']}: parsed {len(raw)} laps")

    # Tag pole (P1 in Qualifying only)
    qual = next((r for r in races if r["label"] == "Qualifying"), None)
    if qual and qual["results"]:
        p1 = next((r for r in qual["results"] if r["pos"] == 1), None)
        if p1:
            p1["pole"] = True

    # Carry pole flag to the same driver's Race 1 result (they started from pole)
    r1 = next((r for r in races if r["label"] == "Race 1"), None)
    if qual and qual["results"] and r1 and r1["results"]:
        pole_driver = next((r["driver"] for r in qual["results"] if r.get("pole")), None)
        if pole_driver:
            for r in r1["results"]:
                if r["driver"] == pole_driver:
                    r["pole"] = True
                    break

    # Tag fastestLap on the driver with the quickest lap in each points race
    for race in races:
        if race["label"] in NO_POINTS_SESSIONS:
            continue
        fl_driver = fastest_lap_driver(race["results"])
        if fl_driver:
            for r in race["results"]:
                if r["driver"] == fl_driver:
                    r["fastestLap"] = True

    # Tag leadLap on results
    for race in races:
        leaders = laps_led.get(race["label"], set())
        if leaders:
            for r in race["results"]:
                r["leadLap"] = r["driver"] in leaders

    # Reg 1.6.2.a: LL bonus goes to drivers "classified as the Race leader".
    # A DQ'd driver is not classified, so strip both bonus flags from DQ entries.
    for race in races:
        for r in race["results"]:
            if r.get("status") == "DQ":
                r["leadLap"] = False
                r["fastestLap"] = False

    # Bake FL and leadLap bonuses into points so the JSON reflects the
    # championship PDF totals directly. QR has no bonus flags (stripped above).
    for race in races:
        if race["label"] in NO_POINTS_SESSIONS:
            continue
        is_qr = race["label"] == "Qualifying Race"
        for r in race["results"]:
            if not is_qr:
                if r.get("fastestLap") and r.get("laps", 0) > 0:
                    r["points"] += 1
                if r.get("leadLap") and r.get("laps", 0) > 0:
                    r["points"] += 1

    return {
        "round": info["round"],
        "venue": info["venue"],
        "date":  info["date"],
        "races": races,
    }


# ── Standings computation ─────────────────────────────────────────────────────

def lap_to_secs(t):
    """Parse "M:SS.mmm" or bare "SS.mmm" to seconds, tolerating a trailing
    unit suffix (e.g. "50.876s" from older manually-seeded calendar.json
    records) rather than failing to parse the whole string. Returns inf
    on genuinely invalid input (e.g. "DNS")."""
    try:
        t = t.strip()
        m = re.match(r"^(\d+):(\d+(?:\.\d+)?)", t)
        if m:
            return int(m.group(1)) * 60 + float(m.group(2))
        m = re.match(r"^(\d+(?:\.\d+)?)", t)
        if m:
            return float(m.group(1))
        return float("inf")
    except Exception:
        return float("inf")


def fastest_lap_driver(results):
    finishers = [r for r in results if r.get("pos", 0) > 0 and r.get("bestLap")]
    if not finishers:
        return None
    return min(finishers, key=lambda r: lap_to_secs(r["bestLap"]))["driver"]


# ── Championship PDF parser ───────────────────────────────────────────────────

# Section header substrings → output key.
# "BTCC Independents Teams" must precede "BTCC Teams" to avoid substring collision.
_CHAMP_SECTIONS = [
    ("BTCC Drivers Championship",                "standings"),
    ("BTCC Manufacturers/Constructors",           "manufacturers"),
    ("BTCC Independents Teams Championship",      "independentsTeams"),
    ("BTCC Teams Championship",                   "teams"),
    ("Independents Trophy",                       "independents"),
    ("Jack Sears Trophy",                         "jst"),
]
_DRIVER_SECTIONS = {"standings", "independents", "jst"}


def _group_by_y(elems, tolerance=4):
    """Group (y, x, text) tuples into row buckets by y proximity."""
    groups = {}
    for y, x, t in elems:
        matched = None
        for gy in groups:
            if abs(gy - y) <= tolerance:
                matched = gy
                break
        if matched is None:
            matched = y
            groups[matched] = []
        groups[matched].append((y, x, t))
    return groups


def _find_text(row_elems, x_min, x_max, pattern=None):
    """First text in x range matching pattern (any text if pattern is None)."""
    for _, x, t in sorted(row_elems, key=lambda e: e[1]):
        if x_min <= x <= x_max:
            if pattern is None or re.match(pattern, t):
                return t
    return None


def _to_int(s):
    try:
        return int(str(s).strip())
    except (TypeError, ValueError):
        return 0


def _split_car_driver(row_elems, x_lo, x_hi):
    """Extract (car, driver) from every text element between the Pos and Nat
    columns, rather than trusting separate x_car/x_drv sub-boundaries.

    The No./Driver header is sometimes rendered by pdfminer as one merged
    text line ("No. Driver") instead of two - seen 2026-08-22, Donington Park
    GP round 7's ptstrg PDF. When that happens _detect_col_positions can't
    find either column, x_car/x_drv fall back to a too-narrow hardcoded
    offset, and the old per-boundary lookup either missed the car number
    entirely or - worse - matched it as the driver name (it's the first text
    in x-order), silently turning every row below the leader into a bare car
    number with no name. Splitting on content instead of on a boundary that
    may not exist sidesteps the problem: a leading standalone number is the
    car, a leading "<number> <name>" is pdfminer's own merge of the two
    (seen on exactly the row this bug corrupted differently), and anything
    else just isn't preceded by a number at all.
    """
    parts = sorted(((x, t) for _, x, t in row_elems if x_lo <= x < x_hi), key=lambda p: p[0])
    if not parts:
        return "", ""
    first = parts[0][1]
    rest = " ".join(t for _, t in parts[1:]).strip()
    m = re.match(r"^(\d+)\s+(.+)$", first)
    if m:
        driver = (m.group(2) + " " + rest).strip() if rest else m.group(2).strip()
        return m.group(1), driver
    if re.match(r"^\d+$", first):
        return first, rest
    return "", (first + " " + rest).strip() if rest else first


def _detect_col_positions(elems, col_names):
    """Scan section elements top-to-bottom for column header text.
    col_names is a set of strings; text is normalised by stripping trailing punctuation.
    Returns {name: x} for the first (highest-y) occurrence of each name."""
    found = {}
    for y, x, t in sorted(elems, key=lambda e: -e[0]):
        clean = t.strip().rstrip(".")
        if clean in col_names and clean not in found:
            found[clean] = x
        if len(found) == len(col_names):
            break
    return found


def _parse_ptstrg_per_race(section_elems, num_rounds):
    """
    Extract per-race points from the drivers championship section.
    Derives QR column positions and session offsets dynamically from QR/Rnd
    header elements — no hardcoded x-coordinates.
    Returns (per_race, scored_sessions) where:
      per_race        = {driver: {(round, label): points}}
      scored_sessions = set of (round, label) pairs where at least one driver scored
    """
    # ── Derive per-round column geometry from QR/Rnd header elements ──────────
    qr_xs  = sorted(set(x for y, x, t in section_elems if t.strip() == "QR"))
    rnd_xs = sorted(set(x for y, x, t in section_elems if t.strip() == "Rnd"))

    if not qr_xs:
        return {}, set()

    base_x = qr_xs[0]
    rnd_w  = ((qr_xs[-1] - qr_xs[0]) / (len(qr_xs) - 1)) if len(qr_xs) > 1 else 55.0
    col_tol = max(6.0, rnd_w / 8.0)

    # Rnd elements that belong to round 1's window (between QR[0]-rnd_w and QR[1])
    hi_bound = qr_xs[1] if len(qr_xs) > 1 else base_x + rnd_w
    r1_rnds  = sorted(x for x in rnd_xs if base_x - rnd_w < x < hi_bound and abs(x - base_x) > 1)

    offsets = {"Qualifying Race": 0.0}
    before  = sorted(x for x in r1_rnds if x < base_x)  # new format: R1/R2/R3 precede QR
    after   = sorted(x for x in r1_rnds if x > base_x)  # old format: R1/R2/R3 follow QR
    race_labels = ["Race 1", "Race 2", "Race 3"]
    for i, rx in enumerate((before or after)[:3]):
        offsets[race_labels[i]] = rx - base_x

    # ── Derive driver-row detection bounds from column headers ────────────────
    DRIVER_COLS = {"Pos", "No", "Driver", "Nat", "Cl", "Total", "Wins", "2nds", "3rds"}
    cols    = _detect_col_positions(section_elems, DRIVER_COLS)
    x_pos   = cols.get("Pos",    base_x - 300)
    x_car   = cols.get("No",     x_pos  +  15)
    x_drv   = cols.get("Driver", x_car  +  20)
    x_nat   = cols.get("Nat",    x_drv  +  80)
    T = col_tol

    per_race       = {}
    scored_sessions = set()
    labels          = list(offsets.keys())

    for _y, row_elems in sorted(_group_by_y(section_elems).items(), reverse=True):
        if not _find_text(row_elems, x_pos - 2, x_pos + T, r"^\d+$"):
            continue  # not a driver row

        _car, driver = _split_car_driver(row_elems, x_pos + T, x_nat - 5)
        if not driver:
            continue
        driver = DRIVER_NAME_MAP.get(driver, driver)

        driver_pts = {}
        for rnd in range(1, num_rounds + 1):
            for label in labels:
                cx  = base_x + (rnd - 1) * rnd_w + offsets.get(label, 0.0)
                val = _find_text(row_elems, cx - col_tol, cx + col_tol * 2, r"^\d+$")
                pts = int(val) if val else 0
                driver_pts[(rnd, label)] = pts
                if pts > 0:
                    scored_sessions.add((rnd, label))
        per_race[driver] = driver_pts

    return per_race, scored_sessions


def _parse_driver_rows(elems):
    """Parse a driver-type championship section. Column positions are read
    from the section's own header text so any PDF scale is handled automatically."""
    DRIVER_COLS = {"Pos", "No", "Driver", "Nat", "Cl", "Total", "Wins", "2nds", "3rds"}
    cols = _detect_col_positions(elems, DRIVER_COLS)

    if "Pos" in cols and "Total" in cols:
        x_pos   = cols["Pos"]
        x_car   = cols.get("No",     x_pos  + 15)
        x_drv   = cols.get("Driver", x_car  + 20)
        x_nat   = cols.get("Nat",    x_drv  + 80)
        x_cls   = cols.get("Cl",     x_nat  + 15)
        x_total = cols["Total"]
        x_wins  = cols.get("Wins",   x_total + 60)
        x_snds  = cols.get("2nds",   x_wins  + 35)
        x_thrds = cols.get("3rds",   x_snds  + 35)
        T = 14
    else:
        # Absolute fallback: old large-format bounds
        x_pos, x_car, x_drv     = 43,  70,  100
        x_nat, x_cls, x_total   = 260, 315, 357
        x_wins, x_snds, x_thrds = 510, 555, 600
        T = 20

    entries = []
    for _y, row_elems in sorted(_group_by_y(elems).items(), reverse=True):
        pos_text = _find_text(row_elems, x_pos - 2, x_pos + T, r"^\d+$")
        if not pos_text:
            continue
        pos = int(pos_text)

        car, driver = _split_car_driver(row_elems, x_pos + T, x_nat - 5)

        driver = DRIVER_NAME_MAP.get(driver, driver)
        nat   = _find_text(row_elems, x_nat  - 5,  x_nat  + 25, r"^[A-Z]{3}$") or ""
        cls   = _find_text(row_elems, x_cls  - 5,  x_cls  + 12, r"^[MI]$")      or ""
        total = _to_int(_find_text(row_elems, x_total - T, x_total + T * 2, r"^\d+$"))
        wins  = _to_int(_find_text(row_elems, x_wins  - T, x_wins  + T,     r"^\d+$"))
        snds  = _to_int(_find_text(row_elems, x_snds  - T, x_snds  + T,     r"^\d+$"))
        thrds = _to_int(_find_text(row_elems, x_thrds - T, x_thrds + T,     r"^\d+$"))

        if driver:
            entries.append({
                "pos": pos, "car": car, "driver": driver,
                "nat": nat, "class": cls, "points": total,
                "wins": wins, "seconds": snds, "thirds": thrds,
                "team": "",  # backfilled from race results
            })
    return entries


# Some teams' TSL championship PDFs keep printing a renamed team's old name
# for its real season total while a *separate* row for the new name shows up
# alongside it with 0 points - not a parsing bug, this is what the source PDF
# itself contains while officials transition a mid-season name change (seen
# 2026-08-22, Donington Park GP round 7: "Cataclean Plato Racing" pos 4/282pts
# and "CPRL" pos 10/0pts both present in the same table). This dict originally
# aliased "Cataclean Plato Racing" -> "CPRL" so the app showed one continuous
# row - reversed 2026-08-28 by explicit request: btcc.net's own site and the
# TSL PDF still show this exact same split weeks later (282/pos 6 + 71/pos 10
# as of that date, confirmed live), so it was never a transient rename-week
# artifact to normalize away - the app now deliberately mirrors the official
# split instead. See __tests__/data/liveDataConsistency.test.js's
# TEAM_NAMES_WITH_NO_CURRENT_DRIVER for the corresponding app-side allowance.
# Left in place (empty, not deleted) since the underlying merge mechanism
# below still legitimately handles a genuinely transient duplicate - the same
# name appearing twice in one table from a scrape glitch, as opposed to a
# permanent split like this one - should that happen for some other team.
TEAM_NAME_ALIASES = {}


def _normalize_team_entries(entries):
    """Canonicalize aliased team names and merge any resulting duplicate rows
    (summing points), then re-rank so pos stays a contiguous, points-descending
    sequence. A no-op for any name not in TEAM_NAME_ALIASES."""
    totals = {}
    for e in entries:
        name = TEAM_NAME_ALIASES.get(e["team"], e["team"])
        totals[name] = totals.get(name, 0) + e["points"]
    ranked = sorted(totals.items(), key=lambda kv: kv[1], reverse=True)
    return [{"pos": i + 1, "team": name, "points": points} for i, (name, points) in enumerate(ranked)]


def _parse_team_rows(elems):
    """Parse a team/manufacturer championship section. Column positions are read
    from the section's own header text."""
    TEAM_COLS = {"Pos", "Team", "Total"}
    cols = _detect_col_positions(elems, TEAM_COLS)

    if "Total" in cols:
        x_total = cols["Total"]
        x_name  = cols.get("Team", 49)
        T = 16
    else:
        # Absolute fallback: old large-format bounds
        x_total, x_name, T = 480, 95, 30

    entries = []
    pos = 1
    for _y, row_elems in sorted(_group_by_y(elems).items(), reverse=True):
        pts_text = _find_text(row_elems, x_total - T, x_total + T, r"^\d+$")
        if not pts_text:
            continue
        name = _find_text(row_elems, x_name, x_total - T - 2, r"[A-Za-z]")
        if not name:
            continue
        entries.append({"pos": pos, "team": name, "points": _to_int(pts_text)})
        pos += 1
    return _normalize_team_entries(entries)


def _backfill_teams(driver_list, output_rounds):
    """Fill 'team' field from race results for championship PDF entries."""
    team_map = {}
    for rnd in output_rounds:
        for race in rnd.get("races", []):
            for r in race.get("results", []):
                if r.get("team") and r.get("driver"):
                    team_map[r["driver"]] = r["team"]
    for entry in driver_list:
        if not entry.get("team"):
            entry["team"] = team_map.get(entry["driver"], "")


def parse_championship_pdf(pdf_bytes):
    """
    Parse a TSL championship standings PDF (ptstrg suffix).
    Returns a dict with standings, teams, manufacturers, independentsTeams, jst
    (each a list of dicts), or None if the PDF cannot be parsed.

    Column positions are derived dynamically from the PDF's own header text so
    any future TSL scale changes are handled without code updates.
    Processes each page separately and sorts by y to avoid content-stream ordering
    issues (pdfminer may not emit text boxes in top-to-bottom order).
    """
    if not pdf_bytes:
        return None

    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f:
        f.write(pdf_bytes)
        path = f.name
    try:
        all_pages = []
        for page_layout in extract_pages(path):
            page_elems = []
            for element in page_layout:
                if isinstance(element, LTTextBox):
                    for line in element:
                        if isinstance(line, LTTextLine):
                            txt = line.get_text().strip()
                            if txt:
                                page_elems.append((round(line.y0, 1), round(line.x0, 1), txt))
            all_pages.append(page_elems)
    except Exception:
        return None
    finally:
        Path(path).unlink(missing_ok=True)

    section_elems      = {key: [] for _, key in _CHAMP_SECTIONS}
    section_elems_full = {key: [] for _, key in _CHAMP_SECTIONS}  # includes race columns (x >= 641)

    for page_elems in all_pages:
        # Sort top-to-bottom so y-ranges are meaningful
        sorted_elems = sorted(page_elems, key=lambda e: -e[0])

        # Find section headers present on this page with their y positions
        headers_on_page = []
        seen_keys = set()
        for y, x, t in sorted_elems:
            for header, key in _CHAMP_SECTIONS:
                if key not in seen_keys and header.lower() in t.lower():
                    headers_on_page.append((y, key))
                    seen_keys.add(key)
                    break

        if not headers_on_page:
            continue

        # Assign elements between consecutive header y-values to each section
        for i, (header_y, key) in enumerate(headers_on_page):
            floor_y = headers_on_page[i + 1][0] if i + 1 < len(headers_on_page) else 0
            for y, x, t in sorted_elems:
                if floor_y < y < header_y:
                    section_elems_full[key].append((y, x, t))
                    if x < 641:
                        section_elems[key].append((y, x, t))

    per_race, scored_sessions = _parse_ptstrg_per_race(
        section_elems_full["standings"], num_rounds=len(ROUNDS[YEAR])
    )

    result = {
        "standings":         _parse_driver_rows(section_elems["standings"]),
        "teams":             _parse_team_rows(section_elems["teams"]),
        "manufacturers":     _parse_team_rows(section_elems["manufacturers"]),
        "independentsTeams": _parse_team_rows(section_elems["independentsTeams"]),
        # "Independents Trophy for Drivers" (Sporting Regs 1.6.2.b) - a genuinely
        # separate points table, not the "standings" rows filtered by class. Was
        # detected via _CHAMP_SECTIONS/_DRIVER_SECTIONS above but never made it
        # into the output dict, so the app had no real data to show for it.
        "independents":      _parse_driver_rows(section_elems["independents"]),
        "jst":               _parse_driver_rows(section_elems["jst"]),
        "per_race_points":   per_race,
        "scored_sessions":   scored_sessions,
    }
    for m in result["manufacturers"]:
        m["manufacturer"] = m.pop("team")

    return result if result["standings"] else None


def _apply_per_race_points(rounds, per_race, scored_sessions):
    """
    Override computed per-race points in results with values from the championship PDF.
    Only touches (round, session) pairs that appear in scored_sessions (i.e. at least
    one driver had a non-zero value in the PDF for that session). Future rounds whose
    columns are all-zero are left untouched so in-progress data is preserved.
    """
    for rnd in rounds:
        rnd_num = rnd["round"]
        for race in rnd.get("races", []):
            label = race["label"]
            if (rnd_num, label) not in scored_sessions:
                continue
            for r in race.get("results", []):
                driver = r.get("driver", "")
                if not driver:
                    continue
                if driver in per_race:
                    r["points"] = per_race[driver].get((rnd_num, label), 0)
                # Drivers not in per_race (wildcards not in championship) are unchanged


def _build_results_output(year, output_rounds, per_race, scored_sessions):
    """Applies the championship-PDF per-race point override (if any) to
    output_rounds and returns the exact dict main() should write to
    results{year}.json - the override and the file build happen in one
    place, together, on purpose.

    Confirmed live 2026-09-09: this used to be two separate steps in main()
    itself, in the wrong order - results{year}.json was serialized and
    written immediately after output_rounds was assembled, then
    _apply_per_race_points() ran afterward (once the championship PDF had
    been fetched) and correctly overrode output_rounds' per-race points in
    memory, but nothing ever wrote that corrected state back to disk. Every
    per-race point value in results{year}.json was therefore always the
    locally-reconstructed one (subject to this file's own fastestLap/
    leadLap-bonus detection - real, but a fundamentally different, less
    authoritative computation than the officially-published PDF), never the
    override - the override wasn't buggy, it just never reached the file it
    was meant to correct. That's what let points summed from
    results{year}.json drift from standings.json's official total for
    several drivers despite both the override logic and the PDF parsing
    themselves being correct. Extracted into its own function specifically
    so the override-then-build ordering is enforced by construction (the
    caller literally cannot get the dict without the override already
    having been applied to it), not left to hope every future call site in
    a 400+ line main() sequences its own two steps correctly."""
    if per_race and scored_sessions:
        _apply_per_race_points(output_rounds, per_race, scored_sessions)
    return {"season": str(year), "rounds": output_rounds}



# Wins/podiums are tracked only for the three main races of a round — the
# Qualifying Race is a scored sprint (see POINTS_QUALIFYING) but its results
# don't count as a "win"/"podium" in official BTCC statistics (verified against
# btcc.net reporting Ashley Sutton's Oulton Park Race 2 result as his "fifth
# victory of 2026" — a tally that only matches when QR results are excluded).
PODIUM_SESSIONS = {"Race 1", "Race 2", "Race 3"}


def compute_win_podium_tallies(rounds):
    """Return {driver: {wins, seconds, thirds}} counted from Race 1/2/3 only."""
    from collections import defaultdict
    tallies = defaultdict(lambda: {"wins": 0, "seconds": 0, "thirds": 0})
    for rnd in rounds:
        for race in rnd["races"]:
            if race["label"] not in PODIUM_SESSIONS:
                continue
            for r in race.get("results", []):
                d = r.get("driver")
                if not d:
                    continue
                if r["pos"] == 1:
                    tallies[d]["wins"] += 1
                elif r["pos"] == 2:
                    tallies[d]["seconds"] += 1
                elif r["pos"] == 3:
                    tallies[d]["thirds"] += 1
    return tallies


def compute_standings_fallback(rounds):
    """Compute standings from race results. Used when the championship PDF is unavailable."""
    from collections import defaultdict
    driver_pts    = defaultdict(int)
    driver_team   = {}
    driver_car    = {}
    driver_cl     = {}
    team_pts      = defaultdict(int)
    last_round    = 0
    last_venue    = ""

    for rnd in rounds:
        if any(race.get("results") for race in rnd["races"]):
            last_round = rnd["round"]
            last_venue = rnd["venue"]

        for race in rnd["races"]:
            if race["label"] in NO_POINTS_SESSIONS:
                continue
            is_qual_race = race["label"] == "Qualifying Race"
            pts_table = POINTS_QUALIFYING if is_qual_race else POINTS_RACE
            fl = fastest_lap_driver(race["results"]) if not is_qual_race else None

            for r in race["results"]:
                d   = r["driver"]
                pos = r["pos"]
                pts = pts_table.get(pos, 0) if pos > 0 else 0
                if d == fl:
                    pts += 1          # fastest lap bonus
                if r.get("leadLap") and not is_qual_race:
                    pts += 1          # laps led bonus

                driver_pts[d]  += pts
                driver_team[d]  = r.get("team", "")
                driver_car[d]   = str(r.get("no", ""))
                driver_cl[d]    = r.get("cl", "")
                team_pts[r.get("team", "")] += pts

    driver_tallies = compute_win_podium_tallies(rounds)
    drivers = sorted(driver_pts.items(), key=lambda x: -x[1])
    teams   = sorted(team_pts.items(),   key=lambda x: -x[1])

    return {
        "season":    str(YEAR),
        "round":     last_round,
        "venue":     last_venue,
        "updated":   datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "standings": [
            {
                "pos":     i,
                "driver":  name,
                "team":    driver_team[name],
                "car":     driver_car[name],
                "class":   driver_cl.get(name, ""),
                "points":  pts,
                "wins":    driver_tallies[name]["wins"],
                "seconds": driver_tallies[name]["seconds"],
                "thirds":  driver_tallies[name]["thirds"],
            }
            for i, (name, pts) in enumerate(drivers, 1)
        ],
        "teams": [
            {"pos": i, "team": name, "points": pts}
            for i, (name, pts) in enumerate(teams, 1)
        ],
    }

def merge_standings_timestamp(new_standings, existing_standings):
    """Reverts new_standings["updated"] back to existing_standings's value
    when nothing else in new_standings actually differs from what's already
    on disk - keeps a genuine no-change scrape tick byte-identical to the
    already-committed file, instead of always re-stamping `updated` with
    the current time and so making git-auto-commit-action commit this file
    on essentially every 2-minute scrape tick during a raceday regardless
    of real content change (confirmed live: round 7/Donington GP weekend
    logged 193 commits to this file, all but ~8 of them differing from
    their predecessor only in this one field).

    existing_standings may be None (first run ever, or the existing file
    was missing/unreadable) - new_standings is returned unchanged in that
    case, same as a genuine first-ever write.
    """
    if existing_standings is None:
        return new_standings
    new_comparable = {k: v for k, v in new_standings.items() if k != "updated"}
    existing_comparable = {k: v for k, v in existing_standings.items() if k != "updated"}
    if new_comparable == existing_comparable and "updated" in existing_standings:
        new_standings["updated"] = existing_standings["updated"]
    return new_standings


# ── Calendar track record updater ────────────────────────────────────────────

def update_calendar_records(output_rounds, year):
    """
    Compare the best lap times from this scrape against the stored qualifying
    and race records in calendar.json, updating entries where a new record was set.
    """
    calendar_path = DATA_DIR / "calendar.json"
    if not calendar_path.exists():
        return

    calendar = json.loads(calendar_path.read_text())
    round_map = {r["round"]: r for r in calendar.get("rounds", [])}
    changed = False

    for rnd in output_rounds:
        cal = round_map.get(rnd["round"])
        if not cal:
            continue

        length_str = cal.get("lengthMiles", "")
        length_match = re.match(r"^([\d.]+)", length_str)
        length_miles = float(length_match.group(1)) if length_match else None

        def speed_str(secs):
            if not length_miles or secs <= 0:
                return None
            mph = length_miles / (secs / 3600)
            return f"{mph:.2f} mph"

        # Qualifying record  -  fastest bestLap across all Qualifying results
        best_qual_secs = None
        best_qual_entry = None
        for race in rnd.get("races", []):
            if race["label"] != "Qualifying":
                continue
            for r in race["results"]:
                secs = lap_to_secs(r.get("bestLap", ""))
                if secs < float("inf") and (best_qual_secs is None or secs < best_qual_secs):
                    best_qual_secs = secs
                    best_qual_entry = r

        if best_qual_entry:
            stored_secs = lap_to_secs(cal.get("qualifyingRecord", {}).get("time", ""))
            if stored_secs == float("inf") or best_qual_secs < stored_secs:
                sp = speed_str(best_qual_secs)
                rec = {"driver": best_qual_entry["driver"], "time": best_qual_entry["bestLap"], "year": year}
                if sp:
                    rec["speed"] = sp
                cal["qualifyingRecord"] = rec
                changed = True
                print(f"  [record] Round {rnd['round']} qualifying: "
                      f"{rec['driver']} {rec['time']}"
                      + (f" ({sp})" if sp else "") + "  NEW RECORD")

        # Race record  -  fastest bestLap across Race 1, Race 2, Race 3
        best_race_secs = None
        best_race_entry = None
        for race in rnd.get("races", []):
            if race["label"] not in ("Race 1", "Race 2", "Race 3"):
                continue
            for r in race["results"]:
                secs = lap_to_secs(r.get("bestLap", ""))
                if secs < float("inf") and (best_race_secs is None or secs < best_race_secs):
                    best_race_secs = secs
                    best_race_entry = r

        if best_race_entry:
            stored_secs = lap_to_secs(cal.get("raceRecord", {}).get("time", ""))
            if stored_secs == float("inf") or best_race_secs < stored_secs:
                sp = speed_str(best_race_secs)
                rec = {"driver": best_race_entry["driver"], "time": best_race_entry["bestLap"], "year": year}
                if sp:
                    rec["speed"] = sp
                cal["raceRecord"] = rec
                changed = True
                print(f"  [record] Round {rnd['round']} race: "
                      f"{rec['driver']} {rec['time']}"
                      + (f" ({sp})" if sp else "") + "  NEW RECORD")

    if changed:
        calendar_path.write_text(json.dumps(calendar, indent=2))
        print("  [records] calendar.json updated")
    else:
        print("  [records] no new track records this scrape")


# ── Main ──────────────────────────────────────────────────────────────────────

def merge_scraped_with_existing(scraped, existing_round):
    """Carry forward grids, results and reverseGridDraw from a previous scrape run.

    Rules (in priority order):
    - New grid overwrites old grid when the fetch succeeds (catches TSL amendments).
      If the car-number order changed, a warning is printed.
    - Old grid is kept when the new fetch returned empty (transient failure).
    - New results overwrite old results when present; old results kept otherwise.
    - New bestSpeeds/weather/flagStats/bestSectors/lapChart each overwrite their own old
      value when present; old value kept otherwise (a transient book-fetch failure
      doesn't wipe previously-scraped data).
    - reverseGridDraw is preserved from the existing round when not set on the new scrape.
    - youtubeUrls are always carried forward (never re-scraped).
    """
    scraped["youtubeUrls"] = existing_round.get("youtubeUrls", [None] * 6)
    existing_map = {r["label"]: r for r in existing_round.get("races", [])}
    for race in scraped["races"]:
        ex = existing_map.get(race["label"])
        if not ex:
            continue
        if ex.get("grid") and not race.get("grid"):
            race["grid"] = ex["grid"]
        elif ex.get("grid") and race.get("grid"):
            old_nos = [g["no"] for g in sorted(ex["grid"], key=lambda g: g["pos"])]
            new_nos = [g["no"] for g in sorted(race["grid"], key=lambda g: g["pos"])]
            if old_nos != new_nos:
                print(f"  *** {race['label']} grid CHANGED (TSL amendment?) old={old_nos[:3]}... new={new_nos[:3]}...")
        if ex.get("results") and not race.get("results"):
            race["results"] = ex["results"]
        for field in ("bestSpeeds", "weather", "flagStats", "bestSectors", "lapChart"):
            if ex.get(field) and not race.get(field):
                race[field] = ex[field]
        # Preserve an explicitly-set reverseGridDraw override
        if ex.get("reverseGridDraw") is not None and race.get("reverseGridDraw") is None:
            race["reverseGridDraw"] = ex["reverseGridDraw"]
    return scraped


def apply_draw_override(output_rounds, round_num, draw):
    """Write reverseGridDraw on Race 3 of round_num (--set-draw recovery path)."""
    for rnd in output_rounds:
        if rnd["round"] == round_num:
            for race in rnd.get("races", []):
                if race["label"] == "Race 3":
                    race["reverseGridDraw"] = draw
                    print(f"  --set-draw: Round {round_num} Race 3 reverseGridDraw = {draw}")
            break


def main():
    if YEAR not in ROUNDS:
        print(f"Year {YEAR} not configured.", file=sys.stderr)
        sys.exit(1)

    results_path   = DATA_DIR / f"results{YEAR}.json"
    standings_path = DATA_DIR / "standings.json"

    # Load existing results to preserve rounds we're not re-scraping
    if results_path.exists():
        existing = json.loads(results_path.read_text())
        existing_rounds = {r["round"]: r for r in existing.get("rounds", [])}
    else:
        existing_rounds = {}

    all_session_labels = list(SESSION_SUFFIXES.keys())

    def make_stub(info, existing=None):
        youtube_urls = (existing or {}).get("youtubeUrls", [None] * 6)
        existing_race_map = {r["label"]: r for r in (existing or {}).get("races", [])}
        races = [existing_race_map.get(s, {"label": s, "results": [], "grid": []}) for s in all_session_labels]
        return {"round": info["round"], "venue": info["venue"], "date": info["date"], "youtubeUrls": youtube_urls, "races": races}

    output_rounds = []
    for info in ROUNDS[YEAR]:
        if ROUND_FILTER and info["round"] != ROUND_FILTER:
            if info["round"] in existing_rounds:
                output_rounds.append(existing_rounds[info["round"]])
            else:
                output_rounds.append(make_stub(info))
            continue

        scraped = scrape_round(info, session_filter=SESSION_FILTER)
        if scraped:
            if info["round"] in existing_rounds:
                merge_scraped_with_existing(scraped, existing_rounds[info["round"]])
            else:
                scraped["youtubeUrls"] = [None] * 6
            output_rounds.append(scraped)
        elif info["round"] in existing_rounds:
            output_rounds.append(existing_rounds[info["round"]])
        else:
            output_rounds.append(make_stub(info))

    if SET_DRAW is not None and ROUND_FILTER is not None:
        apply_draw_override(output_rounds, ROUND_FILTER, SET_DRAW)

    # Find the latest round that has any results
    completed = [r for r in output_rounds
                 if any(race.get("results") for race in r.get("races", []))]
    latest = max(completed, key=lambda r: r["round"]) if completed else None

    # Try championship PDFs from most-recent completed round backwards.
    # TSL only publishes ptstrg after Race 3, so mid-round we fall back to the
    # previous round's official PDF rather than the computed standings.
    standings = None
    per_race, scored_sessions = {}, set()  # populated below if a championship PDF parses; passed to _build_results_output regardless, so an empty/failed parse is a safe no-op override there
    if latest:
        tsl_map = {info["round"]: info["tsl"] for info in ROUNDS[YEAR]}
        completed_rounds = sorted(
            [r for r in output_rounds if any(race.get("results") for race in r.get("races", []))],
            key=lambda r: r["round"],
            reverse=True,
        )
        for rnd in completed_rounds:
            tsl = tsl_map.get(rnd["round"])
            if not tsl:
                continue
            champ_url = TSL_BASE.format(year=YEAR, tsl=tsl, suffix=CHAMPIONSHIP_SUFFIX)
            print(f"\n[championship] round {rnd['round']} → {champ_url}")
            champ_data = fetch_pdf(champ_url)
            if champ_data:
                standings = parse_championship_pdf(champ_data)
                if standings:
                    print(f"  parsed ({len(standings['standings'])} drivers, "
                          f"{len(standings.get('independents', []))} Independents, "
                          f"{len(standings.get('jst', []))} JST, "
                          f"{len(standings.get('scored_sessions', []))} scored sessions)")
                    _backfill_teams(standings["standings"],    output_rounds)
                    _backfill_teams(standings["independents"], output_rounds)
                    _backfill_teams(standings["jst"],          output_rounds)
                    # Stashed for _build_results_output below, which is what
                    # actually applies this override - not done here, so it
                    # can't be applied before output_rounds gets serialized
                    # to results{year}.json (see that function's docstring).
                    per_race       = standings.get("per_race_points", {})
                    scored_sessions = standings.get("scored_sessions", set())
                    break
                else:
                    print("  parse failed — trying previous round")
            else:
                print(f"  not available yet — trying previous round")
        if not standings:
            print("  no championship PDF found — falling back to computed standings")

    if not standings:
        standings = compute_standings_fallback(output_rounds)

    # See _build_results_output's own docstring for why the override and the
    # write happen together here, rather than writing output_rounds straight
    # after it was assembled above (which is what this code used to do, and
    # the root cause of a season-long points drift - fixed 2026-09-09).
    results_out = _build_results_output(YEAR, output_rounds, per_race, scored_sessions)
    results_path.write_text(json.dumps(results_out, indent=2))
    print(f"\nWrote {results_path}")

    standings["season"]  = str(YEAR)
    standings["round"]   = latest["round"] if latest else 0
    standings["venue"]   = latest["venue"] if latest else ""
    standings["updated"] = datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")

    # Always derive wins/seconds/thirds from the scraped race results rather than
    # the championship PDF's own columns — the PDF's Pos/Total (points) columns
    # are reliably detected, but its Wins/2nds/3rds columns have been observed to
    # drift out of alignment (see project memory: results/standings mismatch,
    # fixed 2026-07-14). Race-result-derived tallies are the trustworthy source.
    #
    # NOTE: "independents" is deliberately excluded here. compute_win_podium_tallies
    # counts outright (whole-grid) finishing positions, but the Independents Trophy's
    # Wins/2nds/3rds are a class tally (best-placed independent in a race) - a
    # different metric the app doesn't otherwise compute. The PDF's own columns for
    # this section are trusted as-is; revisit if they're ever seen to drift too.
    driver_tallies = compute_win_podium_tallies(output_rounds)
    for row in standings.get("standings", []) + standings.get("jst", []):
        t = driver_tallies.get(row["driver"])
        if t:
            row["wins"], row["seconds"], row["thirds"] = t["wins"], t["seconds"], t["thirds"]

    # Strip internal working fields that aren't JSON-serializable (tuple keys/sets)
    standings.pop("per_race_points", None)
    standings.pop("scored_sessions", None)

    existing_standings = None
    if standings_path.exists():
        try:
            existing_standings = json.loads(standings_path.read_text())
        except (json.JSONDecodeError, OSError):
            existing_standings = None
    standings = merge_standings_timestamp(standings, existing_standings)

    standings_path.write_text(json.dumps(standings, indent=2))
    print(f"Wrote {standings_path}")

    print(f"\nDriver standings (top 10):")
    for s in standings["standings"][:10]:
        print(f"  {s['pos']:>2}. {s['driver']:<30} {s['points']} pts  W{s['wins']} 2nd{s['seconds']} 3rd{s['thirds']}")

    if standings.get("independents"):
        print(f"\nIndependents' Trophy for Drivers:")
        for s in standings["independents"]:
            print(f"  {s['pos']:>2}. {s['driver']:<30} {s['points']} pts  W{s['wins']} 2nd{s['seconds']} 3rd{s['thirds']}")

    if standings.get("jst"):
        print(f"\nJack Sears Trophy:")
        for s in standings["jst"]:
            print(f"  {s['pos']:>2}. {s['driver']:<30} {s['points']} pts")

    print("\n[track records]")
    update_calendar_records(output_rounds, YEAR)

    sub_step_failed = False

    print("\n[all-time records]")
    try:
        import importlib.util
        spec = importlib.util.spec_from_file_location(
            "compute_records", Path(__file__).parent / "compute_records.py"
        )
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        mod.main()
    except Exception as e:
        print(f"  ERROR: compute_records failed: {e}", file=sys.stderr)
        sub_step_failed = True

    # Team stats (totalRaces/totalWins in drivers.json) used to be scraped here
    # too, but that meant launching a headless browser on every 2-minute
    # results-scrape tick during a live race weekend (see scrape_team_stats.py
    # docstring for why it now needs one). Split into its own periodic
    # scrape-team-stats.yml workflow instead.

    # results.json/standings.json are already written above - fail only now,
    # after the good data is safely on disk, so CI still commits it while
    # still reporting the run as failed (and emailing) for the broken sub-step.
    if sub_step_failed:
        sys.exit(1)


if __name__ == "__main__":
    main()
