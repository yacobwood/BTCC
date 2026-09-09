#!/usr/bin/env python3
"""Tests for scrape_driver_roster.py - the weekly, unattended full-roster
image sweep + new-driver auto-discovery companion to the on-demand
scrape_driver_media.py.

ROSTER_HTML below matches the real driver-card markup this repo's archived
scrape_driver_cutouts.py already confirmed live against btcc.net's
/drivers/ listing page (same CARD_BLOCK_RE/NAME_RE this module reuses)."""

import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from scrape_driver_roster import (
    _create_stub_driver,
    _discover_roster,
    _sweep_existing_driver,
    extract_car_number,
    main,
)

ROSTER_HTML = """
<html><body>
<div class="drivers-grid">
  <a class="driver-card" href="/driver/daniel-lloyd/"><div><h1>Daniel Lloyd</h1></div></a>
  <a class="driver-card" href="/driver/nic-hamilton/"><div><h1>Nic Hamilton</h1></div></a>
  <a class="driver-card" href="/driver/new-signing/"><div><h1>Some Newcomer</h1></div></a>
</div>
</body></html>
"""


class TestDiscoverRoster(unittest.TestCase):

    @patch("scrape_driver_roster.fetch_via_scrapfly", return_value=ROSTER_HTML)
    def test_discovers_every_driver_cards_name_and_slug(self, mock_fetch):
        roster = _discover_roster()
        self.assertEqual(roster["Daniel Lloyd"], "daniel-lloyd")
        self.assertEqual(roster["Some Newcomer"], "new-signing")

    @patch("scrape_driver_roster.fetch_via_scrapfly", return_value=ROSTER_HTML)
    def test_applies_name_aliases_so_the_site_name_maps_to_our_canonical_one(self, mock_fetch):
        roster = _discover_roster()
        self.assertNotIn("Nic Hamilton", roster)
        self.assertEqual(roster["Nicolas Hamilton"], "nic-hamilton")

    @patch("scrape_driver_roster.fetch_via_scrapfly", return_value=None)
    def test_raises_when_the_listing_page_fetch_fails(self, mock_fetch):
        # Unlike one driver failing later, there's no sensible partial sweep
        # without the listing itself - this is the one place a fetch
        # failure should propagate rather than degrade to "skip this one".
        with self.assertRaises(RuntimeError):
            _discover_roster()


class TestExtractCarNumber(unittest.TestCase):

    def test_extracts_the_number_from_the_alt_attribute(self):
        html = '<img class="driver-profile-number" alt="123" src="/api/media/x">'
        self.assertEqual(extract_car_number(html), 123)

    def test_works_regardless_of_attribute_order(self):
        html = '<img alt="7" class="driver-profile-number" src="/api/media/x">'
        self.assertEqual(extract_car_number(html), 7)

    def test_returns_none_when_the_selector_is_absent(self):
        self.assertIsNone(extract_car_number("<html><body>nothing here</body></html>"))


class TestSweepExistingDriver(unittest.TestCase):

    @patch("scrape_driver_roster._process_one_image")
    @patch("scrape_driver_roster.extract_media_urls")
    @patch("scrape_driver_roster.fetch_via_scrapfly", return_value="<html>fake</html>")
    def test_skips_an_unchanged_slot_and_refetches_the_ones_that_changed(
        self, mock_fetch, mock_extract, mock_process,
    ):
        mock_extract.return_value = {
            "cutout": "https://btcc.net/api/media/same",
            "car": "https://btcc.net/api/media/new-car",
            "number": "https://btcc.net/api/media/first-time-seen",
        }
        mock_process.return_value = ("ok", None)
        drv = {"name": "Daniel Lloyd", "number": 123, "imageUrl": "x", "carImageUrl": "y", "numberImageUrl": "z"}
        # cutout's cached URL matches what the page has right now - car's
        # cached value differs (a real change) - number was never cached at
        # all (this repo only just started tracking it) - the last two must
        # both be treated as "needs a refresh", not just the second one.
        state = {"Daniel Lloyd": {"cutout": "https://btcc.net/api/media/same", "car": "https://btcc.net/api/media/old-car"}}

        statuses = _sweep_existing_driver(drv, "daniel-lloyd", state)

        self.assertEqual(statuses, ("unchanged", "updated", "updated"))
        self.assertEqual(mock_process.call_count, 2)  # only car + number, cutout never touched _process_one_image
        self.assertEqual(state["Daniel Lloyd"]["car"], "https://btcc.net/api/media/new-car")
        self.assertEqual(state["Daniel Lloyd"]["number"], "https://btcc.net/api/media/first-time-seen")

    @patch("scrape_driver_roster._process_one_image")
    @patch("scrape_driver_roster.extract_media_urls")
    @patch("scrape_driver_roster.fetch_via_scrapfly", return_value="<html>fake</html>")
    def test_a_slot_no_longer_on_the_page_is_not_found_and_its_cache_entry_is_cleared(
        self, mock_fetch, mock_extract, mock_process,
    ):
        mock_extract.return_value = {"cutout": None, "car": "https://btcc.net/api/media/car", "number": "https://btcc.net/api/media/num"}
        mock_process.return_value = ("ok", None)
        drv = {"name": "Daniel Lloyd", "number": 123}
        state = {"Daniel Lloyd": {"cutout": "https://btcc.net/api/media/old-cutout"}}

        statuses = _sweep_existing_driver(drv, "daniel-lloyd", state)

        self.assertEqual(statuses[0], "not_found")
        self.assertNotIn("cutout", state["Daniel Lloyd"])
        self.assertEqual(mock_process.call_count, 2)  # car + number only - cutout never reached _process_one_image

    @patch("scrape_driver_roster.fetch_via_scrapfly", return_value=None)
    def test_returns_none_without_touching_state_when_the_profile_page_fetch_fails(self, mock_fetch):
        drv = {"name": "Daniel Lloyd", "number": 123}
        state = {}
        result = _sweep_existing_driver(drv, "daniel-lloyd", state)
        self.assertIsNone(result)
        self.assertEqual(state, {})


