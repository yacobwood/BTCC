// draftHubArticle - the admin panel's "Write with Claude" endpoint. Covers
// the auth gate, the happy path down to the committed draft's shape, the
// regenerate guard and the failure paths that must NOT commit anything.
const {makeReq, makeRes} = require('./testHelpers');

const mockLogError = jest.fn(() => Promise.resolve());
const mockFetchWithTimeout = jest.fn();
const mockRequireRepoPusher = jest.fn();
jest.mock('../../functions/shared', () => ({
  logError: (...a) => mockLogError(...a),
  fetchWithTimeout: (...a) => mockFetchWithTimeout(...a),
  decodeEntities: s => s.replace(/&amp;/g, '&'),
  requireRepoPusher: (...a) => mockRequireRepoPusher(...a),
}));

const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => ({
  default: jest.fn().mockImplementation(() => ({beta: {messages: {create: mockCreate}}})),
}), {virtual: true});

const {draftHubArticle, _internal} = require('../../functions/hubArticle');
const {STYLE_RULES} = require('../../functions/articleStyle');

const EXISTING = [
  {id: 'hub-1', title: 'Old published story', status: 'published', category: 'News'},
  {id: 'hub-ai-old', title: 'Earlier AI draft', status: 'draft', aiDraft: true, imageUrl: 'https://img/x.webp', images: ['https://img/x.webp'], pubDate: '2026-10-01T09:00'},
  {id: 'hub-hand-draft', title: 'Hand-written draft', status: 'draft'},
];

let puts;
function githubFile(posts) {
  return {ok: true, json: () => Promise.resolve({sha: 'sha-1', content: Buffer.from(JSON.stringify({posts})).toString('base64')})};
}
function defaultFetch(url, ms, options = {}) {
  if (url.includes('api.github.com')) {
    if (options.method === 'PUT') { puts.push(JSON.parse(options.body)); return Promise.resolve({ok: true}); }
    return Promise.resolve(githubFile(EXISTING));
  }
  if (url.endsWith('/drivers.json')) return Promise.resolve({ok: true, json: () => Promise.resolve({season: 2026, drivers: [{number: 5, name: 'Ashley Sutton', team: 'NAPA Racing UK'}]})});
  if (url.endsWith('/standings.json')) return Promise.resolve({ok: true, json: () => Promise.resolve({round: 10, venue: 'Brands Hatch GP', standings: [{pos: 1, driver: 'Ashley SUTTON', team: 'NAPA Racing UK', points: 516, wins: 9}]})});
  if (url.endsWith('/news.json')) return Promise.resolve({ok: true, json: () => Promise.resolve([{title: {rendered: 'WSR sign off'}, date: '2026-10-15T10:00:00'}])});
  return Promise.resolve({ok: true, text: () => Promise.resolve('<html><script>x()</script><p>Sutton signs &amp; stays.</p></html>')});
}
function claudeReturns(article, extra = {}) {
  mockCreate.mockResolvedValueOnce({
    stop_reason: 'end_turn',
    content: [{type: 'thinking', thinking: ''}, {type: 'text', text: JSON.stringify(article)}],
    ...extra,
  });
}
const ARTICLE = {title: 'Sutton stays — for good', description: 'Sutton commits.', content: '<p>Big news – he stays.</p><p> </p>', reviewNotes: ['Contract length inferred from the brief']};

async function call(body, headers = {authorization: 'token gh'}) {
  const res = makeRes();
  await draftHubArticle(makeReq({body, headers}), res);
  return res;
}

beforeEach(() => {
  jest.clearAllMocks();
  puts = [];
  mockFetchWithTimeout.mockImplementation(defaultFetch);
  mockRequireRepoPusher.mockResolvedValue(false);
});

