"""
Positional table parsers for the TSL event book PDF ({tsl}trg.pdf).

scrape_tsl.py's older book parsers (best speeds, best sectors, lap chart,
laps led, weather, flags) read pdfminer's plain-text stream. That works for
those pages because each one prints its columns as clean runs, but the four
reports parsed here do not: on TYRE COMPOUNDS the compounds come out detached
from their rows (a driver's second compound can't be attributed at all), and
SECTOR ANALYSIS interleaves sector times with speeds and drops blank cells
(lap 1 has no Sector 1 time, an in-lap has no Sector 4 time, a retirement row
stops mid-lap), so counting tokens shifts every later value into the wrong
column. Confirmed by dumping the 2026 Brands Hatch GP and Silverstone books.

So these parsers work from character positions instead: every page becomes a
list of rows (grouped by baseline), every row a list of cells (characters
grouped by horizontal gap), each cell carrying its x-extent. Columns are then
assigned by x-position against that table's own header row, the same way a
person reads the page, so a missing cell simply leaves its column empty.

Parsers take the (label -> pages) structure from index_reports(), not raw PDF
bytes, so tests can build pages by hand with make_row().
"""

import re
import tempfile
from collections import OrderedDict
from pathlib import Path

try:
    from pdfminer.high_level import extract_pages
    from pdfminer.layout import LTChar
except ImportError:  # scrape_tsl.py prints the install hint and exits
    extract_pages = None
    LTChar = None


# ── Page geometry ─────────────────────────────────────────────────────────────

# Horizontal gap (pt) above which two characters are different cells. A word
# space in the book's 8-9pt font measures ~2.2-2.6pt; the tightest real column
# gap seen is ~4pt ("IDEAL LAP TIME :" -> "1:29.791"), lap time -> "(2)" ~5pt.
CELL_GAP = 3.5
# Gap above which two characters in the same cell get a space between them.
WORD_GAP = 1.0
# Vertical tolerance (pt) for two characters sharing a row.
ROW_TOLERANCE = 2.0


def _iter_chars(obj):
    if isinstance(obj, LTChar):
        yield obj
    elif hasattr(obj, "__iter__"):
        for child in obj:
            yield from _iter_chars(child)


def make_row(*cells):
    """A row as the parsers see it: [(x0, x1, text), ...] sorted by x0.
    Public so tests can build pages without a PDF."""
    return sorted(cells, key=lambda c: c[0])


def _chars_to_rows(chars):
    chars = [c for c in chars if c.get_text().strip()]
    chars.sort(key=lambda c: (-c.y0, c.x0))
    grouped = []
    for c in chars:
        if grouped and abs(grouped[-1][0] - c.y0) <= ROW_TOLERANCE:
            grouped[-1][1].append(c)
        else:
            grouped.append([c.y0, [c]])
    rows = []
    for _, row_chars in grouped:
        row_chars.sort(key=lambda c: c.x0)
        cells = []
        for c in row_chars:
            if cells and c.x0 - cells[-1][1] <= CELL_GAP:
                sep = " " if c.x0 - cells[-1][1] > WORD_GAP else ""
                cells[-1][1] = c.x1
                cells[-1][2] += sep + c.get_text()
            else:
                cells.append([c.x0, c.x1, c.get_text()])
        rows.append([(round(a, 1), round(b, 1), t) for a, b, t in cells])
    return rows


def book_pages(pdf_bytes):
    """Every page of the book as a list of rows, top to bottom."""
    if extract_pages is None or not pdf_bytes:
        return []
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f:
        f.write(pdf_bytes)
        path = f.name
    try:
        return [_chars_to_rows(_iter_chars(page)) for page in extract_pages(path)]
    except Exception:
        return []
    finally:
        Path(path).unlink(missing_ok=True)


def row_text(row):
    return " ".join(c[2] for c in row)


# ── Report index ──────────────────────────────────────────────────────────────

