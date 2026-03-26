#!/usr/bin/env python3
"""
Motorsport Stats Driver Summary Scraper — career highlights & statistics.
Scrapes the /summary/series/british-touring-car-championship page for each driver.

Extracts:
  - Career Highlights (championships, wins, podiums, poles, starts, fastest laps, etc.)
  - Career Statistics (detailed breakdowns with percentages and streaks)
  - Career Summary table (per-year: starts, wins, podiums, poles, FL, avg finish, etc.)

Usage:
    python scrape_driver_summary.py                      # all drivers
    python scrape_driver_summary.py --driver tom-ingram   # single driver
"""

import argparse
import json
import re
import time
from pathlib import Path
from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout

BASE_URL = "https://www.motorsportstats.com"
SERIES_SLUG = "british-touring-car-championship"
OUT_DIR = Path(__file__).resolve().parent.parent.parent / "data" / "motorsportstats"
REQUEST_DELAY = 2.0

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

# Career summary table column key
SUMMARY_COLS = ["RS", "W", "PD", "PP", "FL", "BR", "BG", "AF", "AG", "P", "DNF", "WC"]


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


def parse_summary_text(lines: list[str]) -> dict:
    """
    Parse the visible page text into structured career data.

    Highlights format (3 patterns):
      value → "/ total" → LABEL   (e.g. "0" → "/ 8" → "CHAMPIONSHIPS")
      value → LABEL               (e.g. "164" → "STARTS")

    Statistics format:
      CATEGORY (all caps) → value → label pairs, repeating

    Career Summary table:
      year → entrant → "RS W PD PP FL BR BG AF AG P DNF" (space-separated) → WDC
    """
    result = {"highlights": {}, "statistics": {}, "seasons": []}

    i = 0
    # --- CAREER HIGHLIGHTS ---
    while i < len(lines) and "CAREER HIGHLIGHTS" not in lines[i]:
        i += 1
    i += 1

    while i < len(lines) and "CAREER STATISTICS" not in lines[i]:
        line = lines[i].strip()
        num_match = re.match(r"^(\d+)$", line)
        if num_match:
            value = int(num_match.group(1))
            # Check if next line is "/ total" pattern
            if i + 2 < len(lines) and lines[i + 1].strip().startswith("/"):
                total_match = re.match(r"^/\s*(\d+)$", lines[i + 1].strip())
                total = int(total_match.group(1)) if total_match else 0
                label = lines[i + 2].strip().lower()
                result["highlights"][label] = {"value": value, "total": total}
                i += 3
                continue
            # Otherwise: value → label
            if i + 1 < len(lines) and not re.match(r"^[\d/]", lines[i + 1].strip()):
                label = lines[i + 1].strip().lower()
                result["highlights"][label] = value
                i += 2
                continue
        i += 1

    # --- CAREER STATISTICS ---
    # Advance to CAREER STATISTICS heading
    while i < len(lines) and "CAREER STATISTICS" not in lines[i]:
        i += 1
    i += 1

    current_category = None
    while i < len(lines):
        line = lines[i].strip()
        # Stop when we reach the career summary table
        if "CAREER SUMMARY" in line:
            break

        # Category heading: all caps, not a number, not a percentage
        if line.isupper() and len(line) < 30 and not re.match(r"^\d", line):
            current_category = line.lower()
            i += 1
            continue

        # Value → label pair
        val_match = re.match(r"^([\d.]+%?)$", line)
        if val_match and i + 1 < len(lines):
            next_line = lines[i + 1].strip()
            # Next line should be a label (not a number/percentage)
            if next_line and not re.match(r"^[\d.]+%?$", next_line) and not next_line.isupper():
                key = next_line.lower()
                if current_category:
                    key = f"{current_category}: {key}"
                result["statistics"][key] = val_match.group(1)
                i += 2
                continue

        i += 1

    # --- CAREER SUMMARY TABLE ---
    # Find the heading (may already be at it from the stats loop)
    while i < len(lines) and "CAREER SUMMARY" not in lines[i]:
        i += 1
    i += 1

    # Skip header labels until we hit a year
    while i < len(lines) and not re.match(r"^(19|20)\d{2}$", lines[i].strip()):
        i += 1

    while i < len(lines):
        line = lines[i].strip()

        # Stop at footer
        if any(kw in line.lower() for kw in ["go to page", "show", "key", "trending", "1 of"]):
            break

        year_match = re.match(r"^(19|20)\d{2}$", line)
        if not year_match:
            i += 1
            continue

        year = int(line)
        i += 1

        # Entrant name (non-numeric line)
        entrant = ""
        if i < len(lines) and not re.match(r"^[\d.]+", lines[i].strip()):
            entrant = lines[i].strip()
            i += 1

        # Stats line: space/tab separated numbers
        stats_line = ""
        if i < len(lines):
            stats_line = lines[i].strip()
            i += 1

        parts = re.split(r"\s+", stats_line)

        # WDC position on next line
        wdc = ""
        if i < len(lines):
            maybe_wdc = lines[i].strip()
            if re.match(r"^\d+(st|nd|rd|th)$", maybe_wdc) or maybe_wdc == "WC":
                wdc = maybe_wdc
                i += 1

        season = {"year": year, "entrant": entrant, "championshipPos": wdc}
        for j, col in enumerate(SUMMARY_COLS):
            if j < len(parts):
                try:
                    season[col] = float(parts[j]) if "." in parts[j] else int(parts[j])
                except ValueError:
                    season[col] = parts[j]

        result["seasons"].append(season)

    return result


