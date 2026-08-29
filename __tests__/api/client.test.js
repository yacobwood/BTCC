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
  // see newsCheck.js's isSlugMirrored for why a plain-cached index can be
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
