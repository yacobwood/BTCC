# src/assets/data/

Two different kinds of file live here side by side, on purpose:

- **`season_2004.json` … `season_2025.json`** - finalized historical archives.
  Each has 6 top-level keys (`season`, `drivers`, `teams`, `rounds`,
  `driverStats`, …), built once a season closes and never touched again.
- **`results2026.json`** - the live current-season mirror. Only 2 top-level
  keys (`season`, `rounds`) - same shape as `data/results2026.json` at the
  repo root, bundled into the app so a fresh install has current-season data
  without a network fetch. This file gets replaced wholesale as the season
  progresses; it is not a smaller/broken version of the `season_*.json`
  format, it's a different pipeline's output.

When 2026 ends, expect `results2026.json` to be promoted into a
`season_2026.json` in the richer format, and a fresh `results2027.json` to
take its place as the live mirror.

Correction (2026-08-28): an earlier version of this note pointed at
`tools/scraper/compute_records.py` and `tools/scripts/` as "the
archive-generation scripts" for that promotion. Neither actually does this -
`compute_records.py` only *reads* already-existing `season_*.json` files to
compute all-time records into `data/records.json`, it never writes a new
one; `tools/scripts/` (`excel_to_season_json.py` and siblings) turned out to
be dead code targeting a Kotlin app directory removed 2026-04-09, and has
been deleted. As of this date there is no known live script that performs
the results→season promotion - whoever closes out the 2026 archive will
need to write one or do it by hand. Flagging this plainly rather than
leaving the wrong pointer in place.
