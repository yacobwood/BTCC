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
// Default: both raw-GitHub fetches (results{year}.json, standings.json)
// resolve to distinct, stable, parseable content - computeResultsHash needs
// something real to hash even when a test doesn't care what the hash is.
const mockFetchWithTimeout = jest.fn(url => Promise.resolve({
  ok: true,
  json: () => Promise.resolve(
    url.includes('/results') ? {season: '2026', rounds: [{round: 8}]} : {standings: [{driver: 'A'}], updated: '2026-09-05T09:00:00Z'},
  ),
}));
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
const {computeResultsHash} = require('../../functions/resultsHash');

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

  it('rejects a request without the correct scraper secret', async () => {
    const req = makeReq({headers: {'x-scraper-secret': 'wrong'}, body: {year: '2026'}});
    const res = makeRes();
    await notifyResultsUpdate(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('sends both the silent results_live signal and the visible results_teaser push on first-ever content', async () => {
    const req = makeReq({headers: {'x-scraper-secret': 'test-scraper-secret'}, body: {year: '2026'}});
    const res = makeRes();
    await notifyResultsUpdate(req, res);

    expect(mockMessaging.send).toHaveBeenCalledWith(expect.objectContaining({
      topic: 'results_live',
      data: {type: 'results_refresh', year: '2026'},
    }));
    expect(mockMessaging.send).toHaveBeenCalledWith(expect.objectContaining({
      topic: 'results_teaser',
      notification: expect.objectContaining({title: 'A fresh result just dropped'}),
    }));
    // Stores the new hash so a later identical-content call can dedupe against it.
    expect(mockDocRef.set).toHaveBeenCalledWith(expect.objectContaining({lastHash: expect.any(String)}));
    expect(mockLogPushHistory).toHaveBeenCalledWith('A fresh result just dropped', expect.any(String), 'results');
    expect(res.status).toHaveBeenCalledWith(200);
  });

  // The actual bug being fixed: scrape_tsl.py re-stamps standings.json's
  // `updated` field with the current time on essentially every raceday tick
  // regardless of whether anything real changed, and this endpoint used to
  // have no dedup at all - firing a visible push on every one of those
  // spurious calls (confirmed live, Croft round 8 weekend, 2026-09-05).
  it('does not resend the teaser when only standings.json\'s updated timestamp changed', async () => {
    // First call establishes a stored hash for this content.
    await notifyResultsUpdate(
      makeReq({headers: {'x-scraper-secret': 'test-scraper-secret'}, body: {year: '2026'}}),
      makeRes(),
    );
    const storedHash = mockDocRef.set.mock.calls[0][0].lastHash;
    jest.clearAllMocks(); // isolate the assertions below to the second call only

    mockDocRef.get.mockResolvedValueOnce({exists: true, data: () => ({lastHash: storedHash})});
    // Same results/standings content as the default mock, but a bumped `updated`
    // timestamp only - exactly what a spurious, content-unchanged scrape produces.
    mockFetchWithTimeout
      .mockImplementationOnce(() => Promise.resolve({ok: true, json: () => Promise.resolve({season: '2026', rounds: [{round: 8}]})}))
      .mockImplementationOnce(() => Promise.resolve({ok: true, json: () => Promise.resolve({standings: [{driver: 'A'}], updated: '2026-09-05T09:59:59Z'})}));

    const res = makeRes();
    await notifyResultsUpdate(
      makeReq({headers: {'x-scraper-secret': 'test-scraper-secret'}, body: {year: '2026'}}),
      res,
    );

    expect(mockMessaging.send).toHaveBeenCalledWith(expect.objectContaining({topic: 'results_live'}));
    expect(mockMessaging.send).not.toHaveBeenCalledWith(expect.objectContaining({topic: 'results_teaser'}));
    expect(mockDocRef.set).not.toHaveBeenCalled();
    expect(mockLogPushHistory).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('sends the teaser again when the standings content genuinely changes', async () => {
    await notifyResultsUpdate(
      makeReq({headers: {'x-scraper-secret': 'test-scraper-secret'}, body: {year: '2026'}}),
      makeRes(),
    );
    const storedHash = mockDocRef.set.mock.calls[0][0].lastHash;
    jest.clearAllMocks();

    mockDocRef.get.mockResolvedValueOnce({exists: true, data: () => ({lastHash: storedHash})});
    // A genuinely new driver row - real content change, not just the timestamp.
    mockFetchWithTimeout
      .mockImplementationOnce(() => Promise.resolve({ok: true, json: () => Promise.resolve({season: '2026', rounds: [{round: 8}]})}))
      .mockImplementationOnce(() => Promise.resolve({ok: true, json: () => Promise.resolve({standings: [{driver: 'A'}, {driver: 'B'}], updated: '2026-09-05T09:59:59Z'})}));

    await notifyResultsUpdate(
      makeReq({headers: {'x-scraper-secret': 'test-scraper-secret'}, body: {year: '2026'}}),
      makeRes(),
    );

    expect(mockMessaging.send).toHaveBeenCalledWith(expect.objectContaining({topic: 'results_teaser'}));
    expect(mockDocRef.set).toHaveBeenCalledWith(expect.objectContaining({lastHash: expect.any(String)}));
  });

  it('still succeeds if the results_teaser send fails (non-fatal, caught separately)', async () => {
    mockMessaging.send
      .mockResolvedValueOnce('ok') // results_live
      .mockRejectedValueOnce(new Error('teaser send failed')); // results_teaser
    const req = makeReq({headers: {'x-scraper-secret': 'test-scraper-secret'}, body: {year: '2026'}});
    const res = makeRes();
    await notifyResultsUpdate(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('logs and returns 500 if the primary results_live send fails', async () => {
    mockMessaging.send.mockRejectedValueOnce(new Error('fcm down'));
    const req = makeReq({headers: {'x-scraper-secret': 'test-scraper-secret'}, body: {year: '2026'}});
    const res = makeRes();
    await notifyResultsUpdate(req, res);
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
