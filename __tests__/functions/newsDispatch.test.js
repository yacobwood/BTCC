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
async function runWithFakeTimers(fn) {
  jest.useFakeTimers();
  const done = fn.run();
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
    await triggerNewsScrapeBusy.run();

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
    await triggerNewsScrapeOvernight.run();
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
