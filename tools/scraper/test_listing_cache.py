#!/usr/bin/env python3
"""Tests for listing_cache.py - the hand-off that stops scrape-news.yml
paying Scrapfly twice for the same /news/ listing every run."""

import os
import tempfile
import time
import unittest
from pathlib import Path
from unittest.mock import patch

import listing_cache


class TestListingCache(unittest.TestCase):

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.path = Path(self.tmp.name) / "news-listing.html"

    def tearDown(self):
        self.tmp.cleanup()

    def test_round_trips_when_enabled(self):
        with patch.dict(os.environ, {"NEWS_LISTING_CACHE": str(self.path)}):
            listing_cache.save("<html>cards</html>")
            self.assertEqual(listing_cache.load(), "<html>cards</html>")

    def test_does_nothing_when_env_var_unset(self):
        with patch.dict(os.environ, {}, clear=True):
            listing_cache.save("<html>cards</html>")
            self.assertIsNone(listing_cache.load())
        self.assertFalse(self.path.exists())

    def test_missing_file_is_a_miss(self):
        with patch.dict(os.environ, {"NEWS_LISTING_CACHE": str(self.path)}):
            self.assertIsNone(listing_cache.load())

    def test_empty_file_is_a_miss(self):
        self.path.write_text("")
        with patch.dict(os.environ, {"NEWS_LISTING_CACHE": str(self.path)}):
            self.assertIsNone(listing_cache.load())

    def test_stale_file_is_ignored(self):
        self.path.write_text("<html>old</html>")
        old = time.time() - listing_cache.MAX_AGE_SECONDS - 60
        os.utime(self.path, (old, old))
        with patch.dict(os.environ, {"NEWS_LISTING_CACHE": str(self.path)}):
            self.assertIsNone(listing_cache.load())

    def test_unwritable_path_does_not_raise(self):
        bad = Path(self.tmp.name) / "no-such-dir" / "x.html"
        with patch.dict(os.environ, {"NEWS_LISTING_CACHE": str(bad)}):
            listing_cache.save("<html>cards</html>")
            self.assertIsNone(listing_cache.load())


if __name__ == "__main__":
    unittest.main()
