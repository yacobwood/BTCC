const {checkRace3Grid, findRace3, race3GridReady, race3PoleSitter} = require('../../functions/race3Grid');

// ── Pure helpers ─────────────────────────────────────────────────────────────
//
// Regression coverage: Race 3's grid needs both Race 2's finishing order AND
// a separately-timed reversal-count draw (BTCC reg 3.4.1.b) - these must key
// off Race 3's own `grid` field, not merely whether Race 2 has results.

function makeResults(round, races) {
  return {rounds: [{round, races}]};
}

describe('findRace3', () => {
  it('finds Race 3 by label within the matching round', () => {
    const race3 = {label: 'Race 3', grid: []};
    const data = makeResults(5, [{label: 'Race 2', grid: []}, race3]);
    expect(findRace3(data, 5)).toBe(race3);
  });

  it('returns null when the round is not found', () => {
    const data = makeResults(5, [{label: 'Race 3', grid: []}]);
    expect(findRace3(data, 6)).toBeNull();
  });

  it('returns null when the round has no Race 3', () => {
    const data = makeResults(5, [{label: 'Race 2', grid: []}]);
    expect(findRace3(data, 5)).toBeNull();
  });

  it('returns null on an empty rounds list', () => {
    expect(findRace3({rounds: []}, 5)).toBeNull();
  });

  it('returns null when rounds is missing entirely', () => {
    expect(findRace3({}, 5)).toBeNull();
  });
});

describe('race3GridReady', () => {
  it('is false when Race 3 has no grid field at all', () => {
    // The scenario this feature exists for: Race 2's finishing order is in,
    // but Race 3's grid (needing the separately-drawn reversal count too)
    // hasn't been published yet.
    const data = makeResults(5, [{label: 'Race 3', results: [{driver: 'X'}]}]);
    expect(race3GridReady(data, 5)).toBe(false);
  });

  it('is false when grid is an empty array', () => {
    const data = makeResults(5, [{label: 'Race 3', grid: []}]);
    expect(race3GridReady(data, 5)).toBe(false);
  });

  it('is true when grid is populated', () => {
    const data = makeResults(5, [{label: 'Race 3', grid: [{pos: 1, driver: 'Tom Chilton'}]}]);
    expect(race3GridReady(data, 5)).toBe(true);
  });

  it('is false when Race 3 does not exist yet', () => {
    const data = makeResults(5, [{label: 'Race 2', grid: [{pos: 1, driver: 'X'}]}]);
    expect(race3GridReady(data, 5)).toBe(false);
  });
});

describe('race3PoleSitter', () => {
  it('returns the driver at grid position 1', () => {
    const grid = [
      {pos: 2, driver: 'Ash Sutton'},
      {pos: 1, driver: 'Tom Chilton'},
      {pos: 3, driver: 'Adam Morgan'},
    ];
    const data = makeResults(5, [{label: 'Race 3', grid}]);
    expect(race3PoleSitter(data, 5)).toBe('Tom Chilton');
  });

  it('returns null when the grid is not published', () => {
    const data = makeResults(5, [{label: 'Race 3', grid: []}]);
    expect(race3PoleSitter(data, 5)).toBeNull();
  });

  it('returns null when the grid has no pos===1 entry', () => {
    const grid = [{pos: 2, driver: 'Ash Sutton'}];
    const data = makeResults(5, [{label: 'Race 3', grid}]);
    expect(race3PoleSitter(data, 5)).toBeNull();
  });
});

// ── checkRace3Grid orchestration ─────────────────────────────────────────────

function makeDb({alreadySent = false} = {}) {
  const snap = {exists: alreadySent};
  const tx = {get: jest.fn().mockResolvedValue(snap), set: jest.fn()};
  const docRef = {};
  return {
    collection: () => ({doc: () => docRef}),
    runTransaction: jest.fn(async (fn) => fn(tx)),
    _tx: tx,
  };
}

function makeMessaging() {
  return {send: jest.fn().mockResolvedValue('msg-id-1')};
}

function makeFetch(resultsData) {
  return jest.fn().mockResolvedValue({json: jest.fn().mockResolvedValue(resultsData)});
}

describe('checkRace3Grid', () => {
  it('sends a notification when Race 3\'s grid is newly ready', async () => {
    const data = makeResults(5, [{label: 'Race 3', grid: [{pos: 1, driver: 'Tom Chilton'}]}]);
    const db = makeDb();
    const messaging = makeMessaging();
    const logHistory = jest.fn();

    await checkRace3Grid({fetchFn: makeFetch(data), db, messaging, logHistory, year: 2026});

    expect(messaging.send).toHaveBeenCalledTimes(1);
    expect(messaging.send).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: 'pre_race3_grid',
        data: expect.objectContaining({type: 'results', round: '5', year: '2026', race: '3'}),
      }),
    );
    expect(logHistory).toHaveBeenCalledWith(
      expect.stringContaining('Round 5'),
      expect.stringContaining('Tom Chilton'),
      'pre_race3_grid',
    );
  });

  it('does not send again for a round already notified', async () => {
    const data = makeResults(5, [{label: 'Race 3', grid: [{pos: 1, driver: 'Tom Chilton'}]}]);
    const db = makeDb({alreadySent: true});
    const messaging = makeMessaging();

    await checkRace3Grid({fetchFn: makeFetch(data), db, messaging, logHistory: jest.fn(), year: 2026});

    expect(messaging.send).not.toHaveBeenCalled();
  });

  it('does not send when no round has a ready Race 3 grid', async () => {
    const data = makeResults(5, [{label: 'Race 3', grid: []}]);
    const db = makeDb();
    const messaging = makeMessaging();

    await checkRace3Grid({fetchFn: makeFetch(data), db, messaging, logHistory: jest.fn(), year: 2026});

    expect(messaging.send).not.toHaveBeenCalled();
    expect(db.runTransaction).not.toHaveBeenCalled();
  });

  it('falls back to a generic body when the pole sitter cannot be determined', async () => {
    const data = makeResults(5, [{label: 'Race 3', grid: [{pos: 2, driver: 'Ash Sutton'}]}]);
    const db = makeDb();
    const messaging = makeMessaging();

    // grid is non-empty (so "ready") but has no pos===1 entry - defensive
    // fallback path, shouldn't happen with real TSL data.
    await checkRace3Grid({fetchFn: makeFetch(data), db, messaging, logHistory: jest.fn(), year: 2026});

    expect(messaging.send).toHaveBeenCalledWith(
      expect.objectContaining({
        apns: expect.objectContaining({
          payload: {aps: expect.objectContaining({alert: expect.objectContaining({body: "Race 3's starting grid is now set"})})},
        }),
      }),
    );
  });

  it('notifies once per ready round independently when multiple rounds qualify', async () => {
    const data = {
      rounds: [
        {round: 4, races: [{label: 'Race 3', grid: [{pos: 1, driver: 'Driver A'}]}]},
        {round: 5, races: [{label: 'Race 3', grid: [{pos: 1, driver: 'Driver B'}]}]},
      ],
    };
    const db = makeDb();
    const messaging = makeMessaging();

    await checkRace3Grid({fetchFn: makeFetch(data), db, messaging, logHistory: jest.fn(), year: 2026});

    expect(messaging.send).toHaveBeenCalledTimes(2);
  });
});
