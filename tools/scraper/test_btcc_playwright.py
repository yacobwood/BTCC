#!/usr/bin/env python3
"""Tests for btcc_playwright.py's shared retry/budget logic.

RenderedFetcher.get()/get_with_media()/get_with_media_paginated() all retry
with backoff by default (2026-08-14/17 incidents: even a persisted session,
correct hostname, and referer don't make every individual btcc.net fetch
fully reliable). These tests stub out Playwright's Page/Context objects
entirely - no real browser needed, since __enter__ (which launches one) is
never called; a RenderedFetcher is built directly and its private _context
wired to a stub, matching this suite's existing FakeFetcher convention
(see test_scrape_articles.py) but one level deeper, since this file is what
scrape_articles.py's own hand-rolled retry loop was extracted from - it
needs to be tested where it actually lives now.
"""

import time
import unittest
from unittest.mock import patch

from btcc_playwright import RenderedFetcher


class _StubResponse:
    def __init__(self, ok=True, status=200):
        self.ok = ok
        self.status = status


class _StubPage:
    """One page's worth of scripted behavior. goto_result is either a
    _StubResponse (success) or an Exception instance to raise (failure) -
    RenderedFetcher opens a fresh page per retry attempt, so each attempt
    gets its own _StubPage with its own outcome."""

    def __init__(self, goto_result, content="<html><body>ok</body></html>"):
        self._goto_result = goto_result
        self._content = content
        self.goto_calls = []
        self.wait_for_selector_calls = []
        self.closed = False

    def goto(self, url, **kwargs):
        self.goto_calls.append({"url": url, **kwargs})
        if isinstance(self._goto_result, Exception):
            raise self._goto_result
        return self._goto_result

    def wait_for_selector(self, selector, **k):
        self.wait_for_selector_calls.append({"selector": selector, **k})

    def wait_for_timeout(self, *a, **k):
        pass

    def content(self):
        return self._content

    def close(self):
        self.closed = True

    def on(self, *a, **k):
        pass

    def evaluate(self, *a, **k):
        return 0

    def locator(self, *a, **k):
        class _Locator:
            def count(self):
                return 0

        return _Locator()

    def click(self, *a, **k):
        raise Exception("no next-page control in stub")


class _StubContext:
    """Each RenderedFetcher.new_page() call pops the next scripted page -
    lets a test give one page per attempt, e.g. [fails, fails, succeeds]."""

    def __init__(self, pages):
        self._pages = list(pages)

    def new_page(self):
        return self._pages.pop(0)


def _fetcher(pages, **kwargs):
    """Build a RenderedFetcher without going through __enter__ (which
    launches a real browser + sleeps for jitter) - wire a stub context in
    directly, same as production code does after __enter__ runs."""
    fetcher = RenderedFetcher(**kwargs)
    fetcher._context = _StubContext(pages)
    fetcher._start = time.monotonic()
    return fetcher


class TestRetry(unittest.TestCase):

    def test_succeeds_on_first_attempt_no_retry_needed(self):
        fetcher = _fetcher([_StubPage(_StubResponse())])
        self.assertEqual(fetcher.get("https://btcc.net/x/"), "<html><body>ok</body></html>")

    @patch("btcc_playwright.time.sleep")
    def test_retries_after_a_failure_then_succeeds(self, mock_sleep):
        fetcher = _fetcher([
            _StubPage(RuntimeError("HTTP 429 fetching https://btcc.net/x/")),
            _StubPage(_StubResponse()),
        ])
        result = fetcher.get("https://btcc.net/x/")
        self.assertEqual(result, "<html><body>ok</body></html>")
        mock_sleep.assert_called_once_with(5.0)  # retry_backoff(5.0) * attempt 1

    @patch("btcc_playwright.time.sleep")
    def test_gives_up_and_reraises_after_exhausting_retries(self, mock_sleep):
        error = RuntimeError("HTTP 429 fetching https://btcc.net/x/")
        fetcher = _fetcher([_StubPage(error), _StubPage(error), _StubPage(error)], retries=2)
        with self.assertRaises(RuntimeError):
            fetcher.get("https://btcc.net/x/")
        # 2 retries = 3 attempts total = 2 backoff sleeps (5s, 10s) - none
        # after the final, already-exhausted attempt.
        self.assertEqual([c.args[0] for c in mock_sleep.call_args_list], [5.0, 10.0])

    @patch("btcc_playwright.time.sleep")
    def test_per_call_retries_override_beats_instance_default(self, mock_sleep):
        error = RuntimeError("HTTP 429 fetching https://btcc.net/x/")
        fetcher = _fetcher([_StubPage(error)], retries=2)  # instance default: 2 retries
        with self.assertRaises(RuntimeError):
            fetcher.get("https://btcc.net/x/", retries=0)  # this call: 0 retries, 1 attempt
        mock_sleep.assert_not_called()

    def test_get_with_media_also_retries(self):
        fetcher = _fetcher([
            _StubPage(RuntimeError("HTTP 429 fetching https://btcc.net/drivers/")),
            _StubPage(_StubResponse()),
        ])
        with patch("btcc_playwright.time.sleep"):
            html, media = fetcher.get_with_media("https://btcc.net/drivers/")
        self.assertEqual(html, "<html><body>ok</body></html>")
        self.assertEqual(media, {})

    def test_get_with_media_paginated_also_retries(self):
        fetcher = _fetcher([
            _StubPage(RuntimeError("HTTP 429 fetching https://btcc.net/news/")),
            _StubPage(_StubResponse()),
        ])
        with patch("btcc_playwright.time.sleep"):
            html, media = fetcher.get_with_media_paginated(
                "https://btcc.net/news/", next_selector=".next", max_clicks=2
            )
        self.assertEqual(html, "<html><body>ok</body></html>")


