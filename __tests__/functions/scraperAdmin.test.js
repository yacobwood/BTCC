const {makeReq, makeRes, makeFirestoreMock, makeMessagingMock} = require('./testHelpers');

const ADMIN_SECRET = 'test-admin-secret';
process.env.SCRAPER_SECRET = 'test-scraper-secret';

// firebase-admin lives only in functions/node_modules (Cloud Functions have
// their own package.json/install, separate from the app's root one), so it
// isn't resolvable from a root-level __tests__/ file - {virtual: true} tells
// Jest to register the mock by name without trying to resolve a real module.
const {db: mockFirestoreDb} = makeFirestoreMock();
jest.mock('firebase-admin/firestore', () => ({
  getFirestore: jest.fn(() => mockFirestoreDb),
}), {virtual: true});

const mockMessaging = makeMessagingMock();
jest.mock('firebase-admin/messaging', () => ({
  getMessaging: jest.fn(() => mockMessaging),
}), {virtual: true});

const mockLogError = jest.fn(() => Promise.resolve());
jest.mock('../../functions/shared', () => ({
  logError: mockLogError,
  ADMIN_SECRET: 'test-admin-secret',
}));

const {dismissError, notifyResultsUpdate, reportScraperFailure} = require('../../functions/scraperAdmin');

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

  it('sends both the silent results_live signal and the visible results_teaser push', async () => {
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
    expect(res.status).toHaveBeenCalledWith(200);
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
