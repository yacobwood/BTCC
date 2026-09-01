#!/usr/bin/env python3
"""
Tests for scrape_gallery.py: listing/album HTML parsing (fixtures modeled
on the real markup confirmed live against btcc.net on 2026-08-28 - see the
script's own module docstring), match_round()'s fuzzy venue matching,
thumb<->display URL derivation, and the resumable/incremental pagination
design this scraper was built around - a run must never re-extract an
already-known photo, and a budget cutoff mid-album must leave that album
correctly resumable (not complete) from its next unscraped page.
"""

import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import scrape_gallery
from scrape_gallery import (
    assign_canonical_albums,
    build_gallery,
    display_url,
    gallery_year_slug,
    load_calendar_rounds,
    match_round,
    process_album,
    scrape_gallery_listing,
)


def stub_fetch(pages):
    """side_effect for patching scrape_gallery.fetch_via_scrapfly - pages
    maps a URL (exact match) -> html string, so a test can hand back
    different content per page/URL including query-string variants.
    Defaults to an empty (but successfully "fetched") page for any
    unmapped URL, matching the old FakeFetcher's default - a genuine fetch
    failure (None) is opted into explicitly by a test, not the default."""
    def _fetch(url, **kwargs):
        return pages.get(url, '<html></html>')
    return _fetch


# Fixtures modeled directly on the real, live-confirmed markup (see module
# docstring) - not invented shapes.
def album_card(year, slug, title, cover_uuid='cover-uuid'):
    cover = (
        f'https://ylxmhtbmzvpwyvkmomex.supabase.co/storage/v1/object/public/gallery/'
        f'galleries/{cover_uuid}/x/variants/thumb-gallery-editor-client-v1.webp'
    )
    return (
        f'<a class="btcc-public-gallery-card" href="/gallery/{year}/{slug}/">'
        f'<span class="btcc-public-gallery-card-media"><img src="{cover}" alt="" loading="lazy"></span>'
        f'<h2>{title}</h2></a>'
    )


def page_info(current, total):
    return f'<span>Page <!-- -->{current}<!-- --> of <!-- -->{total}</span>'


def photo_img(uuid, pipeline='import', src_last=False):
    """src_last=True reproduces the real "editor-client"-pipeline markup
    confirmed live 2026-08-28 (alt/loading/width/height BEFORE src, not
    after) - the exact shape that silently broke the original
    `<img src="..."` -anchored regex on every page of every editor-client
    album, not just page 3+."""
    url = (
        f'https://ylxmhtbmzvpwyvkmomex.supabase.co/storage/v1/object/public/gallery/'
        f'imports/2026/set-uuid/{uuid}/variants/thumb-gallery-{pipeline}-v1.webp'
    )
    if src_last:
        return f'<figure><img alt="x" loading="lazy" width="6000" height="4000" src="{url}"></figure>'
    return f'<figure><img src="{url}" alt="x" loading="lazy" width="5472" height="3648"></figure>'


LISTING_PAGE_1 = (
    '<div class="btcc-public-gallery-card-grid">'
    + album_card(2026, '2026-donington-park', 'Donington Park')
    + album_card(2026, '2026-season-launch', '2026 Season Launch')
    + '</div>' + page_info(1, 2)
)
LISTING_PAGE_2 = (
    '<div class="btcc-public-gallery-card-grid">'
    + album_card(2026, '2026-knockhill', 'Knockhill')
    + '</div>' + page_info(2, 2)
)

CALENDAR_ROUNDS = [
    {'round': 1, 'venue': 'Donington Park'},
    {'round': 2, 'venue': 'Brands Hatch Indy'},
    {'round': 3, 'venue': 'Brands Hatch GP'},
    {'round': 4, 'venue': 'Knockhill'},
]


class TestDisplayUrl(unittest.TestCase):
    def test_swaps_thumb_for_display(self):
        thumb = 'https://x.supabase.co/storage/v1/object/public/gallery/imports/2026/a/b/variants/thumb-gallery-import-v1.webp'
        self.assertEqual(
            display_url(thumb),
            'https://x.supabase.co/storage/v1/object/public/gallery/imports/2026/a/b/variants/display-gallery-import-v1.webp',
        )

    def test_leaves_non_matching_url_unchanged(self):
        url = 'https://example.com/some-other-shape.jpg'
        self.assertEqual(display_url(url), url)