describe('draftHubArticle', () => {
  it('stops at the auth gate without calling Claude or GitHub', async () => {
    mockRequireRepoPusher.mockImplementation(async (req, res) => { res.status(401).send('Unauthorized'); return true; });
    const res = await call({brief: 'Sutton confirmed for 2027 with NAPA'});
    expect(res.status).toHaveBeenCalledWith(401);
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockFetchWithTimeout).not.toHaveBeenCalled();
  });

  it('writes and commits an aiDraft draft on the happy path', async () => {
    claudeReturns(ARTICLE);
    const res = await call({brief: 'Sutton confirmed for 2027 with NAPA', urls: ['https://www.btcc.net/x'], category: 'Paddock'});
    expect(res.status).toHaveBeenCalledWith(200);

    const req = mockCreate.mock.calls[0][0];
    expect(req.model).toBe('claude-opus-5-5');
    expect(req.fallbacks).toBe('default');
    expect(req.betas).toEqual(['server-side-fallback-2026-07-01']);
    expect(req.output_config.format.schema).toBe(_internal.ARTICLE_SCHEMA);
    expect(req.system).toContain(STYLE_RULES);
    const user = req.messages[0].content;
    expect(user).toContain('Sutton confirmed for 2027 with NAPA');
    expect(user).toContain('#5 Ashley Sutton - NAPA Racing UK');
    expect(user).toContain('1. Ashley SUTTON (NAPA Racing UK) 516 pts');
    expect(user).toContain('Sutton signs & stays.');
    expect(user).not.toContain('x()');
    // Drafts aren't "recent headlines" - only visible posts are.
    expect(user).toContain('Old published story');
    expect(user).not.toContain('Hand-written draft');

    expect(puts).toHaveLength(1);
    const posts = JSON.parse(Buffer.from(puts[0].content, 'base64').toString()).posts;
    expect(posts).toHaveLength(EXISTING.length + 1);
    const post = posts[0];
    expect(post).toMatchObject({
      title: 'Sutton stays - for good',
      description: 'Sutton commits.',
      content: '<p>Big news - he stays.</p>',
      category: 'Paddock',
      status: 'draft',
      aiDraft: true,
      aiBrief: 'Sutton confirmed for 2027 with NAPA',
      aiSourceUrls: ['https://www.btcc.net/x'],
      aiNotes: ['Contract length inferred from the brief'],
      source: 'btcc-hub',
      sourceUrl: 'https://www.btcc.net/x',
    });
    expect(post.id).toMatch(/^hub-\d+$/);
    expect(puts[0].sha).toBe('sha-1');
  });

  it('tells Claude when a source link failed to load instead of dropping it silently', async () => {
    claudeReturns(ARTICLE);
    mockFetchWithTimeout.mockImplementation((url, ms, o) => (url.includes('broken.example') ? Promise.resolve({ok: false, status: 403}) : defaultFetch(url, ms, o)));
    await call({brief: 'Write up this story please', urls: ['https://broken.example/a']});
    expect(mockCreate.mock.calls[0][0].messages[0].content).toContain('(could not be loaded: HTTP 403)');
  });

  it('regenerates in place, keeping the id, images and pubDate', async () => {
    claudeReturns(ARTICLE);
    const res = await call({brief: 'Try a different angle on this', regenerateId: 'hub-ai-old'});
    expect(res.status).toHaveBeenCalledWith(200);
    const posts = JSON.parse(Buffer.from(puts[0].content, 'base64').toString()).posts;
    expect(posts).toHaveLength(EXISTING.length);
    const post = posts.find(p => p.id === 'hub-ai-old');
    expect(post).toMatchObject({title: 'Sutton stays - for good', imageUrl: 'https://img/x.webp', images: ['https://img/x.webp'], pubDate: '2026-10-01T09:00', aiDraft: true});
  });

  it('refuses to regenerate over a post that is not an AI draft', async () => {
    claudeReturns(ARTICLE);
    const res = await call({brief: 'Try a different angle on this', regenerateId: 'hub-1'});
    expect(res.status).toHaveBeenCalledWith(409);
    expect(puts).toHaveLength(0);
  });

  it('retries the commit on a sha conflict instead of failing', async () => {
    claudeReturns(ARTICLE);
    let first = true;
    mockFetchWithTimeout.mockImplementation((url, ms, o = {}) => {
      if (o.method === 'PUT' && first) { first = false; return Promise.resolve({ok: false, status: 409, text: () => Promise.resolve('conflict')}); }
      return defaultFetch(url, ms, o);
    });
    const res = await call({brief: 'Sutton confirmed for 2027 with NAPA'});
    expect(res.status).toHaveBeenCalledWith(200);
    expect(puts).toHaveLength(1);
  });

  it.each([
    ['a too-short brief', {brief: 'hi'}, 400],
    ['too many links', {brief: 'A proper brief here', urls: ['https://a.com/1', 'https://a.com/2', 'https://a.com/3', 'https://a.com/4', 'https://a.com/5', 'https://a.com/6']}, 400],
    ['an internal link', {brief: 'A proper brief here', urls: ['http://metadata.google.internal/x']}, 400],
  ])('rejects %s before calling Claude', async (_, body, status) => {
    const res = await call(body);
    expect(res.status).toHaveBeenCalledWith(status);
    expect(mockCreate).not.toHaveBeenCalled();
    expect(puts).toHaveLength(0);
  });

  it('commits nothing when Claude refuses', async () => {
    mockCreate.mockResolvedValueOnce({stop_reason: 'refusal', content: []});
    const res = await call({brief: 'Sutton confirmed for 2027 with NAPA'});
    expect(res.status).toHaveBeenCalledWith(422);
    expect(puts).toHaveLength(0);
  });

  it('commits nothing when Claude returns unparseable output', async () => {
    mockCreate.mockResolvedValueOnce({stop_reason: 'end_turn', content: [{type: 'text', text: 'not json'}]});
    const res = await call({brief: 'Sutton confirmed for 2027 with NAPA'});
    expect(res.status).toHaveBeenCalledWith(502);
    expect(puts).toHaveLength(0);
  });

  it('logs and returns 500 when the Claude call itself throws', async () => {
    mockCreate.mockRejectedValueOnce(new Error('overloaded'));
    const res = await call({brief: 'Sutton confirmed for 2027 with NAPA'});
    expect(res.status).toHaveBeenCalledWith(500);
    expect(mockLogError).toHaveBeenCalledWith('draftHubArticle', 'overloaded', expect.any(Error));
    expect(puts).toHaveLength(0);
  });
});

