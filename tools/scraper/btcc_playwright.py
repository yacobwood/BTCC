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

import random
import sys
import time
from pathlib import Path
from typing import Callable, TypeVar

from playwright.sync_api import sync_playwright

# Re-exported for backward compatibility - these moved to media_utils.py on
# 2026-09-01 so scrape_news.py/scrape_articles.py could use them without
# also importing Playwright (see media_utils.py's own module docstring for
# why that split exists). Nothing in this file's own code below uses them;
# they're here purely so `from btcc_playwright import resolve_media_url`
# etc. keeps working for anything that still does that.
from media_utils import MEDIA_SRC_RE_FRAGMENT, resolve_media_url, save_mirrored_image  # noqa: F401

T = TypeVar("T")

_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)

# Persists cookies/localStorage across separate script runs (this file's own
# machine-local state directory, matching ~/.btcc-scraper-venv's pattern -
# outside the git checkout so a `git clean`/rebase can never touch it).
# Root-caused 2026-08-13/14: this scraper's self-hosted-runner IP started
# getting Vercel's BotID challenge (429, x-vercel-mitigated: challenge)
# consistently after weeks of clean runs, on every path on the domain
# (even /robots.txt) - not a code regression, and not fixed by any request
# header or TLS trick. A brand-new, cookie-less headless browser launched
# fresh every 5 minutes, forever, is itself a strong behavioral signal to
# modern bot-scoring: a real returning visitor's browser carries session
# cookies (including whatever token a solved JS challenge sets) so it isn't
# re-challenged from scratch on every visit. Persisting storage_state gives
# this scraper the same "returning session" continuity a real user has.
_STORAGE_STATE_PATH = Path.home() / ".btcc-scraper-state" / "storage_state.json"

# Small random delay before the first request of a run - the underlying
# GitHub Actions cron already isn't perfectly on-time, but the fetch itself
# firing at an exact 5-minute mark, every time, for weeks, is an unusually
# regular cadence for a "real visitor" to have. Cheap to add, doesn't hurt.
_MAX_STARTUP_JITTER_SECONDS = 45

# Defaults proven in scrape_articles.py's own incident-driven fixes
# (2026-08-14/17) - see RenderedFetcher's docstring for why these now live
# here instead of in that one script alone.
DEFAULT_RETRIES = 2
DEFAULT_RETRY_BACKOFF_SECONDS = 5.0
DEFAULT_FETCH_BUDGET_SECONDS = 150.0


