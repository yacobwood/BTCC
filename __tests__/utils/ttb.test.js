import {
  isBCircuit,
  getTtbLaps,
  championshipOrderBeforeRound,
  finishingOrderMap,
  ttbPositionMap,
  isSeasonOpenerRace1,
  getTtbSeconds,
  isSeasonOpenerQualifying,
  ttbQualifyingPositionMap,
  ttbPositionMapForRace,
  isTtbSeasonOpener,
  getTtbBadge,
} from '../../src/utils/ttb';

function makeResult(driver, position, overrides = {}) {
  return {driver, position, laps: 20, points: 0, ...overrides};
}

// ── isBCircuit / getTtbLaps ──────────────────────────────────────────────────

describe('isBCircuit', () => {
  it('identifies the three regs-named B circuits', () => {
    expect(isBCircuit('Brands Hatch Indy')).toBe(true);
    expect(isBCircuit('Knockhill')).toBe(true);
    expect(isBCircuit('Silverstone')).toBe(true);
  });

  it('treats every other venue as an A circuit', () => {
    expect(isBCircuit('Donington Park')).toBe(false);
    expect(isBCircuit('Brands Hatch GP')).toBe(false);
    expect(isBCircuit('Snetterton')).toBe(false);
  });
});

describe('getTtbLaps', () => {
  it('returns the A-circuit scale for positions 1-7', () => {
    expect(getTtbLaps(1, 'Donington Park')).toBe(1);
    expect(getTtbLaps(2, 'Donington Park')).toBe(2);
    expect(getTtbLaps(7, 'Donington Park')).toBe(8);
  });

  it('returns the B-circuit scale for positions 1-7', () => {
    expect(getTtbLaps(1, 'Knockhill')).toBe(4);
    expect(getTtbLaps(6, 'Silverstone')).toBe(10);
  });

  it('clamps position 8 and beyond to the P8+ row', () => {
    expect(getTtbLaps(8, 'Donington Park')).toBe(10);
    expect(getTtbLaps(15, 'Donington Park')).toBe(10);
    expect(getTtbLaps(30, 'Brands Hatch Indy')).toBe(14);
  });

  it('returns null for a missing/invalid position', () => {
    expect(getTtbLaps(null, 'Donington Park')).toBeNull();
    expect(getTtbLaps(undefined, 'Donington Park')).toBeNull();
    expect(getTtbLaps(0, 'Donington Park')).toBeNull();
  });
});

// ── championshipOrderBeforeRound ─────────────────────────────────────────────

describe('championshipOrderBeforeRound', () => {
  it('returns {} when there is no earlier round (season opener)', () => {
    const allRounds = [{round: 1, races: [{label: 'Race 1', results: [makeResult('Alice', 1, {points: 25})]}]}];
    expect(championshipOrderBeforeRound(allRounds, 1)).toEqual({});
  });

  it('sums points across every race of every earlier round', () => {
    const allRounds = [
      {
        round: 1,
        races: [
          {label: 'Race 1', results: [makeResult('Alice', 1, {points: 20}), makeResult('Bob', 2, {points: 18})]},
          {label: 'Race 2', results: [makeResult('Bob', 1, {points: 25}), makeResult('Alice', 2, {points: 18})]},
        ],
      },
      {round: 2, races: [{label: 'Race 1', results: [makeResult('Alice', 1, {points: 20})]}]}, // this round - excluded
    ];
    // Before round 2: Alice = 20+18 = 38, Bob = 18+25 = 43 -> Bob P1, Alice P2
    const ranks = championshipOrderBeforeRound(allRounds, 2);
    expect(ranks.Bob).toBe(1);
    expect(ranks.Alice).toBe(2);
  });

  it('gives tied drivers the same rank and skips the next rank accordingly', () => {
    const allRounds = [
      {round: 1, races: [{label: 'Race 1', results: [
        makeResult('Alice', 1, {points: 20}),
        makeResult('Bob', 2, {points: 20}),
        makeResult('Carl', 3, {points: 15}),
      ]}]},
    ];
    const ranks = championshipOrderBeforeRound(allRounds, 2);
    expect(ranks.Alice).toBe(1);
    expect(ranks.Bob).toBe(1);
    expect(ranks.Carl).toBe(3); // skips rank 2 - two drivers tied at rank 1
  });

  it('ignores rounds at or after the target round', () => {
    const allRounds = [
      {round: 2, races: [{label: 'Race 1', results: [makeResult('Alice', 1, {points: 20})]}]},
      {round: 3, races: [{label: 'Race 1', results: [makeResult('Bob', 1, {points: 20})]}]},
    ];
    const ranks = championshipOrderBeforeRound(allRounds, 2);
    expect(ranks).toEqual({});
  });

  it('folds a rosterDrivers entry with no earlier results in tied on zero points', () => {
    const allRounds = [
      {round: 1, races: [{label: 'Race 1', results: [
        makeResult('Alice', 1, {points: 20}),
        makeResult('Bob', 2, {points: 15}),
        makeResult('Carl', 3, {points: 10}),
      ]}]},
    ];
    // Dave (e.g. a mid-season replacement driver) never appeared in any
    // earlier round's results at all - not even with 0 points - so he's
    // missing from the points sum entirely. rosterDrivers should still rank
    // him, tied for last with the rest of the field.
    const ranks = championshipOrderBeforeRound(allRounds, 2, ['Alice', 'Bob', 'Carl', 'Dave']);
    expect(ranks).toEqual({Alice: 1, Bob: 2, Carl: 3, Dave: 4});
  });

  it('does not invent a season-opener ranking from rosterDrivers alone', () => {
    // Round 1 - no earlier round exists, so points stay empty regardless of
    // the roster passed in. This must stay {} so ttbPositionMap's max-tier
    // fallback still kicks in, rather than everyone tying at rank 1.
    const ranks = championshipOrderBeforeRound([], 1, ['Alice', 'Bob']);
    expect(ranks).toEqual({});
  });
});

