#!/usr/bin/env python3
"""
scrape_team_stats.py
Fetches race/win/podium/pole/fastest-lap totals from btcc.net team pages
and writes them into data/drivers.json as totalRaces and totalWins.

Run manually or call main() from scrape_tsl.py after each scrape.
"""

import json
import re
import time
import urllib.request
from pathlib import Path

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

STAT_RE = re.compile(r'data-end="(\d+)"[^>]*>.*?<h3[^>]*>([^<]+)', re.DOTALL)
HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; BTCCHub/1.0)"}
BASE_URL = "https://btcc.net/team/"


def _fetch_team_stats(slug: str) -> dict[str, int]:
    url = BASE_URL + slug + "/"
    req = urllib.request.Request(url, headers=HEADERS)
    html = urllib.request.urlopen(req, timeout=15).read().decode("utf-8")
    return {
        m.group(2).strip().split()[0].lower(): int(m.group(1))
        for m in STAT_RE.finditer(html)
    }


def main() -> None:
    data = json.loads(DRIVERS_PATH.read_text(encoding="utf-8"))
    updated = 0

    for team in data["teams"]:
        name = team["name"]
        slug = TEAM_SLUGS.get(name)
        if not slug:
            continue
        try:
            stats = _fetch_team_stats(slug)
            team["totalRaces"] = stats.get("races", team.get("totalRaces", 0))
            team["totalWins"]  = stats.get("wins",  team.get("totalWins",  0))
            print(f"  {name}: {team['totalRaces']} races, {team['totalWins']} wins")
            updated += 1
            time.sleep(0.5)
        except Exception as e:
            print(f"  WARNING: could not fetch stats for {name}: {e}")

    DRIVERS_PATH.write_text(
        json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    print(f"Updated {updated}/{len(TEAM_SLUGS)} teams in drivers.json")


if __name__ == "__main__":
    main()