REPORTS = ("SECTOR ANALYSIS", "STATISTICS", "TOP SPEEDS", "TYRE COMPOUNDS")

_REPORT_RE = re.compile(r"-\s*(SECTOR ANALYSIS|STATISTICS|TOP SPEEDS\s*@\s*(.+?)|TYRE COMPOUNDS)\s*$", re.IGNORECASE)
_PART_RE = re.compile(r"^QUALIFYING\s*-\s*PART\s*(\d)", re.IGNORECASE)
_RACE_RE = re.compile(r"^ROUND\s*(\d+)\s*-", re.IGNORECASE)
# Same tolerance as scrape_tsl._TITLE: "Brtish" (2026 Brands Hatch GP practice
# pages) and "Champinship" (2018 Donington) are both confirmed live typos.
_TITLE_RE = re.compile(r"Br(?:i)?tish Touring Car Champ(?:ionship|inship)", re.IGNORECASE)


def _page_heading(page):
    """(session, report, extra) for a report page, else None. session is
    "Free Practice" / "Qualifying Part N" / "Qualifying Race" / ("race", N).
    The heading is the row directly under the repeated championship title."""
    for i, row in enumerate(page[:3]):
        if _TITLE_RE.search(row_text(row)) and i + 1 < len(page):
            heading = re.sub(r"\s+", " ", row_text(page[i + 1])).strip()
            # "QUALIFYING -RACE": confirmed live typo, 2026 Donington GP book
            heading = re.sub(r"^QUALIFYING\s*-\s*RACE", "QUALIFYING RACE", heading, flags=re.IGNORECASE)
            break
    else:
        return None
    m = _REPORT_RE.search(heading)
    if not m:
        return None
    report = m.group(1).upper()
    extra = None
    if report.startswith("TOP SPEEDS"):
        report, extra = "TOP SPEEDS", m.group(2).strip().title()
    upper = heading.upper()
    if upper.startswith("FREE PRACTICE"):
        session = "Free Practice"
    elif upper.startswith("QUALIFYING RACE"):
        session = "Qualifying Race"
    elif _PART_RE.match(upper):
        session = f"Qualifying Part {_PART_RE.match(upper).group(1)}"
    elif _RACE_RE.match(upper):
        session = ("race", int(_RACE_RE.match(upper).group(1)))
    else:
        return None
    return session, report, extra


def index_reports(pages):
    """{(session_label, report): {"pages": [...], "extra": str|None}}.

    Race headings are "ROUND N - ..." where N is confirmed live (2026) to be
    the CHAMPIONSHIP round (25/26/27 at Silverstone), not 1/2/3 as some older
    books print. Either way the three races appear in order, so distinct N
    values are mapped to Race 1/2/3 by first appearance rather than trusting
    the number itself."""
    race_numbers = []
    index = OrderedDict()
    for page in pages:
        head = _page_heading(page)
        if not head:
            continue
        session, report, extra = head
        if isinstance(session, tuple):
            if session[1] not in race_numbers:
                race_numbers.append(session[1])
            idx = race_numbers.index(session[1])
            if idx > 2:
                continue
            session = f"Race {idx + 1}"
        entry = index.setdefault((session, report), {"pages": [], "extra": extra})
        entry["pages"].append(page)
    return index


# ── Value helpers ─────────────────────────────────────────────────────────────

_LAP_TIME_RE = re.compile(r"^(?:(\d+):)?(\d{1,2}\.\d{3})$")
_INT_RE = re.compile(r"^\d+$")
_FLOAT_RE = re.compile(r"^\d+\.\d+$")


def time_to_secs(text):
    """"1:29.940" / "28.955" -> float seconds, else None."""
    m = _LAP_TIME_RE.match((text or "").strip())
    if not m:
        return None
    mins = int(m.group(1)) if m.group(1) else 0
    return round(mins * 60 + float(m.group(2)), 3)


