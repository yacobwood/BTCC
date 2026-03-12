# BTCC data scrapers

Scripts to auto-populate **drivers**, **teams**, **race schedule**, and **standings** from [btcc.net](https://btcc.net). Outputs go into `data/` and are served to the app via GitHub (e.g. `data/calendar.json`, `data/standings.json`, `data/drivers.json`).

## Setup

```bash
cd scraper
pip install -r requirements.txt
playwright install chromium
```

## Scripts

| Script | What it does | Output |
|--------|----------------|--------|
| **scrape_standings.py** | Current season driver & team standings (points, wins) from btcc.net | `data/standings.json` |
| **scrape_calendar.py** | Race schedule (round, venue, dates) from btcc.net calendar | Updates dates/venues in `data/calendar.json` or writes `data/calendar_schedule.json` |
| **scrape_grid.py** | Driver list with car numbers from btcc.net drivers page | `data/grid_scraped.json`; optional merge into `data/drivers.json` |
| **scrape_results.py** | Historical race results (Race 1/2/3 per round) for a given year | `data/results{year}.json` |
| **compute_standings.py** | Derive driver/team standings from a `results{year}.json` file | Prints to stdout (for past seasons) |

## Usage

### Live standings (current season)

During the season, run to refresh `data/standings.json`:

```bash
python scrape_standings.py
```

Runs only when today is within the 2026 season window (Apr–Oct). Use `--force` to run outside that window (e.g. to capture a snapshot).

### Race schedule (calendar)

Scrape btcc.net calendar and **merge** dates/venues into existing `data/calendar.json` (keeps track guides, images, etc.):

```bash
python scrape_calendar.py
```

Default season is 2026. Override with `--season 2027`. Use `--dry-run` to print what would be updated without writing.

### Drivers / grid

Scrape driver names and car numbers from btcc.net:

```bash
python scrape_grid.py
```

Writes `data/grid_scraped.json`. To **merge** new/updated numbers into `data/drivers.json` (add new drivers with minimal fields, update numbers for existing names):

```bash
python scrape_grid.py --merge
```

### Historical results

Scrape race results for a specific year (e.g. 2024):

```bash
python scrape_results.py 2024
```

Writes `data/results2024.json`. Requires the year to be listed in the script’s `ROUNDS` dict.

### Compute standings from results

After you have `data/results2024.json`, you can compute championship standings for that year:

```bash
python compute_standings.py 2024
```

Prints driver and team standings; useful for checking or for backfilling historical Standings20XX.kt data.

## Automating (no need to run manually)

**You don’t need to know when BTCC announce the calendar.** GitHub Actions run the scrapers on a schedule and commit changes when data updates.

| What | Workflow | Schedule |
|------|----------|----------|
| **Standings** | `.github/workflows/scrape-standings.yml` | Every 6 hours (during season) |
| **Calendar & grid** | `.github/workflows/scrape-calendar.yml` | **Daily (09:00 UTC)** |

When btcc.net publish the new season calendar, the next day’s run will scrape it and push updated `data/calendar.json`. Same idea for standings (every 6 hours in season) and, if you trigger it manually, grid/drivers.

- **Manual run:** In the repo go to **Actions → Scrape BTCC Calendar & Grid → Run workflow**. You can set the season year and optionally tick “Also scrape drivers and merge into drivers.json”.
- **Standings** can also be run manually with “Force scrape even outside the race season” if you want a one-off capture.

## Data sources

- **Standings**: https://btcc.net/standings/drivers/ and https://btcc.net/standings/teams/ (JS-rendered, needs Playwright).
- **Calendar**: https://btcc.net/calendar/
- **Drivers**: https://btcc.net/drivers/ (JS-rendered, needs Playwright).
- **Results**: https://btcc.net/results/race-results/{slug} per round.

## Notes

- **drivers.json** contains rich data (bios, history, images) that btcc.net doesn’t provide in one place. The grid scraper only updates names/numbers; you still maintain bios and history manually or from other sources.
- **calendar.json** contains track guides, lap records, and images. The calendar scraper only updates round order, venue names, and dates from btcc.net; the rest is preserved from your existing file.
