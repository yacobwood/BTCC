#!/usr/bin/env python3
"""
scrape_driver_media.py
On-demand refresh of ONE driver's headshot and/or car livery photo from
their own btcc.net profile page, triggered manually from the admin panel's
Scrapers tab (DRIVER MEDIA card) - not run on a schedule.

Not a revival of the old archived scrape_driver_images.py/
scrape_driver_cutouts.py (both still sit in tools/scraper/archive/,
Playwright-based, built for the self-hosted-runner era) - this fetches via
Scrapfly instead (see scrapfly_fallback.py), matching every other
btcc.net-facing scraper since the 2026-09-01 migration, and targets BOTH
the headshot and the car livery photo in a single page fetch rather than
two, since both live on the same page (see the two selectors below) and a
rendered-JS Scrapfly fetch isn't free.

Confirmed live 2026-09-08 (real markup copied from Daniel Lloyd's page,
https://btcc.net/driver/daniel-lloyd/):
    <img class="driver-profile-car" src="/api/media/<uuid>">      car livery
    <img class="driver-profile-cutout" src="/api/media/<uuid>">   headshot
(a third, class="driver-profile-number", is the car-number graphic -
out of scope here, nothing currently consumes numberImageUrl per
tools/scraper/archive/README.md).

Unlike the archived scripts, this does NOT invent a new filename from the
fetched image's own URL (a bare UUID, no relation to the driver at all) -
it looks up the driver's EXISTING imageUrl/carImageUrl in data/drivers.json
and overwrites that same file in place, keeping the stable, already-
referenced raw.githubusercontent.com URL unchanged. This sidesteps real
naming inconsistencies already in the data (e.g. Daniel Rowbottom's file is
robottom.webp, not a mechanical slugify of his name) - there's no way to
guess those from the name alone, only from what's already there. A driver
with no existing file yet (a brand new signing) falls back to a plain
slugified-surname default instead (see _filename_stem) and sets the
corresponding *Url field in drivers.json for the first time - a secondary
path, not the main one this exists for.

After saving each updated master file to data/driverImages/ and/or
data/carImages/, shells out to the two existing bundle/thumbnail
generators (scripts/generate_driver_bundle.py, scripts/generate_car_thumb.py)
for just that one file - reuses their existing resize/crop/webp-encode
logic rather than duplicating it, and keeps the bundled src/assets/ copies
(what the app actually renders for an established driver, in preference to
the live imageUrl/carImageUrl fields) in sync with the new master.

Usage:
    python scrape_driver_media.py --driver-name "Daniel Lloyd" --driver-slug daniel-lloyd
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import urllib.parse
from pathlib import Path

from media_utils import MEDIA_SRC_RE_FRAGMENT, resolve_media_url
from scrapfly_fallback import fetch_image_smart, fetch_via_scrapfly

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
DRIVERS_PATH = REPO_ROOT / "data" / "drivers.json"
DRIVER_IMAGES_DIR = REPO_ROOT / "data" / "driverImages"
CAR_IMAGES_DIR = REPO_ROOT / "data" / "carImages"
RAW_BASE = "https://raw.githubusercontent.com/yacobwood/BTCC/main/data"
BASE_URL = "https://btcc.net/driver/"

CUTOUT_RE = re.compile(r'class="[^"]*driver-profile-cutout[^"]*"[^>]*src="(' + MEDIA_SRC_RE_FRAGMENT + r')"')
CAR_RE = re.compile(r'class="[^"]*driver-profile-car[^"]*"[^>]*src="(' + MEDIA_SRC_RE_FRAGMENT + r')"')

_DRIVERS_LISTING_REFERER = "https://btcc.net/drivers/"


def extract_media_urls(html: str) -> dict[str, str | None]:
    """Pure parse step, kept separate from any I/O so it's cheaply testable
    against a real HTML fixture. Returns absolute URLs (already resolved via
    resolve_media_url), or None for whichever selector wasn't found - a page
    genuinely missing one image type (e.g. no car photo published yet for a
    brand-new signing) isn't itself an error, only both missing is (see
    main())."""
    cutout_m = CUTOUT_RE.search(html)
    car_m = CAR_RE.search(html)
    return {
        "cutout": resolve_media_url(cutout_m.group(1)) if cutout_m else None,
        "car": resolve_media_url(car_m.group(1)) if car_m else None,
    }


def _filename_stem(existing_url: str | None, driver_name: str) -> str:
    """The stem to save under: whatever file this driver's field already
    points to, so the stable public URL never changes. Only a driver with no
    existing file at all (existing_url falsy - a brand-new signing) falls
    back to a plain slugified surname, which won't match every existing
    naming quirk (double-barrelled surnames, the one known robottom/Rowbottom
    mismatch) - acceptable here since that path only ever produces a NEW
    filename, never overwrites a wrong existing one."""
    if existing_url:
        return Path(urllib.parse.urlparse(existing_url).path).stem
    surname = driver_name.strip().split()[-1]
    return re.sub(r"[^a-z0-9]", "", surname.lower())


def _save_master_webp(image_bytes: bytes, dest_path: Path) -> None:
    """Writes a fetched image as a full-resolution .webp master at dest_path,
    matching the format every existing file in data/driverImages/ and
    data/carImages/ already uses - the bundle/thumbnail generators below both
    assume a .webp source. Deliberately no resize here (unlike
    media_utils.save_mirrored_image's downscale-on-save): both bundle
    scripts do their own resizing for their own target sizes from whatever
    the master is, and downscaling twice would just compound quality loss
    for no benefit."""
    from PIL import Image
    import io

    im = Image.open(io.BytesIO(image_bytes))
    if im.mode == "P":
        im = im.convert("RGBA")
    dest_path.parent.mkdir(parents=True, exist_ok=True)
    im.save(dest_path, format="WEBP", quality=90)


def _regenerate_bundle(script_name: str, target_file: Path) -> None:
    subprocess.run(
        [sys.executable, str(REPO_ROOT / "scripts" / script_name), str(target_file)],
        check=True,
    )


def main() -> None:
    ap = argparse.ArgumentParser(description="Refresh one driver's headshot + car photo from btcc.net")
    ap.add_argument("--driver-name", required=True, help='Exact name as it appears in drivers.json (e.g. "Daniel Lloyd")')
    ap.add_argument("--driver-slug", required=True, help="btcc.net URL slug (e.g. daniel-lloyd)")
    args = ap.parse_args()

    data = json.loads(DRIVERS_PATH.read_text(encoding="utf-8"))
    drv = next((d for d in data["drivers"] if d.get("name") == args.driver_name), None)
    if drv is None:
        print(f"ERROR: no driver named '{args.driver_name}' found in {DRIVERS_PATH}", file=sys.stderr)
        sys.exit(1)

    url = BASE_URL + args.driver_slug.strip("/") + "/"
    print(f"Fetching {url} …")
    html = fetch_via_scrapfly(url, referer=_DRIVERS_LISTING_REFERER, render_js=True, label=args.driver_slug)
    if html is None:
        print(f"ERROR: could not fetch {url} (Scrapfly fetch failed)", file=sys.stderr)
        sys.exit(1)

    media = extract_media_urls(html)
    drivers_changed = False
    updated: list[tuple[str, Path]] = []  # (script to regenerate its bundle, saved master path)
    # Distinct from "selector not on the page at all" (media["cutout"]/["car"]
    # is None - legitimately nothing there, e.g. a driver with no car photo
    # published yet) - this is "found the URL but downloading it failed",
    # which is a real, usually-transient failure (confirmed live 2026-09-08:
    # Scrapfly 422'd Daniel Lloyd's headshot fetch while his car-image fetch,
    # moments earlier, via the identical function, succeeded fine). Matches
    # this repo's own stated convention (see tools/scraper/README.md's
    # "Failure handling convention") that a scraper exits non-zero on a real
    # failure and 0 only when there was legitimately nothing new to do -
    # "one of two images updated" is NOT "nothing new to do" for the one that
    # failed, and must still exit non-zero so the workflow's retry-once step
    # actually fires instead of silently reporting a half-done run as green.
    any_fetch_failed = False

    if media["cutout"]:
        fetched = fetch_image_smart(media["cutout"], label=f"{args.driver_slug}-headshot")
        if fetched:
            stem = _filename_stem(drv.get("imageUrl"), args.driver_name)
            dest = DRIVER_IMAGES_DIR / f"{stem}.webp"
            _save_master_webp(fetched[0], dest)
            if not drv.get("imageUrl"):
                drv["imageUrl"] = f"{RAW_BASE}/driverImages/{stem}.webp"
                drivers_changed = True
            updated.append(("generate_driver_bundle.py", dest))
            print(f"  headshot: saved {dest}")
        else:
            print(f"  WARNING: found headshot image URL but fetch failed for {args.driver_name}", file=sys.stderr)
            any_fetch_failed = True
    else:
        print(f"  WARNING: no cutout image found for {args.driver_name}", file=sys.stderr)

    if media["car"]:
        fetched = fetch_image_smart(media["car"], label=f"{args.driver_slug}-car")
        if fetched:
            stem = _filename_stem(drv.get("carImageUrl"), args.driver_name)
            dest = CAR_IMAGES_DIR / f"{stem}.webp"
            _save_master_webp(fetched[0], dest)
            if not drv.get("carImageUrl"):
                drv["carImageUrl"] = f"{RAW_BASE}/carImages/{stem}.webp"
                drivers_changed = True
            updated.append(("generate_car_thumb.py", dest))
            print(f"  car image: saved {dest}")
        else:
            print(f"  WARNING: found car image URL but fetch failed for {args.driver_name}", file=sys.stderr)
            any_fetch_failed = True
    else:
        print(f"  WARNING: no car image found for {args.driver_name}", file=sys.stderr)

    if not updated:
        print(f"ERROR: neither image updated for {args.driver_name} - check the slug is correct", file=sys.stderr)
        sys.exit(1)

    if drivers_changed:
        DRIVERS_PATH.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
        print(f"Updated {DRIVERS_PATH}")

    for script_name, dest in updated:
        _regenerate_bundle(script_name, dest)

    print(f"Done: {len(updated)}/2 image(s) updated for {args.driver_name}")

    if any_fetch_failed:
        # Whatever DID succeed above is already saved (and, in the calling
        # workflow, continue-on-error: true lets the commit step still run) -
        # this just makes sure the run itself still shows red so the
        # retry-once/alert pipeline actually engages, rather than a real,
        # usually-transient fetch failure silently passing as success because
        # the other image happened to work.
        sys.exit(1)


if __name__ == "__main__":
    main()