class TestMatchRound(unittest.TestCase):
    """match_round() now returns (round, venue, is_exact) - is_exact
    distinguishes a title that's nothing but the venue's plain name (once a
    year prefix is stripped) from a fuzzy/substring match within a richer,
    branded title (e.g. "The Captured Moments: ..."). Used by
    assign_canonical_albums() to pick one album per round as the "Race
    Weekends" tile when more than one album resolves to the same round."""

    def test_exact_venue_match(self):
        self.assertEqual(
            match_round('2026-donington-park', 'Donington Park', 2026, CALENDAR_ROUNDS),
            (1, 'Donington Park', True),
        )

    def test_ambiguous_substring_falls_back_to_exact(self):
        self.assertEqual(
            match_round('2026-brands-hatch-indy', 'Brands Hatch Indy', 2026, CALENDAR_ROUNDS),
            (2, 'Brands Hatch Indy', True),
        )

    def test_genuinely_ambiguous_substring_returns_none(self):
        self.assertEqual(
            match_round('2026-brands-hatch', 'Brands Hatch', 2026, CALENDAR_ROUNDS),
            (None, None, False),
        )

    def test_non_track_event_returns_none(self):
        self.assertEqual(
            match_round('2026-season-launch', '2026 Season Launch', 2026, CALENDAR_ROUNDS),
            (None, None, False),
        )

    def test_gp_variant_wins_over_its_own_prefix_venue_name(self):
        """Real live case, 2026-08-28: round 1 is "Donington Park", round 7
        is "Donington Park GP" - a title naming the GP layout explicitly
        contains BOTH venue names as substrings (one is a literal prefix of
        the other), but that's not a genuine tie - the longer, more
        specific name is unambiguously the correct match. Also confirms
        is_exact correctly distinguishes the plain title from the branded
        "Captured Moments" one, both resolving to the same round."""
        rounds = [
            {'round': 1, 'venue': 'Donington Park'},
            {'round': 7, 'venue': 'Donington Park GP'},
        ]
        self.assertEqual(
            match_round('2026-donington-park-gp', '2026 - Donington Park GP', 2026, rounds),
            (7, 'Donington Park GP', True),
        )
        self.assertEqual(
            match_round('2026-the-captured-moments-donington-park-gp', '2026: The Captured Moments - Donington Park GP', 2026, rounds),
            (7, 'Donington Park GP', False),
        )

    def test_gp_round_still_matches_when_the_real_title_drops_park_entirely(self):
        """Real live case, 2023 backfill on 2026-08-29: unlike every other
        season checked (2024/2025/2026 all say "Donington Park GP" in
        full), 2023's real album is titled "2023 - Donington GP" - dropping
        "Park" outright. Neither "Donington Park" nor "Donington Park GP"
        appears verbatim in that text, so a strict substring match alone
        would leave round 7's real gallery unassociated with any round."""
        rounds = [
            {'round': 1, 'venue': 'Donington Park'},
            {'round': 7, 'venue': 'Donington Park GP'},
        ]
        self.assertEqual(
            match_round('2023-donington-gp', '2023 - Donington GP', 2023, rounds),
            (7, 'Donington Park GP', True),
        )

    def test_plain_venue_name_still_matches_its_own_round_when_a_gp_variant_also_exists(self):
        rounds = [
            {'round': 1, 'venue': 'Donington Park'},
            {'round': 7, 'venue': 'Donington Park GP'},
        ]
        self.assertEqual(
            match_round('2026-donington-park', '2026 - Donington Park', 2026, rounds),
            (1, 'Donington Park', True),
        )

    def test_richly_titled_album_still_matches_via_substring(self):
        """"The Captured Moments: Donington Park GP" doesn't equal a venue
        name outright, but does contain it - confirmed live this is a real
        published album title shape."""
        self.assertEqual(
            match_round('2026-the-captured-moments-donington-park-gp', 'The Captured Moments: Donington Park GP', 2026,
                         [{'round': 1, 'venue': 'Donington Park GP'}]),
            (1, 'Donington Park GP', False),
        )

    def test_a_test_day_never_inherits_its_venues_actual_race_round(self):
        """Real live case, 2026-08-28: "2026 - Croft Testing" was incorrectly
        tagged round 8 (Croft's real race round) purely because "Croft" is a
        substring of "Croft Testing" - a test day is a genuinely different
        event from the championship weekend at the same circuit and was
        never meant to inherit that round's number, even though the venue
        name matches perfectly."""
        rounds = [{'round': 8, 'venue': 'Croft'}]
        self.assertEqual(
            match_round('2026-croft-testing', '2026 - Croft Testing', 2026, rounds),
            (None, None, False),
        )
        self.assertEqual(
            match_round('croft-test-day', 'Croft Test Day', 2026, rounds),
            (None, None, False),
        )

    def test_a_kwik_fit_branded_event_never_inherits_a_thruxton_round(self):
        """Real live case, 2021 backfill on 2026-08-29: "2021 - Kwik Fit
        Thruxton 24" is a genuinely separate, smaller (4-page) promotional
        gallery from both real Thruxton race weekends that season
        ("2021 - Thruxton", round 1, and "2021 - Thruxton 2", round 6, 7
        pages each) - confirmed by fetching all three directly. Also
        exercises the word-boundary fix on its own: without it, the literal
        text "thruxton 2" (round 6's venue) is a false-positive substring
        of "thruxton 24" purely as a character sequence, so this case would
        wrongly resolve to round 6 even with the "kwik fit" exclusion
        checked in the wrong order."""
        rounds = [{'round': 1, 'venue': 'Thruxton'}, {'round': 6, 'venue': 'Thruxton 2'}]
        self.assertEqual(
            match_round('2021-kwik-fit-thruxton-24', '2021 - Kwik Fit Thruxton 24', 2021, rounds),
            (None, None, False),
        )

    def test_a_venues_name_is_not_falsely_matched_as_a_fragment_of_a_longer_number(self):
        """General-purpose regression for the word-boundary fix, independent
        of the specific Kwik Fit title above: "thruxton 2" must not match
        inside "thruxton 24" - the "2" is followed directly by "4", not a
        word boundary, so it's a fragment of "24", not the venue "Thruxton
        2" on its own."""
        rounds = [{'round': 6, 'venue': 'Thruxton 2'}]
        self.assertEqual(
            match_round('some-thruxton-24-event', 'Some Thruxton 24 Event', 2021, rounds),
            (None, None, False),
        )

    def test_a_season_launch_shoot_never_inherits_its_venues_actual_race_round(self):
        """Real live case, 2025 backfill on 2026-08-29: "Donington Park -
        Season Launch - 2025" substring-matches round 1's venue exactly
        like a test day would. Currently protected from becoming a
        duplicate round-1 tile only because assign_canonical_albums()'s
        exact-match tiebreak favours the real "2025 - Donington Park" album
        - a future season where the launch shoot is scraped before that
        season's real round-1 album exists would have nothing to lose to.
        Same category of non-race event as a test day, excluded the same
        way, before it can become a live bug rather than after."""
        rounds = [{'round': 1, 'venue': 'Donington Park'}]
        self.assertEqual(
            match_round('donington-park-season-launch-2025', 'Donington Park - Season Launch - 2025', 2025, rounds),
            (None, None, False),
        )

    def test_identical_venue_strings_for_two_different_rounds_stay_ambiguous(self):
        """Real 2013 calendar shape (data/results2013.json): round 1 and
        round 10 are BOTH the bare string "Brands Hatch", with no Indy/GP
        qualifier at all (unlike 2014 onward). match_round() itself has no
        way to disambiguate this - both albums forward-match the identical
        venue name with an identical match length, so it correctly stays
        unresolved rather than guess. See test_match_round_resolved below
        for how this specific, real case actually gets resolved - via a
        cited historical override, not a change to match_round() itself."""
        rounds = [{'round': 1, 'venue': 'Brands Hatch'}, {'round': 10, 'venue': 'Brands Hatch'}]
        self.assertEqual(
            match_round('2013-brands-hatch-indy', 'Brands Hatch Indy', 2013, rounds),
            (None, None, False),
        )
        self.assertEqual(
            match_round('2013-brands-hatch-gp', 'Brands Hatch GP', 2013, rounds),
            (None, None, False),
        )


