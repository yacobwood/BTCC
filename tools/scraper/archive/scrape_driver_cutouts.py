#!/usr/bin/env python3
"""
ARCHIVED 2026-08-18 - no longer run. The bundled cutout set is now
refreshed by hand from a hand-curated headshot set at
data/driverImages/<number>.png instead of a live btcc.net fetch - see
tools/scraper/archive/README.md. Kept for reference only.

scrape_driver_cutouts.py
Refreshes each currently-racing driver's bundled cutout photo in
src/assets/driver_images/<number>.webp from their btcc.net profile page.

Most drivers' cutout photos are bundled directly into the app (see
src/assets/driverImages.js, getDriverImage()) rather than fetched live -
this keeps grid/detail screens instant and sidesteps the dead
wp-content/uploads imageUrl fallback entirely (see scrape_driver_images.py,
which only covers a driver newly signed mid-season before they get a
bundled asset). When btcc.net publishes an updated photo for an existing
driver, the bundled .webp goes stale until it's re-scraped - this does
that for every driver already in driverImages.js's bundled map.

Discovers each driver's btcc.net slug from the /drivers/ listing page
(same mechanism as scrape_driver_backgrounds.py, by matching each card's
name rather than a hardcoded slug map) so it doesn't need updating when
the roster changes, then visits each driver's own page for their profile
cutout (same .driver-profile-cutout selector scrape_driver_images.py
uses) and converts it to .webp via Pillow, resized to fit the existing
~300x450 bundled convention, to match the current bundle format/size.

Only touches drivers already in driverImages.js's bundled map - a driver
without one yet (e.g. Ryan Bensley) still relies on scrape_driver_images.py's
imageUrl fallback until they get a bundled entry added manually.

Usage:
    python scrape_driver_cutouts.py
"""

import io
import json
import re
import sys
from pathlib import Path

from PIL import Image

from btcc_playwright import MEDIA_SRC_RE_FRAGMENT, RenderedFetcher, resolve_media_url

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
DRIVERS_PATH = REPO_ROOT / "data" / "drivers.json"
IMAGES_DIR = REPO_ROOT / "src" / "assets" / "driver_images"
DRIVERS_LISTING_URL = "https://btcc.net/drivers/"
BASE_URL = "https://btcc.net/driver/"
TARGET_SIZE = (300, 450)

# btcc.net's display name -> drivers.json's canonical name, where they differ.
NAME_ALIASES = {
    "Nic Hamilton": "Nicolas Hamilton",
}

CARD_BLOCK_RE = re.compile(r'<a class="driver-card" href="/driver/([a-z0-9-]+)/">(.*?)</a>', re.DOTALL)
NAME_RE = re.compile(r'<h1>([^<]+)</h1>')
# Root-caused live 2026-08-17: a driver's profile cutout <img> now sometimes
# uses a direct Supabase Storage signed URL instead of the /api/media/<uuid>
# redirector - confirmed live (tom-ingram's cutout uses the Supabase shape
# directly, even though /api/media/ URLs still appear elsewhere on the same
# page for other images).
CUTOUT_RE = re.compile(r'class="[^"]*driver-profile-cutout[^"]*"[^>]*src="(' + MEDIA_SRC_RE_FRAGMENT + r')"')


def _discover_slugs(fetcher: RenderedFetcher) -> dict[str, str]:
    """{drivers.json name: btcc.net slug} for every driver on the /drivers/ listing."""
    html, _ = fetcher.get_with_media(DRIVERS_LISTING_URL, wait_selector="a.driver-card", scroll_through=True)
    slugs = {}
    for block_m in CARD_BLOCK_RE.finditer(html):
        slug, block = block_m.group(1), block_m.group(2)
        name_m = NAME_RE.search(block)
        if not name_m:
            continue
        site_name = name_m.group(1).strip()
        slugs[NAME_ALIASES.get(site_name, site_name)] = slug
    return slugs


def main() -> None:
    data = json.loads(DRIVERS_PATH.read_text(encoding="utf-8"))
    bundled_numbers = {int(p.stem) for p in IMAGES_DIR.glob("*.webp")}

    with RenderedFetcher() as fetcher:
        try:
            slugs = _discover_slugs(fetcher)
        except Exception as e:
            print(f"ERROR: could not fetch drivers listing ({e})", file=sys.stderr)
            sys.exit(1)

        updated = 0
        for drv in data["drivers"]:
            number = drv.get("number")
            if number not in bundled_numbers:
                continue
            slug = slugs.get(drv["name"])
            if not slug:
                print(f"  WARNING: no /drivers/ listing match for {drv['name']}, skipping")
                continue
            if fetcher.over_budget():
                print("  WARNING: fetch time budget exhausted - skipping remaining drivers this run")
                break
            try:
                url = BASE_URL + slug + "/"
                html, media = fetcher.get_with_media(
                    url, wait_selector=".driver-profile-cutout", referer=DRIVERS_LISTING_URL
                )
                m = CUTOUT_RE.search(html)
                if not m:
                    print(f"  WARNING: no cutout found for {drv['name']}")
                    continue
                media_url = resolve_media_url(m.group(1))
                entry = media.get(media_url)
                if not entry:
                    print(f"  WARNING: cutout image not captured for {drv['name']}")
                    continue
                body, _content_type = entry
                img = Image.open(io.BytesIO(body)).convert("RGBA")
                img.thumbnail(TARGET_SIZE, Image.LANCZOS)
                img.save(IMAGES_DIR / f"{number}.webp", "WEBP")
                print(f"  {drv['name']}: cutout refreshed ({img.size[0]}x{img.size[1]})")
                updated += 1
            except Exception as e:
                print(f"  WARNING: could not fetch cutout for {drv['name']}: {e}")

    print(f"Updated {updated}/{len(bundled_numbers)} bundled driver cutout(s)")


if __name__ == "__main__":
    main()
