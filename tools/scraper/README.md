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
- **`runner-heartbeat.yml`** (GitHub-hosted, hourly) is the only thing that can notice
  `btcc-mac` itself going unreachable - every other workflow's `if: failure()` alert needs a job
  to have actually started to fire at all. See "Self-hosted runner reliability" below.
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

## Self-hosted runner reliability

**2026-08-19 incident:** `btcc-mac` (a laptop, not a server) dropped onto battery power
overnight and macOS suspended it into idle/maintenance sleep repeatedly for ~5 hours;
`actions-runner`'s long-poll connection to GitHub froze mid-request each time and didn't error
out until the machine woke back up, by which point `scrape-news.yml`'s `cancel-in-progress`
concurrency group had already killed the stale queued run and queued a fresh one behind it - so
every 5-minute tick queued, sat, and got cancelled without ever executing, for ~5 hours straight,
and no news.json commit landed in that window.

`runner-heartbeat.yml` (the workflow that exists specifically to catch `btcc-mac` going
unreachable) **stayed "healthy" the entire outage**: its check only confirmed a `scrape-news`
run had been *created* recently, and GitHub's own cron scheduler kept creating one every 5
minutes regardless of whether any runner ever picked it up. Fixed by also checking whether the
most recent run's job actually reached a runner (`jobs[0].started_at`) and whether the last 3
runs were all cancelled before starting - either is now sufficient to alert on its own, since a
single cancelled run (a slow-but-real scrape superseded by the next tick) is expected and
benign, but three or more in a row queued-then-cancelled is not.

This doesn't prevent the underlying outage (that's a physical "keep the laptop plugged in /
awake" problem, not a code one) - it only closes the alerting blind spot so a recurrence gets
reported instead of silently self-resolving hours later.

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
| `scrape_gallery.py` | btcc.net/gallery/\<year\>/ + per-album pages (both paginated) | `data/gallery{year}.json` + `data/gallery/{year}/*.json` (no image bytes - photos are hotlinked directly, see below) | Weekly, Wed 09:00 UTC - `scrape-gallery.yml` |

**`scrape_gallery.py` is the one exception to "every btcc.net image must be mirrored"** - confirmed live 2026-08-28 (direct `curl`, no browser/auth/special headers): gallery photos are served as direct, PUBLIC (non-signed, non-expiring) Supabase Storage URLs on a completely different host than btcc.net. Vercel's bot-challenge protects btcc.net's own Vercel deployment specifically - it has no reach over a different origin, unlike article/driver/circuit images which route through btcc.net's own `/api/media/<uuid>` redirector (same origin as the challenge, confirmed blocked - see `scrape_articles.py`'s own docstring). So this scraper stores the real photo URLs directly (`{thumbUrl, viewUrl}` per photo, the large "display" variant derived from the small "thumb" one via a simple URL-suffix swap - same idea as this codebase's own `wpThumb()`/`carThumbUrl()`, just a different naming convention) and never downloads/mirrors any image bytes at all - no `data/media/gallery/`. Both the year-listing page and each album's own photo grid paginate independently (`?page=N` - a single album can span many pages, e.g. Donington Park's 2026 album alone is 9), so the scraper tracks `lastPageScraped`/`totalPages`/`complete` per album and resumes any incomplete album's next unscraped page before starting a new one - a routine run's cost is bounded by page loads, not photo downloads. A round can have more than one published album (e.g. a main "2026 - Donington Park GP" album and a separately-published "The Captured Moments: Donington Park GP" one) - `match_round()` resolves each independently, preferring the longest/most-specific venue-name match when one venue name is a literal prefix of another (e.g. "Donington Park" vs "Donington Park GP") rather than treating that as ambiguous.

Driver headshots, per-driver car cutouts, number graphics and driver/team card
backgrounds used to be live-scraped too (`scrape_driver_images.py`,
`scrape_driver_cutouts.py`, `scrape_driver_backgrounds.py`, plus an image-mirroring
step inside `scrape_team_stats.py`) - archived 2026-08-18 in favour of a
hand-curated set committed straight into the repo. See "Hardcoded driver/team
images" below and `tools/scraper/archive/README.md`.

## Hardcoded driver/team images (not scraped)

`data/driverImages/`, `data/carImages/`, `data/numberImages/` and
`data/backgroundImages/` hold official team/driver graphics (naming
convention varies by folder and has changed over time - see the root
`README.md`'s "Hardcoded driver/team images" entry for the current state
of each one), referenced by `raw.githubusercontent.com` URL from
`data/drivers.json` -
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

`scrape_schedule.py`/`merge_schedule.py` run as later steps in `scrape-calendar.yml`, right
after `scrape_calendar.py` in the same job, so they see the freshly-written `fullTimetable`.

`backfill_team_names.py` and `build_team_map.py` already did their one-off job and have been
moved to `archive/` - see `archive/README.md` for what they did.
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
