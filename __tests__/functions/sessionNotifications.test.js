// Smoke-level coverage only, per explicit decision when scoping the
// full-coverage effort - this is the widest-surface function in the app
// (calendar-gated session/preview/standings alerts, news, hub news and
// podcast checks, each independently try/caught) with heavy UK-timezone
// branch logic. Not chasing every session-window/weekday permutation here -
// checking the calendar gate actually gates, the hub-news and podcast paths
// reach messaging.send with roughly the right shape, and failures in one
// section are isolated and logged rather than thrown.
const {makeFirestoreMock, makeDatabaseMock, makeMessagingMock} = require('./testHelpers');

const {db: mockFirestoreDb, docRef: mockDocRef, transactionCtx: mockTx} = makeFirestoreMock();
jest.mock('firebase-admin/firestore', () => ({
  getFirestore: jest.fn(() => mockFirestoreDb),
}), {virtual: true});

const mockMessaging = makeMessagingMock();
jest.mock('firebase-admin/messaging', () => ({
  getMessaging: jest.fn(() => mockMessaging),
}), {virtual: true});

const mockLogError = jest.fn(() => Promise.resolve());
const mockLogPushHistory = jest.fn(() => Promise.resolve());
const mockFetchWithTimeout = jest.fn();
jest.mock('../../functions/shared', () => ({
  logError: mockLogError,
  logPushHistory: mockLogPushHistory,
  fetchWithTimeout: (...args) => mockFetchWithTimeout(...args),
  CALENDAR_URL: 'https://example.com/calendar.json',
  SCHEDULE_URL: 'https://example.com/schedule.json',
  HUB_NEWS_URL: 'https://example.com/hub_news.json',
  PODCAST_RSS_URL: 'https://example.com/podcast.rss',
  SESSION_TOPICS: {'Race 1': 'pre_race1'},
  SESSION_CHANNELS: {'Race 1': 'race'},
  sessionToUTC: jest.fn(() => new Date('2026-08-19T12:00:00Z')),
  // A weekday with none of the Friday/Tuesday/race-day gates active by
  // default, so most tests never even reach the schedule fetch.
  getUKTimeParts: jest.fn(() => ({weekday: 'Wednesday', hour: 12, minute: 0})),
  getUKDateString: jest.fn(() => '2026-08-19'),
}));

const mockCheckBtccNews = jest.fn(() => Promise.resolve());
jest.mock('../../functions/newsCheck', () => ({
  checkBtccNews: (...args) => mockCheckBtccNews(...args),
}));

const {sendSessionNotifications} = require('../../functions/sessionNotifications');

function emptyJsonResponse(body = {}) {
  return Promise.resolve({json: () => Promise.resolve(body)});
}

