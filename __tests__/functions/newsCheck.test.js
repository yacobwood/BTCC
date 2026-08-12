const {checkBtccNews, NEWS_URL, ARTICLES_INDEX_URL} = require('../../functions/newsCheck');

const ARTICLE = {
  id: 42,
  slug: 'btcc-2026-round-1',
  title: {rendered: 'BTCC 2026 Round 1 Preview'},
  _embedded: {'wp:featuredmedia': [{source_url: 'https://example.com/img.jpg'}]},
};

function makeDb({lastId, pendingSend = null, txSetSpy} = {}) {
  const snap = {exists: lastId !== undefined, data: () => ({lastId, pendingSend})};
  const tx = {get: jest.fn().mockResolvedValue(snap), set: txSetSpy || jest.fn()};
  const docRef = {update: jest.fn().mockResolvedValue()};
  return {
    collection: () => ({doc: () => docRef}),
    runTransaction: jest.fn(async (fn) => fn(tx)),
    _tx: tx,
    _docRef: docRef,
  };
}

function makeMessaging() {
  return {send: jest.fn().mockResolvedValue('msg-id-1')};
}

function indexFromArticles(articles) {
  const index = {};
  (Array.isArray(articles) ? articles : []).forEach(a => { if (a?.slug) index[a.slug] = 1; });
  return index;
}

// By default the mocked article mirror already contains whatever slug is in
// `articles`, so tests unrelated to the mirror-gating behaviour don't need to
// know it exists. Pass indexOverride (e.g. {}) to simulate the mirror lagging
// behind the notification, or a rejecting/erroring fetchFn to simulate the
// index fetch itself failing.
function makeFetch(articles, status = 200, indexOverride) {
  const index = indexOverride !== undefined ? indexOverride : indexFromArticles(articles);
  return jest.fn((url) => {
    if (url === ARTICLES_INDEX_URL) {
      return Promise.resolve({ok: true, json: jest.fn().mockResolvedValue(index)});
    }
    return Promise.resolve({status, json: jest.fn().mockResolvedValue(articles)});
  });
}

test('sends notification when a new article is detected after first run', async () => {
  const db = makeDb({lastId: 7});
  const messaging = makeMessaging();
  const logHistory = jest.fn();

  await checkBtccNews({fetchFn: makeFetch([ARTICLE]), db, messaging, logHistory});

  expect(messaging.send).toHaveBeenCalledTimes(1);
  expect(messaging.send).toHaveBeenCalledWith(
    expect.objectContaining({
      topic: 'news_alerts',
      data: expect.objectContaining({type: 'news', slug: ARTICLE.slug, title: ARTICLE.title.rendered}),
    }),
  );
  expect(logHistory).toHaveBeenCalledWith('New Article', ARTICLE.title.rendered, 'news_alerts');
});

test('clears pendingSend after a successful send', async () => {
  const db = makeDb({lastId: 7});
  const messaging = makeMessaging();

  await checkBtccNews({fetchFn: makeFetch([ARTICLE]), db, messaging, logHistory: jest.fn()});

  expect(db._docRef.update).toHaveBeenCalledWith({pendingSend: null});
});

test('does not send notification on first run (lastId is null)', async () => {
  // lastId === null means Firestore doc exists but has no prior article - treated as first bootstrap
  const db = makeDb({lastId: null});
  const messaging = makeMessaging();
  const logHistory = jest.fn();

  await checkBtccNews({fetchFn: makeFetch([ARTICLE]), db, messaging, logHistory});

  expect(messaging.send).not.toHaveBeenCalled();
  expect(logHistory).not.toHaveBeenCalled();
});

test('does not send notification when article id is unchanged', async () => {
  const db = makeDb({lastId: ARTICLE.id});
  const messaging = makeMessaging();

  await checkBtccNews({fetchFn: makeFetch([ARTICLE]), db, messaging, logHistory: jest.fn()});

  expect(messaging.send).not.toHaveBeenCalled();
});

test('does not send notification on first-ever fetch (doc does not exist)', async () => {
  // snap.exists = false → lastId = null → no notification, just store the id
  const snap = {exists: false, data: () => ({})};
  const tx = {get: jest.fn().mockResolvedValue(snap), set: jest.fn()};
  const docRef = {update: jest.fn().mockResolvedValue()};
  const db = {
    collection: () => ({doc: () => docRef}),
    runTransaction: jest.fn(async (fn) => fn(tx)),
  };
  const messaging = makeMessaging();

  await checkBtccNews({fetchFn: makeFetch([ARTICLE]), db, messaging, logHistory: jest.fn()});

  expect(messaging.send).not.toHaveBeenCalled();
  expect(tx.set).toHaveBeenCalled();
});

test('resends notification when pendingSend is set from a previous crashed run', async () => {
  // Simulate a run that wrote state but crashed before calling messaging.send
  const pending = {title: ARTICLE.title.rendered, imageUrl: 'https://example.com/img.jpg', slug: ARTICLE.slug};
  const db = makeDb({lastId: ARTICLE.id, pendingSend: pending});
  const messaging = makeMessaging();
  const logHistory = jest.fn();

  await checkBtccNews({fetchFn: makeFetch([ARTICLE]), db, messaging, logHistory});

  expect(messaging.send).toHaveBeenCalledTimes(1);
  expect(messaging.send).toHaveBeenCalledWith(
    expect.objectContaining({
      topic: 'news_alerts',
      data: expect.objectContaining({slug: ARTICLE.slug}),
    }),
  );
  expect(db._docRef.update).toHaveBeenCalledWith({pendingSend: null});
  expect(logHistory).toHaveBeenCalled();
});

