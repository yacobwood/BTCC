#!/usr/bin/env python3
"""
BTCC Race Results Scraper — historical seasons.
Renders btcc.net results pages with Playwright (JS-rendered),
extracts Race 1/2/3 results, and writes data/results{year}.json.

Usage:
    python scrape_results.py [year]      # default: 2024
"""

import json
import re
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout

YEAR = int(sys.argv[1]) if len(sys.argv) > 1 else 2026

ROUNDS = {
    2014: [
        {"round":  1, "venue": "Brands Hatch Indy", "date": "Apr 2014", "slug": "2014-brands-hatch-indy"},
        {"round":  2, "venue": "Donington Park",    "date": "May 2014", "slug": "2014-donington-park"},
        {"round":  3, "venue": "Thruxton",          "date": "May 2014", "slug": "2014-thruxton"},
        {"round":  4, "venue": "Oulton Park",       "date": "Jun 2014", "slug": "2014-oulton-park"},
        {"round":  5, "venue": "Croft",             "date": "Jun 2014", "slug": "2014-croft"},
        {"round":  6, "venue": "Snetterton",        "date": "Aug 2014", "slug": "2014-snetterton"},
        {"round":  7, "venue": "Knockhill",         "date": "Aug 2014", "slug": "2014-knockhill"},
        {"round":  8, "venue": "Rockingham",        "date": "Sep 2014", "slug": "2014-rockingham"},
        {"round":  9, "venue": "Silverstone",       "date": "Sep 2014", "slug": "2014-silverstone"},
        {"round": 10, "venue": "Brands Hatch GP",   "date": "Oct 2014", "slug": "2014-brands-hatch-gp"},
    ],
    2015: [
        {"round":  1, "venue": "Brands Hatch Indy", "date": "Apr 2015", "slug": "2015-brands-hatch-indy"},
        {"round":  2, "venue": "Donington Park",    "date": "May 2015", "slug": "2015-donington-park"},
        {"round":  3, "venue": "Thruxton",          "date": "May 2015", "slug": "2015-thruxton"},
        {"round":  4, "venue": "Oulton Park",       "date": "Jun 2015", "slug": "2015-oulton-park"},
        {"round":  5, "venue": "Croft",             "date": "Jun 2015", "slug": "2015-croft"},
        {"round":  6, "venue": "Snetterton",        "date": "Aug 2015", "slug": "2015-snetterton"},
        {"round":  7, "venue": "Knockhill",         "date": "Aug 2015", "slug": "2015-knockhill"},
        {"round":  8, "venue": "Rockingham",        "date": "Sep 2015", "slug": "2015-rockingham"},
        {"round":  9, "venue": "Silverstone",       "date": "Sep 2015", "slug": "2015-silverstone"},
        {"round": 10, "venue": "Brands Hatch GP",   "date": "Oct 2015", "slug": "2015-brands-hatch-gp"},
    ],
    2016: [
        {"round":  1, "venue": "Brands Hatch Indy", "date": "Apr 2016", "slug": "2016-brands-hatch-indy"},
        {"round":  2, "venue": "Donington Park",    "date": "May 2016", "slug": "2016-donington-park"},
        {"round":  3, "venue": "Thruxton",          "date": "May 2016", "slug": "2016-thruxton"},
        {"round":  4, "venue": "Oulton Park",       "date": "Jun 2016", "slug": "2016-oulton-park"},
        {"round":  5, "venue": "Croft",             "date": "Jun 2016", "slug": "2016-croft"},
        {"round":  6, "venue": "Snetterton",        "date": "Aug 2016", "slug": "2016-snetterton"},
        {"round":  7, "venue": "Knockhill",         "date": "Aug 2016", "slug": "2016-knockhill"},
        {"round":  8, "venue": "Rockingham",        "date": "Sep 2016", "slug": "2016-rockingham"},
        {"round":  9, "venue": "Silverstone",       "date": "Sep 2016", "slug": "2016-silverstone"},
        {"round": 10, "venue": "Brands Hatch GP",   "date": "Oct 2016", "slug": "2016-brands-hatch-gp"},
    ],
    2017: [
        {"round":  1, "venue": "Brands Hatch Indy", "date": "Apr 2017", "slug": "2017-brands-hatch-indy"},
        {"round":  2, "venue": "Donington Park",    "date": "May 2017", "slug": "2017-donington-park"},
        {"round":  3, "venue": "Thruxton",          "date": "May 2017", "slug": "2017-thruxton"},
        {"round":  4, "venue": "Oulton Park",       "date": "Jun 2017", "slug": "2017-oulton-park"},
        {"round":  5, "venue": "Croft",             "date": "Jun 2017", "slug": "2017-croft"},
        {"round":  6, "venue": "Snetterton",        "date": "Aug 2017", "slug": "2017-snetterton"},
        {"round":  7, "venue": "Knockhill",         "date": "Aug 2017", "slug": "2017-knockhill"},
        {"round":  8, "venue": "Rockingham",        "date": "Sep 2017", "slug": "2017-rockingham"},
        {"round":  9, "venue": "Silverstone",       "date": "Sep 2017", "slug": "2017-silverstone"},
        {"round": 10, "venue": "Brands Hatch GP",   "date": "Oct 2017", "slug": "2017-brands-hatch-gp"},
    ],
    2018: [
        {"round":  1, "venue": "Brands Hatch Indy", "date": "Apr 2018", "slug": "2018-brands-hatch-indy"},
        {"round":  2, "venue": "Donington Park",    "date": "May 2018", "slug": "2018-donington-park"},
        {"round":  3, "venue": "Thruxton",          "date": "May 2018", "slug": "2018-thruxton"},
        {"round":  4, "venue": "Oulton Park",       "date": "Jun 2018", "slug": "2018-oulton-park"},
        {"round":  5, "venue": "Croft",             "date": "Jun 2018", "slug": "2018-croft"},
        {"round":  6, "venue": "Snetterton",        "date": "Aug 2018", "slug": "2018-snetterton"},
        {"round":  7, "venue": "Rockingham",        "date": "Sep 2018", "slug": "2018-rockingham"},
        {"round":  8, "venue": "Knockhill",         "date": "Sep 2018", "slug": "2018-knockhill"},
        {"round":  9, "venue": "Silverstone",       "date": "Sep 2018", "slug": "2018-silverstone"},
        {"round": 10, "venue": "Brands Hatch GP",   "date": "Oct 2018", "slug": "2018-brands-hatch-gp"},
    ],
    2019: [
        {"round":  1, "venue": "Brands Hatch Indy", "date": "Apr 2019", "slug": "2019-brands-hatch-indy"},
        {"round":  2, "venue": "Donington Park",    "date": "May 2019", "slug": "2019-donington-park"},
        {"round":  3, "venue": "Thruxton",          "date": "May 2019", "slug": "2019-thruxton"},
        {"round":  4, "venue": "Croft",             "date": "Jun 2019", "slug": "2019-croft"},
        {"round":  5, "venue": "Oulton Park",       "date": "Jun 2019", "slug": "2019-oulton-park"},
        {"round":  6, "venue": "Snetterton",        "date": "Aug 2019", "slug": "2019-snetterton"},
        {"round":  7, "venue": "Thruxton 2",        "date": "Aug 2019", "slug": "2019-thruxton-2"},
        {"round":  8, "venue": "Knockhill",         "date": "Sep 2019", "slug": "2019-knockhill"},
        {"round":  9, "venue": "Silverstone",       "date": "Sep 2019", "slug": "2019-silverstone"},
        {"round": 10, "venue": "Brands Hatch GP",   "date": "Oct 2019", "slug": "2019-brands-hatch-gp"},
    ],
    2020: [
        {"round":  1, "venue": "Donington Park",    "date": "Aug 2020", "slug": "2020-donington-park"},
        {"round":  2, "venue": "Brands Hatch GP",   "date": "Aug 2020", "slug": "2020-brands-hatch-gp"},
        {"round":  3, "venue": "Oulton Park",       "date": "Sep 2020", "slug": "2020-oulton-park"},
        {"round":  4, "venue": "Knockhill",         "date": "Sep 2020", "slug": "2020-knockhill"},
        {"round":  5, "venue": "Thruxton",          "date": "Sep 2020", "slug": "2020-thruxton"},
        {"round":  6, "venue": "Silverstone",       "date": "Oct 2020", "slug": "2020-silverstone"},
        {"round":  7, "venue": "Croft",             "date": "Oct 2020", "slug": "2020-croft"},
        {"round":  8, "venue": "Snetterton",        "date": "Oct 2020", "slug": "2020-snetterton"},
        {"round":  9, "venue": "Brands Hatch Indy", "date": "Nov 2020", "slug": "2020-brands-hatch-indy"},
    ],
    2021: [
        {"round":  1, "venue": "Thruxton",          "date": "May 2021", "slug": "2021-thruxton"},
        {"round":  2, "venue": "Snetterton",        "date": "Jun 2021", "slug": "2021-snetterton"},
        {"round":  3, "venue": "Brands Hatch Indy", "date": "Jun 2021", "slug": "2021-brands-hatch-indy"},
        {"round":  4, "venue": "Oulton Park",       "date": "Jul 2021", "slug": "2021-oulton-park"},
        {"round":  5, "venue": "Knockhill",         "date": "Aug 2021", "slug": "2021-knockhill"},
        {"round":  6, "venue": "Thruxton 2",        "date": "Aug 2021", "slug": "2021-thruxton-2"},
        {"round":  7, "venue": "Croft",             "date": "Sep 2021", "slug": "2021-croft"},
        {"round":  8, "venue": "Silverstone",       "date": "Sep 2021", "slug": "2021-silverstone"},
        {"round":  9, "venue": "Donington Park",    "date": "Oct 2021", "slug": "2021-donington-park"},
        {"round": 10, "venue": "Brands Hatch GP",   "date": "Oct 2021", "slug": "2021-brands-hatch-gp"},
    ],
    2022: [
        {"round":  1, "venue": "Donington Park",    "date": "Apr 2022", "slug": "2022-donington-park"},
        {"round":  2, "venue": "Brands Hatch Indy", "date": "May 2022", "slug": "2022-brands-hatch-indy"},
        {"round":  3, "venue": "Thruxton",          "date": "May 2022", "slug": "2022-thruxton"},
        {"round":  4, "venue": "Oulton Park",       "date": "Jun 2022", "slug": "2022-oulton-park"},
        {"round":  5, "venue": "Croft",             "date": "Jun 2022", "slug": "2022-croft"},
        {"round":  6, "venue": "Knockhill",         "date": "Aug 2022", "slug": "2022-knockhill"},
        {"round":  7, "venue": "Snetterton",        "date": "Aug 2022", "slug": "2022-snetterton"},
        {"round":  8, "venue": "Thruxton 2",        "date": "Sep 2022", "slug": "2022-thruxton-2"},
        {"round":  9, "venue": "Silverstone",       "date": "Sep 2022", "slug": "2022-silverstone"},
        {"round": 10, "venue": "Brands Hatch GP",   "date": "Oct 2022", "slug": "2022-brands-hatch-gp"},
    ],
    2023: [
        {"round": 1,  "venue": "Donington Park",    "date": "23 Apr 2023", "slug": "2023-donington-park"},
        {"round": 2,  "venue": "Brands Hatch Indy", "date": "14 May 2023", "slug": "2023-brands-hatch-indy"},
        {"round": 3,  "venue": "Thruxton",          "date": "28 May 2023", "slug": "2023-thruxton"},
        {"round": 4,  "venue": "Oulton Park",       "date": "11 Jun 2023", "slug": "2023-oulton-park"},
        {"round": 5,  "venue": "Snetterton",        "date": "23 Jul 2023", "slug": "2023-snetterton"},
        {"round": 6,  "venue": "Knockhill",         "date": "13 Aug 2023", "slug": "2023-knockhill"},
        {"round": 7,  "venue": "Donington Park GP", "date": "27 Aug 2023", "slug": "2023-donington-park-gp"},
        {"round": 8,  "venue": "Croft",             "date": "17 Sep 2023", "slug": "2023-croft"},
        {"round": 9,  "venue": "Silverstone",       "date": "01 Oct 2023", "slug": "2023-silverstone"},
        {"round": 10, "venue": "Brands Hatch GP",   "date": "15 Oct 2023", "slug": "2023-brands-hatch-gp"},
    ],
    2024: [
        {"round": 1,  "venue": "Donington Park",    "date": "28 Apr 2024", "slug": "2024-donington-park"},
        {"round": 2,  "venue": "Brands Hatch Indy", "date": "19 May 2024", "slug": "2024-brands-hatch-indy"},
        {"round": 3,  "venue": "Oulton Park",        "date": "02 Jun 2024", "slug": "2024-oulton-park"},
        {"round": 4,  "venue": "Croft",              "date": "23 Jun 2024", "slug": "2024-croft"},
        {"round": 5,  "venue": "Knockhill",          "date": "14 Jul 2024", "slug": "2024-knockhill"},
        {"round": 6,  "venue": "Snetterton",         "date": "04 Aug 2024", "slug": "2024-snetterton"},
        {"round": 7,  "venue": "Thruxton",           "date": "25 Aug 2024", "slug": "2024-thruxton"},
        {"round": 8,  "venue": "Silverstone",        "date": "15 Sep 2024", "slug": "2024-silverstone"},
        {"round": 9,  "venue": "Donington Park GP",  "date": "22 Sep 2024", "slug": "2024-donington-park-gp"},
        {"round": 10, "venue": "Brands Hatch GP",    "date": "06 Oct 2024", "slug": "2024-brands-hatch-gp"},
    ],
    2025: [
        {"round":  1, "venue": "Donington Park",    "date": "27 Apr 2025", "slug": "2025-donington-park"},
        {"round":  2, "venue": "Brands Hatch Indy", "date": "18 May 2025", "slug": "2025-brands-hatch-indy"},
        {"round":  3, "venue": "Oulton Park",       "date": "01 Jun 2025", "slug": "2025-oulton-park"},
        {"round":  4, "venue": "Snetterton",        "date": "22 Jun 2025", "slug": "2025-snetterton"},
        {"round":  5, "venue": "Knockhill",         "date": "03 Aug 2025", "slug": "2025-knockhill"},
        {"round":  6, "venue": "Thruxton",          "date": "24 Aug 2025", "slug": "2025-thruxton"},
        {"round":  7, "venue": "Croft",             "date": "07 Sep 2025", "slug": "2025-croft"},
        {"round":  8, "venue": "Silverstone",       "date": "21 Sep 2025", "slug": "2025-silverstone"},
        {"round":  9, "venue": "Donington Park GP", "date": "05 Oct 2025", "slug": "2025-donington-park-gp"},
        {"round": 10, "venue": "Brands Hatch GP",   "date": "19 Oct 2025", "slug": "2025-brands-hatch-gp"},
    ],
    2026: [
        {"round":  1, "venue": "Donington Park",    "date": "18 Apr 2026", "slug": "2026-donington-park"},
        {"round":  2, "venue": "Brands Hatch Indy", "date": "09 May 2026", "slug": "2026-brands-hatch-indy"},
        {"round":  3, "venue": "Snetterton",        "date": "23 May 2026", "slug": "2026-snetterton"},
        {"round":  4, "venue": "Oulton Park",       "date": "06 Jun 2026", "slug": "2026-oulton-park"},
        {"round":  5, "venue": "Thruxton",          "date": "25 Jul 2026", "slug": "2026-thruxton"},
        {"round":  6, "venue": "Knockhill",         "date": "08 Aug 2026", "slug": "2026-knockhill"},
        {"round":  7, "venue": "Donington Park GP", "date": "22 Aug 2026", "slug": "2026-donington-park-gp"},
        {"round":  8, "venue": "Croft",             "date": "05 Sep 2026", "slug": "2026-croft"},
        {"round":  9, "venue": "Silverstone",       "date": "26 Sep 2026", "slug": "2026-silverstone"},
        {"round": 10, "venue": "Brands Hatch GP",   "date": "10 Oct 2026", "slug": "2026-brands-hatch-gp"},
    ],
}