// ── finishingOrderMap ─────────────────────────────────────────────────────────

describe('finishingOrderMap', () => {
  it('returns null when the source race has no results yet', () => {
    expect(finishingOrderMap({label: 'Race 1', results: []})).toBeNull();
    expect(finishingOrderMap(null)).toBeNull();
  });

  it('maps classified finishers to their finishing position', () => {
    const race = {results: [makeResult('Alice', 1), makeResult('Bob', 2), makeResult('Carl', 3)]};
    expect(finishingOrderMap(race)).toEqual({Alice: 1, Bob: 2, Carl: 3});
  });

  it('places non-classified results after classified ones, ordered by laps covered', () => {
    const race = {
      results: [
        makeResult('Alice', 1),
        makeResult('Bob', 0, {laps: 10}), // DNF, fewer laps
        makeResult('Carl', 0, {laps: 15}), // DNF, more laps - ranks above Bob
      ],
    };
    expect(finishingOrderMap(race)).toEqual({Alice: 1, Carl: 2, Bob: 3});
  });
});

// ── ttbPositionMap ────────────────────────────────────────────────────────────

describe('ttbPositionMap', () => {
  it('Race 1 uses championship order before this round', () => {
    const allRounds = [{round: 1, races: [{label: 'Race 1', results: [makeResult('Alice', 1, {points: 20})]}]}];
    const map = ttbPositionMap({label: 'Race 1'}, [], allRounds, 2);
    expect(map).toEqual({Alice: 1});
  });

  it('Race 1 at round 1 (season opener) gives every grid driver the max TTB tier', () => {
    const allRounds = [{round: 1, races: [{label: 'Race 1', results: [makeResult('Alice', 1, {points: 20})]}]}];
    const race = {label: 'Race 1', grid: [{pos: 1, driver: 'Alice'}, {pos: 2, driver: 'Bob'}]};
    // Position 8 (max tier) for every driver, regardless of grid order.
    expect(ttbPositionMap(race, [], allRounds, 1)).toEqual({Alice: 8, Bob: 8});
  });

  it('Race 1 at round 1 with no grid data yet returns null', () => {
    expect(ttbPositionMap({label: 'Race 1', grid: []}, [], [], 1)).toBeNull();
  });

  it('Race 1 ranks a grid driver with no earlier-round results tied for last, not missing', () => {
    // Regression: a mid-season replacement driver (e.g. Daniel Lloyd taking
    // over from James Dorlin) has no results in any earlier round, so they
    // were previously absent from the map entirely and got no TTB badge.
    const allRounds = [{round: 1, races: [{label: 'Race 1', results: [
      makeResult('Alice', 1, {points: 20}),
      makeResult('Bob', 2, {points: 15}),
    ]}]}];
    const race = {label: 'Race 1', grid: [{pos: 1, driver: 'Alice'}, {pos: 2, driver: 'Bob'}, {pos: 3, driver: 'Dave'}]};
    const map = ttbPositionMap(race, [], allRounds, 2);
    expect(map).toEqual({Alice: 1, Bob: 2, Dave: 3});
    expect(getTtbLaps(map.Dave, 'Donington Park')).not.toBeNull();
  });

  it('Race 2 uses Race 1 finishing order from the same round', () => {
    const races = [{label: 'Race 1', results: [makeResult('Alice', 1), makeResult('Bob', 2)]}];
    expect(ttbPositionMap({label: 'Race 2'}, races, [], 3)).toEqual({Alice: 1, Bob: 2});
  });

  it('Race 3 uses Race 2 finishing order from the same round', () => {
    const races = [{label: 'Race 2', results: [makeResult('Bob', 1), makeResult('Alice', 2)]}];
    expect(ttbPositionMap({label: 'Race 3'}, races, [], 3)).toEqual({Bob: 1, Alice: 2});
  });

  it('returns null for any other race label', () => {
    expect(ttbPositionMap({label: 'Qualifying Race'}, [], [], 1)).toBeNull();
  });
});

