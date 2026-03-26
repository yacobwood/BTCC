#!/usr/bin/env python3
"""
Motorsport Stats Scraper — historical BTCC driver & team data.
Scrapes https://www.motorsportstats.com for driver and team results.

Each race cell in the DOM contains ALL data simultaneously:
  - data-finish-position: finishing position
  - data-points: points scored
  - data-grid-position: qualifying/grid position
  - data-badge (FL/PP): fastest lap / pole position indicators

So we extract everything in a single pass per page — no need to click view tabs.

Usage:
    python scrape_motorsportstats.py                    # scrape all drivers & teams
    python scrape_motorsportstats.py --drivers-only      # drivers only
    python scrape_motorsportstats.py --teams-only        # teams only
    python scrape_motorsportstats.py --driver tom-ingram # single driver by slug
    python scrape_motorsportstats.py --team team-vertu   # single team by slug
"""

import argparse
import json
import re
import sys
import time
from pathlib import Path
from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout

BASE_URL = "https://www.motorsportstats.com"
OUT_DIR = Path(__file__).resolve().parent.parent.parent / "data" / "motorsportstats"
REQUEST_DELAY = 2.0

# Current BTCC drivers with their motorsportstats.com slugs
DRIVERS = [
    {"name": "Tom Chilton",        "slug": "tom-chilton"},
    {"name": "Aiden Moffat",       "slug": "aiden-moffat"},
    {"name": "Dexter Patterson",   "slug": "dexter-patterson"},
    {"name": "Chris Smiley",       "slug": "chris-smiley"},
    {"name": "Dan Cammish",        "slug": "dan-cammish"},
    {"name": "Daniel Rowbottom",   "slug": "daniel-rowbottom"},
    {"name": "Adam Morgan",        "slug": "adam-morgan"},
    {"name": "Árón Taylor-Smith",  "slug": "aron-taylor-smith"},
    {"name": "Tom Ingram",         "slug": "tom-ingram"},
    {"name": "Jake Hill",          "slug": "jake-hill"},
    {"name": "Ash Sutton",         "slug": "ash-sutton"},
    {"name": "Colin Turkington",   "slug": "colin-turkington"},
    {"name": "Josh Cook",          "slug": "josh-cook"},
    {"name": "Gordon Shedden",     "slug": "gordon-shedden"},
    {"name": "Rory Butcher",       "slug": "rory-butcher"},
    {"name": "Bobby Thompson",     "slug": "bobby-thompson"},
    {"name": "Dan Lloyd",          "slug": "daniel-lloyd"},
    {"name": "Tom Oliphant",       "slug": "tom-oliphant"},
    {"name": "Max Sherrin",        "slug": "max-sherrin"},
    {"name": "Nic Hamilton",       "slug": "nicolas-hamilton"},
]

TEAMS = [
    {"name": "Team VERTU",                "slug": "team-vertu"},
    {"name": "LKQ Euro Car Parts Racing", "slug": "lkq-euro-car-parts-racing"},
    {"name": "NAPA Racing UK",            "slug": "napa-racing-uk"},
    {"name": "Plato Racing",              "slug": "plato-racing"},
    {"name": "Speedworks Corolla Racing", "slug": "speedworks-motorsport"},
    {"name": "Restart Racing",            "slug": "restart-racing"},
    {"name": "Team Dynamics",             "slug": "team-dynamics"},
    {"name": "West Surrey Racing",        "slug": "west-surrey-racing"},
    {"name": "Power Maxed Racing",        "slug": "power-maxed-racing"},
    {"name": "Team HARD",                 "slug": "team-hard"},
    {"name": "BTC Racing",                "slug": "btc-racing"},
    {"name": "Ciceley Motorsport",        "slug": "ciceley-motorsport"},
]


def dismiss_consent(page):
    """Dismiss cookie/consent dialogs if present."""
    try:
        for selector in [
            "button:has-text('Consent')",
            "button:has-text('Accept')",
        ]:
            btn = page.query_selector(selector)
            if btn and btn.is_visible():
                btn.click()
                page.wait_for_timeout(1000)
                return
    except Exception:
        pass