class TestMatchRoundResolved(unittest.TestCase):
    """match_round_resolved() wraps match_round() with
    HISTORICAL_ROUND_OVERRIDES - a tiny, explicitly-cited table for the rare
    (year, slug) pair match_round() can never resolve on its own because the
    ambiguity lives in the calendar data it compares against, not in its own
    matching logic (see match_round()'s own docstring/tests above, which
    stay green either way - this wrapper never changes match_round()'s own
    behaviour, only what a caller sees when it returns None)."""

    def test_resolves_2013_brands_hatch_indy_and_gp_via_override(self):
        rounds = [{'round': 1, 'venue': 'Brands Hatch'}, {'round': 10, 'venue': 'Brands Hatch'}]
        self.assertEqual(
            scrape_gallery.match_round_resolved('brands-hatch-indy', 'Brands Hatch Indy', 2013, rounds),
            (1, 'Brands Hatch', True),
        )
        self.assertEqual(
            scrape_gallery.match_round_resolved('brands-hatch-gp', 'Brands Hatch GP', 2013, rounds),
            (10, 'Brands Hatch', True),
        )

    def test_override_never_fires_for_an_unrelated_year_or_slug(self):
        """The override table is keyed on the exact (year, slug) pair - a
        same-named slug in a different year, or an unrelated slug in 2013,
        must fall through to match_round()'s own (correctly ambiguous)
        result rather than accidentally reuse 2013's fixed round numbers."""
        rounds = [{'round': 1, 'venue': 'Brands Hatch'}, {'round': 10, 'venue': 'Brands Hatch'}]
        self.assertEqual(
            scrape_gallery.match_round_resolved('brands-hatch-indy', 'Brands Hatch Indy', 2014, rounds),
            (None, None, False),
        )

    def test_override_never_masks_a_real_match_round_result(self):
        """If match_round() itself resolves something (even for a slug that
        happens to also be in the override table), that real result wins -
        the override is a last-resort fallback, never a priority override."""
        rounds = [{'round': 1, 'venue': 'Brands Hatch Indy'}]
        self.assertEqual(
            scrape_gallery.match_round_resolved('brands-hatch-indy', 'Brands Hatch Indy', 2013, rounds),
            (1, 'Brands Hatch Indy', True),
        )


