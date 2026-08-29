const {makeReq, makeRes, makeFirestoreMock} = require('./testHelpers');

const {db: mockFirestoreDb, docRef: mockDocRef, collectionRef: mockCollectionRef, batch: mockBatch, querySnapshot: mockQuerySnapshot} = makeFirestoreMock();
jest.mock('firebase-admin/firestore', () => ({
  getFirestore: jest.fn(() => mockFirestoreDb),
}), {virtual: true});

const mockGetAccessToken = jest.fn(() => Promise.resolve({token: 'ga4-token'}));
const mockGetClient = jest.fn(() => Promise.resolve({getAccessToken: mockGetAccessToken}));
jest.mock('google-auth-library', () => ({
  GoogleAuth: jest.fn().mockImplementation(() => ({getClient: mockGetClient})),
}), {virtual: true});

const mockFetchWithTimeout = jest.fn();
const mockLogError = jest.fn(() => Promise.resolve());
jest.mock('../../functions/shared', () => ({
  logError: mockLogError,
  fetchWithTimeout: (...args) => mockFetchWithTimeout(...args),
  getUKDateString: jest.fn((date, offset) => `2026-08-${String(18 + offset).padStart(2, '0')}`),
  requireAdminPost: (req, res) => {
    if (req.method !== 'POST') { res.status(405).send('Method Not Allowed'); return true; }
    if (req.headers['x-admin-secret'] !== 'test-admin-secret') { res.status(401).send('Unauthorized'); return true; }
    return false;
  },
}));

const {syncAnalytics, exportAnalyticsHistory, backfillAnalyticsDaily} = require('../../functions/analytics');

// GA4's runReport response shape: {rows: [{dimensionValues: [...], metricValues: [...]}]}
function ga4Response(rows = []) {
  return {json: () => Promise.resolve({rows})};
}
function metricRow(values, dims = []) {
  return {dimensionValues: dims.map(v => ({value: v})), metricValues: values.map(v => ({value: String(v)}))};
}

describe('syncAnalytics', () => {
  beforeEach(() => jest.clearAllMocks());

  it('fetches an access token via GoogleAuth and calls GA4 with a Bearer token', async () => {
    mockFetchWithTimeout.mockResolvedValue(ga4Response([]));
    await syncAnalytics.run();

    expect(mockGetClient).toHaveBeenCalled();
    expect(mockFetchWithTimeout).toHaveBeenCalledWith(
      expect.stringContaining('analyticsdata.googleapis.com'),
      expect.any(Number),
      expect.objectContaining({headers: expect.objectContaining({Authorization: 'Bearer ga4-token'})}),
    );
  });

  it('writes overview/topSources/dailyNewUsers to analytics/summary', async () => {
    mockFetchWithTimeout
      .mockResolvedValueOnce(ga4Response([metricRow([5, 50], ['1d'])])) // overview
      .mockResolvedValueOnce(ga4Response([metricRow([3, 10], ['google', 'organic'])])) // sources
      .mockResolvedValueOnce(ga4Response([metricRow([2, 20, 7], ['20260818'])])); // daily

    await syncAnalytics.run();

    expect(mockFirestoreDb.collection).toHaveBeenCalledWith('analytics');
    expect(mockCollectionRef.doc).toHaveBeenCalledWith('summary');
    expect(mockDocRef.set).toHaveBeenCalledWith(expect.objectContaining({
      overview: {'1d': {newUsers: 5, activeUsers: 50}},
      topSources: [{source: 'google', medium: 'organic', newUsers: 3, sessions: 10}],
      dailyNewUsers: [{date: '20260818', newUsers: 2, activeUsers: 20}],
    }));
  });

  it('also upserts the daily breakdown into analytics_daily_history, reformatted to YYYY-MM-DD', async () => {
    mockFetchWithTimeout
      .mockResolvedValueOnce(ga4Response([])) // overview
      .mockResolvedValueOnce(ga4Response([])) // sources
      .mockResolvedValueOnce(ga4Response([ // daily
        metricRow([2, 20, 7], ['20260818']),
        metricRow([1, 15, 5], ['20260819']),
      ]));

    await syncAnalytics.run();

    expect(mockFirestoreDb.collection).toHaveBeenCalledWith('analytics_daily_history');
    expect(mockBatch.set).toHaveBeenCalledTimes(2);
    expect(mockBatch.set).toHaveBeenCalledWith(mockDocRef, {date: '2026-08-18', newUsers: 2, activeUsers: 20, sessions: 7});
    expect(mockBatch.set).toHaveBeenCalledWith(mockDocRef, {date: '2026-08-19', newUsers: 1, activeUsers: 15, sessions: 5});
    expect(mockBatch.commit).toHaveBeenCalledTimes(1);
  });

  it('logs an alerting error rather than throwing if the GA4 call fails', async () => {
    mockFetchWithTimeout.mockResolvedValue({json: () => Promise.resolve({error: {message: 'quota exceeded'}})});
    await expect(syncAnalytics.run()).resolves.toBeUndefined();
    expect(mockLogError).toHaveBeenCalledWith('syncAnalytics', expect.stringContaining('GA4 API error'), expect.anything(), {alert: true});
  });
});

