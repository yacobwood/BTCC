"""
Tests for compute_records.py — focuses on title_case(), which had zero
coverage before this and silently split Árón Taylor-Smith's career stats
across two rows in records.json (str.capitalize() doesn't respect a '-'
word boundary the way str.title() does).

Run with:
    python -m pytest tools/scraper/test_compute_records.py -v
    # or
    python tools/scraper/test_compute_records.py
"""

import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import compute_records as cr


class TestTitleCase(unittest.TestCase):
    def test_plain_two_word_name(self):
        self.assertEqual(cr.title_case("TOM INGRAM"), "Tom Ingram")

    def test_hyphenated_surname(self):
        # The actual live bug: .capitalize() gave "Taylor-smith".
        self.assertEqual(cr.title_case("ÁRON TAYLOR-SMITH"), "Áron Taylor-Smith")

    def test_apostrophe_surname(self):
        self.assertEqual(cr.title_case("SENNA O'BRIEN"), "Senna O'Brien")

    def test_already_title_case_is_unchanged(self):
        # Bundled season_*.json files are already natural title case going in -
        # must be a no-op, not just idempotent-looking (re-running through
        # capitalize() would still have passed this one, which is exactly why
        # the hyphen case above is the load-bearing assertion here).
        self.assertEqual(cr.title_case("Tom Ingram"), "Tom Ingram")
        self.assertEqual(cr.title_case("Áron Taylor-Smith"), "Áron Taylor-Smith")

    def test_empty_and_none(self):
        self.assertEqual(cr.title_case(""), "")
        self.assertIsNone(cr.title_case(None))


class TestLoadHistoricalEntries(unittest.TestCase):
    """load_historical_entries() - previously main() itself swallowed any
    exception from re-reading records.json (`except Exception: pass`) and
    silently substituted an empty list, which would have permanently
    dropped every pre-2004 historical entry on the next write if
    records.json was ever transiently corrupt/partially written. A corrupt
    file must now be fatal, not silently treated as "no historical entries
    exist"."""

    def test_missing_file_returns_empty_list(self):
        with tempfile.TemporaryDirectory() as tmp:
            missing_path = Path(tmp) / "records.json"
            self.assertEqual(cr.load_historical_entries(missing_path), [])

    def test_valid_file_returns_only_historical_entries(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "records.json"
            path.write_text(json.dumps({"drivers": [
                {"driver": "Old Timer", "historical": True},
                {"driver": "Tom Ingram", "historical": False},
                {"driver": "Modern Driver"},
            ]}))
            result = cr.load_historical_entries(path)
        self.assertEqual(result, [{"driver": "Old Timer", "historical": True}])

    def test_corrupt_json_is_fatal_not_silently_empty(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "records.json"
            path.write_text("{not valid json at all")
            with self.assertRaises(SystemExit) as ctx:
                cr.load_historical_entries(path)
            self.assertNotEqual(ctx.exception.code, 0)

    def test_valid_json_but_wrong_shape_is_fatal(self):
        # A file that parses as JSON but isn't the expected {"drivers": [...]}
        # shape (e.g. truncated mid-write to a bare list) must also fail
        # loudly rather than have .get("drivers", []) silently used skip it -
        # here .get would raise AttributeError on a list, still caught by the
        # broad except and made fatal.
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "records.json"
            path.write_text("[]")
            with self.assertRaises(SystemExit) as ctx:
                cr.load_historical_entries(path)
            self.assertNotEqual(ctx.exception.code, 0)


if __name__ == "__main__":
    unittest.main()