class TestAssignCanonicalAlbums(unittest.TestCase):
    """Root-caused live 2026-08-28: round 2 (Brands Hatch Indy) has both a
    main album and a separately-published "The Captured Moments: Brands
    Hatch Indy" one - both correctly resolve to round 2 via match_round(),
    but the app's Gallery tab showing both as "Race Weekends" tiles with a
    duplicate R2 chip read as cluttered/wrong. Exactly one per round should
    be marked canonical; every other album for that round moves to the
    app's "Other" section instead (still correctly associated with the
    round in its own data, just not shown as a duplicate round tile)."""

    ROUNDS = [{'round': 2, 'venue': 'Brands Hatch Indy'}, {'round': 8, 'venue': 'Croft'}]

    def test_the_plain_titled_album_wins_over_a_captured_moments_variant(self):
        main = {'slug': '2026-brands-hatch-indy', 'title': '2026 - Brands Hatch Indy'}
        variant = {'slug': 'the-captured-moments-brands-hatch-indy', 'title': 'The Captured Moments: Brands Hatch Indy'}
        assign_canonical_albums([main, variant], 2026, self.ROUNDS)
        self.assertTrue(main['isCanonical'])
        self.assertFalse(variant['isCanonical'])
        # Both still correctly know which round they belong to.
        self.assertEqual(main['round'], 2)
        self.assertEqual(variant['round'], 2)

    def test_a_rounds_only_album_is_canonical_even_with_a_non_plain_title(self):
        """A round can have only a stylized/branded album published so far
        (e.g. the plain-titled one hasn't gone up yet) - it should still be
        canonical, since there's no competing album for that round to lose
        to. Uses a made-up "Captured Moments" title as the *only* album for
        round 2 - a real test day (e.g. "Croft Testing") is a separate,
        deliberately-excluded case (see TestMatchRound's own test for that),
        not an example of this one."""
        only = {'slug': 'the-captured-moments-brands-hatch-indy', 'title': 'The Captured Moments: Brands Hatch Indy'}
        assign_canonical_albums([only], 2026, self.ROUNDS)
        self.assertTrue(only['isCanonical'])
        self.assertEqual(only['round'], 2)

    def test_an_album_with_no_resolved_round_is_never_canonical(self):
        launch = {'slug': '2026-season-launch', 'title': '2026 Season Launch'}
        assign_canonical_albums([launch], 2026, self.ROUNDS)
        self.assertFalse(launch['isCanonical'])
        self.assertIsNone(launch['round'])

    def test_the_year_prefixed_album_wins_over_a_bare_titled_exact_duplicate(self):
        """Real live case, 2022 backfill on 2026-08-29: round 5 (Croft) has
        two separately-published albums that BOTH exact-match via
        match_round() - "2022 - Croft" (528 photos, 11 pages, the real main
        gallery) and a smaller, bare-titled "Croft" (384 photos, 8 pages,
        slug "croft-3"). Shortest-title-wins alone would pick the bare one
        purely for lacking a year prefix, not because it's the more
        official one - confirmed live it's actually the smaller, secondary
        album. The year-prefixed "YYYY - Venue" form - the convention every
        real main round album has followed in every season checked - must
        win over a same-length-or-shorter bare-titled duplicate."""
        rounds = [{'round': 5, 'venue': 'Croft'}]
        main = {'slug': '2022-croft', 'title': '2022 - Croft'}
        bare = {'slug': 'croft-3', 'title': 'Croft'}
        assign_canonical_albums([main, bare], 2022, rounds)
        self.assertTrue(main['isCanonical'])
        self.assertFalse(bare['isCanonical'])

    def test_2013_brands_hatch_indy_and_gp_resolve_via_historical_override(self):
        """assign_canonical_albums() calls match_round_resolved(), not
        match_round() directly (2026-08-29 fix) - so the 2013 Brands Hatch
        Indy/GP override actually takes effect end-to-end here, not just in
        the wrapper's own isolated tests above. Each is the only album for
        its round, so both are canonical - nothing to lose a tiebreak to."""
        rounds = [{'round': 1, 'venue': 'Brands Hatch'}, {'round': 10, 'venue': 'Brands Hatch'}]
        indy = {'slug': 'brands-hatch-indy', 'title': 'Brands Hatch Indy'}
        gp = {'slug': 'brands-hatch-gp', 'title': 'Brands Hatch GP'}
        assign_canonical_albums([indy, gp], 2013, rounds)
        self.assertEqual(indy['round'], 1)
        self.assertTrue(indy['isCanonical'])
        self.assertEqual(gp['round'], 10)
        self.assertTrue(gp['isCanonical'])


