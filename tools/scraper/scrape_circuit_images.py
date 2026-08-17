#!/usr/bin/env python3
"""
scrape_circuit_images.py
Mirrors each circuit's hero photo from its btcc.net circuit page and sets
it as imageUrl in data/tracks.json.

data/tracks.json's imageUrl fields still point at the old WordPress
wp-content/gallery URLs (btcc.net moved off WordPress - see
project_vercel_migration memory) and show as a broken image in
TrackDetailScreen's hero (src/screens/TrackDetailScreen.js). The new site
serves this image from a private Supabase Storage bucket behind a
per-request signed URL that expires within the hour, via btcc.net's own
stable /api/media/<uuid> redirector - same mechanism scrape_driver_images.py
already mirrors, just a different page/selector.

layoutImageUrl and raceImages are NOT handled here: every current track has
a bundled SVG in BUNDLED_TRACK_LAYOUTS that takes priority, and the
photoCarousel/raceImages render case is never actually reached (nothing
pushes it into TrackDetailScreen's item list) - both are dead code paths
regardless of URL validity, so there's nothing to fix there.

Brands Hatch GP is skipped - its imageUrl already points at images.msv.com
(the circuit's own site, unrelated to btcc.net) and still resolves.

Usage:
    python scrape_circuit_images.py
"""

import json
import re
from pathlib import Path

from btcc_playwright import RenderedFetcher, resolve_media_url, save_mirrored_image

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

    with RenderedFetcher() as fetcher:
        for venue, slug in TRACK_SLUGS.items():
            track = data.get(venue)
            if track is None:
                print(f"  WARNING: {venue!r} not found in tracks.json, skipping")
                continue
            if fetcher.over_budget():
                print("  WARNING: fetch time budget exhausted - skipping remaining tracks this run")
                break
            try:
                url = BASE_URL + slug + "/"
                html, media = fetcher.get_with_media(
                    url, wait_selector=".circuit-profile-hero", referer=_CALENDAR_REFERER
                )
                m = HERO_RE.search(html)
                media_url = resolve_media_url(m.group(1)) if m else None
                filename = save_mirrored_image(media, media_url, MEDIA_DIR)
                if filename:
                    track["imageUrl"] = f"{MEDIA_RAW_BASE}/{filename}"
                    print(f"  {venue}: image mirrored")
                    updated += 1
                else:
                    print(f"  WARNING: no hero image found for {venue} ({url})")
            except Exception as e:
                print(f"  WARNING: could not fetch image for {venue}: {e}")

    TRACKS_PATH.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Updated {updated}/{len(TRACK_SLUGS)} track(s) in tracks.json")


if __name__ == "__main__":
    main()