class TestCreateStubDriver(unittest.TestCase):

    @patch("scrape_driver_roster._process_one_image")
    @patch("scrape_driver_roster.extract_media_urls")
    @patch("scrape_driver_roster.fetch_via_scrapfly")
    def test_builds_a_stub_with_only_the_mechanically_knowable_fields_set(
        self, mock_fetch, mock_extract, mock_process,
    ):
        mock_fetch.return_value = '<img class="driver-profile-number" alt="88" src="/api/media/n">'
        mock_extract.return_value = {"cutout": "url1", "car": "url2", "number": "url3"}
        mock_process.side_effect = [
            ("ok", "https://raw.githubusercontent.com/yacobwood/BTCC/main/data/driverImages/newcomer.webp"),
            ("ok", "https://raw.githubusercontent.com/yacobwood/BTCC/main/data/carImages/newcomer.webp"),
            ("ok", "https://raw.githubusercontent.com/yacobwood/BTCC/main/data/numberImages/88.png"),
        ]

        drv = _create_stub_driver("Some Newcomer", "some-newcomer", {})

        self.assertIsNotNone(drv)
        self.assertEqual(drv["name"], "Some Newcomer")
        self.assertEqual(drv["number"], 88)
        self.assertIs(drv["needsReview"], True)
        # Everything needing a WebSearch/human judgment call stays blank -
        # never fabricated - see this module's own docstring for why.
        for field in ("team", "car", "class", "nationality", "bio", "dateOfBirth", "birthplace", "livesIn", "cardBgUrl"):
            self.assertEqual(drv[field], "")
        self.assertEqual(drv["history"], [])
        self.assertTrue(drv["imageUrl"].endswith("newcomer.webp"))
        self.assertTrue(drv["carImageUrl"].endswith("newcomer.webp"))
        self.assertTrue(drv["numberImageUrl"].endswith("88.png"))

    @patch("scrape_driver_roster._process_one_image")
    @patch("scrape_driver_roster.extract_media_urls")
    @patch("scrape_driver_roster.fetch_via_scrapfly")
    def test_returns_none_when_no_working_headshot_can_be_obtained(self, mock_fetch, mock_extract, mock_process):
        mock_fetch.return_value = '<img class="driver-profile-number" alt="88" src="/api/media/n">'
        mock_extract.return_value = {"cutout": "url1", "car": None, "number": "url3"}
        mock_process.side_effect = [
            ("failed", None),      # headshot found but the fetch/decode broke
            ("not_found", None),   # car not published yet - fine on its own
            ("ok", "https://raw.githubusercontent.com/yacobwood/BTCC/main/data/numberImages/88.png"),
        ]
        self.assertIsNone(_create_stub_driver("Some Newcomer", "some-newcomer", {}))

    @patch("scrape_driver_roster.fetch_via_scrapfly", return_value="<html>no number graphic published yet</html>")
    def test_returns_none_when_no_car_number_can_be_read(self, mock_fetch):
        # Deferred rather than guessed - see module docstring: a stub with a
        # wrong/guessed number would be worse than trying again next week.
        self.assertIsNone(_create_stub_driver("Some Newcomer", "some-newcomer", {}))

    @patch("scrape_driver_roster.fetch_via_scrapfly", return_value=None)
    def test_returns_none_when_the_profile_page_fetch_fails_outright(self, mock_fetch):
        self.assertIsNone(_create_stub_driver("Some Newcomer", "some-newcomer", {}))


