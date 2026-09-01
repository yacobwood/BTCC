#!/usr/bin/env python3
"""
BTCC gallery scraper - mirrors metadata (not images) for btcc.net's photo
gallery (btcc.net/gallery/, organized year -> album, one album per race
weekend plus occasional non-track events like a season-launch shoot or the
TOCA Awards, back to 2010) into data/gallery{year}.json + data/gallery/
{year}/<slug>.json, so the app's Gallery tab knows what albums/photos exist.

CONFIRMED LIVE 2026-08-28 (verified directly against the real site, not
guessed): gallery photos are NOT behind the same /api/media/<uuid> +
Vercel-BotID-challenge mechanism that blocks article/driver images from
direct client loading. They're served as direct, PUBLIC (non-signed,
non-expiring) Supabase Storage URLs
(https://<project>.supabase.co/storage/v1/object/public/gallery/...) on a
completely different host than btcc.net - Vercel's bot-challenge protects
btcc.net's own Vercel deployment and has no reach over a different origin.
Confirmed with a bare curl (no browser, no auth, no special headers - the
same shape of request CachedImage makes): clean 200, real image bytes.

This means, unlike every other btcc.net-facing scraper in this directory,
THIS ONE MIRRORS NO IMAGE BYTES AT ALL - it only extracts and stores the
real photo URLs (hotlinked directly by the app). No data/media/gallery/,
no save_mirrored_image(), no resize step. An earlier version of this
script was built around the (wrong, corrected after live verification)
assumption that gallery images needed the same treat-as-blocked mirroring
as article images - see git history / project memory for that reversal.

URL shapes (all confirmed live, not guessed):
  - Year listing:  https://btcc.net/gallery/<year>/              (paginated, ?page=N)
  - Album page:    https://btcc.net/gallery/<year>/<slug>/       (also paginated, ?page=N -
                    a single album's own photo grid can span many pages; Donington
                    Park's 2026 album alone is 8 pages)
  - Photo variant:  .../variants/thumb-gallery-<pipeline>-v1.webp (small, ~480x320) with a
                    same-shaped .../variants/display-gallery-<pipeline>-v1.webp (large,
                    ~1920x1280) sibling - same "swap a URL suffix for a pre-generated size"
                    idea as this codebase's own wpThumb()/carThumbUrl(), just a different
                    naming convention (<pipeline> varies - "import" for bulk-imported sets,
                    "editor-client" for manually-curated ones, seen so far).

A round can have MORE THAN ONE published album (e.g. a main "2026 -
Donington Park GP" album and a separately-published "The Captured Moments:
Donington Park GP" album) - match_round() resolves each independently; the
app's own grouping UI already handles more than one Race Weekend tile per
round without any special-casing needed.

Resumable, bounded-cost design (unchanged in spirit from the pre-hotlink
version, adapted to the actual unit of cost): since a hotlink-only scraper
never downloads photo bytes, the real per-run cost is PAGE LOADS, not image
downloads - fetching one page of an album returns every photo URL listed on
it in bulk (a single regex pass), so the expensive/boundable unit of work is
"how many paginated pages have been visited," not "how many photos have
been saved." Each album tracks lastPageScraped/totalPages/complete; a run
resumes any incomplete album from its next unscraped page before starting a
brand-new album, so a single very deep album (many pages) or a full
historical backlog naturally spreads across several scheduled runs instead
of exhausting one run's fetch budget. Historical seasons (2010-2025) are
still NOT auto-backfilled by the routine scheduled run - use --season YYYY
manually/via workflow_dispatch at whatever pace is convenient.

Usage:
    python scrape_gallery.py [--season YEAR] [--dry-run]
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

from scrapfly_fallback import fetch_via_scrapfly

GALLERY_YEAR_URL_TMPL = "https://btcc.net/gallery/{year}/"
GALLERY_ALBUM_URL_TMPL = "https://btcc.net/gallery/{year}/{slug}/"

# btcc.net's own year-listing slug for 2020 collides with something else in
# their URL scheme, forcing a "-1" suffix - confirmed live during the 2020
# backfill (2026-08-29): a bare /gallery/2020/ request 404s through to the
# generic gallery landing page (itself listing every year as a card - that's
# how /gallery/2020-1/ was found: it's one of those cards, and its own page
# has <h1>2020</h1> plus real 2020 album links to confirm it). Every other
# year checked so far (2017-2026) uses the plain "/gallery/{year}/" pattern -
# this is a one-off site quirk, not a new general naming rule.
GALLERY_YEAR_SLUG_OVERRIDES = {2020: '2020-1'}


def gallery_year_slug(year: int) -> str:
    return GALLERY_YEAR_SLUG_OVERRIDES.get(year, str(year))


DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"
CALENDAR_JSON = DATA_DIR / "calendar.json"
GALLERY_DIR = DATA_DIR / "gallery"

# Confirmed live against the real rendered page (view-source, not a guess):
# <div class="btcc-public-gallery-card-grid">
#   <a class="btcc-public-gallery-card" href="/gallery/2026/2026-donington-park-gp/">
#     <span class="btcc-public-gallery-card-media"><img src="..." alt="" loading="lazy"></span>
#     <h2>2026 - Donington Park GP</h2>
#   </a> ...
ALBUM_CARD_RE = re.compile(
    r'<a class="btcc-public-gallery-card" href="/gallery/(\d{4}(?:-\d+)?)/([a-z0-9-]+)/">(.*?)</a>',
    re.DOTALL,
)
CARD_TITLE_RE = re.compile(r'<h2>([^<]+)</h2>')
# `src` position within an <img> tag is NOT reliable - root-caused live
# 2026-08-28: btcc.net's "import"-pipeline albums render src as the img
# tag's first attribute, but "editor-client"-pipeline albums render it
# LAST (after alt/loading/width/height) - a `<img src="..."` anchored
# pattern silently matched zero photos on every editor-client page instead
# of erroring, which looked identical to "no new photos this page" rather
# than a parsing failure. `<img\b[^>]*\ssrc="..."` matches src at any
# attribute position within the tag (the required leading whitespace
# rules out an unrelated attribute merely ending in "src", e.g. a
# hypothetical "data-src").
CARD_COVER_RE = re.compile(r'<img\b[^>]*\ssrc="(https://[^"]+)"')

# Confirmed live: every photo on an album page is a direct, public Supabase
# Storage URL ending in .../variants/thumb-gallery-<pipeline>-v1.<ext> -
# already present in the server-rendered HTML itself (not injected only
# after a client-side scroll/lazy-load), so no scroll_through pass is
# needed here, unlike btcc.net/news/'s card images. See CARD_COVER_RE's
# comment above for why this doesn't anchor `src` to a fixed position.
PHOTO_IMG_RE = re.compile(
    r'<img\b[^>]*\ssrc="(https://[a-z0-9.-]+\.supabase\.co/storage/v1/object/public/gallery/[^"]*variants/thumb-[a-z0-9-]+\.(?:webp|jpg|jpeg|png))"'
)

# Confirmed live, identical markup on both the year listing and an album
# page (same shared pagination component): <span>Page <!-- -->1<!-- -->
# of <!-- -->8</span> - the HTML comments are React's own hydration
# markers, not decorative; kept literally in the pattern since that's what
# the server actually renders.
PAGE_INFO_RE = re.compile(r'<span>Page <!-- -->(\d+)<!-- --> of <!-- -->(\d+)</span>')


def display_url(thumb_url: str) -> str:
    """Derives the large (~1920x1280) sibling of a small (~480x320) thumb
    URL by swapping the one path segment that differs - confirmed live
    that both variants exist at the same base path for every photo checked,
    across both pipeline naming conventions seen (-import-v1, -editor-
    client-v1). Falls back to the thumb URL unchanged if the shape doesn't
    match (never invents a URL that wasn't actually seen)."""
    if '/variants/thumb-' not in thumb_url:
        return thumb_url
    return thumb_url.replace('/variants/thumb-', '/variants/display-')


def match_round(slug: str, title: str, year: int, calendar_rounds: list[dict]) -> tuple[int | None, str | None]:
    """Resolve a gallery album to a round/venue by fuzzy-matching its slug/
    title against data/calendar.json's already-scraped venue names for this
    season - no new scraped identifier invented. Returns (None, None) for a
    non-track event (season launch, TOCA Awards, a test day) or a genuinely
    ambiguous match, rather than guessing - consistent with this codebase's
    existing "fail loud / leave unassociated rather than guess" convention
    (see scrape_calendar.py's round-count-mismatch handling).

    Two substring directions are NOT equally trustworthy, confirmed live
    2026-08-28 against the real 2026 calendar (round 1 "Donington Park",
    round 7 "Donington Park GP" - one venue name is a literal prefix of
    another): a title like "2026 - Donington Park GP" contains BOTH venue
    names as substrings, but the longer one ("Donington Park GP") is
    unambiguously the more specific, correct match, not a genuine tie - a
    real album title naming the GP layout explicitly is never actually
    about the non-GP round. So a venue name found *within* the album's own
    text ("forward") prefers the single longest match among any that fire.
    The reverse direction - the album's own (generic) text found within a
    venue name, e.g. "Brands Hatch" is a substring of both "Brands Hatch
    Indy" and "Brands Hatch GP" - has no such resolving signal: there's
    nothing in "Brands Hatch" alone that says which extension is meant, so
    more than one reverse match stays genuinely unresolved."""
    def normalize(s: str) -> str:
        return re.sub(r'[^a-z0-9]+', ' ', s.lower()).strip()

    slug_norm = normalize(slug.replace('-gallery', '').replace('gallery', ''))
    title_norm = normalize(title)

    # A test day at a real circuit ("2026 - Croft Testing") is NOT the same
    # event as that circuit's actual race round, even though it shares the
    # venue name and would otherwise substring-match it - confirmed live
    # 2026-08-28: this scraper originally tagged it round 8 (Croft's real
    # race round), which is wrong - a test day runs on a different date,
    # isn't part of the championship weekend, and was never meant to
    # inherit that round's number (see this function's own docstring above,
    # which already documented "a test day" as an intended (None, None)
    # case - this was the gap between that stated intent and what the
    # substring-matching logic actually did). Checked before any
    # round-matching is attempted at all, so it can't be overridden by an
    # otherwise-strong venue-name match.
    #
    # A pre-season "Season Launch" shoot is the same category of non-race
    # event, found live 2026-08-29 while backfilling 2025: real title
    # "Donington Park - Season Launch - 2025" substring-matches round 1's
    # venue just like a test day would. It currently loses the canonical
    # tiebreak to the real "2025 - Donington Park" album (an exact match
    # wins in assign_canonical_albums()), so this wasn't yet a visible bug -
    # but that protection only holds because the real round-1 album already
    # existed at scrape time. A season's launch shoot is typically published
    # before that season's first race weekend even happens, so a future
    # season where the launch album is scraped first (and the real round-1
    # album doesn't exist yet, or isn't in calendar_rounds yet) would let it
    # win by default with nothing to lose to - same failure mode the test-
    # day exclusion above exists to prevent. Excluded here for the same
    # reason, before it ever becomes a live bug rather than after.
    # "Kwik Fit"-branded events (a real, separate promotional/endurance
    # series, not a BTCC championship round) are the same category of
    # non-race event, found live during the 2021 backfill (2026-08-29):
    # "2021 - Kwik Fit Thruxton 24" is a genuinely distinct, smaller (4
    # pages) gallery from both real Thruxton race weekends that season
    # ("2021 - Thruxton" and "2021 - Thruxton 2", 7 pages each) - confirmed
    # by fetching all three directly, not assumed. 2022's "Kwik Fit 24
    # Mile" already resolved to None on its own (no venue name in its
    # title at all), but this one names "Thruxton" explicitly, so it needs
    # the same explicit exclusion as test/testing/launch above.
    if 'test' in slug_norm.split() or 'testing' in slug_norm.split() \
            or 'test' in title_norm.split() or 'testing' in title_norm.split() \
            or 'launch' in slug_norm.split() or 'launch' in title_norm.split() \
            or 'kwik fit' in slug_norm or 'kwik fit' in title_norm:
        return None, None, False

    # A real album title is *always* at least year-prefixed ("2026 -
    # Donington Park GP") - without stripping that for the exact check
    # specifically, "exact" could never fire for any real title at all
    # (every one would fall through to "forward" instead), which would make
    # is_exact meaningless as a canonical-album signal for
    # assign_canonical_albums(). Only strips a bare leading/trailing year -
    # "The Captured Moments: Knockhill 2026" still correctly stays
    # non-exact (the year is followed/preceded by real extra words even
    # after stripping), matched via the forward/substring path instead.
    year_str = str(year)
    def strip_year(s: str) -> str:
        s = re.sub(rf'^{year_str}\s*', '', s)
        s = re.sub(rf'\s*{year_str}$', '', s)
        return s.strip()

    slug_exact = strip_year(slug_norm)
    title_exact = strip_year(title_norm)

    # btcc.net's own gallery naming isn't perfectly consistent even for the
    # same circuit across different years - confirmed live during the 2023
    # backfill (2026-08-29): 2023's actual GP-round album is titled "2023 -
    # Donington GP", dropping "Park" entirely, unlike every other season
    # checked (2024/2025/2026 all say "Donington Park GP" in full). Applied
    # only to a venue name that actually contains the standalone word "park"
    # (so far: Donington Park, Donington Park GP, Oulton Park) and only ever
    # consulted when the strict (unmodified) comparison above it already
    # failed - every previously-passing case (which all matched strictly)
    # is completely unaffected by this.
    def strip_park(s: str) -> str:
        return normalize(re.sub(r'\bpark\b', ' ', s))

    # Plain Python `in` treats "thruxton 2" as contained within "thruxton
    # 24" - a real substring, but a false positive: round 6's "Thruxton 2"
    # is NOT the same event as "2021 - Kwik Fit Thruxton 24" (a separate,
    # smaller 4-page promotional gallery, confirmed live during the 2021
    # backfill - excluded above by name, but this boundary check is kept as
    # a general-purpose safety net against the next numeric-suffix
    # collision, not specific to that one title). Requires the character
    # immediately before/after the match, if any, to not itself be
    # alphanumeric, so a match can't be a fragment of a larger word/number.
    def contains_whole(haystack: str, needle: str) -> bool:
        return re.search(rf'(?<![a-z0-9]){re.escape(needle)}(?![a-z0-9])', haystack) is not None

    candidates = [r for r in calendar_rounds if r.get('venue')]

    exact = []
    forward = []  # venue name found within the album's own text
    reverse = []  # album's own text found within the venue name

    for r in candidates:
        venue_norm = normalize(r['venue'])
        if not venue_norm:
            continue
        venue_loose = strip_park(venue_norm) if venue_norm != strip_park(venue_norm) else None
        if venue_norm == slug_exact or venue_norm == title_exact:
            exact.append(r)
        elif venue_loose and (venue_loose == slug_exact or venue_loose == title_exact):
            exact.append(r)
        elif contains_whole(slug_norm, venue_norm) or contains_whole(title_norm, venue_norm):
            forward.append((r, len(venue_norm)))
        elif venue_loose and (contains_whole(slug_norm, venue_loose) or contains_whole(title_norm, venue_loose)):
            forward.append((r, len(venue_loose)))
        elif contains_whole(venue_norm, slug_norm):
            reverse.append(r)

    if len(exact) == 1:
        return exact[0]['round'], exact[0]['venue'], True
    if forward:
        max_len = max(length for _, length in forward)
        longest = [r for r, length in forward if length == max_len]
        if len(longest) == 1:
            return longest[0]['round'], longest[0]['venue'], False
        return None, None, False
    if len(reverse) == 1:
        return reverse[0]['round'], reverse[0]['venue'], False
    return None, None, False


# A small number of (year, slug) pairs are genuinely unresolvable by
# match_round() alone - not a matching-logic bug, but a real gap in the
# calendar data match_round() has to compare against. Confirmed live
# 2026-08-29: data/results2013.json uses the bare, IDENTICAL string "Brands
# Hatch" for both round 1 (season opener) and round 10 (season closer),
# with no Indy/GP qualifier at all (unlike 2014 onward, which already
# distinguish them explicitly) - so any venue-name comparison ties, even
# though the real gallery albums themselves ARE cleanly, unambiguously
# titled "Brands Hatch Indy"/"Brands Hatch GP".
#
# Resolved via real historical research rather than left unresolved
# forever - the deliberate, cited exception to match_round()'s own "fail
# loud, don't guess" convention, not a guess itself: 2013 round 1
# (~31 March) ran on Brands Hatch's Indy Circuit, round 10 (~13 October) on
# its Grand Prix Circuit - confirmed via
# https://en.wikipedia.org/wiki/2013_British_Touring_Car_Championship,
# cross-checked against
# https://www.touringcars.net/database/race.php?id=2470 (independently
# confirms Brands Hatch hosted both 2013's opening and closing weekends).
HISTORICAL_ROUND_OVERRIDES: dict[tuple[int, str], tuple[int, str]] = {
    (2013, 'brands-hatch-indy'): (1, 'Brands Hatch'),
    (2013, 'brands-hatch-gp'): (10, 'Brands Hatch'),
}


def match_round_resolved(slug: str, title: str, year: int, calendar_rounds: list[dict]) -> tuple[int | None, str | None, bool]:
    """match_round(), with HISTORICAL_ROUND_OVERRIDES consulted only as a
    last resort - never overrides a real match_round() result, so a future,
    genuinely different ambiguity for the same slug can't be silently
    masked by a stale override. is_exact is reported True for an override:
    "Brands Hatch Indy"/"Brands Hatch GP" are the real, unembellished event
    names, and each is the only album for its round in 2013 - is_exact only
    ever matters as assign_canonical_albums()'s tiebreak when more than one
    album shares a round, which isn't the case here, but True is the
    semantically honest value regardless."""
    round_num, venue, is_exact = match_round(slug, title, year, calendar_rounds)
    if round_num is None:
        override = HISTORICAL_ROUND_OVERRIDES.get((year, slug))
        if override:
            return override[0], override[1], True
    return round_num, venue, is_exact


def assign_canonical_albums(albums: list[dict], year: int, calendar_rounds: list[dict]) -> None:
    """Mutates each album dict in place, adding `isCanonical`. Confirmed live
    2026-08-28: a round can have more than one published album (e.g. a main
    "2026 - Donington Park GP" album AND a separately-published "The
    Captured Moments: Donington Park GP" one) - match_round() correctly
    resolves both to the same round, but showing every one of them as its
    own "Race Weekends" tile with a duplicate round chip reads as cluttered/
    wrong, not as "there are two galleries for this weekend." Exactly one
    album per round is marked canonical (the one the app's Gallery tab
    treats as the round's own tile; every other album for that round -
    still correctly associated with it - is grouped under "Other" instead).

    Recomputes match_round() fresh for every album (cheap, pure, no network)
    rather than trusting a previously-stored round/venue, so this stays
    correct even for albums untouched by the current run. Preference order
    when a round has more than one candidate: an exact match (the album's
    own title, once its year prefix is stripped, is nothing but the venue's
    plain name) beats a fuzzy/substring match within a richer, branded
    title ("The Captured Moments: ...", "Driven By Sport - ...") - ties
    (shouldn't normally happen) fall back to the shortest title, the
    closest available proxy for "least embellished.\""""
    by_round: dict[int, list[dict]] = {}
    for album in albums:
        round_num, venue, is_exact = match_round_resolved(album['slug'], album['title'], year, calendar_rounds)
        album['round'] = round_num
        album['venue'] = venue
        album['isCanonical'] = False  # default; the winner below flips this
        if round_num is not None:
            by_round.setdefault(round_num, []).append((album, is_exact))

    for _round_num, entries in by_round.items():
        exact_entries = [a for a, is_exact in entries if is_exact]
        pool = exact_entries if exact_entries else [a for a, _ in entries]
        # Real live case, 2022 backfill (2026-08-29): round 5 (Croft) had
        # TWO separately-published, both-exact-match albums - "2022 - Croft"
        # (528 photos, 11 pages) and a smaller, bare-titled "Croft" (384
        # photos, 8 pages, slug "croft-3"). Shortest-title-wins alone picks
        # "Croft" purely because it lacks the year prefix, not because it's
        # the more "plain"/official one in the sense this tiebreak was
        # built for (that was about a branded "Captured Moments: ..." title
        # being longer, not about a year prefix) - confirmed live it's
        # actually the smaller, secondary album. Every real main round
        # album observed across every season backfilled so far (2023-2026)
        # follows the "YYYY - Venue" convention, so a title starting with
        # the season year is preferred first; shortest title is still the
        # tiebreak among whatever's left (unaffected when only one exact
        # match exists at all, which is the common case).
        winner = min(pool, key=lambda a: (0 if a['title'].strip().startswith(str(year)) else 1, len(a['title'])))
        winner['isCanonical'] = True


def _fetch_paginated(base_url: str, referer: str, start_page: int = 1):
    """Yields (page_number, html) for base_url and each subsequent page
    (base_url?page=2, ?page=3, ...) as found via PAGE_INFO_RE, starting
    from start_page (so a resumed album can skip pages it already scraped),
    stopping at the real last page, on a fetch failure, or if a page fails
    to parse a page-info span at all (treated as a single, unpaginated
    page)."""
    page = start_page
    while True:
        url = base_url if page == 1 else f"{base_url}?page={page}"
        html = fetch_via_scrapfly(url, referer=referer, render_js=True, label=base_url)
        if html is None:
            return
        yield page, html
        page_info = PAGE_INFO_RE.search(html)
        if not page_info:
            return
        total_pages = int(page_info.group(2))
        if page >= total_pages:
            return
        page += 1


def scrape_gallery_listing(year: int) -> list[dict]:
    """Fetch every page of the year-scoped gallery listing and return
    [{slug, title, cover_src}, ...] for every album card found, across
    however many listing pages exist (small in practice - 2 for 2026 at
    time of writing - so always fully paginated, unlike an album's own
    potentially much deeper pagination handled separately below)."""
    listing_url = GALLERY_YEAR_URL_TMPL.format(year=gallery_year_slug(year))
    albums = []
    seen_slugs = set()
    for _page_num, html in _fetch_paginated(listing_url, referer="https://btcc.net/gallery/"):
        for m in ALBUM_CARD_RE.finditer(html):
            card_year, slug, content = m.group(1), m.group(2), m.group(3)
            if card_year != gallery_year_slug(year) or slug in seen_slugs:
                continue
            title_m = CARD_TITLE_RE.search(content)
            if not title_m:
                continue
            cover_m = CARD_COVER_RE.search(content)
            seen_slugs.add(slug)
            albums.append({
                'slug': slug,
                'title': title_m.group(1).strip(),
                'cover_src': cover_m.group(1) if cover_m else None,
            })
    return albums


def load_existing_index(year: int) -> dict:
    """Returns {slug: album_summary} from data/gallery{year}.json, or {} if
    it doesn't exist yet (first run for this season)."""
    path = DATA_DIR / f"gallery{year}.json"
    if not path.exists():
        return {}
    try:
        data = json.loads(path.read_text())
    except (json.JSONDecodeError, OSError):
        return {}
    return {a['slug']: a for a in data.get('albums', []) if a.get('slug')}


def load_existing_album(year: int, slug: str) -> dict | None:
    """Returns the full per-album detail JSON (with its photos list and
    pagination progress), or None if this album has never been captured
    before (a genuinely new album, not just missing from the index)."""
    path = GALLERY_DIR / str(year) / f"{slug}.json"
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text())
    except (json.JSONDecodeError, OSError):
        return None