BASE_URL = "https://btcc.net/results/race-results"
OUT_FILE = Path(__file__).parent.parent.parent / "data" / f"results{YEAR}.json"


def extract_races(page) -> list[dict]:
    """
    btcc.net results pages use a tab-based layout where race tables are in the DOM.
    From 2026 there are 4 races: Qualifying Race, Race 1, Race 2, Race 3.
    Strategy 1: find all tab links (including Qualifying Race) by href ID.
    Strategy 2 (fallback): scan all tables with 'Best' AND 'Gap' headers.
    """
    return page.evaluate("""() => {
        const extractRows = (table) =>
            Array.from(table.querySelectorAll('tr'))
                .map(tr => Array.from(tr.querySelectorAll('td, th')).map(c => c.textContent.trim()))
                .filter(r => r.length >= 4);

        // Normalise a tab label: map any variant of qualifying race to canonical form
        const normaliseLabel = (text) => {
            const t = text.trim();
            // "Qualifying Race" or "Qualifying" (when it's a race, not the session)
            // btcc.net may call it "Qualifying Race" or just "Qualifying"
            if (/^qualifying\\s+race$/i.test(t)) return 'Qualifying Race';
            if (/^qualifying$/i.test(t)) return 'Qualifying Race';
            if (/^race\\s+1$/i.test(t)) return 'Race 1';
            if (/^race\\s+2$/i.test(t)) return 'Race 2';
            if (/^race\\s+3$/i.test(t)) return 'Race 3';
            return t;
        };

        // Strategy 1: find all race tab links
        const tabLinks = Array.from(document.querySelectorAll('a[href^="#"]'))
            .filter(a => /^(qualifying(\\s+race)?|race\\s+[123])$/i.test(a.textContent.trim()));

        if (tabLinks.length >= 3) {
            const byId = [];
            for (const link of tabLinks) {
                const id = link.getAttribute('href').replace('#', '');
                const section = document.getElementById(id);
                if (!section) continue;
                const table = section.querySelector('table');
                if (!table) continue;
                byId.push({ label: normaliseLabel(link.textContent), rows: extractRows(table) });
            }
            if (byId.length >= 3) return byId;
        }

        // Strategy 2: all tables with both 'Best' and 'Gap' headers
        const raceTables = Array.from(document.querySelectorAll('table')).filter(t => {
            const firstRow = t.querySelector('tr');
            if (!firstRow) return false;
            const text = firstRow.textContent;
            return /best/i.test(text) && /gap/i.test(text);
        });

        const labels = tabLinks.length >= 3
            ? tabLinks.map(a => normaliseLabel(a.textContent))
            : ['Qualifying Race', 'Race 1', 'Race 2', 'Race 3'];

        return raceTables.map((table, i) => ({
            label: labels[i] || ('Race ' + (i + 1)),
            rows: extractRows(table),
        }));
    }""")