def _to_float(text):
    text = (text or "").strip()
    return float(text) if _FLOAT_RE.match(text) else None


def _body_rows(page):
    """Rows below the title + heading rows (and page footers dropped)."""
    out = []
    for row in page[2:]:
        t = row_text(row)
        if t.startswith(("Weather / Track", "Results can be found", "Printed -")) or re.match(r"^[A-Z].*: \d+\.\d+ miles", t):
            break
        out.append(row)
    return out


# ── Tyre compounds ────────────────────────────────────────────────────────────

def parse_tyre_compounds(pages):
    """[{"no": int, "compounds": ["Medium", "Soft", ...]}] in the order each
    driver used them. Compound cells are those starting at or right of the
    "COMPOUND 1" header (left-aligned under it; the entry column to its left
    can run long, e.g. "Laser Tools Racing with MB Motorsport", which is
    exactly where the text-stream approach glued "Medium" onto the team)."""
    out = []
    for page in pages:
        compound_x = None
        for row in _body_rows(page):
            texts = [c[2] for c in row]
            if compound_x is None:
                hdr = next((c for c in row if c[2].upper().startswith("COMPOUND")), None)
                if hdr and texts[0].upper() == "NO":
                    compound_x = hdr[0] - 15
                continue
            if not _INT_RE.match(texts[0]):
                continue
            compounds = [c[2] for c in row if c[0] >= compound_x]
            out.append({"no": int(texts[0]), "compounds": compounds})
    return out or None


# ── Top speeds ────────────────────────────────────────────────────────────────

_TOP_SPEED_ROW_RE = re.compile(r"^(\d+)\s+(\d+)\s+.+?\s+((?:\d+\.\d\s+)*\d+\.\d)$")


def parse_top_speeds(pages):
    """[{"pos", "no", "speeds": [mph x up to 5], "avg", "best"}]. Joined-text
    regex rather than columns: the row is POS NO NAME VEHICLE then a run of
    one-decimal mph values whose LAST TWO are always AVG then BEST (confirmed
    live) - a driver with under 5 timed passes just has a shorter run. No
    vehicle name ends in a "N.N" token, so the run boundary is unambiguous."""
    out = []
    for page in pages:
        for row in _body_rows(page):
            m = _TOP_SPEED_ROW_RE.match(row_text(row))
            if not m:
                continue
            values = [float(v) for v in m.group(3).split()]
            if len(values) < 3:
                continue
            out.append({
                "pos": int(m.group(1)), "no": int(m.group(2)),
                "speeds": values[:-2], "avg": values[-2], "best": values[-1],
            })
    return out or None


# ── Statistics ────────────────────────────────────────────────────────────────

_STAT_KEYS = {
    "Competitors Started": "competitors",
    "Planned Start": "plannedStart",
    "Actual Start": "actualStart",
    "Finish Time": "finishTime",
    "Track Length": "trackLength",
    "Total Laps": "totalLaps",
    "Total Distance Covered": "totalDistance",
}
_STAMP_RE = re.compile(r"^(\d{4}-\d{2}-\d{2})\s*@\s*(\d{2}:\d{2}:\d{2})")
_MILES_RE = re.compile(r"^([\d.]+)\s*mi\.?$")
_TOD_RE = re.compile(r"^\d{2}:\d{2}:\d{2}\.\d{3}$")
_CLASS_RE = re.compile(r"^CLASS\s*:\s*(\S+)$", re.IGNORECASE)
_STARTERS_RE = re.compile(r"^(\d+)\s+Starters?$", re.IGNORECASE)


def _stat_value(key, text):
    if key in ("plannedStart", "actualStart", "finishTime"):
        m = _STAMP_RE.match(text)
        return f"{m.group(1)}T{m.group(2)}" if m else None
    if key in ("trackLength", "totalDistance"):
        m = _MILES_RE.match(text)
        return float(m.group(1)) if m else None
    return int(text) if _INT_RE.match(text) else None


