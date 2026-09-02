#!/usr/bin/env python3
"""
scrapfly_fallback.py

Wraps Scrapfly's paid Scrape API (https://scrapfly.io) for two roles:

1. A per-fetch fallback for scrape_articles.py's individual article-body
   fetch, after RenderedFetcher's own built-in retries (free, see
   btcc_playwright.py) are already exhausted - the original, narrow use
   this module started as (2026-08-14 incident notes: that one fetch path
   has a confirmed history of still 429ing occasionally even with a
   persisted session, correct hostname, and referer all in place).

2. The fetch layer for scrape_news_scrapfly_fallback.py's emergency
   watchdog (2026-09-01) - runs on GitHub-hosted ubuntu-latest, no
   residential IP required, used only when the self-hosted-runner primary
   path is down or has fallen behind. See that script's own docstring and
   project_scrapfly_fallback_watchdog memory for the cost reasoning
   (images cost ~7.5x a plain page fetch here - confirmed live, asp=true
   is required even for a raw image URL or it 429s - which is why that
   watchdog only pays for one when the primary path has genuinely fallen
   behind, not on every check).

Deliberately a no-op in both roles - returns None immediately, no network
call at all - unless the SCRAPFLY_API_KEY environment variable is set, so
either can be disabled at any time by removing that one GitHub Actions
secret, with no code change needed. Every real attempt prints a
SCRAPFLY_FALLBACK: log line (success or fail).

Uses urllib (stdlib) rather than adding a `requests` dependency - matches
scrape_tsl.py's own choice of urllib over requests for its plain
(non-Playwright) HTTP fetches.
"""

from __future__ import annotations

import base64
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request

SCRAPFLY_ENDPOINT = "https://api.scrapfly.io/scrape"
# Confirmed live 2026-09-02: Scrapfly returns this instead of inline base64
# content once a response's size crosses some threshold (~4MB, confirmed on
# a genuine 4.1MB image) - see fetch_image_via_scrapfly's own docstring.
_LARGE_OBJECT_URL_PREFIX = "https://api.scrapfly.io/scrape/large_object/"
_SUPABASE_RE = re.compile(r"supabase\.co/storage/")