# BTCC points scales (position -> points)
POINTS_QUALIFYING = {1: 10, 2: 9, 3: 8, 4: 7, 5: 6, 6: 5, 7: 4, 8: 3, 9: 2, 10: 1}
POINTS_RACE       = {1: 20, 2: 17, 3: 15, 4: 13, 5: 11, 6: 10, 7: 9, 8: 8, 9: 7, 10: 6, 11: 5, 12: 4, 13: 3, 14: 2, 15: 1}


def parse_rows(rows: list[list[str]], race_label: str = "") -> list[dict]:
    """Convert raw table rows into DriverResult dicts, skipping header rows."""
    results = []
    for cells in rows:
        # Skip header rows; but keep DNF/Ret/NC rows (non-numeric positions)
        pos_raw = cells[0] if cells else ""
        is_dnf_pos = bool(re.search(r'\b(dnf|ret|dns|dsq|nc)\b', pos_raw, re.IGNORECASE))
        if not re.search(r'\d', pos_raw) and not is_dnf_pos:
            continue

        try:
            pos = 0 if is_dnf_pos else int(re.sub(r"[^\d]", "", pos_raw) or "0")
            no  = int(re.sub(r"[^\d]", "", cells[1]) or "0") if len(cells) > 1 else 0

            # Some season tables include a manufacturer/independent class column (M/I)
            # after the car number — detect and skip it.
            offset = 0
            if len(cells) > 2 and cells[2].strip() in ("M", "I"):
                offset = 1

            driver = cells[2 + offset].strip() if len(cells) > 2 + offset else ""
            team   = cells[3 + offset].strip() if len(cells) > 3 + offset else ""

            # Column formats vary by season:
            #   Short  (7 col): Pos No (CL) Driver Car Gap Best          — 2 cols after team
            #   Medium (8 col): Pos No (CL) Driver Car Laps Gap Best     — 3 cols after team
            #   Long  (10 col): Pos No (CL) Driver Team Laps Time Gap Best Pts — 5 cols after team
            cols_after_team = len(cells) - (4 + offset)
            if cols_after_team <= 2:
                # Short: no Laps, no Time
                laps_raw = "0"
                time_raw = ""
                gap_raw  = cells[4 + offset] if len(cells) > 4 + offset else ""
                best_lap = cells[5 + offset] if len(cells) > 5 + offset else ""
            elif cols_after_team == 3:
                # Medium: Laps, Gap, Best — no Time
                laps_raw = cells[4 + offset] if len(cells) > 4 + offset else "0"
                time_raw = ""
                gap_raw  = cells[5 + offset] if len(cells) > 5 + offset else ""
                best_lap = cells[6 + offset] if len(cells) > 6 + offset else ""
            else:
                # Long: Laps, Time, Gap, Best[, Pts]
                laps_raw = cells[4 + offset] if len(cells) > 4 + offset else "0"
                time_raw = cells[5 + offset] if len(cells) > 5 + offset else ""
                gap_raw  = cells[6 + offset] if len(cells) > 6 + offset else ""
                best_lap = cells[7 + offset] if len(cells) > 7 + offset else ""
                pts_col  = cells[8 + offset] if len(cells) > 8 + offset else ""
        except (IndexError, ValueError):
            continue

        if not driver:
            continue

        laps = int(re.sub(r"[^\d]", "", laps_raw) or "0")
        # Use points from the website's Pts column when present (includes FL bonuses etc.),
        # otherwise fall back to computing from position using the official BTCC scale.
        pts_table = POINTS_QUALIFYING if "qualifying" in race_label.lower() else POINTS_RACE
        try:
            points = int(re.sub(r"[^\d]", "", pts_col) or "") if pts_col.strip() else None
        except (NameError, ValueError):
            points = None
        if points is None:
            points = pts_table.get(pos, 0) if pos > 0 else 0

        results.append({
            "pos":     pos,
            "no":      no,
            "driver":  driver,
            "team":    team,
            "laps":    laps,
            "time":    "" if time_raw in ("–", "—", "-", "") else time_raw,
            "gap":     "" if gap_raw  in ("–", "—", "-", "") else gap_raw,
            "bestLap": best_lap,
            "points":  points,
        })
        print(f"      P{pos:>2}  #{no:<3}  {driver:<25}  {points} pts")

    return results


