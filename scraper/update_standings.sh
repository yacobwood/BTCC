#!/usr/bin/env bash
# Update data/standings.json from data/results{YEAR}.json and optionally push to GitHub.
# Usage: ./scraper/update_standings.sh [YEAR] [--push]
# Example (cron): 0 */6 * * * cd /path/to/BTCC && ./scraper/update_standings.sh 2026 --push
set -e
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"
YEAR="${1:-2026}"
PUSH="${2:-}"

if [[ ! -f "data/results${YEAR}.json" ]]; then
  echo "data/results${YEAR}.json not found. Run your scraper first to produce it." >&2
  exit 1
fi

python3 scraper/compute_standings.py "$YEAR" --write

if [[ "$PUSH" == "--push" ]]; then
  git add data/standings.json
  if git diff --staged --quiet; then
    echo "No changes to standings.json"
  else
    git commit -m "chore: update ${YEAR} standings"
    git push
  fi
fi
