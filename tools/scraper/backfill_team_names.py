"""
backfill_team_names.py
Reads team_name_map.json and rewrites data/results2014.json - results2023.json,
replacing car-model strings in the `team` field with real team names.
"""

import json
import unicodedata
from collections import Counter
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent

MAP_PATH = Path(__file__).resolve().parent / "team_name_map.json"
mapping = json.loads(MAP_PATH.read_text())
car_year_map: dict[str, dict[str, str]] = mapping["car_year_map"]
driver_year_map: dict[str, dict[str, str]] = mapping["driver_year_map"]
driver_aliases: dict[str, str] = mapping.get("driver_aliases", {})


def _norm(s: str) -> str:
    """Strip Unicode combining characters and lowercase for fuzzy matching."""
    nfkd = unicodedata.normalize("NFKD", s)
    return "".join(c for c in nfkd if not unicodedata.combining(c)).lower()


# Build normalised lookup: {year: {normalised_name: team}}
norm_driver_map: dict[str, dict[str, str]] = {
    yr: {_norm(k): v for k, v in drivers.items()}
    for yr, drivers in driver_year_map.items()
}

# Pre-normalise aliases map: normalised result name -> canonical name
norm_aliases: dict[str, str] = {_norm(k): v for k, v in driver_aliases.items()}

# Prefixes that signal a car-model value rather than a real team name
CAR_PREFIXES = (
    "BMW", "Ford", "Honda", "Toyota", "Hyundai", "Volkswagen", "Vauxhall",
    "Subaru", "Infiniti", "Audi", "SEAT", "Chevrolet", "Mercedes",
    "Alfa Romeo", "Proton", "MG6", "Cupra",
)

unresolved: Counter = Counter()

for year in range(2014, 2024):
    path = REPO_ROOT / "data" / f"results{year}.json"
    if not path.exists():
        print(f"{year}: file not found, skipping")
        continue

    data = json.loads(path.read_text())
    yr_key = str(year)

    total_car = 0
    fixed = 0

    for rnd in data.get("rounds", []):
        for race in rnd.get("races", []):
            for r in race.get("results", []):
                team_val = r.get("team", "")
                if not isinstance(team_val, str):
                    continue
                if not team_val.startswith(CAR_PREFIXES):
                    continue

                total_car += 1
                resolved = None

                # 1. Try car_year_map
                if team_val in car_year_map:
                    resolved = car_year_map[team_val].get(yr_key)

                # 2. Fall back to driver_year_map with normalisation + alias resolution
                if resolved is None:
                    driver_name = r.get("driver", "")
                    normed = _norm(driver_name)
                    # Resolve alias (e.g. "Nic Hamilton" -> "Nicolas Hamilton")
                    canonical = norm_aliases.get(normed, driver_name)
                    # Try exact canonical name first, then normalised lookup
                    yr_drivers = driver_year_map.get(yr_key) or {}
                    resolved = yr_drivers.get(canonical) or norm_driver_map.get(yr_key, {}).get(_norm(canonical))

                if resolved is not None:
                    r["team"] = resolved
                    fixed += 1
                else:
                    unresolved[(team_val, r.get("driver", ""))] += 1

    path.write_text(json.dumps(data, indent=2, ensure_ascii=False))

    pct = (fixed / total_car * 100) if total_car else 0.0
    print(f"{year}: {total_car:4d} car-name entries, {fixed:4d} fixed ({pct:.1f}%)")

# Summary of unresolved entries
total_unresolved = sum(unresolved.values())
print(f"\nTotal unresolved: {total_unresolved}")
if unresolved:
    print("\nTop 20 unresolved (car_name | driver_name | count):")
    for (car, driver), count in unresolved.most_common(20):
        print(f"  {count:4d}  {car!s:40s} | {driver}")
