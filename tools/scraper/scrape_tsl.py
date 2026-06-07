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

for i, arg in enumerate(sys.argv):
    if arg == "--round" and i + 1 < len(sys.argv):
        ROUND_FILTER = int(sys.argv[i + 1])

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

    SESSION_FILTER = _today_labels - _already_done
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
#   BEST LAP  500 < x < 545 (m:ss.mmm)

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
            elif 470 < x < 545:
                # BEST LAP column (x≈503 for races, x≈468 for qualifying)
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
        label = BOOK_SESSION_ORDER[i] if i < len(BOOK_SESSION_ORDER) else None
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

    # Download book PDF for laps led
    book_url = TSL_BASE.format(year=YEAR, tsl=tsl, suffix="trg")
    print(f"  [book] → {book_url}")
    book_data = fetch_pdf(book_url)
    laps_led = parse_laps_led(_pdf_text(book_data)) if book_data else {}

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
    try:
        t = t.strip()
        if ":" in t:
            m, s = t.split(":")
            return int(m) * 60 + float(s)
        return float(t)
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


# Per-race column layout — two known PDF scales:
#   Old (large): calibrated from 262103ptstrg.pdf (Snetterton R3); QR first within each round
#   New (small): calibrated from 262303ptstrg.pdf (Oulton R4 onwards); R1/R2/R3 before QR
_PTSTRG_LAYOUTS = {
    "old": {
        "base_x":  641.0,
        "rnd_w":   138.6,
        "offsets": {"Qualifying Race": 0.0, "Race 1": 31.2, "Race 2": 67.2, "Race 3": 103.2},
        "col_tol": (-10, 25),
        "driver_bounds": {
            "pos":    (40,  60),  "car":  (70, 115), "driver": (100, 215),
            "nat":   (260, 295),  "cls": (315, 340),  "total": (355, 400),
            "wins":  (510, 555),  "snds": (555, 600), "thrds": (600, 641),
        },
    },
    "new": {
        "base_x":  312.6,
        "rnd_w":    55.4,
        "offsets": {"Qualifying Race": 0.0, "Race 1": -43.0, "Race 2": -28.6, "Race 3": -14.2},
        "col_tol": (-8, 12),
        "driver_bounds": {
            "pos":   (15,  28),  "car":  (28,  50), "driver": (40, 115),
            "nat":  (104, 122),  "cls": (124, 138),  "total": (138, 162),
            "wins": (200, 220),  "snds": (220, 238), "thrds": (236, 258),
        },
    },
}

def _detect_ptstrg_layout(all_pages):
    """Detect old vs new PDF scale by finding minimum QR column x across all pages."""
    min_qr_x = float("inf")
    for page_elems in all_pages:
        for y, x, t in page_elems:
            if t.strip() == "QR":
                min_qr_x = min(min_qr_x, x)
    return "new" if min_qr_x < 400 else "old"

def _detect_section_layout(elems):
    """Detect layout for a specific section by finding the 'Pos' header x position.
    Some sections (e.g. JST) use old-format bounds even when the drivers section is new-format."""
    for y, x, t in elems:
        if t.strip() == "Pos":
            return "new" if x < 25 else "old"
    return None  # fall back to global layout

def _ptstrg_col_x(rnd, label, layout):
    lo = _PTSTRG_LAYOUTS[layout]
    return lo["base_x"] + (rnd - 1) * lo["rnd_w"] + lo["offsets"].get(label, 0.0)


