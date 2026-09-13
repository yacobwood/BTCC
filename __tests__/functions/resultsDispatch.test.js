process.env.GITHUB_TOKEN = 'test-github-token';

const mockLogError = jest.fn(() => Promise.resolve());
const mockFetchWithTimeout = jest.fn(() => Promise.resolve({status: 204}));
jest.mock('../../functions/shared', () => ({
  logError: mockLogError,
  fetchWithTimeout: (...args) => mockFetchWithTimeout(...args),
}));

const {triggerResultsScrape} = require('../../functions/resultsDispatch');

// The retry delay (3s) uses a real setTimeout - fake timers so these run
// instantly instead of burning 3 real seconds per retry test, same reason
// scrapfly_fallback's own retry tests patch time.sleep module-wide (#36).
async function runWithFakeTimers() {
  jest.useFakeTimers();
  const done = triggerResultsScrape.run();
  await jest.advanceTimersByTimeAsync(3000);
  await done;
  jest.useRealTimers();
}

describe('triggerResultsScrape', () => {
  beforeEach(() => jest.clearAllMocks());

  it('dispatches scrape-results.yml with the current year and no round', async () => {
    await triggerResultsScrape.run();

    expect(mockFetchWithTimeout).toHaveBeenCalledTimes(1);
    expect(mockFetchWithTimeout).toHaveBeenCalledWith(
      'https://api.github.com/repos/yacobwood/BTCC/actions/workflows/scrape-results.yml/dispatches',
      expect.any(Number),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({Authorization: 'Bearer test-github-token'}),
        body: JSON.stringify({ref: 'main', inputs: {year: String(new Date().getFullYear())}}),
      }),
    );
    expect(mockLogError).not.toHaveBeenCalled();
  });

  it('retries once and succeeds without alerting when only the first attempt fails', async () => {
    mockFetchWithTimeout.mockResolvedValueOnce({status: 500, text: () => Promise.resolve('server blip')});
    await runWithFakeTimers();

    expect(mockFetchWithTimeout).toHaveBeenCalledTimes(2);
    expect(mockLogError).not.toHaveBeenCalled();
  });

  it('retries once and succeeds without alerting when the first attempt rejects outright', async () => {
    mockFetchWithTimeout.mockRejectedValueOnce(new Error('network down'));
    await runWithFakeTimers();

    expect(mockFetchWithTimeout).toHaveBeenCalledTimes(2);
    expect(mockLogError).not.toHaveBeenCalled();
  });

  it('logs an error rather than throwing when GitHub rejects the dispatch on both attempts', async () => {
    mockFetchWithTimeout.mockResolvedValue({status: 401, text: () => Promise.resolve('Bad credentials')});
    await runWithFakeTimers();

    expect(mockFetchWithTimeout).toHaveBeenCalledTimes(2);
    expect(mockLogError).toHaveBeenCalledTimes(1);
    expect(mockLogError).toHaveBeenCalledWith(
      'triggerResultsScrape',
      expect.stringContaining('401'),
      expect.anything(),
      expect.objectContaining({key: 'triggerResultsScrape', alert: true}),
    );
  });

  it('logs an error rather than throwing when the fetch itself rejects on both attempts', async () => {
    mockFetchWithTimeout.mockRejectedValue(new Error('network down'));
    await runWithFakeTimers();

    expect(mockFetchWithTimeout).toHaveBeenCalledTimes(2);
    expect(mockLogError).toHaveBeenCalledTimes(1);
    expect(mockLogError).toHaveBeenCalledWith(
      'triggerResultsScrape',
      'network down',
      expect.anything(),
      expect.objectContaining({key: 'triggerResultsScrape', alert: true}),
    );
  });
});
