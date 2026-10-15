process.env.GITHUB_TOKEN = 'test-github-token';

const mockLogError = jest.fn(() => Promise.resolve());
const mockFetchWithTimeout = jest.fn(() => Promise.resolve({status: 204}));
jest.mock('../../functions/shared', () => ({
  logError: mockLogError,
  fetchWithTimeout: (...args) => mockFetchWithTimeout(...args),
}));

const {triggerNewsScrapeBusy, triggerNewsScrapeOvernight} = require('../../functions/newsDispatch');

// The retry delay (3s) uses a real setTimeout - fake timers so these run
// instantly, same reason resultsDispatch.test.js's own retry tests do this.
// A :03 tick, which dispatches whether or not hourly-only mode is on.
const ON_THE_HOUR = {scheduleTime: '2026-10-20T09:03:00Z'};

async function runWithFakeTimers(fn) {
  jest.useFakeTimers();
  const done = fn.run(ON_THE_HOUR);
  await jest.advanceTimersByTimeAsync(3000);
  await done;
  jest.useRealTimers();
}

describe('triggerNewsScrapeBusy', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchWithTimeout.mockResolvedValue({status: 204});
  });

  it('dispatches scrape-news.yml', async () => {
    await triggerNewsScrapeBusy.run(ON_THE_HOUR);

    expect(mockFetchWithTimeout).toHaveBeenCalledTimes(1);
    expect(mockFetchWithTimeout).toHaveBeenCalledWith(
      'https://api.github.com/repos/yacobwood/BTCC/actions/workflows/scrape-news.yml/dispatches',
      expect.any(Number),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({Authorization: 'Bearer test-github-token'}),
        body: JSON.stringify({ref: 'main'}),
      }),
    );
    expect(mockLogError).not.toHaveBeenCalled();
  });

  it('retries once and succeeds without alerting when only the first attempt fails', async () => {
    mockFetchWithTimeout.mockResolvedValueOnce({status: 500, text: () => Promise.resolve('server blip')});
    await runWithFakeTimers(triggerNewsScrapeBusy);

    expect(mockFetchWithTimeout).toHaveBeenCalledTimes(2);
    expect(mockLogError).not.toHaveBeenCalled();
  });

  it('logs an error rather than throwing when GitHub rejects the dispatch on both attempts', async () => {
    mockFetchWithTimeout.mockResolvedValue({status: 401, text: () => Promise.resolve('Bad credentials')});
    await runWithFakeTimers(triggerNewsScrapeBusy);

    expect(mockFetchWithTimeout).toHaveBeenCalledTimes(2);
    expect(mockLogError).toHaveBeenCalledTimes(1);
    expect(mockLogError).toHaveBeenCalledWith(
      'triggerNewsScrapeBusy',
      expect.stringContaining('401'),
      expect.anything(),
      expect.objectContaining({key: 'triggerNewsScrapeBusy', alert: true}),
    );
  });
});

describe('triggerNewsScrapeOvernight', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchWithTimeout.mockResolvedValue({status: 204});
  });

  it('dispatches scrape-news.yml too, keyed under its own function name on failure', async () => {
    await triggerNewsScrapeOvernight.run(ON_THE_HOUR);
    expect(mockFetchWithTimeout).toHaveBeenCalledTimes(1);

    mockFetchWithTimeout.mockResolvedValue({status: 401, text: () => Promise.resolve('Bad credentials')});
    await runWithFakeTimers(triggerNewsScrapeOvernight);

    expect(mockLogError).toHaveBeenCalledWith(
      'triggerNewsScrapeOvernight',
      expect.stringContaining('401'),
      expect.anything(),
      expect.objectContaining({key: 'triggerNewsScrapeOvernight', alert: true}),
    );
  });
});

// Cadence is the Scrapfly bill (each run is a paid fetch) - pinned so a
// change to it is deliberate. 2026-10-15: busy window slowed 5 -> 10 min
// after the October subscription ran out on the 15th.
describe('news scrape schedules', () => {
  it('runs every 10 minutes 07:00-20:00 UTC', () => {
    expect(triggerNewsScrapeBusy.__endpoint.scheduleTrigger.schedule).toBe('3-59/10 7-19 * * *');
  });

  it('runs hourly overnight', () => {
    expect(triggerNewsScrapeOvernight.__endpoint.scheduleTrigger.schedule).toBe('3 0-6,20-23 * * *');
  });
});

// 2026-10-15: hourly-only for the rest of October while Scrapfly bills
// pay-as-you-go, reverting to every 10 minutes on 1 Nov without a deploy.
describe('triggerNewsScrapeBusy hourly-only mode', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchWithTimeout.mockResolvedValue({status: 204});
  });

  it('dispatches the :03 tick in October', async () => {
    await triggerNewsScrapeBusy.run({scheduleTime: '2026-10-20T14:03:00Z'});
    expect(mockFetchWithTimeout).toHaveBeenCalledTimes(1);
  });

  it('skips the other ticks in October', async () => {
    for (const minute of ['13', '23', '33', '43', '53']) {
      await triggerNewsScrapeBusy.run({scheduleTime: `2026-10-31T19:${minute}:00Z`});
    }
    expect(mockFetchWithTimeout).not.toHaveBeenCalled();
    expect(mockLogError).not.toHaveBeenCalled();
  });

  it('dispatches every tick again from 1 Nov', async () => {
    await triggerNewsScrapeBusy.run({scheduleTime: '2026-11-01T07:13:00Z'});
    await triggerNewsScrapeBusy.run({scheduleTime: '2026-11-01T07:53:00Z'});
    expect(mockFetchWithTimeout).toHaveBeenCalledTimes(2);
  });
});
