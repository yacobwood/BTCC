#!/usr/bin/env python3
"""
BTCC Official Statistics Scraper

Fetches all-time wins and championship counts from btcc.net and updates
data/records.json.  Runs daily via GitHub Actions so the Wins and Titles
tabs on the RecordsScreen always reflect the official numbers.

Sources:
  https://btcc.net/history/statistics/drivers/  (wins per driver)
  https://btcc.net/history/champions/btcc-titles/  (championship counts)

Usage:
    python scrape_btcc_stats.py [--dry-run]
"""

import argparse
import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

from scrapfly_fallback import fetch_via_scrapfly

WINS_URL   = "https://btcc.net/history/statistics/drivers/"
TITLES_URL = "https://btcc.net/history/champions/btcc-titles/"
DATA_DIR   = Path(__file__).resolve().parent.parent.parent / "data"
RECORDS    = DATA_DIR / "records.json"

# Names on btcc.net that differ from the canonical form in records.json.
# Covers short-form names, btcc.net typos, and double-encoded characters.
NAME_ALIASES = {
    "Dan Rowbottom":        "Daniel Rowbottom",
    "Dan Lloyd":            "Daniel Lloyd",
    "Aron Taylor-Smith":    "Árón Taylor-Smith",
    "John Whitmore":        "Sir John Whitmore",
    "Fabrizio Giovianardi": "Fabrizio Giovanardi",   # typo on btcc.net titles page
    "Laurent AÃ¯ello":     "Laurent Aiello",          # double-encoded ï on titles page
}


# Official win counts btcc.net hasn't caught up with yet, as
# {driver: (stale_value_btcc_net_shows, corrected_value)}. Only applied while
# btcc.net still shows exactly the stale value, so once the site is fixed the
# entry stops mattering on its own (and can be deleted).
#
# 2026 Brands Hatch GP Race 3 (Round 30) was amended after the race: Ricky
# Collard 5s penalty (breach of safety car restart procedure), P1 -> P8, Dan
# Cammish inherits the win (TSL "ROUND 30 - CLASSIFICATION - AMENDED"). On
# 2026-10-11 btcc.net's statistics page still credited Collard (0 -> 1) and
# not Cammish (18).
STALE_OFFICIAL_WINS = {
    "Ricky Collard": (1, 0),
    "Dan Cammish":   (18, 19),
}


def correct_stale_wins(wins: dict[str, int]) -> tuple[dict[str, int], list[str]]:
    """Apply STALE_OFFICIAL_WINS to wins parsed from btcc.net (keyed by the
    canonical name). Returns (wins, notes)."""
    wins = dict(wins)
    notes = []
    for name, (stale, fixed) in STALE_OFFICIAL_WINS.items():
        key = next((k for k in wins if canonical_name(k) == name), None)
        if key is not None and wins[key] == stale:
            wins[key] = fixed
            notes.append(f"corrected stale btcc.net wins  {name}: {stale} -> {fixed}")
    return wins, notes

# ── HTML helpers ─────────────────────────────────────────────────────────────

class _TableParser(HTMLParser):
    """Minimal SAX-style parser that extracts rows from the first <table>."""

    def __init__(self):
        super().__init__()
        self.in_table = False
        self.in_cell  = False
        self.rows: list[list[str]] = []
        self._current_row: list[str] = []
        self._current_cell = ""

    def handle_starttag(self, tag, attrs):
        if tag == "table" and not self.in_table:
            self.in_table = True
        elif self.in_table and tag in ("td", "th"):
            self.in_cell = True
            self._current_cell = ""
        elif self.in_table and tag == "tr":
            self._current_row = []

    def handle_endtag(self, tag):
        if tag == "table":
            self.in_table = False
        elif self.in_table and tag in ("td", "th"):
            self.in_cell = False
            self._current_row.append(self._current_cell.strip())
        elif self.in_table and tag == "tr":
            if self._current_row:
                self.rows.append(self._current_row)
            self._current_row = []

    def handle_data(self, data):
        if self.in_cell:
            self._current_cell += data


# ── Parsers ───────────────────────────────────────────────────────────────────

def parse_wins(html: str) -> dict[str, int]:
    """Return {driver_name: win_count} from the drivers wins page.

    Was a <p>-tag/regex scrape ("1. Jason Plato, 97") until btcc.net moved
    this page to a real <table class="btcc-stats-table"> (Pos/Driver/Wins
    columns) sometime before 2026-09-28, which broke it outright (0 rows
    parsed - confirmed via a temporary CI debug dump, no <p> tags left in
    the fetched HTML at all). Now shares _TableParser with parse_titles()
    below - same "grab the first <table>" approach, already proven to work
    against this site's markup.
    """
    parser = _TableParser()
    parser.feed(html)
    wins = {}
    for row in parser.rows:
        if len(row) < 3:
            continue
        name = row[1].strip()
        try:
            count = int(row[2].strip())
        except ValueError:
            continue
        if name and name.lower() != "driver":
            wins[name] = count
    return wins


def parse_titles(html: str) -> dict[str, int]:
    """Return {driver_name: title_count} from the champions/btcc-titles page."""
    parser = _TableParser()
    parser.feed(html)
    titles = {}
    for row in parser.rows:
        if len(row) < 3:
            continue
        name = row[0].strip().replace("\xa0", "").strip()
        try:
            count = int(row[2].strip())
        except ValueError:
            continue
        if name and name.lower() != "driver":
            titles[name] = count
    return titles