test('logs warning and returns early when API returns empty array', async () => {
  const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  const db = makeDb({lastId: 7});
  const messaging = makeMessaging();

  await checkBtccNews({fetchFn: makeFetch([], 200), db, messaging, logHistory: jest.fn()});

  expect(messaging.send).not.toHaveBeenCalled();
  expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('unexpected response'));
  consoleSpy.mockRestore();
});

test('includes imageUrl in notification data when featured media is present', async () => {
  const db = makeDb({lastId: 1});
  const messaging = makeMessaging();

  await checkBtccNews({fetchFn: makeFetch([ARTICLE]), db, messaging, logHistory: jest.fn()});

  expect(messaging.send).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({imageUrl: 'https://example.com/img.jpg'}),
    }),
  );
});

test('omits imageUrl from data when featured media is absent', async () => {
  const articleNoImage = {...ARTICLE, id: 99, _embedded: {}};
  const db = makeDb({lastId: 1});
  const messaging = makeMessaging();

  await checkBtccNews({fetchFn: makeFetch([articleNoImage]), db, messaging, logHistory: jest.fn()});

  const sentData = messaging.send.mock.calls[0][0].data;
  expect(sentData).not.toHaveProperty('imageUrl');
});

test('decodes HTML entities in article title', async () => {
  const articleWithEntities = {...ARTICLE, id: 55, title: {rendered: 'BTCC&#8217;s Best Race'}};
  const db = makeDb({lastId: 1});
  const messaging = makeMessaging();

  await checkBtccNews({fetchFn: makeFetch([articleWithEntities]), db, messaging, logHistory: jest.fn()});

  const sentTitle = messaging.send.mock.calls[0][0].data.title;
  expect(sentTitle).toBe('BTCC’s Best Race');
});

test('fetches from NEWS_URL with a 20s timeout', async () => {
  // No custom User-Agent needed here - NEWS_URL is GitHub raw content (already
  // scraped from btcc.net by scrape_news.py), not a direct btcc.net request, so
  // there's no Cloudflare fingerprinting to work around at this call site.
  const fetchFn = makeFetch([ARTICLE]);
  const db = makeDb({lastId: 7});

  await checkBtccNews({fetchFn, db, messaging: makeMessaging(), logHistory: jest.fn()});

  expect(fetchFn).toHaveBeenCalledWith(NEWS_URL, 20000);
});

// ── Article-mirror gating — regression for notifications linking to a slug
// the mirror (data/articles/index.json) hasn't picked up yet, which sent
// users to ArticleScreen's "couldn't load this article" screen. ──────────────

test('defers the notification when the slug is not yet in the article mirror', async () => {
  const db = makeDb({lastId: 7});
  const messaging = makeMessaging();
  const logHistory = jest.fn();
  const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

  // Empty index: mirror hasn't caught up to this article yet
  await checkBtccNews({fetchFn: makeFetch([ARTICLE], 200, {}), db, messaging, logHistory});

  expect(messaging.send).not.toHaveBeenCalled();
  expect(logHistory).not.toHaveBeenCalled();
  // pendingSend must stay set (not cleared) so the next tick retries
  expect(db._docRef.update).not.toHaveBeenCalled();
  expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('deferred'));
  consoleSpy.mockRestore();
});

test('sends on a later tick once the mirror catches up (pendingSend retry)', async () => {
  const pending = {title: ARTICLE.title.rendered, imageUrl: null, slug: ARTICLE.slug};
  // Simulates the state left behind by the deferred run above: lastId already
  // advanced, pendingSend still set
  const db = makeDb({lastId: ARTICLE.id, pendingSend: pending});
  const messaging = makeMessaging();
  const logHistory = jest.fn();

  // Now the mirror has the slug
  await checkBtccNews({fetchFn: makeFetch([ARTICLE], 200, {[ARTICLE.slug]: 1}), db, messaging, logHistory});

  expect(messaging.send).toHaveBeenCalledTimes(1);
  expect(db._docRef.update).toHaveBeenCalledWith({pendingSend: null});
  expect(logHistory).toHaveBeenCalled();
});

test('treats an index fetch failure as not-yet-mirrored and defers rather than sending', async () => {
  const db = makeDb({lastId: 7});
  const messaging = makeMessaging();
  const fetchFn = jest.fn((url) => {
    if (url === ARTICLES_INDEX_URL) return Promise.reject(new Error('network error'));
    return Promise.resolve({status: 200, json: jest.fn().mockResolvedValue([ARTICLE])});
  });

  await checkBtccNews({fetchFn, db, messaging, logHistory: jest.fn()});

  expect(messaging.send).not.toHaveBeenCalled();
  expect(db._docRef.update).not.toHaveBeenCalled();
});

test('treats a non-ok index response as not-yet-mirrored and defers', async () => {
  const db = makeDb({lastId: 7});
  const messaging = makeMessaging();
  const fetchFn = jest.fn((url) => {
    if (url === ARTICLES_INDEX_URL) return Promise.resolve({ok: false, status: 404});
    return Promise.resolve({status: 200, json: jest.fn().mockResolvedValue([ARTICLE])});
  });

  await checkBtccNews({fetchFn, db, messaging, logHistory: jest.fn()});

  expect(messaging.send).not.toHaveBeenCalled();
});
