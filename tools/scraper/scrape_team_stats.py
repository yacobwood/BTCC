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
wrong once it started rendering - too busy for a background role.)

carImageUrl (a transparent-background cutout of the actual car, shown
resizeMode="contain" over cardBgUrl) is filled from that same team's
first-listed driver's own profile page (driver-profile-car) - there's no
per-team car cutout on the new site, only per-driver ones (each car's
livery has that driver's name/number painted on it), but that matches
how the old data worked too (carImageUrl was already always one specific
driver's car, e.g. "sutton-2.png", "Ingram-2.png"). The driver slug is
read straight off the team page's own driver-card links, not a separate
lookup table, so this needs no driver-specific maintenance.

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
DRIVER_BASE_URL = "https://btcc.net/driver/"

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
FIRST_DRIVER_RE = re.compile(r'<a class="team-driver-card" href="/driver/([a-z0-9-]+)/"')
CAR_IMAGE_RE = re.compile(r'class="[^"]*driver-profile-car[^"]*"[^>]*src="(/api/media/[^"]+)"')
BASE_URL = "https://btcc.net/team/"


def _fetch_team_page(fetcher: RenderedFetcher, slug: str) -> tuple[dict[str, int], str | None, str | None]:
    """Return ({stat_name: value}, mirrored_card_bg_url, mirrored_car_url) for a team page."""
    url = BASE_URL + slug + "/"
    html, media = fetcher.get_with_media(url, wait_selector=".team-summary-stats")

    stats = {
        m.group(2).strip().split()[0].lower(): int(m.group(1))
        for m in STAT_RE.finditer(html)
    }

    bg_m = CARD_BG_RE.search(html)
    bg_media_url = f"https://btcc.net{bg_m.group(1)}" if bg_m else None
    bg_filename = save_mirrored_image(media, bg_media_url, MEDIA_DIR)
    bg_url = f"{MEDIA_RAW_BASE}/{bg_filename}" if bg_filename else None

    car_url = None
    driver_m = FIRST_DRIVER_RE.search(html)
    if driver_m:
        driver_url = DRIVER_BASE_URL + driver_m.group(1) + "/"
        driver_html, driver_media = fetcher.get_with_media(driver_url, wait_selector=".driver-profile-cutout")
        car_m = CAR_IMAGE_RE.search(driver_html)
        car_media_url = f"https://btcc.net{car_m.group(1)}" if car_m else None
        car_filename = save_mirrored_image(driver_media, car_media_url, MEDIA_DIR)
        car_url = f"{MEDIA_RAW_BASE}/{car_filename}" if car_filename else None

    return stats, bg_url, car_url


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
                stats, bg_url, car_url = _fetch_team_page(fetcher, slug)
                team["totalRaces"] = stats.get("races", team.get("totalRaces", 0))
                team["totalWins"]  = stats.get("wins",  team.get("totalWins",  0))
                if bg_url:
                    team["cardBgUrl"] = bg_url
                team["carImageUrl"] = car_url or ""
                print(f"  {name}: {team['totalRaces']} races, {team['totalWins']} wins"
                      + (", background mirrored" if bg_url else ", no card background found")
                      + (", car image mirrored" if car_url else ", no car image found"))
                updated += 1
            except Exception as e:
                print(f"  WARNING: could not fetch stats for {name}: {e}")

    DRIVERS_PATH.write_text(
        json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    print(f"Updated {updated}/{len(TEAM_SLUGS)} teams in drivers.json")


if __name__ == "__main__":
    main()