def _fastest_lap_row(row):
    """A Fastest Lap History row: NO [CL] NAME LAP-TIME TIME-OF-DAY LAP VEHICLE.
    Found by value shape (lap time then time of day then an integer lap)
    rather than column, since the session-wide table has a CL column and the
    per-class tables don't."""
    texts = [c[2] for c in row]
    if not texts or not _INT_RE.match(texts[0]):
        return None
    for i in range(1, len(texts) - 2):
        secs = time_to_secs(texts[i])
        if secs is not None and _TOD_RE.match(texts[i + 1]) and _INT_RE.match(texts[i + 2]):
            return {"no": int(texts[0]), "time": texts[i], "secs": secs,
                    "timeOfDay": texts[i + 1][:8], "lap": int(texts[i + 2])}
    return None


def parse_statistics(pages):
    """{competitors, plannedStart, actualStart, finishTime, trackLength,
    totalLaps, totalDistance, startDelayMins, fastestLapHistory: [...],
    classes: {CL: {"starters", "fastestLap"}}}.

    Walks every STATISTICS page in order as one stream, switching section on
    each heading line ("Session Fastest Lap History", "CLASS : M", ...),
    since a long practice history is free to spill onto the next page.
    Leader history isn't kept (scrape_tsl.parse_laps_led + the lap chart
    already cover it), nor flag history (parse_flag_stats)."""
    stats = {}
    history = []
    classes = OrderedDict()
    section, cls = None, None
    for page in pages:
        for row in _body_rows(page):
            texts = [c[2] for c in row]
            joined = " ".join(texts)
            if texts[0] in _STAT_KEYS and len(texts) > 1:
                value = _stat_value(_STAT_KEYS[texts[0]], texts[1])
                if value is not None:
                    stats[_STAT_KEYS[texts[0]]] = value
                continue
            m = _CLASS_RE.match(texts[0])
            if m:
                cls = m.group(1).upper()
                starters = next((int(_STARTERS_RE.match(t).group(1)) for t in texts[1:] if _STARTERS_RE.match(t)), None)
                classes[cls] = {"starters": starters, "fastestLap": None}
                section = None
                continue
            if joined.startswith("Session Fastest Lap History"):
                section, cls = "session", None
                continue
            if joined.startswith("Fastest Lap History"):
                section = "class"
                continue
            if "Leader History" in joined or joined.startswith(("Flag History", "Flag Statistics")):
                section = None
                continue
            entry = _fastest_lap_row(row) if section else None
            if not entry:
                continue
            if section == "session":
                history.append(entry)
            elif section == "class" and cls in classes:
                classes[cls]["fastestLap"] = entry  # rows run oldest -> newest, last one stands
    if not stats and not history:
        return None
    if stats.get("plannedStart") and stats.get("actualStart"):
        stats["startDelayMins"] = _minutes_between(stats["plannedStart"], stats["actualStart"])
    stats["fastestLapHistory"] = history
    stats["classes"] = dict(classes)
    return stats


def _minutes_between(a, b):
    def mins(stamp):
        h, m, s = (int(x) for x in stamp.split("T")[1].split(":"))
        return h * 60 + m + s / 60
    return round(mins(b) - mins(a))


# ── Sector analysis ───────────────────────────────────────────────────────────

_LAP_NO_RE = re.compile(r"^(\d+)\s*-$")
_SECTOR_HDR_RE = re.compile(r"^SECTOR\s*(\d)$", re.IGNORECASE)
_LAP_FLAG_RE = re.compile(r"^(\S+)\s+([PD])$")


