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

Also mirrors each team's card-background graphic and car photo into
data/media/teams/ and sets them as cardBgUrl/carImageUrl, since the old
values (bespoke WordPress media-library graphics, e.g.
"Team-driver-graphics-Napa400-x-400...") point at a dead
wp-content/uploads path that now 429s the same as everything else on the
old site. Both come from a single fetch of /teams/ - the site's own team
listing page, which shows exactly the cardBgUrl+carImageUrl pairing
already rendered together as one unit (confirmed against a live
screenshot of that page). Earlier attempts guessed at a source instead
(team-feature-image - a sharp photo, wrong for a background role; then a
team's first-listed driver's own car - not necessarily the specific car
the site itself shows for that team) and got it wrong both times; /teams/
is the actual authoritative pairing, one request for all 9 teams instead
of a fetch per team.

Run manually or call main() from scrape_tsl.py after each scrape.
"""

import json
import re
from pathlib import Path

from btcc_playwright import MEDIA_SRC_RE_FRAGMENT, RenderedFetcher, resolve_media_url, save_mirrored_image

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
DRIVERS_PATH = REPO_ROOT / "data" / "drivers.json"
MEDIA_DIR = REPO_ROOT / "data" / "media" / "teams"
MEDIA_RAW_BASE = "https://raw.githubusercontent.com/yacobwood/BTCC/main/data/media/teams"
TEAMS_LISTING_URL = "https://btcc.net/teams/"

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
TEAM_CARD_BLOCK_RE = re.compile(r'<a class="team-card" href="/team/([a-z0-9-]+)/">(.*?)</a>', re.DOTALL)
# Root-caused live 2026-08-17: team-card images now sometimes come straight
# from a Supabase Storage signed URL instead of always going through the
# /api/media/<uuid> redirector - confirmed live via drivers.json already
# having a cardBgUrl from an older run (when the redirector shape still
# applied) while carImageUrl had apparently never once populated, since
# TEAM_CARD_CAR_RE's /api/media/-only pattern silently matched nothing.
TEAM_CARD_BG_RE = re.compile(r'class="[^"]*team-card-background[^"]*"[^>]*>\s*<img[^>]*src="(' + MEDIA_SRC_RE_FRAGMENT + r')"')
# Named "-logo" on the site, but it's actually the full car photo shown on the card.
TEAM_CARD_CAR_RE = re.compile(r'class="[^"]*team-card-logo[^"]*"[^>]*>\s*<img[^>]*src="(' + MEDIA_SRC_RE_FRAGMENT + r')"')
BASE_URL = "https://btcc.net/team/"


def _fetch_team_images(fetcher: RenderedFetcher) -> dict[str, tuple[str | None, str | None]]:
    """One fetch of /teams/ - return {slug: (mirrored_card_bg_url, mirrored_car_url)} for every team."""
    html, media = fetcher.get_with_media(TEAMS_LISTING_URL, wait_selector="a.team-card")

    result = {}
    for block_m in TEAM_CARD_BLOCK_RE.finditer(html):
        slug, block = block_m.group(1), block_m.group(2)

        bg_m = TEAM_CARD_BG_RE.search(block)
        bg_media_url = resolve_media_url(bg_m.group(1)) if bg_m else None
        bg_filename = save_mirrored_image(media, bg_media_url, MEDIA_DIR)
        bg_url = f"{MEDIA_RAW_BASE}/{bg_filename}" if bg_filename else None

        car_m = TEAM_CARD_CAR_RE.search(block)
        car_media_url = resolve_media_url(car_m.group(1)) if car_m else None
        car_filename = save_mirrored_image(media, car_media_url, MEDIA_DIR)
        car_url = f"{MEDIA_RAW_BASE}/{car_filename}" if car_filename else None

        result[slug] = (bg_url, car_url)

    return result


def _fetch_team_stats(fetcher: RenderedFetcher, slug: str) -> dict[str, int]:
    url = BASE_URL + slug + "/"
    html = fetcher.get(url, wait_selector=".team-summary-stats", referer=TEAMS_LISTING_URL)
    return {
        m.group(2).strip().split()[0].lower(): int(m.group(1))
        for m in STAT_RE.finditer(html)
    }


def main() -> None:
    data = json.loads(DRIVERS_PATH.read_text(encoding="utf-8"))
    updated = 0

    with RenderedFetcher() as fetcher:
        try:
            team_images = _fetch_team_images(fetcher)
        except Exception as e:
            # Degrade rather than crash: the per-team stats loop below is an
            # independently valuable data source and shouldn't be sacrificed
            # to a secondary image-mirroring failure.
            print(f"  WARNING: could not fetch team images ({e}) - continuing without background/car images this run")
            team_images = {}

        for team in data["teams"]:
            name = team["name"]
            slug = TEAM_SLUGS.get(name)
            if not slug:
                continue
            if fetcher.over_budget():
                print("  WARNING: fetch time budget exhausted - skipping remaining teams this run")
                break
            try:
                stats = _fetch_team_stats(fetcher, slug)
                team["totalRaces"] = stats.get("races", team.get("totalRaces", 0))
                team["totalWins"]  = stats.get("wins",  team.get("totalWins",  0))

                bg_url, car_url = team_images.get(slug, (None, None))
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
