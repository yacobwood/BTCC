#!/usr/bin/env python3
"""
scrape_driver_roster.py
Weekly, unattended companion to scrape_driver_media.py (which stays
on-demand, one driver at a time, triggered from the admin panel). This
script instead:

  1. Sweeps every driver already in data/drivers.json for a changed
     headshot/car livery/car number graphic, and
  2. Discovers any driver on btcc.net's /drivers/ listing who ISN'T in
     drivers.json yet (a mid-season signing) and adds them.

Change-detection, not a blind resweep: fetching all three images for all
~27 drivers every week regardless of whether anything changed would cost
real (if small) money - an image fetch is ~225 Scrapfly credits vs. ~30 for
a plain page (see scrapfly_fallback.py's own docstrings) - and would touch
81 image files in the weekly commit diff even on a week nothing actually
changed. Instead this fetches each driver's profile page (cheap, needed
regardless to see what's currently there), compares the three images'
current btcc.net-side /api/media/<uuid> source URLs against
data/driver_media_state.json (this script's own new state cache - distinct
from drivers.json's imageUrl/carImageUrl/numberImageUrl fields, which
deliberately keep a STABLE raw.githubusercontent.com URL forever, see
scrape_driver_media._filename_stem), and only pays for the expensive image
fetch on a slot whose source URL has actually changed since last week.

Reuses scrape_driver_media.py's already-tested per-image machinery
(extract_media_urls, _process_one_image) rather than a second copy of it -
see that module's own refresh_driver_media() for the equivalent on-demand,
no-change-detection version this weekly sweep is built on top of.

New-driver discovery (_discover_roster) is ported from the archived,
Playwright-era tools/scraper/archive/scrape_driver_cutouts.py's own
_discover_slugs() - already proven against this exact page/markup shape -
swapped from RenderedFetcher to fetch_via_scrapfly to match every scraper
since the 2026-09-01 migration.

A genuinely new driver only gets name, number (read from the car number
graphic's own alt attribute - confirmed real format: alt="123", see
test_scrape_driver_media.py's DRIVER_PAGE_HTML fixture), and their three
images auto-added. team/car/class/nationality/bio/dateOfBirth/birthplace/
livesIn/cardBgUrl are deliberately left blank, not guessed - no script in
this repo (archived or current) has ever confirmed any of those fields
scrapable from btcc.net's markup, and project_new_driver_workflow's own
established process is that bio/DOB facts need WebSearch cross-referencing
against a second outlet, not mechanical extraction (a WebFetch summarizer
already hallucinated one team's own full name earlier this project). The
new entry is marked "needsReview": true so it's easy to find and finish by
hand - see that same memory's 3-file checklist for what's still needed.
It still renders correctly in the app immediately (real photo, no bio) via
the same live-imageUrl fallback path a driver added before their bundled
src/assets/ asset lands has always used - see this module's own
_create_stub_driver docstring.

One driver's page failing to fetch (existing or new) must never abort the
rest of the sweep - only a total failure to fetch the /drivers/ listing
itself is fatal, since there's no sensible partial sweep without it.

Usage:
    python scrape_driver_roster.py
"""

from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path

from scrape_driver_media import (
    CAR_IMAGES_DIR,
    DRIVER_IMAGES_DIR,
    NUMBER_IMAGES_DIR,
    BASE_URL,
    _process_one_image,
    extract_media_urls,
)
from scrapfly_fallback import fetch_via_scrapfly

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
DRIVERS_PATH = REPO_ROOT / "data" / "drivers.json"
STATE_PATH = REPO_ROOT / "data" / "driver_media_state.json"
DRIVERS_LISTING_URL = "https://btcc.net/drivers/"

# btcc.net's display name -> drivers.json's canonical name, where they
# differ - same alias this repo's archived driver scrapers already needed
# for this exact page (see archive/scrape_driver_cutouts.py).
NAME_ALIASES = {
    "Nic Hamilton": "Nicolas Hamilton",
}

CARD_BLOCK_RE = re.compile(r'<a class="driver-card" href="/driver/([a-z0-9-]+)/">(.*?)</a>', re.DOTALL)
NAME_RE = re.compile(r'<h1>([^<]+)</h1>')
# Isolates the whole <img ...driver-profile-number...> tag first, then
# pulls alt="123" out of THAT (rather than one combined regex spanning
# both attributes) so this doesn't care whether alt or src comes first in
# the tag - the same defensiveness extract_media_urls's own class-name
# regexes already use via their `[^>]*` gaps.
_NUMBER_TAG_RE = re.compile(r'<img[^>]*class="[^"]*driver-profile-number[^"]*"[^>]*>')
_ALT_NUMBER_RE = re.compile(r'alt="(\d+)"')

# (media dict key from extract_media_urls, _process_one_image's own "kind"
# label, master-image dir, file extension, drivers.json url field, bundle
# regen script or None) - one shared table so _sweep_existing_driver and
# _create_stub_driver don't each hardcode their own copy of it.
_IMAGE_SLOTS = (
    ("cutout", "headshot", DRIVER_IMAGES_DIR, "webp", "imageUrl", "driverImages", "generate_driver_bundle.py"),
    ("car", "car", CAR_IMAGES_DIR, "webp", "carImageUrl", "carImages", "generate_car_thumb.py"),
    ("number", "number", NUMBER_IMAGES_DIR, "png", "numberImageUrl", "numberImages", None),
)


