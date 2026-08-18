# Archived scrapers

Scripts here are kept for reference but are no longer run - not on a
schedule, not called from another script, not wired into any GitHub
Actions workflow.

## scrape_driver_images.py, scrape_driver_cutouts.py, scrape_driver_backgrounds.py

Archived 2026-08-18. These three lived-scraped a driver's headshot
(`imageUrl`), their bundled `src/assets/driver_images/<number>.webp`
cutout, and their card-background graphic (`cardBgUrl`) from btcc.net.

Replaced by a hand-curated set of official team/driver graphics dropped
directly into the repo:

| Old field                          | New source                              |
|-------------------------------------|------------------------------------------|
| driver `imageUrl`                   | `data/driverImages/<number>.png`         |
| driver `cardBgUrl` (per-driver override) | `data/backgroundImages/driver-<number>.png` |
| team `cardBgUrl`                    | `data/backgroundImages/<team-slug>.png`  |
| team `carImageUrl`                  | `data/carImages/<number>.png`            |
| driver `carImageUrl` (new, no UI consumer yet) | `data/carImages/<number>.png` |
| driver `numberImageUrl` (new)       | `data/numberImages/<number>.png`         |

All four are referenced from `data/drivers.json` by
`raw.githubusercontent.com` URL, the same way every other live-scraped
field already works - no app release needed to change one, just replace
the file and re-point the URL (or update the file's contents in place,
since the URL is stable).

`scrape_team_stats.py` (not archived - it also scrapes team
races/wins totals, which are still live) had its matching
`cardBgUrl`/`carImageUrl` team-image-mirroring code stripped out at the
same time; see its own docstring.

`driver-123.jpg` is Daniel Lloyd's own Restart Racing background override
(checkered/tyre-tread design, distinct from the team-generic diagonal-stripe
`restart-racing.png` his teammate Chris Smiley still uses) - confirmed by
the user 2026-08-18, same override mechanism as Nicolas Hamilton's
`driver-28.png`.

Two active drivers currently have no hardcoded car/number/headshot file
(Senna Proctor entirely; Nick Halstead's headshot) - once real ones are
provided, drop them in following the `<number>.png` convention above and
no code change is needed, `drivers.json`'s corresponding URL field just
needs setting.

Tests for these three scripts were removed rather than moved here
alongside them, since `python -m pytest .` (see ../README.md) discovers
`test_*.py` recursively and would otherwise keep "running" tests for code
that's deliberately no longer run. Their old content (TestScrapeDriverBackgrounds,
TestScrapeDriverCutouts, TestScrapeDriverImages, plus the driver-card-bg/
driver-profile-cutout cases of TestDualShapeMediaRegexes) is still in git
history in `tools/scraper/test_driver_media_scrapers.py` as of the commit
before this archive.
