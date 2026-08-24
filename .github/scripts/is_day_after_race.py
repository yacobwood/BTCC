#!/usr/bin/env python3
"""
Checks whether "today" is the morning after a BTCC race round ended, and if
so, which round it was. Used to gate scrape-penalties.yml: BARC's judicial
decision PDFs are posted live during each session (confirmed by their own
timestamps), so by the Monday after a Sat/Sun round every decision from that
weekend is already up - no need to poll during the race itself the way
scrape-results.yml does.

Outputs to GITHUB_OUTPUT:
  is_day_after_race=true/false  — yesterday was a round's endDate
  round=<n>                     — that round's number (only set if true)
"""
import json
import os
from datetime import date, timedelta
from pathlib import Path


def find_round_ending_on(rounds, target_date):
    """Returns the round number whose endDate == target_date, or None."""
    for r in rounds:
        try:
            end = date.fromisoformat(r["endDate"])
        except (KeyError, ValueError):
            continue
        if end == target_date:
            return r["round"]
    return None


if __name__ == "__main__":
    ROOT = Path(__file__).parent.parent.parent
    cal = json.loads((ROOT / "data" / "calendar.json").read_text(encoding="utf-8"))

    yesterday = date.today() - timedelta(days=1)
    round_number = find_round_ending_on(cal.get("rounds", []), yesterday)
    is_day_after_race = round_number is not None

    print(f"today: {date.today()}  yesterday: {yesterday}  day_after_race: {is_day_after_race}"
          + (f"  round: {round_number}" if round_number is not None else ""))

    github_output = os.environ.get("GITHUB_OUTPUT", "")
    if github_output:
        with open(github_output, "a", encoding="utf-8") as f:
            f.write(f"is_day_after_race={'true' if is_day_after_race else 'false'}\n")
            if round_number is not None:
                f.write(f"round={round_number}\n")
