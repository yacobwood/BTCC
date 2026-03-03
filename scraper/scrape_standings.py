#!/usr/bin/env python3
"""
BTCC Driver Standings Scraper
Renders btcc.net/standings/drivers/ with Playwright (JS-rendered page),
extracts driver standings from the easy-table inside #standingsShortcode,
and writes data/standings.json.
"""

import json
import re
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout

STANDINGS_URL = "https://btcc.net/standings/drivers/"
OUT_FILE = Path(__file__).parent.parent / "data" / "standings.json"

TABLE_SELECTOR = "#standingsShortcode table"


def scrape() -> list[dict]:
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        page = browser.new_page()

        print(f"Fetching {STANDINGS_URL} …")
        page.goto(STANDINGS_URL, wait_until="networkidle", timeout=30_000)

        try:
            page.wait_for_selector(TABLE_SELECTOR, timeout=15_000)
        except PWTimeout:
            print("ERROR: Standings table not found on page.", file=sys.stderr)
            browser.close()
            return []

        rows = page.query_selector_all(f"{TABLE_SELECTOR} tbody tr")
        print(f"Found {len(rows)} rows in standings table.")

        results = []
        for row in rows:
            cells = row.query_selector_all("td")
            if len(cells) < 5:
                continue

            pos_str    = cells[0].inner_text().strip()
            car_no_str = cells[1].inner_text().strip()
            driver     = cells[2].inner_text().strip().removeprefix("Private: ")
            cls        = cells[3].inner_text().strip()
            points_str = cells[4].inner_text().strip()
            wins_str   = cells[6].inner_text().strip() if len(cells) > 6 else "0"

            if not driver:
                continue

            pos    = int(re.sub(r"[^\d]", "", pos_str) or "0")
            points = int(re.sub(r"[^\d]", "", points_str) or "0")
            wins   = int(re.sub(r"[^\d]", "", wins_str) or "0")

            entry = {
                "pos":    pos,
                "driver": driver,
                "car":    car_no_str,
                "class":  cls,
                "points": points,
                "wins":   wins,
            }
            results.append(entry)
            print(f"  P{pos:>2}  {driver:<25}  {points:>4} pts  {wins} wins")

        browser.close()
        return results


def main():
    standings = scrape()

    if not standings:
        print("No standings data extracted — aborting without overwriting file.", file=sys.stderr)
        sys.exit(1)

    standings.sort(key=lambda x: x["pos"])

    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_FILE, "w") as f:
        json.dump({"standings": standings}, f, indent=2)

    print(f"\nWrote {len(standings)} entries → {OUT_FILE}")


if __name__ == "__main__":
    main()
