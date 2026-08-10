#!/usr/bin/env python3
"""Tests for scrape_articles.py's display-date parsing."""

import unittest

from scrape_articles import needs_full_refetch, parse_display_date, resolve_first_seen, scrape_card_list, sort_posts


class TestParseDisplayDate(unittest.TestCase):
    def test_ordinal_th(self):
        self.assertEqual(parse_display_date("30th July 2026"), "2026-07-30T00:00:00")

    def test_ordinal_st(self):
        self.assertEqual(parse_display_date("1st January 2026"), "2026-01-01T00:00:00")

    def test_ordinal_nd(self):
        self.assertEqual(parse_display_date("2nd March 2026"), "2026-03-02T00:00:00")

    def test_ordinal_rd(self):
        self.assertEqual(parse_display_date("23rd August 2026"), "2026-08-23T00:00:00")

    def test_unparseable_returns_empty_string(self):
        self.assertEqual(parse_display_date("Coming soon"), "")

    def test_unknown_month_returns_empty_string(self):
        self.assertEqual(parse_display_date("30th Julyary 2026"), "")


# ── needs_full_refetch ───────────────────────────────────────────────────────
#
# Regression coverage: articles btcc.net publishes with a "More to follow..."
# stub before the session result is in were being cached permanently on first
# scrape - two Snetterton reports sat unfinished for 2.5+ months before this
# check existed, since a slug with any content at all was treated as "done".

class TestNeedsFullRefetch(unittest.TestCase):

    def test_stub_content_always_needs_refetch(self):
        stub = "<p>Aiden Moffat led home Audi stablemate Dexter Patterson.</p><p>More to follow...</p>"
        self.assertTrue(needs_full_refetch(stub, refresh_all=False))

    def test_stub_detection_is_case_insensitive(self):
        stub = "<p>MORE TO FOLLOW</p>"
        self.assertTrue(needs_full_refetch(stub, refresh_all=False))

    def test_finished_content_does_not_need_refetch(self):
        finished = "<p>Aiden Moffat led home Audi stablemate Dexter Patterson to a Scottish one-two.</p>"
        self.assertFalse(needs_full_refetch(finished, refresh_all=False))

    def test_refresh_all_forces_refetch_even_for_finished_content(self):
        finished = "<p>A complete, fully-written article.</p>"
        self.assertTrue(needs_full_refetch(finished, refresh_all=True))

    def test_empty_content_does_not_need_refetch_via_this_check(self):
        # build_articles() itself handles the "no content at all yet" case via
        # `bool(prior_content)` - this function only governs the "we have
        # something, is it good enough" decision.
        self.assertFalse(needs_full_refetch("", refresh_all=False))


# ── resolve_first_seen ───────────────────────────────────────────────────────
#
# Regression coverage: btcc.net's /news/ listing only exposes a bare display
# date (no time) and doesn't reliably list newest-first across different
# content types - confirmed live, 2026-08-09: a same-day quotes/features
# piece outranked two later race-report articles because the final sort
# could only break same-day ties by whatever order that run's listing
# happened to present them in. firstSeenAt (this run's own clock, stamped
# once and never moved) is what actually fixes same-day ordering.

class TestResolveFirstSeen(unittest.TestCase):

    def test_new_article_gets_this_runs_current_time(self):
        self.assertEqual(resolve_first_seen(None, "2026-08-09T22:39:03+00:00"), "2026-08-09T22:39:03+00:00")

    def test_already_mirrored_article_keeps_its_original_stamp(self):
        prior = {"firstSeenAt": "2026-08-09T09:30:02+00:00"}
        self.assertEqual(resolve_first_seen(prior, "2026-08-09T22:39:03+00:00"), "2026-08-09T09:30:02+00:00")

    def test_prior_without_firstseenat_falls_back_to_date_not_now(self):
        # Regression coverage: confirmed live 2026-08-10 - firstSeenAt shipped
        # the day before this, so the very next routine run found ~20
        # already-mirrored articles (real dates spanning 26 Jul-8 Aug) still
        # missing the new field. The old code treated "already known but not
        # yet stamped" the same as "genuinely new" and gave all ~20 that
        # run's one shared now_iso, letting them outrank even hours-old
        # ground-truth-backfilled same-day articles. An already-known slug
        # (prior is not None) must fall back to its own date, never now_iso -
        # only a slug with no prior entry at all is genuinely new.
        prior = {"date": "2026-08-08T00:00:00"}
        self.assertEqual(
            resolve_first_seen(prior, "2026-08-09T22:39:03+00:00", "2026-08-08T00:00:00"),
            "2026-08-08T00:00:00",
        )

    def test_prior_without_firstseenat_or_date_falls_back_to_passed_date_iso(self):
        # date_iso is build_articles' already-resolved date for this slug
        # (prior's stored date, or the freshly-scraped card's date if prior
        # somehow has neither) - resolve_first_seen doesn't need its own
        # fallback chain for it, just needs to prefer it over now_iso.
        prior = {}
        self.assertEqual(
            resolve_first_seen(prior, "2026-08-09T22:39:03+00:00", "2026-08-05T00:00:00"),
            "2026-08-05T00:00:00",
        )


