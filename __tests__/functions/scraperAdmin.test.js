const {makeReq, makeRes, makeFirestoreMock, makeMessagingMock} = require('./testHelpers');

const ADMIN_SECRET = 'test-admin-secret';
process.env.SCRAPER_SECRET = 'test-scraper-secret';

// firebase-admin lives only in functions/node_modules (Cloud Functions have
// their own package.json/install, separate from the app's root one), so it
// isn't resolvable from a root-level __tests__/ file - {virtual: true} tells
// Jest to register the mock by name without trying to resolve a real module.
const {db: mockFirestoreDb, docRef: mockDocRef} = makeFirestoreMock();
jest.mock('firebase-admin/firestore', () => ({
  getFirestore: jest.fn(() => mockFirestoreDb),
}), {virtual: true});

const mockMessaging = makeMessagingMock();
jest.mock('firebase-admin/messaging', () => ({
  getMessaging: jest.fn(() => mockMessaging),
}), {virtual: true});

const mockLogError = jest.fn(() => Promise.resolve());
const mockLogPushHistory = jest.fn(() => Promise.resolve());

// Default results{year}.json content: round 8 with one already-scored
// session (Qualifying) and one still-empty one (Race 1) - a realistic
// mid-raceday shape. standings.json's `updated` timestamp is deliberately
// irrelevant to every test here, since computeSessionFingerprints only ever
// looks at results{year}.json - proving that by construction, not just by
// assertion.
const DEFAULT_ROUNDS = [{
  round: 8,
  races: [
    {label: 'Qualifying', results: [{pos: 1, driver: 'A'}], grid: null},
    {label: 'Race 1', results: [], grid: null},
  ],
}];
const mockFetchWithTimeout = jest.fn(url => Promise.resolve(
  url.includes('/results')
    ? {ok: true, json: () => Promise.resolve({season: '2026', rounds: DEFAULT_ROUNDS})}
    : {ok: true, json: () => Promise.resolve({standings: [{driver: 'A'}], updated: '2026-09-05T09:00:00Z'})},
));
jest.mock('../../functions/shared', () => ({
  logError: mockLogError,
  logPushHistory: mockLogPushHistory,
  fetchWithTimeout: mockFetchWithTimeout,
  ADMIN_SECRET: 'test-admin-secret',
  requireAdminPost: (req, res) => {
    if (req.method !== 'POST') { res.status(405).send('Method Not Allowed'); return true; }
    if (req.headers['x-admin-secret'] !== 'test-admin-secret') { res.status(401).send('Unauthorized'); return true; }
    return false;
  },
}));

const {dismissError, notifyResultsUpdate, reportScraperFailure} = require('../../functions/scraperAdmin');
const {computeSessionFingerprints} = require('../../functions/resultsHash');

// fetchResultsAndStandings issues both fetches via Promise.all in this exact
// order (results first, standings second) - queue exactly two "once" mocks
// to override just the next notifyResultsUpdate call's content.
function mockResultsOnce(rounds) {
  mockFetchWithTimeout
    .mockImplementationOnce(() => Promise.resolve({ok: true, json: () => Promise.resolve({season: '2026', rounds})}))
    .mockImplementationOnce(() => Promise.resolve({ok: true, json: () => Promise.resolve({standings: [], updated: new Date().toISOString()})}));
}

describe('dismissError', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejects a non-POST request', async () => {
    const req = makeReq({method: 'GET'});
    const res = makeRes();
    await dismissError(req, res);
    expect(res.status).toHaveBeenCalledWith(405);
  });

  it('rejects a request without the correct admin secret', async () => {
    const req = makeReq({headers: {'x-admin-secret': 'wrong'}, body: {id: 'abc'}});
    const res = makeRes();
    await dismissError(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('dismisses a single error by id', async () => {
    const req = makeReq({headers: {'x-admin-secret': ADMIN_SECRET}, body: {id: 'err-1'}});
    const res = makeRes();
    await dismissError(req, res);
    expect(mockFirestoreDb.collection).toHaveBeenCalledWith('errors');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ok: true});
  });

  it('requires an id when not dismissing all', async () => {
    const req = makeReq({headers: {'x-admin-secret': ADMIN_SECRET}, body: {}});
    const res = makeRes();
    await dismissError(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('dismisses all unresolved errors when all=true', async () => {
    const req = makeReq({headers: {'x-admin-secret': ADMIN_SECRET}, body: {all: true}});
    const res = makeRes();
    await dismissError(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ok: true}));
  });
});

