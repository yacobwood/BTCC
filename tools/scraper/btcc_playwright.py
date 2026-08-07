"""
Shared helper for scrapers fetching btcc.net now that the site has moved
off WordPress to a Vercel-hosted React app (2026-07-31). Vercel's bot
protection (BotID) issues every non-browser request a JS proof-of-work
challenge and returns 429 until it's solved - no TLS impersonation or
IP-based relay can pass that, since the block isn't about network
identity, it's about being unable to execute JavaScript. A real browser
clears it transparently, so scrapers now render pages with headless
Chromium via Playwright instead of fetching HTML directly.

This replaces btcc_relay.py's fetch_via_relay() for every btcc.net target.
The Cloudflare Worker relay (cf-worker/) was solving a different, no
longer relevant problem - the old WordPress origin's IP-reputation WAF -
and doesn't help here since it can't execute JavaScript either.
"""

from __future__ import annotations

import io
import sys
from pathlib import Path

from PIL import Image
from playwright.sync_api import sync_playwright

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
    media: dict[str, tuple[bytes, str]], media_url: str | None, out_dir: Path
) -> str | None:
    """Save a captured btcc.net media image (from get_with_media's result) into
    out_dir, named by its identifying path segment. Returns the saved filename,
    or None if media_url is falsy or wasn't captured (e.g. the image failed to
    load).

    media_url is one of two shapes depending on the page: btcc.net's own
    stable /api/media/<uuid> redirector (no extension in the URL), or - some
    pages now embed this directly - a Supabase Storage signed URL whose last
    path segment already ends in a real filename+extension before a `?token=`
    query string. Strip any query string and any extension already present
    before appending the one derived from content-type, so the /api/media/
    case (unaffected) and the Supabase case (would otherwise double up, e.g.
    "name.jpg.jpg") both end up with exactly one correct extension."""
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
    (out_dir / filename).write_bytes(_downscale(body, ext))
    return filename


def _downscale(body: bytes, ext: str) -> bytes:
    """Shrink an image to _MAX_DIMENSION on its long edge, preserving aspect
    ratio and format. Returns the original bytes unchanged if it's already
    smaller, or if PIL can't decode it (never block a mirror on a decode
    quirk - malformed bytes just get written verbatim, same as before)."""
    try:
        img = Image.open(io.BytesIO(body))
        if max(img.size) <= _MAX_DIMENSION:
            return body
        img.thumbnail((_MAX_DIMENSION, _MAX_DIMENSION), Image.LANCZOS)
        out = io.BytesIO()
        if ext in ("jpg", "jpeg"):
            img.convert("RGB").save(out, format="JPEG", quality=85)
        else:
            img.save(out, format=img.format)
        return out.getvalue()
    except Exception:
        return body

_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)


