// computeSessionFingerprints/findChangedSession are used by scraperAdmin.js's
// notifyResultsUpdate to identify exactly which (round, session) most
// recently changed, so the visible "A fresh result just dropped" push can
// deep-link straight to it - see that file's own tests for the end-to-end
// dedup + deep-link behavior. This file tests the fingerprinting/diffing
// logic in isolation: specifically, that it ignores standings.json's
// spurious `updated` re-stamp (tools/scraper/scrape_tsl.py:1332 - never
// part of the fingerprint at all, since it's computed purely from
// results{year}.json) while still reacting to a genuine session change, and
// that it correctly identifies *which* session changed.

const mockFetchWithTimeout = jest.fn();
jest.mock('../../functions/shared', () => ({
  fetchWithTimeout: mockFetchWithTimeout,
}));

const {fetchResultsAndStandings, computeSessionFingerprints, findChangedSession} = require('../../functions/resultsHash');

function race(label, results = [], grid = null) {
  return {label, results, grid};
}

function resultsFile(rounds) {
  return {season: '2026', rounds};
}

describe('fetchResultsAndStandings', () => {
  beforeEach(() => jest.clearAllMocks());

  it('requests the year-specific results file and the shared standings file', async () => {
    mockFetchWithTimeout
      .mockResolvedValueOnce({ok: true, json: () => Promise.resolve({rounds: []})})
      .mockResolvedValueOnce({ok: true, json: () => Promise.resolve({standings: []})});
    await fetchResultsAndStandings('2026');
    expect(mockFetchWithTimeout).toHaveBeenCalledWith(expect.stringContaining('results2026.json'));
    expect(mockFetchWithTimeout).toHaveBeenCalledWith(expect.stringContaining('standings.json'));
  });

  it('treats a failed fetch as null content rather than throwing', async () => {
    mockFetchWithTimeout.mockResolvedValueOnce({ok: false}).mockResolvedValueOnce({ok: false});
    await expect(fetchResultsAndStandings('2026')).resolves.toEqual({results: null, standings: null});
  });
});

describe('computeSessionFingerprints', () => {
  it('produces the same fingerprint when nothing about the session changed', () => {
    const results = resultsFile([{round: 8, races: [race('Qualifying', [{pos: 1, driver: 'A'}])]}]);
    expect(computeSessionFingerprints(results)).toEqual(computeSessionFingerprints(results));
  });

  it('is keyed by round then session label', () => {
    const results = resultsFile([{round: 8, races: [race('Free Practice'), race('Qualifying')]}]);
    const fp = computeSessionFingerprints(results);
    expect(Object.keys(fp)).toEqual(['8']);
    expect(Object.keys(fp[8])).toEqual(['Free Practice', 'Qualifying']);
  });
});

describe('findChangedSession', () => {
  it('returns null when nothing changed', () => {
    const results = resultsFile([{round: 8, races: [race('Qualifying', [{pos: 1, driver: 'A'}])]}]);
    const fp = computeSessionFingerprints(results);
    expect(findChangedSession(results, fp, fp)).toBeNull();
  });

  it('ignores an empty session that stays empty', () => {
    const results = resultsFile([{round: 8, races: [race('Free Practice'), race('Qualifying', [])]}]);
    const fp = computeSessionFingerprints(results);
    expect(findChangedSession(results, fp, fp)).toBeNull();
  });

  it('identifies which round and session index changed', () => {
    const before = resultsFile([{round: 8, races: [race('Free Practice', [{pos: 1}]), race('Qualifying', [])]}]);
    const beforeFp = computeSessionFingerprints(before);
    const after = resultsFile([{round: 8, races: [race('Free Practice', [{pos: 1}]), race('Qualifying', [{pos: 1, driver: 'A'}])]}]);
    const afterFp = computeSessionFingerprints(after);

    const changed = findChangedSession(after, afterFp, beforeFp);
    expect(changed).toEqual({round: 8, raceIndex: 1, label: 'Qualifying'});
  });

  it('picks the latest changed session when several changed in one tick', () => {
    const beforeFp = computeSessionFingerprints(resultsFile([{round: 8, races: [race('Free Practice', []), race('Qualifying', [])]}]));
    const after = resultsFile([{round: 8, races: [race('Free Practice', [{pos: 1}]), race('Qualifying', [{pos: 1}])]}]);
    const afterFp = computeSessionFingerprints(after);

    const changed = findChangedSession(after, afterFp, beforeFp);
    expect(changed).toEqual({round: 8, raceIndex: 1, label: 'Qualifying'});
  });

  it('picks the highest round when rounds in different weekends both changed', () => {
    const beforeFp = computeSessionFingerprints(resultsFile([
      {round: 7, races: [race('Race 3', [])]},
      {round: 8, races: [race('Free Practice', [])]},
    ]));
    const after = resultsFile([
      {round: 7, races: [race('Race 3', [{pos: 1}])]},
      {round: 8, races: [race('Free Practice', [{pos: 1}])]},
    ]);
    const afterFp = computeSessionFingerprints(after);

    const changed = findChangedSession(after, afterFp, beforeFp);
    expect(changed.round).toBe(8);
  });
});