def _discover_roster() -> dict[str, str]:
    """{drivers.json canonical name: btcc.net slug} for every driver
    currently on the /drivers/ listing page. Raises RuntimeError if the
    listing itself can't be fetched - unlike one driver failing later,
    there's no sensible partial sweep without this."""
    html = fetch_via_scrapfly(
        DRIVERS_LISTING_URL, render_js=True, label="drivers-listing",
        wait_for_selector="a.driver-card",
    )
    if html is None:
        raise RuntimeError(f"could not fetch {DRIVERS_LISTING_URL} (Scrapfly fetch failed)")

    roster: dict[str, str] = {}
    for block_m in CARD_BLOCK_RE.finditer(html):
        slug, block = block_m.group(1), block_m.group(2)
        name_m = NAME_RE.search(block)
        if not name_m:
            continue
        site_name = name_m.group(1).strip()
        roster[NAME_ALIASES.get(site_name, site_name)] = slug
    return roster


def extract_car_number(html: str) -> int | None:
    """Pure parse step, kept separate from any I/O so it's cheaply testable.
    Only meaningful for a brand-new driver (an existing one's number is
    already in drivers.json) - the number graphic's own alt attribute is
    the one place this repo has confirmed the car number as text anywhere
    on the page, rather than just as an (unreadable) image."""
    tag_m = _NUMBER_TAG_RE.search(html)
    if not tag_m:
        return None
    alt_m = _ALT_NUMBER_RE.search(tag_m.group(0))
    return int(alt_m.group(1)) if alt_m else None


def _sweep_existing_driver(drv: dict, slug: str, state: dict) -> tuple[str, ...] | None:
    """Change-detection refresh for one driver already in drivers.json.
    Mutates drv's own *Url fields (only when a slot actually changed) and
    state's cache for this driver in place - the caller owns writing both
    drivers.json and driver_media_state.json back to disk once, after
    every driver's been swept, not once per driver.

    Returns one status per image slot - "updated" (source URL differed
    from the cache, refetched successfully), "unchanged" (matched the
    cache, skipped - the common case most weeks), "not_found" (genuinely
    absent from the page right now) or "failed" (found a URL but the
    fetch/decode broke) - or None if the driver's own profile page failed
    to fetch at all this run (a fetch failure leaves this driver's cache
    untouched, so it's naturally retried next week rather than needing its
    own separate retry bookkeeping)."""
    url = BASE_URL + slug.strip("/") + "/"
    html = fetch_via_scrapfly(
        url, referer=DRIVERS_LISTING_URL, render_js=True, label=slug,
        wait_for_selector=".driver-profile-cutout",
    )
    if html is None:
        print(f"  WARNING: could not fetch {url} for {drv['name']} this run", file=sys.stderr)
        return None

    media = extract_media_urls(html)
    cached = state.setdefault(drv["name"], {})
    surname = drv["name"].strip().split()[-1]

    statuses = []
    for media_key, kind, images_dir, ext, url_field, url_field_prefix, bundle_script in _IMAGE_SLOTS:
        media_url = media[media_key]
        fallback_stem = str(drv.get("number", surname)) if kind == "number" else surname

        if media_url is None:
            statuses.append("not_found")
            cached.pop(media_key, None)  # nothing currently published - don't keep a stale "seen" URL around
            continue
        if cached.get(media_key) == media_url:
            statuses.append("unchanged")
            continue

        status, new_url = _process_one_image(
            kind=kind, media_url=media_url, existing_url=drv.get(url_field),
            driver_name=drv["name"], fallback_stem=fallback_stem, fetch_label=f"{slug}-{kind}",
            images_dir=images_dir, ext=ext, url_field_prefix=url_field_prefix,
            bundle_script=bundle_script,
        )
        if status == "ok":
            cached[media_key] = media_url
            if new_url:
                drv[url_field] = new_url
            statuses.append("updated")
        else:
            statuses.append(status)  # "failed" - leave the cache alone so it's retried next week too

    return tuple(statuses)


