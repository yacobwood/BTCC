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
ROUND_FILTER = None
for i, arg in enumerate(sys.argv):
    if arg == "--round" and i + 1 < len(sys.argv):
        ROUND_FILTER = int(sys.argv[i + 1])

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
DATA_DIR   = REPO_ROOT / "data"

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
    anchors = []  # (y, pos_int, no_int_or_None, cl_or_None)
    for y, x, t in elements:
        if x >= 30:
            continue
        if t.startswith("*") or not t[0].isdigit() and t[:3] not in ("DNF", "DQ ", "NC ", "RET"):
            continue
        # "DNF/DQ/NC/RET NNN C" — non-finish with car+class embedded
        m = re.match(r"^(DNF|DQ|NC|RET)\s+(\d+)\s+([MI])", t)
        if m:
            anchors.append((y, 0, int(m.group(2)), m.group(3)))
            continue
        # "PP NNN C" — pos + 3-digit car + class (car number too wide for separate column)
        m = re.match(r"^(\d{1,2})\s+(\d+)\s+([MI])$", t)
        if m:
            anchors.append((y, int(m.group(1)), int(m.group(2)), m.group(3)))
            continue
        # Just a position number
        if re.match(r"^\d{1,2}$", t):
            anchors.append((y, int(t), None, None))

    anchors.sort(key=lambda a: -a[0])  # top-to-bottom (highest y first)

    results = []
    for anchor_y, pos, anchor_no, anchor_cl in anchors:
        y_min = anchor_y - 8
        y_max = anchor_y + 8

        row = [(y, x, t) for y, x, t in elements if y_min <= y <= y_max]

        driver = ""
        team = ""
        car_name = ""
        no = anchor_no or 0
        cl = anchor_cl or ""
        laps = 0
        best_lap = ""

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
            elif 340 < x < 380:
                if re.match(r"^\d+$", t):
                    laps = int(t)
            elif 380 < x < 570:
                # BEST LAP column (x≈503 for races, x≈411 for FP, x≈468 for qualifying)
                if re.match(r"^\d+:\d{2}\.\d+$", t):
                    best_lap = t

        # Normalise driver name
        driver = DRIVER_NAME_MAP.get(driver, driver)

        pts = pts_table.get(pos, 0) if pos > 0 else 0
        results.append({
            "pos":     pos,
            "no":      no,
            "cl":      cl,
            "driver":  driver,
            "team":    team,
            "car":     car_name,
            "laps":    laps,
            "bestLap": best_lap,
            "points":  pts,
        })

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

        # Names sit between the NAME column header and the FROM LAP column header
        name_m = re.search(r"NAME\n\n(.*?)FROM LAP", chunk, re.DOTALL)
        leaders = set()
        if name_m:
            for line in name_m.group(1).split("\n"):
                name = line.strip()
                # Must start with a capital letter and contain a space (driver names)
                # Driver names always have an ALL-CAPS surname (e.g. "Tom INGRAM")
                if name and re.match(r"^[A-Z][a-z]", name) and " " in name \
                        and any(w.isupper() and len(w) > 1 for w in name.split()):
                    name = DRIVER_NAME_MAP.get(name, name)
                    leaders.add(name)
        result[label] = leaders
        print(f"    [laps led] {label}: {leaders}")
    return result


# ── Round scraper ─────────────────────────────────────────────────────────────

def scrape_round(info):
    tsl = info["tsl"]
    print(f"\nRound {info['round']}: {info['venue']}  (TSL {tsl})")

    # Download and parse each session PDF
    races = []
    any_results = False
    for label, suffix in SESSION_SUFFIXES.items():
        url = TSL_BASE.format(year=YEAR, tsl=tsl, suffix=f"{suffix}trg")
        print(f"  {label} → {url}")
        data = fetch_pdf(url)
        if not data:
            print(f"    not available yet")
            races.append({"label": label, "results": []})
            continue
        results = parse_classification(data, label)
        print(f"    parsed {len(results)} entries")
        races.append({"label": label, "results": results})
        if results:
            any_results = True

    if not any_results:
        print(f"  No results available yet — skipping")
        return None

    # Download book PDF for laps led
    book_url = TSL_BASE.format(year=YEAR, tsl=tsl, suffix="trg")
    print(f"  [book] → {book_url}")
    book_data = fetch_pdf(book_url)
    laps_led = parse_laps_led(_pdf_text(book_data)) if book_data else {}

    # Tag ledLap on results
    for race in races:
        leaders = laps_led.get(race["label"], set())
        if leaders:
            for r in race["results"]:
                r["ledLap"] = r["driver"] in leaders

    return {
        "round": info["round"],
        "venue": info["venue"],
        "date":  info["date"],
        "races": races,
    }


# ── Standings computation ─────────────────────────────────────────────────────

def lap_to_secs(t):
    try:
        m, s = t.strip().split(":")
        return int(m) * 60 + float(s)
    except Exception:
        return float("inf")


def fastest_lap_driver(results):
    finishers = [r for r in results if r.get("pos", 0) > 0 and r.get("bestLap")]
    if not finishers:
        return None
    return min(finishers, key=lambda r: lap_to_secs(r["bestLap"]))["driver"]


def compute_standings(rounds):
    from collections import defaultdict
    import datetime
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
                if r.get("ledLap"):
                    pts += 1          # laps led bonus

                driver_pts[d]  += pts
                driver_team[d]  = r.get("team", "")
                driver_car[d]   = str(r.get("no", ""))
                driver_cl[d]    = r.get("cl", "")
                team_pts[r.get("team", "")] += pts

                if not is_qual_race:
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

    output_rounds = []
    for info in ROUNDS[YEAR]:
        if ROUND_FILTER and info["round"] != ROUND_FILTER:
            if info["round"] in existing_rounds:
                output_rounds.append(existing_rounds[info["round"]])
            else:
                output_rounds.append({"round": info["round"], "venue": info["venue"], "date": info["date"], "races": []})
            continue

        scraped = scrape_round(info)
        if scraped:
            output_rounds.append(scraped)
        elif info["round"] in existing_rounds:
            output_rounds.append(existing_rounds[info["round"]])
        else:
            output_rounds.append({"round": info["round"], "venue": info["venue"], "date": info["date"], "races": []})

    results_out = {"season": str(YEAR), "rounds": output_rounds}
    results_path.write_text(json.dumps(results_out, indent=2))
    print(f"\nWrote {results_path}")

    standings = compute_standings(output_rounds)
    standings_path.write_text(json.dumps(standings, indent=2))
    print(f"Wrote {standings_path}")

    print(f"\nDriver standings (top 10):")
    for s in standings["standings"][:10]:
        print(f"  {s['pos']:>2}. {s['driver']:<30} {s['points']} pts  W{s['wins']} 2nd{s['seconds']} 3rd{s['thirds']}")


if __name__ == "__main__":
    main()
