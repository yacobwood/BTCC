#!/usr/bin/env python3
"""
generate_driver_bundle.py
Regenerates the bundled driver headshots from their full-size source in
data/driverImages/, into TWO separate bundled sizes:
  - src/assets/driver_images/<number>.webp        small, for DriversScreen's
    tile and TeamDetailScreen's roster card (both ~330-400px wide on screen)
  - src/assets/driver_images_large/<number>.webp  bigger, for
    DriverDetailScreen's full-width header photo (~740-1100px on screen)

Root cause the SMALL variant exists (found live 2026-08-22, same session as
the first version of this script): bundling both contexts from one file at
full 683x1024 resolution reintroduced the exact decode-memory-pool crisis
already root-caused and fixed once this session for car images
(scripts/generate_car_thumb.py) - confirmed live via the same
`Pool hard cap violation` native error. DriversScreen's grid mounts 23+
tiles at once (never virtualized), and Fresco's decode pool doesn't release
promptly across screen navigation either - so by the time a driver's own
profile page tried to decode *its* header photo, the pool was already
95%+ full just from scrolling through the grid beforehand, with nothing
left for one more decode. The tile itself never needed more than ~400px in
the first place (only DriverDetailScreen's full-width display did) - this
script's first version bundled everything at the bigger size because
"a driver profile only ever shows one photo at a time" was true in
isolation, but ignored that the *grid* renders 23+ of these before you ever
reach a profile page, and that cost accumulates in a *shared*, not
per-screen, pool.

This is the same lesson generate_car_thumb.py's -thumb/-thumb-crop split
already encoded for car images, applied here to a bundled (not
network-fetched) asset instead - two sizes for two genuinely different
display contexts, not one size serving both.

Requires cwebp (https://formulae.brew.sh/formula/webp).

Usage:
    python3 scripts/generate_driver_bundle.py                    # regenerate every file in data/driverImages/
    python3 scripts/generate_driver_bundle.py data/driverImages/55.webp   # just one file

Run this after adding or replacing ANY file in data/driverImages/ - nothing
else does it automatically. src/assets/driver_images/ is what
getDriverImage() bundles via require() for the grid tile/team card;
src/assets/driver_images_large/ is what getDriverImageLarge() bundles for
the profile header (both in src/assets/driverImages.js) - a driver whose
data/driverImages/ file changes but whose bundled counterpart(s) aren't
regenerated keeps showing the old photo in whichever spot wasn't rerun.
"""

import subprocess
import sys
from pathlib import Path

from PIL import Image

REPO_ROOT = Path(__file__).resolve().parent.parent
SOURCE_DIR = REPO_ROOT / "data" / "driverImages"
SMALL_DIR = REPO_ROOT / "src" / "assets" / "driver_images"
LARGE_DIR = REPO_ROOT / "src" / "assets" / "driver_images_large"

# Grid tile / team roster card: ~330-400px wide on screen at typical device
# density (checked live: a ~557px-tall square tile with the photo at ~90%
# width). 720 on the longer (height) edge lands the width at ~480px for
# these 683x1024-ish sources - comfortably sharp for that display size
# without paying for detail the tile can never show.
MAX_DIMENSION_SMALL = 720
# Profile header: displays at up to ~740-1100 physical px on a typical
# 3x-density phone - a safety ceiling rather than a target, since
# data/driverImages/ sources already sit at/under this in practice.
MAX_DIMENSION_LARGE = 1200
WEBP_QUALITY = 85


def _resize_args(src_path: Path, max_dimension: int) -> list:
    w, h = Image.open(src_path).size
    # Only ever shrink, never enlarge - cwebp's -resize would otherwise
    # happily upscale a smaller source up to the target, bloating the file
    # for zero extra real detail. -resize 0 0 (cwebp's "leave as-is") when
    # nothing exceeds the cap; otherwise scale the longer edge down to it
    # and let the other dimension follow proportionally (the other -resize
    # argument as 0).
    if max(w, h) <= max_dimension:
        return ["-resize", "0", "0"]
    return ["-resize", str(max_dimension), "0"] if w >= h else ["-resize", "0", str(max_dimension)]


def generate_bundle(src_path: Path) -> None:
    for out_dir, max_dimension, label in (
        (SMALL_DIR, MAX_DIMENSION_SMALL, "driver_images"),
        (LARGE_DIR, MAX_DIMENSION_LARGE, "driver_images_large"),
    ):
        out_path = out_dir / f"{src_path.stem}.webp"
        args = _resize_args(src_path, max_dimension)
        subprocess.run(
            ["cwebp", "-quiet", "-q", str(WEBP_QUALITY), *args, str(src_path), "-o", str(out_path)],
            check=True,
        )
        print(f"{src_path.name} -> src/assets/{label}/{out_path.name} ({out_path.stat().st_size // 1024}KB)")


def main():
    args = sys.argv[1:]
    if args:
        targets = [Path(a) for a in args]
    else:
        targets = sorted(SOURCE_DIR.glob("*.webp"))
    LARGE_DIR.mkdir(exist_ok=True)
    for path in targets:
        generate_bundle(path)


if __name__ == "__main__":
    main()