def extract_all_tables(page) -> list[dict]:
    """
    Extract all table data from the page in a single pass.
    Each race cell contains 4 child divs:
      1. styled__Code       → venue abbreviation (e.g. "DON")
      2. data-finish-position → finishing position
      3. data-points         → points scored
      4. data-grid-position  → qualifying grid position
    FL/PP badges are inside the finish-position container as data-badge elements.
    """
    return page.evaluate("""() => {
        const tables = document.querySelectorAll('table[role="table"]');
        const allTables = [];

        for (const table of tables) {
            // Determine series name from nearest h2 heading
            let seriesName = '';
            let el = table;
            for (let i = 0; i < 10; i++) {
                el = el.parentElement;
                if (!el) break;
                const h2 = el.querySelector('h2');
                if (h2) {
                    seriesName = h2.textContent.trim();
                    break;
                }
            }

            // Skip non-series tables (Chassis, Engine, etc.)
            if (/chassis|engine/i.test(seriesName)) continue;

            // Get headers
            const thead = table.querySelector('thead');
            const headers = [];
            if (thead) {
                const ths = thead.querySelectorAll('th');
                for (const th of ths) {
                    headers.push(th.textContent.trim());
                }
            }

            // Get data rows
            const tbody = table.querySelector('tbody');
            if (!tbody) continue;
            const trs = tbody.querySelectorAll('tr');
            const rows = [];

            for (const tr of trs) {
                const cells = tr.querySelectorAll('td');
                if (cells.length < 3) continue;

                // Cell 0: Year
                const yearEl = cells[0];
                const yearText = yearEl.textContent.trim();
                const yearMatch = yearText.match(/(\d{4})/);
                if (!yearMatch) continue;
                const year = parseInt(yearMatch[1]);

                // Cell 1: Entrant/Team
                const entrant = cells[1].textContent.trim();

                // Race cells: cells[2] through cells[cells.length - 3]
                // Last 2 cells: PTS total and WDC position
                const races = [];
                const raceEnd = cells.length - 2;

                for (let i = 2; i < raceEnd; i++) {
                    const cell = cells[i];
                    const children = cell.children;

                    // Extract structured data from child divs
                    let venue = '';
                    let finishPos = '';
                    let points = '';
                    let gridPos = '';
                    let flags = [];

                    for (const child of children) {
                        const text = child.textContent.trim();

                        if (child.className.includes('Code')) {
                            venue = text;
                        } else if (child.hasAttribute('data-finish-position')) {
                            // Position text may include FL/PP badge text
                            const posDiv = child.querySelector('[class*="Position-sc"]');
                            finishPos = posDiv ? posDiv.textContent.trim() : '';
                            // Check for badges
                            const badges = child.querySelectorAll('[data-badge]');
                            for (const badge of badges) {
                                flags.push(badge.textContent.trim());
                            }
                            // Fallback: if no posDiv, extract number from text
                            if (!finishPos) {
                                const numMatch = text.match(/(\d+|DNF|DNS|DSQ|NC|Ret)/i);
                                finishPos = numMatch ? numMatch[1] : text;
                            }
                        } else if (child.hasAttribute('data-points')) {
                            const posDiv = child.querySelector('[class*="Position-sc"]');
                            points = posDiv ? posDiv.textContent.trim() : text;
                        } else if (child.hasAttribute('data-grid-position')) {
                            gridPos = text;
                        }
                    }

                    races.push({
                        venue: venue,
                        pos: finishPos,
                        pts: points,
                        grid: gridPos,
                        flags: flags,
                    });
                }

                // Total points (second-to-last cell)
                const ptsCell = cells[cells.length - 2];
                const totalPts = ptsCell.textContent.trim();

                // Championship position (last cell)
                const wdcCell = cells[cells.length - 1];
                const champPos = wdcCell.textContent.trim();

                rows.push({
                    year: year,
                    entrant: entrant,
                    races: races,
                    totalPoints: totalPts,
                    championshipPos: champPos,
                });
            }

            allTables.push({
                series: seriesName,
                headers: headers,
                seasons: rows,
            });
        }

        return allTables;
    }""")


