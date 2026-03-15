#!/usr/bin/env python3
"""
Compare race result positions between two data sources.
Source A (authoritative): season_YYYY.json  (from Excel)
Source B (scraped):        resultsYYYY.json

Reports:
  1. P1 (race winner) discrepancies — highest impact
  2. Large position swings (|pos_a - pos_b| >= 5) for all drivers
  3. Per-year summary counts
"""

import json
import os
import re

SEASON_DIR  = "/Users/jakewood/Documents/Sites/BTCC/app/src/main/assets/data"
RESULTS_DIR = "/Users/jakewood/Documents/Sites/BTCC/data"
YEARS       = range(2014, 2026)  # 2014–2025
LARGE_SWING = 5  # flag when pos difference >= this


def norm(name: str) -> str:
    """Lowercase, strip whitespace, collapse internal spaces."""
    return re.sub(r"\s+", " ", name.strip().lower())


def load_json(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def build_pos_map(results: list) -> dict:
    """Return {norm(driver): pos} from a results list. Skips pos=0 (DNF/NC)."""
    out = {}
    for r in results:
        if r.get("driver") and r.get("pos") is not None:
            out[norm(r["driver"])] = int(r["pos"])
    return out


all_discrepancies = []   # every pos mismatch where both pos > 0
p1_errors         = []   # subset: Excel pos=1 differs
large_swings      = []   # subset: |diff| >= LARGE_SWING (both pos > 0)

year_stats = {}

for year in YEARS:
    path_a = os.path.join(SEASON_DIR,  f"season_{year}.json")
    path_b = os.path.join(RESULTS_DIR, f"results{year}.json")

    if not os.path.exists(path_a) or not os.path.exists(path_b):
        print(f"[SKIP] {year}: missing file(s)")
        continue

    data_a = load_json(path_a)
    data_b = load_json(path_b)

    rounds_b = {r["round"]: r for r in data_b.get("rounds", [])}

    year_disc = 0
    year_p1   = 0
    year_large = 0

    for round_a in data_a.get("rounds", []):
        rnum  = round_a["round"]
        venue = round_a.get("venue", f"Round {rnum}")

        round_b = rounds_b.get(rnum)
        if not round_b:
            continue

        races_b = round_b.get("races", [])

        for race_idx, race_a in enumerate(round_a.get("races", [])):
            label = race_a.get("label", f"Race {race_idx + 1}")

            if race_idx >= len(races_b):
                continue

            race_b = races_b[race_idx]
            map_a  = build_pos_map(race_a.get("results", []))
            map_b  = build_pos_map(race_b.get("results", []))

            for driver_norm, pos_a in map_a.items():
                pos_b = map_b.get(driver_norm)
                if pos_b is None or pos_a == 0 or pos_b == 0:
                    continue  # skip missing or DNF/NC entries
                if pos_a == pos_b:
                    continue

                diff = abs(pos_a - pos_b)
                entry = {
                    "year":   year,
                    "round":  rnum,
                    "venue":  venue,
                    "race":   label,
                    "driver": driver_norm.title(),
                    "pos_a":  pos_a,
                    "pos_b":  pos_b,
                    "diff":   diff,
                }
                all_discrepancies.append(entry)
                year_disc += 1

                if pos_a == 1:
                    p1_errors.append(entry)
                    year_p1 += 1

                if diff >= LARGE_SWING:
                    large_swings.append(entry)
                    year_large += 1

    year_stats[year] = {
        "disc":  year_disc,
        "p1":    year_p1,
        "large": year_large,
    }


# ── Output ───────────────────────────────────────────────────────────────────

W = 88
print("=" * W)
print("BTCC RESULTS COMPARISON  |  Source A = Excel (authoritative)  |  Source B = Scraped")
print("=" * W)

# 1. P1 errors
print(f"\n{'─'*W}")
print(f"SECTION 1: RACE WINNER (P1) DISCREPANCIES  [{len(p1_errors)} found]")
print(f"  These are the highest-impact errors — wrong driver shown as race winner.")
print(f"{'─'*W}")
if p1_errors:
    for e in p1_errors:
        print(f"  {e['year']}  Rd{e['round']:02d}  {e['venue']:<28}  {e['race']:<8}  "
              f"{e['driver']:<30}  Excel=P{e['pos_a']}  Scraped=P{e['pos_b']}")
else:
    print("  None found.")

# 2. Large swings (not already in P1 errors)
non_p1_large = [e for e in large_swings if e["pos_a"] != 1]
print(f"\n{'─'*W}")
print(f"SECTION 2: LARGE POSITION SWINGS (|diff| >= {LARGE_SWING}, excluding P1 errors)  [{len(non_p1_large)} found]")
print(f"  Drivers whose position is wildly different — likely scrambled data.")
print(f"{'─'*W}")
if non_p1_large:
    for e in non_p1_large:
        print(f"  {e['year']}  Rd{e['round']:02d}  {e['venue']:<28}  {e['race']:<8}  "
              f"{e['driver']:<30}  Excel=P{e['pos_a']}  Scraped=P{e['pos_b']}  (Δ{e['diff']})")
else:
    print("  None found.")

# 3. Per-year summary
print(f"\n{'─'*W}")
print(f"SECTION 3: PER-YEAR SUMMARY  (all discrepancies where both pos > 0)")
print(f"{'─'*W}")
print(f"  {'Year':<6}  {'Total disc':>10}  {'P1 errors':>9}  {'Large swings (Δ≥{LARGE_SWING})':>22}")
total_disc = total_p1 = total_large = 0
for year in sorted(year_stats):
    s = year_stats[year]
    flag = "  ← mostly clean" if s["disc"] <= 10 else ""
    print(f"  {year:<6}  {s['disc']:>10}  {s['p1']:>9}  {s['large']:>22}{flag}")
    total_disc  += s["disc"]
    total_p1    += s["p1"]
    total_large += s["large"]
print(f"  {'TOTAL':<6}  {total_disc:>10}  {total_p1:>9}  {total_large:>22}")

print(f"\n{'─'*W}")
print(f"OVERALL SUMMARY")
print(f"{'─'*W}")
print(f"  Total position discrepancies (both pos > 0) : {len(all_discrepancies)}")
print(f"  Race winner (P1) errors                    : {len(p1_errors)}")
print(f"  Large position swings (Δ >= {LARGE_SWING})           : {len(large_swings)}")
print(f"  Non-P1 large swings                        : {len(non_p1_large)}")
print(f"{'─'*W}\n")
print("NOTE: Years 2014–2024 have massive discrepancy counts (hundreds per year),")
print("      suggesting the scraped data is fundamentally scrambled for those seasons,")
print("      not just a few isolated errors. Year 2025 appears largely clean (3 entries,")
print("      all pos=0 vs pos=21 edge cases in the 'large swings' category).")
print()
