/**
 * CF Worker scheduled handler tests.
 *
 * Tests run against the real handler with global.fetch mocked.
 * Response order mirrors what the handler calls in sequence:
 *   1. dispatch scrape (POST workflows dispatch)
 *   2. YouTube search API
 *   3. GET current live_status.json from GitHub
 *   4. PUT live_status.json to GitHub (only when state changes)
 */

import handler from '../../tools/cf-worker/src/index.js';

const ENV = {GITHUB_TOKEN: 'gh-test-token', YOUTUBE_API_KEY: 'yt-test-key'};
const CTX = {};

// YouTube API response helpers
const ytLive = (videoId = 'abc123', title = 'BTCC Live') => ({
  items: [{id: {videoId}, snippet: {title}}],
});
const ytOffline = () => ({items: []});

// GitHub contents response helpers (file not yet created)
const ghNotFound = () => ({status: 404, ok: false, json: () => Promise.resolve({})});
const ghFile = (content, sha = 'abc') => ({
  status: 200,
  ok: true,
  json: () => Promise.resolve({sha, content: btoa(JSON.stringify(content))}),
});
const ghPutOk = () => ({status: 200, ok: true, json: () => Promise.resolve({})});
const dispatchOk = () => ({status: 204, ok: true});

describe('CF Worker scheduled handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Pin clock to a known BTCC race weekend (Brands Hatch Indy Saturday)
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-05-09T12:00:00Z'));
  });

  afterEach(() => jest.useRealTimers());

  it('does nothing on a non-race weekend', async () => {
    jest.setSystemTime(new Date('2026-05-02T12:00:00Z')); // random Saturday, no race
    await handler.scheduled({}, ENV, CTX);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('always dispatches the scrape workflow', async () => {
    global.fetch
      .mockResolvedValueOnce(dispatchOk())          // dispatch scrape
      .mockResolvedValueOnce({ok: true, json: () => Promise.resolve(ytOffline())}) // YouTube
      .mockResolvedValueOnce(ghNotFound())           // GET live_status.json
      .mockResolvedValueOnce(ghPutOk());             // PUT live_status.json

    await handler.scheduled({}, ENV, CTX);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('scrape-results.yml/dispatches'),
      expect.objectContaining({method: 'POST'}),
    );
  });

  it('commits active=true with liveUrl when YouTube reports a live stream', async () => {
    global.fetch
      .mockResolvedValueOnce(dispatchOk())
      .mockResolvedValueOnce({ok: true, json: () => Promise.resolve(ytLive('live999', 'BTCC Brands Hatch'))})
      .mockResolvedValueOnce(ghNotFound())
      .mockResolvedValueOnce(ghPutOk());

    await handler.scheduled({}, ENV, CTX);

    const putCall = global.fetch.mock.calls.find(([url, opts]) =>
      url.includes('live_status.json') && opts?.method === 'PUT'
    );
    expect(putCall).toBeDefined();
    const body = JSON.parse(putCall[1].body);
    const committed = JSON.parse(atob(body.content));
    expect(committed.active).toBe(true);
    expect(committed.liveUrl).toBe('https://www.youtube.com/watch?v=live999');
    expect(committed.title).toBe('BTCC Brands Hatch');
  });

  it('commits active=false when no live stream is found', async () => {
    global.fetch
      .mockResolvedValueOnce(dispatchOk())
      .mockResolvedValueOnce({ok: true, json: () => Promise.resolve(ytOffline())})
      .mockResolvedValueOnce(ghNotFound())
      .mockResolvedValueOnce(ghPutOk());

    await handler.scheduled({}, ENV, CTX);

    const putCall = global.fetch.mock.calls.find(([url, opts]) =>
      url.includes('live_status.json') && opts?.method === 'PUT'
    );
    expect(putCall).toBeDefined();
    const body = JSON.parse(putCall[1].body);
    const committed = JSON.parse(atob(body.content));
    expect(committed.active).toBe(false);
    expect(committed.liveUrl).toBeNull();
  });

  it('skips the PUT commit when state has not changed', async () => {
    // Current file already says active=false — YouTube also returns offline
    global.fetch
      .mockResolvedValueOnce(dispatchOk())
      .mockResolvedValueOnce({ok: true, json: () => Promise.resolve(ytOffline())})
      .mockResolvedValueOnce(ghFile({active: false, liveUrl: null}, 'sha1'));
    // No 4th mock needed — PUT should not be called

    await handler.scheduled({}, ENV, CTX);

    const putCall = global.fetch.mock.calls.find(([url, opts]) =>
      url.includes('live_status.json') && opts?.method === 'PUT'
    );
    expect(putCall).toBeUndefined();
  });

  it('includes the existing sha when updating an existing file', async () => {
    // Current file says active=false, YouTube now reports live — state changes
    global.fetch
      .mockResolvedValueOnce(dispatchOk())
      .mockResolvedValueOnce({ok: true, json: () => Promise.resolve(ytLive())})
      .mockResolvedValueOnce(ghFile({active: false, liveUrl: null}, 'existing-sha'))
      .mockResolvedValueOnce(ghPutOk());

    await handler.scheduled({}, ENV, CTX);

    const putCall = global.fetch.mock.calls.find(([url, opts]) =>
      url.includes('live_status.json') && opts?.method === 'PUT'
    );
    const body = JSON.parse(putCall[1].body);
    expect(body.sha).toBe('existing-sha');
  });

  it('uses the correct Authorization header for GitHub calls', async () => {
    global.fetch
      .mockResolvedValueOnce(dispatchOk())
      .mockResolvedValueOnce({ok: true, json: () => Promise.resolve(ytOffline())})
      .mockResolvedValueOnce(ghNotFound())
      .mockResolvedValueOnce(ghPutOk());

    await handler.scheduled({}, ENV, CTX);

    const ghCalls = global.fetch.mock.calls.filter(([url]) => url.includes('github.com'));
    ghCalls.forEach(([, opts]) => {
      expect(opts.headers['Authorization']).toBe('Bearer gh-test-token');
    });
  });

  it('uses the correct YouTube API key in the search URL', async () => {
    global.fetch
      .mockResolvedValueOnce(dispatchOk())
      .mockResolvedValueOnce({ok: true, json: () => Promise.resolve(ytOffline())})
      .mockResolvedValueOnce(ghNotFound())
      .mockResolvedValueOnce(ghPutOk());

    await handler.scheduled({}, ENV, CTX);

    const ytCall = global.fetch.mock.calls.find(([url]) => url.includes('googleapis.com'));
    expect(ytCall[0]).toContain('key=yt-test-key');
    expect(ytCall[0]).toContain('eventType=live');
  });

  it('treats a live stream without "BTCC" in the title as inactive', async () => {
    global.fetch
      .mockResolvedValueOnce(dispatchOk())
      .mockResolvedValueOnce({ok: true, json: () => Promise.resolve(ytLive('xyz789', 'ITV Sport Special Coverage'))})
      .mockResolvedValueOnce(ghNotFound())
      .mockResolvedValueOnce(ghPutOk());

    await handler.scheduled({}, ENV, CTX);

    const putCall = global.fetch.mock.calls.find(([url, opts]) =>
      url.includes('live_status.json') && opts?.method === 'PUT'
    );
    expect(putCall).toBeDefined();
    const body = JSON.parse(putCall[1].body);
    const committed = JSON.parse(atob(body.content));
    expect(committed.active).toBe(false);
    expect(committed.liveUrl).toBeNull();
  });

  it('still commits offline status even when YouTube API call fails', async () => {
    global.fetch
      .mockResolvedValueOnce(dispatchOk())
      .mockResolvedValueOnce({ok: false, status: 403})  // YouTube error
      .mockResolvedValueOnce(ghNotFound())
      .mockResolvedValueOnce(ghPutOk());

    await handler.scheduled({}, ENV, CTX);

    const putCall = global.fetch.mock.calls.find(([url, opts]) =>
      url.includes('live_status.json') && opts?.method === 'PUT'
    );
    // YouTube error → treated as not live → commits active=false
    expect(putCall).toBeDefined();
    const body = JSON.parse(putCall[1].body);
    const committed = JSON.parse(atob(body.content));
    expect(committed.active).toBe(false);
  });
});