def process_album(
    year: int, slug: str, title: str, cover_src: str | None,
    listing_url: str, calendar_rounds: list[dict],
) -> dict:
    """Fetches whichever of an album's paginated pages haven't been scraped
    yet, extracting every photo URL found (deduped by URL, so a resumed run
    never double-counts a photo already known) - never downloads or resizes
    anything, only stores the real hotlinked URLs."""
    existing = load_existing_album(year, slug)
    photos = list(existing.get('photos', [])) if existing else []
    known_urls = {p['thumbUrl'] for p in photos}
    last_page_scraped = existing.get('lastPageScraped', 0) if existing else 0
    total_pages = existing.get('totalPages') if existing else None
    first_page_photo_count = existing.get('_firstPagePhotoCount') if existing else None

    album_url = GALLERY_ALBUM_URL_TMPL.format(year=gallery_year_slug(year), slug=slug)
    print(f"  Scraping album: {slug} (page {last_page_scraped + 1} onward, {len(photos)} photo(s) already known)")

    page_before_this_run = last_page_scraped
    for page_num, html in _fetch_paginated(album_url, referer=listing_url, start_page=last_page_scraped + 1):
        page_new = 0
        for m in PHOTO_IMG_RE.finditer(html):
            thumb = m.group(1)
            if thumb in known_urls:
                continue
            known_urls.add(thumb)
            photos.append({'thumbUrl': thumb, 'viewUrl': display_url(thumb)})
            page_new += 1
        if page_num == 1 and first_page_photo_count is None:
            first_page_photo_count = page_new
        page_info = PAGE_INFO_RE.search(html)
        if page_info:
            total_pages = int(page_info.group(2))
        last_page_scraped = page_num

    if total_pages is None and last_page_scraped > page_before_this_run:
        # We genuinely fetched at least one new page this run and none of
        # them had a <nav class="btcc-public-gallery-pagination"> at all -
        # confirmed live 2026-08-28 ("The Captured Moments: Knockhill 2026",
        # 23 real photos, zero pagination markup) this is a real, single-page
        # album, not a budget cutoff (which would leave last_page_scraped
        # unchanged from its pre-run value, the case this condition
        # excludes). The one page we reached IS the whole album.
        total_pages = last_page_scraped

    complete = total_pages is not None and last_page_scraped >= total_pages
    if complete:
        total_count = len(photos)
    elif total_pages and first_page_photo_count:
        # Best-effort estimate until the real last (possibly partial) page
        # is actually reached - refined every subsequent run, never treated
        # as exact until complete is true.
        total_count = max(len(photos), first_page_photo_count * total_pages)
    else:
        total_count = len(photos)

    # is_exact isn't needed here - assign_canonical_albums() (called once,
    # in build_gallery(), after every album for the season is known) is
    # what actually decides isCanonical, since that needs to compare across
    # albums sharing the same round, not just this one in isolation.
    round_num, venue, _is_exact = match_round_resolved(slug, title, year, calendar_rounds)
    if photos:
        cover_url = photos[0]['thumbUrl']
    elif cover_src:
        cover_url = cover_src
    else:
        cover_url = None

    print(f"    {len(photos)} photo(s) known, page {last_page_scraped}/{total_pages or '?'}, complete={complete}")

    return {
        'slug': slug,
        'title': title,
        'year': year,
        'round': round_num,
        'venue': venue,
        'lastPageScraped': last_page_scraped,
        'totalPages': total_pages,
        '_firstPagePhotoCount': first_page_photo_count,
        'capturedCount': len(photos),
        'totalCount': total_count,
        'complete': complete,
        'photos': photos,
        '_cover': cover_url,
    }


