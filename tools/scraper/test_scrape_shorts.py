#!/usr/bin/env python3
"""Tests for scrape_shorts.py - mirrors btcc.net's homepage "Latest BTCC
Shorts" carousel into data/shorts.json.

HOMEPAGE_HTML below is the real markup copied from btcc.net's live homepage
(confirmed 2026-09-08, via a user-supplied screenshot + copied outerHTML) -
not a guessed fixture."""

import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from scrape_shorts import build_short, extract_short_ids, main

HOMEPAGE_HTML = """
<section class="shorts-section"><div class="container"><div class="section-heading"><h2>Latest BTCC Shorts</h2><a href="https://www.youtube.com/@OfficialBTCC/shorts" target="_blank" rel="noreferrer">View Channel Shorts</a></div><div class="shorts-carousel"><div class="shorts-track"><a class="short-card" href="https://www.youtube.com/shorts/Fv8Rk1ei3TE" target="_blank" rel="noreferrer"><span class="media-frame short-card-image"><img alt="BTCC short" src="https://i.ytimg.com/vi/Fv8Rk1ei3TE/hqdefault.jpg"></span><span class="short-card-play">▶</span></a><a class="short-card" href="https://www.youtube.com/shorts/D7gG1Cd1AZ8" target="_blank" rel="noreferrer"><span class="media-frame short-card-image"><img alt="BTCC short" src="https://i.ytimg.com/vi/D7gG1Cd1AZ8/hqdefault.jpg"></span><span class="short-card-play">▶</span></a><a class="short-card" href="https://www.youtube.com/shorts/awt4p-x-ScM" target="_blank" rel="noreferrer"><span class="media-frame short-card-image"><img alt="BTCC short" src="https://i.ytimg.com/vi/awt4p-x-ScM/hqdefault.jpg"></span><span class="short-card-play">▶</span></a></div></div></div></section>
"""


class TestExtractShortIds(unittest.TestCase):

    def test_extracts_every_video_id_from_real_markup_in_page_order(self):
        self.assertEqual(
            extract_short_ids(HOMEPAGE_HTML),
            ["Fv8Rk1ei3TE", "D7gG1Cd1AZ8", "awt4p-x-ScM"],
        )

    def test_returns_empty_list_when_the_page_has_no_short_cards(self):
        self.assertEqual(extract_short_ids("<html><body>no shorts here</body></html>"), [])

    def test_dedupes_a_repeated_id_while_preserving_first_occurrence_order(self):
        html = (
            '<a class="short-card" href="https://www.youtube.com/shorts/abc123">'
            '<a class="short-card" href="https://www.youtube.com/shorts/xyz789">'
            '<a class="short-card" href="https://www.youtube.com/shorts/abc123">'
        )
        self.assertEqual(extract_short_ids(html), ["abc123", "xyz789"])


class TestBuildShort(unittest.TestCase):

    def test_derives_url_and_thumbnail_from_the_video_id_alone(self):
        self.assertEqual(
            build_short("Fv8Rk1ei3TE"),
            {
                "videoId": "Fv8Rk1ei3TE",
                "url": "https://www.youtube.com/shorts/Fv8Rk1ei3TE",
                "thumbnailUrl": "https://i.ytimg.com/vi/Fv8Rk1ei3TE/hqdefault.jpg",
            },
        )


class TestMain(unittest.TestCase):

    def _shorts_path(self) -> Path:
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        return Path(tmp.name) / "shorts.json"

    @patch("scrape_shorts.fetch_via_scrapfly", return_value=None)
    def test_exits_nonzero_when_the_page_fetch_fails(self, mock_fetch):
        with self.assertRaises(SystemExit) as cm:
            main()
        self.assertEqual(cm.exception.code, 1)

    @patch("scrape_shorts.fetch_via_scrapfly", return_value="<html><body>no shorts here</body></html>")
    def test_exits_nonzero_when_no_shorts_are_found(self, mock_fetch):
        with self.assertRaises(SystemExit) as cm:
            main()
        self.assertEqual(cm.exception.code, 1)

    @patch("scrape_shorts.fetch_via_scrapfly", return_value=HOMEPAGE_HTML)
    def test_writes_the_expected_shape_to_shorts_json(self, mock_fetch):
        path = self._shorts_path()
        with patch("scrape_shorts.SHORTS_JSON", path):
            main()
        written = json.loads(path.read_text())
        self.assertIn("updatedAt", written)
        self.assertEqual(len(written["shorts"]), 3)
        self.assertEqual(written["shorts"][0], {
            "videoId": "Fv8Rk1ei3TE",
            "url": "https://www.youtube.com/shorts/Fv8Rk1ei3TE",
            "thumbnailUrl": "https://i.ytimg.com/vi/Fv8Rk1ei3TE/hqdefault.jpg",
        })

    @patch("scrape_shorts.fetch_via_scrapfly", return_value=HOMEPAGE_HTML)
    def test_replaces_shorts_json_wholesale_rather_than_merging(self, mock_fetch):
        # This is a rotating "latest N" widget, not an archive - a run must
        # never accumulate a previous run's shorts alongside the new ones.
        path = self._shorts_path()
        path.write_text(json.dumps({"updatedAt": "stale", "shorts": [
            {"videoId": "old000000", "url": "https://www.youtube.com/shorts/old000000",
             "thumbnailUrl": "https://i.ytimg.com/vi/old000000/hqdefault.jpg"},
        ]}))
        with patch("scrape_shorts.SHORTS_JSON", path):
            main()
        written = json.loads(path.read_text())
        ids = [s["videoId"] for s in written["shorts"]]
        self.assertNotIn("old000000", ids)
        self.assertEqual(len(ids), 3)


if __name__ == "__main__":
    unittest.main()
