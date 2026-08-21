#!/usr/bin/env python3
"""
generate_driver_bundle.py
Regenerates the bundled driver headshots in src/assets/driver_images/ from
their full-size source in data/driverImages/.

Root cause this exists to prevent (found live 2026-08-21, in the same
session as the car-image blur fixes in scripts/generate_car_thumb.py):
src/assets/driver_images/*.webp had been shrunk to 300x450 at some point in
the past (no script or record of when/why - just a manual one-off resize),
which was fine while the driver photo only ever rendered as a small tile
badge. Once DriversScreen's tile gave the photo the tile's full height and
DriverDetailScreen's header gave it the full header width (both 2026-08-21,
same session), the actual on-screen size grew well past what a 300px-wide
source can render sharply - on a typical 3x-density phone,
DriverDetailScreen's header photo displays at roughly 740x1100 physical
pixels, a ~2.5x upscale from a 300px-wide source. data/driverImages/'s own
originals are already close to the right size (683x1024, only a mild ~1.1x
upscale left at that same display size) - there was never a good reason to
have shrunk them down to 300x450 for bundling in the first place.

This bundles straight from that source at (up to) MAX_DIMENSION, not a
smaller fixed target - unlike generate_car_thumb.py's -thumb/-thumb-crop,
there's no decode-memory-pool concern here (a driver profile only ever
shows one photo at a time, and DriversScreen's tiles use the same bundled
require() map so there's no per-tile network decode at all), so there's no
reason to shrink below what the source already comfortably is.

Bundled assets are matched to data/driverImages/ by filename (car number,
e.g. 55.webp) - not every bundled file has a source counterpart (two departed
drivers, 19.webp/Max Buxton and 132.webp/James Dorlin, have no data/
driverImages/ file to regenerate from) - those are left untouched, since
there's nothing to regenerate them from.

Requires cwebp (https://formulae.brew.sh/formula/webp).

Usage:
    python3 scripts/generate_driver_bundle.py                    # regenerate every file in data/driverImages/
    python3 scripts/generate_driver_bundle.py data/driverImages/55.webp   # just one file

Run this after adding or replacing ANY file in data/driverImages/ - nothing
else does it automatically, and src/assets/driver_images/ is what
getDriverImage() in src/assets/driverImages.js actually bundles into the app
via require() - a driver whose data/driverImages/ file changes but whose
bundled counterpart isn't regenerated keeps showing the old photo.
"""

import subprocess
import sys
from pathlib import Path

from PIL import Image

REPO_ROOT = Path(__file__).resolve().parent.parent
SOURCE_DIR = REPO_ROOT / "data" / "driverImages"
BUNDLE_DIR = REPO_ROOT / "src" / "assets" / "driver_images"

# A safety ceiling, not a target - data/driverImages/ sources are already
# close to (usually just under) this, so in practice this never actually
# resizes anything down; it's there so a future, much larger source doesn't
# get bundled at full size for no reason. Comfortably covers
# DriverDetailScreen's full-width header photo (~740-1100 physical px on a
# typical 3x-density phone) with headroom for higher-density/larger-screen
# devices, without bundling something far bigger than any real use needs.
MAX_DIMENSION = 1200
WEBP_QUALITY = 85


def generate_bundle(src_path: Path) -> None:
    bundle_path = BUNDLE_DIR / f"{src_path.stem}.webp"
    w, h = Image.open(src_path).size
    # Only ever shrink, never enlarge - these sources sit just under
    # MAX_DIMENSION already, and cwebp's -resize would otherwise happily
    # upscale a smaller source up to the target, which just bloats the file
    # for zero extra real detail. -resize 0 0 (cwebp's "leave as-is") when
    # nothing exceeds the cap; otherwise scale the longer edge down to it
    # and let the other dimension follow proportionally (the other -resize
    # argument as 0).
    if max(w, h) > MAX_DIMENSION:
        args = ["-resize", str(MAX_DIMENSION), "0"] if w >= h else ["-resize", "0", str(MAX_DIMENSION)]
    else:
        args = ["-resize", "0", "0"]
    subprocess.run(
        ["cwebp", "-quiet", "-q", str(WEBP_QUALITY), *args, str(src_path), "-o", str(bundle_path)],
        check=True,
    )
    print(f"{src_path.name} -> src/assets/driver_images/{bundle_path.name} ({bundle_path.stat().st_size // 1024}KB)")


def main():
    args = sys.argv[1:]
    if args:
        targets = [Path(a) for a in args]
    else:
        targets = sorted(SOURCE_DIR.glob("*.webp"))
    for path in targets:
        generate_bundle(path)


if __name__ == "__main__":
    main()
