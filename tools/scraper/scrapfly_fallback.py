#!/usr/bin/env python3
"""
scrapfly_fallback.py

Bounded, measured trial of Scrapfly's paid Scrape API (https://scrapfly.io)
as a fallback for the one confirmed-residually-flaky fetch path:
scrape_articles.py's individual article-body fetch, and only after
RenderedFetcher's own built-in retries (free, see btcc_playwright.py) are
already exhausted. Not wired into any other scraper - no other scraper has
scrape_articles.py's confirmed history of still 429ing occasionally even
with a persisted session, correct hostname, and referer all in place
(2026-08-14 incident notes).

Deliberately a no-op - returns None immediately, no network call at all -
unless the SCRAPFLY_API_KEY environment variable is set, so the trial can
be disabled at any time by removing that one GitHub Actions secret, with no
code change needed. Every real attempt prints a SCRAPFLY_FALLBACK: log line
(success or fail) - the trial's data source is meant to be grepping these
out of accumulated workflow run logs over the trial period, not a new
metrics file, since this is meant to be a bounded trial, not a permanent
feature. See the project's own off-repo notes for the review point.

Uses urllib (stdlib) rather than adding a `requests` dependency for what
may turn out to be a short-lived trial - matches scrape_tsl.py's own choice
of urllib over requests for its plain (non-Playwright) HTTP fetches.
"""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.parse
import urllib.request

SCRAPFLY_ENDPOINT = "https://api.scrapfly.io/scrape"


def fetch_via_scrapfly(url: str, referer: str | None = None, label: str = "", timeout: int = 30) -> str | None:
    """Fetch url through Scrapfly's Scrape API and return the rendered HTML,
    or None if the trial is off (no API key configured) or the request
    failed for any reason - this is a fallback path, never something a
    caller should let crash a run.

    asp=true + render_js=true is Scrapfly's own documented combination for
    anti-bot-protected, JS-challenge targets (Kasada-class, which is what
    Vercel BotID is powered by) - verified against Scrapfly's own API docs
    (scrapfly.io/docs/scrape-api), not assumed. referer, if given, is passed
    as a real request header (headers[Referer]=...), not just cosmetic -
    also per their docs, since Scrapfly's ASP mode can otherwise auto-
    generate its own referer, which we'd rather not leave to chance given
    referer is the one lever confirmed (2026-08-14) to matter here."""
    api_key = os.environ.get("SCRAPFLY_API_KEY")
    if not api_key:
        return None

    params = {
        "key": api_key,
        "url": url,
        "asp": "true",
        "render_js": "true",
    }
    if referer:
        params["headers[Referer]"] = referer

    request_url = f"{SCRAPFLY_ENDPOINT}?{urllib.parse.urlencode(params)}"
    try:
        with urllib.request.urlopen(request_url, timeout=timeout) as resp:
            body = json.loads(resp.read())
        content = body["result"]["content"]
    except Exception as e:  # noqa: BLE001 - this is a last-resort fallback, any failure just means "no"
        print(f"  SCRAPFLY_FALLBACK: slug={label or url} result=fail ({e})")
        return None

    print(f"  SCRAPFLY_FALLBACK: slug={label or url} result=success")
    return content
