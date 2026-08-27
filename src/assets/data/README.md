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
`season_2026.json` in the richer format (see `tools/scraper/compute_records.py`
and `tools/scripts/` for the archive-generation scripts), and a fresh
`results2027.json` to take its place as the live mirror.
