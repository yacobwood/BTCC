jest.mock('../../src/store/cache', () => ({
  cacheWrite: jest.fn(() => Promise.resolve()),
  cacheRead:  jest.fn(() => Promise.resolve(null)),
}));


// calendar.json must be importable in test env
jest.mock('../../data/calendar.json', () => ({
  rounds: [{round: 1, venue: 'Donington Park'}],
  seasonStartDate: '2026-04-18',
}));

jest.mock('../../data/penalties2026.json', () => ({
  season: '2026',
  rounds: [{round: 1, penalties: [{session: 'Free Practice', driver: 'Bundled Driver', oneLiner: 'Bundled Driver: fallback data'}]}],
}));

import {cacheWrite, cacheRead} from '../../src/store/cache';
import {
  fetchCalendar,
  fetchDrivers,
  fetchStandings,
  fetchResults,
  fetchPenalties,
  fetchArticles,
  fetchArticleBySlug,
  fetchHubPosts,
  fetchExplainerArticles,
  fetchExplainerArticleById,
  peekArticlesCache,
  fetchLiveStatus,
  fetchBlacklist,
  fetchMerchStores,
  fetchPartners,
  fetchGallery,
  fetchGalleryAlbum,
} from '../../src/api/client';

describe('fetchCalendar', () => {
  it('returns remote calendar data when fetch succeeds', async () => {
    const remote = {rounds: [{round: 1}]};
    global.fetch.mockResolvedValueOnce({ok: true, json: () => Promise.resolve(remote)});
    const data = await fetchCalendar();
    expect(data.rounds).toBeDefined();
    expect(Array.isArray(data.rounds)).toBe(true);
  });

  it('falls back to bundled calendar when fetch fails', async () => {
    global.fetch.mockRejectedValueOnce(new Error('network error'));
    const data = await fetchCalendar();
    expect(data.rounds).toBeDefined();
    expect(Array.isArray(data.rounds)).toBe(true);
  });
});

describe('fetchDrivers', () => {
  it('fetches from the correct GitHub URL', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({drivers: []}),
    });

    await fetchDrivers();

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('drivers.json'),
    );
  });

  it('writes result to cache', async () => {
    const data = {drivers: [{name: 'Tom'}]};
    global.fetch.mockResolvedValueOnce({ok: true, json: () => Promise.resolve(data)});

    await fetchDrivers();

    expect(cacheWrite).toHaveBeenCalledWith('drivers', data);
  });

  it('returns cached data immediately (stale-while-revalidate) even when fetch fails', async () => {
    global.fetch.mockResolvedValueOnce({ok: false});
    cacheRead.mockResolvedValueOnce({drivers: [{name: 'Cached Driver'}]});

    const result = await fetchDrivers();

    // Bounded staleness (not staleFirst): a maxAge is passed so a cache older than
    // this gets treated as a miss, forcing a blocking re-fetch instead of serving
    // indefinitely stale data if a background refresh ever silently fails.
    expect(cacheRead).toHaveBeenCalledWith('drivers', 60 * 60 * 1000);
    expect(result).toEqual({drivers: [{name: 'Cached Driver'}]});
  });

  it('falls back to bundled data when fetch fails and no cache exists', async () => {
    global.fetch.mockResolvedValueOnce({ok: false});
    cacheRead.mockResolvedValueOnce(null);

    // Should resolve with bundled snapshot rather than throwing
    const result = await fetchDrivers();
    expect(result).toBeDefined();
    expect(result.drivers).toBeDefined();
  });

  it('falls back to cache when network throws', async () => {
    global.fetch.mockRejectedValueOnce(new Error('network error'));
    cacheRead.mockResolvedValueOnce({drivers: []});

    const result = await fetchDrivers();
    expect(result).toEqual({drivers: []});
  });


});

describe('fetchStandings', () => {
  it('fetches from standings.json URL', async () => {
    global.fetch.mockResolvedValueOnce({ok: true, json: () => Promise.resolve({standings: []})});

    await fetchStandings();

    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('standings.json'));
  });
});

describe('fetchResults', () => {
  it('defaults to year 2026', async () => {
    global.fetch.mockResolvedValueOnce({ok: true, json: () => Promise.resolve({rounds: []})});

    await fetchResults();

    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('results2026.json'));
  });

  it('fetches the correct year', async () => {
    global.fetch.mockResolvedValueOnce({ok: true, json: () => Promise.resolve({rounds: []})});

    await fetchResults(2025);

    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('results2025.json'));
  });

  it('uses year-specific cache key', async () => {
    const data = {rounds: []};
    global.fetch.mockResolvedValueOnce({ok: true, json: () => Promise.resolve(data)});

    await fetchResults(2024);

    expect(cacheWrite).toHaveBeenCalledWith('results_2024', data);
  });

  it('resolves with the cached value immediately even when AbortSignal.timeout is unsupported on the runtime', async () => {
    // Root-caused live 2026-08-28 via the Gallery tab: fetchJson's cached-hit
    // branch built its background-refresh fetch options with
    // `{signal: AbortSignal.timeout(10000)}` - Node (and this Jest env) has
    // real support for it, so this bug was invisible to every existing test
    // here, but it's documented elsewhere in this codebase as unreliable on
    // Android/Hermes (see src/utils/weather.js's own AbortController
    // workaround). When unsupported, calling it throws synchronously,
    // *before* fetch() is even invoked - and since that whole branch sits
    // outside fetchJson's own try/catch, the throw rejected the entire
    // fetchJson() call instead of resolving with the cached value it
    // already had in hand. Simulates that broken runtime directly by
    // deleting the method, rather than trusting Node's own working version
    // to prove anything about Hermes.
    const original = global.AbortSignal.timeout;
    delete global.AbortSignal.timeout;
    try {
      const cachedData = {rounds: [{round: 1}]};
      cacheRead.mockResolvedValueOnce(cachedData);
      // The background refresh itself may still be attempted/fail silently -
      // this mock only needs to exist so nothing else throws if it's reached.
      global.fetch.mockResolvedValueOnce({ok: true, json: () => Promise.resolve(cachedData)});

      const result = await fetchResults(2026);

      expect(result).toEqual(cachedData);
    } finally {
      global.AbortSignal.timeout = original;
    }
  });
});