describe('house style', () => {
  it('includes the no-groups-of-three rule', () => {
    expect(STYLE_RULES).toMatch(/Never group things in threes/);
  });
  it('has no em/en dashes in the prompt outside the rule that names them', () => {
    const text = (_internal.buildSystemPrompt() + _internal.buildUserContent({brief: 'b', sources: [], reference: '', recentTitles: []}))
      .split('\n').filter(l => !l.startsWith('- Never use em dashes')).join('\n');
    expect(text).not.toMatch(/[\u2014\u2013]/);
  });
});

describe('helpers', () => {
  it('formats a UK wall-clock timestamp', () => {
    expect(_internal.ukNowIso(new Date('2026-07-01T12:05:00Z'))).toBe('2026-07-01T13:05');
    expect(_internal.ukNowIso(new Date('2026-12-01T12:05:00Z'))).toBe('2026-12-01T12:05');
  });
  it('only allows public http(s) links', () => {
    expect(_internal.isFetchableUrl('https://www.btcc.net/news')).toBe(true);
    expect(_internal.isFetchableUrl('ftp://x.com')).toBe(false);
    expect(_internal.isFetchableUrl('http://localhost:8080')).toBe(false);
    expect(_internal.isFetchableUrl('http://169.254.169.254/latest')).toBe(false);
    expect(_internal.isFetchableUrl('not a url')).toBe(false);
  });
  it('defaults an unknown category to News', () => {
    expect(_internal.parseBody({brief: 'A proper brief here', category: 'Weekly Digest'}).category).toBe('News');
  });
});
