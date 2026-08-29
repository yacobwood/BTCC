// Smoke-level coverage only, per explicit decision when scoping the
// full-coverage effort - this function has a wide external surface (GitHub,
// Reddit, btcc.net mirror, 3 RSS feeds, Claude) and it isn't worth chasing
// every branch. Each test below checks: the auth/schedule gate behaves, the
// happy path reaches and calls the main external dependency with roughly
// the right shape, and one failure path is handled without throwing.
const {makeReq, makeRes} = require('./testHelpers');

const mockLogError = jest.fn(() => Promise.resolve());
const mockFetchWithTimeout = jest.fn();
jest.mock('../../functions/shared', () => ({
  logError: mockLogError,
  fetchWithTimeout: (...args) => mockFetchWithTimeout(...args),
  CALENDAR_URL: 'https://example.com/calendar.json',
  ARTICLES_URL: 'https://example.com/articles.json',
  getUKDateString: jest.fn((date, offset) => (offset === 2 ? '2026-08-22' : '2026-08-18')),
  requireAdminPost: (req, res) => {
    if (req.method !== 'POST') { res.status(405).send('Method Not Allowed'); return true; }
    if (req.headers['x-admin-secret'] !== 'test-admin-secret') { res.status(401).send('Unauthorized'); return true; }
    return false;
  },
}));

const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => ({
  default: jest.fn().mockImplementation(() => ({messages: {create: mockCreate}})),
}), {virtual: true});

const mockSendMail = jest.fn(() => Promise.resolve());
jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({sendMail: mockSendMail})),
}), {virtual: true});

const {weeklyDigest, raceWeekendDigest, triggerDigest} = require('../../functions/digest');

function githubFileResponse(posts = []) {
  const content = Buffer.from(JSON.stringify({posts})).toString('base64');
  return {ok: true, json: () => Promise.resolve({content, sha: 'sha-abc'})};
}

function defaultFetchImpl(url, ms, options = {}) {
  if (url.includes('api.github.com')) {
    if (options.method === 'PUT') return Promise.resolve({ok: true});
    return Promise.resolve(githubFileResponse([]));
  }
  if (url.includes('reddit.com')) {
    return Promise.resolve({
      json: () => Promise.resolve({data: {children: [
        {data: {score: 10, title: 'Ingram wins at Croft', selftext: 'Great race all round.', permalink: '/r/BTCC/comments/1/'}},
      ]}}),
    });
  }
  if (url.includes('calendar.json')) {
    return Promise.resolve({json: () => Promise.resolve({rounds: [{startDate: '2026-08-22', venue: 'Croft', location: 'North Yorkshire'}]})});
  }
  // articles mirror + RSS feeds
  return Promise.resolve({json: () => Promise.resolve([]), text: () => Promise.resolve('<rss></rss>')});
}

function mockClaudeResponse(overrides = {}) {
  mockCreate.mockResolvedValueOnce({
    content: [{text: JSON.stringify({
      title: 'A dramatic weekend at Croft',
      content: '<p>It was quite a day.</p>',
      description: 'Croft delivered drama.',
      ...overrides,
    })}],
  });
}

describe('weeklyDigest', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchWithTimeout.mockImplementation(defaultFetchImpl);
  });

  it('reaches Claude and commits a draft post on the happy path', async () => {
    mockClaudeResponse();
    await weeklyDigest.run();

    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
      messages: expect.arrayContaining([expect.objectContaining({role: 'user'})]),
    }));
    expect(mockFetchWithTimeout).toHaveBeenCalledWith(
      expect.stringContaining('api.github.com'),
      expect.any(Number),
      expect.objectContaining({method: 'PUT'}),
    );
  });

  it('skips without calling Claude if no sources are found anywhere', async () => {
    mockFetchWithTimeout.mockImplementation((url, ms, options = {}) => {
      if (url.includes('api.github.com')) {
        if (options.method === 'PUT') return Promise.resolve({ok: true});
        return Promise.resolve(githubFileResponse([]));
      }
      return Promise.resolve({json: () => Promise.resolve({data: {children: []}}), text: () => Promise.resolve('')});
    });
    await weeklyDigest.run();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('logs an alerting error rather than throwing if the GitHub read fails', async () => {
    mockFetchWithTimeout.mockImplementation((url) => {
      if (url.includes('api.github.com')) return Promise.resolve({ok: false, status: 500});
      return defaultFetchImpl(url);
    });
    await expect(weeklyDigest.run()).resolves.toBeUndefined();
    expect(mockLogError).toHaveBeenCalledWith('weeklyDigest', expect.stringContaining('GitHub GET failed'), expect.anything(), {alert: true});
  });
});

describe('raceWeekendDigest', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchWithTimeout.mockImplementation(defaultFetchImpl);
  });

  it('skips entirely, without touching Claude, when no round starts this Saturday', async () => {
    mockFetchWithTimeout.mockImplementation((url, ms, options = {}) => {
      if (url.includes('calendar.json')) return Promise.resolve({json: () => Promise.resolve({rounds: []})});
      return defaultFetchImpl(url, ms, options);
    });
    await raceWeekendDigest.run();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('runs the digest when a round does start this Saturday', async () => {
    mockClaudeResponse();
    await raceWeekendDigest.run();
    expect(mockCreate).toHaveBeenCalled();
  });
});

describe('triggerDigest', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchWithTimeout.mockImplementation(defaultFetchImpl);
  });

  it('rejects a non-POST request', async () => {
    const req = makeReq({method: 'GET'});
    const res = makeRes();
    await triggerDigest(req, res);
    expect(res.status).toHaveBeenCalledWith(405);
  });

  it('rejects a request without the correct admin secret', async () => {
    const req = makeReq({headers: {'x-admin-secret': 'wrong'}, body: {type: 'weekly'}});
    const res = makeRes();
    await triggerDigest(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('forces a weekly regeneration on the weekly branch', async () => {
    mockClaudeResponse();
    const req = makeReq({headers: {'x-admin-secret': 'test-admin-secret'}, body: {type: 'weekly'}});
    const res = makeRes();
    await triggerDigest(req, res);
    expect(mockCreate).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('forces a race-weekend regeneration on the race branch', async () => {
    mockClaudeResponse();
    const req = makeReq({headers: {'x-admin-secret': 'test-admin-secret'}, body: {type: 'race'}});
    const res = makeRes();
    await triggerDigest(req, res);
    expect(mockCreate).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('returns 500 and logs an alerting error on failure', async () => {
    mockFetchWithTimeout.mockImplementation((url) => {
      if (url.includes('api.github.com')) return Promise.resolve({ok: false, status: 500});
      return defaultFetchImpl(url);
    });
    const req = makeReq({headers: {'x-admin-secret': 'test-admin-secret'}, body: {type: 'weekly'}});
    const res = makeRes();
    await triggerDigest(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(mockLogError).toHaveBeenCalledWith('triggerDigest', expect.any(String), expect.anything(), {alert: true});
  });
});
