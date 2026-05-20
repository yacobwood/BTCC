/**
 * Unit tests for the pure compute functions exported from ResultsScreen.
 * These functions are never exercised by the component tests (parseResults is mocked there).
 */
import {computeSeasonStats, computeProgression} from '../../src/screens/ResultsScreen';

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

  it('counts QR podium positions (2nd and 3rd) as podiums', () => {
    // Only "wins" are excluded from QR — podium counting is separate
    const rounds = [makeRound(1, [makeRace('Qualifying Race', [makeResult('Alice', 2, {points: 9})])])];
    const [alice] = computeSeasonStats(rounds);
    expect(alice.podiums).toBe(1);
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
    expect(alice.podiums).toBe(4); // all pos 1-3 including QR
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
});