class TestMain(unittest.TestCase):

    def _drivers_json(self, drivers: list[dict]) -> tuple[Path, Path]:
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        tmp_dir = Path(tmp.name)
        path = tmp_dir / "drivers.json"
        path.write_text(json.dumps({"drivers": drivers}, indent=2, ensure_ascii=False), encoding="utf-8")
        return path, tmp_dir / "driver_media_state.json"

    @patch("scrape_driver_roster._create_stub_driver")
    @patch("scrape_driver_roster._sweep_existing_driver")
    @patch("scrape_driver_roster._discover_roster")
    def test_inserts_a_newly_discovered_driver_in_ascending_number_order(
        self, mock_discover, mock_sweep, mock_stub,
    ):
        drivers = [{"name": "Low Number", "number": 2}, {"name": "High Number", "number": 99}]
        path, state_path = self._drivers_json(drivers)
        mock_discover.return_value = {"Low Number": "low-number", "High Number": "high-number", "New Signing": "new-signing"}
        mock_sweep.return_value = ("unchanged", "unchanged", "unchanged")
        mock_stub.return_value = {"name": "New Signing", "number": 50, "needsReview": True}

        with patch.multiple("scrape_driver_roster", DRIVERS_PATH=path, STATE_PATH=state_path):
            main()

        numbers = [d["number"] for d in json.loads(path.read_text())["drivers"]]
        self.assertEqual(numbers, [2, 50, 99])

    @patch("scrape_driver_roster._create_stub_driver")
    @patch("scrape_driver_roster._sweep_existing_driver")
    @patch("scrape_driver_roster._discover_roster")
    def test_one_drivers_failure_does_not_stop_the_rest_of_the_sweep(
        self, mock_discover, mock_sweep, mock_stub,
    ):
        drivers = [{"name": "A Driver", "number": 1}, {"name": "B Driver", "number": 2}]
        path, state_path = self._drivers_json(drivers)
        mock_discover.return_value = {"A Driver": "a-driver", "B Driver": "b-driver"}
        # A's page fails outright (None); B succeeds with a genuine update -
        # sorted(roster.items()) visits "A Driver" before "B Driver".
        mock_sweep.side_effect = [None, ("updated", "unchanged", "unchanged")]

        with patch.multiple("scrape_driver_roster", DRIVERS_PATH=path, STATE_PATH=state_path):
            main()  # must not raise - one failure among two is not a run failure

        self.assertEqual(mock_sweep.call_count, 2)

    @patch("scrape_driver_roster._discover_roster", side_effect=RuntimeError("could not fetch listing"))
    def test_exits_nonzero_when_the_listing_itself_cannot_be_fetched(self, mock_discover):
        path, state_path = self._drivers_json([{"name": "A Driver", "number": 1}])
        with patch.multiple("scrape_driver_roster", DRIVERS_PATH=path, STATE_PATH=state_path):
            with self.assertRaises(SystemExit) as cm:
                main()
        self.assertEqual(cm.exception.code, 1)

    @patch("scrape_driver_roster._sweep_existing_driver")
    @patch("scrape_driver_roster._discover_roster")
    def test_exits_nonzero_only_when_nothing_useful_happened_at_all(self, mock_discover, mock_sweep):
        drivers = [{"name": "A Driver", "number": 1}]
        path, state_path = self._drivers_json(drivers)
        mock_discover.return_value = {"A Driver": "a-driver"}
        mock_sweep.return_value = None  # the one and only driver's page failed to fetch

        with patch.multiple("scrape_driver_roster", DRIVERS_PATH=path, STATE_PATH=state_path):
            with self.assertRaises(SystemExit) as cm:
                main()
        self.assertEqual(cm.exception.code, 1)

    @patch("scrape_driver_roster._sweep_existing_driver")
    @patch("scrape_driver_roster._discover_roster")
    def test_does_not_rewrite_drivers_json_when_nothing_actually_changed(self, mock_discover, mock_sweep):
        drivers = [{"name": "A Driver", "number": 1}]
        path, state_path = self._drivers_json(drivers)
        original_content = path.read_text()
        mock_discover.return_value = {"A Driver": "a-driver"}
        mock_sweep.return_value = ("unchanged", "unchanged", "unchanged")

        with patch.multiple("scrape_driver_roster", DRIVERS_PATH=path, STATE_PATH=state_path):
            main()

        self.assertEqual(path.read_text(), original_content)


if __name__ == "__main__":
    unittest.main()
