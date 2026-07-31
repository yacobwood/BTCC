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

from playwright.sync_api import sync_playwright

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


def fetch_rendered(url: str, wait_selector: str | None = None, timeout: int = 30000) -> str:
    """One-off fetch for scripts that only need a single page."""
    with RenderedFetcher() as fetcher:
        return fetcher.get(url, wait_selector=wait_selector, timeout=timeout)


if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else "https://www.btcc.net/news/"
    print(fetch_rendered(target)[:500])
