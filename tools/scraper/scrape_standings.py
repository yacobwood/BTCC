#!/usr/bin/env python3
"""
BTCC Standings Scraper — current season (2026) only.
Renders btcc.net standings pages with Playwright (JS-rendered),
extracts driver and team standings, and writes data/standings.json.
"""

import json
import re
import sys
from datetime import date
from pathlib import Path
from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout

# 2026 season runs April–October 2026.  Do not overwrite with off-season data.
SEASON_START = date(2026, 4, 18)
SEASON_END   = date(2026, 10, 31)
CURRENT_YEAR = 2026

DRIVERS_URL = "https://btcc.net/standings/drivers/"
TEAMS_URL   = "https://btcc.net/standings/teams/"
OUT_FILE    = Path(__file__).parent.parent / "data" / "standings.json"

TABLE_SELECTOR = "#standingsShortcode table"


def scrape_page(page, url: str, label: str) -> list[dict]:
    print(f"Fetching {url} …")
    page.goto(url, wait_until="networkidle", timeout=30_000)

    try:
        page.wait_for_selector(TABLE_SELECTOR, timeout=15_000)
    except PWTimeout:
        print(f"ERROR: {label} table not found on page.", file=sys.stderr)
        return []

    rows = page.query_selector_all(f"{TABLE_SELECTOR} tbody tr")
    print(f"Found {len(rows)} rows in {label} table.")
    return rows


def scrape_drivers(page) -> list[dict]:
    rows = scrape_page(page, DRIVERS_URL, "drivers")
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

    return results


def scrape_teams(page) -> list[dict]:
    rows = scrape_page(page, TEAMS_URL, "teams")
    results = []
    for i, row in enumerate(rows):
        cells = row.query_selector_all("td")
        if len(cells) < 2:
            continue

        # Teams table: pos | team | points (wins may be in a later column)
        pos_str    = cells[0].inner_text().strip()
        team       = cells[1].inner_text().strip()
        points_str = cells[2].inner_text().strip() if len(cells) > 2 else "0"
        wins_str   = cells[4].inner_text().strip() if len(cells) > 4 else "0"

        if not team:
            continue

        pos    = int(re.sub(r"[^\d]", "", pos_str) or str(i + 1))
        points = int(re.sub(r"[^\d]", "", points_str) or "0")
        wins   = int(re.sub(r"[^\d]", "", wins_str) or "0")

        entry = {
            "pos":    pos,
            "team":   team,
            "points": points,
            "wins":   wins,
        }
        results.append(entry)
        print(f"  P{pos:>2}  {team:<30}  {points:>4} pts  {wins} wins")

    return results


def main():
    force = "--force" in sys.argv
    today = date.today()
    if not force and not (SEASON_START <= today <= SEASON_END):
        print(
            f"Outside 2026 race season ({SEASON_START} – {SEASON_END}). "
            "Skipping scrape to avoid overwriting standings.json with off-season data.\n"
            "Use --force to bypass (e.g. for a one-time historical capture).",
            file=sys.stderr,
        )
        sys.exit(0)

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        page    = browser.new_page()

        drivers = scrape_drivers(page)
        teams   = scrape_teams(page)

        browser.close()

    if not drivers:
        print("No driver standings extracted — aborting without overwriting file.", file=sys.stderr)
        sys.exit(1)

    drivers.sort(key=lambda x: x["pos"])
    teams.sort(key=lambda x: x["pos"])

    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_FILE, "w") as f:
        json.dump({"season": CURRENT_YEAR, "standings": drivers, "teams": teams}, f, indent=2)

    print(f"\nWrote season={CURRENT_YEAR}, {len(drivers)} drivers, {len(teams)} teams → {OUT_FILE}")


if __name__ == "__main__":
    main()