// ── isSeasonOpenerRace1 ───────────────────────────────────────────────────────

describe('isSeasonOpenerRace1', () => {
  it('is true for Race 1 with no earlier round to rank by', () => {
    expect(isSeasonOpenerRace1({label: 'Race 1'}, [], 1)).toBe(true);
  });

  it('is false for Race 1 once an earlier round exists', () => {
    const allRounds = [{round: 1, races: [{label: 'Race 1', results: [makeResult('Alice', 1, {points: 20})]}]}];
    expect(isSeasonOpenerRace1({label: 'Race 1'}, allRounds, 2)).toBe(false);
  });

  it('is false for Race 2/Race 3 regardless of round number', () => {
    expect(isSeasonOpenerRace1({label: 'Race 2'}, [], 1)).toBe(false);
    expect(isSeasonOpenerRace1({label: 'Race 3'}, [], 1)).toBe(false);
  });
});

// ── getTtbSeconds ─────────────────────────────────────────────────────────────
// Qualifying/Qualifying Race scale (reg 1.11.1.b) - secs/lap, no circuit split.

describe('getTtbSeconds', () => {
  it('returns the secs/lap scale for positions 1-7', () => {
    expect(getTtbSeconds(1)).toBe(1);
    expect(getTtbSeconds(2)).toBe(3);
    expect(getTtbSeconds(7)).toBe(15);
  });

  it('clamps position 8 and beyond to the P8+ row', () => {
    expect(getTtbSeconds(8)).toBe(20);
    expect(getTtbSeconds(15)).toBe(20);
  });

  it('returns null for a missing/invalid position', () => {
    expect(getTtbSeconds(null)).toBeNull();
    expect(getTtbSeconds(undefined)).toBeNull();
    expect(getTtbSeconds(0)).toBeNull();
  });

  it('does not vary by circuit, unlike getTtbLaps', () => {
    // No venue param at all - same value regardless of circuit type.
    expect(getTtbSeconds(1)).toBe(getTtbSeconds(1));
  });
});

// ── isSeasonOpenerQualifying ──────────────────────────────────────────────────

describe('isSeasonOpenerQualifying', () => {
  it('is true for Qualifying with no earlier round to rank by', () => {
    expect(isSeasonOpenerQualifying({label: 'Qualifying'}, [], 1)).toBe(true);
  });

  it('is true for the Qualifying Race with no earlier round to rank by', () => {
    expect(isSeasonOpenerQualifying({label: 'Qualifying Race'}, [], 1)).toBe(true);
  });

  it('is false once an earlier round exists', () => {
    const allRounds = [{round: 1, races: [{label: 'Race 1', results: [makeResult('Alice', 1, {points: 20})]}]}];
    expect(isSeasonOpenerQualifying({label: 'Qualifying'}, allRounds, 2)).toBe(false);
  });

  it('is false for any other race label regardless of round number', () => {
    expect(isSeasonOpenerQualifying({label: 'Race 1'}, [], 1)).toBe(false);
    expect(isSeasonOpenerQualifying({label: 'Race 2'}, [], 1)).toBe(false);
  });
});

// ── ttbQualifyingPositionMap ──────────────────────────────────────────────────
// Qualifying and the Qualifying Race share Race 1's Championship-Order source
// - NOT each other's finishing order the way Race 2/3 use the prior race.