def _create_stub_driver(site_name: str, slug: str, state: dict) -> dict | None:
    """Builds a brand-new drivers.json entry for site_name (on the listing,
    but with no existing entry) - see this module's own docstring for what
    is/isn't populated and why. Returns None (does not raise) if the
    profile page fetch fails, or if a working headshot specifically can't
    be obtained (car/number legitimately being not-yet-published is fine -
    see the "not_found" tolerance below - but a driver with literally no
    photo at all is worse to add than to defer a week, and it'll simply be
    tried again next run since it's still absent from drivers.json)."""
    url = BASE_URL + slug + "/"
    print(f"New driver found on listing: {site_name} ({slug}) - fetching profile …")
    html = fetch_via_scrapfly(
        url, referer=DRIVERS_LISTING_URL, render_js=True, label=slug,
        wait_for_selector=".driver-profile-cutout",
    )
    if html is None:
        print(f"  ERROR: could not fetch {url} for new driver {site_name} - will retry next run", file=sys.stderr)
        return None

    media = extract_media_urls(html)
    number = extract_car_number(html)
    if number is None:
        print(f"  WARNING: no car number found yet for new driver {site_name} - will retry next run", file=sys.stderr)
        return None

    surname = site_name.strip().split()[-1]
    drv: dict = {
        "number": number, "name": site_name, "team": "", "car": "",
        "imageUrl": "", "nationality": "", "bio": "", "dateOfBirth": "",
        "birthplace": "", "history": [], "class": "", "livesIn": "",
        "cardBgUrl": "", "carImageUrl": "", "numberImageUrl": "",
        "needsReview": True,
    }
    cached = state.setdefault(site_name, {})
    headshot_failed = False
    for media_key, kind, images_dir, ext, url_field, url_field_prefix, bundle_script in _IMAGE_SLOTS:
        media_url = media[media_key]
        fallback_stem = str(number) if kind == "number" else surname
        status, new_url = _process_one_image(
            kind=kind, media_url=media_url, existing_url=None,
            driver_name=site_name, fallback_stem=fallback_stem, fetch_label=f"{slug}-{kind}",
            images_dir=images_dir, ext=ext, url_field_prefix=url_field_prefix,
            bundle_script=bundle_script,
        )
        if status == "ok":
            cached[media_key] = media_url
            if new_url:
                drv[url_field] = new_url
        elif status == "failed" and kind == "headshot":
            headshot_failed = True

    if headshot_failed or not drv["imageUrl"]:
        print(f"  ERROR: no working headshot for new driver {site_name} - not adding this week", file=sys.stderr)
        return None

    print(f"  {site_name}: added as new driver #{number} (needsReview=true)")
    return drv


def main() -> None:
    original_drivers_json = DRIVERS_PATH.read_text(encoding="utf-8")
    data = json.loads(original_drivers_json)
    original_state_json = STATE_PATH.read_text(encoding="utf-8") if STATE_PATH.exists() else "{}"
    state = json.loads(original_state_json)

    try:
        roster = _discover_roster()
    except RuntimeError as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)

    by_name = {d["name"]: d for d in data["drivers"]}
    updated = unchanged = not_found = failed = 0
    new_drivers: list[str] = []

    # Sorted for deterministic output/state ordering - so a week where
    # nothing actually changed re-serializes both files byte-identical to
    # what's already committed, instead of a spurious diff from dict-order
    # drift alone (see main()'s own byte-comparison write-gate below).
    for site_name, slug in sorted(roster.items()):
        drv = by_name.get(site_name)
        if drv is not None:
            statuses = _sweep_existing_driver(drv, slug, state)
            if statuses is None:
                failed += 1
                continue
            updated += statuses.count("updated")
            unchanged += statuses.count("unchanged")
            not_found += statuses.count("not_found")
            failed += statuses.count("failed")
        else:
            new_drv = _create_stub_driver(site_name, slug, state)
            if new_drv is None:
                failed += 1
                continue
            data["drivers"].append(new_drv)
            data["drivers"].sort(key=lambda d: d["number"])
            new_drivers.append(site_name)

    summary = (
        f"Driver roster sweep: {updated} image(s) updated, {unchanged} unchanged, "
        f"{not_found} not currently published, {len(new_drivers)} new driver(s) added, "
        f"{failed} driver(s) had a problem this run."
    )
    print(summary)
    if new_drivers:
        print(f"  New drivers (need manual team/car/class/bio - see project_new_driver_workflow memory): {', '.join(new_drivers)}")

    new_drivers_json = json.dumps(data, indent=2, ensure_ascii=False)
    if new_drivers_json != original_drivers_json:
        DRIVERS_PATH.write_text(new_drivers_json, encoding="utf-8")
        print(f"Updated {DRIVERS_PATH}")

    new_state_json = json.dumps(state, indent=2)
    if new_state_json != original_state_json:
        STATE_PATH.write_text(new_state_json, encoding="utf-8")
        print(f"Updated {STATE_PATH}")

    step_summary_path = os.environ.get("GITHUB_STEP_SUMMARY")
    if step_summary_path:
        with open(step_summary_path, "a", encoding="utf-8") as f:
            f.write(f"## Driver roster sweep\n\n{summary}\n")
            if new_drivers:
                f.write("\n**New drivers added as stubs (need manual team/car/class/bio):**\n\n")
                for name in new_drivers:
                    f.write(f"- {name}\n")

    # Only fail the run (and let the workflow's retry-once step fire) when
    # something broke AND nothing useful happened at all - one driver's
    # page failing among 26 others succeeding is not itself a run failure
    # (matches the per-driver isolation this whole script is built around);
    # a genuinely bad run (e.g. every fetch failing) still needs to surface
    # as red so it isn't silently missed for a week.
    if failed > 0 and updated == 0 and not new_drivers:
        sys.exit(1)


if __name__ == "__main__":
    main()
