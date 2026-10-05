/**
 * Unit tests for the pure compute functions exported from ResultsScreen.
 * These functions are never exercised by the component tests (parseResults is mocked there).
 */
import {computeSeasonStats, computeProgression, reconcileStatsOrder, isChampionClinched} from '../../src/screens/ResultsScreen';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeResult(driver, pos, {points = 0, pole = false, fastestLap = false, leadLap = false, team = 'Team A'} = {}) {
  return {driver, position: pos, points, pole, fastestLap, leadLap, laps: pos > 0 ? 10 : 5, team};
}

function makeRound(round, races) {
  return {round, venue: 'Test', races};
}

function makeRace(label, results) {
  return {label, results};
}

// ── computeSeasonStats ────────────────────────────────────────────────────────

describe('computeSeasonStats', () => {
  it('counts a regular race win', () => {
    const rounds = [makeRound(1, [makeRace('Race 1', [makeResult('Alice', 1, {points: 20})])])];
    const [alice] = computeSeasonStats(rounds);
    expect(alice.wins).toBe(1);
  });

  it('does not count a QR win as an official win (reg 1.6.2.a)', () => {
    const rounds = [makeRound(1, [makeRace('Qualifying Race', [makeResult('Alice', 1, {points: 10})])])];
    const [alice] = computeSeasonStats(rounds);
    expect(alice.wins).toBe(0);
  });

  it('does not count QR podium positions on the stats tab', () => {
    const rounds = [makeRound(1, [makeRace('Qualifying Race', [makeResult('Alice', 2, {points: 9})])])];
    const [alice] = computeSeasonStats(rounds);
    expect(alice.podiums).toBe(0);
    expect(alice.wins).toBe(0);
  });

  it('counts pole positions from regular races', () => {
    const rounds = [makeRound(1, [makeRace('Race 1', [makeResult('Alice', 1, {points: 21, pole: true})])])];
    const [alice] = computeSeasonStats(rounds);
    expect(alice.poles).toBe(1);
  });

  it('counts fastest laps', () => {
    const rounds = [makeRound(1, [makeRace('Race 1', [makeResult('Alice', 3, {points: 16, fastestLap: true})])])];
    const [alice] = computeSeasonStats(rounds);
    expect(alice.fastestLaps).toBe(1);
  });

  it('counts DNFs (position === 0)', () => {
    const rounds = [makeRound(1, [makeRace('Race 1', [makeResult('Alice', 0, {points: 0})])])];
    const [alice] = computeSeasonStats(rounds);
    expect(alice.dnfs).toBe(1);
  });

  it('accumulates stats across multiple races and rounds', () => {
    const rounds = [
      makeRound(1, [
        makeRace('Qualifying Race', [makeResult('Alice', 1, {points: 10})]), // QR win — not official
        makeRace('Race 1',          [makeResult('Alice', 1, {points: 20})]), // R1 win
        makeRace('Race 2',          [makeResult('Alice', 2, {points: 17})]), // podium
      ]),
      makeRound(2, [
        makeRace('Race 1', [makeResult('Alice', 1, {points: 20})]), // R1 win
      ]),
    ];
    const [alice] = computeSeasonStats(rounds);
    expect(alice.wins).toBe(2);    // QR excluded
    expect(alice.podiums).toBe(3); // QR excluded from podiums too
  });

  it('sorts drivers by total points descending', () => {
    const rounds = [makeRound(1, [makeRace('Race 1', [
      makeResult('Alice', 1, {points: 20}),
      makeResult('Bob',   2, {points: 17}),
    ])])];
    const stats = computeSeasonStats(rounds);
    expect(stats[0].name).toBe('Alice');
    expect(stats[1].name).toBe('Bob');
  });
});

// ── computeProgression ────────────────────────────────────────────────────────

