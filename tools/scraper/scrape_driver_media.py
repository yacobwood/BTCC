#!/usr/bin/env python3
"""
scrape_driver_media.py
On-demand refresh of ONE driver's headshot, car livery photo and/or car
number graphic from their own btcc.net profile page, triggered manually
from the admin panel's Scrapers tab (DRIVER MEDIA card) - not run on a
schedule.

Not a revival of the old archived scrape_driver_images.py/
scrape_driver_cutouts.py (both still sit in tools/scraper/archive/,
Playwright-based, built for the self-hosted-runner era) - this fetches via
Scrapfly instead (see scrapfly_fallback.py), matching every other
btcc.net-facing scraper since the 2026-09-01 migration, and targets all
three images in a single page fetch rather than three, since all of them
live on the same page (see the selectors below) and a rendered-JS Scrapfly
fetch isn't free.

Confirmed live 2026-09-08 (real markup copied from Daniel Lloyd's page,
https://btcc.net/driver/daniel-lloyd/):
    <img class="driver-profile-car" src="/api/media/<uuid>">      car livery
    <img class="driver-profile-cutout" src="/api/media/<uuid>">   headshot
    <img class="driver-profile-number" src="/api/media/<uuid>">   car number graphic
(numberImageUrl genuinely is rendered - DriversScreen.js's NumberBadge,
DriverDetailScreen.js and TeamDetailScreen.js all display it directly via
CachedImage with no bundled require() counterpart at all, unlike
imageUrl/carImageUrl - so a numberImages update takes effect everywhere
immediately, app included, with no release wait. An earlier version of
this docstring wrongly claimed nothing consumes this field, having
misattributed a different field's "no UI consumer yet" note from
tools/scraper/archive/README.md - corrected 2026-09-08 after actually
grepping the app source.)

Unlike the archived scripts, this does NOT invent a new filename from the
fetched image's own URL (a bare UUID, no relation to the driver at all) -
it looks up the driver's EXISTING imageUrl/carImageUrl/numberImageUrl in
data/drivers.json and overwrites that same file in place, keeping the
stable, already-referenced raw.githubusercontent.com URL unchanged. This
sidesteps real naming inconsistencies already in the data (e.g. Daniel
Rowbottom's headshot file is robottom.webp, not a mechanical slugify of his
name) - there's no way to guess those from the name alone, only from what's
already there. A driver with no existing file yet (a brand new signing)
falls back to a plain default instead (see _filename_stem) and sets the
corresponding *Url field in drivers.json for the first time - a secondary
path, not the main one this exists for. numberImages/ also differs from the
other two in format (real files confirmed 100% .png, not .webp) and in
naming (car number, not surname) - both handled per-field, not guessed.

After saving each updated headshot/car master file to data/driverImages/
or data/carImages/, shells out to the matching existing bundle/thumbnail
generator (scripts/generate_driver_bundle.py, scripts/generate_car_thumb.py)
for just that one file - reuses their existing resize/crop/webp-encode
logic rather than duplicating it, and keeps the bundled src/assets/ copies
(what the app actually renders for an established driver, in preference to
the live imageUrl/carImageUrl fields) in sync with the new master. Number
graphics have no such bundle step - there's nothing to regenerate.

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
NUMBER_IMAGES_DIR = REPO_ROOT / "data" / "numberImages"
RAW_BASE = "https://raw.githubusercontent.com/yacobwood/BTCC/main/data"
BASE_URL = "https://btcc.net/driver/"

CUTOUT_RE = re.compile(r'class="[^"]*driver-profile-cutout[^"]*"[^>]*src="(' + MEDIA_SRC_RE_FRAGMENT + r')"')
CAR_RE = re.compile(r'class="[^"]*driver-profile-car[^"]*"[^>]*src="(' + MEDIA_SRC_RE_FRAGMENT + r')"')
NUMBER_RE = re.compile(r'class="[^"]*driver-profile-number[^"]*"[^>]*src="(' + MEDIA_SRC_RE_FRAGMENT + r')"')

_DRIVERS_LISTING_REFERER = "https://btcc.net/drivers/"


def extract_media_urls(html: str) -> dict[str, str | None]:
    """Pure parse step, kept separate from any I/O so it's cheaply testable
    against a real HTML fixture. Returns absolute URLs (already resolved via
    resolve_media_url), or None for whichever selector wasn't found - a page
    genuinely missing one image type (e.g. no car photo published yet for a
    brand-new signing) isn't itself an error, only all three missing is (see
    main())."""
    cutout_m = CUTOUT_RE.search(html)
    car_m = CAR_RE.search(html)
    number_m = NUMBER_RE.search(html)
    return {
        "cutout": resolve_media_url(cutout_m.group(1)) if cutout_m else None,
        "car": resolve_media_url(car_m.group(1)) if car_m else None,
        "number": resolve_media_url(number_m.group(1)) if number_m else None,
    }


def _filename_stem(existing_url: str | None, fallback_stem: str) -> str:
    """The stem to save under: whatever file this driver's field already
    points to, so the stable public URL never changes. Only a driver with no
    existing file at all (existing_url falsy - a brand-new signing) falls
    back to fallback_stem (a slugified surname for headshot/car, the car
    number for numberImages - the caller decides which, since the two
    folders use different naming conventions), which won't match every
    existing naming quirk (double-barrelled surnames, the one known
    robottom/Rowbottom mismatch) - acceptable here since that path only ever
    produces a NEW filename, never overwrites a wrong existing one."""
    if existing_url:
        return Path(urllib.parse.urlparse(existing_url).path).stem
    return re.sub(r"[^a-z0-9]", "", fallback_stem.strip().lower())


def _save_master_image(image_bytes: bytes, dest_path: Path) -> None:
    """Writes a fetched image as a full-resolution master at dest_path, in
    whatever format dest_path's own extension implies - .webp for
    data/driverImages/ and data/carImages/ (matching every existing file
    there; the bundle/thumbnail generators below both assume a .webp
    source), .png for data/numberImages/ (confirmed live 2026-09-08: all 23
    current files there are genuinely .png, not .webp - a real, different
    convention from the other two folders, not guessed). Deliberately no
    resize here (unlike media_utils.save_mirrored_image's downscale-on-save):
    the bundle scripts do their own resizing for their own target sizes from
    whatever the master is, and downscaling twice would just compound
    quality loss for no benefit.

    Raises PIL.UnidentifiedImageError (or any other decode error) rather
    than catching it here - the caller (_process_one_image) is what needs to
    turn that into a per-image "this one failed" outcome rather than letting
    it propagate, since a single undecodable response must never take down
    processing of the OTHER image slots too (see that function's own
    docstring)."""
    from PIL import Image
    import io

    im = Image.open(io.BytesIO(image_bytes))
    fmt = "WEBP" if dest_path.suffix.lower() == ".webp" else "PNG"
    if im.mode == "P" and fmt == "WEBP":
        im = im.convert("RGBA")  # PNG handles palette mode natively; WebP doesn't like it
    dest_path.parent.mkdir(parents=True, exist_ok=True)
    if fmt == "WEBP":
        im.save(dest_path, format="WEBP", quality=90)
    else:
        im.save(dest_path, format="PNG")


def _regenerate_bundle(script_name: str, target_file: Path) -> None:
    subprocess.run(
        [sys.executable, str(REPO_ROOT / "scripts" / script_name), str(target_file)],
        check=True,
    )


def _process_one_image(
    *, kind: str, media_url: str | None, existing_url: str | None, driver_name: str,
    fallback_stem: str, fetch_label: str, images_dir: Path, ext: str, url_field_prefix: str,
    bundle_script: str | None,
) -> tuple[str, str | None]:
    """Handles one image type (headshot, car or number) fully and
    independently: fetch -> decode/save -> regenerate its own bundle (if it
    has one - number graphics don't, see bundle_script=None), right here,
    rather than deferring the regenerate step to a shared loop after every
    image type has been attempted.

    Confirmed live 2026-09-08 why this has to be fully self-contained per
    image, not steps sharing later state: Daryl De Leon's real run had his
    headshot fetch AND save succeed, but his car image's fetch reported
    Scrapfly success while returning bytes PIL couldn't decode
    (UnidentifiedImageError) - an uncaught exception there crashed the whole
    script before a shared "regenerate every saved image's bundle" loop
    ever ran, silently leaving his already-saved headshot's bundled
    src/assets/ copies stale. Catching decode failures here (in addition to
    the already-handled "fetch returned None" case) and returning a plain
    per-image outcome means every OTHER image type's own call to this
    function is entirely unaffected either way.

    Returns (status, new_url_or_None). status is one of:
      "ok"        - fetched, decoded, saved and bundle-regenerated (if
                    applicable) fine.
      "not_found" - the selector simply wasn't on the page at all (e.g. a
                    driver with no car photo published yet) - legitimate,
                    not an error, and on its own must never fail the run.
      "failed"    - the selector WAS found but something after that broke
                    (fetch failed, or fetched bytes wouldn't decode) - a
                    real failure the caller must still fail the run for,
                    even if another image type came back "ok".
    new_url_or_None is only set on "ok" when this driver had no existing URL
    for this field yet (a brand-new signing), so the caller knows to write
    it into drivers.json."""
    if not media_url:
        print(f"  WARNING: no {kind} image found for {driver_name}", file=sys.stderr)
        return "not_found", None

    fetched = fetch_image_smart(media_url, label=fetch_label)
    if not fetched:
        print(f"  WARNING: found {kind} image URL but fetch failed for {driver_name}", file=sys.stderr)
        return "failed", None

    stem = _filename_stem(existing_url, fallback_stem)
    dest = images_dir / f"{stem}.{ext}"
    try:
        _save_master_image(fetched[0], dest)
    except Exception as e:  # noqa: BLE001 - any decode/save failure here must degrade to "this image failed", never crash the whole run and take the other image types down with it
        print(f"  WARNING: found {kind} image but could not decode/save it for {driver_name} ({e})", file=sys.stderr)
        return "failed", None

    if bundle_script:
        _regenerate_bundle(bundle_script, dest)
    print(f"  {kind}: saved {dest}")
    new_url = f"{RAW_BASE}/{url_field_prefix}/{stem}.{ext}" if not existing_url else None
    return "ok", new_url


def main() -> None:
    ap = argparse.ArgumentParser(description="Refresh one driver's headshot + car photo + car number graphic from btcc.net")
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
    surname = args.driver_name.strip().split()[-1]

    headshot_status, new_image_url = _process_one_image(
        kind="headshot", media_url=media["cutout"], existing_url=drv.get("imageUrl"),
        driver_name=args.driver_name, fallback_stem=surname, fetch_label=f"{args.driver_slug}-headshot",
        images_dir=DRIVER_IMAGES_DIR, ext="webp", url_field_prefix="driverImages",
        bundle_script="generate_driver_bundle.py",
    )
    car_status, new_car_url = _process_one_image(
        kind="car", media_url=media["car"], existing_url=drv.get("carImageUrl"),
        driver_name=args.driver_name, fallback_stem=surname, fetch_label=f"{args.driver_slug}-car",
        images_dir=CAR_IMAGES_DIR, ext="webp", url_field_prefix="carImages",
        bundle_script="generate_car_thumb.py",
    )
    number_status, new_number_url = _process_one_image(
        kind="number", media_url=media["number"], existing_url=drv.get("numberImageUrl"),
        driver_name=args.driver_name, fallback_stem=str(drv.get("number", surname)),
        fetch_label=f"{args.driver_slug}-number", images_dir=NUMBER_IMAGES_DIR, ext="png",
        url_field_prefix="numberImages", bundle_script=None,  # no bundled RN asset for number graphics - always network-fetched
    )
    statuses = (headshot_status, car_status, number_status)

    if "ok" not in statuses:
        print(f"ERROR: no image updated for {args.driver_name} - check the slug is correct", file=sys.stderr)
        sys.exit(1)

    drivers_changed = False
    if new_image_url:
        drv["imageUrl"] = new_image_url
        drivers_changed = True
    if new_car_url:
        drv["carImageUrl"] = new_car_url
        drivers_changed = True
    if new_number_url:
        drv["numberImageUrl"] = new_number_url
        drivers_changed = True
    if drivers_changed:
        DRIVERS_PATH.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
        print(f"Updated {DRIVERS_PATH}")

    updated_count = statuses.count("ok")
    print(f"Done: {updated_count}/3 image(s) updated for {args.driver_name}")

    if "failed" in statuses:
        # Distinct from "not_found" (a selector legitimately absent from the
        # page, e.g. no car photo published yet for a brand-new signing) -
        # "failed" means the selector WAS there but the fetch or decode step
        # broke (confirmed live 2026-09-08 in two different ways: a fetch
        # returning None, and a fetch reporting success but returning
        # undecodable bytes - see _process_one_image's own docstring). That's
        # a real failure, not "nothing new to do", and must still exit
        # non-zero so the workflow's retry-once step actually fires - whatever
        # DID succeed above is already saved (and bundle-regenerated, for the
        # two image types that have one) regardless, and the calling
        # workflow's continue-on-error: true lets its commit step still run,
        # so nothing good is lost by still failing the run.
        sys.exit(1)


if __name__ == "__main__":
    main()
