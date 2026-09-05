// computeResultsHash is used by scraperAdmin.js's notifyResultsUpdate to
// dedupe the visible "A fresh result just dropped" push - see that file's
// own tests for the end-to-end dedup behavior. This file tests the hash
// function in isolation: specifically, that it ignores standings.json's
// spurious `updated` re-stamp (tools/scraper/scrape_tsl.py:1332) while still
// reacting to a genuine content change.

const mockFetchWithTimeout = jest.fn();
jest.mock('../../functions/shared', () => ({
  fetchWithTimeout: mockFetchWithTimeout,
}));

const {computeResultsHash} = require('../../functions/resultsHash');

function mockResponses(results, standings) {
  mockFetchWithTimeout
    .mockImplementationOnce(() => Promise.resolve({ok: true, json: () => Promise.resolve(results)}))
    .mockImplementationOnce(() => Promise.resolve({ok: true, json: () => Promise.resolve(standings)}));
}

describe('computeResultsHash', () => {
  beforeEach(() => jest.clearAllMocks());

  it('produces the same hash when only standings.json\'s `updated` timestamp changes', async () => {
    mockResponses({rounds: [{round: 8}]}, {standings: [{driver: 'A', points: 100}], updated: '2026-09-05T09:00:00Z'});
    const hash1 = await computeResultsHash('2026');

    mockResponses({rounds: [{round: 8}]}, {standings: [{driver: 'A', points: 100}], updated: '2026-09-05T09:02:00Z'});
    const hash2 = await computeResultsHash('2026');

    expect(hash1).toBe(hash2);
  });

  it('produces a different hash when the standings content genuinely changes', async () => {
    mockResponses({rounds: [{round: 8}]}, {standings: [{driver: 'A', points: 100}], updated: '2026-09-05T09:00:00Z'});
    const hash1 = await computeResultsHash('2026');

    mockResponses({rounds: [{round: 8}]}, {standings: [{driver: 'A', points: 125}], updated: '2026-09-05T09:00:00Z'});
    const hash2 = await computeResultsHash('2026');

    expect(hash1).not.toBe(hash2);
  });

  it('produces a different hash when the results content genuinely changes', async () => {
    mockResponses({rounds: [{round: 8}]}, {standings: [{driver: 'A', points: 100}], updated: '2026-09-05T09:00:00Z'});
    const hash1 = await computeResultsHash('2026');

    mockResponses({rounds: [{round: 8, results: [{pos: 1, driver: 'A'}]}]}, {standings: [{driver: 'A', points: 100}], updated: '2026-09-05T09:00:00Z'});
    const hash2 = await computeResultsHash('2026');

    expect(hash1).not.toBe(hash2);
  });

  it('treats a failed fetch as null content rather than throwing', async () => {
    mockFetchWithTimeout
      .mockImplementationOnce(() => Promise.resolve({ok: false}))
      .mockImplementationOnce(() => Promise.resolve({ok: false}));
    await expect(computeResultsHash('2026')).resolves.toEqual(expect.any(String));
  });

  it('requests the year-specific results file and the shared standings file', async () => {
    mockResponses({rounds: []}, {standings: []});
    await computeResultsHash('2026');
    expect(mockFetchWithTimeout).toHaveBeenCalledWith(expect.stringContaining('results2026.json'));
    expect(mockFetchWithTimeout).toHaveBeenCalledWith(expect.stringContaining('standings.json'));
  });
});
