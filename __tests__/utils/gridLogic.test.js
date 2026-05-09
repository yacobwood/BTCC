import {buildGridMap, detectReversalCount, buildReverseGrid} from '../../src/screens/RoundResultsScreen';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeResult(driver, position, laps = 10) {
  return {driver, position, laps, team: 'Team A', points: 0};
}

function makeRace(label, results = [], grid = []) {
  return {label, results, grid};
}

// ── buildGridMap ──────────────────────────────────────────────────────────────

describe('buildGridMap', () => {
  it('returns TSL grid map when race.grid is populated', () => {
    const races = [
      makeRace('Race 1', [], [{driver: 'Alice', pos: 1}, {driver: 'Bob', pos: 2}]),
    ];
    const map = buildGridMap(races, 0);
    expect(map['Alice']).toBe(1);
    expect(map['Bob']).toBe(2);
  });

  it('returns null when race does not exist', () => {
    expect(buildGridMap([], 5)).toBeNull();
  });

  it('falls back to Qualifying results for Race 1 when no TSL grid', () => {
    const races = [
      makeRace('Qualifying', [makeResult('Alice', 1), makeResult('Bob', 2)]),
      makeRace('Qualifying Race', [makeResult('Alice', 2), makeResult('Bob', 1)]),
      makeRace('Race 1'), // no grid
    ];
    const r1Index = races.findIndex(r => r.label === 'Race 1');
    const map = buildGridMap(races, r1Index);
    expect(map['Alice']).toBe(1);
    expect(map['Bob']).toBe(2);
  });

  it('falls back to QR results for Race 1 grid derivation', () => {
    const races = [
      makeRace('Qualifying Race', [makeResult('Charlie', 1), makeResult('Dave', 2)]),
      makeRace('Race 1'), // no grid
    ];
    const map = buildGridMap(races, 1);
    expect(map['Charlie']).toBe(1);
    expect(map['Dave']).toBe(2);
  });

  it('falls back to Race 1 results for Race 2 grid derivation', () => {
    const races = [
      makeRace('Race 1', [makeResult('Alice', 1), makeResult('Bob', 2)]),
      makeRace('Race 2'), // no grid
    ];
    const map = buildGridMap(races, 1);
    expect(map['Alice']).toBe(1);
    expect(map['Bob']).toBe(2);
  });

  it('returns null for Race 3 when no TSL grid (fallback not possible — reverse grid used instead)', () => {
    const races = [
      makeRace('Race 2', [makeResult('Alice', 1), makeResult('Bob', 2)]),
      makeRace('Race 3'), // no grid
    ];
    const r3Index = races.findIndex(r => r.label === 'Race 3');
    expect(buildGridMap(races, r3Index)).toBeNull();
  });

  it('returns null when source race has no results', () => {
    const races = [
      makeRace('Race 1', []), // empty results
      makeRace('Race 2'),
    ];
    expect(buildGridMap(races, 1)).toBeNull();
  });

  it('excludes non-finishers (position === 0) from derived grid', () => {
    const races = [
      makeRace('Race 1', [makeResult('Alice', 1), makeResult('Bob', 0)]), // Bob DNF
      makeRace('Race 2'),
    ];
    const map = buildGridMap(races, 1);
    expect(map['Alice']).toBe(1);
    expect(map['Bob']).toBeUndefined();
  });
});

// ── detectReversalCount ───────────────────────────────────────────────────────

describe('detectReversalCount', () => {
  const r2Results = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n =>
    makeResult(`Driver${n}`, n),
  );
  const races = [makeRace('Race 2', r2Results)];

  it('detects a reversal of 6', () => {
    // R3 grid = R2 top-6 reversed: [6,5,4,3,2,1, 7,8,9,10,11,12]
    const grid = [6, 5, 4, 3, 2, 1, 7, 8, 9, 10, 11, 12].map(n => `Driver${n}`);
    expect(detectReversalCount(races, grid)).toBe(6);
  });

  it('detects a reversal of 12', () => {
    const grid = [12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map(n => `Driver${n}`);
    expect(detectReversalCount(races, grid)).toBe(12);
  });

  it('returns null when grid does not match any reversal count', () => {
    const grid = ['Driver1', 'Driver2', 'Driver3']; // unchanged order
    expect(detectReversalCount(races, grid)).toBeNull();
  });

  it('returns null when Race 2 results are absent', () => {
    expect(detectReversalCount([], ['Driver1', 'Driver2'])).toBeNull();
    expect(detectReversalCount([makeRace('Race 2', [])], ['Driver1'])).toBeNull();
  });

  it('returns null when races array is null/undefined', () => {
    expect(detectReversalCount(null, [])).toBeNull();
    expect(detectReversalCount(undefined, [])).toBeNull();
  });
});

// ── buildReverseGrid ──────────────────────────────────────────────────────────

describe('buildReverseGrid', () => {
  const r2Results = [1, 2, 3, 4, 5, 6, 7, 8].map(n => makeResult(`Driver${n}`, n));
  const races = [makeRace('Race 2', r2Results)];

  it('reverses top N finishers and keeps the rest in order', () => {
    const grid = buildReverseGrid(races, 6);
    const positions = grid.map(g => g.driver);
    expect(positions.slice(0, 6)).toEqual(
      ['Driver6', 'Driver5', 'Driver4', 'Driver3', 'Driver2', 'Driver1'],
    );
    expect(positions.slice(6)).toEqual(['Driver7', 'Driver8']);
  });

  it('places DNFs after all classified finishers, sorted by laps desc', () => {
    const resultsWithDNF = [
      makeResult('Alice',  1, 20),
      makeResult('Bob',    2, 20),
      makeResult('Carol',  0, 15), // DNF: 15 laps
      makeResult('Dave',   0, 8),  // DNF: 8 laps
    ];
    const grid = buildReverseGrid([makeRace('Race 2', resultsWithDNF)], 2);
    const names = grid.map(g => g.driver);
    // Classified reversed: [Bob, Alice], then DNFs by laps desc: Carol (15), Dave (8)
    expect(names).toEqual(['Bob', 'Alice', 'Carol', 'Dave']);
  });

  it('returns null when Race 2 has no results', () => {
    expect(buildReverseGrid([makeRace('Race 2', [])], 6)).toBeNull();
    expect(buildReverseGrid([], 6)).toBeNull();
  });

  it('attaches r2Pos to each entry', () => {
    const grid = buildReverseGrid(races, 6);
    expect(grid[0].r2Pos).toBe(6); // Driver6 was P6 in R2
    expect(grid[0].gridPos).toBe(1);
  });
});
