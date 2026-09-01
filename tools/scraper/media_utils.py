"""
Pure-Python image/URL helpers shared by every btcc.net-facing scraper,
split out of btcc_playwright.py on 2026-09-01 specifically so importing
them doesn't also require Playwright.

Why this split exists: scrape_news.py and scrape_articles.py only ever
needed resolve_media_url/save_mirrored_image/MEDIA_SRC_RE_FRAGMENT from
btcc_playwright.py, never RenderedFetcher itself - but `from btcc_playwright
import ...` unconditionally executes that module's own `from playwright.sync_api
import sync_playwright` at import time regardless of which names are
actually used. That's harmless on the old self-hosted runner (Playwright
was already installed in its persistent venv for RenderedFetcher's own
sake), but broke outright on GitHub-hosted ubuntu-latest after the
2026-09-01 Scrapfly migration - confirmed live: `ModuleNotFoundError: No
module named 'PIL'` (Pillow was never installed there either), the first
real run after the migration. Only Pillow is a real dependency of this
module - install it explicitly in any ubuntu-latest workflow that ends up
calling save_mirrored_image (see scrape-news.yml).

btcc_playwright.py re-exports these same names for backward compatibility
with anything that still does `from btcc_playwright import resolve_media_url`
etc. - it's the dormant, still-fully-intact self-hosted path, not deleted.
"""

from __future__ import annotations

import io
from pathlib import Path

from PIL import Image

_EXT_BY_CONTENT_TYPE = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
}

# btcc.net's Supabase-hosted images are inconsistently pre-sized at the
# source - some are already web-sized, some are untouched DSLR originals
# (confirmed: a 5499x3666, 3.4MB original mirrored verbatim, ~15x the size
# of a normal mirrored photo, loading slowly enough on-device to look like
# a missing image entirely). Unlike btcc.net/wp-content/uploads/ URLs,
# these never get resized by CachedImage's wpThumb() either - it only
# rewrites that one URL shape - so whatever size is mirrored here is
# exactly what every phone downloads and decodes. Capping the long edge
# matches WP_SIZES's own largest tier in CachedImage.js.
_MAX_DIMENSION = 1024

# Matches an <img src="..."> value in either shape a btcc.net page might use:
# btcc.net's own stable /api/media/<uuid> redirector (relative path), or a
# Supabase Storage signed URL embedded directly (already absolute). Capture
# the whole match so callers can tell which shape they got.
MEDIA_SRC_RE_FRAGMENT = r'(?:/api/media/[^"]+|https://[a-z0-9-]+\.supabase\.co/storage/[^"]+)'


def resolve_media_url(src: str) -> str:
    """Turn a matched <img src> value into an absolute URL - prefixes
    btcc.net's own domain onto a relative /api/media/<uuid> path, or returns
    an already-absolute Supabase Storage URL unchanged."""
    return f"https://btcc.net{src}" if src.startswith("/") else src


def save_mirrored_image(
    media: dict[str, tuple[bytes, str]], media_url: str | None, out_dir: Path,
    max_dimension: int = _MAX_DIMENSION,
) -> str | None:
    """Save a captured btcc.net media image (from get_with_media's result, or
    a single {media_url: (bytes, content_type)} dict from an on-demand
    Scrapfly fetch) into out_dir, named by its identifying path segment.
    Returns the saved filename, or None if media_url is falsy or wasn't
    captured (e.g. the image failed to load).

    media_url is one of two shapes depending on the page: btcc.net's own
    stable /api/media/<uuid> redirector (no extension in the URL), or - some
    pages now embed this directly - a Supabase Storage signed URL whose last
    path segment already ends in a real filename+extension before a `?token=`
    query string. Strip any query string and any extension already present
    before appending the one derived from content-type, so the /api/media/
    case (unaffected) and the Supabase case (would otherwise double up, e.g.
    "name.jpg.jpg") both end up with exactly one correct extension.

    max_dimension: defaults to _MAX_DIMENSION (matches every existing
    caller's prior behavior unchanged). A caller that needs a second, smaller
    variant of the same captured bytes (e.g. scrape_gallery.py's grid
    thumbnail alongside its lightbox-view size) can call this twice with a
    different out_dir and max_dimension per size, instead of duplicating this
    function's extension/filename logic - the media dict already holds the
    bytes in memory, so a second call costs a resize, not a re-fetch."""
    if not media_url:
        return None
    entry = media.get(media_url)
    if not entry:
        return None
    body, content_type = entry
    ext = _EXT_BY_CONTENT_TYPE.get(content_type.split(";")[0].strip(), "jpg")
    last_segment = media_url.split("?", 1)[0].rstrip("/").rsplit("/", 1)[-1]
    stem = last_segment.rsplit(".", 1)[0] if "." in last_segment else last_segment
    filename = f"{stem}.{ext}"
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / filename).write_bytes(_downscale(body, ext, max_dimension))
    return filename


def _downscale(body: bytes, ext: str, max_dimension: int = _MAX_DIMENSION) -> bytes:
    """Shrink an image to max_dimension on its long edge, preserving aspect
    ratio and format. Returns the original bytes unchanged if it's already
    smaller, or if PIL can't decode it (never block a mirror on a decode
    quirk - malformed bytes just get written verbatim, same as before)."""
    try:
        img = Image.open(io.BytesIO(body))
        if max(img.size) <= max_dimension:
            return body
        img.thumbnail((max_dimension, max_dimension), Image.LANCZOS)
        out = io.BytesIO()
        if ext in ("jpg", "jpeg"):
            img.convert("RGB").save(out, format="JPEG", quality=85)
        else:
            img.save(out, format=img.format)
        return out.getvalue()
    except Exception:
        return body
