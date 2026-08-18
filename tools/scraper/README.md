# BTCC data scrapers

Scripts that populate **drivers**, **teams**, **circuits**, **calendar**, **news/articles**,
**results/standings**, and **race records** from external sources. Outputs go into `data/`
(plus a few images into `data/media/` and `src/assets/driver_images/`) and are served to the
app via GitHub raw, so the app itself never fetches btcc.net directly.

This file was stale for a long time - it used to document a WordPress-era generation of
scripts (`scrape_standings.py`, `scrape_grid.py`, `scrape_results.py`, `compute_standings.py`,
`update_standings.sh`) that no longer exist. Everything below reflects the actual current
suite, which predates that rewrite by a fair margin (btcc.net's move to Vercel, 2026-07-31).

## btcc.net access model - read this before adding a new scraper

btcc.net is a Vercel-hosted React app protected by Vercel BotID (Kasada-powered): every
request that can't execute JavaScript gets a proof-of-work challenge and a 429, and the
challenge also factors in network/IP reputation on top of the JS check - confirmed by testing
identical Playwright code from both a residential IP (clean) and a GitHub-hosted Actions
runner (still 429'd). No TLS-impersonation trick or IP-relay approach can pass this, since the
block isn't about network identity, it's about being unable to execute JavaScript. So:

- **Every btcc.net-facing scraper renders pages with headless Chromium via `btcc_playwright.py`**
  (`RenderedFetcher`, or `fetch_rendered()` for a genuine one-off single fetch) instead of a
  direct HTTP request.
- **Every btcc.net-facing workflow runs on the self-hosted runner** (label `btcc-mac`, a
  `launchd` service on the maintainer's own Mac - see `~/actions-runner-btcc`), not
  `ubuntu-latest` - an interim fix until btcc.net's dev allowlists this project's traffic.
  `scrape_tsl.py` (TSL Timing PDFs) and `scrape_youtube.py` (YouTube) never touch btcc.net and
  stay on `ubuntu-latest`.
- **`cf-worker/`'s Cloudflare Worker relay is dead code, do not reuse it here.** It solved a
  *different*, now-obsolete problem: the old WordPress origin's IP-reputation WAF block
  (pre-dates the Vercel migration). A Worker can't execute a JS challenge either, so it can't
  help against BotID - `btcc_relay.py`, the Python side of that relay, has already been
  removed; `cf-worker/` itself is still on disk but unreferenced by anything.

Three real incidents have hit this since the Vercel migration, each root-caused and fixed -
see the git history around 2026-08-13/14 and 2026-08-17 (`btcc_playwright.py`'s own comments
cite the specifics) if you're debugging a new one and want the prior art.

## Resilience checklist for any new btcc.net-facing scraper

`RenderedFetcher` bakes in the three defenses proven necessary so far - **you get them for
free just by using the class normally**, nothing extra to opt into:

- **Retry with backoff** (`retries=`/`retry_backoff=` on the constructor, or a per-call
  `retries=` override) - even a persisted session and the correct hostname don't make every
  individual fetch fully reliable; Vercel's BotID occasionally 429s a fraction of "gray area"
  requests.
- **A wall-clock fetch budget** (`budget_seconds=` on the constructor, checked via
  `fetcher.over_budget()` before starting your next item) - `btcc-mac` is the *one* self-hosted
  runner shared by every btcc.net-facing workflow, so an unbounded per-item retry loop can
  starve every other queued workflow of the only runner. Check it before each item in any loop
  over more than one fetch; a script that makes a single fetch doesn't need to.
- **`referer=`** on `get()`/`get_with_media()` when your fetch follows a real link relationship
  (e.g. a driver detail page reached from the `/drivers/` listing) - a bare `page.goto()` never
  sets one on its own, unlike a real in-page navigation. Confirmed via live A/B testing
  (2026-08-14) as the one lever that actually reduced 429s on a listing→detail fetch pattern.

Beyond that: **share one `RenderedFetcher` across every fetch in a run** rather than opening a
fresh one per item - each `__enter__` launches a new browser plus its own startup jitter, which
is itself a bot signal when repeated (root-caused 2026-08-13/14), and wastes shared-runner time
on top of it. If your script loops over more than one URL, open `with RenderedFetcher() as
fetcher:` once, outside the loop, and pass `fetcher` down.

## Setup

```bash
cd tools/scraper
pip install -r requirements.txt
playwright install chromium
```

`requirements.txt` has no version pins today - see its own comment for why (mainly: nobody
running this from a fresh checkout has access to the self-hosted runner's actual
`~/.btcc-scraper-venv` to pin against). The production runner reuses that persistent venv
across runs instead of reinstalling every time.

## Network scrapers (hit an external site)

| Script | Target | Output | Schedule / workflow |
|---|---|---|---|
| `scrape_news.py` | btcc.net/news/ (latest card only) | `data/news.json` + `data/media/news/` | Every 5 min - `scrape-news.yml` |
| `scrape_articles.py` | btcc.net/news/ + each article page | `data/articles/*.json` + `data/media/news/` | Every 5 min, same run as above - `scrape-news.yml` |
| `scrape_calendar.py` (+ `scrape_full_timetable.py`) | btcc.net/calendar/ + each circuit page | `data/calendar.json` | Weekly, Mon 09:00 UTC - `scrape-calendar.yml` |
| `scrape_btcc_stats.py` | btcc.net/history/statistics/drivers/ + /history/champions/btcc-titles/ | `data/records.json` | Weekly, Mon 06:00 UTC - `scrape-btcc-stats.yml` |
| `scrape_team_stats.py` | btcc.net/teams/ + each team page | `data/drivers.json` (`teams[].totalRaces`/`totalWins`) | Weekly, Mon 06:30 UTC - `scrape-team-stats.yml` |
| `scrape_tsl.py` | tsl-timing.com PDFs (not btcc.net) | `data/results{year}.json`, `data/standings.json`, `data/calendar.json` (records) | Every 2 min on race weekends - `scrape-results.yml` (GitHub-hosted) |
| `scrape_youtube.py` | youtube.com (ITV Sport Extra, not btcc.net) | `data/results2026.json`, `data/calendar.json` | Mon+Tue 10:00 UTC - `scrape-youtube.yml` (GitHub-hosted) |
| `scrape_circuit_images.py` | btcc.net/circuit/\<slug\>/ per track | `data/tracks.json` (`imageUrl`) + `data/media/tracks/` | Manual only |

Driver headshots, per-driver car cutouts, number graphics and driver/team card
backgrounds used to be live-scraped too (`scrape_driver_images.py`,
`scrape_driver_cutouts.py`, `scrape_driver_backgrounds.py`, plus an image-mirroring
step inside `scrape_team_stats.py`) - archived 2026-08-18 in favour of a
hand-curated set committed straight into the repo. See "Hardcoded driver/team
images" below and `tools/scraper/archive/README.md`.

## Hardcoded driver/team images (not scraped)

`data/driverImages/`, `data/carImages/`, `data/numberImages/` and
`data/backgroundImages/` hold official team/driver graphics, named
`<car number>.png` (or `<team-slug>.png`/`.jpg` for team-level backgrounds),
referenced by `raw.githubusercontent.com` URL from `data/drivers.json` -
`imageUrl`, `carImageUrl`, `numberImageUrl` (driver-level) and
`cardBgUrl`/`carImageUrl` (team-level). No scraper writes these; replacing an
image means dropping in a new file under the same name (or updating
`drivers.json`'s URL if the name changes) and committing - no code change,
no app release. See `tools/scraper/archive/README.md` for the full mapping
and what each field replaced.

## Local-only utilities (no network fetch)

| Script | What it does | Output |
|---|---|---|
| `scrape_schedule.py` | Pure local transform of `calendar.json`'s already-scraped `fullTimetable` into the app's session-schedule shape | `data/schedule.json` |
| `merge_schedule.py` | Merges `schedule.json` sessions into `data/calendar.json` | `data/calendar.json` |
| `compute_records.py` | Computes all-time driver records from bundled `season_*.json` + `results{year}.json` | `data/records.json` |
| `career_stats.py` | Computes per-driver per-year career stats from the same local archives; has a `--verify-champions` self-check mode | stdout only |
| `backfill_team_names.py` | One-off: rewrites `team` fields in `results2014.json`-`results2023.json` from `team_name_map.json` | `data/results{year}.json` (2014-2023) |
| `build_team_map.py` | One-off: generates `team_name_map.json` from `data/drivers.json` histories | `tools/scraper/team_name_map.json` |

`scrape_schedule.py`/`merge_schedule.py` run as later steps in `scrape-calendar.yml`, right
after `scrape_calendar.py` in the same job, so they see the freshly-written `fullTimetable`.
The rest are manual/ad-hoc maintenance scripts, not wired into any workflow.

## Testing

```bash
cd tools/scraper
python -m pytest .
```

Every network scraper above has a `test_*.py` file using a duck-typed `FakeFetcher`
(`.get()`/`.get_with_media()`/`.over_budget()`) instead of a real Playwright browser - see
`test_btcc_playwright.py` for the one file that does test `RenderedFetcher`'s own retry/budget
logic directly, with stubbed Playwright `Page`/`Context` objects.
