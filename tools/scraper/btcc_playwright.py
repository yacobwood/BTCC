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

import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

_EXT_BY_CONTENT_TYPE = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
}


def save_mirrored_image(
    media: dict[str, tuple[bytes, str]], media_url: str | None, out_dir: Path
) -> str | None:
    """Save a captured btcc.net media image (from get_with_media's result) into
    out_dir, named by its /api/media/<uuid>. Returns the saved filename, or None
    if media_url is falsy or wasn't captured (e.g. the image failed to load)."""
    if not media_url:
        return None
    entry = media.get(media_url)
    if not entry:
        return None
    body, content_type = entry
    ext = _EXT_BY_CONTENT_TYPE.get(content_type.split(";")[0].strip(), "jpg")
    uuid = media_url.rstrip("/").rsplit("/", 1)[-1]
    filename = f"{uuid}.{ext}"
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / filename).write_bytes(body)
    return filename

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
        self, url: str, wait_selector: str | None = None, timeout: int = 30000
    ) -> tuple[str, dict[str, tuple[bytes, str]]]:
        """Like get(), but also returns {btcc.net/api/media/<uuid> URL: (bytes, content_type)}
        for every image loaded during navigation.

        btcc.net's own images (/api/media/<uuid>, which redirect to signed Supabase
        Storage URLs) are behind the exact same Vercel challenge as the page itself
        - confirmed a plain request (even Playwright's own out-of-band
        page.request, which shares cookies with the browser) still gets 429'd,
        while the real in-page <img> requests the browser makes during navigation
        succeed. So there's no way to fetch an image URL after the fact - the
        bytes have to be captured from the responses the browser already made
        while rendering the page, by walking each image response back through
        its redirect chain to the original btcc.net media URL.
        """
        media: dict[str, tuple[bytes, str]] = {}

        def on_response(response):
            content_type = response.headers.get("content-type", "")
            if not content_type.startswith("image/"):
                return
            request = response.request
            while request.redirected_from:
                request = request.redirected_from
            if "/api/media/" in request.url and request.url not in media:
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