def _parse_ptstrg_per_race(section_elems, num_rounds, layout):
    """
    Extract per-race points from the drivers championship section.
    Returns (per_race, scored_sessions) where:
      per_race        = {driver: {(round, label): points}}
      scored_sessions = set of (round, label) pairs where at least one driver scored
    Only sessions with at least one non-zero value are in scored_sessions, so
    future-round columns (all zeros) are never mistaken for real data.
    """
    lo = _PTSTRG_LAYOUTS[layout]
    db = lo["driver_bounds"]
    tol_lo, tol_hi = lo["col_tol"]
    per_race = {}
    scored_sessions = set()
    labels = list(lo["offsets"].keys())

    for _y, row_elems in sorted(_group_by_y(section_elems).items(), reverse=True):
        if not _find_text(row_elems, *db["pos"], r"^\d+$"):
            continue  # not a driver row

        car_raw = _find_text(row_elems, *db["car"])
        driver = ""
        if car_raw:
            m = re.match(r"^(\d+)\s+(.+)$", car_raw)
            if m:
                driver = m.group(2).strip()
        if not driver:
            driver = _find_text(row_elems, *db["driver"]) or ""
        if not driver:
            continue
        driver = DRIVER_NAME_MAP.get(driver, driver)

        driver_pts = {}
        for rnd in range(1, num_rounds + 1):
            for label in labels:
                cx = _ptstrg_col_x(rnd, label, layout)
                val = _find_text(row_elems, cx + tol_lo, cx + tol_hi, r"^\d+$")
                pts = int(val) if val else 0
                driver_pts[(rnd, label)] = pts
                if pts > 0:
                    scored_sessions.add((rnd, label))
        per_race[driver] = driver_pts

    return per_race, scored_sessions


def _parse_driver_rows(elems, layout):
    """Parse a driver-type championship section into a list of entry dicts."""
    db = _PTSTRG_LAYOUTS[layout]["driver_bounds"]
    entries = []
    for _y, row_elems in sorted(_group_by_y(elems).items(), reverse=True):
        pos_text = _find_text(row_elems, *db["pos"], r"^\d+$")
        if not pos_text:
            continue
        pos = int(pos_text)

        car, driver = "", ""
        car_raw = _find_text(row_elems, *db["car"])
        if car_raw:
            m = re.match(r"^(\d+)\s+(.+)$", car_raw)
            if m:
                car, driver = m.group(1), m.group(2).strip()
            else:
                car = car_raw.strip()
        if not driver:
            driver = _find_text(row_elems, *db["driver"]) or ""

        driver = DRIVER_NAME_MAP.get(driver, driver)
        nat   = _find_text(row_elems, *db["nat"], r"^[A-Z]{3}$") or ""
        cls   = _find_text(row_elems, *db["cls"], r"^[MI]$") or ""
        total = _to_int(_find_text(row_elems, *db["total"], r"^\d+$"))
        wins  = _to_int(_find_text(row_elems, *db["wins"], r"^\d+$"))
        snds  = _to_int(_find_text(row_elems, *db["snds"], r"^\d+$"))
        thrds = _to_int(_find_text(row_elems, *db["thrds"], r"^\d+$"))

        if driver:
            entries.append({
                "pos": pos, "car": car, "driver": driver,
                "nat": nat, "class": cls, "points": total,
                "wins": wins, "seconds": snds, "thirds": thrds,
                "team": "",  # backfilled from race results
            })
    return entries