describe('fetchPenalties', () => {
  it('defaults to year 2026', async () => {
    global.fetch.mockResolvedValueOnce({ok: true, json: () => Promise.resolve({rounds: []})});

    await fetchPenalties();

    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('penalties2026.json'));
  });

  it('fetches the correct year', async () => {
    global.fetch.mockResolvedValueOnce({ok: true, json: () => Promise.resolve({rounds: []})});

    await fetchPenalties(2025);

    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('penalties2025.json'));
  });

  it('uses year-specific cache key', async () => {
    const data = {rounds: []};
    global.fetch.mockResolvedValueOnce({ok: true, json: () => Promise.resolve(data)});

    await fetchPenalties(2024);

    expect(cacheWrite).toHaveBeenCalledWith('penalties_2024', data);
  });

  it('returns an empty-but-valid shape for a year with no bundled fallback', async () => {
    global.fetch.mockResolvedValueOnce({ok: false, status: 404});
    cacheRead.mockResolvedValueOnce(null); // no stale cache to fall back on either

    const result = await fetchPenalties(2027);

    expect(result).toEqual({season: '2027', rounds: []});
  });

  it('falls back to the bundled 2026 snapshot on network error, not an empty list', async () => {
    global.fetch.mockResolvedValueOnce({ok: false, status: 404});
    cacheRead.mockResolvedValueOnce(null);

    const result = await fetchPenalties(2026);

    expect(result.rounds[0].penalties[0].driver).toBe('Bundled Driver');
  });
});

describe('fetchGallery', () => {
  it('fetches the correct year\'s season index', async () => {
    global.fetch.mockResolvedValueOnce({ok: true, json: () => Promise.resolve({season: 2026, albums: []})});

    await fetchGallery(2026);

    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('gallery2026.json'));
  });

  it('uses a year-specific cache key', async () => {
    const data = {season: 2025, albums: []};
    global.fetch.mockResolvedValueOnce({ok: true, json: () => Promise.resolve(data)});

    await fetchGallery(2025);

    expect(cacheWrite).toHaveBeenCalledWith('gallery_2025', data);
  });

  it('returns an empty-but-valid shape on a 404 (no gallery scraped for this year yet)', async () => {
    global.fetch.mockResolvedValueOnce({ok: false, status: 404});
    cacheRead.mockResolvedValueOnce(null);

    const result = await fetchGallery(2010);

    expect(result).toEqual({season: 2010, albums: []});
  });

  it('propagates a genuine network error rather than swallowing it into an empty result', async () => {
    // Root-caused live 2026-08-28: swallowing every failure (not just a
    // 404) into {albums: []} made GalleryTab's own retry-capable error UI
    // permanently unreachable - a real fetch failure looked identical to
    // "this season genuinely has no albums." Only a 404 should degrade
    // quietly; anything else must reject so the caller's catch block runs.
    global.fetch.mockRejectedValueOnce(new Error('network error'));
    cacheRead.mockResolvedValueOnce(null);

    await expect(fetchGallery(2026)).rejects.toThrow('network error');
  });
});

describe('fetchGalleryAlbum', () => {
  it('fetches the correct year/slug album file', async () => {
    global.fetch.mockResolvedValueOnce({ok: true, json: () => Promise.resolve({photos: []})});

    await fetchGalleryAlbum(2026, 'donington-park-gallery');

    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('gallery/2026/donington-park-gallery.json'));
  });

  it('returns null on a 404 (album not found)', async () => {
    global.fetch.mockResolvedValueOnce({ok: false, status: 404});
    cacheRead.mockResolvedValueOnce(null);

    const result = await fetchGalleryAlbum(2026, 'missing-album');

    expect(result).toBeNull();
  });

  it('propagates a genuine network error rather than returning null', async () => {
    global.fetch.mockRejectedValueOnce(new Error('network error'));
    cacheRead.mockResolvedValueOnce(null);

    await expect(fetchGalleryAlbum(2026, 'donington-park-gallery')).rejects.toThrow('network error');
  });
});

