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

YEAR = int(sys.argv[1]) if len(sys.argv) > 1 else 2024

ROUNDS = {
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
}

BASE_URL = "https://btcc.net/results/race-results"
OUT_FILE = Path(__file__).parent.parent / "data" / f"results{YEAR}.json"


def extract_races(page) -> list[dict]:
    """
    btcc.net results pages use a tab-based layout where Race 1/2/3 tables
    are all in the DOM but hidden. They are identifiable because their first
    header row contains 'Best' (practice/qualifying tables don't).
    The tab links use hrefs like #Race1, #Race2, #Race3 — use those to pair
    table order to label.
    """
    return page.evaluate("""() => {
        // Find the Race 1/2/3 tab links in order
        const tabLinks = Array.from(document.querySelectorAll('a[href*="#Race"]'))
            .filter(a => /^Race\\s+[123]$/i.test(a.textContent.trim()));

        // Find all tables whose first row header includes 'Best' (race result marker)
        const raceTables = Array.from(document.querySelectorAll('table')).filter(t => {
            const firstRow = t.querySelector('tr');
            if (!firstRow) return false;
            return /best/i.test(firstRow.textContent);
        });

        const results = [];
        // Pair by index: first race table → Race 1, etc.
        const labels = tabLinks.length >= 3
            ? tabLinks.map(a => a.textContent.trim())
            : ['Race 1', 'Race 2', 'Race 3'];

        raceTables.forEach((table, i) => {
            const label = labels[i] || ('Race ' + (i + 1));
            const rows = Array.from(table.querySelectorAll('tr')).map(tr =>
                Array.from(tr.querySelectorAll('td, th')).map(c => c.textContent.trim())
            ).filter(r => r.length >= 4);
            results.push({ label, rows });
        });

        return results;
    }""")


def parse_rows(rows: list[list[str]]) -> list[dict]:
    """Convert raw table rows into DriverResult dicts, skipping header rows."""
    results = []
    for cells in rows:
        # Skip header rows (first cell is not a number)
        pos_raw = cells[0] if cells else ""
        if not re.search(r'\d', pos_raw):
            continue

        try:
            pos      = int(re.sub(r"[^\d]", "", pos_raw) or "0")
            no       = int(re.sub(r"[^\d]", "", cells[1]) or "0") if len(cells) > 1 else 0
            driver   = cells[2].strip() if len(cells) > 2 else ""
            team     = cells[3].strip() if len(cells) > 3 else ""
            laps_raw = cells[4]          if len(cells) > 4 else "0"
            time_raw = cells[5]          if len(cells) > 5 else ""
            gap_raw  = cells[6]          if len(cells) > 6 else ""
            best_lap = cells[7]          if len(cells) > 7 else ""
            pts_raw  = cells[8]          if len(cells) > 8 else "0"
        except (IndexError, ValueError):
            continue

        if not driver:
            continue

        laps   = int(re.sub(r"[^\d]", "", laps_raw) or "0")
        points = int(re.sub(r"[^\d]", "", pts_raw) or "0")

        is_dnf = any("dnf" in str(x).lower() for x in [laps_raw, time_raw])
        if is_dnf:
            pos = 0

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

    # Ensure we always have labels Race 1/2/3 in order
    label_map = {r["label"].strip(): r for r in raw_races}
    races = []
    for label in ["Race 1", "Race 2", "Race 3"]:
        section = label_map.get(label)
        if section:
            print(f"  {label}: {len(section['rows'])} rows")
            results = parse_rows(section["rows"])
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
