#!/usr/bin/env python3
"""
scrape_circuit_images.py
Mirrors each circuit's hero photo from its btcc.net circuit page and sets
it as imageUrl in data/tracks.json. On-demand only, triggered from the
admin panel's Scrapers tab (CIRCUIT IMAGES card) - no schedule, circuit
hero photos change about as rarely as a driver signing, no sensible
cadence to poll on.

data/tracks.json's imageUrl fields still point at the old WordPress
wp-content/gallery URLs (btcc.net moved off WordPress - see
project_vercel_migration memory) and show as a broken image in
TrackDetailScreen's hero (src/screens/TrackDetailScreen.js). The new site
serves this image from a private Supabase Storage bucket behind a
per-request signed URL that expires within the hour, via btcc.net's own
stable /api/media/<uuid> redirector - same mechanism the now-archived
scrape_driver_images.py (tools/scraper/archive/) used to mirror, just a
different page/selector.

layoutImageUrl and raceImages are NOT handled here: every current track has
a bundled SVG in BUNDLED_TRACK_LAYOUTS that takes priority, and the
photoCarousel/raceImages render case is never actually reached (nothing
pushes it into TrackDetailScreen's item list) - both are dead code paths
regardless of URL validity, so there's nothing to fix there.

Brands Hatch GP is skipped - its imageUrl already points at images.msv.com
(the circuit's own site, unrelated to btcc.net) and still resolves.

Migrated 2026-09-09 from btcc_playwright.RenderedFetcher (self-hosted-
runner era) to Scrapfly - this was the last scraper still on the old path,
and building it a brand-new GitHub Actions workflow made no sense while
still depending on a self-hosted runner every other scraper deliberately
moved off (see project_scrapfly_full_migration memory). Modeled directly
on scrape_team_stats.py's own shape (the closest existing analog: loop
over a fixed venue/team -> slug dict, no CLI args, one page fetch each,
raise on a failed fetch, sys.exit(1) if every fetch that came back OK
still found nothing - a real structure change, not just one team/track's
bad luck). fetch_image_smart replaces RenderedFetcher's free "capture
every image the page loads" media dict with one on-demand paid fetch per
hero image found - save_mirrored_image already accepts exactly this shape
(a single {media_url: (bytes, content_type)} dict), no changes needed
there. The RenderedFetcher-era over_budget() self-imposed time check is
dropped entirely along with it - no Scrapfly-era scraper has an
equivalent, GitHub Actions' own job-level timeout-minutes is the
centralized safety net instead now that this runs on ubuntu-latest, not a
shared self-hosted machine with real wall-clock contention against other
scrapers.

Usage:
    python scrape_circuit_images.py
"""

import re
import sys
import json
from pathlib import Path

from media_utils import resolve_media_url, save_mirrored_image
from scrapfly_fallback import fetch_image_smart, fetch_via_scrapfly

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
TRACKS_PATH = REPO_ROOT / "data" / "tracks.json"
MEDIA_DIR = REPO_ROOT / "data" / "media" / "tracks"
MEDIA_RAW_BASE = "https://raw.githubusercontent.com/yacobwood/BTCC/main/data/media/tracks"

# tracks.json key -> btcc.net circuit-page slug. Donington's two layouts
# share one physical venue/page; Brands Hatch GP is omitted (see module
# docstring - its current imageUrl already works, no page needed).
TRACK_SLUGS: dict[str, str] = {
    "Donington Park": "donington-park",
    "Donington Park GP": "donington-park",
    "Brands Hatch Indy": "brands-hatch-indy",
    "Snetterton": "snetterton",
    "Oulton Park": "oulton-park",
    "Thruxton": "thruxton",
    "Knockhill": "knockhill",
    "Croft": "croft",
    "Silverstone": "silverstone",
}

# Root-caused live 2026-08-17: the hero image isn't an <img src="...">, it's
# a CSS background-image: url(&quot;...&quot;) inside the hero element's own
# style="..." attribute - confirmed live, the URL is now a Supabase Storage
# signed URL rather than the old /api/media/<uuid> redirector shape this
# regex originally assumed, and even the redirector shape would never have
# had a literal "-quote after it here (it's HTML-entity-escaped as &quot;
# inside a style attribute, not a bare src="..." attribute) - so this was
# silently matching nothing regardless of which URL shape the page used.
# Unaffected by the Scrapfly migration - it parses rendered HTML either way.
HERO_RE = re.compile(r'circuit-profile-hero[^>]*?url\(&quot;(.+?)&quot;\)', re.IGNORECASE)
BASE_URL = "https://btcc.net/circuit/"

# This script doesn't fetch a listing page itself, but btcc.net/calendar/'s
# round cards do link directly to /circuit/<slug>/ (confirmed by
# scrape_calendar.py's own href="/circuit/..." parsing) - a real link
# relationship, even though less proven than scrape_articles.py's
# listing->article referer fix (which was confirmed by live A/B testing).
_CALENDAR_REFERER = "https://btcc.net/calendar/"


def main() -> None:
    data = json.loads(TRACKS_PATH.read_text(encoding="utf-8"))
    updated = 0
    fetched_ok = 0      # pages whose fetch itself succeeded (no raise)
    hero_found = 0      # of those, how many actually had a hero image URL

    for venue, slug in TRACK_SLUGS.items():
        track = data.get(venue)
        if track is None:
            print(f"  WARNING: {venue!r} not found in tracks.json, skipping")
            continue
        try:
            url = BASE_URL + slug + "/"
            html = fetch_via_scrapfly(
                url, referer=_CALENDAR_REFERER, render_js=True, label=slug,
                wait_for_selector=".circuit-profile-hero",
            )
            if html is None:
                raise RuntimeError(f"Scrapfly fetch failed for {url}")
            fetched_ok += 1

            m = HERO_RE.search(html)
            media_url = resolve_media_url(m.group(1)) if m else None
            if not media_url:
                print(f"  WARNING: no hero image found for {venue} ({url})")
                continue
            hero_found += 1

            fetched = fetch_image_smart(media_url, label=slug)
            if not fetched:
                print(f"  WARNING: found hero image URL but fetch failed for {venue}")
                continue

            filename = save_mirrored_image({media_url: fetched}, media_url, MEDIA_DIR)
            if filename:
                track["imageUrl"] = f"{MEDIA_RAW_BASE}/{filename}"
                print(f"  {venue}: image mirrored")
                updated += 1
            else:
                print(f"  WARNING: could not save hero image for {venue}")
        except Exception as e:
            print(f"  WARNING: could not fetch image for {venue}: {e}")

    # Mirrors scrape_team_stats.py's own "fetched fine but parsed nothing"
    # guard: if every page that actually loaded still had zero hero images,
    # that's btcc.net's markup changing, not one track's bad luck (already
    # isolated/warned above) - worth failing the run over so the workflow's
    # retry-once/alert tail actually has something to catch.
    if fetched_ok > 0 and hero_found == 0:
        print(
            "ERROR: fetched circuit page(s) but found no hero image for any track - structure may have changed",
            file=sys.stderr,
        )
        sys.exit(1)

    TRACKS_PATH.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Updated {updated}/{len(TRACK_SLUGS)} track(s) in tracks.json")


if __name__ == "__main__":
    main()