describe('fetchArticles', () => {
  it('fetches the GitHub-mirrored per-page file for the requested page (btcc.net wp-json is blocked)', async () => {
    global.fetch.mockResolvedValueOnce({ok: true, json: () => Promise.resolve([])});

    await fetchArticles(1);

    const url = global.fetch.mock.calls[0][0];
    expect(url).toContain('articles/page_1.json');
  });

  it('fetches a different page file for a later page - no client-side slicing of one big array', async () => {
    const page2 = [{id: 20, title: {rendered: 'Post 20'}, content: {rendered: ''}}];
    global.fetch.mockResolvedValueOnce({ok: true, json: () => Promise.resolve(page2)});

    const result = await fetchArticles(2, 20);

    expect(global.fetch.mock.calls[0][0]).toContain('articles/page_2.json');
    expect(result).toEqual(page2);
  });

  it('searches by fetching the index then every distinct page it points at, filtering title or content', async () => {
    const index = {a: 1, b: 1, c: 2};
    const page1 = [
      {id: 'a', slug: 'a', title: {rendered: 'Ingram wins Donington'}, content: {rendered: ''}},
      {id: 'b', slug: 'b', title: {rendered: 'Unrelated story'}, content: {rendered: ''}},
    ];
    const page2 = [
      {id: 'c', slug: 'c', title: {rendered: 'Cammish takes pole'}, content: {rendered: 'mentions Ingram in the writeup'}},
    ];
    global.fetch
      .mockResolvedValueOnce({ok: true, json: () => Promise.resolve(index)})
      .mockResolvedValueOnce({ok: true, json: () => Promise.resolve(page1)})
      .mockResolvedValueOnce({ok: true, json: () => Promise.resolve(page2)});

    const result = await fetchArticles(1, 20, 'Ingram');

    expect(result.map(p => p.id)).toEqual(['a', 'c']);
  });

  it('caches each page under its own key, not a shared one', async () => {
    const page1 = [{id: 1}];
    global.fetch.mockResolvedValueOnce({ok: true, json: () => Promise.resolve(page1)});

    await fetchArticles(1);

    expect(cacheWrite).toHaveBeenCalledWith('news_p1', page1);
  });

  it('falls back to that page\'s own cache on network error', async () => {
    const cached = [{id: 99, title: {rendered: 'Cached'}, content: {rendered: ''}}];
    // First cacheRead: cache miss (no fresh data). Then fetch fails. Then staleFallback cacheRead: returns stale.
    cacheRead.mockResolvedValueOnce(null).mockResolvedValueOnce(cached);
    global.fetch.mockResolvedValueOnce({ok: false});

    const result = await fetchArticles(1);
    expect(result).toEqual(cached);
  });

  it('bounds the network-error fallback to ARTICLES_MAX_AGE_MS rather than any cached age', async () => {
    // A network blip mid-reload (e.g. Fast Refresh cycling) must not resurface a
    // snapshot older than one scrape cycle - see the News tab "flash of different
    // articles" fix. Previously this second cacheRead call had no maxAge argument
    // at all, so a network failure could serve an arbitrarily old cached page.
    const cached = [{id: 99, title: {rendered: 'Cached'}, content: {rendered: ''}}];
    cacheRead.mockResolvedValueOnce(null).mockResolvedValueOnce(cached);
    global.fetch.mockResolvedValueOnce({ok: false});

    await fetchArticles(1);

    expect(cacheRead).toHaveBeenNthCalledWith(2, 'news_p1', 5 * 60 * 1000);
  });

  it('forceRefresh bypasses cache and always hits the network', async () => {
    const fresh = [{id: 42}];
    global.fetch.mockResolvedValueOnce({ok: true, json: () => Promise.resolve(fresh)});

    const result = await fetchArticles(1, 20, '', /* forceRefresh */ true);

    expect(result).toEqual(fresh);
    // cacheRead must not have been called — forceRefresh skips the cache check entirely
    expect(cacheRead).not.toHaveBeenCalled();
  });

  // Regression coverage: found live 2026-09-03 while investigating a user
  // report of a broken-looking News tab on slow wifi. A genuine network
  // failure with no usable stale cache used to be silently swallowed into
  // an empty array here, indistinguishable from "nothing's published yet" -
  // NewsScreen.js's own staleFallback/error/retry handling never got the
  // chance to run, and the screen ended up showing only the independently-
  // cached Flying Lap/Academy banners above a permanently blank, unexplained
  // feed. The non-search list fetch must now propagate a genuine failure
  // once fetchJson's own bounded staleFallback has already come up empty,
  // so the caller can show a real error and a retry button.
  it('propagates a genuine network error when no usable stale cache exists (non-search)', async () => {
    cacheRead.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    global.fetch.mockRejectedValueOnce(new Error('Network request failed'));

    await expect(fetchArticles(1)).rejects.toThrow('Network request failed');
  });

  // Search fans out across every mirrored page (see fetchArticlesIndex above) -
  // one page failing shouldn't sink the whole search the way it should for
  // the primary single-page list fetch, so this deliberately keeps the old
  // swallow-and-continue behaviour rather than also propagating.
  it('search still treats one page\'s failure as no matches from that page, not a thrown error', async () => {
    const index = {a: 1, b: 2};
    global.fetch
      .mockResolvedValueOnce({ok: true, json: () => Promise.resolve(index)})
      .mockRejectedValueOnce(new Error('Network request failed'))
      .mockResolvedValueOnce({ok: true, json: () => Promise.resolve([
        {id: 'b', slug: 'b', title: {rendered: 'Ingram wins'}, content: {rendered: ''}},
      ])});
    cacheRead.mockResolvedValue(null);

    const result = await fetchArticles(1, 20, 'Ingram');

    expect(result.map(p => p.id)).toEqual(['b']);
  });
});