describe('computeProgression', () => {
  it('accumulates points across races', () => {
    const rounds = [makeRound(1, [
      makeRace('Race 1', [makeResult('Alice', 1, {points: 20})]),
      makeRace('Race 2', [makeResult('Alice', 2, {points: 17})]),
    ])];
    const {series} = computeProgression(rounds);
    const alice = series.find(s => s.name === 'Alice');
    expect(alice.points[alice.points.length - 1]).toBe(37);
  });

  it('reads points directly from result without adding bonus flags', () => {
    // Bonus is now baked into r.points by the scraper; computeProgression is a pure pass-through
    const rounds = [makeRound(1, [
      makeRace('Race 1', [makeResult('Alice', 1, {points: 20, leadLap: true})]),
    ])];
    const {series} = computeProgression(rounds);
    const alice = series.find(s => s.name === 'Alice');
    expect(alice.points[alice.points.length - 1]).toBe(20);
  });

  it('does not inflate points when fastestLap flag is set (bonus already in r.points)', () => {
    const rounds = [makeRound(1, [
      makeRace('Race 1', [makeResult('Alice', 2, {points: 17, fastestLap: true})]),
    ])];
    const {series} = computeProgression(rounds);
    const alice = series.find(s => s.name === 'Alice');
    expect(alice.points[alice.points.length - 1]).toBe(17);
  });

  it('does NOT add LL bonus for QR (reg 1.6.2.a — flags stripped by parsers)', () => {
    // parsers.js strips leadLap to false for QR before data reaches computeProgression
    const rounds = [makeRound(1, [
      makeRace('Qualifying Race', [makeResult('Alice', 1, {points: 10, leadLap: true})]),
    ])];
    const {series} = computeProgression(rounds);
    const alice = series.find(s => s.name === 'Alice');
    expect(alice.points[alice.points.length - 1]).toBe(10);
  });

  it('does NOT add FL bonus for QR (flags stripped by parsers — fastestLap is false)', () => {
    // parsers.js strips fastestLap to false for QR results
    const rounds = [makeRound(1, [
      makeRace('Qualifying Race', [makeResult('Alice', 1, {points: 10, fastestLap: false})]),
    ])];
    const {series} = computeProgression(rounds);
    const alice = series.find(s => s.name === 'Alice');
    expect(alice.points[alice.points.length - 1]).toBe(10);
  });

  it('labels round boundaries with R<n> and intermediate races with empty string', () => {
    const rounds = [makeRound(1, [
      makeRace('Qualifying Race', [makeResult('Alice', 1, {points: 10})]),
      makeRace('Race 1',          [makeResult('Alice', 2, {points: 17})]),
      makeRace('Race 2',          [makeResult('Alice', 3, {points: 15})]),
    ])];
    const {pointLabels} = computeProgression(rounds);
    // Last race of round gets the label
    expect(pointLabels[pointLabels.length - 1]).toBe('R1');
    // Intermediate races get empty labels
    expect(pointLabels[0]).toBe('');
    expect(pointLabels[1]).toBe('');
  });

  it('starts a late-joining driver from their first appearance (no null backfill)', () => {
    // computeProgression builds each driver's array from the race they first appear in.
    // The ProgressionChart handles shorter arrays natively — null backfill is not done here.
    const rounds = [makeRound(1, [
      makeRace('Race 1', [
        makeResult('Alice', 1, {points: 20}),
        // Bob absent from Race 1
      ]),
      makeRace('Race 2', [
        makeResult('Alice', 2, {points: 17}),
        makeResult('Bob',   1, {points: 20}),
      ]),
    ])];
    const {series} = computeProgression(rounds);
    const alice = series.find(s => s.name === 'Alice');
    const bob   = series.find(s => s.name === 'Bob');
    expect(alice.points).toHaveLength(2); // present for both races
    expect(bob.points).toHaveLength(1);   // only from Race 2 onwards
    expect(bob.points[0]).toBe(20);
  });

  // ── Official standings reconciliation ─────────────────────────────────────
  // A standalone championship-points penalty (docked outright, not tied to
  // any one race's classification) only ever shows up in the TSL PDF's own
  // running total. Re-summing per-race points can never see it, so without
  // this override the chart silently overstates a penalised driver's points
  // forever. See project memory: table vs chart points mismatch (Sutton/
  // Ingram/Morgan, 2026-09-06).

  it('overrides the final point with the official standings total when they differ', () => {
    const rounds = [makeRound(1, [
      makeRace('Race 1', [makeResult('Morgan', 1, {points: 20})]),
      makeRace('Race 2', [makeResult('Morgan', 1, {points: 20})]),
    ])];
    const standings = {drivers: [{name: 'Morgan', points: 35}]}; // 5pt penalty vs raw 40
    const {series} = computeProgression(rounds, standings);
    const morgan = series.find(s => s.name === 'Morgan');
    expect(morgan.points[morgan.points.length - 1]).toBe(35);
  });

  it('leaves earlier rounds untouched when reconciling the final point', () => {
    const rounds = [makeRound(1, [
      makeRace('Race 1', [makeResult('Morgan', 1, {points: 20})]),
      makeRace('Race 2', [makeResult('Morgan', 1, {points: 20})]),
    ])];
    const standings = {drivers: [{name: 'Morgan', points: 35}]};
    const {series} = computeProgression(rounds, standings);
    const morgan = series.find(s => s.name === 'Morgan');
    expect(morgan.points[0]).toBe(20); // Race 1 snapshot unchanged
    expect(morgan.points[1]).toBe(35); // only the latest snapshot is corrected
  });

  it('does not touch a driver absent from the official standings', () => {
    const rounds = [makeRound(1, [makeRace('Race 1', [makeResult('Alice', 1, {points: 20})])])];
    const standings = {drivers: [{name: 'Morgan', points: 35}]};
    const {series} = computeProgression(rounds, standings);
    const alice = series.find(s => s.name === 'Alice');
    expect(alice.points[alice.points.length - 1]).toBe(20);
  });

  it('is a no-op when no standings are supplied (backward compatible)', () => {
    const rounds = [makeRound(1, [makeRace('Race 1', [makeResult('Alice', 1, {points: 20})])])];
    const {series} = computeProgression(rounds);
    const alice = series.find(s => s.name === 'Alice');
    expect(alice.points[alice.points.length - 1]).toBe(20);
  });
});

