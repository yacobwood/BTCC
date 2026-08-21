#!/usr/bin/env python3
"""
generate_car_thumb.py
Generates the small "-thumb" variant every file in data/carImages/ needs
alongside its full-size original.

Root cause this exists to prevent (root-caused live via a device log capture
on 2026-08-21, not guessed): Android's image pipeline decodes an image to an
uncompressed bitmap sized off its pixel dimensions, not its file size. Every
car image is 1536x1024, which costs 1536*1024*4 = 6MB of decoded memory
regardless of how well the WebP file itself compresses (~90KB on disk) - and
because every driver's car is unique (no URL sharing/dedup the way a team's
shared cardBgUrl gets), rendering all of them on one screen (e.g. the Drivers
grid, one badge per driver) costs a fresh, uncommon-to-dedupe 6MB each. ~23 of
those blew straight through Android's ~192MB decode pool on their own. A
badge or card rendering at well under 200px on screen never needed a
1536x1024 source in the first place - it just needed something small enough
that decoding 20+ of them at once stays nowhere near that cap.

Usage:
    python3 scripts/generate_car_thumb.py                  # regenerate every file in data/carImages/
    python3 scripts/generate_car_thumb.py data/carImages/newdriver.webp   # just one file (e.g. after adding a new car image)

Run this after adding or replacing ANY file in data/carImages/ - nothing else
does it automatically, and DriversScreen.js's carThumbUrl() and
TeamDetailScreen.js's carThumbUrl() both assume the -thumb file already
exists alongside the original (a 404 on it just fails the same way the
full-size request used to, so this step isn't optional).
"""

import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
CAR_IMAGES_DIR = REPO_ROOT / "data" / "carImages"

# ~400px wide is comfortably above what any current use (a ~80px driver-tile
# badge, a ~175px TeamDetailScreen car card) needs even at 3x pixel density,
# while landing at a few hundred KB of decoded memory instead of 6MB.
THUMB_WIDTH = 400
WEBP_QUALITY = 80


def generate_thumb(src_path: Path) -> Path:
    if src_path.stem.endswith("-thumb"):
        print(f"skip (already a thumb): {src_path.name}")
        return None
    thumb_path = src_path.with_name(f"{src_path.stem}-thumb{src_path.suffix}")
    # cwebp resizes directly (and re-encodes to WebP regardless of the
    # source's own format), so this works whether the original is .webp,
    # .png or .jpg - matches every extension currently in data/carImages/.
    subprocess.run(
        ["cwebp", "-quiet", "-q", str(WEBP_QUALITY), "-resize", str(THUMB_WIDTH), "0", str(src_path), "-o", str(thumb_path)],
        check=True,
    )
    print(f"{src_path.name} -> {thumb_path.name} ({thumb_path.stat().st_size // 1024}KB)")
    return thumb_path


def main():
    args = sys.argv[1:]
    if args:
        targets = [Path(a) for a in args]
    else:
        targets = sorted(
            p for p in CAR_IMAGES_DIR.iterdir()
            if p.is_file() and not p.stem.endswith("-thumb")
        )
    for path in targets:
        generate_thumb(path)


if __name__ == "__main__":
    main()