def fetch_via_scrapfly(
    url: str, referer: str | None = None, label: str = "", timeout: int = 30, render_js: bool = True,
) -> str | None:
    """Fetch url through Scrapfly's Scrape API and return the rendered HTML
    (or, with render_js=False, whatever text content the origin returned
    directly), or None if this is off (no API key configured) or the
    request failed for any reason - this is always a fallback path, never
    something a caller should let crash a run.

    asp=true + render_js=true is Scrapfly's own documented combination for
    anti-bot-protected, JS-challenge targets (Kasada-class, which is what
    Vercel BotID is powered by) - verified against Scrapfly's own API docs
    (scrapfly.io/docs/scrape-api), not assumed, and this is the right
    combination for an HTML page. render_js=False is for
    fetch_image_via_scrapfly below, not this function's normal callers -
    confirmed live (2026-09-01) that render_js=True against a raw image URL
    returns an empty 302 instead of the image, while render_js=False +
    asp=true correctly returns it (asp=False alone still 429s - the
    challenge applies to image URLs too, not just pages).

    referer, if given, is passed as a real request header
    (headers[Referer]=...), not just cosmetic - also per their docs, since
    Scrapfly's ASP mode can otherwise auto-generate its own referer, which
    we'd rather not leave to chance given referer is the one lever
    confirmed (2026-08-14) to matter here."""
    api_key = os.environ.get("SCRAPFLY_API_KEY")
    if not api_key:
        return None

    params = {
        "key": api_key,
        "url": url,
        "asp": "true",
        "render_js": "true" if render_js else "false",
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


def fetch_image_via_scrapfly(url: str, label: str = "", timeout: int = 60) -> tuple[bytes, str] | None:
    """Fetch a raw image URL (btcc.net's /api/media/<uuid> shape - the one
    still behind the Vercel challenge; a Supabase Storage URL needs no
    fallback at all, see media_utils.MEDIA_SRC_RE_FRAGMENT) through Scrapfly
    and return (bytes, content_type), shaped to drop straight into
    media_utils.save_mirrored_image's `media` dict - or None if this is off
    (no API key) or the request failed.

    Confirmed live (2026-09-01) this costs ~225 credits vs. ~30 for a plain
    HTML page fetch - Scrapfly bills each resource independently, unlike
    RenderedFetcher which captures every image a page loads for free as a
    side effect of rendering it once. Callers should gate this behind an
    actual "does this article still need an image" check, not call it
    unconditionally on every run - see scrape_news.py/scrape_articles.py's
    own prior-image checks.

    timeout defaults to 60s, not the 30s a plain page fetch gets - confirmed
    live 2026-09-02 that a real image fetch (challenge-solve + downloading a
    multi-megabyte file) can occasionally take longer than a lightweight
    HTML fetch does; one genuinely timed out at 30s that then succeeded in
    under 7s moments later on retry. Failed requests cost no credits
    (confirmed via Scrapfly's own billing docs), so there's no downside to
    the extra headroom, only a cost to timing out too eagerly and missing an
    image that was never actually unavailable.

    Large images (confirmed live 2026-09-02 on a genuine 4.1MB file) don't
    come back as inline base64 in `content` at all - Scrapfly instead
    returns a `https://api.scrapfly.io/scrape/large_object/<id>` reference
    URL there once a response crosses some size threshold, needing a
    second, separately-authenticated request to actually fetch the bytes.
    This was the real, 100%-reproducible cause of a run of "Incorrect
    padding" base64-decode failures that looked like flakiness at first -
    every attempt was trying to decode that reference URL string as if it
    were the image data itself."""
    api_key = os.environ.get("SCRAPFLY_API_KEY")
    if not api_key:
        return None

    params = {"key": api_key, "url": url, "asp": "true", "render_js": "false"}
    request_url = f"{SCRAPFLY_ENDPOINT}?{urllib.parse.urlencode(params)}"
    try:
        with urllib.request.urlopen(request_url, timeout=timeout) as resp:
            body = json.loads(resp.read())
        result = body["result"]
        # Scrapfly can return HTTP 200 with success=False and a non-image
        # error payload in `content` (confirmed live 2026-09-02: this
        # previously fell through to base64.b64decode() below and failed
        # with an opaque "Incorrect padding" instead of a real reason) -
        # check this explicitly so a genuine target-side failure reports
        # as what it actually is.
        if not result.get("success", True):
            raise RuntimeError(result.get("error", {}).get("message") or "Scrapfly reported success=false")
        # Confirmed live (2026-09-01) Scrapfly reports this one of two ways
        # depending on target - check both rather than trust one and risk
        # silently mislabelling a non-JPEG image's extension.
        content_type = result.get("content_type") or result.get("response_headers", {}).get("content-type", "image/jpeg")
        content_type = content_type.split(";")[0].strip()
        raw_content = result["content"]
        if raw_content.startswith(_LARGE_OBJECT_URL_PREFIX):
            with urllib.request.urlopen(f"{raw_content}?key={api_key}", timeout=timeout) as lo_resp:
                image_bytes = lo_resp.read()
        else:
            image_bytes = base64.b64decode(raw_content)
    except Exception as e:  # noqa: BLE001 - fallback path, any failure just means "no"
        print(f"  SCRAPFLY_FALLBACK: slug={label or url} result=fail ({e})")
        return None

    print(f"  SCRAPFLY_FALLBACK: slug={label or url} result=success")
    return image_bytes, content_type


def fetch_image_smart(media_url: str, label: str = "") -> tuple[bytes, str] | None:
    """Shared by scrape_news.py and scrape_articles.py: a Supabase Storage
    URL isn't behind btcc.net's Vercel challenge at all (confirmed live -
    see scrape-gallery.yml's own comment on this) so a plain, free request
    works; only btcc.net's own /api/media/<uuid> redirector needs
    fetch_image_via_scrapfly's paid path above. Returns None on any
    failure - image mirroring should never crash the whole scrape."""
    if _SUPABASE_RE.search(media_url):
        try:
            req = urllib.request.Request(media_url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=30) as resp:
                content_type = resp.headers.get("content-type", "image/jpeg").split(";")[0].strip()
                return resp.read(), content_type
        except Exception as e:  # noqa: BLE001 - image mirroring must never crash the whole scrape
            print(f"  WARNING: plain fetch of Supabase image failed ({e})", file=sys.stderr)
            return None
    return fetch_image_via_scrapfly(media_url, label=label)