describe('ttbQualifyingPositionMap', () => {
  it('Qualifying uses championship order before this round, rostered from results', () => {
    const allRounds = [{round: 1, races: [{label: 'Race 1', results: [makeResult('Alice', 1, {points: 20})]}]}];
    const race = {label: 'Qualifying', results: [makeResult('Alice', 1), makeResult('Bob', 2)]};
    expect(ttbQualifyingPositionMap(race, allRounds, 2)).toEqual({Alice: 1, Bob: 2});
  });

  it('Qualifying Race uses championship order before this round, rostered from its grid', () => {
    const allRounds = [{round: 1, races: [{label: 'Race 1', results: [makeResult('Alice', 1, {points: 20})]}]}];
    const race = {label: 'Qualifying Race', grid: [{pos: 1, driver: 'Alice'}, {pos: 2, driver: 'Bob'}]};
    expect(ttbQualifyingPositionMap(race, allRounds, 2)).toEqual({Alice: 1, Bob: 2});
  });

  it('at round 1 (season opener) gives every rostered driver the max TTB tier', () => {
    const race = {label: 'Qualifying', results: [makeResult('Alice', 1), makeResult('Bob', 2)]};
    // Position 8 (max tier) for every driver, regardless of Qualifying order.
    expect(ttbQualifyingPositionMap(race, [], 1)).toEqual({Alice: 8, Bob: 8});
  });

  it('at round 1 with no roster data yet returns null', () => {
    expect(ttbQualifyingPositionMap({label: 'Qualifying', results: []}, [], 1)).toBeNull();
    expect(ttbQualifyingPositionMap({label: 'Qualifying Race', grid: []}, [], 1)).toBeNull();
  });

  it('ranks a rostered driver with no earlier-round results tied for last, not missing', () => {
    // Same mid-season-debut gap as Race 1 (see championshipOrderBeforeRound).
    const allRounds = [{round: 1, races: [{label: 'Race 1', results: [
      makeResult('Alice', 1, {points: 20}),
      makeResult('Bob', 2, {points: 15}),
    ]}]}];
    const race = {label: 'Qualifying Race', grid: [{pos: 1, driver: 'Alice'}, {pos: 2, driver: 'Bob'}, {pos: 3, driver: 'Dave'}]};
    const map = ttbQualifyingPositionMap(race, allRounds, 2);
    expect(map).toEqual({Alice: 1, Bob: 2, Dave: 3});
    expect(getTtbSeconds(map.Dave)).not.toBeNull();
  });

  it('returns null for any other race label', () => {
    expect(ttbQualifyingPositionMap({label: 'Race 1'}, [], 1)).toBeNull();
    expect(ttbQualifyingPositionMap({label: 'Race 2'}, [], 1)).toBeNull();
  });
});

// ── ttbPositionMapForRace / isTtbSeasonOpener (dispatchers) ──────────────────

describe('ttbPositionMapForRace', () => {
  it('routes Qualifying to ttbQualifyingPositionMap', () => {
    const race = {label: 'Qualifying', results: [makeResult('Alice', 1)]};
    expect(ttbPositionMapForRace(race, [], [], 1)).toEqual({Alice: 8});
  });

  it('routes the Qualifying Race to ttbQualifyingPositionMap', () => {
    const race = {label: 'Qualifying Race', grid: [{pos: 1, driver: 'Alice'}]};
    expect(ttbPositionMapForRace(race, [], [], 1)).toEqual({Alice: 8});
  });

  it('routes Race 1/2/3 to ttbPositionMap', () => {
    const races = [{label: 'Race 1', results: [makeResult('Alice', 1)]}];
    expect(ttbPositionMapForRace({label: 'Race 2'}, races, [], 3)).toEqual({Alice: 1});
  });
});

describe('isTtbSeasonOpener', () => {
  it('routes Qualifying/Qualifying Race to isSeasonOpenerQualifying', () => {
    expect(isTtbSeasonOpener({label: 'Qualifying'}, [], 1)).toBe(true);
    expect(isTtbSeasonOpener({label: 'Qualifying Race'}, [], 1)).toBe(true);
  });

  it('routes Race 1 to isSeasonOpenerRace1', () => {
    expect(isTtbSeasonOpener({label: 'Race 1'}, [], 1)).toBe(true);
    expect(isTtbSeasonOpener({label: 'Race 2'}, [], 1)).toBe(false);
  });
});

// ── getTtbBadge ───────────────────────────────────────────────────────────────

describe('getTtbBadge', () => {
  it('returns a laps badge for Race 1/2/3', () => {
    const badge = getTtbBadge({label: 'Race 3'}, {Alice: 2}, 'Alice', 'Donington Park');
    expect(badge).toEqual({value: 2, label: '2', a11y: '2 laps of TOCA Turbo Boost'});
  });

  it('returns a seconds badge for Qualifying/Qualifying Race', () => {
    const badge = getTtbBadge({label: 'Qualifying Race'}, {Alice: 2}, 'Alice', 'Donington Park');
    expect(badge).toEqual({value: 3, label: '3s', a11y: '3 seconds of TOCA Turbo Boost per lap'});
  });

  it('returns null when the position map is unavailable', () => {
    expect(getTtbBadge({label: 'Race 1'}, null, 'Alice', 'Donington Park')).toBeNull();
  });

  it('returns null for a driver missing from the position map', () => {
    expect(getTtbBadge({label: 'Race 1'}, {Alice: 1}, 'Bob', 'Donington Park')).toBeNull();
  });
});
