#!/usr/bin/env python3
"""
BTCC Grid Scraper — driver names and car numbers from btcc.net/drivers/.
Writes data/grid_scraped.json. With --merge, updates data/drivers.json:
  - existing driver by name: update number (and optionally team/car if present)
  - new driver: append minimal entry (name, number, team TBC, car TBC, empty history).
"""

import argparse
import json
import re
import sys
from pathlib import Path

try:
    from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout
except ImportError:
    print("Install playwright: pip install playwright && playwright install chromium", file=sys.stderr)
    sys.exit(1)

DRIVERS_URL = "https://btcc.net/drivers/"
DATA_DIR = Path(__file__).resolve().parent.parent / "data"
GRID_JSON = DATA_DIR / "grid_scraped.json"
DRIVERS_JSON = DATA_DIR / "drivers.json"


def scrape_drivers(page) -> list[dict]:
    """Extract {name, number} from btcc.net/drivers/."""
    print(f"Fetching {DRIVERS_URL} …")
    page.goto(DRIVERS_URL, wait_until="networkidle", timeout=30_000)
    page.wait_for_timeout(2_000)

    # Page structure: driver names as headings, car number in a link or nearby
    # e.g. "Jake Hill" with "1" or "#1" — we'll get all driver links and parse
    # Page structure: <a href="/driver/slug/"><div>NUMBER</div><img>...<h3>NAME</h3></a>
    entries = page.evaluate("""() => {
        const out = [];
        const links = document.querySelectorAll('a[href*="/driver/"]');
        links.forEach(a => {
            const h3 = a.querySelector('h3, h2, h4');
            const numDiv = [...a.querySelectorAll('div')].find(d => /^\\d+$/.test(d.textContent.trim()));
            if (h3 && numDiv) {
                out.push({ name: h3.textContent.trim(), number: parseInt(numDiv.textContent.trim(), 10) });
            }
        });
        const seen = new Set();
        return out.filter(x => { if (seen.has(x.name)) return false; seen.add(x.name); return true; });
    }""")

    return entries or []


def scrape_drivers_alt(page) -> list[dict]:
    """Alternative: query all text and look for "Name" followed by number in links."""
    page.goto(DRIVERS_URL, wait_until="networkidle", timeout=30_000)
    page.wait_for_timeout(2_000)

    # Get rows/cards: often structure is [number link] [name] or [name] [number]
    rows = page.query_selector_all("a[href*='/driver/']")
    out = []
    for a in rows:
        parent = a.evaluate_handle("el => el.closest('div, li, article)").as_element()
        if not parent:
            continue
        text = parent.inner_text()
        # Extract number from link if it's just a number
        link_text = a.inner_text().strip()
        num = None
        if re.match(r"^\d+$", link_text):
            num = int(link_text)
        # First line that's a full name (two words, not just a number)
        lines = [l.strip() for l in text.splitlines() if l.strip()]
        name = None
        for line in lines:
            if line == link_text:
                continue
            if re.match(r"^[A-Za-z].*[A-Za-z]$", line) and " " in line or len(line) > 4:
                name = line
                break
        if name and num is not None:
            out.append({"name": name, "number": num})
    return out


def main():
    ap = argparse.ArgumentParser(description="Scrape BTCC grid from btcc.net/drivers/")
    ap.add_argument("--merge", action="store_true", help="Merge into data/drivers.json (add new, update numbers)")
    args = ap.parse_args()

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        page = browser.new_page()
        grid = scrape_drivers(page)
        if not grid:
            grid = scrape_drivers_alt(page)
        browser.close()

    if not grid:
        print("No drivers scraped — check btcc.net/drivers/ structure.", file=sys.stderr)
        sys.exit(1)

    # Sort by number
    grid.sort(key=lambda x: (x["number"], x["name"]))
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with open(GRID_JSON, "w") as f:
        json.dump({"drivers": grid}, f, indent=2)
    print(f"Scraped {len(grid)} drivers → {GRID_JSON}")
    for g in grid:
        print(f"  #{g['number']:<3}  {g['name']}")

    if not args.merge or not DRIVERS_JSON.exists():
        return

    with open(DRIVERS_JSON) as f:
        data = json.load(f)
    drivers = data.get("drivers", [])
    name_to_idx = {d["name"]: i for i, d in enumerate(drivers)}
    scraped_by_name = {g["name"]: g["number"] for g in grid}

    updated = 0
    added = 0
    for name, number in scraped_by_name.items():
        if name in name_to_idx:
            idx = name_to_idx[name]
            if drivers[idx].get("number") != number:
                drivers[idx]["number"] = number
                updated += 1
        else:
            drivers.append({
                "number": number,
                "name": name,
                "team": "TBC",
                "car": "TBC",
                "imageUrl": "",
                "nationality": "",
                "bio": "",
                "history": [],
                "dateOfBirth": "",
                "birthplace": "",
            })
            added += 1

    with open(DRIVERS_JSON, "w") as f:
        json.dump(data, f, indent=2)
    print(f"\nMerged into {DRIVERS_JSON}: {updated} updated, {added} added.")


if __name__ == "__main__":
    main()