// ── reconcileStatsOrder ────────────────────────────────────────────────────
// A penalised driver's raw per-race point sum can undercut a nearby rival's,
// flipping the STATS tab's displayed rank order relative to the real TSL
// standings (e.g. 2026-09-06: Morgan's raw sum of 226 vs Rowbottom's 231,
// though the official standings place Morgan above Rowbottom, 232 to 231).

describe('reconcileStatsOrder', () => {
  it('re-sorts by the official standings total, not the raw computed points', () => {
    const stats = [
      {name: 'Rowbottom', points: 231},
      {name: 'Morgan', points: 226}, // raw sum undercounts Morgan's penalised total
    ];
    const standings = {drivers: [
      {name: 'Morgan', points: 232},
      {name: 'Rowbottom', points: 231},
    ]};
    const result = reconcileStatsOrder(stats, standings);
    expect(result.map(s => s.name)).toEqual(['Morgan', 'Rowbottom']);
  });

  it('falls back to the raw computed points for a driver absent from standings', () => {
    const stats = [{name: 'Alice', points: 20}, {name: 'Bob', points: 17}];
    const standings = {drivers: [{name: 'Alice', points: 20}]}; // Bob not in the official list
    const result = reconcileStatsOrder(stats, standings);
    expect(result.map(s => s.name)).toEqual(['Alice', 'Bob']);
  });

  it('is a no-op when no standings are supplied', () => {
    const stats = [{name: 'Alice', points: 20}, {name: 'Bob', points: 17}];
    expect(reconcileStatsOrder(stats, null)).toBe(stats); // same array, untouched
  });

  it('does not mutate the input array', () => {
    const stats = [{name: 'Rowbottom', points: 231}, {name: 'Morgan', points: 226}];
    const standings = {drivers: [{name: 'Morgan', points: 232}, {name: 'Rowbottom', points: 231}]};
    reconcileStatsOrder(stats, standings);
    expect(stats.map(s => s.name)).toEqual(['Rowbottom', 'Morgan']); // original order preserved
  });
});