def _parse_team_rows(elems):
    """Parse a team/manufacturer championship section into a list of entry dicts."""
    entries = []
    pos = 1
    for _y, row_elems in sorted(_group_by_y(elems).items(), reverse=True):
        pts_text = _find_text(row_elems, 460, 510, r"^\d+$")
        if not pts_text:
            continue
        name = _find_text(row_elems, 95, 450, r"[A-Za-z]")
        if not name:
            continue
        entries.append({"pos": pos, "team": name, "points": _to_int(pts_text)})
        pos += 1
    return entries


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

    Column x-bounds derived from 261903ptstrg.pdf (Brands Hatch Indy 2026).
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

    layout = _detect_ptstrg_layout(all_pages)
    print(f"  [ptstrg] detected layout: {layout}")

    per_race, scored_sessions = _parse_ptstrg_per_race(
        section_elems_full["standings"], num_rounds=len(ROUNDS[YEAR]), layout=layout
    )

    result = {
        "standings":         _parse_driver_rows(section_elems["standings"], layout),
        "teams":             _parse_team_rows(section_elems["teams"]),
        "manufacturers":     _parse_team_rows(section_elems["manufacturers"]),
        "independentsTeams": _parse_team_rows(section_elems["independentsTeams"]),
        "jst":               _parse_driver_rows(section_elems["jst"], _detect_section_layout(section_elems["jst"]) or layout),
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


def compute_standings_fallback(rounds):
    """Compute standings from race results. Used when the championship PDF is unavailable."""
    from collections import defaultdict
    driver_pts    = defaultdict(int)
    driver_wins   = defaultdict(int)
    driver_2nds   = defaultdict(int)
    driver_3rds   = defaultdict(int)
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

                if pos == 1: driver_wins[d] += 1
                elif pos == 2: driver_2nds[d] += 1
                elif pos == 3: driver_3rds[d] += 1

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
                "wins":    driver_wins[name],
                "seconds": driver_2nds[name],
                "thirds":  driver_3rds[name],
            }
            for i, (name, pts) in enumerate(drivers, 1)
        ],
        "teams": [
            {"pos": i, "team": name, "points": pts}
            for i, (name, pts) in enumerate(teams, 1)
        ],
    }


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
            # Carry forward results, grids and youtubeUrls from previous runs
            if info["round"] in existing_rounds:
                ex_round = existing_rounds[info["round"]]
                scraped["youtubeUrls"] = ex_round.get("youtubeUrls", [None] * 6)
                existing_map = {r["label"]: r for r in ex_round.get("races", [])}
                for race in scraped["races"]:
                    ex = existing_map.get(race["label"])
                    if ex:
                        if ex.get("grid") and not race.get("grid"):
                            race["grid"] = ex["grid"]
                        if ex.get("results") and not race.get("results"):
                            race["results"] = ex["results"]
            else:
                scraped["youtubeUrls"] = [None] * 6
            output_rounds.append(scraped)
        elif info["round"] in existing_rounds:
            output_rounds.append(existing_rounds[info["round"]])
        else:
            output_rounds.append(make_stub(info))

    results_out = {"season": str(YEAR), "rounds": output_rounds}
    results_path.write_text(json.dumps(results_out, indent=2))
    print(f"\nWrote {results_path}")

    # Find the latest round that has any results
    completed = [r for r in output_rounds
                 if any(race.get("results") for race in r.get("races", []))]
    latest = max(completed, key=lambda r: r["round"]) if completed else None

    # Try championship PDFs from most-recent completed round backwards.
    # TSL only publishes ptstrg after Race 3, so mid-round we fall back to the
    # previous round's official PDF rather than the computed standings.
    standings = None
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
                          f"{len(standings.get('jst', []))} JST, "
                          f"{len(standings.get('scored_sessions', []))} scored sessions)")
                    _backfill_teams(standings["standings"], output_rounds)
                    _backfill_teams(standings["jst"],       output_rounds)
                    # Override computed per-race points with championship PDF values
                    per_race       = standings.get("per_race_points", {})
                    scored_sessions = standings.get("scored_sessions", set())
                    if per_race and scored_sessions:
                        _apply_per_race_points(output_rounds, per_race, scored_sessions)
                    break
                else:
                    print("  parse failed — trying previous round")
            else:
                print(f"  not available yet — trying previous round")
        if not standings:
            print("  no championship PDF found — falling back to computed standings")

    if not standings:
        standings = compute_standings_fallback(output_rounds)

    standings["season"]  = str(YEAR)
    standings["round"]   = latest["round"] if latest else 0
    standings["venue"]   = latest["venue"] if latest else ""
    standings["updated"] = datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")

    # Strip internal working fields that aren't JSON-serializable (tuple keys/sets)
    standings.pop("per_race_points", None)
    standings.pop("scored_sessions", None)

    standings_path.write_text(json.dumps(standings, indent=2))
    print(f"Wrote {standings_path}")

    print(f"\nDriver standings (top 10):")
    for s in standings["standings"][:10]:
        print(f"  {s['pos']:>2}. {s['driver']:<30} {s['points']} pts  W{s['wins']} 2nd{s['seconds']} 3rd{s['thirds']}")

    if standings.get("jst"):
        print(f"\nJack Sears Trophy:")
        for s in standings["jst"]:
            print(f"  {s['pos']:>2}. {s['driver']:<30} {s['points']} pts")

    print("\n[track records]")
    update_calendar_records(output_rounds, YEAR)

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
        print(f"  WARNING: compute_records failed: {e}", file=sys.stderr)

    print("\n[team stats]")
    try:
        import importlib.util
        spec = importlib.util.spec_from_file_location(
            "scrape_team_stats", Path(__file__).parent / "scrape_team_stats.py"
        )
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        mod.main()
    except Exception as e:
        print(f"  WARNING: team stats scrape failed: {e}", file=sys.stderr)



if __name__ == "__main__":
    main()
