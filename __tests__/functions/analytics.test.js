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

const {syncAnalytics, exportAnalyticsHistory, refreshAnalyticsHistory, backfillAnalyticsDaily} = require('../../functions/analytics');

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

  // Call order matches the REPORTS array in functions/analytics.js exactly:
  // overview, daily, sources, platform, ukCities, appVersion, topEvents,
  // screenPopularity, shareBreakdown, onboardingFunnel, notificationOptIns,
  // favouriteDrivers, searchTerms - 13 reports in total.
  const emptyReportsFrom3rd = () => { for (let i = 0; i < 11; i++) mockFetchWithTimeout.mockResolvedValueOnce(ga4Response([])); };

  it('accumulates totalUsersAllTime from the previous week\'s stored figure, without a bootstrap fetch', async () => {
    mockQuerySnapshot.empty = false;
    mockQuerySnapshot.docs = [{data: () => ({totalUsersAllTime: 1000})}];
    mockFetchWithTimeout.mockResolvedValueOnce(ga4Response([metricRow([50, 200, 300, 10, 15, 8, 400], [])])); // overview
    mockFetchWithTimeout.mockResolvedValueOnce(ga4Response([])); // daily
    emptyReportsFrom3rd();

    await exportAnalyticsHistory.run();

    expect(mockDocRef.set).toHaveBeenCalledWith(expect.objectContaining({totalUsersAllTime: 1050, newUsers: 50}));
    // All 13 weekly reports were fetched, not a 14th bootstrap one
    expect(mockFetchWithTimeout).toHaveBeenCalledTimes(13);
  });

  it('does a one-time full-history bootstrap fetch when no prior week is stored', async () => {
    mockQuerySnapshot.empty = true;
    mockQuerySnapshot.docs = [];
    mockFetchWithTimeout.mockResolvedValueOnce(ga4Response([metricRow([50, 200, 300, 10, 15, 8, 400], [])])); // overview
    mockFetchWithTimeout.mockResolvedValueOnce(ga4Response([])); // daily
    emptyReportsFrom3rd();
    mockFetchWithTimeout.mockResolvedValueOnce(ga4Response([metricRow([9999], [])])); // bootstrap totalUsers

    await exportAnalyticsHistory.run();

    expect(mockFetchWithTimeout).toHaveBeenCalledTimes(14);
    expect(mockDocRef.set).toHaveBeenCalledWith(expect.objectContaining({totalUsersAllTime: 9999}));
  });

  it('reformats GA4\'s bare YYYYMMDD dates to YYYY-MM-DD in the daily breakdown', async () => {
    mockQuerySnapshot.empty = false;
    mockQuerySnapshot.docs = [{data: () => ({totalUsersAllTime: 0})}];
    mockFetchWithTimeout.mockResolvedValueOnce(ga4Response([metricRow([1, 2, 3, 4, 5, 6, 7], [])])); // overview
    mockFetchWithTimeout.mockResolvedValueOnce(ga4Response([metricRow([1, 2, 3], ['20260818'])])); // daily
    emptyReportsFrom3rd();

    await exportAnalyticsHistory.run();

    expect(mockDocRef.set).toHaveBeenCalledWith(expect.objectContaining({
      dailyBreakdown: [{date: '2026-08-18', newUsers: 1, activeUsers: 2, sessions: 3}],
    }));
  });

  it('writes appVersionBreakdown and screenPopularity using their standard GA4 dimensions', async () => {
    mockQuerySnapshot.empty = false;
    mockQuerySnapshot.docs = [{data: () => ({totalUsersAllTime: 0})}];
    mockFetchWithTimeout.mockResolvedValueOnce(ga4Response([])); // overview
    mockFetchWithTimeout.mockResolvedValueOnce(ga4Response([])); // daily
    mockFetchWithTimeout.mockResolvedValueOnce(ga4Response([])); // sources
    mockFetchWithTimeout.mockResolvedValueOnce(ga4Response([])); // platform
    mockFetchWithTimeout.mockResolvedValueOnce(ga4Response([])); // ukCities
    mockFetchWithTimeout.mockResolvedValueOnce(ga4Response([metricRow([120, 40], ['2.21.0 (89)'])])); // appVersion
    mockFetchWithTimeout.mockResolvedValueOnce(ga4Response([])); // topEvents
    mockFetchWithTimeout.mockResolvedValueOnce(ga4Response([metricRow([300], ['news'])])); // screenPopularity
    mockFetchWithTimeout.mockResolvedValueOnce(ga4Response([])); // shareBreakdown
    mockFetchWithTimeout.mockResolvedValueOnce(ga4Response([])); // onboardingFunnel
    mockFetchWithTimeout.mockResolvedValueOnce(ga4Response([])); // notificationOptIns
    mockFetchWithTimeout.mockResolvedValueOnce(ga4Response([])); // favouriteDrivers
    mockFetchWithTimeout.mockResolvedValueOnce(ga4Response([])); // searchTerms

    await exportAnalyticsHistory.run();

    expect(mockDocRef.set).toHaveBeenCalledWith(expect.objectContaining({
      appVersionBreakdown: [{appVersion: '2.21.0 (89)', activeUsers: 120, newUsers: 40}],
      screenPopularity: [{screenName: 'news', views: 300}],
    }));
  });

  it('derives donorGateFunnel and widgetAdoption from named events inside topEvents, not a separate GA4 call', async () => {
    mockQuerySnapshot.empty = false;
    mockQuerySnapshot.docs = [{data: () => ({totalUsersAllTime: 0})}];
    mockFetchWithTimeout.mockResolvedValueOnce(ga4Response([])); // overview
    mockFetchWithTimeout.mockResolvedValueOnce(ga4Response([])); // daily
    mockFetchWithTimeout.mockResolvedValueOnce(ga4Response([])); // sources
    mockFetchWithTimeout.mockResolvedValueOnce(ga4Response([])); // platform
    mockFetchWithTimeout.mockResolvedValueOnce(ga4Response([])); // ukCities
    mockFetchWithTimeout.mockResolvedValueOnce(ga4Response([])); // appVersion
    mockFetchWithTimeout.mockResolvedValueOnce(ga4Response([
      metricRow([12], ['donor_gate_shown']),
      metricRow([5], ['donor_gate_name_save_result']),
      metricRow([3], ['donor_gate_skipped']),
      metricRow([40], ['widget_configured']),
      metricRow([22], ['widget_size_used']),
    ])); // topEvents
    mockFetchWithTimeout.mockResolvedValueOnce(ga4Response([])); // screenPopularity
    mockFetchWithTimeout.mockResolvedValueOnce(ga4Response([])); // shareBreakdown
    mockFetchWithTimeout.mockResolvedValueOnce(ga4Response([])); // onboardingFunnel
    mockFetchWithTimeout.mockResolvedValueOnce(ga4Response([])); // notificationOptIns
    mockFetchWithTimeout.mockResolvedValueOnce(ga4Response([])); // favouriteDrivers
    mockFetchWithTimeout.mockResolvedValueOnce(ga4Response([])); // searchTerms

    await exportAnalyticsHistory.run();

    expect(mockDocRef.set).toHaveBeenCalledWith(expect.objectContaining({
      donorGateFunnel: {shown: 12, nameSaved: 5, skipped: 3},
      widgetAdoption: {configured: 40, sizeUsed: 22},
    }));
  });

  it('writes the custom-event-parameter breakdowns (share/onboarding/notifications/favourites/search)', async () => {
    mockQuerySnapshot.empty = false;
    mockQuerySnapshot.docs = [{data: () => ({totalUsersAllTime: 0})}];
    mockFetchWithTimeout.mockResolvedValueOnce(ga4Response([])); // overview
    mockFetchWithTimeout.mockResolvedValueOnce(ga4Response([])); // daily
    mockFetchWithTimeout.mockResolvedValueOnce(ga4Response([])); // sources
    mockFetchWithTimeout.mockResolvedValueOnce(ga4Response([])); // platform
    mockFetchWithTimeout.mockResolvedValueOnce(ga4Response([])); // ukCities
    mockFetchWithTimeout.mockResolvedValueOnce(ga4Response([])); // appVersion
    mockFetchWithTimeout.mockResolvedValueOnce(ga4Response([])); // topEvents
    mockFetchWithTimeout.mockResolvedValueOnce(ga4Response([])); // screenPopularity
    mockFetchWithTimeout.mockResolvedValueOnce(ga4Response([metricRow([9], ['app'])])); // shareBreakdown
    mockFetchWithTimeout.mockResolvedValueOnce(ga4Response([metricRow([6], ['allow']), metricRow([2], ['skip'])])); // onboardingFunnel
    mockFetchWithTimeout.mockResolvedValueOnce(ga4Response([metricRow([4], ['results_live', 'false'])])); // notificationOptIns
    mockFetchWithTimeout.mockResolvedValueOnce(ga4Response([metricRow([7], ['Tom Ingram'])])); // favouriteDrivers
    mockFetchWithTimeout.mockResolvedValueOnce(ga4Response([metricRow([3], ['knockhill'])])); // searchTerms

    await exportAnalyticsHistory.run();

    expect(mockDocRef.set).toHaveBeenCalledWith(expect.objectContaining({
      shareBreakdown: [{contentType: 'app', eventCount: 9}],
      onboardingFunnel: [{choice: 'allow', eventCount: 6}, {choice: 'skip', eventCount: 2}],
      notificationOptIns: [{type: 'results_live', enabled: 'false', eventCount: 4}],
      favouriteDrivers: [{driverName: 'Tom Ingram', eventCount: 7}],
      searchTerms: [{searchTerm: 'knockhill', eventCount: 3}],
    }));
  });

  it('degrades one failed report (e.g. an unregistered custom dimension) to an empty array instead of failing the whole export', async () => {
    mockQuerySnapshot.empty = false;
    mockQuerySnapshot.docs = [{data: () => ({totalUsersAllTime: 0})}];
    mockFetchWithTimeout.mockResolvedValueOnce(ga4Response([metricRow([5, 50, 60, 1, 2, 3, 4], [])])); // overview - succeeds
    mockFetchWithTimeout.mockResolvedValueOnce(ga4Response([])); // daily
    mockFetchWithTimeout.mockResolvedValueOnce(ga4Response([])); // sources
    mockFetchWithTimeout.mockResolvedValueOnce(ga4Response([])); // platform
    mockFetchWithTimeout.mockResolvedValueOnce(ga4Response([])); // ukCities
    mockFetchWithTimeout.mockResolvedValueOnce(ga4Response([])); // appVersion
    mockFetchWithTimeout.mockResolvedValueOnce(ga4Response([])); // topEvents
    mockFetchWithTimeout.mockResolvedValueOnce(ga4Response([])); // screenPopularity
    mockFetchWithTimeout.mockRejectedValueOnce(new Error('GA4 API error: Unknown dimension(s): customEvent:content_type')); // shareBreakdown fails
    mockFetchWithTimeout.mockResolvedValueOnce(ga4Response([])); // onboardingFunnel
    mockFetchWithTimeout.mockResolvedValueOnce(ga4Response([])); // notificationOptIns
    mockFetchWithTimeout.mockResolvedValueOnce(ga4Response([])); // favouriteDrivers
    mockFetchWithTimeout.mockResolvedValueOnce(ga4Response([])); // searchTerms

    await exportAnalyticsHistory.run();

    // The week still gets written, with just the failed report defaulted to []...
    expect(mockDocRef.set).toHaveBeenCalledWith(expect.objectContaining({newUsers: 5, shareBreakdown: []}));
    // ...and the outer alerting path (reserved for a full export failure) never fires
    // just because one non-critical, optional report failed.
    expect(mockLogError).not.toHaveBeenCalled();
  });

  it('rethrows and alerts if even the fundamental overview report fails (a real GA4 outage, not one bad dimension)', async () => {
    mockQuerySnapshot.empty = true;
    mockFetchWithTimeout.mockRejectedValue(new Error('network down'));
    await expect(exportAnalyticsHistory.run()).resolves.toBeUndefined();
    expect(mockLogError).toHaveBeenCalledWith('exportAnalyticsHistory', 'network down', expect.anything(), {alert: true});
  });
});