def _sector_anchors(row):
    """Column anchors (expected right edge x1 of each value) from a
    "LAP  SECTOR 1 ... LAP TIME  MPH  DIFF  TIME OF DAY" header row. Values
    are right-aligned: a sector's time ends at its header's centre and its
    speed ~11pt past the header's right edge (measured live: S1 header
    70.8-110.7, times end 90.4, speeds end 121.5). Built per header row, not
    hardcoded, so a 3-sector book needs no special casing."""
    anchors = []
    for x0, x1, text in row:
        t = text.upper()
        m = _SECTOR_HDR_RE.match(t)
        if m:
            k = int(m.group(1)) - 1
            anchors.append((("s", k), (x0 + x1) / 2))
            anchors.append((("v", k), x1 + 11))
        elif t == "LAP TIME":
            anchors.append((("lapTime",), x1 + 0.5))
        elif t == "TIME OF DAY":
            anchors.append((("tod",), x1 + 3))
    return anchors


def _parse_lap_row(row, anchors, n_sectors):
    m = _LAP_NO_RE.match(row[0][2])
    if not m:
        return None
    lap = {"lap": int(m.group(1)), "t": None, "s": [None] * n_sectors, "v": [None] * n_sectors}
    for x0, x1, text in row[1:]:
        if re.match(r"^\(\d+\)$", text):
            continue  # personal-best rank marker, (1)/(2)/(3)
        flag = None
        fm = _LAP_FLAG_RE.match(text)
        if fm:
            text, flag = fm.group(1), fm.group(2)
        elif text in ("P", "D"):
            lap["pit" if text == "P" else "deleted"] = True
            continue
        if flag:
            lap["pit" if flag == "P" else "deleted"] = True
        if text.upper() == "OUTLAP":
            lap["out"] = True
            continue
        if text.upper() == "IN PIT":
            lap["in"] = True
            continue
        key, dist = min(((k, abs(ax - x1)) for k, ax in anchors), key=lambda kd: kd[1])
        if dist > 15:
            continue  # MPH / DIFF columns: derivable, not stored
        if key[0] == "s":
            lap["s"][key[1]] = time_to_secs(text)
        elif key[0] == "v":
            lap["v"][key[1]] = _to_float(text)
        elif key[0] == "lapTime":
            lap["t"] = time_to_secs(text)
        elif key[0] == "tod" and _TOD_RE.match(text):
            lap["tod"] = text[:8]
    return lap


def parse_sector_analysis(pages):
    """[{"no", "ideal", "best", "laps": [{"lap", "t", "s": [...], "v": [...],
    "tod", "pit"?, "deleted"?, "out"?, "in"?}]}] - every lap of every driver.

    A driver block is: header row (P-pos, NO, CL, NAME, ENTRY), the "IDEAL
    LAP TIME :" row, the column header row, then lap rows. The header row is
    found as "the row directly above IDEAL LAP TIME" rather than by its own
    format, and a block whose laps run past the bottom of a page carries on
    under the next page's heading - so the current driver and anchors carry
    across pages until the next block starts."""
    drivers = []
    cur, anchors, n_sectors = None, None, 0
    for page in pages:
        rows = _body_rows(page)
        for i, row in enumerate(rows):
            texts = [c[2] for c in row]
            if i + 1 < len(rows) and rows[i + 1] and rows[i + 1][0][2].upper().startswith("IDEAL LAP TIME"):
                no = next((int(t) for t in texts[1:] if _INT_RE.match(t)), None)
                if no is None and _INT_RE.match(texts[0]):
                    no = int(texts[0])
                cur = {"no": no, "ideal": None, "best": None, "laps": []} if no is not None else None
                if cur:
                    drivers.append(cur)
                continue
            if texts[0].upper().startswith("IDEAL LAP TIME") and cur:
                for j, t in enumerate(texts[:-1]):
                    if t.upper().startswith("IDEAL"):
                        cur["ideal"] = time_to_secs(texts[j + 1])
                    elif t.upper().startswith("BEST LAP"):
                        cur["best"] = time_to_secs(texts[j + 1])
                continue
            if texts[0].upper() == "LAP" and any(_SECTOR_HDR_RE.match(t.upper()) for t in texts):
                anchors = _sector_anchors(row)
                n_sectors = sum(1 for k, _ in anchors if k[0] == "s")
                continue
            if cur and anchors:
                lap = _parse_lap_row(row, anchors, n_sectors)
                if lap:
                    cur["laps"].append(lap)
    drivers = [d for d in drivers if d["laps"]]
    return drivers or None