# ── sort_posts ───────────────────────────────────────────────────────────────
#
# Regression coverage: confirmed live 2026-08-10 - a single bulk firstSeenAt
# backfill tied ~9 articles spanning 26 Jul-9 Aug at one identical timestamp
# (resolve_first_seen preserves a slug's original stamp forever, and
# build_articles computes `now_iso` once per run and reuses it for every
# newly-discovered slug that run, so any run that first-discovers more than
# one new article ties them the same way - not just a one-off backfill
# artifact). Sorting on firstSeenAt alone left the tied group ordered by
# arbitrary dict-insertion order instead of date: a 26 Jul article outranked
# an 8 Aug one in the News tab hero slot for hours, and kept doing so on
# every re-scrape since a stub getting its full content filled in via
# needs_full_refetch does not change its already-stamped firstSeenAt.

class TestSortPosts(unittest.TestCase):

    def test_sorts_by_first_seen_when_distinct(self):
        older = {"slug": "a", "date": "2026-08-01T00:00:00", "firstSeenAt": "2026-08-01T10:00:00+00:00"}
        newer = {"slug": "b", "date": "2026-08-02T00:00:00", "firstSeenAt": "2026-08-02T10:00:00+00:00"}
        self.assertEqual([p["slug"] for p in sort_posts([older, newer])], ["b", "a"])

    def test_breaks_tied_first_seen_by_date(self):
        # Reproduces the live 2026-08-10 bug: three articles tied at the exact
        # same firstSeenAt (a shared bulk-backfill/single-run-discovery
        # instant) must still land in true calendar-date order, not whatever
        # order they happened to be inserted in.
        tied = "2026-08-09T23:47:15+00:00"
        thruxton = {"slug": "ingram-thruxton", "date": "2026-07-26T00:00:00", "firstSeenAt": tied}
        knockhill_moffat = {"slug": "moffat-knockhill", "date": "2026-08-08T00:00:00", "firstSeenAt": tied}
        knockhill_chilton = {"slug": "chilton-knockhill", "date": "2026-08-09T00:00:00", "firstSeenAt": tied}
        result = sort_posts([thruxton, knockhill_moffat, knockhill_chilton])
        self.assertEqual(
            [p["slug"] for p in result],
            ["chilton-knockhill", "moffat-knockhill", "ingram-thruxton"],
        )

    def test_distinct_first_seen_wins_over_date_even_if_older_by_date(self):
        # firstSeenAt stays the primary key - a same-day quotes piece
        # first-seen earlier in the day must still rank below a later
        # same-day race report that was first-seen after it, which is the
        # whole reason firstSeenAt exists over date (see resolve_first_seen).
        # Here the two aren't same-day, to isolate that firstSeenAt still
        # wins over date's own ordering, not just over an exact date tie.
        seen_first_but_dated_later = {
            "slug": "dated-later", "date": "2026-08-10T00:00:00", "firstSeenAt": "2026-08-09T09:00:00+00:00",
        }
        seen_second_but_dated_earlier = {
            "slug": "dated-earlier", "date": "2026-08-01T00:00:00", "firstSeenAt": "2026-08-09T22:00:00+00:00",
        }
        result = sort_posts([seen_first_but_dated_later, seen_second_but_dated_earlier])
        self.assertEqual([p["slug"] for p in result], ["dated-earlier", "dated-later"])

    def test_falls_back_to_date_when_first_seen_missing(self):
        # Anything mirrored before firstSeenAt existed - resolve_first_seen's
        # own fallback, exercised here through the full sort.
        no_stamp = {"slug": "legacy", "date": "2026-08-05T00:00:00"}
        stamped = {"slug": "current", "date": "2026-08-01T00:00:00", "firstSeenAt": "2026-08-09T00:00:00+00:00"}
        result = sort_posts([no_stamp, stamped])
        self.assertEqual([p["slug"] for p in result], ["current", "legacy"])


# ── scrape_card_list ─────────────────────────────────────────────────────────
#
# Regression coverage: the /news/ listing's card images use loading="lazy" -
# without scrolling, only the hero card (already in the initial viewport)
# actually gets its image requested and captured; every card lower down
# silently got media_url=None, permanently, since a missing image is never
# retried once a slug is otherwise fully scraped. Confirmed live: two Race 1
# reports both missing images the same day they were first scraped.

class FakeFetcher:
    """Minimal stand-in for RenderedFetcher - scrape_card_list only ever calls
    .get_with_media(url, **kwargs) on whatever fetcher it's given, so a real
    Playwright browser isn't needed to test the call itself."""
    def __init__(self, html='<html><body></body></html>', media=None):
        self.html = html
        self.media = media or {}
        self.calls = []

    def get_with_media(self, url, **kwargs):
        self.calls.append({'url': url, **kwargs})
        return self.html, self.media


class TestScrapeCardList(unittest.TestCase):

    def test_requests_scroll_through_to_capture_lazy_loaded_images(self):
        fetcher = FakeFetcher()
        scrape_card_list(fetcher)
        self.assertEqual(len(fetcher.calls), 1)
        self.assertTrue(fetcher.calls[0].get('scroll_through'))


if __name__ == "__main__":
    unittest.main()