class TestScrapeGalleryListing(unittest.TestCase):

    @patch("scrape_gallery.fetch_via_scrapfly")
    def test_parses_album_cards_across_paginated_listing_pages(self, mock_fetch):
        mock_fetch.side_effect = stub_fetch({
            'https://btcc.net/gallery/2026/': LISTING_PAGE_1,
            'https://btcc.net/gallery/2026/?page=2': LISTING_PAGE_2,
        })
        albums = scrape_gallery_listing(2026)
        self.assertEqual(
            [a['slug'] for a in albums],
            ['2026-donington-park', '2026-season-launch', '2026-knockhill'],
        )
        self.assertEqual(albums[0]['title'], 'Donington Park')
        self.assertTrue(albums[0]['cover_src'].startswith('https://'))

    @patch("scrape_gallery.fetch_via_scrapfly")
    def test_extracts_cover_regardless_of_attribute_order_within_the_img_tag(self, mock_fetch):
        """Same real "editor-client"-pipeline shape as
        test_captures_photos_regardless_of_attribute_order_within_the_img_tag
        below, but for a listing card's cover image."""
        card_html = (
            '<div class="btcc-public-gallery-card-grid">'
            '<a class="btcc-public-gallery-card" href="/gallery/2026/2026-donington-park-gp/">'
            '<span class="btcc-public-gallery-card-media">'
            '<img alt="" loading="lazy" src="https://ylxmhtbmzvpwyvkmomex.supabase.co/storage/v1/object/public/gallery/'
            'galleries/set-uuid/cover-uuid/variants/thumb-gallery-editor-client-v1.webp"></span>'
            '<h2>2026 - Donington Park GP</h2></a></div>' + page_info(1, 1)
        )
        mock_fetch.side_effect = stub_fetch({'https://btcc.net/gallery/2026/': card_html})
        albums = scrape_gallery_listing(2026)
        self.assertEqual(len(albums), 1)
        self.assertTrue(albums[0]['cover_src'].startswith('https://'))

    @patch("scrape_gallery.fetch_via_scrapfly")
    def test_stops_after_the_real_last_page(self, mock_fetch):
        mock_fetch.side_effect = stub_fetch({
            'https://btcc.net/gallery/2026/': LISTING_PAGE_1,
            'https://btcc.net/gallery/2026/?page=2': LISTING_PAGE_2,
        })
        scrape_gallery_listing(2026)
        # Only 2 fetches (page 1 + page 2) - never a phantom page 3.
        self.assertEqual(mock_fetch.call_count, 2)

    @patch("scrape_gallery.fetch_via_scrapfly")
    def test_2020_uses_its_own_slug_override_not_the_plain_year(self, mock_fetch):
        """Real live case, 2020 backfill on 2026-08-29: a bare
        https://btcc.net/gallery/2020/ 404s through to the generic gallery
        landing page instead (its own <h1>Gallery</h1>, not "2020") - the
        real 2020 listing is at /gallery/2020-1/, confirmed by its own
        <h1>2020</h1> and real album hrefs also using "2020-1" as their year
        segment. Every other year checked (2017-2026) uses the plain
        "/gallery/{year}/" pattern - this is a one-off site quirk."""
        self.assertEqual(gallery_year_slug(2020), '2020-1')
        self.assertEqual(gallery_year_slug(2021), '2021')
        card = album_card('2020-1', '2020-croft', '2020 - Croft') + page_info(1, 1)
        mock_fetch.side_effect = stub_fetch({'https://btcc.net/gallery/2020-1/': card})
        albums = scrape_gallery_listing(2020)
        self.assertEqual(mock_fetch.call_args_list[0].args[0], 'https://btcc.net/gallery/2020-1/')
        self.assertEqual([a['slug'] for a in albums], ['2020-croft'])

    @patch("scrape_gallery.fetch_via_scrapfly")
    def test_returns_empty_list_when_nothing_matches(self, mock_fetch):
        mock_fetch.side_effect = stub_fetch({'https://btcc.net/gallery/2026/': '<html>no albums here</html>'})
        self.assertEqual(scrape_gallery_listing(2026), [])


