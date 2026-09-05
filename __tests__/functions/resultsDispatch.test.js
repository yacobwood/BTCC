process.env.GITHUB_TOKEN = 'test-github-token';

const mockLogError = jest.fn(() => Promise.resolve());
const mockFetchWithTimeout = jest.fn(() => Promise.resolve({status: 204}));
jest.mock('../../functions/shared', () => ({
  logError: mockLogError,
  fetchWithTimeout: (...args) => mockFetchWithTimeout(...args),
}));

const {triggerResultsScrape} = require('../../functions/resultsDispatch');

describe('triggerResultsScrape', () => {
  beforeEach(() => jest.clearAllMocks());

  it('dispatches scrape-results.yml with the current year and no round', async () => {
    await triggerResultsScrape.run();

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

  it('logs an error rather than throwing when GitHub rejects the dispatch', async () => {
    mockFetchWithTimeout.mockResolvedValueOnce({status: 401, text: () => Promise.resolve('Bad credentials')});
    await expect(triggerResultsScrape.run()).resolves.toBeUndefined();
    expect(mockLogError).toHaveBeenCalledWith(
      'triggerResultsScrape',
      expect.stringContaining('401'),
      expect.anything(),
      expect.objectContaining({alert: true}),
    );
  });

  it('logs an error rather than throwing when the fetch itself rejects', async () => {
    mockFetchWithTimeout.mockRejectedValueOnce(new Error('network down'));
    await expect(triggerResultsScrape.run()).resolves.toBeUndefined();
    expect(mockLogError).toHaveBeenCalledWith('triggerResultsScrape', 'network down', expect.anything(), expect.objectContaining({alert: true}));
  });
});
