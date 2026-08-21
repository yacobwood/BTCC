#!/usr/bin/env python3
"""
generate_car_thumb.py
Generates the small "-thumb" and "-thumb-crop" variants every file in
data/carImages/ needs alongside its full-size original.

Root cause "-thumb" exists to prevent (root-caused live via a device log
capture on 2026-08-21, not guessed): Android's image pipeline decodes an
image to an uncompressed bitmap sized off its pixel dimensions, not its file
size. Every car image is 1536x1024, which costs 1536*1024*4 = 6MB of decoded
memory regardless of how well the WebP file itself compresses (~90KB on
disk) - and because every driver's car is unique (no URL sharing/dedup the
way a team's shared cardBgUrl gets), rendering all of them on one screen
(e.g. the Drivers grid, one badge per driver) costs a fresh,
uncommon-to-dedupe 6MB each. ~23 of those blew straight through Android's
~192MB decode pool on their own. A badge or card rendering at well under
200px on screen never needed a 1536x1024 source in the first place - it just
needed something small enough that decoding 20+ of them at once stays
nowhere near that cap.

Why TWO variants, not one (added 2026-08-21, same day, after the plain
-thumb's padding was flagged as visible on-device): every file in
data/carImages/ is a 1536x1024 canvas, but the car itself only ever occupies
the middle ~40-50% of that canvas's height - roughly 40% blank space above
it and 16% below, baked into every file by whatever process generated them
(checked across all 23 files via PIL's getbbox(), not assumed from one).
That blank space isn't a mistake to crop out everywhere, though:
TeamDetailScreen's hero deliberately relies on it - its sponsor logo sits
absolutely-positioned over the top of the car cards, and the comment on its
carImage style is explicit that the transparent margin is what keeps the
logo from visually clashing with the car artwork underneath it. Cropping
that file would fix DriverDetailScreen's full-width banner (which has no
overlay to protect) while quietly breaking TeamDetailScreen's logo
clearance. So:
  - "-thumb.webp"      unchanged/uncropped, same file TeamDetailScreen.js's
                        carImage has always used - keeps its padding on
                        purpose.
  - "-thumb-crop.webp" new, cropped tight to the visible car (see
                        crop_to_content() below) - DriverDetailScreen.js's
                        carStrip uses this one, since it has nothing an
                        overlay needs to clear.

Requires Pillow (`pip install Pillow>=10.0.0` - already a dependency for
tools/scripts/download_driver_images.py, see tools/scripts/requirements.txt)
for the crop step; cwebp (https://formulae.brew.sh/formula/webp) still does
the actual resize + WebP re-encode for both variants, unchanged from before.

Usage:
    python3 scripts/generate_car_thumb.py                  # regenerate every file in data/carImages/
    python3 scripts/generate_car_thumb.py data/carImages/newdriver.webp   # just one file (e.g. after adding a new car image)

Run this after adding or replacing ANY file in data/carImages/ - nothing else
does it automatically, and DriverDetailScreen.js's carThumbUrl() and
TeamDetailScreen.js's carThumbUrl() both assume their respective -thumb/
-thumb-crop file already exists alongside the original (a 404 on it just
fails the same way the full-size request used to, so this step isn't
optional).
"""

import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image

REPO_ROOT = Path(__file__).resolve().parent.parent
CAR_IMAGES_DIR = REPO_ROOT / "data" / "carImages"