class TestProcessAlbum(unittest.TestCase):
    def _run(self, pages, existing_album=None, slug='2026-donington-park'):
        with tempfile.TemporaryDirectory() as tmp:
            gallery_dir = Path(tmp) / "gallery"
            if existing_album:
                year_dir = gallery_dir / "2026"
                year_dir.mkdir(parents=True)
                (year_dir / f"{slug}.json").write_text(json.dumps(existing_album))
            with patch.object(scrape_gallery, "GALLERY_DIR", gallery_dir), \
                 patch("scrape_gallery.fetch_via_scrapfly", side_effect=stub_fetch(pages)) as mock_fetch:
                album = process_album(2026, slug, 'Donington Park', 'https://example.com/cover.jpg',
                                       'https://btcc.net/gallery/2026/', CALENDAR_ROUNDS)
                return album, mock_fetch

    def test_single_page_album_captures_every_photo_and_marks_complete(self):
        html = '<div>' + ''.join(photo_img(f'p{i}') for i in range(3)) + '</div>' + page_info(1, 1)
        album, _ = self._run({'https://btcc.net/gallery/2026/2026-donington-park/': html})
        self.assertEqual(album['capturedCount'], 3)
        self.assertEqual(album['totalCount'], 3)
        self.assertTrue(album['complete'])
        self.assertEqual(album['round'], 1)
        self.assertEqual(album['venue'], 'Donington Park')
        # Each photo gets a derived display (view) URL alongside its thumb.
        self.assertTrue(album['photos'][0]['viewUrl'].startswith('https://'))
        self.assertIn('/variants/display-', album['photos'][0]['viewUrl'])

    def test_captures_photos_regardless_of_attribute_order_within_the_img_tag(self):
        """Root-caused live 2026-08-28: btcc.net's "editor-client"-pipeline
        albums render <img alt=... loading=... width=... height=... src=...>
        (src LAST, not first) - an `<img src="..."`-anchored regex silently
        matched zero photos on every one of these pages (not just later
        pages) rather than erroring, which looked identical to "no new
        photos" instead of a real parsing failure."""
        html = (
            '<div>' + ''.join(photo_img(f'p{i}', src_last=True) for i in range(3)) + '</div>' + page_info(1, 1)
        )
        album, _ = self._run({'https://btcc.net/gallery/2026/2026-donington-park/': html})
        self.assertEqual(album['capturedCount'], 3)
        self.assertTrue(album['complete'])

    def test_multi_page_album_walks_every_page_via_the_real_pagination_links(self):
        page1 = '<div>' + ''.join(photo_img(f'p{i}') for i in range(2)) + '</div>' + page_info(1, 2)
        page2 = '<div>' + ''.join(photo_img(f'q{i}') for i in range(2)) + '</div>' + page_info(2, 2)
        album, _ = self._run({
            'https://btcc.net/gallery/2026/2026-donington-park/': page1,
            'https://btcc.net/gallery/2026/2026-donington-park/?page=2': page2,
        })
        self.assertEqual(album['capturedCount'], 4)
        self.assertTrue(album['complete'])
        self.assertEqual(album['lastPageScraped'], 2)
        self.assertEqual(album['totalPages'], 2)

    def test_resumed_album_starts_from_its_next_unscraped_page_and_skips_known_photos(self):
        existing = {
            'slug': '2026-donington-park', 'title': 'Donington Park', 'year': 2026,
            'round': 1, 'venue': 'Donington Park', 'lastPageScraped': 1, 'totalPages': 2,
            '_firstPagePhotoCount': 2, 'capturedCount': 2, 'totalCount': 4, 'complete': False,
            'photos': [
                {'thumbUrl': 'https://x.supabase.co/storage/v1/object/public/gallery/imports/2026/set-uuid/p0/variants/thumb-gallery-import-v1.webp',
                 'viewUrl': 'https://x.supabase.co/storage/v1/object/public/gallery/imports/2026/set-uuid/p0/variants/display-gallery-import-v1.webp'},
                {'thumbUrl': 'https://x.supabase.co/storage/v1/object/public/gallery/imports/2026/set-uuid/p1/variants/thumb-gallery-import-v1.webp',
                 'viewUrl': 'https://x.supabase.co/storage/v1/object/public/gallery/imports/2026/set-uuid/p1/variants/display-gallery-import-v1.webp'},
            ],
        }
        page2 = '<div>' + ''.join(photo_img(f'q{i}') for i in range(2)) + '</div>' + page_info(2, 2)
        album, mock_fetch = self._run(
            {'https://btcc.net/gallery/2026/2026-donington-park/?page=2': page2}, existing_album=existing,
        )
        # Page 1 must never be re-fetched - only page 2 (the next unscraped one).
        self.assertEqual(
            [c.args[0] for c in mock_fetch.call_args_list],
            ['https://btcc.net/gallery/2026/2026-donington-park/?page=2'],
        )
        self.assertEqual(album['capturedCount'], 4)
        self.assertTrue(album['complete'])

    def test_fetch_failure_leaves_album_incomplete_for_next_run(self):
        album, mock_fetch = self._run({'https://btcc.net/gallery/2026/2026-donington-park/': None})
        self.assertEqual(album['capturedCount'], 0)
        self.assertFalse(album['complete'])
        self.assertEqual(mock_fetch.call_count, 1)

    def test_single_page_album_with_no_pagination_nav_is_marked_complete(self):
        """Real live case, 2026-08-28: "The Captured Moments: Knockhill
        2026" has 23 real photos and renders NO
        <nav class="btcc-public-gallery-pagination"> at all - genuinely a
        single-page album. Without page-info markup to confirm a total page
        count, `complete` must still become true once we've reached the one
        (and only) page - not stay incomplete forever, which would mean
        every subsequent run re-fetches this page pointlessly, and the app
        would show "more being added" for an album that already has
        everything."""
        html = '<div>' + ''.join(photo_img(f'p{i}') for i in range(23)) + '</div>'  # no page_info() at all
        album, _ = self._run({'https://btcc.net/gallery/2026/2026-donington-park/': html})
        self.assertEqual(album['capturedCount'], 23)
        self.assertTrue(album['complete'])
        self.assertEqual(album['totalPages'], 1)


