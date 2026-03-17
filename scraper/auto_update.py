#!/usr/bin/env python3
"""
Auto-detect new BTCC results for the current race weekend and update data if found.

Compares result count on btcc.net against our stored results2026.json.
If btcc.net has more results -> scrapes the full round, updates JSON, recomputes standings.
"""
import json
import subprocess
import sys
from datetime import date
from pathlib import Path

from playwright.sync_api import sync_playwright

sys.path.insert(0, str(Path(__file__).parent))
from scrape_results import ROUNDS, scrape_round  # noqa: E402

YEAR = 2026

RACE_WEEKEND_DATES: dict[str, int] = {
    "2026-04-18": 1, "2026-04-19": 1,
    "2026-05-09": 2, "2026-05-10": 2,
    "2026-05-23": 3, "2026-05-24": 3,
    "2026-06-06": 4, "2026-06-07": 4,
    "2026-07-25": 5, "2026-07-26": 5,
    "2026-08-08": 6, "2026-08-09": 6,
    "2026-08-22": 7, "2026-08-23": 7,
    "2026-09-05": 8, "2026-09-06": 8,
    "2026-09-26": 9, "2026-09-27": 9,
    "2026-10-10": 10, "2026-10-11": 10,
}

RESULTS_FILE = Path(__file__).resolve().parent.parent / "data" / f"results{YEAR}.json"


def result_count(rounds_data: list, round_num: int) -> int:
    for r in rounds_data:
        if r["round"] == round_num:
            return sum(len(race["results"]) for race in r["races"])
    return 0


def races_with_results(rounds_data: list, round_num: int) -> int:
    for r in rounds_data:
        if r["round"] == round_num:
            return sum(1 for race in r["races"] if race["results"])
    return 0


def main() -> None:
    today = date.today().isoformat()
    round_num = RACE_WEEKEND_DATES.get(today)

    if not round_num:
        print(f"[auto-update] Not a race weekend date ({today}) -- nothing to do.")
        return

    round_info = next(r for r in ROUNDS[YEAR] if r["round"] == round_num)
    print(f"[auto-update] Race weekend: Round {round_num} -- {round_info['venue']}")

    with open(RESULTS_FILE) as f:
        data = json.load(f)

    existing_count = result_count(data["rounds"], round_num)
    existing_races = races_with_results(data["rounds"], round_num)
    print(f"[auto-update] Existing: {existing_count} rows across {existing_races} races")

    if existing_races >= 3:
        print("[auto-update] All 3 races already have results -- skipping.")
        return

    print(f"[auto-update] Checking btcc.net for Round {round_num} results...")
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        ctx = browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            viewport={"width": 1280, "height": 900},
        )
        page = ctx.new_page()
        new_round_data = scrape_round(page, round_info)
        browser.close()

    new_count = sum(len(race["results"]) for race in new_round_data["races"])
    new_races = sum(1 for race in new_round_data["races"] if race["results"])
    print(f"[auto-update] btcc.net: {new_count} rows across {new_races} races")

    if new_count <= existing_count:
        print("[auto-update] No new results -- nothing to update.")
        return

    print(f"[auto-update] New results detected ({existing_count} -> {new_count}) -- updating...")
    for i, r in enumerate(data["rounds"]):
        if r["round"] == round_num:
            data["rounds"][i] = new_round_data
            break

    RESULTS_FILE.write_text(json.dumps(data, indent=2))
    print(f"[auto-update] Wrote {RESULTS_FILE}")

    subprocess.run(
        [sys.executable, str(Path(__file__).parent / "compute_standings.py"), str(YEAR), "--write"],
        check=True,
    )
    print("[auto-update] Standings recomputed")


if __name__ == "__main__":
    main()
