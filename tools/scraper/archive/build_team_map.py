"""
build_team_map.py
Generates tools/scraper/team_name_map.json from:
  - data/drivers.json  (driver history -> driver_year_map)
  - hard-coded car_year_map for unambiguous single-team cars
"""

import json
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent

# ---------------------------------------------------------------------------
# 1. car_year_map: {car_name: {str(year): team_name}}
# ---------------------------------------------------------------------------
car_year_map = {
    "Ford Focus ST MK.III": {
        **{str(y): "Motorbase Performance" for y in range(2014, 2023)},
        "2023": "NAPA Racing UK",
    },
    "Ford Focus RS": {
        str(y): "Motorbase Performance" for y in range(2018, 2020)
    },
    "Ford Focus ST Mk 4": {
        str(y): "Motorbase Performance" for y in range(2020, 2023)
    },
    "Subaru Levorg GT": {
        str(y): "BTC Racing" for y in range(2016, 2020)
    },
    "Infiniti Q50": {
        str(y): "Laser Tools Racing" for y in range(2015, 2023)
    },
    "Toyota Corolla GR Sport": {
        **{str(y): "Speedworks Motorsport" for y in range(2019, 2023)},
        "2023": "TOYOTA GAZOO Racing UK",
    },
}

# ---------------------------------------------------------------------------
# 2. Manual driver entries for historical drivers no longer in the 2026 lineup
#    Only needed for drivers who raced for current 2026 teams.
# ---------------------------------------------------------------------------
MANUAL_DRIVER_TEAMS: dict[str, dict[int, str]] = {
    # WSR BMW programme
    "Colin Turkington": {y: "West Surrey Racing" for y in range(2014, 2024)},
    "Robert Collard":   {y: "West Surrey Racing" for y in range(2014, 2020)},
    "Stephen Jelley":   {y: "West Surrey Racing" for y in range(2014, 2023)},
    "Andrew Jordan":    {y: "West Surrey Racing" for y in range(2019, 2024)},
    "Sam Tordoff":      {y: "West Surrey Racing" for y in range(2014, 2017)},
    "Tom Oliphant":     {
        **{y: "West Surrey Racing"          for y in range(2017, 2021)},
        **{y: "Team BRISTOL STREET MOTORS"  for y in range(2021, 2023)},
    },
    # Power Maxed Racing (Vauxhall Astra / Cupra)
    "Jason Plato":   {y: "Power Maxed Racing" for y in range(2017, 2022)},
    "Senna Proctor": {y: "Power Maxed Racing" for y in range(2017, 2022)},
    # Common nickname/alias variants resolved here so normalisation handles the rest
    "Nic Hamilton":  {},  # alias for Nicolas Hamilton — handled via driver_aliases below
}

# Aliases: result-file name -> canonical drivers.json name
DRIVER_ALIASES: dict[str, str] = {
    "Nic Hamilton":  "Nicolas Hamilton",
    "Nick Hamilton": "Nicolas Hamilton",
    "Aron Taylor-Smith": "Árón Taylor-Smith",
}

# ---------------------------------------------------------------------------
# 3. driver_year_map: {str(year): {driver_name: team_name}}
# ---------------------------------------------------------------------------
drivers_path = REPO_ROOT / "data" / "drivers.json"
drivers_data = json.loads(drivers_path.read_text())

driver_year_map: dict[str, dict[str, str]] = {}
total_entries = 0

# Seed with manual historical entries
for driver_name, year_teams in MANUAL_DRIVER_TEAMS.items():
    for year, team in year_teams.items():
        yr_key = str(year)
        driver_year_map.setdefault(yr_key, {})[driver_name] = team
        total_entries += 1

# Auto-extract from drivers.json histories
for driver in drivers_data["drivers"]:
    name = driver["name"]
    for entry in driver.get("history", []):
        year = entry.get("year")
        team = entry.get("team")
        if year is None or team is None or year < 2014:
            continue
        yr_key = str(year)
        driver_year_map.setdefault(yr_key, {})[name] = team
        total_entries += 1

# ---------------------------------------------------------------------------
# 4. Write output
# ---------------------------------------------------------------------------
out_path = Path(__file__).resolve().parent / "team_name_map.json"
out_path.write_text(
    json.dumps(
        {
            "car_year_map": car_year_map,
            "driver_year_map": driver_year_map,
            "driver_aliases": DRIVER_ALIASES,
        },
        indent=2,
        ensure_ascii=False,
    )
)

print(f"Written: {out_path}")
print(f"car_year_map entries : {sum(len(v) for v in car_year_map.values())}")
print(f"driver_year_map total: {total_entries} driver-year entries across {len(driver_year_map)} years")
print(f"driver_aliases       : {len(DRIVER_ALIASES)}")