class TestReferer(unittest.TestCase):
    """Confirmed 2026-08-14: referer is the one lever that actually reduced
    individual-fetch 429s. get_with_media() had no way to pass one at all
    until this change - assert both methods now do."""

    def test_get_passes_referer_to_goto(self):
        page = _StubPage(_StubResponse())
        fetcher = _fetcher([page])
        fetcher.get("https://btcc.net/some-article/", referer="https://btcc.net/news/")
        self.assertEqual(page.goto_calls[0]["referer"], "https://btcc.net/news/")

    def test_get_with_media_passes_referer_to_goto(self):
        page = _StubPage(_StubResponse())
        fetcher = _fetcher([page])
        fetcher.get_with_media("https://btcc.net/driver/some-driver/", referer="https://btcc.net/drivers/")
        self.assertEqual(page.goto_calls[0]["referer"], "https://btcc.net/drivers/")

    def test_get_defaults_referer_to_none(self):
        page = _StubPage(_StubResponse())
        fetcher = _fetcher([page])
        fetcher.get("https://btcc.net/news/")
        self.assertIsNone(page.goto_calls[0]["referer"])


class TestWaitState(unittest.TestCase):
    """Root-caused live 2026-08-17: btcc.net/circuit/*'s #timetable sits in
    an inactive "Timetable" tab (default active tab is "Details") - the
    element is real, present-in-DOM content, but never becomes CSS-visible
    without a click, so the default wait_for_selector(state="visible")
    timed out on every single circuit page. wait_state lets a caller ask
    for "attached" instead."""

    def test_defaults_to_visible(self):
        page = _StubPage(_StubResponse())
        fetcher = _fetcher([page])
        fetcher.get("https://btcc.net/circuit/donington-park/", wait_selector="#timetable")
        self.assertEqual(page.wait_for_selector_calls[0]["state"], "visible")

    def test_can_override_to_attached(self):
        page = _StubPage(_StubResponse())
        fetcher = _fetcher([page])
        fetcher.get("https://btcc.net/circuit/donington-park/", wait_selector="#timetable", wait_state="attached")
        self.assertEqual(page.wait_for_selector_calls[0]["selector"], "#timetable")
        self.assertEqual(page.wait_for_selector_calls[0]["state"], "attached")


class TestBudget(unittest.TestCase):
    """Root-caused 2026-08-17: a per-item loop with no ceiling can occupy the
    one shared self-hosted runner indefinitely while it keeps retrying a
    genuinely-down target, starving every other queued workflow."""

    def test_not_over_budget_immediately_after_start(self):
        fetcher = RenderedFetcher(budget_seconds=100)
        fetcher._start = time.monotonic()
        self.assertFalse(fetcher.over_budget())

    def test_over_budget_once_deadline_has_passed(self):
        fetcher = RenderedFetcher(budget_seconds=1)
        fetcher._start = time.monotonic() - 10  # started 10s ago, budget was 1s
        self.assertTrue(fetcher.over_budget())

    def test_budget_seconds_none_disables_the_check(self):
        fetcher = RenderedFetcher(budget_seconds=None)
        fetcher._start = time.monotonic() - 100000
        self.assertFalse(fetcher.over_budget())

    def test_default_budget_matches_the_value_proven_in_scrape_articles(self):
        fetcher = RenderedFetcher()
        self.assertEqual(fetcher.budget_seconds, 150.0)


if __name__ == "__main__":
    unittest.main()