describe('sendSessionNotifications', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchWithTimeout.mockImplementation((url) => {
      if (url.includes('calendar.json')) return emptyJsonResponse({rounds: []});
      if (url.includes('hub_news.json')) return emptyJsonResponse({posts: []});
      if (url.includes('podcast.rss')) return Promise.resolve({text: () => Promise.resolve('')});
      return emptyJsonResponse({});
    });
  });

  it('never fetches the session schedule when it is not a race day, Friday-before or Tuesday-after', async () => {
    await sendSessionNotifications.run();
    expect(mockFetchWithTimeout).not.toHaveBeenCalledWith(expect.stringContaining('schedule.json'));
  });

  it('delegates the news check to checkBtccNews with the expected dependencies', async () => {
    await sendSessionNotifications.run();
    expect(mockCheckBtccNews).toHaveBeenCalledWith(expect.objectContaining({
      messaging: mockMessaging,
      db: mockFirestoreDb,
    }));
  });

  it('sends a hub news push and clears pendingSend when a genuinely new hub post appears', async () => {
    mockFetchWithTimeout.mockImplementation((url) => {
      if (url.includes('hub_news.json')) {
        return emptyJsonResponse({posts: [
          {id: 'new-post-1', title: 'Ingram wins', category: 'News', status: 'published', pubDate: new Date().toISOString()},
        ]});
      }
      if (url.includes('calendar.json')) return emptyJsonResponse({rounds: []});
      return Promise.resolve({text: () => Promise.resolve('')});
    });
    mockTx.get.mockResolvedValueOnce({exists: true, data: () => ({lastId: 'old-post-0', pendingSend: null})});

    await sendSessionNotifications.run();

    expect(mockMessaging.send).toHaveBeenCalledWith(expect.objectContaining({
      topic: 'news_alerts',
      data: expect.objectContaining({type: 'hub', id: 'new-post-1'}),
    }));
    expect(mockDocRef.update).toHaveBeenCalledWith({pendingSend: null});
  });

  it('does not notify the very first time a hub post is ever seen (no prior lastId)', async () => {
    mockFetchWithTimeout.mockImplementation((url) => {
      if (url.includes('hub_news.json')) {
        return emptyJsonResponse({posts: [{id: 'post-1', title: 'X', pubDate: new Date().toISOString()}]});
      }
      if (url.includes('calendar.json')) return emptyJsonResponse({rounds: []});
      return Promise.resolve({text: () => Promise.resolve('')});
    });
    mockTx.get.mockResolvedValueOnce({exists: false, data: () => ({})});

    await sendSessionNotifications.run();

    expect(mockMessaging.send).not.toHaveBeenCalledWith(expect.objectContaining({topic: 'news_alerts'}));
  });

  it('sends a podcast push when a genuinely new episode GUID appears', async () => {
    const rss = `<rss><channel><item><title><![CDATA[New Episode]]></title><guid>guid-2</guid></item></channel></rss>`;
    mockFetchWithTimeout.mockImplementation((url) => {
      if (url.includes('podcast.rss')) return Promise.resolve({text: () => Promise.resolve(rss)});
      if (url.includes('calendar.json')) return emptyJsonResponse({rounds: []});
      if (url.includes('hub_news.json')) return emptyJsonResponse({posts: []});
      return emptyJsonResponse({});
    });
    mockTx.get.mockResolvedValueOnce({exists: true, data: () => ({lastGuid: 'guid-1', pendingSend: null})});

    await sendSessionNotifications.run();

    expect(mockMessaging.send).toHaveBeenCalledWith(expect.objectContaining({topic: 'podcast_alerts'}));
  });

  it('isolates a calendar-check failure - logs it and still runs the other sections', async () => {
    mockFetchWithTimeout.mockImplementation((url) => {
      if (url.includes('calendar.json')) return Promise.reject(new Error('calendar down'));
      if (url.includes('hub_news.json')) return emptyJsonResponse({posts: []});
      return Promise.resolve({text: () => Promise.resolve('')});
    });

    await expect(sendSessionNotifications.run()).resolves.toBeUndefined();

    expect(mockLogError).toHaveBeenCalledWith('sendSessionNotifications', 'calendar down', expect.anything(), {key: 'check-calendar', alert: true});
    // The independent hub-news/podcast sections still ran despite the calendar failure
    expect(mockFetchWithTimeout).toHaveBeenCalledWith(expect.stringContaining('hub_news.json'));
  });

  it('logs a hub-news send failure without throwing (caught inside the hub-news try block, not the FCM batch path)', async () => {
    mockFetchWithTimeout.mockImplementation((url) => {
      if (url.includes('hub_news.json')) {
        return emptyJsonResponse({posts: [
          {id: 'new-post-1', title: 'Ingram wins', category: 'News', status: 'published', pubDate: new Date().toISOString()},
        ]});
      }
      if (url.includes('calendar.json')) return emptyJsonResponse({rounds: []});
      return Promise.resolve({text: () => Promise.resolve('')});
    });
    mockTx.get.mockResolvedValueOnce({exists: true, data: () => ({lastId: 'old-post-0', pendingSend: null})});
    mockMessaging.send.mockRejectedValueOnce(new Error('fcm rejected'));

    await expect(sendSessionNotifications.run()).resolves.toBeUndefined();
    expect(mockLogError).toHaveBeenCalledWith('sendSessionNotifications', 'fcm rejected', expect.anything(), {key: 'check-hub', alert: true});
  });
});
