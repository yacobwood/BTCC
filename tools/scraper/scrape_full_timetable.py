#!/usr/bin/env python3
"""
BTCC Full Timetable Scraper — scrapes support series timetables from btcc.net circuit pages.
Populates fullTimetable in data/calendar.json for each round.

Usage:
    python scrape_full_timetable.py [--dry-run] [--round N]
"""

import argparse
import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path
from typing import Optional

from scrapfly_fallback import fetch_via_scrapfly

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"
CALENDAR_JSON = DATA_DIR / "calendar.json"

# Only used as a referer literal by this module's own standalone --round CLI
# entry point below - scrape_calendar.py (this module's normal caller, via a
# dynamic importlib load) passes its own CALENDAR_URL in directly instead.
_STANDALONE_REFERER = "https://btcc.net/calendar/"

# Map calendar.json venue names to btcc.net circuit URL slugs
VENUE_SLUG = {
    "Donington Park":    "donington-park",
    "Donington Park GP": "donington-park-gp",
    "Brands Hatch Indy": "brands-hatch-indy",
    "Brands Hatch GP":   "brands-hatch-gp",
    "Snetterton":        "snetterton",
    "Oulton Park":       "oulton-park",
    "Thruxton":          "thruxton",
    "Knockhill":         "knockhill",
    "Croft":             "croft",
    "Silverstone":       "silverstone",
}

_NULL_SERIES = {"", "-", "—", "–"}

_SERIES_MARKERS = (
    "championship", "challenge", "touring cars", "touring car",
    "cup", "series", "trophy", "legends", "mini challenge",
)


def looks_like_series(text: str) -> bool:
    lower = text.lower()
    return any(marker in lower for marker in _SERIES_MARKERS)


def parse_time(raw: str) -> tuple:
    """Return (startTime, endTime) from '09:00 – 09:10' or '11:40'."""
    raw = raw.strip()
    m = re.match(r"(\d{1,2}:\d{2})\s*[–\-]\s*(\d{1,2}:\d{2})", raw)
    if m:
        return m.group(1).zfill(5), m.group(2).zfill(5)
    m = re.match(r"(\d{1,2}:\d{2})", raw)
    if m:
        return m.group(1).zfill(5), None
    return None, None


def parse_laps(raw: str) -> Optional[str]:
    raw = raw.strip()
    if not raw or raw in ("-", "—", "–"):
        return None
    return raw


