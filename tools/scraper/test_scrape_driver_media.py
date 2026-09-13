#!/usr/bin/env python3
"""Tests for scrape_driver_media.py - the on-demand driver headshot/car-image/
car-number-graphic refresh triggered from the admin panel's DRIVER MEDIA card.

DRIVER_PAGE_HTML below is the real markup copied from Daniel Lloyd's live
btcc.net page (confirmed 2026-09-08, via a user-supplied screenshot +
copied outerHTML) - not a guessed fixture."""

import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from scrape_driver_media import _filename_stem, extract_media_urls, main, refresh_driver_media

DRIVER_PAGE_HTML = """
<html><body>
<div class="hero">
  <img class="driver-profile-car" alt="" src="/api/media/03641cb0-51ac-407f-9973-00abfe66d120">
  <img class="driver-profile-cutout" alt="" src="/api/media/6a38cc2e-7391-4ef1-9978-94dac22eca5e">
  <img class="driver-profile-number" alt="123" src="/api/media/596430b6-4eaa-4e1d-a75d-b8b2379da7de">
</div>
</body></html>
"""

# Standard driver dict for tests where all three fields already exist -
# keeps every test that shouldn't touch drivers.json actually inert.
_LLOYD = {
    "name": "Daniel Lloyd",
    "number": 123,
    "imageUrl": "https://raw.githubusercontent.com/yacobwood/BTCC/main/data/driverImages/lloyd.webp",
    "carImageUrl": "https://raw.githubusercontent.com/yacobwood/BTCC/main/data/carImages/lloyd.webp",
    "numberImageUrl": "https://raw.githubusercontent.com/yacobwood/BTCC/main/data/numberImages/123.png",
}


class TestExtractMediaUrls(unittest.TestCase):

    def test_extracts_cutout_car_and_number_from_real_markup(self):
        result = extract_media_urls(DRIVER_PAGE_HTML)
        self.assertEqual(result["cutout"], "https://btcc.net/api/media/6a38cc2e-7391-4ef1-9978-94dac22eca5e")
        self.assertEqual(result["car"], "https://btcc.net/api/media/03641cb0-51ac-407f-9973-00abfe66d120")
        self.assertEqual(result["number"], "https://btcc.net/api/media/596430b6-4eaa-4e1d-a75d-b8b2379da7de")

    def test_returns_none_for_all_three_when_page_has_no_selectors(self):
        result = extract_media_urls("<html><body>no images here</body></html>")
        self.assertIsNone(result["cutout"])
        self.assertIsNone(result["car"])
        self.assertIsNone(result["number"])

    def test_car_selector_does_not_accidentally_match_the_cutout_class(self):
        # Regression guard: "driver-profile-car" must not loosely match
        # against "driver-profile-cutout"'s own class attribute.
        html = '<img class="driver-profile-cutout" alt="" src="/api/media/abc">'
        result = extract_media_urls(html)
        self.assertIsNone(result["car"])
        self.assertEqual(result["cutout"], "https://btcc.net/api/media/abc")

    def test_number_selector_does_not_accidentally_match_the_car_or_cutout_class(self):
        html = '<img class="driver-profile-car" src="/api/media/x"><img class="driver-profile-cutout" src="/api/media/y">'
        result = extract_media_urls(html)
        self.assertIsNone(result["number"])


class TestFilenameStem(unittest.TestCase):

    def test_uses_the_existing_urls_stem_when_one_is_already_set(self):
        self.assertEqual(
            _filename_stem(
                "https://raw.githubusercontent.com/yacobwood/BTCC/main/data/driverImages/lloyd.webp",
                "Daniel Lloyd",
            ),
            "lloyd",
        )

    def test_falls_back_to_the_given_stem_when_theres_no_existing_url_yet(self):
        # fallback_stem is the surname/car-number the CALLER already picked -
        # _filename_stem itself no longer extracts a surname from a full
        # name (that split moved to main(), which needs the surname
        # separately for headshot/car but the car NUMBER for numberImages -
        # a single hardcoded "last word of the name" split couldn't serve
        # both conventions).
        self.assertEqual(_filename_stem(None, "Proctor"), "proctor")

    def test_treats_an_empty_string_url_the_same_as_none(self):
        self.assertEqual(_filename_stem("", "Halstead"), "halstead")

    def test_falls_back_to_a_car_number_fine_too_not_just_a_surname(self):
        # numberImages/ is named by car number, not surname - confirms
        # _filename_stem is genuinely convention-agnostic, just slugifying
        # whatever fallback_stem it's given.
        self.assertEqual(_filename_stem(None, "123"), "123")