def scrape_driver_summary(page, driver: dict) -> dict:
    """Scrape a driver's BTCC summary page."""
    slug = driver["slug"]
    url = f"{BASE_URL}/driver/{slug}/summary/series/{SERIES_SLUG}"
    print(f"\nScraping summary: {driver['name']} → {url}")

    try:
        page.goto(url, wait_until="networkidle", timeout=45_000)
    except PWTimeout:
        print(f"  TIMEOUT loading page for {driver['name']}")
        return {"name": driver["name"], "slug": slug, "error": "timeout"}

    page.wait_for_timeout(3000)
    dismiss_consent(page)
    page.wait_for_timeout(2000)

    # Extract all visible text from main content
    text = page.evaluate(
        "() => (document.querySelector('main') || document.body).innerText"
    )
    lines = [l.strip() for l in text.split("\n") if l.strip()]

    parsed = parse_summary_text(lines)

    result = {
        "name": driver["name"],
        "slug": slug,
        "url": url,
        "highlights": parsed["highlights"],
        "statistics": parsed["statistics"],
        "seasons": parsed["seasons"],
    }

    h = parsed["highlights"]
    s_count = len(parsed["seasons"])
    wins = h.get("wins", {})
    win_val = wins.get("value", wins) if isinstance(wins, dict) else wins
    print(f"  {s_count} seasons, {win_val} wins, {len(parsed['statistics'])} stat entries")

    time.sleep(REQUEST_DELAY)
    return result


def main():
    parser = argparse.ArgumentParser(description="Scrape BTCC driver summaries from motorsportstats.com")
    parser.add_argument("--driver", type=str, help="Single driver slug")
    args = parser.parse_args()

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    summaries_dir = OUT_DIR / "summaries"
    summaries_dir.mkdir(parents=True, exist_ok=True)

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

        if args.driver:
            driver = next(
                (d for d in DRIVERS if d["slug"] == args.driver),
                {"name": args.driver, "slug": args.driver},
            )
            data = scrape_driver_summary(page, driver)
            out_file = summaries_dir / f"{driver['slug']}.json"
            with open(out_file, "w") as f:
                json.dump(data, f, indent=2)
            print(f"\n✓ Wrote {out_file}")
        else:
            count = 0
            for driver in DRIVERS:
                data = scrape_driver_summary(page, driver)
                out_file = summaries_dir / f"{driver['slug']}.json"
                with open(out_file, "w") as f:
                    json.dump(data, f, indent=2)
                count += 1

            print(f"\n✓ Wrote {count} summaries")

        browser.close()

    print("\nDone.")


if __name__ == "__main__":
    main()
