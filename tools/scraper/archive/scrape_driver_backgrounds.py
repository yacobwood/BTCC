#!/usr/bin/env python3
"""
ARCHIVED 2026-08-18 - no longer run (and dropped from
.github/workflows/scrape-team-stats.yml). Driver/team card backgrounds are
now sourced from a hand-curated set at data/backgroundImages/ instead of a
live btcc.net fetch - see tools/scraper/archive/README.md. Kept for
reference only.

scrape_driver_backgrounds.py
Mirrors each currently-racing driver's own card-background graphic from
btcc.net's /drivers/ listing page into data/media/drivers/ and sets it as
that driver's own cardBgUrl in data/drivers.json.

A driver's card background used to always be derived from their team
(attachTeamDisplayFields in src/api/parsers.js: team?.cardBgUrl) - right
for most teams, but wrong wherever a driver's own card on btcc.net
differs from a simple team-wide assumption (e.g. a team page shared by
multiple sub-liveries, such as "Steel Seal with Power Maxed Racing"'s
page listing drivers with different card colours from each other).
/drivers/ shows every driver's own actual card in a single page load, so
this scrapes that directly instead of inheriting one team-wide value.
src/api/parsers.js prefers a driver-level cardBgUrl over the team-derived
one when present.

Usage:
    python scrape_driver_backgrounds.py
"""

import json
import re
import sys
from pathlib import Path

from btcc_playwright import MEDIA_SRC_RE_FRAGMENT, RenderedFetcher, resolve_media_url, save_mirrored_image

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
DRIVERS_PATH = REPO_ROOT / "data" / "drivers.json"
MEDIA_DIR = REPO_ROOT / "data" / "media" / "drivers"
MEDIA_RAW_BASE = "https://raw.githubusercontent.com/yacobwood/BTCC/main/data/media/drivers"
DRIVERS_LISTING_URL = "https://btcc.net/drivers/"

# btcc.net's display name -> drivers.json's canonical name, where they differ.
NAME_ALIASES = {
    "Nic Hamilton": "Nicolas Hamilton",
}

CARD_BLOCK_RE = re.compile(r'<a class="driver-card" href="/driver/([a-z0-9-]+)/">(.*?)</a>', re.DOTALL)
# Root-caused live 2026-08-17: driver-card backgrounds now sometimes come
# straight from a Supabase Storage signed URL instead of always going
# through the /api/media/<uuid> redirector (confirmed live - a WSR-branded
# card background embedded the Supabase URL directly) - every single driver
# card was silently failing this regex before the MEDIA_SRC_RE_FRAGMENT
# widening, even though cardBgUrl was previously populated from an older
# run when every image still used the redirector shape.
CARD_BG_RE = re.compile(r'class="[^"]*driver-card-background[^"]*"[^>]*>\s*<img[^>]*src="(' + MEDIA_SRC_RE_FRAGMENT + r')"')
NAME_RE = re.compile(r'<h1>([^<]+)</h1>')


def main() -> None:
    data = json.loads(DRIVERS_PATH.read_text(encoding="utf-8"))
    by_name = {d["name"]: d for d in data["drivers"]}
    matched_names = set()

    with RenderedFetcher() as fetcher:
        # This is the one and only network call this script makes - unlike
        # scrape_team_stats.py's discovery fetch, there's no independent
        # secondary loop to keep running without it, so a failure here is
        # fatal (fetcher.get_with_media already retries with backoff first).
        try:
            html, media = fetcher.get_with_media(
                DRIVERS_LISTING_URL, wait_selector="a.driver-card", scroll_through=True
            )
        except Exception as e:
            print(f"ERROR: could not fetch drivers listing ({e})", file=sys.stderr)
            sys.exit(1)

        updated = 0
        for block_m in CARD_BLOCK_RE.finditer(html):
            block = block_m.group(2)
            name_m = NAME_RE.search(block)
            if not name_m:
                continue
            site_name = name_m.group(1).strip()
            our_name = NAME_ALIASES.get(site_name, site_name)
            drv = by_name.get(our_name)
            if not drv:
                print(f"  WARNING: no drivers.json match for '{site_name}'")
                continue

            bg_m = CARD_BG_RE.search(block)
            media_url = resolve_media_url(bg_m.group(1)) if bg_m else None
            filename = save_mirrored_image(media, media_url, MEDIA_DIR)
            if filename:
                drv["cardBgUrl"] = f"{MEDIA_RAW_BASE}/{filename}"
                updated += 1
                matched_names.add(our_name)
                print(f"  {our_name}: background mirrored")
            else:
                print(f"  WARNING: no card background found for {our_name}")

    expected = {d["name"] for d in data["drivers"] if d.get("currentlyRacing", True)}
    missing = expected - matched_names
    if missing:
        print(f"  Not on /drivers/ (left unchanged): {', '.join(sorted(missing))}")

    DRIVERS_PATH.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Updated {updated} driver(s) in drivers.json")


if __name__ == "__main__":
    main()
