process.env.GITHUB_TOKEN = 'test-github-token';

jest.mock('firebase-admin/firestore', () => ({getFirestore: jest.fn()}), {virtual: true});

const mockLogError = jest.fn(() => Promise.resolve());
const mockFetchWithTimeout = jest.fn(() => Promise.resolve({status: 204}));
jest.mock('../../functions/shared', () => {
  const actual = jest.requireActual('../../functions/shared');
  return {
    ...actual,
    logError: (...args) => mockLogError(...args),
    fetchWithTimeout: (...args) => mockFetchWithTimeout(...args),
  };
});

const {findSessionsToStart, startDueWatchers, DISPATCH_WINDOW_MS} = require('../../functions/watcherDispatch');

// Round 10 (Brands Hatch GP) as it really is in data/calendar.json - BST, so
// UK clock time is UTC+1.
const CALENDAR = {
  rounds: [{
    round: 10,
    startDate: '2026-10-10',
    endDate: '2026-10-11',
    sessions: [
      {name: 'Free Practice', day: 'SAT', time: '10:10'},
      {name: 'Qualifying', day: 'SAT', time: '13:50'},
      {name: 'Qualifying Race', day: 'SAT', time: '14:50'},
      {name: 'Race 1', day: 'SUN', time: '11:25'},
      {name: 'Race 2', day: 'SUN', time: '14:35'},
      {name: 'Race 3', day: 'SUN', time: '17:15'},
    ],
  }],
};

// In-memory Firestore doc with a working runTransaction.
function makeDb() {
  let data = null;
  const merge = (a, b) => {
    const out = {...a};
    for (const [k, v] of Object.entries(b)) {
      out[k] = v && typeof v === 'object' && !Array.isArray(v) ? merge(a?.[k] || {}, v) : v;
    }
    return out;
  };
  const ref = {
    set: jest.fn(async (v, opts) => { data = opts?.merge ? merge(data || {}, v) : v; }),
  };
  const snap = () => ({exists: data !== null, data: () => data});
  return {
    collection: () => ({doc: () => ref}),
    runTransaction: async fn => fn({get: async () => snap(), set: (r, v, opts) => r.set(v, opts)}),
    _ref: ref,
    _data: () => data,
  };
}

const fetchCalendar = () => Promise.resolve({json: () => Promise.resolve(CALENDAR)});

describe('findSessionsToStart', () => {
  it('starts Sunday Race 1 at its start time (11:25 BST = 10:25 UTC)', () => {
    const due = findSessionsToStart(CALENDAR, new Date('2026-10-11T10:25:00Z'));
    expect(due.map(s => s.label)).toEqual(['Race 1']);
    expect(due[0]).toMatchObject({round: 10, day: 'sunday', key: '2026-10-11 R10 Race 1'});
  });

  it('starts nothing one minute before the session', () => {
    expect(findSessionsToStart(CALENDAR, new Date('2026-10-11T10:24:00Z'))).toEqual([]);
  });

  it('keeps the session due for the whole dispatch window (so failed ticks retry), then stops', () => {
    const start = new Date('2026-10-11T10:25:00Z').getTime();
    expect(findSessionsToStart(CALENDAR, new Date(start + DISPATCH_WINDOW_MS - 1000))).toHaveLength(1);
    expect(findSessionsToStart(CALENDAR, new Date(start + DISPATCH_WINDOW_MS))).toEqual([]);
  });

  it('starts Saturday sessions as saturday runs and ignores the other day', () => {
    const due = findSessionsToStart(CALENDAR, new Date('2026-10-10T09:10:00Z'));
    expect(due.map(s => [s.label, s.day])).toEqual([['Free Practice', 'saturday']]);
  });

  it('starts nothing on a non-race day', () => {
    expect(findSessionsToStart(CALENDAR, new Date('2026-10-12T10:25:00Z'))).toEqual([]);
  });

  it('dispatch window is shorter than any BTCC session, so a run never starts after its session ended', () => {
    expect(DISPATCH_WINDOW_MS).toBeLessThan(20 * 60 * 1000);
  });
});

describe('startDueWatchers', () => {
  beforeEach(() => jest.clearAllMocks());
  const now = new Date('2026-10-11T10:25:30Z');

  it('dispatches session-watcher.yml for exactly that session', async () => {
    const db = makeDb();
    await startDueWatchers({fetchFn: fetchCalendar, db, now});

    expect(mockFetchWithTimeout).toHaveBeenCalledWith(
      'https://api.github.com/repos/yacobwood/BTCC/actions/workflows/session-watcher.yml/dispatches',
      expect.any(Number),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({Authorization: 'Bearer test-github-token'}),
        body: JSON.stringify({ref: 'main', inputs: {round: '10', day: 'sunday', year: '2026', session: 'Race 1'}}),
      }),
    );
    expect(db._data().dispatched['2026-10-11 R10 Race 1'].sentAt).toEqual(expect.any(String));
  });

  it('never dispatches the same session twice (a second watcher would double every push)', async () => {
    const db = makeDb();
    await startDueWatchers({fetchFn: fetchCalendar, db, now});
    await startDueWatchers({fetchFn: fetchCalendar, db, now: new Date(now.getTime() + 60000)});
    expect(mockFetchWithTimeout).toHaveBeenCalledTimes(1);
  });

  it('skips a session another tick claimed moments ago', async () => {
    const db = makeDb();
    await db._ref.set({dispatched: {'2026-10-11 R10 Race 1': {claimedAt: now.getTime() - 30000}}});
    await startDueWatchers({fetchFn: fetchCalendar, db, now});
    expect(mockFetchWithTimeout).not.toHaveBeenCalled();
  });

  it('releases the claim on failure so the next tick retries, without alerting early', async () => {
    jest.useFakeTimers();
    mockFetchWithTimeout.mockResolvedValue({status: 500, text: () => Promise.resolve('boom')});
    const db = makeDb();
    const done = startDueWatchers({fetchFn: fetchCalendar, db, now});
    await jest.advanceTimersByTimeAsync(3000);
    await done;
    jest.useRealTimers();
    mockFetchWithTimeout.mockResolvedValue({status: 204});

    expect(db._data().dispatched['2026-10-11 R10 Race 1']).toEqual({claimedAt: 0});
    expect(mockLogError).not.toHaveBeenCalled();

    await startDueWatchers({fetchFn: fetchCalendar, db, now: new Date(now.getTime() + 60000)});
    expect(db._data().dispatched['2026-10-11 R10 Race 1'].sentAt).toEqual(expect.any(String));
  });

  it('alerts when the window is about to close with no watcher started', async () => {
    jest.useFakeTimers();
    mockFetchWithTimeout.mockResolvedValue({status: 500, text: () => Promise.resolve('boom')});
    const late = new Date(new Date('2026-10-11T10:25:00Z').getTime() + DISPATCH_WINDOW_MS - 30000);
    const done = startDueWatchers({fetchFn: fetchCalendar, db: makeDb(), now: late});
    await jest.advanceTimersByTimeAsync(3000);
    await done;
    jest.useRealTimers();
    mockFetchWithTimeout.mockResolvedValue({status: 204});

    expect(mockLogError).toHaveBeenCalledWith(
      'startSessionWatchers',
      expect.stringContaining('2026-10-11 R10 Race 1'),
      expect.any(Error),
      expect.objectContaining({alert: true}),
    );
  });
});
