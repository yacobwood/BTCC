jest.mock('../../src/store/cache', () => ({
  cacheWrite: jest.fn(() => Promise.resolve()),
  cacheRead:  jest.fn(() => Promise.resolve(null)),
}));

jest.mock('../../src/utils/deviceId', () => ({
  getStableDeviceId: jest.fn(() => Promise.resolve('test-device-id')),
}));

// calendar.json must be importable in test env
jest.mock('../../data/calendar.json', () => ({
  rounds: [{round: 1, venue: 'Donington Park'}],
  seasonStartDate: '2026-04-18',
}));

import {cacheWrite, cacheRead} from '../../src/store/cache';
import {getStableDeviceId} from '../../src/utils/deviceId';
import {
  fetchCalendar,
  fetchDrivers,
  fetchStandings,
  fetchResults,
  fetchArticles,
  fetchArticleBySlug,
  fetchHubPosts,
  peekArticlesCache,
  fetchLiveStatus,
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

    // staleFirst=true: no maxAge argument — any cached data regardless of age
    expect(cacheRead).toHaveBeenCalledWith('drivers', undefined);
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
});

describe('fetchArticles', () => {
  it('fetches from WordPress API with default pagination', async () => {
    global.fetch.mockResolvedValueOnce({ok: true, json: () => Promise.resolve([])});

    await fetchArticles();

    const url = global.fetch.mock.calls[0][0];
    expect(url).toContain('btcc.net/wp-json/wp/v2/posts');
    expect(url).toContain('per_page=20');
    expect(url).toContain('page=1');
    expect(url).toContain('_embed=1');
  });

  it('includes search param when provided', async () => {
    global.fetch.mockResolvedValueOnce({ok: true, json: () => Promise.resolve([])});

    await fetchArticles(1, 20, 'Ingram win');

    const url = global.fetch.mock.calls[0][0];
    expect(url).toContain('search=Ingram%20win');
  });

  it('does NOT cache search results', async () => {
    global.fetch.mockResolvedValueOnce({ok: true, json: () => Promise.resolve([])});

    await fetchArticles(1, 20, 'search query');

    expect(cacheWrite).not.toHaveBeenCalled();
  });

  it('caches non-search results with page-specific key', async () => {
    const articles = [{id: 1}, {id: 2}];
    global.fetch.mockResolvedValueOnce({ok: true, json: () => Promise.resolve(articles)});

    await fetchArticles(2);

    expect(cacheWrite).toHaveBeenCalledWith('news_p2', articles);
  });

  it('falls back to cached page on network error', async () => {
    const cached = [{id: 99}];
    // First cacheRead: cache miss (no fresh data). Then fetch fails. Then staleFallback cacheRead: returns stale.
    cacheRead.mockResolvedValueOnce(null).mockResolvedValueOnce(cached);
    global.fetch.mockResolvedValueOnce({ok: false});

    const result = await fetchArticles(1);
    expect(result).toEqual(cached);
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
  it('reads cache without any max-age restriction', async () => {
    const stale = [{id: 7, title: 'Old article'}];
    cacheRead.mockResolvedValueOnce(stale);

    const result = await peekArticlesCache(1);

    expect(result).toEqual(stale);
    // Must be called without a maxAgeMs argument so even expired entries are returned
    expect(cacheRead).toHaveBeenCalledWith('news_p1');
  });

  it('returns null when nothing is cached', async () => {
    cacheRead.mockResolvedValueOnce(null);
    const result = await peekArticlesCache(1);
    expect(result).toBeNull();
  });

  it('uses the correct cache key for the given page', async () => {
    cacheRead.mockResolvedValueOnce(null);
    await peekArticlesCache(3);
    expect(cacheRead).toHaveBeenCalledWith('news_p3');
  });

  it('makes no network request', async () => {
    cacheRead.mockResolvedValueOnce([]);
    await peekArticlesCache(1);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe('fetchHubPosts', () => {
  const published = {id: '1', title: 'Live', status: 'published', pubDate: '2026-04-01T10:00:00', source: 'btcc hub'};
  const draft = {id: '2', title: 'Draft', status: 'draft', previewDeviceIds: ['test-device-id'], pubDate: '2026-04-02T10:00:00', source: 'btcc hub'};
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

  it('shows draft to device in previewDeviceIds', async () => {
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
    expect(p).toHaveProperty('pubDate');
    expect(p).toHaveProperty('source');
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
});

describe('fetchArticleBySlug', () => {
  it('fetches a single article by slug', async () => {
    const article = {id: 1, slug: 'test-article'};
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([article]),
    });

    const result = await fetchArticleBySlug('test-article');

    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('slug=test-article'));
    expect(result).toEqual(article);
  });

  it('returns null when no article found for slug', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([]),
    });

    const result = await fetchArticleBySlug('does-not-exist');
    expect(result).toBeNull();
  });

  it('returns null when fetch fails', async () => {
    global.fetch.mockResolvedValueOnce({ok: false});

    const result = await fetchArticleBySlug('any-slug');
    expect(result).toBeNull();
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

  it('uses stale-first cache — serves cached value with no age limit', async () => {
    const cached = {active: false, liveUrl: null};
    cacheRead.mockResolvedValueOnce(cached);
    // Background revalidation fetch
    global.fetch.mockResolvedValueOnce({ok: true, json: () => Promise.resolve(cached)});
    const result = await fetchLiveStatus();
    // staleFirst passes undefined as maxAge so any cached value is returned regardless of age
    expect(cacheRead).toHaveBeenCalledWith('live_status', undefined);
    expect(result).toEqual(cached);
  });

  it('returns null when fetch fails and no cache exists', async () => {
    global.fetch.mockRejectedValueOnce(new Error('network error'));
    cacheRead.mockResolvedValueOnce(null);
    const result = await fetchLiveStatus();
    expect(result).toBeNull();
  });
});