class RenderedFetcher:
    """Reuses one headless browser across several fetches in the same script run."""

    def __enter__(self) -> "RenderedFetcher":
        self._pw = sync_playwright().start()
        self._browser = self._pw.chromium.launch(headless=True)
        return self

    def __exit__(self, *exc) -> None:
        self._browser.close()
        self._pw.stop()

    def get(self, url: str, wait_selector: str | None = None, timeout: int = 30000) -> str:
        page = self._browser.new_page(user_agent=_USER_AGENT)
        try:
            resp = page.goto(url, wait_until="load", timeout=timeout)
            if resp is None or not resp.ok:
                status = resp.status if resp else "?"
                raise RuntimeError(f"HTTP {status} fetching {url}")
            if wait_selector:
                page.wait_for_selector(wait_selector, timeout=timeout)
            else:
                page.wait_for_timeout(1200)
            return page.content()
        finally:
            page.close()

    def get_with_media(
        self,
        url: str,
        wait_selector: str | None = None,
        timeout: int = 30000,
        scroll_through: bool = False,
    ) -> tuple[str, dict[str, tuple[bytes, str]]]:
        """Like get(), but also returns {image URL: (bytes, content_type)} for
        every image loaded during navigation, keyed by whichever of two URL
        shapes a given page actually uses: btcc.net's own stable /api/media/
        <uuid> redirector (most pages), or - some pages embed it directly
        instead of going through that redirector - a Supabase Storage signed
        URL (ylxmhtbmzvpwyvkmomex.supabase.co/storage/...).

        Both are behind the exact same Vercel challenge as the page itself -
        confirmed a plain request (even Playwright's own out-of-band
        page.request, which shares cookies with the browser) still gets 429'd,
        while the real in-page <img> requests the browser makes during navigation
        succeed. So there's no way to fetch an image URL after the fact - the
        bytes have to be captured from the responses the browser already made
        while rendering the page, by walking each image response back through
        its redirect chain to the original URL (a no-op for the direct-Supabase
        case, which was never redirected).

        Pass scroll_through=True for long listing pages (e.g. /drivers/) whose
        images use loading="lazy" - the browser only requests those once they're
        actually near the viewport, so a fixed-size page load silently misses
        every image below the fold. Scrolling to the bottom in steps triggers
        the same lazy-load the images would get from a real visit.
        """
        media: dict[str, tuple[bytes, str]] = {}

        def on_response(response):
            content_type = response.headers.get("content-type", "")
            if not content_type.startswith("image/"):
                return
            request = response.request
            while request.redirected_from:
                request = request.redirected_from
            is_relevant = "/api/media/" in request.url or "supabase.co/storage/" in request.url
            if is_relevant and request.url not in media:
                try:
                    media[request.url] = (response.body(), content_type)
                except Exception:
                    pass

        page = self._browser.new_page(user_agent=_USER_AGENT)
        page.on("response", on_response)
        try:
            resp = page.goto(url, wait_until="load", timeout=timeout)
            if resp is None or not resp.ok:
                status = resp.status if resp else "?"
                raise RuntimeError(f"HTTP {status} fetching {url}")
            if wait_selector:
                page.wait_for_selector(wait_selector, timeout=timeout)
            else:
                page.wait_for_timeout(1200)
            if scroll_through:
                prev_height = 0
                for _ in range(30):
                    height = page.evaluate("document.body.scrollHeight")
                    if height == prev_height:
                        break
                    prev_height = height
                    page.evaluate(f"window.scrollTo(0, {height})")
                    page.wait_for_timeout(400)
            return page.content(), media
        finally:
            page.close()

    def get_with_media_paginated(
        self,
        url: str,
        next_selector: str,
        max_clicks: int,
        wait_selector: str | None = None,
        timeout: int = 30000,
    ) -> tuple[str, dict[str, tuple[bytes, str]]]:
        """Like get_with_media(), but repeatedly clicks next_selector up to
        max_clicks times before returning - for a listing whose "page 2/3/.."
        links are actually client-side infinite-scroll triggers that *append*
        more cards to the same DOM rather than navigating to a separate page
        (confirmed on btcc.net/news/: a direct page.goto("/page/2/") silently
        re-renders page 1's content, but clicking the in-page link appends a
        genuinely new batch).

        Stops early (rather than raising) once a click no longer grows the
        card count - confirmed this listing's own infinite-scroll component
        hits an unrecoverable client-side error after 2 successful expansions
        (a real site bug, "Minified React error #419", a hydration mismatch)
        and every click after that succeeds with no further effect. Counts
        growth via `wait_selector` matches before/after each click, so it's
        agnostic to what the listing's actual card markup looks like.
        """
        media: dict[str, tuple[bytes, str]] = {}

        def on_response(response):
            content_type = response.headers.get("content-type", "")
            if not content_type.startswith("image/"):
                return
            request = response.request
            while request.redirected_from:
                request = request.redirected_from
            is_relevant = "/api/media/" in request.url or "supabase.co/storage/" in request.url
            if is_relevant and request.url not in media:
                try:
                    media[request.url] = (response.body(), content_type)
                except Exception:
                    pass

        page = self._browser.new_page(user_agent=_USER_AGENT)
        page.on("response", on_response)
        try:
            resp = page.goto(url, wait_until="load", timeout=timeout)
            if resp is None or not resp.ok:
                status = resp.status if resp else "?"
                raise RuntimeError(f"HTTP {status} fetching {url}")
            if wait_selector:
                page.wait_for_selector(wait_selector, timeout=timeout)

            prev_count = page.locator(wait_selector).count() if wait_selector else 0
            for _ in range(max_clicks):
                try:
                    page.click(next_selector, timeout=5000)
                except Exception:
                    break
                page.wait_for_timeout(2000)
                count = page.locator(wait_selector).count() if wait_selector else prev_count + 1
                if count <= prev_count:
                    break
                prev_count = count

            return page.content(), media
        finally:
            page.close()


def fetch_rendered(url: str, wait_selector: str | None = None, timeout: int = 30000) -> str:
    """One-off fetch for scripts that only need a single page."""
    with RenderedFetcher() as fetcher:
        return fetcher.get(url, wait_selector=wait_selector, timeout=timeout)


if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else "https://www.btcc.net/news/"
    print(fetch_rendered(target)[:500])