describe('notifyResultsUpdate', () => {
  beforeEach(() => jest.clearAllMocks());

  async function call() {
    const req = makeReq({headers: {'x-scraper-secret': 'test-scraper-secret'}, body: {year: '2026'}});
    const res = makeRes();
    await notifyResultsUpdate(req, res);
    return res;
  }

  // Runs one bootstrap call (seeding whatever DEFAULT_ROUNDS/overridden
  // content is currently mocked), captures the fingerprints it stored, then
  // wires mockDocRef.get to return them for the next call - simulating
  // "reading back what was just written" across two independent test-mock
  // invocations, since these are plain jest.fn()s, not a real Firestore.
  async function seedBaseline() {
    await call();
    const fingerprints = mockDocRef.set.mock.calls[0][0].fingerprints;
    jest.clearAllMocks();
    mockDocRef.get.mockResolvedValueOnce({exists: true, data: () => ({fingerprints})});
  }

  it('rejects a request without the correct scraper secret', async () => {
    const req = makeReq({headers: {'x-scraper-secret': 'wrong'}, body: {year: '2026'}});
    const res = makeRes();
    await notifyResultsUpdate(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('always sends the silent results_live cache-invalidation signal', async () => {
    const res = await call();
    expect(mockMessaging.send).toHaveBeenCalledWith(expect.objectContaining({
      topic: 'results_live',
      data: {type: 'results_refresh', year: '2026'},
    }));
    expect(res.status).toHaveBeenCalledWith(200);
  });

  // Same "don't notify on the very first sighting" idiom as newsCheck.js's
  // state/news.lastId - without a prior fingerprint map, every session with
  // real results would look "new" purely because nothing was stored yet,
  // not because anything actually just changed.
  it('seeds fingerprints without sending a visible teaser on the very first call', async () => {
    await call();
    expect(mockDocRef.set).toHaveBeenCalledWith(expect.objectContaining({fingerprints: expect.any(Object)}));
    expect(mockMessaging.send).not.toHaveBeenCalledWith(expect.objectContaining({topic: 'results_teaser'}));
    expect(mockLogPushHistory).not.toHaveBeenCalled();
  });

  it('deep-links the teaser to the round/session that changed, once a baseline exists', async () => {
    await seedBaseline();
    // Qualifying (index 0) was already scored at baseline; Race 1 (index 1)
    // now has a result for the first time - that's the one that should win.
    mockResultsOnce([{
      round: 8,
      races: [
        {label: 'Qualifying', results: [{pos: 1, driver: 'A'}], grid: null},
        {label: 'Race 1', results: [{pos: 1, driver: 'A'}], grid: null},
      ],
    }]);

    await call();

    expect(mockMessaging.send).toHaveBeenCalledWith(expect.objectContaining({
      topic: 'results_teaser',
      notification: expect.objectContaining({title: 'A fresh result just dropped'}),
      data: {type: 'results', year: '2026', round: '8', race: '2'}, // race is 1-indexed for notifNavigation.js
    }));
    expect(mockLogPushHistory).toHaveBeenCalledWith('A fresh result just dropped', expect.any(String), 'results');
    expect(mockDocRef.set).toHaveBeenCalledWith(expect.objectContaining({fingerprints: expect.any(Object)}));
  });

  // The actual bug being fixed: scrape_tsl.py re-stamps standings.json's
  // `updated` field with the current time on essentially every raceday tick
  // regardless of whether anything real changed, and this endpoint used to
  // have no dedup at all - firing a visible push on every one of those
  // spurious calls (confirmed live, Croft round 8 weekend, 2026-09-05).
  // computeSessionFingerprints never even looks at standings.json at all now,
  // so this is airtight by construction, not just by assertion.
  it('does not resend the teaser when only standings.json\'s updated timestamp changed', async () => {
    await seedBaseline();
    mockResultsOnce(DEFAULT_ROUNDS); // identical results content, standings.json's `updated` differs (see mockResultsOnce)

    const res = await call();

    expect(mockMessaging.send).toHaveBeenCalledWith(expect.objectContaining({topic: 'results_live'}));
    expect(mockMessaging.send).not.toHaveBeenCalledWith(expect.objectContaining({topic: 'results_teaser'}));
    expect(mockDocRef.set).not.toHaveBeenCalled();
    expect(mockLogPushHistory).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('still succeeds if the results_teaser send fails, and does NOT advance the fingerprint baseline (so the next tick retries instead of losing the push)', async () => {
    await seedBaseline();
    mockResultsOnce([{round: 8, races: [{label: 'Qualifying', results: [{pos: 1, driver: 'B'}], grid: null}]}]);
    mockMessaging.send
      .mockResolvedValueOnce('ok') // results_live
      .mockRejectedValueOnce(new Error('teaser send failed')); // results_teaser

    const res = await call();
    expect(res.status).toHaveBeenCalledWith(200);
    // The bug this guards against: persisting the new fingerprint BEFORE
    // confirming the send succeeded meant a failed send still marked the
    // change as "already reported" - silently losing that push forever
    // instead of retrying on the next tick.
    expect(mockDocRef.set).not.toHaveBeenCalled();
  });

  // findChangedSession only ever surfaces the single most-recent changed
  // (round, session) pair per tick (by its own design, see resultsHash.js).
  // A backfill/manual re-scrape can still change several sessions in one
  // tick - this asserts the OTHER changed session (round 7, not picked
  // since round 8 comes later in the rounds array) is left alone in the
  // persisted baseline rather than being marked "seen" alongside the one
  // that actually got notified, so it's still detected as changed next tick.
  it('does not silently mark an unnotified session as seen when two sessions change in the same tick', async () => {
    await seedBaseline(); // baseline: only round 8 (Qualifying scored, Race 1 empty)
    mockResultsOnce([
      // Round 7 is brand new this tick (wasn't in the baseline at all) -
      // appears earlier in the array, so it's the "swallowed" one.
      {round: 7, races: [{label: 'Qualifying', results: [{pos: 1, driver: 'C'}], grid: null}]},
      // Round 8 Race 1 changes too, and being later in the array is the
      // one findChangedSession actually picks and notifies.
      {
        round: 8,
        races: [
          {label: 'Qualifying', results: [{pos: 1, driver: 'A'}], grid: null},
          {label: 'Race 1', results: [{pos: 1, driver: 'A'}], grid: null},
        ],
      },
    ]);

    await call();

    expect(mockMessaging.send).toHaveBeenCalledWith(expect.objectContaining({
      topic: 'results_teaser',
      data: expect.objectContaining({round: '8', race: '2'}),
    }));
    const persisted = mockDocRef.set.mock.calls.find(c => c[0].fingerprints)[0].fingerprints;
    // Round 7's genuinely-new session must NOT be recorded as already-seen -
    // it was never notified, so it needs to remain "changed" on the next tick.
    expect(persisted[7]).toBeUndefined();
    // Round 8's notified session correctly advances.
    expect(persisted[8]['Race 1']).toEqual(expect.any(String));
  });

  it('logs and returns 500 if the primary results_live send fails', async () => {
    mockMessaging.send.mockRejectedValueOnce(new Error('fcm down'));
    const res = await call();
    expect(mockLogError).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('reportScraperFailure', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejects a request without the correct scraper secret', async () => {
    const req = makeReq({headers: {'x-scraper-secret': 'wrong'}, body: {workflow: 'scrape_news'}});
    const res = makeRes();
    await reportScraperFailure(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('requires a workflow name', async () => {
    const req = makeReq({headers: {'x-scraper-secret': 'test-scraper-secret'}, body: {}});
    const res = makeRes();
    await reportScraperFailure(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('logs the failure with the workflow-scoped key and alert flag', async () => {
    const req = makeReq({
      headers: {'x-scraper-secret': 'test-scraper-secret'},
      body: {workflow: 'scrape_news', message: 'timed out', runUrl: 'https://github.com/x/actions/runs/1'},
    });
    const res = makeRes();
    await reportScraperFailure(req, res);
    expect(mockLogError).toHaveBeenCalledWith(
      'scraper:scrape_news',
      'timed out',
      expect.objectContaining({stack: 'https://github.com/x/actions/runs/1'}),
      expect.objectContaining({key: 'scraper-scrape_news', alert: true}),
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
