#!/usr/bin/env python3
"""
One-off backfill of the book_tables.py reports (tyres, top speeds, session
stats, per-lap sector analysis) into an already-scraped season.

Only touches the "analysis" key (plus empty older book fields - see
fill_missing_text_reports) in data/results{year}.json and the
data/analysis/{year}/ files - classification, points and standings are left
exactly as they are, so this is safe to run alongside the live scraper
without re-deriving anything it owns.

Usage:
    python tools/scraper/backfill_book_tables.py 2026            # every round
    python tools/scraper/backfill_book_tables.py 2026 --round 9  # one round
    python tools/scraper/backfill_book_tables.py 2026 --analysis-only
        # only the analysis files + "analysis" keys - skips filling older
        # book reports, which the released app would start showing
"""

import json
import sys
from pathlib import Path

YEAR = int(sys.argv[1]) if len(sys.argv) > 1 and sys.argv[1].isdigit() else 2026
ONLY_ROUND = None
ANALYSIS_ONLY = "--analysis-only" in sys.argv
for i, arg in enumerate(sys.argv):
    if arg == "--round" and i + 1 < len(sys.argv):
        ONLY_ROUND = int(sys.argv[i + 1])

# scrape_tsl parses sys.argv at import time - give it a plain year-only argv
sys.argv = ["scrape_tsl.py", str(YEAR)]
sys.path.insert(0, str(Path(__file__).resolve().parent))
import book_tables  # noqa: E402
import scrape_tsl as s  # noqa: E402


def fill_missing_text_reports(rnd, book_text):
    """Fills (never overwrites) the older text-stream reports for any
    session that has none - recovers what the Qualifying Race heading fixes
    newly reach: every round's QR Lap Chart (never searched for before) and
    2026 Donington GP's whole QR ("QUALIFYING -RACE" typo)."""
    parsed = {
        "bestSpeeds": s.parse_best_speeds(book_text),
        "weather": s.parse_weather(book_text),
        "flagStats": s.parse_flag_stats(book_text),
        "bestSectors": s.parse_best_sectors(book_text),
        "lapChart": s.parse_lap_chart(book_text),
    }
    for race in rnd["races"]:
        if not race.get("results"):
            continue
        number_map = s._number_driver_map(race)
        for field, by_label in parsed.items():
            raw = by_label.get(race["label"])
            if race.get(field) or not raw:
                continue
            if field == "bestSpeeds":
                raw = s._resolve_best_speeds(raw, number_map)
            elif field == "bestSectors":
                raw = s._resolve_best_sectors(raw, number_map)
            elif field == "lapChart":
                raw = s._resolve_lap_chart(raw, number_map)
            race[field] = raw
            print(f"  [filled] {race['label']}: {field}")


def main():
    results_path = s.DATA_DIR / f"results{YEAR}.json"
    data = json.loads(results_path.read_text())
    rounds = {r["round"]: r for r in data.get("rounds", [])}

    for info in s.ROUNDS[YEAR]:
        if ONLY_ROUND and info["round"] != ONLY_ROUND:
            continue
        rnd = rounds.get(info["round"])
        if not rnd or not any(r.get("results") for r in rnd.get("races", [])):
            continue
        url = s.TSL_BASE.format(year=YEAR, tsl=info["tsl"], suffix="trg")
        print(f"\nRound {info['round']}: {info['venue']}  [book] → {url}")
        book = s.fetch_pdf(url)
        if not book:
            print("  book not available - skipped")
            continue
        tables = book_tables.parse_book_tables(book_tables.book_pages(book))
        if not ANALYSIS_ONLY:
            fill_missing_text_reports(rnd, s._pdf_text(book))
        fallback_map = s.round_number_map(rnd["races"])
        for race in rnd["races"]:
            if race.get("results"):
                s._apply_book_tables(race, tables.get(race["label"]) or {}, fallback_map)
        for path in s.write_session_analysis(YEAR, rnd):
            print(f"  [analysis] wrote {path.relative_to(s.REPO_ROOT)}")

    results_path.write_text(json.dumps(data, indent=2))
    print(f"\nWrote {results_path}")


if __name__ == "__main__":
    main()