class _TimetableParser(HTMLParser):
    """Walk a btcc.net circuit page, tracking day headings then extracting table rows."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.current_day: Optional[str] = None
        self._in_heading = False
        self._in_table = False
        self._in_cell = False
        self._current_row: list[str] = []
        self._current_cell = ""
        self.raw_rows: list[dict] = []

    def handle_starttag(self, tag, attrs):
        if re.match(r"h[1-6]$", tag):
            self._in_heading = True
        elif tag == "table" and not self._in_table:
            self._in_table = True
        elif self._in_table and tag in ("td", "th"):
            self._in_cell = True
            self._current_cell = ""
        elif self._in_table and tag == "tr":
            self._current_row = []

    def handle_endtag(self, tag):
        if re.match(r"h[1-6]$", tag):
            self._in_heading = False
        elif tag == "table":
            self._in_table = False
        elif self._in_table and tag in ("td", "th"):
            self._in_cell = False
            self._current_row.append(self._current_cell.strip().replace("\xa0", " "))
        elif self._in_table and tag == "tr":
            if self._current_row and self.current_day:
                self.raw_rows.append({"day": self.current_day, "cells": list(self._current_row)})
            self._current_row = []

    def handle_data(self, data):
        if self._in_heading:
            text = data.strip()
            if re.search(r"\bsaturday\b", text, re.I):
                self.current_day = "SAT"
            elif re.search(r"\bsunday\b", text, re.I):
                self.current_day = "SUN"
        if self._in_cell:
            self._current_cell += data


def scrape_circuit_timetable(slug: str, referer: Optional[str] = None) -> list[dict]:
    """referer: pass the calendar page's URL a real visitor would have
    clicked a circuit card from.

    Fetches via Scrapfly (see scrapfly_fallback.py) as of 2026-09-01 rather
    than local Playwright - the old wait_state="attached"/"visible"
    distinction (needed because #timetable sits inside a non-default-active
    "Timetable" tab, confirmed live 2026-08-17) doesn't apply here: Scrapfly
    returns the fully post-JS-render DOM regardless of what's currently
    CSS-visible, so the content this parser reads is present either way."""
    url = f"https://btcc.net/circuit/{slug}/"
    print(f"    Fetching {url} …")
    html = fetch_via_scrapfly(url, referer=referer, render_js=True, label=slug)
    if html is None:
        print(f"    Failed to load {url}", file=sys.stderr)
        return []

    parser = _TimetableParser()
    parser.feed(html)

    entries = []
    for row in parser.raw_rows:
        cells = row["cells"]
        day = row["day"]

        if len(cells) == 4:
            raw_time, session, series_raw, raw_laps = cells[0], cells[1], cells[2], cells[3]
        elif len(cells) == 3:
            raw_time, mid, raw_laps = cells[0], cells[1], cells[2]
            if looks_like_series(mid):
                session, series_raw = "Race", mid
            else:
                session, series_raw = mid, ""
        else:
            continue

        start, end = parse_time(raw_time)
        if not start:
            continue

        session = session.strip()
        if not session or session in ("-", "—"):
            continue

        series_raw = series_raw.strip()
        series = None if series_raw in _NULL_SERIES else series_raw
        laps = parse_laps(raw_laps)

        entry: dict = {"day": day, "time": start}
        if end:
            entry["endTime"] = end
        entry["series"] = series
        entry["session"] = session
        entry["laps"] = laps
        entries.append(entry)

    seen: set = set()
    deduped = []
    for e in entries:
        key = (e["day"], e["time"], e.get("series"), e["session"])
        if key not in seen:
            seen.add(key)
            deduped.append(e)

    return deduped


def main():
    ap = argparse.ArgumentParser(
        description="Scrape full weekend timetables from btcc.net circuit pages into data/calendar.json"
    )
    ap.add_argument("--dry-run", action="store_true", help="Print results only, do not write")
    ap.add_argument("--round", type=int, default=None, help="Only scrape a specific round number")
    args = ap.parse_args()

    with open(CALENDAR_JSON) as f:
        data = json.load(f)

    rounds = data.get("rounds", [])
    updated = 0

    for r in rounds:
        if args.round and r["round"] != args.round:
            continue

        venue = r.get("venue", "")
        slug = VENUE_SLUG.get(venue)
        if not slug:
            print(f"Round {r['round']} ({venue}): no slug mapping — skipping")
            continue

        print(f"Round {r['round']} — {venue}")
        entries = scrape_circuit_timetable(slug, referer=_STANDALONE_REFERER)

        if not entries:
            print(f"    No timetable found — leaving existing data unchanged")
            continue

        sat = sum(1 for e in entries if e["day"] == "SAT")
        sun = sum(1 for e in entries if e["day"] == "SUN")
        print(f"    {len(entries)} entries  (Sat: {sat}  Sun: {sun})")
        for e in entries:
            laps_str = f"  [{e['laps']}]" if e["laps"] else ""
            end_str = f" – {e['endTime']}" if e.get("endTime") else ""
            series_str = e["series"] or "(event)"
            print(f"      {e['day']}  {e['time']}{end_str}  {series_str} — {e['session']}{laps_str}")

        r["fullTimetable"] = entries
        updated += 1

    if args.dry_run:
        print(f"\nDry run — {updated} round(s) would be updated.")
        return

    with open(CALENDAR_JSON, "w") as f:
        json.dump(data, f, indent=2)
    print(f"\nUpdated {updated} round(s) in {CALENDAR_JSON}")


if __name__ == "__main__":
    main()