def load_calendar_rounds(year: int) -> list[dict]:
    """Round/venue data for match_round(), scoped to the target year - NOT
    always data/calendar.json, which only ever holds the CURRENT season's
    fixture list (confirmed live 2026-08-28: season 2026, 10 rounds, no
    per-year selector at all - it's just this season's calendar). Blindly
    reading it regardless of `year` would silently match a historical
    season's albums (e.g. --season 2025) against the CURRENT season's round
    order/venue list instead of that season's own - wrong whenever the two
    seasons' calendars don't line up round-for-round, which is the common
    case, not an edge case.

    data/results{year}.json carries the same {round, venue, ...} shape per
    round for every season back to 2004 (confirmed identical in content to
    calendar.json's own rounds for 2026 itself), so prefer it - it's the
    real per-year source of truth. Fall back to calendar.json only when it's
    actually describing this exact year (e.g. scraping the current season
    before its results file has any rounds in it yet, such as a pre-season
    testing-day gallery)."""
    results_path = DATA_DIR / f"results{year}.json"
    if results_path.exists():
        with open(results_path) as f:
            rounds = json.load(f).get('rounds', [])
        if rounds:
            return rounds
    with open(CALENDAR_JSON) as f:
        calendar = json.load(f)
    return calendar.get('rounds', []) if calendar.get('season') == year else []