class TestLoadCalendarRounds(unittest.TestCase):
    def test_prefers_the_target_years_own_results_file_over_the_current_seasons_calendar(self):
        # Root-caused live 2026-08-28 before backfilling 2025: calendar.json
        # only ever holds the CURRENT season (2026 here) - a historical
        # --season 2025 run must not silently match against 2026's round
        # order/venues.
        with tempfile.TemporaryDirectory() as tmp:
            data_dir = Path(tmp)
            (data_dir / "calendar.json").write_text(json.dumps({'season': 2026, 'rounds': CALENDAR_ROUNDS}))
            rounds_2025 = [{'round': 1, 'venue': 'Brands Hatch Indy'}, {'round': 2, 'venue': 'Donington Park'}]
            (data_dir / "results2025.json").write_text(json.dumps({'season': 2025, 'rounds': rounds_2025}))
            with patch.object(scrape_gallery, "DATA_DIR", data_dir), \
                 patch.object(scrape_gallery, "CALENDAR_JSON", data_dir / "calendar.json"):
                result = load_calendar_rounds(2025)
        self.assertEqual(result, rounds_2025)

    def test_falls_back_to_calendar_json_when_it_actually_describes_this_year(self):
        with tempfile.TemporaryDirectory() as tmp:
            data_dir = Path(tmp)
            (data_dir / "calendar.json").write_text(json.dumps({'season': 2026, 'rounds': CALENDAR_ROUNDS}))
            with patch.object(scrape_gallery, "DATA_DIR", data_dir), \
                 patch.object(scrape_gallery, "CALENDAR_JSON", data_dir / "calendar.json"):
                result = load_calendar_rounds(2026)
        self.assertEqual(result, CALENDAR_ROUNDS)

    def test_returns_empty_when_neither_source_describes_the_target_year(self):
        with tempfile.TemporaryDirectory() as tmp:
            data_dir = Path(tmp)
            (data_dir / "calendar.json").write_text(json.dumps({'season': 2026, 'rounds': CALENDAR_ROUNDS}))
            with patch.object(scrape_gallery, "DATA_DIR", data_dir), \
                 patch.object(scrape_gallery, "CALENDAR_JSON", data_dir / "calendar.json"):
                result = load_calendar_rounds(2010)
        self.assertEqual(result, [])


