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
import urllib.request
from html.parser import HTMLParser
from pathlib import Path

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


# ── HTML helpers ─────────────────────────────────────────────────────────────

def _fetch(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": "btcc-stats-scraper/1.0"})
    with urllib.request.urlopen(req, timeout=15) as r:
        return r.read().decode("utf-8", errors="replace")


def _strip_tags(html: str) -> str:
    """Remove all HTML tags and decode common entities."""
    text = re.sub(r"<[^>]+>", "", html)
    for ent, ch in [("&amp;", "&"), ("&nbsp;", " "), ("&lt;", "<"), ("&gt;", ">"),
                    ("&#xa0;", " "), ("\xa0", " ")]:
        text = text.replace(ent, ch)
    return text.strip()


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

# Matches lines like "1. Jason Plato, 97" or "=8. Alain Menu, 36"
_WIN_LINE = re.compile(r"^=?\d+\.\s+(.+),\s*(\d+)$")


def parse_wins(html: str) -> dict[str, int]:
    """Return {driver_name: win_count} from the drivers wins page."""
    # Each entry is a <p> tag; extract the text of every <p> and filter
    p_texts = re.findall(r"<p[^>]*>(.*?)</p>", html, re.DOTALL)
    wins = {}
    for raw in p_texts:
        text = _strip_tags(raw)
        m = _WIN_LINE.match(text)
        if m:
            wins[m.group(1).strip()] = int(m.group(2))
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

    print("Fetching wins from btcc.net...")
    try:
        wins_html = _fetch(WINS_URL)
    except Exception as e:
        print(f"ERROR fetching wins: {e}", file=sys.stderr)
        sys.exit(1)

    print("Fetching titles from btcc.net...")
    try:
        titles_html = _fetch(TITLES_URL)
    except Exception as e:
        print(f"ERROR fetching titles: {e}", file=sys.stderr)
        sys.exit(1)

    wins   = parse_wins(wins_html)
    titles = parse_titles(titles_html)
    print(f"  Parsed {len(wins)} drivers with wins, {len(titles)} with titles")

    if not wins or not titles:
        print("ERROR: empty parse result — page structure may have changed", file=sys.stderr)
        sys.exit(1)

    data    = json.loads(RECORDS.read_text())
    drivers = data["drivers"]
    print(f"  Loaded {len(drivers)} drivers from records.json")

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
