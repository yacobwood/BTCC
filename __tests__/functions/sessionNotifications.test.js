// Smoke-level coverage only, per explicit decision when scoping the
// full-coverage effort - this is the widest-surface function in the app
// (calendar-gated session/preview/standings alerts, news and podcast
// checks, each independently try/caught) with heavy UK-timezone
// branch logic. Not chasing every session-window/weekday permutation here -
// checking the calendar gate actually gates, the podcast path
// reaches messaging.send with roughly the right shape, and failures in one
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
  // Real implementation, not a mock - it's pure text transform, and the
  // podcast-title tests below need it to actually decode entities.
  decodeEntities: jest.requireActual('../../functions/shared').decodeEntities,
  logError: mockLogError,
  logPushHistory: mockLogPushHistory,
  fetchWithTimeout: (...args) => mockFetchWithTimeout(...args),
  // Mirrors functions/shared.js's sendAndLog: send, then record the outcome.
  sendAndLog: async (messaging, message, {title, body = '', channel, ...meta}) => {
    const messageId = await messaging.send(message);
    await mockLogPushHistory(title, body, channel, {target: message.condition, messageId, ...meta});
    return messageId;
  },
  CALENDAR_URL: 'https://example.com/calendar.json',
  SCHEDULE_URL: 'https://example.com/schedule.json',
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

  // Hub posts are notified only by the admin panel's publish actions
  // (send-broadcast-notif.yml). This poll used to notify them too, which
  // double-sent every admin-published hub post (2026-10-09, Chilton
  // retirement article: broadcast at 17:06, poll at 17:11 once the raw CDN
  // cache expired).
  it('never fetches hub_news.json or sends a hub push, even for a brand-new published hub post', async () => {
    mockTx.get.mockResolvedValue({exists: true, data: () => ({lastId: 'old-post-0', pendingSend: null})});

    await sendSessionNotifications.run();

    expect(mockFetchWithTimeout).not.toHaveBeenCalledWith(expect.stringContaining('hub_news.json'));
    expect(mockMessaging.send).not.toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({type: 'hub'}),
    }));
    mockTx.get.mockReset();
  });

  it('sends a podcast push when a genuinely new episode GUID appears', async () => {
    const rss = `<rss><channel><item><title><![CDATA[New Episode]]></title><guid>guid-2</guid></item></channel></rss>`;
    mockFetchWithTimeout.mockImplementation((url) => {
      if (url.includes('podcast.rss')) return Promise.resolve({text: () => Promise.resolve(rss)});
      if (url.includes('calendar.json')) return emptyJsonResponse({rounds: []});
      return emptyJsonResponse({});
    });
    mockTx.get.mockResolvedValueOnce({exists: true, data: () => ({lastGuid: 'guid-1', pendingSend: null})});

    await sendSessionNotifications.run();

    expect(mockMessaging.send).toHaveBeenCalledWith(expect.objectContaining({condition: "'podcast_alerts' in topics && !('spoiler_free' in topics) && 'results_teaser' in topics"}));
  });

  it('decodes HTML entities in a plain (non-CDATA) podcast title before sending', async () => {
    const rss = `<rss><channel><item><title>Tom Ingram &amp; Mikey Doble Join the BTCC Podcast</title><guid>guid-2</guid></item></channel></rss>`;
    mockFetchWithTimeout.mockImplementation((url) => {
      if (url.includes('podcast.rss')) return Promise.resolve({text: () => Promise.resolve(rss)});
      if (url.includes('calendar.json')) return emptyJsonResponse({rounds: []});
      return emptyJsonResponse({});
    });
    mockTx.get.mockResolvedValueOnce({exists: true, data: () => ({lastGuid: 'guid-1', pendingSend: null})});

    await sendSessionNotifications.run();

    expect(mockMessaging.send).toHaveBeenCalledWith(expect.objectContaining({
      condition: "'podcast_alerts' in topics && !('spoiler_free' in topics) && 'results_teaser' in topics",
      data: expect.objectContaining({title: 'Tom Ingram & Mikey Doble Join the BTCC Podcast'}),
    }));
  });

  it('isolates a calendar-check failure - logs it and still runs the other sections', async () => {
    mockFetchWithTimeout.mockImplementation((url) => {
      if (url.includes('calendar.json')) return Promise.reject(new Error('calendar down'));
      return Promise.resolve({text: () => Promise.resolve('')});
    });

    await expect(sendSessionNotifications.run()).resolves.toBeUndefined();

    expect(mockLogError).toHaveBeenCalledWith('sendSessionNotifications', 'calendar down', expect.anything(), {key: 'check-calendar', alert: true});
    // The independent podcast section still ran despite the calendar failure
    expect(mockFetchWithTimeout).toHaveBeenCalledWith(expect.stringContaining('podcast.rss'));
  });
});