class TestRefreshDriverMedia(unittest.TestCase):
    """refresh_driver_media() itself - the function extracted 2026-09-09 so
    scrape_driver_roster.py's weekly sweep can call the same per-driver
    logic main() below already relies on. main()'s own tests above already
    cover every per-image status combination via the full CLI - these focus
    on refresh_driver_media's own direct contract (in-place mutation, return
    shape) since it now has a second, non-CLI caller."""

    @patch("scrape_driver_media._regenerate_bundle")
    @patch("scrape_driver_media._save_master_image")
    @patch("scrape_driver_media.fetch_image_smart", return_value=(b"bytes", "image/webp"))
    @patch("scrape_driver_media.fetch_via_scrapfly", return_value=DRIVER_PAGE_HTML)
    def test_returns_the_three_statuses_and_mutates_drv_in_place(
        self, mock_fetch, mock_image, mock_save, mock_regen,
    ):
        drv = {"name": "Senna Proctor", "number": 55, "imageUrl": None, "carImageUrl": None, "numberImageUrl": None}
        with patch.multiple(
            "scrape_driver_media",
            DRIVER_IMAGES_DIR=Path("/tmp/driverImages"),
            CAR_IMAGES_DIR=Path("/tmp/carImages"),
            NUMBER_IMAGES_DIR=Path("/tmp/numberImages"),
        ):
            statuses = refresh_driver_media(drv, "senna-proctor")
        self.assertEqual(statuses, ("ok", "ok", "ok"))
        # The caller (main(), or scrape_driver_roster.py) owns writing
        # drivers.json back to disk - refresh_driver_media only needs to
        # mutate the dict it was given.
        self.assertEqual(drv["imageUrl"], "https://raw.githubusercontent.com/yacobwood/BTCC/main/data/driverImages/proctor.webp")
        self.assertEqual(drv["carImageUrl"], "https://raw.githubusercontent.com/yacobwood/BTCC/main/data/carImages/proctor.webp")
        self.assertEqual(drv["numberImageUrl"], "https://raw.githubusercontent.com/yacobwood/BTCC/main/data/numberImages/55.png")

    @patch("scrape_driver_media.fetch_via_scrapfly", return_value=None)
    def test_returns_none_without_raising_when_the_page_fetch_fails(self, mock_fetch):
        # A caller sweeping many drivers (scrape_driver_roster.py) needs to
        # tell "this driver's page failed to load this week, skip them" apart
        # from "the page loaded but every image on it failed" - only the
        # former is a plain None, not a fabricated ("failed","failed","failed").
        drv = dict(_LLOYD)
        result = refresh_driver_media(drv, "daniel-lloyd")
        self.assertIsNone(result)
        # Nothing should have been touched - drv is exactly as given.
        self.assertEqual(drv, _LLOYD)

    def test_strips_a_leading_or_trailing_slash_from_the_slug(self):
        with patch("scrape_driver_media.fetch_via_scrapfly", return_value=None) as mock_fetch:
            refresh_driver_media(dict(_LLOYD), "/daniel-lloyd/")
        self.assertEqual(mock_fetch.call_args.args[0], "https://btcc.net/driver/daniel-lloyd/")


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

    def _dirs(self, tmp_dir: Path) -> dict:
        """The three image dirs, patched to a temp location - shared by
        every test that lets a real (mocked-save) run reach that far."""
        return dict(
            DRIVER_IMAGES_DIR=tmp_dir / "driverImages",
            CAR_IMAGES_DIR=tmp_dir / "carImages",
            NUMBER_IMAGES_DIR=tmp_dir / "numberImages",
        )

    def test_exits_nonzero_when_the_driver_name_is_not_found(self):
        path, _ = self._drivers_json([{"name": "Someone Else"}])
        with patch.multiple("scrape_driver_media", DRIVERS_PATH=path), \
             patch("sys.argv", self._argv()):
            with self.assertRaises(SystemExit) as cm:
                main()
        self.assertEqual(cm.exception.code, 1)

    @patch("scrape_driver_media.fetch_via_scrapfly", return_value=None)
    def test_exits_nonzero_when_the_page_fetch_fails(self, mock_fetch):
        path, _ = self._drivers_json([_LLOYD])
        with patch.multiple("scrape_driver_media", DRIVERS_PATH=path), \
             patch("sys.argv", self._argv()):
            with self.assertRaises(SystemExit) as cm:
                main()
        self.assertEqual(cm.exception.code, 1)

    @patch("scrape_driver_media._regenerate_bundle")
    @patch("scrape_driver_media._save_master_image")
    @patch("scrape_driver_media.fetch_image_smart", return_value=(b"bytes", "image/webp"))
    @patch("scrape_driver_media.fetch_via_scrapfly", return_value=DRIVER_PAGE_HTML)
    def test_updates_all_three_existing_files_in_place_without_touching_drivers_json(
        self, mock_fetch, mock_image, mock_save, mock_regen,
    ):
        path, tmp_dir = self._drivers_json([_LLOYD])
        original_json = path.read_text()
        with patch.multiple("scrape_driver_media", DRIVERS_PATH=path, **self._dirs(tmp_dir)), \
             patch("sys.argv", self._argv()):
            main()

        self.assertEqual(mock_save.call_count, 3)
        # Only headshot and car have a bundled RN asset to regenerate -
        # number graphics are always network-fetched, no bundle step exists.
        self.assertEqual(mock_regen.call_count, 2)
        dest_paths = sorted(str(c.args[1]) for c in mock_save.call_args_list)
        self.assertTrue(any(p.endswith("driverImages/lloyd.webp") for p in dest_paths))
        self.assertTrue(any(p.endswith("carImages/lloyd.webp") for p in dest_paths))
        self.assertTrue(any(p.endswith("numberImages/123.png") for p in dest_paths))
        # All three URLs already existed - drivers.json must be left untouched.
        self.assertEqual(path.read_text(), original_json)

    @patch("scrape_driver_media._regenerate_bundle")
    @patch("scrape_driver_media._save_master_image")
    @patch("scrape_driver_media.fetch_image_smart", return_value=(b"bytes", "image/webp"))
    @patch("scrape_driver_media.fetch_via_scrapfly", return_value=DRIVER_PAGE_HTML)
    def test_sets_drivers_json_urls_for_a_driver_with_no_existing_image_of_any_kind_yet(
        self, mock_fetch, mock_image, mock_save, mock_regen,
    ):
        drivers = [{"name": "Senna Proctor", "number": 55, "imageUrl": None, "carImageUrl": None, "numberImageUrl": None}]
        path, tmp_dir = self._drivers_json(drivers)
        with patch.multiple("scrape_driver_media", DRIVERS_PATH=path, **self._dirs(tmp_dir)), \
             patch("sys.argv", self._argv(name="Senna Proctor", slug="senna-proctor")):
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
        # Number graphics are named by car NUMBER, not surname - "55", not "proctor".
        self.assertEqual(
            updated["numberImageUrl"],
            "https://raw.githubusercontent.com/yacobwood/BTCC/main/data/numberImages/55.png",
        )

    @patch("scrape_driver_media.fetch_image_smart", return_value=None)
    @patch("scrape_driver_media.fetch_via_scrapfly", return_value=DRIVER_PAGE_HTML)
    def test_exits_nonzero_when_every_image_url_is_found_but_every_fetch_fails(self, mock_fetch, mock_image):
        path, tmp_dir = self._drivers_json([_LLOYD])
        with patch.multiple("scrape_driver_media", DRIVERS_PATH=path, **self._dirs(tmp_dir)), \
             patch("sys.argv", self._argv()):
            with self.assertRaises(SystemExit) as cm:
                main()
        self.assertEqual(cm.exception.code, 1)

    @patch("scrape_driver_media.fetch_via_scrapfly", return_value="<html><body>no relevant images</body></html>")
    def test_exits_nonzero_when_the_page_has_no_selectors_at_all(self, mock_fetch):
        path, _ = self._drivers_json([_LLOYD])
        with patch.multiple("scrape_driver_media", DRIVERS_PATH=path), \
             patch("sys.argv", self._argv()):
            with self.assertRaises(SystemExit) as cm:
                main()
        self.assertEqual(cm.exception.code, 1)

    @patch("scrape_driver_media._regenerate_bundle")
    @patch("scrape_driver_media._save_master_image")
    @patch("scrape_driver_media.fetch_via_scrapfly", return_value=DRIVER_PAGE_HTML)
    def test_exits_nonzero_when_one_image_updates_but_another_found_url_fails_to_fetch(
        self, mock_fetch, mock_save, mock_regen,
    ):
        """Regression coverage for the 2026-09-08 incident: Daniel Lloyd's
        real first run updated his car image fine but Scrapfly 422'd the
        headshot fetch - and the run still reported success (exit 0), so the
        workflow's retry-once step never fired. One image genuinely updating
        must not mask another one's real fetch failure - this has to exit
        non-zero so the run shows red and the retry actually happens, even
        though the car and number images below DO get saved."""
        def fetch_image_smart_side_effect(url, label=""):
            if "headshot" in label:
                return None  # found the URL, but the fetch itself failed
            return (b"bytes", "image/webp")

        path, tmp_dir = self._drivers_json([_LLOYD])
        with patch.multiple("scrape_driver_media", DRIVERS_PATH=path, **self._dirs(tmp_dir)), \
             patch("scrape_driver_media.fetch_image_smart", side_effect=fetch_image_smart_side_effect), \
             patch("sys.argv", self._argv()):
            with self.assertRaises(SystemExit) as cm:
                main()
        self.assertEqual(cm.exception.code, 1)
        # Car and number both succeeded - must still have been saved. A
        # partial failure shouldn't throw away the parts that worked.
        self.assertEqual(mock_save.call_count, 2)
        mock_regen.assert_called_once()  # only car has a bundle step among the two that succeeded

    @patch("scrape_driver_media._regenerate_bundle")
    @patch("scrape_driver_media._save_master_image")
    @patch("scrape_driver_media.fetch_image_smart", return_value=(b"not actually an image", "image/webp"))
    @patch("scrape_driver_media.fetch_via_scrapfly", return_value=DRIVER_PAGE_HTML)
    def test_exits_nonzero_and_still_keeps_the_other_images_bundle_regen_when_one_cant_be_decoded(
        self, mock_fetch, mock_image, mock_save, mock_regen,
    ):
        """Regression coverage for the 2026-09-08 incident: Daryl De Leon's
        real run had his headshot fetch AND save succeed, but his car
        image's fetch reported Scrapfly success while returning bytes PIL
        couldn't decode (PIL.UnidentifiedImageError) - uncaught, that
        crashed the whole script before the headshot's own bundle-regenerate
        step (at the time, deferred to a shared loop after every image) ever
        ran. A decode failure on one image must degrade to that one image's
        own "failed" outcome, not crash the process and leave another
        image's already-saved master with a stale, un-regenerated bundle."""
        # Call order in main() is headshot, car, number - ok, raises, ok.
        mock_save.side_effect = [None, Exception("cannot identify image file"), None]
        path, tmp_dir = self._drivers_json([_LLOYD])
        with patch.multiple("scrape_driver_media", DRIVERS_PATH=path, **self._dirs(tmp_dir)), \
             patch("sys.argv", self._argv()):
            with self.assertRaises(SystemExit) as cm:
                main()
        self.assertEqual(cm.exception.code, 1)
        # The headshot succeeded before the car image's decode failure - its
        # bundle-regenerate call must still have happened, not been skipped
        # because a later, unrelated image type blew up. Number has no
        # bundle step regardless, so this stays at 1 (headshot only).
        mock_regen.assert_called_once()

    @patch("scrape_driver_media._regenerate_bundle")
    @patch("scrape_driver_media._save_master_image")
    @patch("scrape_driver_media.fetch_image_smart", return_value=(b"bytes", "image/webp"))
    @patch("scrape_driver_media.fetch_via_scrapfly", return_value='<html><body><img class="driver-profile-cutout" src="/api/media/abc"></body></html>')
    def test_legitimately_missing_selectors_do_not_fail_the_run_when_one_succeeds(
        self, mock_fetch, mock_image, mock_save, mock_regen,
    ):
        """A page genuinely missing car/number selectors (no car photo or
        number graphic published yet for this driver, e.g. a brand-new
        signing with only a headshot so far) is NOT the same failure
        category as "found the URL but the fetch/decode broke" - it must
        not fail the run just because the headshot succeeded and the other
        two were never there to begin with."""
        drivers = [{"name": "Senna Proctor", "imageUrl": None, "carImageUrl": None, "numberImageUrl": None}]
        path, tmp_dir = self._drivers_json(drivers)
        with patch.multiple("scrape_driver_media", DRIVERS_PATH=path, **self._dirs(tmp_dir)), \
             patch("sys.argv", self._argv(name="Senna Proctor", slug="senna-proctor")):
            main()  # must NOT raise SystemExit
        mock_save.assert_called_once()
        mock_regen.assert_called_once()


if __name__ == "__main__":
    unittest.main()
