#!/usr/bin/env python3
"""
Download driver images from data/drivers.json, resize and compress to WebP,
and save to app/src/main/assets/driver_images/{number}.webp.
Run from repo root: python scripts/download_driver_images.py
Bundled images load instantly on fresh install (no network).
"""
import io
import json
import sys
from pathlib import Path

try:
    import requests
    from PIL import Image
except ImportError:
    print("Install: pip install requests Pillow")
    sys.exit(1)

REPO_ROOT = Path(__file__).resolve().parent.parent
DRIVERS_JSON = REPO_ROOT / "data" / "drivers.json"
ASSETS_DIR = REPO_ROOT / "app" / "src" / "main" / "assets" / "driver_images"
MAX_SIZE_PX = 200
WEBP_QUALITY = 85


def main():
    if not DRIVERS_JSON.exists():
        print(f"Not found: {DRIVERS_JSON}")
        sys.exit(1)
    ASSETS_DIR.mkdir(parents=True, exist_ok=True)

    with open(DRIVERS_JSON, encoding="utf-8") as f:
        data = json.load(f)
    drivers = data.get("drivers", [])

    for d in drivers:
        number = d.get("number")
        image_url = (d.get("imageUrl") or "").strip()
        if number is None or not image_url:
            continue
        out_path = ASSETS_DIR / f"{number}.webp"
        try:
            r = requests.get(image_url, timeout=15)
            r.raise_for_status()
            img = Image.open(io.BytesIO(r.content))
            img = img.convert("RGBA") if img.mode != "RGBA" else img
            w, h = img.size
            if max(w, h) > MAX_SIZE_PX:
                ratio = MAX_SIZE_PX / max(w, h)
                new_w = max(1, int(w * ratio))
                new_h = max(1, int(h * ratio))
                img = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
            img.save(out_path, "WEBP", quality=WEBP_QUALITY, method=6)
            print(f"  {number}.webp")
        except Exception as e:
            print(f"  {number} skip: {e}")

    print(f"Done. {len(list(ASSETS_DIR.glob('*.webp')))} images in {ASSETS_DIR}")


if __name__ == "__main__":
    main()