def scrape_entity(page, entity_type: str, entity: dict) -> dict:
    """Scrape a driver or team results page."""
    slug = entity["slug"]
    url = f"{BASE_URL}/{entity_type}/{slug}/results"
    print(f"\nScraping {entity_type}: {entity['name']} → {url}")

    try:
        page.goto(url, wait_until="networkidle", timeout=45_000)
    except PWTimeout:
        print(f"  TIMEOUT loading page for {entity['name']}")
        return {"name": entity["name"], "slug": slug, "error": "timeout"}

    page.wait_for_timeout(3000)
    dismiss_consent(page)
    page.wait_for_timeout(2000)

    tables = extract_all_tables(page)

    result = {
        "name": entity["name"],
        "slug": slug,
        "url": url,
        "series": [],
    }

    for table in tables:
        series_name = table["series"]
        seasons = table["seasons"]
        print(f"  {series_name}: {len(seasons)} season(s)")

        for season in seasons:
            race_count = len(season["races"])
            print(f"    {season['year']}: {season['entrant']}, "
                  f"{race_count} races, {season['totalPoints']} pts, "
                  f"{season['championshipPos']}")

        result["series"].append({
            "name": series_name,
            "seasons": seasons,
        })

    time.sleep(REQUEST_DELAY)
    return result


def main():
    parser = argparse.ArgumentParser(description="Scrape BTCC data from motorsportstats.com")
    parser.add_argument("--drivers-only", action="store_true")
    parser.add_argument("--teams-only", action="store_true")
    parser.add_argument("--driver", type=str, help="Single driver slug")
    parser.add_argument("--team", type=str, help="Single team slug")
    args = parser.parse_args()

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    drivers_dir = OUT_DIR / "drivers"
    teams_dir = OUT_DIR / "teams"
    drivers_dir.mkdir(parents=True, exist_ok=True)
    teams_dir.mkdir(parents=True, exist_ok=True)

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        ctx = browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            ),
            viewport={"width": 1280, "height": 900},
        )
        page = ctx.new_page()

        if not args.teams_only:
            if args.driver:
                driver = next(
                    (d for d in DRIVERS if d["slug"] == args.driver),
                    {"name": args.driver, "slug": args.driver},
                )
                data = scrape_entity(page, "driver", driver)
                out_file = drivers_dir / f"{driver['slug']}.json"
                with open(out_file, "w") as f:
                    json.dump(data, f, indent=2)
                print(f"\n✓ Wrote {out_file}")
            elif not args.team:
                count = 0
                for driver in DRIVERS:
                    data = scrape_entity(page, "driver", driver)
                    out_file = drivers_dir / f"{driver['slug']}.json"
                    with open(out_file, "w") as f:
                        json.dump(data, f, indent=2)
                    count += 1
                print(f"\n✓ Wrote {count} drivers")

        if not args.drivers_only:
            if args.team:
                team = next(
                    (t for t in TEAMS if t["slug"] == args.team),
                    {"name": args.team, "slug": args.team},
                )
                data = scrape_entity(page, "team", team)
                out_file = teams_dir / f"{team['slug']}.json"
                with open(out_file, "w") as f:
                    json.dump(data, f, indent=2)
                print(f"\n✓ Wrote {out_file}")
            elif not args.driver:
                count = 0
                for team in TEAMS:
                    data = scrape_entity(page, "team", team)
                    out_file = teams_dir / f"{team['slug']}.json"
                    with open(out_file, "w") as f:
                        json.dump(data, f, indent=2)
                    count += 1
                print(f"\n✓ Wrote {count} teams")

        browser.close()

    print("\nDone.")


if __name__ == "__main__":
    main()