def build_gallery(year: int, dry_run: bool) -> list[dict] | None:
    listing_url = GALLERY_YEAR_URL_TMPL.format(year=gallery_year_slug(year))
    cards = scrape_gallery_listing(year)
    if not cards:
        print(f"ERROR: no gallery albums found for {year} - page structure may have changed", file=sys.stderr)
        return None

    calendar_rounds = load_calendar_rounds(year)

    existing_index = load_existing_index(year)
    # Resumable-first: any album already known but not yet complete gets
    # processed before a brand-new one, so a deep album's own pagination
    # backlog doesn't get starved every run by an ever-growing set of
    # brand-new albums.
    cards_by_slug = {c['slug']: c for c in cards}
    incomplete_slugs = [s for s, a in existing_index.items() if not a.get('complete') and s in cards_by_slug]
    new_slugs = [c['slug'] for c in cards if c['slug'] not in existing_index]
    order = incomplete_slugs + new_slugs

    results = []
    for slug in order:
        card = cards_by_slug[slug]
        album = process_album(year, slug, card['title'], card['cover_src'], listing_url, calendar_rounds)
        results.append(album)

    # Albums untouched this run (nothing left to do) keep whatever's already
    # on disk/in the index unchanged - never dropped for not being
    # re-visited this run.
    untouched = {s: a for s, a in existing_index.items() if s not in {r['slug'] for r in results}}

    # Runs across every album for the season (both freshly-scraped and
    # untouched-this-run), not just this run's own results - picking a
    # canonical album per round only makes sense with the full picture, and
    # it's a cheap, pure, local recomputation (no network), so there's no
    # reason to skip it just because a given album wasn't touched this run.
    assign_canonical_albums(results + list(untouched.values()), year, calendar_rounds)

    if dry_run:
        print("Dry run - no files written.")
        return results

    gallery_dir_year = GALLERY_DIR / str(year)
    gallery_dir_year.mkdir(parents=True, exist_ok=True)
    for album in results:
        path = gallery_dir_year / f"{album['slug']}.json"
        with open(path, 'w') as f:
            json.dump({k: v for k, v in album.items() if k != '_cover'}, f, indent=2)

    index_albums = list(untouched.values())
    for album in results:
        index_albums.append({
            'slug': album['slug'],
            'title': album['title'],
            'cover': album['_cover'],
            'round': album['round'],
            'venue': album['venue'],
            'isCanonical': album['isCanonical'],
            'capturedCount': album['capturedCount'],
            'totalCount': album['totalCount'],
            'complete': album['complete'],
        })
    with open(DATA_DIR / f"gallery{year}.json", 'w') as f:
        json.dump({'season': year, 'albums': index_albums}, f, indent=2)

    return results


def main():
    ap = argparse.ArgumentParser(description="Mirror BTCC gallery metadata (hotlinked photo URLs, no image bytes) into data/gallery{year}.json + data/gallery/{year}/*.json")
    ap.add_argument("--season", type=int, default=None, help="Season year (default: current season from data/calendar.json)")
    ap.add_argument("--dry-run", action="store_true", help="Print result only, do not write")
    args = ap.parse_args()

    year = args.season
    if year is None:
        with open(CALENDAR_JSON) as f:
            year = json.load(f)['season']

    results = build_gallery(year, args.dry_run)
    if results is None:
        sys.exit(1)

    print(f"\nProcessed {len(results)} album(s) for {year}")
    for a in results:
        status = 'complete' if a['complete'] else f"page {a['lastPageScraped']}/{a['totalPages'] or '?'}, {a['capturedCount']} photo(s) so far"
        print(f"  {a['slug']}: {status}")


if __name__ == "__main__":
    main()