# ── Book-level entry point ────────────────────────────────────────────────────

def _merge_qualifying(part1, part2, kind):
    """Qualifying Part 1/2 are two disjoint driver groups of one session
    (same reasoning as scrape_tsl._merge_best_sectors_blocks)."""
    if not part1 and not part2:
        return None
    if kind in ("tyres", "laps"):
        return (part1 or []) + (part2 or [])
    if kind == "topSpeeds":
        merged = sorted((part1 or []) + (part2 or []), key=lambda e: (-e["best"], -e["avg"]))
        return [{**e, "pos": i + 1} for i, e in enumerate(merged)]
    # statistics: one session-level summary, each group's own history kept
    # (tagged by group - interleaving two groups' fastest laps by time of day
    # would show Group 2 "beating" a lap it never ran against).
    parts = [p for p in (part1, part2) if p]
    first, last = parts[0], parts[-1]
    merged = {k: first[k] for k in ("plannedStart", "actualStart", "startDelayMins", "trackLength") if k in first}
    if "finishTime" in last:
        merged["finishTime"] = last["finishTime"]
    for k in ("competitors", "totalLaps"):
        if any(k in p for p in parts):
            merged[k] = sum(p.get(k, 0) for p in parts)
    if any("totalDistance" in p for p in parts):
        merged["totalDistance"] = round(sum(p.get("totalDistance", 0) for p in parts), 4)
    merged["fastestLapHistory"] = [
        {**e, "group": g} for g, p in ((1, part1), (2, part2)) if p for e in p.get("fastestLapHistory", [])
    ]
    classes = {}
    for p in parts:
        for cl, info in (p.get("classes") or {}).items():
            c = classes.setdefault(cl, {"starters": 0, "fastestLap": None})
            c["starters"] += info.get("starters") or 0
            fl = info.get("fastestLap")
            if fl and (c["fastestLap"] is None or fl["secs"] < c["fastestLap"]["secs"]):
                c["fastestLap"] = fl
    merged["classes"] = classes
    return merged


_PARSERS = {
    "TYRE COMPOUNDS": ("tyres", parse_tyre_compounds),
    "TOP SPEEDS": ("topSpeeds", parse_top_speeds),
    "STATISTICS": ("sessionStats", parse_statistics),
    "SECTOR ANALYSIS": ("laps", parse_sector_analysis),
}
_MERGE_KIND = {"tyres": "tyres", "topSpeeds": "topSpeeds", "sessionStats": "stats", "laps": "laps"}


def parse_book_tables(pages):
    """{session_label: {"tyres", "topSpeeds", "topSpeedsTrap", "sessionStats",
    "laps"}} for each of the app's 6 sessions, Qualifying Part 1/2 merged.
    A missing report is simply absent from that session's dict."""
    index = index_reports(pages)
    out = {}
    qual = {}
    for (session, report), entry in index.items():
        field, parser = _PARSERS[report]
        value = parser(entry["pages"])
        if value is None:
            continue
        if session.startswith("Qualifying Part"):
            qual.setdefault(field, {})[session[-1]] = value
            if field == "topSpeeds":
                out.setdefault("Qualifying", {})["topSpeedsTrap"] = entry["extra"]
            continue
        out.setdefault(session, {})[field] = value
        if field == "topSpeeds":
            out[session]["topSpeedsTrap"] = entry["extra"]
    for field, parts in qual.items():
        merged = _merge_qualifying(parts.get("1"), parts.get("2"), _MERGE_KIND[field])
        if merged:
            out.setdefault("Qualifying", {})[field] = merged
    return out
