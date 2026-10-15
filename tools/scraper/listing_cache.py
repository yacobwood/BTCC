"""Hands the rendered btcc.net/news/ listing from scrape_news.py to
scrape_articles.py within one scrape-news.yml run, so the page is only
paid for once.

Both scripts used to fetch the exact same page (asp=true + render_js=true,
~30 credits each) back to back every run - 167 runs/day, so ~5k credits a
day were spent on a byte-identical duplicate. Confirmed 2026-10-15 via the
Scrapfly usage dashboard: that duplicate is what pushed the October
subscription past its 200k ceiling on the 15th (429s on every run from
07:04 UTC).

Opt-in via the NEWS_LISTING_CACHE env var (scrape-news.yml points it at
runner.temp, outside the repo, so it can never be committed). Unset - e.g.
a local run - means no caching at all: each script fetches for itself
exactly as before. A cache older than MAX_AGE_SECONDS is ignored rather
than trusted, so a stale file can never stand in for a fresh fetch.
"""

from __future__ import annotations

import os
import time
from pathlib import Path

ENV_VAR = "NEWS_LISTING_CACHE"
# Generous for two consecutive steps of one run (seconds apart), still far
# shorter than the gap to the next scheduled run.
MAX_AGE_SECONDS = 300


def _path() -> Path | None:
    value = os.environ.get(ENV_VAR, "").strip()
    return Path(value) if value else None


def save(html: str) -> None:
    """Best-effort: a failed write only costs the second script its own
    fetch, never the run."""
    path = _path()
    if path is None:
        return
    try:
        path.write_text(html, encoding="utf-8")
    except OSError as e:
        print(f"  WARNING: could not write listing cache {path} ({e})")


def load() -> str | None:
    """The cached listing HTML, or None if caching is off or the file is
    missing, empty or stale."""
    path = _path()
    if path is None:
        return None
    try:
        if time.time() - path.stat().st_mtime > MAX_AGE_SECONDS:
            return None
        html = path.read_text(encoding="utf-8")
    except OSError:
        return None
    return html or None