describe('peekArticlesCache', () => {
  // ARTICLES_MAX_AGE_MS in client.js - kept in sync with the scraper's own
  // 5-minute refresh cadence. A cache older than this is likely to already
  // have a different top-of-feed order than the live mirror, so it's no
  // longer safe to show instantly (see NewsScreen's "flash of different
  // articles" fix, 2026-08-10).
  const ARTICLES_MAX_AGE_MS = 5 * 60 * 1000;

  it('reads that page\'s own cache key bounded to one scrape cycle', async () => {
    const stale = [{id: 7, title: 'Old article'}];
    cacheRead.mockResolvedValueOnce(stale);

    const result = await peekArticlesCache(1);

    expect(result).toEqual(stale);
    // Must pass a maxAgeMs bound so an entry older than one scrape cycle is
    // treated as a miss rather than returned regardless of age.
    expect(cacheRead).toHaveBeenCalledWith('news_p1', ARTICLES_MAX_AGE_MS);
  });

  it('returns null when nothing is cached', async () => {
    cacheRead.mockResolvedValueOnce(null);
    const result = await peekArticlesCache(1);
    expect(result).toBeNull();
  });

  it('returns null when the cache entry has aged past the bound (cacheRead enforces this)', async () => {
    // cacheRead itself returns null once maxAgeMs is exceeded (see cache.test.js) -
    // peekArticlesCache just needs to pass the bound through and handle the null.
    cacheRead.mockResolvedValueOnce(null);
    const result = await peekArticlesCache(1);
    expect(cacheRead).toHaveBeenCalledWith('news_p1', ARTICLES_MAX_AGE_MS);
    expect(result).toBeNull();
  });

  it('reads a different page\'s own key for a later page', async () => {
    const page2 = [{id: 20}];
    cacheRead.mockResolvedValueOnce(page2);
    const result = await peekArticlesCache(2);
    expect(cacheRead).toHaveBeenCalledWith('news_p2', ARTICLES_MAX_AGE_MS);
    expect(result).toEqual(page2);
  });

  it('makes no network request', async () => {
    cacheRead.mockResolvedValueOnce([]);
    await peekArticlesCache(1);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe('fetchHubPosts', () => {
  const published = {id: '1', title: 'Live', status: 'published', pubDate: '2026-04-01T10:00:00', source: 'btcc hub'};
  const draft = {id: '2', title: 'Draft', status: 'draft', previewDeviceIds: ['test-uid-123'], pubDate: '2026-04-02T10:00:00', source: 'btcc hub'};
  const draftOther = {id: '3', title: 'Other Draft', status: 'draft', previewDeviceIds: ['other-device'], pubDate: '2026-04-03T10:00:00', source: 'btcc hub'};
  const scheduled = {id: '4', title: 'Scheduled', status: 'scheduled', scheduledAt: new Date(Date.now() - 1000).toISOString(), pubDate: '2026-04-04T10:00:00', source: 'btcc hub'};
  const scheduledFuture = {id: '5', title: 'Future', status: 'scheduled', scheduledAt: new Date(Date.now() + 60000).toISOString(), pubDate: '2026-04-05T10:00:00', source: 'btcc hub'};

  it('returns published posts', async () => {
    global.fetch.mockResolvedValueOnce({ok: true, json: () => Promise.resolve({posts: [published]})});
    const result = await fetchHubPosts();
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Live');
  });

  it('filters out drafts not in previewDeviceIds', async () => {
    global.fetch.mockResolvedValueOnce({ok: true, json: () => Promise.resolve({posts: [published, draftOther]})});
    const result = await fetchHubPosts();
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Live');
  });

  it('shows draft to user whose UID is in previewDeviceIds', async () => {
    global.fetch.mockResolvedValueOnce({ok: true, json: () => Promise.resolve({posts: [draft]})});
    const result = await fetchHubPosts();
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Draft');
  });

  it('shows scheduled post whose time has passed', async () => {
    global.fetch.mockResolvedValueOnce({ok: true, json: () => Promise.resolve({posts: [scheduled]})});
    const result = await fetchHubPosts();
    expect(result).toHaveLength(1);
  });

  it('hides scheduled post whose time has not passed', async () => {
    global.fetch.mockResolvedValueOnce({ok: true, json: () => Promise.resolve({posts: [scheduledFuture]})});
    const result = await fetchHubPosts();
    expect(result).toHaveLength(0);
  });

  it('treats missing status as published', async () => {
    const noStatus = {id: '6', title: 'Old', pubDate: '2026-01-01T00:00:00', source: 'btcc hub'};
    global.fetch.mockResolvedValueOnce({ok: true, json: () => Promise.resolve({posts: [noStatus]})});
    const result = await fetchHubPosts();
    expect(result).toHaveLength(1);
  });

  it('returns empty array on fetch error', async () => {
    global.fetch.mockRejectedValueOnce(new Error('network error'));
    const result = await fetchHubPosts();
    expect(result).toEqual([]);
  });

  it('adds cache-busting timestamp to URL', async () => {
    global.fetch.mockResolvedValueOnce({ok: true, json: () => Promise.resolve({posts: []})});
    await fetchHubPosts();
    const url = global.fetch.mock.calls[0][0];
    expect(url).toMatch(/[?&]t=\d+/);
  });

  it('maps posts to expected shape', async () => {
    global.fetch.mockResolvedValueOnce({ok: true, json: () => Promise.resolve({posts: [published]})});
    const result = await fetchHubPosts();
    const p = result[0];
    expect(p).toHaveProperty('id');
    expect(p).toHaveProperty('title');
    expect(p).toHaveProperty('sortDate');
    expect(p).toHaveProperty('orderDate');
    expect(p).toHaveProperty('pubDate');
    expect(p).toHaveProperty('source');
  });

  // Unlike mirror articles (parsers.js's parseArticle, which has to fall back
  // to a scraper-detection timestamp for ordering since btcc.net's own date
  // has no time-of-day), a hub post's pubDate already carries real precision -
  // so orderDate is just an alias of sortDate here, not a distinct value.
  it('sets orderDate equal to sortDate, since pubDate is already precise', async () => {
    global.fetch.mockResolvedValueOnce({ok: true, json: () => Promise.resolve({posts: [published]})});
    const result = await fetchHubPosts();
    expect(result[0].orderDate).toBe(result[0].sortDate);
  });

  it('uses current time as sortDate when pubDate is empty', async () => {
    const noPubDate = {id: '7', title: 'No Date', status: 'published', pubDate: '', source: 'btcc hub'};
    global.fetch.mockResolvedValueOnce({ok: true, json: () => Promise.resolve({posts: [noPubDate]})});
    const before = Date.now();
    const result = await fetchHubPosts();
    const after = Date.now();
    const sortDate = new Date(result[0].sortDate).getTime();
    expect(sortDate).toBeGreaterThanOrEqual(before);
    expect(sortDate).toBeLessThanOrEqual(after);
  });

  it('returns posts newest-first regardless of source order', async () => {
    const older = {id: 'a', title: 'Older', status: 'published', pubDate: '2026-01-01T00:00:00', source: 'btcc hub'};
    const newer = {id: 'b', title: 'Newer', status: 'published', pubDate: '2026-06-01T00:00:00', source: 'btcc hub'};
    global.fetch.mockResolvedValueOnce({ok: true, json: () => Promise.resolve({posts: [older, newer]})});
    const result = await fetchHubPosts();
    expect(result.map(p => p.id)).toEqual(['b', 'a']);
  });

  it('caps at 500 posts, keeping the newest - hub_news.json has no size limit of its own', async () => {
    const posts = Array.from({length: 501}, (_, i) => ({
      id: String(i),
      title: `Post ${i}`,
      status: 'published',
      // i=0 is oldest, i=500 is newest
      pubDate: new Date(2020, 0, i + 1).toISOString(),
      source: 'btcc hub',
    }));
    global.fetch.mockResolvedValueOnce({ok: true, json: () => Promise.resolve({posts})});
    const result = await fetchHubPosts();
    expect(result).toHaveLength(500);
    expect(result[0].id).toBe('500'); // newest kept
    expect(result.map(p => p.id)).not.toContain('0'); // oldest dropped
  });
});

describe('fetchExplainerArticles', () => {
  const staged = {id: 'explainer-brakes', title: 'Brakes', status: 'staged', scheduledDate: '2026-11-17', source: 'btcc hub', order: 12};
  const published = {id: 'explainer-ttb-toca-turbo-boost', title: 'TTB explained', status: 'published', pubDate: '2026-10-23T09:00:00', source: 'btcc hub', order: 5};

  it('returns only published articles, not staged ones', async () => {
    global.fetch.mockResolvedValueOnce({ok: true, json: () => Promise.resolve({posts: [staged, published]})});
    const result = await fetchExplainerArticles();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('explainer-ttb-toca-turbo-boost');
  });

  it('returns an empty array when nothing has been published yet - the section-gating case', async () => {
    global.fetch.mockResolvedValueOnce({ok: true, json: () => Promise.resolve({posts: [staged]})});
    const result = await fetchExplainerArticles();
    expect(result).toEqual([]);
  });

  it('maps posts to the shape ArticleScreen/ExplainerListScreen expect', async () => {
    global.fetch.mockResolvedValueOnce({ok: true, json: () => Promise.resolve({posts: [published]})});
    const result = await fetchExplainerArticles();
    const p = result[0];
    expect(p).toHaveProperty('id');
    expect(p).toHaveProperty('title');
    expect(p).toHaveProperty('content');
    expect(p).toHaveProperty('sortDate');
    expect(p).toHaveProperty('orderDate');
    expect(p).toHaveProperty('category');
    expect(p.order).toBe(5);
  });

  it('sets order to null when the source data has no numeric order', async () => {
    const noOrder = {...published, order: undefined};
    global.fetch.mockResolvedValueOnce({ok: true, json: () => Promise.resolve({posts: [noOrder]})});
    const result = await fetchExplainerArticles();
    expect(result[0].order).toBeNull();
  });

  it('passes through image credit fields when a post has them', async () => {
    const credited = {
      ...published,
      imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/c/cb/1958_Jack_Sears.JPG',
      imageCredit: 'Aylesburyape',
      imageCreditUrl: 'https://commons.wikimedia.org/wiki/File:1958_Jack_Sears.JPG',
      imageLicense: 'CC BY 3.0',
    };
    global.fetch.mockResolvedValueOnce({ok: true, json: () => Promise.resolve({posts: [credited]})});
    const result = await fetchExplainerArticles();
    expect(result[0].imageCredit).toBe('Aylesburyape');
    expect(result[0].imageCreditUrl).toBe('https://commons.wikimedia.org/wiki/File:1958_Jack_Sears.JPG');
    expect(result[0].imageLicense).toBe('CC BY 3.0');
  });

  it('sets image credit fields to null when a post has no image credit', async () => {
    global.fetch.mockResolvedValueOnce({ok: true, json: () => Promise.resolve({posts: [published]})});
    const result = await fetchExplainerArticles();
    expect(result[0].imageCredit).toBeNull();
    expect(result[0].imageCreditUrl).toBeNull();
    expect(result[0].imageLicense).toBeNull();
  });

  it('returns empty array on fetch error', async () => {
    global.fetch.mockRejectedValueOnce(new Error('network error'));
    const result = await fetchExplainerArticles();
    expect(result).toEqual([]);
  });

  it('adds cache-busting timestamp to URL', async () => {
    global.fetch.mockResolvedValueOnce({ok: true, json: () => Promise.resolve({posts: []})});
    await fetchExplainerArticles();
    const url = global.fetch.mock.calls[0][0];
    expect(url).toMatch(/[?&]t=\d+/);
  });

  // Regression coverage: found live 2026-09-03 - unlike every other cached
  // fetch in this file, this one never had a forceRefresh option at all,
  // so an admin previewing a second article had no way to see it within
  // the 5-minute on-device cache window - not even pull-to-refresh on
  // ExplainerListScreen could break through it, since load() called the
  // same un-forced fetch either way.
  it('forceRefresh bypasses the on-device cache and always hits the network', async () => {
    const fresh = {posts: [{id: 'explainer-fresh', title: 'Fresh', status: 'published', pubDate: '2026-10-01'}]};
    global.fetch.mockResolvedValueOnce({ok: true, json: () => Promise.resolve(fresh)});

    const result = await fetchExplainerArticles(/* forceRefresh */ true);

    expect(result[0].id).toBe('explainer-fresh');
    // cacheRead must not have been called for the primary read - forceRefresh skips it entirely
    expect(cacheRead).not.toHaveBeenCalled();
  });

  // Mirrors mapHubPosts' own draft-preview gate exactly - added 2026-09-03
  // so an admin can publish an Academy article visible only on their own
  // device before a real Save & Publish. jest.setup.js's Firebase Auth mock
  // resolves to uid 'test-uid-123', the same one fetchHubPosts' own draft
  // tests already use.
  it('returns a draft article whose previewDeviceIds includes the current uid', async () => {
    const draft = {id: 'explainer-brakes', title: 'Brakes (preview)', status: 'draft', previewDeviceIds: ['test-uid-123'], source: 'btcc hub'};
    global.fetch.mockResolvedValueOnce({ok: true, json: () => Promise.resolve({posts: [draft]})});
    const result = await fetchExplainerArticles();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('explainer-brakes');
  });

  it('does not return a draft article previewed to a different device', async () => {
    const draftOther = {id: 'explainer-brakes', title: 'Brakes (preview)', status: 'draft', previewDeviceIds: ['someone-elses-uid'], source: 'btcc hub'};
    global.fetch.mockResolvedValueOnce({ok: true, json: () => Promise.resolve({posts: [draftOther]})});
    const result = await fetchExplainerArticles();
    expect(result).toEqual([]);
  });

  it('does not return a draft article with no previewDeviceIds at all', async () => {
    const draftNoIds = {id: 'explainer-brakes', title: 'Brakes (preview)', status: 'draft', source: 'btcc hub'};
    global.fetch.mockResolvedValueOnce({ok: true, json: () => Promise.resolve({posts: [draftNoIds]})});
    const result = await fetchExplainerArticles();
    expect(result).toEqual([]);
  });
});

describe('fetchExplainerArticleById', () => {
  const published = {id: 'explainer-ttb-toca-turbo-boost', title: 'TTB explained', status: 'published', pubDate: '2026-10-23T09:00:00', source: 'btcc hub'};

  it('finds the matching published article by id', async () => {
    global.fetch.mockResolvedValueOnce({ok: true, json: () => Promise.resolve({posts: [published]})});
    const result = await fetchExplainerArticleById('explainer-ttb-toca-turbo-boost');
    expect(result?.title).toBe('TTB explained');
  });

  it('returns null when no article matches the id (e.g. still staged, not yet published)', async () => {
    // retries: 0 opts out of the retry loop below - this test is about the
    // plain "genuinely doesn't exist" case, not the "not there yet" case.
    global.fetch.mockResolvedValue({ok: true, json: () => Promise.resolve({posts: [published]})});
    const result = await fetchExplainerArticleById('explainer-does-not-exist', true, {retries: 0});
    expect(result).toBeNull();
  });

  // Regression coverage: found live 2026-09-03 - a fourth call site of the
  // same root cause fetchExplainerArticles' own forceRefresh fix already
  // covered. notifNavigation.js calls this to resolve a tapped notification
  // into a full article - if it silently used a stale on-device cache
  // (predating whatever article the notification is actually about), the
  // lookup would come back null and notifNavigation.js's own fallback for
  // that case drops the user on the plain Academy list with no article and
  // no explanation. A notification is always about content that just
  // changed, so this must never serve a stale cache by default.
  it('forces a fresh fetch by default, bypassing the on-device cache', async () => {
    global.fetch.mockResolvedValueOnce({ok: true, json: () => Promise.resolve({posts: [published]})});
    await fetchExplainerArticleById('explainer-ttb-toca-turbo-boost', true, {retries: 0});
    expect(cacheRead).not.toHaveBeenCalled();
  });

  // Regression coverage: found live 2026-09-04 - a report of "waited out
  // admin's own ~2 min wait-for-live check, tapped the notification, article
  // still not there" recurred even after admin.html started delaying the
  // notification until its own check confirmed the content live. Root cause:
  // raw.githubusercontent.com is served off Fastly's edge network, not one
  // origin - admin's check succeeding from admin's own network path doesn't
  // guarantee every edge has replicated yet, so a phone hitting a different,
  // still-stale edge moments later is a real, distinct possibility no single
  // check from one location can rule out. A short bounded retry here (not a
  // bigger timeout on admin's side) is what actually closes that gap.
  it('retries a bounded number of times before giving up when the article is not found yet', async () => {
    global.fetch
      .mockResolvedValueOnce({ok: true, json: () => Promise.resolve({posts: []})})
      .mockResolvedValueOnce({ok: true, json: () => Promise.resolve({posts: []})})
      .mockResolvedValueOnce({ok: true, json: () => Promise.resolve({posts: [published]})});
    const result = await fetchExplainerArticleById('explainer-ttb-toca-turbo-boost', true, {retries: 2, retryDelayMs: 0});
    expect(result?.title).toBe('TTB explained');
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it('gives up and returns null once retries are exhausted, never retrying forever', async () => {
    global.fetch.mockResolvedValue({ok: true, json: () => Promise.resolve({posts: []})});
    const result = await fetchExplainerArticleById('explainer-ttb-toca-turbo-boost', true, {retries: 2, retryDelayMs: 0});
    expect(result).toBeNull();
    expect(global.fetch).toHaveBeenCalledTimes(3); // 1 initial attempt + 2 retries
  });
});

describe('fetchArticleBySlug', () => {
  it('fetches the index, then only the one page file the slug is actually on', async () => {
    const article = {id: 1, slug: 'test-article'};
    global.fetch
      .mockResolvedValueOnce({ok: true, json: () => Promise.resolve({'test-article': 3, other: 1})})
      .mockResolvedValueOnce({ok: true, json: () => Promise.resolve([{id: 0, slug: 'unrelated'}, article])});

    const result = await fetchArticleBySlug('test-article');

    expect(global.fetch.mock.calls[0][0]).toContain('articles/index.json');
    expect(global.fetch.mock.calls[1][0]).toContain('articles/page_3.json');
    expect(result).toEqual(article);
  });

  it('returns null when the slug is not in the index at all', async () => {
    global.fetch.mockResolvedValueOnce({ok: true, json: () => Promise.resolve({'something-else': 1})});

    const result = await fetchArticleBySlug('does-not-exist');
    expect(result).toBeNull();
    // Never needed to fetch any page file - the index alone settled it
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('returns null when fetch fails and no cache exists', async () => {
    global.fetch.mockResolvedValueOnce({ok: false});
    cacheRead.mockResolvedValueOnce(null);

    const result = await fetchArticleBySlug('any-slug');
    expect(result).toBeNull();
  });

  it('uses the index\'s own cache, bounded to its 5-minute refresh cadence', async () => {
    const article = {id: 2, slug: 'cached-article'};
    cacheRead.mockResolvedValueOnce({'cached-article': 1});
    // A cache hit on the index still fires an unawaited background refresh
    // fetch for the index itself, before the (awaited) page-file fetch below.
    global.fetch
      .mockResolvedValueOnce({ok: true, json: () => Promise.resolve({'cached-article': 1})})
      .mockResolvedValueOnce({ok: true, json: () => Promise.resolve([article])});
    const result = await fetchArticleBySlug('cached-article');
    expect(cacheRead).toHaveBeenCalledWith('articles_index', 5 * 60 * 1000);
    expect(result).toEqual(article);
  });

  // Regression: ArticleScreen's Retry button needs a real network hit, not a
  // replay of the same cached miss that got the user to the retry screen -
  // see newsCheck.js's mirroredImageUrl for why a plain-cached index can be
  // stale relative to a just-published article.
  it('forceRefresh=true skips the index cache entirely', async () => {
    const article = {id: 3, slug: 'just-published'};
    // forceRefresh must skip the cacheRead call outright (not just ignore a
    // hit) - queuing a would-be cache-hit value here would go unconsumed and
    // leak into whichever test runs next, since cacheRead's default mock has
    // no per-test reset.
    global.fetch
      .mockResolvedValueOnce({ok: true, json: () => Promise.resolve({'just-published': 1})})
      .mockResolvedValueOnce({ok: true, json: () => Promise.resolve([article])});

    const result = await fetchArticleBySlug('just-published', true);

    expect(cacheRead).not.toHaveBeenCalled();
    expect(result).toEqual(article);
  });

  // Regression: skipping the app's own cache isn't enough - a plain fetch(url)
  // repeated within raw.githubusercontent.com's Cache-Control: max-age=300
  // window can still be served from a CDN edge cache for that exact URL, so
  // forceRefresh must also cache-bust the request itself (2026-08-22, Ingram
  // Donington Park FP notification: gate + retry both passed, article still
  // 404'd on first tap).
  it('forceRefresh cache-busts both the index and page requests, not just the app cache', async () => {
    global.fetch
      .mockResolvedValueOnce({ok: true, json: () => Promise.resolve({'just-published': 1})})
      .mockResolvedValueOnce({ok: true, json: () => Promise.resolve([{id: 3, slug: 'just-published'}])});

    await fetchArticleBySlug('just-published', true);

    expect(global.fetch.mock.calls[0][0]).toMatch(/articles\/index\.json\?_cb=\d+/);
    expect(global.fetch.mock.calls[1][0]).toMatch(/articles\/page_1\.json\?_cb=\d+/);
  });

  it('does not cache-bust a plain (non-forced) request', async () => {
    global.fetch
      .mockResolvedValueOnce({ok: true, json: () => Promise.resolve({'some-slug': 1})})
      .mockResolvedValueOnce({ok: true, json: () => Promise.resolve([{id: 1, slug: 'some-slug'}])});

    await fetchArticleBySlug('some-slug');

    expect(global.fetch.mock.calls[0][0]).not.toContain('_cb=');
    expect(global.fetch.mock.calls[1][0]).not.toContain('_cb=');
  });
});

describe('fetchLiveStatus', () => {
  it('fetches from live_status.json URL', async () => {
    global.fetch.mockResolvedValueOnce({ok: true, json: () => Promise.resolve({active: false})});
    await fetchLiveStatus();
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('live_status.json'));
  });

  it('returns live status with active=true when stream is live', async () => {
    const status = {active: true, liveUrl: 'https://www.youtube.com/watch?v=abc123', title: 'BTCC Live'};
    global.fetch.mockResolvedValueOnce({ok: true, json: () => Promise.resolve(status)});
    const result = await fetchLiveStatus();
    expect(result.active).toBe(true);
    expect(result.liveUrl).toBe('https://www.youtube.com/watch?v=abc123');
  });

  it('returns live status with active=false when stream is not live', async () => {
    const status = {active: false, liveUrl: null};
    global.fetch.mockResolvedValueOnce({ok: true, json: () => Promise.resolve(status)});
    const result = await fetchLiveStatus();
    expect(result.active).toBe(false);
  });

  it('caches the fetched result under live_status key', async () => {
    const status = {active: true, liveUrl: 'https://www.youtube.com/watch?v=xyz'};
    global.fetch.mockResolvedValueOnce({ok: true, json: () => Promise.resolve(status)});
    await fetchLiveStatus();
    expect(cacheWrite).toHaveBeenCalledWith('live_status', status);
  });

  it('serves cached value within the 2-minute bound, but bounded (not staleFirst)', async () => {
    const cached = {active: false, liveUrl: null};
    cacheRead.mockResolvedValueOnce(cached);
    // Background revalidation fetch
    global.fetch.mockResolvedValueOnce({ok: true, json: () => Promise.resolve(cached)});
    const result = await fetchLiveStatus();
    // Bounded staleness: a 2-minute maxAge is passed and enforced (staleFirst=false),
    // so a cache older than that would be treated as a miss and force a real fetch —
    // unlike staleFirst, which would silently ignore this bound and serve any age.
    expect(cacheRead).toHaveBeenCalledWith('live_status', 2 * 60 * 1000);
    expect(result).toEqual(cached);
  });

  it('returns null when fetch fails and no cache exists', async () => {
    global.fetch.mockRejectedValueOnce(new Error('network error'));
    cacheRead.mockResolvedValueOnce(null);
    const result = await fetchLiveStatus();
    expect(result).toBeNull();
  });
});

describe('fetchBlacklist', () => {
  it('fetches from blacklist.json URL', async () => {
    global.fetch.mockResolvedValueOnce({ok: true, json: () => Promise.resolve(['word'])});
    await fetchBlacklist();
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('blacklist.json'));
  });

  it('uses a bounded 24h cache, not staleFirst', async () => {
    cacheRead.mockResolvedValueOnce(['cached-word']);
    global.fetch.mockResolvedValueOnce({ok: true, json: () => Promise.resolve(['cached-word'])});
    const result = await fetchBlacklist();
    expect(cacheRead).toHaveBeenCalledWith('blacklist', 24 * 60 * 60 * 1000);
    expect(result).toEqual(['cached-word']);
  });

  it('falls back to bundled blacklist when fetch fails and no cache exists', async () => {
    global.fetch.mockRejectedValueOnce(new Error('network error'));
    cacheRead.mockResolvedValueOnce(null);
    const result = await fetchBlacklist();
    expect(result).toBeDefined();
  });
});

describe('fetchMerchStores', () => {
  it('fetches from merch.json URL', async () => {
    global.fetch.mockResolvedValueOnce({ok: true, json: () => Promise.resolve({stores: {}})});
    await fetchMerchStores();
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('merch.json'));
  });

  it('uses a bounded 48h cache, not staleFirst', async () => {
    const stores = {uk: [{name: 'Shop'}]};
    cacheRead.mockResolvedValueOnce({stores});
    global.fetch.mockResolvedValueOnce({ok: true, json: () => Promise.resolve({stores})});
    const result = await fetchMerchStores();
    expect(cacheRead).toHaveBeenCalledWith('merch_stores', 48 * 60 * 60 * 1000);
    expect(result).toEqual(stores);
  });

  it('falls back to bundled merch stores when fetch fails and no cache exists', async () => {
    global.fetch.mockRejectedValueOnce(new Error('network error'));
    cacheRead.mockResolvedValueOnce(null);
    const result = await fetchMerchStores();
    expect(result).toBeDefined();
  });
});

describe('fetchPartners', () => {
  it('fetches from partners.json URL', async () => {
    global.fetch.mockResolvedValueOnce({ok: true, json: () => Promise.resolve([{id: 'x'}])});
    await fetchPartners();
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('partners.json'));
  });

  it('returns the live array when the fetch succeeds', async () => {
    const live = [{id: 'new-sponsor', name: 'New Sponsor'}];
    global.fetch.mockResolvedValueOnce({ok: true, json: () => Promise.resolve(live)});
    const result = await fetchPartners();
    expect(result).toEqual(live);
  });

  it('falls back to the bundled snapshot when the response is not an array', async () => {
    global.fetch.mockResolvedValueOnce({ok: true, json: () => Promise.resolve({})});
    const result = await fetchPartners();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it('falls back to the bundled snapshot when fetch fails and no cache exists', async () => {
    global.fetch.mockRejectedValueOnce(new Error('network error'));
    cacheRead.mockResolvedValueOnce(null);
    const result = await fetchPartners();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it('uses a bounded 48h cache, not staleFirst', async () => {
    const cached = [{id: 'cached-sponsor'}];
    cacheRead.mockResolvedValueOnce(cached);
    global.fetch.mockResolvedValueOnce({ok: true, json: () => Promise.resolve(cached)});
    await fetchPartners();
    expect(cacheRead).toHaveBeenCalledWith('partners', 48 * 60 * 60 * 1000);
  });
});
