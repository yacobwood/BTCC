#!/usr/bin/env python3
"""Tests for scrape_driver_media.py - the on-demand driver headshot/car-image
refresh triggered from the admin panel's DRIVER MEDIA card.

DRIVER_PAGE_HTML below is the real markup copied from Daniel Lloyd's live
btcc.net page (confirmed 2026-09-08, via a user-supplied screenshot +
copied outerHTML) - not a guessed fixture."""

import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from scrape_driver_media import _filename_stem, extract_media_urls, main

DRIVER_PAGE_HTML = """
<html><body>
<div class="hero">
  <img class="driver-profile-car" alt="" src="/api/media/03641cb0-51ac-407f-9973-00abfe66d120">
  <img class="driver-profile-cutout" alt="" src="/api/media/6a38cc2e-7391-4ef1-9978-94dac22eca5e">
  <img class="driver-profile-number" alt="123" src="/api/media/596430b6-4eaa-4e1d-a75d-b8b2379da7de">
</div>
</body></html>
"""


class TestExtractMediaUrls(unittest.TestCase):

    def test_extracts_both_cutout_and_car_from_real_markup(self):
        result = extract_media_urls(DRIVER_PAGE_HTML)
        self.assertEqual(result["cutout"], "https://btcc.net/api/media/6a38cc2e-7391-4ef1-9978-94dac22eca5e")
        self.assertEqual(result["car"], "https://btcc.net/api/media/03641cb0-51ac-407f-9973-00abfe66d120")

    def test_returns_none_for_both_when_page_has_neither_selector(self):
        result = extract_media_urls("<html><body>no images here</body></html>")
        self.assertIsNone(result["cutout"])
        self.assertIsNone(result["car"])

    def test_car_selector_does_not_accidentally_match_the_cutout_class(self):
        # Regression guard: "driver-profile-car" must not loosely match
        # against "driver-profile-cutout"'s own class attribute.
        html = '<img class="driver-profile-cutout" alt="" src="/api/media/abc">'
        result = extract_media_urls(html)
        self.assertIsNone(result["car"])
        self.assertEqual(result["cutout"], "https://btcc.net/api/media/abc")


class TestFilenameStem(unittest.TestCase):

    def test_uses_the_existing_urls_stem_when_one_is_already_set(self):
        self.assertEqual(
            _filename_stem(
                "https://raw.githubusercontent.com/yacobwood/BTCC/main/data/driverImages/lloyd.webp",
                "Daniel Lloyd",
            ),
            "lloyd",
        )

    def test_falls_back_to_slugified_surname_when_theres_no_existing_url_yet(self):
        self.assertEqual(_filename_stem(None, "Senna Proctor"), "proctor")

    def test_treats_an_empty_string_url_the_same_as_none(self):
        self.assertEqual(_filename_stem("", "Nick Halstead"), "halstead")