class TestBuildGallery(unittest.TestCase):

    def test_returns_none_and_writes_nothing_when_listing_is_empty(self):
        with tempfile.TemporaryDirectory() as tmp:
            calendar_path = Path(tmp) / "calendar.json"
            calendar_path.write_text(json.dumps({'season': 2026, 'rounds': CALENDAR_ROUNDS}))
            with patch.object(scrape_gallery, "DATA_DIR", Path(tmp)), \
                 patch.object(scrape_gallery, "CALENDAR_JSON", calendar_path), \
                 patch.object(scrape_gallery, "GALLERY_DIR", Path(tmp) / "gallery"), \
                 patch("scrape_gallery.fetch_via_scrapfly",
                       side_effect=stub_fetch({'https://btcc.net/gallery/2026/': '<html>no albums</html>'})):
                result = build_gallery(2026, dry_run=False)
        self.assertIsNone(result)

    def test_writes_index_and_per_album_files_with_no_media_directory_at_all(self):
        donington_html = '<div>' + ''.join(photo_img(f'p{i}') for i in range(2)) + '</div>' + page_info(1, 1)
        launch_html = '<div>' + photo_img('l0') + '</div>' + page_info(1, 1)
        pages = {
            'https://btcc.net/gallery/2026/': LISTING_PAGE_1,
            'https://btcc.net/gallery/2026/2026-donington-park/': donington_html,
            'https://btcc.net/gallery/2026/2026-season-launch/': launch_html,
        }
        with tempfile.TemporaryDirectory() as tmp:
            calendar_path = Path(tmp) / "calendar.json"
            calendar_path.write_text(json.dumps({'season': 2026, 'rounds': CALENDAR_ROUNDS}))
            data_dir = Path(tmp)
            gallery_dir = data_dir / "gallery"
            with patch.object(scrape_gallery, "DATA_DIR", data_dir), \
                 patch.object(scrape_gallery, "CALENDAR_JSON", calendar_path), \
                 patch.object(scrape_gallery, "GALLERY_DIR", gallery_dir), \
                 patch("scrape_gallery.fetch_via_scrapfly", side_effect=stub_fetch(pages)):
                results = build_gallery(2026, dry_run=False)

            self.assertEqual(len(results), 2)
            index = json.loads((data_dir / "gallery2026.json").read_text())
            slugs = {a['slug'] for a in index['albums']}
            self.assertEqual(slugs, {'2026-donington-park', '2026-season-launch'})
            donington = next(a for a in index['albums'] if a['slug'] == '2026-donington-park')
            self.assertEqual(donington['round'], 1)
            self.assertTrue(donington['complete'])
            self.assertTrue((gallery_dir / "2026" / "2026-donington-park.json").exists())
            # No image mirroring at all - hotlink-only design.
            self.assertFalse((data_dir / "media" / "gallery").exists())

    def test_dry_run_does_not_write_any_files(self):
        donington_html = '<div>' + photo_img('p0') + '</div>' + page_info(1, 1)
        launch_html = '<div>' + photo_img('l0') + '</div>' + page_info(1, 1)
        pages = {
            'https://btcc.net/gallery/2026/': LISTING_PAGE_1,
            'https://btcc.net/gallery/2026/2026-donington-park/': donington_html,
            'https://btcc.net/gallery/2026/2026-season-launch/': launch_html,
        }
        with tempfile.TemporaryDirectory() as tmp:
            calendar_path = Path(tmp) / "calendar.json"
            calendar_path.write_text(json.dumps({'season': 2026, 'rounds': CALENDAR_ROUNDS}))
            data_dir = Path(tmp)
            with patch.object(scrape_gallery, "DATA_DIR", data_dir), \
                 patch.object(scrape_gallery, "CALENDAR_JSON", calendar_path), \
                 patch.object(scrape_gallery, "GALLERY_DIR", data_dir / "gallery"), \
                 patch("scrape_gallery.fetch_via_scrapfly", side_effect=stub_fetch(pages)):
                results = build_gallery(2026, dry_run=True)
            self.assertEqual(len(results), 2)
            self.assertFalse((data_dir / "gallery2026.json").exists())


if __name__ == "__main__":
    unittest.main()