def scrape_round(page, info: dict) -> dict:
    url = f"{BASE_URL}/{info['slug']}"
    print(f"\nRound {info['round']}: {info['venue']}  →  {url}")

    try:
        page.goto(url, wait_until="networkidle", timeout=30_000)
    except PWTimeout:
        print("  TIMEOUT — skipping round")
        return {"round": info["round"], "venue": info["venue"], "date": info["date"], "races": []}

    # Give dynamic content a moment
    page.wait_for_timeout(2_000)

    raw_races = extract_races(page)
    print(f"  Found {len(raw_races)} race section(s): {[r['label'] for r in raw_races]}")

    # Build label list: include Qualifying Race if present, then Race 1/2/3
    label_map = {r["label"].strip().lower(): r for r in raw_races}
    expected = []
    if any("qualifying" in k for k in label_map):
        expected.append("Qualifying Race")
    expected += ["Race 1", "Race 2", "Race 3"]

    races = []
    for label in expected:
        section = label_map.get(label.lower())
        if section:
            print(f"  {label}: {len(section['rows'])} rows")
            results = parse_rows(section["rows"], label)
        else:
            print(f"  {label}: NOT FOUND")
            results = []
        races.append({"label": label, "results": results})

    return {
        "round": info["round"],
        "venue": info["venue"],
        "date":  info["date"],
        "races": races,
    }


def main():
    if YEAR not in ROUNDS:
        print(f"Year {YEAR} not configured in ROUNDS dict.", file=sys.stderr)
        sys.exit(1)

    output = {"season": str(YEAR), "rounds": []}

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        ctx     = browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            viewport={"width": 1280, "height": 900},
        )
        page = ctx.new_page()

        for info in ROUNDS[YEAR]:
            round_data = scrape_round(page, info)
            output["rounds"].append(round_data)

        browser.close()

    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_FILE, "w") as f:
        json.dump(output, f, indent=2)

    total_results = sum(
        len(race["results"])
        for r in output["rounds"]
        for race in r["races"]
    )
    print(f"\n✓ Wrote {len(output['rounds'])} rounds, {total_results} total results → {OUT_FILE}")


if __name__ == "__main__":
    main()