# ~400px wide is comfortably above what -thumb's actual uses (a ~80px
# driver-tile badge, a ~175px TeamDetailScreen car card) need even at 3x
# pixel density, while landing at a few hundred KB of decoded memory instead
# of 6MB.
THUMB_WIDTH = 400
# -thumb-crop needs to be much bigger: DriverDetailScreen's banner renders at
# ~94% of the full screen width, not a small badge/card. Found live
# (2026-08-21, same day, after the crop's first ship looked "blurry"):
# checked the actual numbers rather than guessed - a typical phone's screen
# is ~1240 physical px wide at 3x density, so the banner displays at ~1166px,
# while THUMB_WIDTH's 400px source was being upscaled ~2.9x to fill it. Only
# one of these is ever decoded at a time on this screen (unlike -thumb's
# original ~23-at-once decode-pool problem), so there's plenty of headroom to
# go bigger without approaching that cap again.
CROP_THUMB_WIDTH = 1200
WEBP_QUALITY = 80
# Extra room left around the car's own bounding box, as a fraction of that
# box's own width/height, so the -thumb-crop variant doesn't sit flush
# against the car's edge (mirrors, wing tips, exhaust) - purely a visual
# buffer, not needed for correctness, since getbbox() already includes every
# non-fully-transparent pixel including anti-aliased edges.
CROP_MARGIN_FRAC = 0.05


def cwebp_resize(src_path: Path, out_path: Path, width: int) -> None:
    # cwebp resizes directly (and re-encodes to WebP regardless of the
    # source's own format), so this works whether the original is .webp,
    # .png or .jpg - matches every extension currently in data/carImages/.
    subprocess.run(
        ["cwebp", "-quiet", "-q", str(WEBP_QUALITY), "-resize", str(width), "0", str(src_path), "-o", str(out_path)],
        check=True,
    )


def crop_to_content(src_path: Path) -> Path:
    """Crops src_path to its visible (non-transparent) content plus a small
    margin, writes the result to a temp PNG (lossless, so this doesn't stack
    a second lossy re-encode on top of the final cwebp pass), and returns
    that temp file's path. Falls back to the original file untouched if the
    image has no alpha channel or is fully transparent (shouldn't happen for
    anything in data/carImages/, but resizing the original as-is beats
    crashing this script over one bad file)."""
    im = Image.open(src_path).convert("RGBA")
    bbox = im.getbbox()
    if not bbox:
        return src_path
    x0, y0, x1, y1 = bbox
    mx = int((x1 - x0) * CROP_MARGIN_FRAC)
    my = int((y1 - y0) * CROP_MARGIN_FRAC)
    x0 = max(0, x0 - mx)
    y0 = max(0, y0 - my)
    x1 = min(im.width, x1 + mx)
    y1 = min(im.height, y1 + my)
    cropped = im.crop((x0, y0, x1, y1))
    tmp = tempfile.NamedTemporaryFile(suffix=".png", delete=False)
    cropped.save(tmp.name)
    return Path(tmp.name)


def generate_thumb(src_path: Path) -> None:
    if src_path.stem.endswith(("-thumb", "-thumb-crop")):
        print(f"skip (already a thumb variant): {src_path.name}")
        return

    thumb_path = src_path.with_name(f"{src_path.stem}-thumb{src_path.suffix}")
    cwebp_resize(src_path, thumb_path, THUMB_WIDTH)
    print(f"{src_path.name} -> {thumb_path.name} ({thumb_path.stat().st_size // 1024}KB)")

    crop_thumb_path = src_path.with_name(f"{src_path.stem}-thumb-crop{src_path.suffix}")
    cropped_path = crop_to_content(src_path)
    try:
        cwebp_resize(cropped_path, crop_thumb_path, CROP_THUMB_WIDTH)
    finally:
        if cropped_path != src_path:
            cropped_path.unlink(missing_ok=True)
    print(f"{src_path.name} -> {crop_thumb_path.name} ({crop_thumb_path.stat().st_size // 1024}KB)")


def main():
    args = sys.argv[1:]
    if args:
        targets = [Path(a) for a in args]
    else:
        targets = sorted(
            p for p in CAR_IMAGES_DIR.iterdir()
            if p.is_file() and not p.stem.endswith(("-thumb", "-thumb-crop"))
        )
    for path in targets:
        generate_thumb(path)


if __name__ == "__main__":
    main()