describe('refreshAnalyticsHistory', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejects a non-POST request', async () => {
    const req = makeReq({method: 'GET'});
    const res = makeRes();
    await refreshAnalyticsHistory(req, res);
    expect(res.status).toHaveBeenCalledWith(405);
  });

  it('rejects a request without the correct admin secret', async () => {
    const req = makeReq({headers: {'x-admin-secret': 'wrong'}});
    const res = makeRes();
    await refreshAnalyticsHistory(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('runs the same weekly export as the Monday schedule and returns the resulting weekStart', async () => {
    mockQuerySnapshot.empty = false;
    mockQuerySnapshot.docs = [{data: () => ({totalUsersAllTime: 500})}];
    mockFetchWithTimeout.mockResolvedValue(ga4Response([])); // all 13 reports, same empty shape
    const req = makeReq({headers: {'x-admin-secret': 'test-admin-secret'}});
    const res = makeRes();

    await refreshAnalyticsHistory(req, res);

    expect(mockDocRef.set).toHaveBeenCalledWith(expect.objectContaining({totalUsersAllTime: 500}));
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ok: true, weekStart: '2026-08-11'});
  });

  it('returns 500 and logs an alerting error if the underlying export fails outright', async () => {
    mockQuerySnapshot.empty = true;
    mockFetchWithTimeout.mockRejectedValue(new Error('network down'));
    const req = makeReq({headers: {'x-admin-secret': 'test-admin-secret'}});
    const res = makeRes();

    await refreshAnalyticsHistory(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
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