// ── isChampionClinched ──────────────────────────────────────────────────────
// A remaining race is only "in play" if SCORING_RACES includes its label and
// it has no results yet. Each championship values that race differently -
// the Qualifying Race only ever pays the main Drivers' Championship (reg
// 1.6.7); every other race pays 22 to a driver (20 + FL + leader, 1.6.2.a),
// 20 to the Independents'/JST trophies (no bonuses, 1.6.2.b/1.6.6), 37 to
// Teams/Manufacturers (best two cars, base points, 1.6.3/1.6.4) or 20 to
// Independent Teams (best car only, 1.6.5).

describe('isChampionClinched', () => {
  function standing(position, points) {
    return {position, points};
  }

  it('is not clinched while the runner-up could still draw level (exact tie is not safe, reg 1.6.9)', () => {
    // One Race 1 left: drivers' max swing is 22. Gap of exactly 22 means the
    // chaser could tie, not just lose - and a tie goes to countback.
    const rounds = [makeRound(1, [makeRace('Race 1', [])])];
    const list = [standing(1, 422), standing(2, 400)];
    expect(isChampionClinched(list, rounds, 'drivers')).toBe(false);
  });

  it('is clinched once the gap exceeds every remaining race\'s maximum', () => {
    const rounds = [makeRound(1, [makeRace('Race 1', [])])];
    const list = [standing(1, 423), standing(2, 400)];
    expect(isChampionClinched(list, rounds, 'drivers')).toBe(true);
  });

  it('never clinches while round data has not loaded yet', () => {
    const list = [standing(1, 1000), standing(2, 0)];
    expect(isChampionClinched(list, [], 'drivers')).toBe(false);
  });

  it('a completed season (no unscored races left) clinches on any positive gap', () => {
    const rounds = [makeRound(1, [makeRace('Race 1', [makeResult('Alice', 1, {points: 20})])])];
    const list = [standing(1, 400), standing(2, 399)];
    expect(isChampionClinched(list, rounds, 'drivers')).toBe(true);
  });

  it('a sole classified entrant is trivially the champion', () => {
    const rounds = [makeRound(1, [makeRace('Race 1', [])])];
    const list = [standing(1, 100)];
    expect(isChampionClinched(list, rounds, 'drivers')).toBe(true);
  });

  it('the Qualifying Race only counts for the main Drivers\' Championship (reg 1.6.7)', () => {
    // Only a Qualifying Race left (worth 10 to drivers, 0 to every other championship).
    const rounds = [makeRound(1, [makeRace('Qualifying Race', [])])];
    const driversList = [standing(1, 409), standing(2, 400)]; // gap 9 < 10 - not clinched
    const teamsList = [standing(1, 401), standing(2, 400)];   // gap 1 > 0 - clinched, QR pays teams nothing
    expect(isChampionClinched(driversList, rounds, 'drivers')).toBe(false);
    expect(isChampionClinched(teamsList, rounds, 'teams')).toBe(true);
  });

  it('values a remaining race at 37 for Teams/Manufacturers vs 20 for Independent Teams', () => {
    const rounds = [makeRound(1, [makeRace('Race 1', [])])];
    const gapOf30 = [standing(1, 430), standing(2, 400)];
    // Teams: 30 < 37 remaining swing - not yet safe
    expect(isChampionClinched(gapOf30, rounds, 'teams')).toBe(false);
    // Independent Teams: 30 > 20 remaining swing - safe
    expect(isChampionClinched(gapOf30, rounds, 'independentsTeams')).toBe(true);
  });

  it('ignores non-scoring sessions (Free Practice/Qualifying) when tallying what remains', () => {
    const rounds = [makeRound(1, [makeRace('Free Practice', []), makeRace('Qualifying', [])])];
    const list = [standing(1, 401), standing(2, 400)];
    expect(isChampionClinched(list, rounds, 'drivers')).toBe(true);
  });
});
