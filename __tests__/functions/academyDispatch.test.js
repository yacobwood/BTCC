process.env.GITHUB_TOKEN = 'test-github-token';

const mockLogError = jest.fn(() => Promise.resolve());
const mockFetchWithTimeout = jest.fn(() => Promise.resolve({status: 204}));
jest.mock('../../functions/shared', () => ({
  logError: mockLogError,
  fetchWithTimeout: (...args) => mockFetchWithTimeout(...args),
}));

const {triggerAcademyAutoPublish} = require('../../functions/academyDispatch');

async function runWithFakeTimers() {
  jest.useFakeTimers();
  const done = triggerAcademyAutoPublish.run();
  await jest.advanceTimersByTimeAsync(3000);
  await done;
  jest.useRealTimers();
}

describe('triggerAcademyAutoPublish', () => {
  beforeEach(() => jest.clearAllMocks());

  it('dispatches publish-scheduled-explainers.yml on main without force', async () => {
    await triggerAcademyAutoPublish.run();

    expect(mockFetchWithTimeout).toHaveBeenCalledTimes(1);
    expect(mockFetchWithTimeout).toHaveBeenCalledWith(
      'https://api.github.com/repos/yacobwood/BTCC/actions/workflows/publish-scheduled-explainers.yml/dispatches',
      expect.any(Number),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({Authorization: 'Bearer test-github-token'}),
        body: JSON.stringify({ref: 'main'}),
      }),
    );
    expect(mockLogError).not.toHaveBeenCalled();
  });

  it('retries once without alerting when only the first attempt fails', async () => {
    mockFetchWithTimeout.mockResolvedValueOnce({status: 500, text: () => Promise.resolve('blip')});
    await runWithFakeTimers();

    expect(mockFetchWithTimeout).toHaveBeenCalledTimes(2);
    expect(mockLogError).not.toHaveBeenCalled();
  });

  it('alerts once when both attempts fail, without throwing', async () => {
    mockFetchWithTimeout.mockResolvedValue({status: 401, text: () => Promise.resolve('Bad credentials')});
    await runWithFakeTimers();

    expect(mockFetchWithTimeout).toHaveBeenCalledTimes(2);
    expect(mockLogError).toHaveBeenCalledWith(
      'triggerAcademyAutoPublish',
      expect.stringContaining('401'),
      expect.anything(),
      expect.objectContaining({key: 'triggerAcademyAutoPublish', alert: true}),
    );
  });
});