describe('exportAnalyticsHistory', () => {
  beforeEach(() => jest.clearAllMocks());

  it('accumulates totalUsersAllTime from the previous week\'s stored figure, without a bootstrap fetch', async () => {
    mockQuerySnapshot.empty = false;
    mockQuerySnapshot.docs = [{data: () => ({totalUsersAllTime: 1000})}];
    mockFetchWithTimeout.mockResolvedValue(ga4Response([metricRow([50, 200, 300, 10, 15, 8, 400], [])]));

    await exportAnalyticsHistory.run();

    expect(mockDocRef.set).toHaveBeenCalledWith(expect.objectContaining({totalUsersAllTime: 1050, newUsers: 50}));
    // Only the 5 weekly reports were fetched, not a 6th bootstrap one
    expect(mockFetchWithTimeout).toHaveBeenCalledTimes(5);
  });

  it('does a one-time full-history bootstrap fetch when no prior week is stored', async () => {
    mockQuerySnapshot.empty = true;
    mockQuerySnapshot.docs = [];
    mockFetchWithTimeout
      .mockResolvedValueOnce(ga4Response([metricRow([50, 200, 300, 10, 15, 8, 400], [])])) // overview
      .mockResolvedValueOnce(ga4Response([])) // daily
      .mockResolvedValueOnce(ga4Response([])) // sources
      .mockResolvedValueOnce(ga4Response([])) // platform
      .mockResolvedValueOnce(ga4Response([])) // uk cities
      .mockResolvedValueOnce(ga4Response([metricRow([9999], [])])); // bootstrap totalUsers

    await exportAnalyticsHistory.run();

    expect(mockFetchWithTimeout).toHaveBeenCalledTimes(6);
    expect(mockDocRef.set).toHaveBeenCalledWith(expect.objectContaining({totalUsersAllTime: 9999}));
  });

  it('reformats GA4\'s bare YYYYMMDD dates to YYYY-MM-DD in the daily breakdown', async () => {
    mockQuerySnapshot.empty = false;
    mockQuerySnapshot.docs = [{data: () => ({totalUsersAllTime: 0})}];
    mockFetchWithTimeout
      .mockResolvedValueOnce(ga4Response([metricRow([1, 2, 3, 4, 5, 6, 7], [])]))
      .mockResolvedValueOnce(ga4Response([metricRow([1, 2, 3], ['20260818'])]))
      .mockResolvedValueOnce(ga4Response([]))
      .mockResolvedValueOnce(ga4Response([]))
      .mockResolvedValueOnce(ga4Response([]));

    await exportAnalyticsHistory.run();

    expect(mockDocRef.set).toHaveBeenCalledWith(expect.objectContaining({
      dailyBreakdown: [{date: '2026-08-18', newUsers: 1, activeUsers: 2, sessions: 3}],
    }));
  });

  it('logs an alerting error rather than throwing on failure', async () => {
    mockQuerySnapshot.empty = true;
    mockFetchWithTimeout.mockRejectedValue(new Error('network down'));
    await expect(exportAnalyticsHistory.run()).resolves.toBeUndefined();
    expect(mockLogError).toHaveBeenCalledWith('exportAnalyticsHistory', 'network down', expect.anything(), {alert: true});
  });
});

describe('backfillAnalyticsDaily', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejects a non-POST request', async () => {
    const req = makeReq({method: 'GET'});
    const res = makeRes();
    await backfillAnalyticsDaily(req, res);
    expect(res.status).toHaveBeenCalledWith(405);
  });

  it('rejects a request without the correct admin secret', async () => {
    const req = makeReq({headers: {'x-admin-secret': 'wrong'}});
    const res = makeRes();
    await backfillAnalyticsDaily(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('writes one analytics_daily_history doc per day GA4 returns, batched', async () => {
    mockFetchWithTimeout.mockResolvedValueOnce(ga4Response([
      metricRow([1, 2, 3], ['20260817']),
      metricRow([4, 5, 6], ['20260818']),
    ]));
    const req = makeReq({headers: {'x-admin-secret': 'test-admin-secret'}});
    const res = makeRes();
    await backfillAnalyticsDaily(req, res);

    expect(mockFirestoreDb.collection).toHaveBeenCalledWith('analytics_daily_history');
    expect(mockBatch.set).toHaveBeenCalledTimes(2);
    expect(mockBatch.commit).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ok: true, days: 2});
  });

  it('splits into multiple batches beyond 500 days', async () => {
    const rows = Array.from({length: 501}, (_, i) => metricRow([1, 1, 1], [`202601${String(i % 28 + 1).padStart(2, '0')}`]));
    mockFetchWithTimeout.mockResolvedValueOnce(ga4Response(rows));
    const req = makeReq({headers: {'x-admin-secret': 'test-admin-secret'}});
    const res = makeRes();
    await backfillAnalyticsDaily(req, res);
    expect(mockBatch.commit).toHaveBeenCalledTimes(2);
  });

  it('returns 500 and logs an alerting error if the GA4 call fails', async () => {
    mockFetchWithTimeout.mockResolvedValueOnce({json: () => Promise.resolve({error: {message: 'bad request'}})});
    const req = makeReq({headers: {'x-admin-secret': 'test-admin-secret'}});
    const res = makeRes();
    await backfillAnalyticsDaily(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(mockLogError).toHaveBeenCalledWith('backfillAnalyticsDaily', expect.stringContaining('GA4 API error'), expect.anything(), {alert: true});
  });
});