class RenderedFetcher:
    """Reuses one headless browser (and one browser context, so cookies persist
    within a run) across several fetches in the same script run.

    retries/retry_backoff/budget_seconds default to the values proven in
    scrape_articles.py's own incident-driven fixes (2026-08-14/17): even a
    persisted session, correct hostname, and referer don't make every
    individual btcc.net fetch fully reliable - Vercel's BotID occasionally
    429s a fraction of "gray area" requests, so get()/get_with_media()/
    get_with_media_paginated() all retry with backoff by default. A script
    that does nothing but `with RenderedFetcher() as fetcher:` gets this for
    free - deliberately, since scrape_articles.py's original hand-rolled
    version of this same logic was available as a pattern to copy for weeks
    and never got adopted by any of the other scrapers in this directory.

    budget_seconds bounds how long a whole run may keep attempting fetches
    (checked via over_budget(), not enforced automatically) - root-caused
    2026-08-17: btcc-mac is the *one* self-hosted runner shared by every
    btcc.net-facing workflow, so a per-item loop whose worst case scales
    with "how many items are currently failing" can starve every other
    queued workflow of the only runner for however long that takes."""

    def __init__(
        self,
        retries: int = DEFAULT_RETRIES,
        retry_backoff: float = DEFAULT_RETRY_BACKOFF_SECONDS,
        budget_seconds: float | None = DEFAULT_FETCH_BUDGET_SECONDS,
    ) -> None:
        self.retries = retries
        self.retry_backoff = retry_backoff
        self.budget_seconds = budget_seconds

    def __enter__(self) -> "RenderedFetcher":
        # Clock starts before the jitter sleep, not after - the budget is
        # meant to bound this run's total occupancy of the shared runner,
        # not just time spent actually fetching.
        self._start = time.monotonic()
        time.sleep(random.uniform(0, _MAX_STARTUP_JITTER_SECONDS))
        self._pw = sync_playwright().start()
        self._browser = self._pw.chromium.launch(headless=True)
        storage_state = str(_STORAGE_STATE_PATH) if _STORAGE_STATE_PATH.exists() else None
        self._context = self._browser.new_context(user_agent=_USER_AGENT, storage_state=storage_state)
        return self

    def over_budget(self) -> bool:
        """Checked by a caller's per-item loop *before* starting the next
        fetch - never cancels a fetch already in flight (each attempt's own
        `timeout` already bounds that on its own)."""
        return self.budget_seconds is not None and (time.monotonic() - self._start) > self.budget_seconds

    def _retrying(self, attempt: Callable[[], T], retries: int | None = None, label: str = "") -> T:
        """Runs attempt() (a zero-arg callable that performs one full
        page-open/goto/wait/extract/close cycle and returns its result),
        retrying up to `retries` more times with linear backoff
        (retry_backoff * attempt_number seconds) on any exception. Re-raises
        the last exception if every attempt fails, matching the pre-existing
        "raise on failure" contract - callers looping over many items keep
        whatever isolate-and-continue try/except they already have around a
        single fetch call, unchanged."""
        retries = self.retries if retries is None else retries
        last_error: Exception | None = None
        for attempt_num in range(retries + 1):
            try:
                return attempt()
            except Exception as e:  # noqa: BLE001 - genuinely want to retry any failure here
                last_error = e
                if attempt_num < retries:
                    print(f"  retry {attempt_num + 1}/{retries} for {label or 'fetch'}: {e}", file=sys.stderr)
                    time.sleep(self.retry_backoff * (attempt_num + 1))
        raise last_error

    def __exit__(self, *exc) -> None:
        # Best-effort: never let a state-save failure mask the real exception
        # (if any) from the `with` block, or block browser/playwright teardown.
        try:
            _STORAGE_STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
            self._context.storage_state(path=str(_STORAGE_STATE_PATH))
        except Exception:
            pass
        self._context.close()
        self._browser.close()
        self._pw.stop()

    def get(
        self,
        url: str,
        wait_selector: str | None = None,
        timeout: int = 30000,
        referer: str | None = None,
        retries: int | None = None,
        wait_state: str = "visible",
    ) -> str:
        """referer: pass the page a caller navigated *from* (e.g. a listing
        page's URL) when fetching a page a real user would have reached by
        clicking a link there - a bare page.goto() to a brand-new URL never
        sets one on its own, unlike a real in-page navigation. Confirmed
        (2026-08-14) this specific gap - not scroll behaviour or elapsed
        time - as the one consistent difference between the individual-
        article fetch that reliably 429'd right after the listing scrape and
        the ones later in the same run that didn't.

        retries: per-call override of the instance default (see
        RenderedFetcher's own docstring) - e.g. a script that wants more or
        fewer attempts for one specific fetch than the rest of its run.

        wait_state: passed straight through to page.wait_for_selector's own
        `state` - default "visible" is right for most selectors, but some
        btcc.net pages render a selector's element into the DOM inside an
        inactive tab panel (confirmed live 2026-08-17: btcc.net/circuit/*'s
        #timetable sits in a "Timetable" tab that isn't the default active
        one, so it's real content, present in page.content(), that simply
        never becomes CSS-visible without a click) - "attached" (present in
        the DOM at all) is the right wait for that shape, since the actual
        parsing works on the raw HTML string regardless of what's visually
        shown in the browser."""

        def _attempt() -> str:
            page = self._context.new_page()
            try:
                resp = page.goto(url, wait_until="load", timeout=timeout, referer=referer)
                if resp is None or not resp.ok:
                    status = resp.status if resp else "?"
                    raise RuntimeError(f"HTTP {status} fetching {url}")
                if wait_selector:
                    page.wait_for_selector(wait_selector, timeout=timeout, state=wait_state)
                else:
                    page.wait_for_timeout(1200)
                return page.content()
            finally:
                page.close()

        return self._retrying(_attempt, retries=retries, label=url)

    def get_with_media(
        self,
        url: str,
        wait_selector: str | None = None,
        timeout: int = 30000,
        scroll_through: bool = False,
        referer: str | None = None,
        retries: int | None = None,
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

        referer/retries: same meaning as on get() - see its docstring.
        """

        def _attempt() -> tuple[str, dict[str, tuple[bytes, str]]]:
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

            page = self._context.new_page()
            page.on("response", on_response)
            try:
                resp = page.goto(url, wait_until="load", timeout=timeout, referer=referer)
                if resp is None or not resp.ok:
                    status = resp.status if resp else "?"
                    raise RuntimeError(f"HTTP {status} fetching {url}")
                if wait_selector:
                    page.wait_for_selector(wait_selector, timeout=timeout)
                else:
                    page.wait_for_timeout(1200)
                if scroll_through:
                    # Step down in viewport-height increments rather than jumping
                    # straight to the bottom in one go. A single jump only brings
                    # content near the *final* scroll position into view, so
                    # native loading="lazy" images anywhere in the middle of a
                    # static (non-growing) page - most of them, on a long listing -
                    # never cross the viewport and never get requested. Re-checking
                    # scrollHeight each step still handles a genuinely growing
                    # (infinite-scroll) page: the loop keeps walking as long as
                    # there's more height to cover.
                    viewport_height = page.evaluate("window.innerHeight") or 800
                    pos = 0
                    for _ in range(60):
                        pos += viewport_height
                        page.evaluate(f"window.scrollTo(0, {pos})")
                        page.wait_for_timeout(500)
                        height = page.evaluate("document.body.scrollHeight")
                        if pos >= height:
                            break
                    # Let whichever images the final scroll step just triggered
                    # actually finish their network round-trip before capturing.
                    page.wait_for_timeout(800)
                return page.content(), media
            finally:
                page.close()

        return self._retrying(_attempt, retries=retries, label=url)

    def get_with_media_paginated(
        self,
        url: str,
        next_selector: str,
        max_clicks: int,
        wait_selector: str | None = None,
        timeout: int = 30000,
        retries: int | None = None,
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

        No referer parameter here (unlike get()/get_with_media()) - every
        caller of this method is a top-level listing fetch, never a detail
        page reached "from" something else, so there's nothing plausible to
        pass. retries: same meaning as on get().
        """

        def _attempt() -> tuple[str, dict[str, tuple[bytes, str]]]:
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

            page = self._context.new_page()
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

        return self._retrying(_attempt, retries=retries, label=url)


def fetch_rendered(
    url: str,
    wait_selector: str | None = None,
    timeout: int = 30000,
    referer: str | None = None,
    retries: int | None = None,
    budget_seconds: float | None = DEFAULT_FETCH_BUDGET_SECONDS,
) -> str:
    """One-off fetch for scripts that only need a single page. Prefer sharing
    one RenderedFetcher across multiple fetches in the same run instead of
    calling this in a loop - each call here opens a brand-new browser (plus
    its own startup jitter), which is itself a bot signal when repeated
    (root-caused 2026-08-13/14) and wastes shared-runner time on top of it."""
    with RenderedFetcher(budget_seconds=budget_seconds) as fetcher:
        return fetcher.get(url, wait_selector=wait_selector, timeout=timeout, referer=referer, retries=retries)


if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else "https://btcc.net/news/"
    print(fetch_rendered(target)[:500])
