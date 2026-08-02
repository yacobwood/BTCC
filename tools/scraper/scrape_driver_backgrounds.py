#!/usr/bin/env python3
"""
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
from pathlib import Path

from btcc_playwright import RenderedFetcher, save_mirrored_image

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
CARD_BG_RE = re.compile(r'class="[^"]*driver-card-background[^"]*"[^>]*>\s*<img[^>]*src="(/api/media/[^"]+)"')
NAME_RE = re.compile(r'<h1>([^<]+)</h1>')


def main() -> None:
    data = json.loads(DRIVERS_PATH.read_text(encoding="utf-8"))
    by_name = {d["name"]: d for d in data["drivers"]}
    matched_names = set()

    with RenderedFetcher() as fetcher:
        html, media = fetcher.get_with_media(
            DRIVERS_LISTING_URL, wait_selector="a.driver-card", scroll_through=True
        )

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
            media_url = f"https://btcc.net{bg_m.group(1)}" if bg_m else None
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