# ── Records update logic ──────────────────────────────────────────────────────

def _blank_historical(name: str) -> dict:
    return {
        "driver": name, "starts": 0, "wins": 0, "podiums": 0, "poles": 0,
        "fastestLaps": 0, "dnfs": 0, "points": 0, "seasons": 0, "championships": 0,
        "bestSeasonWins": 0, "bestSeasonPodiums": 0, "bestSeasonPoles": 0,
        "winStreak": 0, "podiumStreak": 0, "poleStreak": 0,
        "consecutive": 0, "consecutivePoints": 0, "racesLed": 0, "hatTricks": 0,
        "winPct": 0.0, "podiumPct": 0.0, "pointsPerStart": 0.0, "dnfPct": 0.0,
        "historical": True,
    }


def canonical_name(name: str) -> str:
    return NAME_ALIASES.get(name, name)


def apply_updates(
    drivers: list[dict],
    wins: dict[str, int],
    titles: dict[str, int],
) -> tuple[list[dict], list[str]]:
    """
    Apply official wins and title counts to the driver list.
    Adds new historical=True entries for drivers not yet in the list.
    Returns (updated_drivers, change_log).
    """
    lookup = {d["driver"]: d for d in drivers}
    changes = []

    all_official = {canonical_name(n): v for n, v in wins.items()}
    all_official_titles = {canonical_name(n): v for n, v in titles.items()}

    # Update or insert wins
    for official_name, w in wins.items():
        our_name = canonical_name(official_name)
        if our_name in lookup:
            d = lookup[our_name]
            if d["wins"] != w:
                changes.append(f"wins  {our_name}: {d['wins']} -> {w}")
                d["wins"] = w
                if d["starts"] > 0 and not d.get("historical"):
                    d["winPct"] = w / d["starts"]
        else:
            d = _blank_historical(our_name)
            d["wins"] = w
            lookup[our_name] = d
            drivers.append(d)
            changes.append(f"added (wins)  {our_name}: {w}")

    # Update or insert titles
    for official_name, t in titles.items():
        our_name = canonical_name(official_name)
        if our_name in lookup:
            d = lookup[our_name]
            if d["championships"] != t:
                changes.append(f"champ {our_name}: {d['championships']} -> {t}")
                d["championships"] = t
        else:
            d = _blank_historical(our_name)
            d["championships"] = t
            lookup[our_name] = d
            drivers.append(d)
            changes.append(f"added (titles) {our_name}: {t}")

    return drivers, changes


# ── Entry point ───────────────────────────────────────────────────────────────

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true", help="Print changes without writing")
    args = ap.parse_args()

    # Each fetch isolated in its own check - previously a wins-fetch failure
    # sys.exit(1)'d before even attempting titles, so one side being briefly
    # blocked threw away an otherwise-successful update to the other.
    print("Fetching wins from btcc.net...")
    wins_html = fetch_via_scrapfly(WINS_URL, render_js=True, label="wins")
    if wins_html is None:
        print("ERROR: could not fetch wins (Scrapfly fetch failed)", file=sys.stderr)

    print("Fetching titles from btcc.net...")
    # referer=WINS_URL: less proven than scrape_articles.py's listing->article
    # referer fix (these are sibling /history/... pages, not a card-click
    # relationship) - included because it's cheap and plausible, not because
    # it's been confirmed to matter.
    titles_html = fetch_via_scrapfly(TITLES_URL, referer=WINS_URL, render_js=True, label="titles")
    if titles_html is None:
        print("ERROR: could not fetch titles (Scrapfly fetch failed)", file=sys.stderr)

    if wins_html is None and titles_html is None:
        sys.exit(1)  # both fetches failed outright - nothing to do

    wins   = parse_wins(wins_html) if wins_html else {}
    titles = parse_titles(titles_html) if titles_html else {}
    print(f"  Parsed {len(wins)} drivers with wins, {len(titles)} with titles")

    # A page that fetched successfully but parsed to zero rows usually means
    # its structure changed (still worth failing loudly on) - distinct from a
    # genuine fetch failure on the *other* side, which is no longer fatal by
    # itself now that the two fetches are isolated above.
    if (wins_html is not None and not wins) or (titles_html is not None and not titles):
        print("ERROR: fetched a page but parsed no rows - structure may have changed", file=sys.stderr)
        sys.exit(1)

    data    = json.loads(RECORDS.read_text())
    drivers = data["drivers"]
    print(f"  Loaded {len(drivers)} drivers from records.json")

    wins, notes = correct_stale_wins(wins)
    for n in notes:
        print(" ", n)

    drivers, changes = apply_updates(drivers, wins, titles)

    if not changes:
        print("No changes detected.")
        return

    print(f"\n{len(changes)} change(s):")
    for c in changes:
        print(" ", c)

    if args.dry_run:
        print("\n[dry-run] records.json not written.")
        return

    data["drivers"] = drivers
    RECORDS.write_text(json.dumps(data, indent=2, ensure_ascii=False))
    print(f"\nWrote {RECORDS}  ({len(drivers)} drivers)")


if __name__ == "__main__":
    main()
