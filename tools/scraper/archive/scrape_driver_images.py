#!/usr/bin/env python3
"""
ARCHIVED 2026-08-18 - no longer run. imageUrl is now sourced from a
hand-curated headshot set at data/driverImages/<number>.png instead of a
live btcc.net fetch - see tools/scraper/archive/README.md. Kept for
reference only.

scrape_driver_images.py
Mirrors a driver's cutout photo from their btcc.net profile page and sets
it as imageUrl in data/drivers.json.

DriversScreen/TeamDetailScreen/DriverDetailScreen only fall back to the
live imageUrl field when src/assets/driverImages.js's bundled asset map
has no entry for that driver's number (getDriverImage() returns null) -
established drivers are unaffected since they render from the bundle,
but a driver added mid-season before their bundled asset lands (see
project_new_driver_workflow memory) falls through to imageUrl, which
otherwise points at a dead wp-content/uploads URL (btcc.net moved off
WordPress - see project_vercel_migration memory) and shows as a broken
image.

Not run on a schedule - only needs an entry for as long as a driver
lacks a bundled asset. Remove the entry once driverImages.js has one.

Usage:
    python scrape_driver_images.py
"""

import json
import re
from pathlib import Path

from btcc_playwright import MEDIA_SRC_RE_FRAGMENT, RenderedFetcher, resolve_media_url, save_mirrored_image

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
DRIVERS_PATH = REPO_ROOT / "data" / "drivers.json"
MEDIA_DIR = REPO_ROOT / "data" / "media" / "drivers"
MEDIA_RAW_BASE = "https://raw.githubusercontent.com/yacobwood/BTCC/main/data/media/drivers"

# Driver name in drivers.json -> btcc.net driver-page slug. Only needs an
# entry for drivers not yet in src/assets/driverImages.js's bundled map.
DRIVER_SLUGS: dict[str, str] = {
    "Ryan Bensley": "ryan-bensley",
}

# Root-caused live 2026-08-17: a driver's profile cutout <img> now sometimes
# uses a direct Supabase Storage signed URL instead of the /api/media/<uuid>
# redirector - see scrape_driver_cutouts.py's own CUTOUT_RE comment, same fix.
CUTOUT_RE = re.compile(r'class="[^"]*driver-profile-cutout[^"]*"[^>]*src="(' + MEDIA_SRC_RE_FRAGMENT + r')"')
BASE_URL = "https://btcc.net/driver/"

# This script doesn't fetch the /drivers/ listing itself, but it's a real
# link relationship - scrape_driver_backgrounds.py/scrape_driver_cutouts.py
# both confirm the listing's cards link directly to /driver/<slug>/.
_DRIVERS_LISTING_REFERER = "https://btcc.net/drivers/"


def main() -> None:
    data = json.loads(DRIVERS_PATH.read_text(encoding="utf-8"))
    updated = 0

    with RenderedFetcher() as fetcher:
        for drv in data["drivers"]:
            slug = DRIVER_SLUGS.get(drv["name"])
            if not slug:
                continue
            if fetcher.over_budget():
                print("  WARNING: fetch time budget exhausted - skipping remaining drivers this run")
                break
            try:
                url = BASE_URL + slug + "/"
                html, media = fetcher.get_with_media(
                    url, wait_selector=".driver-profile-cutout", referer=_DRIVERS_LISTING_REFERER
                )
                m = CUTOUT_RE.search(html)
                media_url = resolve_media_url(m.group(1)) if m else None
                filename = save_mirrored_image(media, media_url, MEDIA_DIR)
                if filename:
                    drv["imageUrl"] = f"{MEDIA_RAW_BASE}/{filename}"
                    print(f"  {drv['name']}: image mirrored")
                    updated += 1
                else:
                    print(f"  WARNING: no cutout image found for {drv['name']}")
            except Exception as e:
                print(f"  WARNING: could not fetch image for {drv['name']}: {e}")

    DRIVERS_PATH.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Updated {updated}/{len(DRIVER_SLUGS)} driver(s) in drivers.json")


if __name__ == "__main__":
    main()
