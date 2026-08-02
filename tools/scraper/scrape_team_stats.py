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

Also mirrors each team's card-background graphic into data/media/teams/
and sets it as cardBgUrl, since the old cardBgUrl/carImageUrl (bespoke
WordPress media-library graphics, e.g.
"Team-driver-graphics-Napa400-x-400...") point at a dead wp-content/uploads
path that now 429s the same as everything else on the old site. The new
site's team-driver-card-background image (an abstract, team-coloured
diagonal-stripe graphic - confirmed against btcc.net's own live Drivers
grid, which uses exactly this style per-team) is the right visual match
for this: cardBgUrl renders full-bleed behind a driver/car cutout, so it
needs to be a calm backdrop, not a literal photo. (team-feature-image,
a sharp photo of the team's actual cars, was tried first and looked
wrong once it started rendering - too busy for a background role.) No
equivalent per-team car cutout image exists on the new site (only
per-driver photos) - so carImageUrl is cleared to '' rather than left
pointing at a dead URL; DriversScreen/TeamDetailScreen already null-check
it before rendering.

Run manually or call main() from scrape_tsl.py after each scrape.
"""

import json
import re
from pathlib import Path

from btcc_playwright import RenderedFetcher, save_mirrored_image

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
DRIVERS_PATH = REPO_ROOT / "data" / "drivers.json"
MEDIA_DIR = REPO_ROOT / "data" / "media" / "teams"
MEDIA_RAW_BASE = "https://raw.githubusercontent.com/yacobwood/BTCC/main/data/media/teams"

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
CARD_BG_RE = re.compile(r'class="[^"]*team-driver-card-background[^"]*"[^>]*>\s*<img[^>]*src="(/api/media/[^"]+)"')
BASE_URL = "https://btcc.net/team/"


def _fetch_team_page(fetcher: RenderedFetcher, slug: str) -> tuple[dict[str, int], str | None]:
    """Return ({stat_name: value}, mirrored_image_url_or_None) for a team page."""
    url = BASE_URL + slug + "/"
    html, media = fetcher.get_with_media(url, wait_selector=".team-summary-stats")

    stats = {
        m.group(2).strip().split()[0].lower(): int(m.group(1))
        for m in STAT_RE.finditer(html)
    }

    image_m = CARD_BG_RE.search(html)
    media_url = f"https://btcc.net{image_m.group(1)}" if image_m else None
    filename = save_mirrored_image(media, media_url, MEDIA_DIR)
    image_url = f"{MEDIA_RAW_BASE}/{filename}" if filename else None

    return stats, image_url


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
                stats, image_url = _fetch_team_page(fetcher, slug)
                team["totalRaces"] = stats.get("races", team.get("totalRaces", 0))
                team["totalWins"]  = stats.get("wins",  team.get("totalWins",  0))
                if image_url:
                    team["cardBgUrl"] = image_url
                team["carImageUrl"] = ""
                print(f"  {name}: {team['totalRaces']} races, {team['totalWins']} wins"
                      + (", image mirrored" if image_url else ", no card background found"))
                updated += 1
            except Exception as e:
                print(f"  WARNING: could not fetch stats for {name}: {e}")

    DRIVERS_PATH.write_text(
        json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    print(f"Updated {updated}/{len(TEAM_SLUGS)} teams in drivers.json")


if __name__ == "__main__":
    main()
