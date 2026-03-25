#!/usr/bin/env python3
"""
merge_timing_into_season.py

Copies timing fields (time, gap, bestLap, avgLapSpeed) from
data/results{YEAR}.json into app/src/main/assets/data/season_{YEAR}.json.

Matching:
  - Rounds: by normalised venue name
  - Races:  by label ("Race 1", "Race 2", "Race 3")
  - Drivers: by lowercased full name

Also clears bad 'displayTime' values on P1 entries (e.g. "0.000") so the
app falls back to computing display time from 'time'/'gap'.

Usage:
  python3 scripts/merge_timing_into_season.py          # all years 2004-2025
  python3 scripts/merge_timing_into_season.py 2023     # single year
  python3 scripts/merge_timing_into_season.py 2023 2024
"""

import json, sys, os, unicodedata, re

RESULTS_DIR = os.path.join(os.path.dirname(__file__), '..', 'data')
SEASON_DIR  = os.path.join(os.path.dirname(__file__), '..', 'app', 'src', 'main', 'assets', 'data')


def norm(name: str) -> str:
    """Lowercase, strip diacritics, remove non-alpha, collapse spaces."""
    nfd = unicodedata.normalize('NFD', name)
    stripped = ''.join(c for c in nfd if unicodedata.category(c) != 'Mn')
    return re.sub(r'\s+', ' ', re.sub(r'[^a-z\s]', '', stripped.lower())).strip()


def merge_year(year: int):
    results_path = os.path.join(RESULTS_DIR, f'results{year}.json')
    season_path  = os.path.join(SEASON_DIR,  f'season_{year}.json')

    if not os.path.exists(results_path):
        print(f'  SKIP {year} — results file not found')
        return
    if not os.path.exists(season_path):
        print(f'  SKIP {year} — season file not found')
        return

    results = json.load(open(results_path, encoding='utf-8'))
    season  = json.load(open(season_path,  encoding='utf-8'))

    # Build venue → round lookup from results file
    results_by_venue = {norm(r['venue']): r for r in results.get('rounds', [])}

    updated = skipped = 0

    for s_round in season.get('rounds', []):
        venue_key = norm(s_round['venue'])
        r_round   = results_by_venue.get(venue_key)
        if not r_round:
            print(f'    [{year}] Round {s_round["round"]} {s_round["venue"]}: no match in results — skipping')
            skipped += 1
            continue

        # Build race label → race lookup from results round
        r_races = {rc['label']: rc for rc in r_round.get('races', [])}

        for s_race in s_round.get('races', []):
            r_race = r_races.get(s_race['label'])
            if not r_race:
                continue

            # Build lowercased-name → driver lookup from results race
            r_drivers = {norm(d['driver']): d for d in r_race.get('results', [])}

            for s_dr in s_race.get('results', []):
                r_dr = r_drivers.get(norm(s_dr['driver']))
                if not r_dr:
                    continue

                # Copy timing fields
                if r_dr.get('time'):
                    s_dr['time'] = r_dr['time']
                if r_dr.get('gap'):
                    s_dr['gap'] = r_dr['gap']
                if r_dr.get('bestLap'):
                    s_dr['bestLap'] = r_dr['bestLap']
                if r_dr.get('avgLapSpeed'):
                    s_dr['avgLapSpeed'] = r_dr['avgLapSpeed']

                # Fix bad displayTime on P1 ("0.000" / "0" artefact)
                pos = s_dr.get('pos', 0)
                dt  = s_dr.get('displayTime', '')
                if pos == 1 and dt in ('0.000', '0', '0:00.000', ''):
                    s_dr['displayTime'] = ''

                updated += 1

    json.dump(season, open(season_path, 'w', encoding='utf-8'), ensure_ascii=False)
    # Re-write with 2-space indent to match existing style
    season_str = json.dumps(season, indent=2, ensure_ascii=False)
    open(season_path, 'w', encoding='utf-8').write(season_str)

    print(f'  {year}: updated {updated} driver entries ({skipped} rounds skipped)')


def main():
    args = sys.argv[1:]
    years = [int(a) for a in args if a.isdigit() and 2004 <= int(a) <= 2025] \
            if args else list(range(2004, 2026))
    print(f'Merging timing into season files for: {years}')
    for y in years:
        merge_year(y)
    print('Done.')


if __name__ == '__main__':
    main()