class TestMain(unittest.TestCase):

    def _drivers_json(self, drivers: list[dict]) -> tuple[Path, Path]:
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        tmp_dir = Path(tmp.name)
        path = tmp_dir / "drivers.json"
        path.write_text(json.dumps({"drivers": drivers}))
        return path, tmp_dir

    def _argv(self, name="Daniel Lloyd", slug="daniel-lloyd"):
        return ["scrape_driver_media.py", "--driver-name", name, "--driver-slug", slug]

    def test_exits_nonzero_when_the_driver_name_is_not_found(self):
        path, _ = self._drivers_json([{"name": "Someone Else"}])
        with patch.multiple("scrape_driver_media", DRIVERS_PATH=path), \
             patch("sys.argv", self._argv()):
            with self.assertRaises(SystemExit) as cm:
                main()
        self.assertEqual(cm.exception.code, 1)

    @patch("scrape_driver_media.fetch_via_scrapfly", return_value=None)
    def test_exits_nonzero_when_the_page_fetch_fails(self, mock_fetch):
        path, _ = self._drivers_json([{
            "name": "Daniel Lloyd",
            "imageUrl": "https://raw.githubusercontent.com/yacobwood/BTCC/main/data/driverImages/lloyd.webp",
            "carImageUrl": "https://raw.githubusercontent.com/yacobwood/BTCC/main/data/carImages/lloyd.webp",
        }])
        with patch.multiple("scrape_driver_media", DRIVERS_PATH=path), \
             patch("sys.argv", self._argv()):
            with self.assertRaises(SystemExit) as cm:
                main()
        self.assertEqual(cm.exception.code, 1)

    @patch("scrape_driver_media._regenerate_bundle")
    @patch("scrape_driver_media._save_master_webp")
    @patch("scrape_driver_media.fetch_image_smart", return_value=(b"bytes", "image/webp"))
    @patch("scrape_driver_media.fetch_via_scrapfly", return_value=DRIVER_PAGE_HTML)
    def test_updates_both_existing_files_in_place_without_touching_drivers_json(
        self, mock_fetch, mock_image, mock_save, mock_regen,
    ):
        drivers = [{
            "name": "Daniel Lloyd",
            "imageUrl": "https://raw.githubusercontent.com/yacobwood/BTCC/main/data/driverImages/lloyd.webp",
            "carImageUrl": "https://raw.githubusercontent.com/yacobwood/BTCC/main/data/carImages/lloyd.webp",
        }]
        path, tmp_dir = self._drivers_json(drivers)
        original_json = path.read_text()
        with patch.multiple(
            "scrape_driver_media",
            DRIVERS_PATH=path,
            DRIVER_IMAGES_DIR=tmp_dir / "driverImages",
            CAR_IMAGES_DIR=tmp_dir / "carImages",
        ), patch("sys.argv", self._argv()):
            main()

        self.assertEqual(mock_save.call_count, 2)
        self.assertEqual(mock_regen.call_count, 2)
        dest_paths = sorted(str(c.args[1]) for c in mock_save.call_args_list)
        self.assertTrue(any(p.endswith("driverImages/lloyd.webp") for p in dest_paths))
        self.assertTrue(any(p.endswith("carImages/lloyd.webp") for p in dest_paths))
        # Both URLs already existed - drivers.json must be left untouched.
        self.assertEqual(path.read_text(), original_json)

    @patch("scrape_driver_media._regenerate_bundle")
    @patch("scrape_driver_media._save_master_webp")
    @patch("scrape_driver_media.fetch_image_smart", return_value=(b"bytes", "image/webp"))
    @patch("scrape_driver_media.fetch_via_scrapfly", return_value=DRIVER_PAGE_HTML)
    def test_sets_drivers_json_urls_for_a_driver_with_no_existing_image_yet(
        self, mock_fetch, mock_image, mock_save, mock_regen,
    ):
        drivers = [{"name": "Senna Proctor", "imageUrl": None, "carImageUrl": None}]
        path, tmp_dir = self._drivers_json(drivers)
        with patch.multiple(
            "scrape_driver_media",
            DRIVERS_PATH=path,
            DRIVER_IMAGES_DIR=tmp_dir / "driverImages",
            CAR_IMAGES_DIR=tmp_dir / "carImages",
        ), patch("sys.argv", self._argv(name="Senna Proctor", slug="senna-proctor")):
            main()

        updated = json.loads(path.read_text())["drivers"][0]
        self.assertEqual(
            updated["imageUrl"],
            "https://raw.githubusercontent.com/yacobwood/BTCC/main/data/driverImages/proctor.webp",
        )
        self.assertEqual(
            updated["carImageUrl"],
            "https://raw.githubusercontent.com/yacobwood/BTCC/main/data/carImages/proctor.webp",
        )

    @patch("scrape_driver_media.fetch_image_smart", return_value=None)
    @patch("scrape_driver_media.fetch_via_scrapfly", return_value=DRIVER_PAGE_HTML)
    def test_exits_nonzero_when_both_image_urls_are_found_but_both_fetches_fail(self, mock_fetch, mock_image):
        drivers = [{
            "name": "Daniel Lloyd",
            "imageUrl": "https://raw.githubusercontent.com/yacobwood/BTCC/main/data/driverImages/lloyd.webp",
            "carImageUrl": "https://raw.githubusercontent.com/yacobwood/BTCC/main/data/carImages/lloyd.webp",
        }]
        path, tmp_dir = self._drivers_json(drivers)
        with patch.multiple(
            "scrape_driver_media",
            DRIVERS_PATH=path,
            DRIVER_IMAGES_DIR=tmp_dir / "driverImages",
            CAR_IMAGES_DIR=tmp_dir / "carImages",
        ), patch("sys.argv", self._argv()):
            with self.assertRaises(SystemExit) as cm:
                main()
        self.assertEqual(cm.exception.code, 1)

    @patch("scrape_driver_media.fetch_via_scrapfly", return_value="<html><body>no relevant images</body></html>")
    def test_exits_nonzero_when_the_page_has_neither_image_selector(self, mock_fetch):
        drivers = [{
            "name": "Daniel Lloyd",
            "imageUrl": "https://raw.githubusercontent.com/yacobwood/BTCC/main/data/driverImages/lloyd.webp",
            "carImageUrl": "https://raw.githubusercontent.com/yacobwood/BTCC/main/data/carImages/lloyd.webp",
        }]
        path, _ = self._drivers_json(drivers)
        with patch.multiple("scrape_driver_media", DRIVERS_PATH=path), \
             patch("sys.argv", self._argv()):
            with self.assertRaises(SystemExit) as cm:
                main()
        self.assertEqual(cm.exception.code, 1)

    @patch("scrape_driver_media._regenerate_bundle")
    @patch("scrape_driver_media._save_master_webp")
    @patch("scrape_driver_media.fetch_via_scrapfly", return_value=DRIVER_PAGE_HTML)
    def test_exits_nonzero_when_one_image_updates_but_the_other_found_url_fails_to_fetch(
        self, mock_fetch, mock_save, mock_regen,
    ):
        """Regression coverage for the 2026-09-08 incident: Daniel Lloyd's
        real first run updated his car image fine but Scrapfly 422'd the
        headshot fetch - and the run still reported success (exit 0), so the
        workflow's retry-once step never fired. One image genuinely updating
        must not mask the other one's real fetch failure - this has to exit
        non-zero so the run shows red and the retry actually happens, even
        though the car image below DOES get saved."""
        def fetch_image_smart_side_effect(url, label=""):
            if "headshot" in label:
                return None  # found the URL, but the fetch itself failed
            return (b"bytes", "image/webp")

        drivers = [{
            "name": "Daniel Lloyd",
            "imageUrl": "https://raw.githubusercontent.com/yacobwood/BTCC/main/data/driverImages/lloyd.webp",
            "carImageUrl": "https://raw.githubusercontent.com/yacobwood/BTCC/main/data/carImages/lloyd.webp",
        }]
        path, tmp_dir = self._drivers_json(drivers)
        with patch.multiple(
            "scrape_driver_media",
            DRIVERS_PATH=path,
            DRIVER_IMAGES_DIR=tmp_dir / "driverImages",
            CAR_IMAGES_DIR=tmp_dir / "carImages",
        ), patch("scrape_driver_media.fetch_image_smart", side_effect=fetch_image_smart_side_effect), \
           patch("sys.argv", self._argv()):
            with self.assertRaises(SystemExit) as cm:
                main()
        self.assertEqual(cm.exception.code, 1)
        # The car image that DID succeed must still have been saved - a
        # partial failure shouldn't throw away the half that worked.
        mock_save.assert_called_once()
        mock_regen.assert_called_once()


if __name__ == "__main__":
    unittest.main()
