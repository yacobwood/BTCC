#!/usr/bin/env python3
"""
scrape_team_stats.py
Fetches race/win/podium/pole/fastest-lap totals from btcc.net team pages
and writes them into data/drivers.json as totalRaces and totalWins.

btcc.net moved off WordPress entirely to a Vercel-hosted React app
(2026-07-31) and now issues a Vercel BotID JS challenge (HTTP 429) to any
request that can't execute JavaScript, so this fetches through headless
Chromium (see btcc_playwright.py) instead of plain urllib. The counter
markup also changed - stats are plain `<strong>N</strong><h3>Label</h3>`
pairs now (no more `data-end` attribute).

Run manually or call main() from scrape_tsl.py after each scrape.
"""

import json
import re
from pathlib import Path

from btcc_playwright import RenderedFetcher

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
DRIVERS_PATH = REPO_ROOT / "data" / "drivers.json"

# Current team name in drivers.json -> btcc.net slug
TEAM_SLUGS: dict[str, str] = {
    "NAPA Racing UK":                             "napa-racing-uk",
    "Team VERTU":                                 "vertu",
    "Speedworks Corolla Racing":                  "toyota-gazoo-racing-uk",
    "WSR":                                        "wsr",
    "LKQ Euro Car Parts with Power Maxed Racing": "lkq-euro-car-parts-with-power-maxed-racing",
    "Cataclean Plato Racing":                     "plato-racing",
    "Restart Racing":                             "restart-racing",
    "Laser Tools Racing with MB Motorsport":      "laser-tools-racing-with-mb-motorsport",
    "Steel Seal with Power Maxed Racing":         "motor-parts-direct-with-power-maxed-racing",
}

STAT_RE = re.compile(r'<strong>(\d+)</strong>\s*<h3>([^<]+)</h3>')
BASE_URL = "https://btcc.net/team/"


def _fetch_team_stats(fetcher: RenderedFetcher, slug: str) -> dict[str, int]:
    url = BASE_URL + slug + "/"
    html = fetcher.get(url, wait_selector=".team-summary-stats")
    return {
        m.group(2).strip().split()[0].lower(): int(m.group(1))
        for m in STAT_RE.finditer(html)
    }


def main() -> None:
    data = json.loads(DRIVERS_PATH.read_text(encoding="utf-8"))
    updated = 0

    with RenderedFetcher() as fetcher:
        for team in data["teams"]:
            name = team["name"]
            slug = TEAM_SLUGS.get(name)
            if not slug:
                continue
            try:
                stats = _fetch_team_stats(fetcher, slug)
                team["totalRaces"] = stats.get("races", team.get("totalRaces", 0))
                team["totalWins"]  = stats.get("wins",  team.get("totalWins",  0))
                print(f"  {name}: {team['totalRaces']} races, {team['totalWins']} wins")
                updated += 1
            except Exception as e:
                print(f"  WARNING: could not fetch stats for {name}: {e}")

    DRIVERS_PATH.write_text(
        json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    print(f"Updated {updated}/{len(TEAM_SLUGS)} teams in drivers.json")


if __name__ == "__main__":
    main()
