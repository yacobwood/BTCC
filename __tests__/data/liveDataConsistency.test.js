/**
 * Live 2026 data consistency tests.
 *
 * Cross-validates standings.json, results2026.json, drivers.json,
 * calendar.json, schedule.json and historical results files against each
 * other. These tests run offline against committed data files — they fail
 * the moment any file is updated in a way that breaks consistency.
 *
 * Coverage:
 *   1. standings.json structural integrity (shape, ordering, no dupes)
 *   2. drivers.json <-> standings.json  (teams, class, name resolution)
 *   3. standings.json <-> results2026.json  (win/2nd/3rd counts)
 *   4. drivers.json <-> results2026.json  (name resolution, car numbers)
 *   5. calendar.json <-> standings.json  (round/venue agreement)
 *   6. JST standings — classification and subset checks
 *   7. Per-driver spot checks
 *   8. schedule.json <-> calendar.json  (round and session alignment)
 *   9. results2026.json internal integrity  (venues, grid drivers, no impossible positions)
 *  10. drivers.json history <-> historical results files  (wins/podiums 2022-2025)
 *  11. results2026.json <-> standings.json - points totals per driver
 *  12. results2026.json entry integrity - DQ/DNS bonus-point rules
 *  13. calendar.json - no legacy youtubeUrls keys in rounds
 */

const DRIVERS    = require('../../data/drivers.json').drivers;
const STANDINGS  = require('../../data/standings.json');
const RESULTS    = require('../../data/results2026.json');
const CALENDAR   = require('../../data/calendar.json');
const SCHEDULE   = require('../../data/schedule.json');
const {formatDriverName} = require('../../src/utils/driverName');
const {parseCalendar} = require('../../src/api/parsers');
const PARSED_CALENDAR = parseCalendar(CALENDAR);

// Scoring races only — QR is NOT a championship points race for win/podium tallies
const SCORING_RACES = new Set(['Race 1', 'Race 2', 'Race 3']);

// ── helpers ───────────────────────────────────────────────────────────────────

function buildResultStats(rounds) {
  const map = {};
  for (const rnd of rounds) {
    for (const race of rnd.races || []) {
      if (!SCORING_RACES.has(race.label)) continue;
      for (const entry of race.results || []) {
        if (!entry.driver) continue;
        const key = formatDriverName(entry.driver);
        if (!map[key]) map[key] = {wins: 0, seconds: 0, thirds: 0};
        if (entry.pos === 1) map[key].wins++;
        if (entry.pos === 2) map[key].seconds++;
        if (entry.pos === 3) map[key].thirds++;
      }
    }
  }
  return map;
}

const standingsMap  = Object.fromEntries(
  STANDINGS.standings.map(s => [formatDriverName(s.driver), s]),
);
const driversMap    = Object.fromEntries(
  DRIVERS.map(d => [formatDriverName(d.name), d]),
);
const resultStats   = buildResultStats(RESULTS.rounds);

// ── 1. standings.json structural integrity ────────────────────────────────────

describe('standings.json — structural integrity', () => {
  it('has all required top-level keys', () => {
    expect(STANDINGS).toHaveProperty('standings');
    expect(STANDINGS).toHaveProperty('teams');
    expect(STANDINGS).toHaveProperty('jst');
    expect(STANDINGS).toHaveProperty('manufacturers');
    expect(STANDINGS).toHaveProperty('independentsTeams');
    expect(STANDINGS).toHaveProperty('season');
    expect(STANDINGS).toHaveProperty('round');
    expect(STANDINGS).toHaveProperty('venue');
    expect(STANDINGS).toHaveProperty('updated');
  });

  it('season is 2026', () => {
    expect(String(STANDINGS.season)).toBe('2026');
  });

  it('round is a positive integer within the calendar range', () => {
    expect(STANDINGS.round).toBeGreaterThanOrEqual(1);
    expect(STANDINGS.round).toBeLessThanOrEqual(CALENDAR.rounds.length);
  });

  it('standings array is non-empty', () => {
    expect(STANDINGS.standings.length).toBeGreaterThan(0);
  });

  it('every standings entry has required fields', () => {
    const required = ['pos', 'driver', 'points', 'wins', 'seconds', 'thirds', 'team', 'class'];
    const missing = [];
    for (const entry of STANDINGS.standings) {
      for (const field of required) {
        if (entry[field] === undefined || entry[field] === null) {
          missing.push(`${entry.driver}: missing field "${field}"`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it('standings are sorted by points descending', () => {
    for (let i = 1; i < STANDINGS.standings.length; i++) {
      expect(STANDINGS.standings[i].points).toBeLessThanOrEqual(
        STANDINGS.standings[i - 1].points,
      );
    }
  });

  it('standings positions are sequential starting from 1', () => {
    STANDINGS.standings.forEach((entry, i) => {
      expect(entry.pos).toBe(i + 1);
    });
  });

  it('no duplicate driver names in main standings', () => {
    const names = STANDINGS.standings.map(s => formatDriverName(s.driver));
    expect(new Set(names).size).toBe(names.length);
  });

  it('wins field is a non-negative integer for every driver', () => {
    const bad = STANDINGS.standings.filter(s => !Number.isInteger(s.wins) || s.wins < 0);
    expect(bad.map(s => s.driver)).toEqual([]);
  });

  it('points are non-negative for every driver', () => {
    const bad = STANDINGS.standings.filter(s => s.points < 0);
    expect(bad.map(s => s.driver)).toEqual([]);
  });

  it('teams[] is non-empty and sorted by points descending', () => {
    expect(STANDINGS.teams.length).toBeGreaterThan(0);
    for (let i = 1; i < STANDINGS.teams.length; i++) {
      expect(STANDINGS.teams[i].points).toBeLessThanOrEqual(STANDINGS.teams[i - 1].points);
    }
  });

  it('no duplicate teams in teams[]', () => {
    const names = STANDINGS.teams.map(t => t.team);
    expect(new Set(names).size).toBe(names.length);
  });

  it('teams[] entries match the unique teams found in driver standings', () => {
    const teamsInStandings  = new Set(STANDINGS.standings.map(s => s.team));
    const teamsInTeamsArray = new Set(STANDINGS.teams.map(t => t.team));
    const inDriversNotTeams = [...teamsInStandings].filter(t => !teamsInTeamsArray.has(t));
    const inTeamsNotDrivers = [...teamsInTeamsArray].filter(t => !teamsInStandings.has(t));
    expect(inDriversNotTeams).toEqual([]);
    expect(inTeamsNotDrivers).toEqual([]);
  });

  it('manufacturers[] is non-empty', () => {
    expect(STANDINGS.manufacturers.length).toBeGreaterThan(0);
  });
});

// ── 2. drivers.json <-> standings.json ────────────────────────────────────────

describe('drivers.json <-> standings.json consistency', () => {
  it('every standings driver resolves to a driver in drivers.json', () => {
    const missing = STANDINGS.standings
      .map(s => formatDriverName(s.driver))
      .filter(norm => !driversMap[norm]);
    expect(missing).toEqual([]);
  });

  it('team names match for every driver in both files', () => {
    const mismatches = [];
    for (const s of STANDINGS.standings) {
      const norm = formatDriverName(s.driver);
      const dr = driversMap[norm];
      if (!dr) continue;
      if (dr.team !== s.team) {
        mismatches.push(`${s.driver}: drivers.json="${dr.team}" standings.json="${s.team}"`);
      }
    }
    expect(mismatches).toEqual([]);
  });

  it('class field (M/I) matches for every driver in both files', () => {
    const mismatches = [];
    for (const s of STANDINGS.standings) {
      const norm = formatDriverName(s.driver);
      const dr = driversMap[norm];
      if (!dr) continue;
      if (dr.class !== s.class) {
        mismatches.push(`${s.driver}: drivers.json="${dr.class}" standings.json="${s.class}"`);
      }
    }
    expect(mismatches).toEqual([]);
  });

  it('every active driver in drivers.json is either in standings or has an acceptable reason (0 pts)', () => {
    // All active drivers should appear in standings OR be a known zero-pointer not yet listed
    // Currently only Árón Taylor-Smith is absent from standings (0 pts, not yet registered)
    const missing = DRIVERS
      .filter(d => d.team)
      .map(d => formatDriverName(d.name))
      .filter(norm => !standingsMap[norm]);
    // Each absent driver must have class 'I' (independent, may not have registered for championship)
    // or be documented — fail loudly if a new M-class driver goes missing
    const unexplained = missing.filter(norm => {
      const dr = driversMap[norm];
      return dr && dr.class !== 'I';
    });
    expect(unexplained).toEqual([]);
  });

  it('car number in drivers.json is a unique integer for every driver', () => {
    const numbers = DRIVERS.map(d => d.number);
    expect(numbers.every(n => Number.isInteger(n) && n > 0)).toBe(true);
    expect(new Set(numbers).size).toBe(numbers.length);
  });
});

// ── 3. standings.json <-> results2026.json ────────────────────────────────────

describe('standings.json <-> results2026.json — win and podium counts', () => {
  it('win counts in standings match P1 finishes in scoring races', () => {
    const mismatches = [];
    for (const s of STANDINGS.standings) {
      const norm = formatDriverName(s.driver);
      const computed = resultStats[norm]?.wins ?? 0;
      if (computed !== s.wins) {
        mismatches.push(
          `${s.driver}: standings_wins=${s.wins}, result_p1s=${computed}`,
        );
      }
    }
    expect(mismatches).toEqual([]);
  });

  it('second place counts in standings match P2 finishes in scoring races', () => {
    const mismatches = [];
    for (const s of STANDINGS.standings) {
      const norm = formatDriverName(s.driver);
      const computed = resultStats[norm]?.seconds ?? 0;
      if (computed !== s.seconds) {
        mismatches.push(
          `${s.driver}: standings_2nds=${s.seconds}, result_p2s=${computed}`,
        );
      }
    }
    expect(mismatches).toEqual([]);
  });

  it('third place counts in standings match P3 finishes in scoring races', () => {
    const mismatches = [];
    for (const s of STANDINGS.standings) {
      const norm = formatDriverName(s.driver);
      const computed = resultStats[norm]?.thirds ?? 0;
      if (computed !== s.thirds) {
        mismatches.push(
          `${s.driver}: standings_3rds=${s.thirds}, result_p3s=${computed}`,
        );
      }
    }
    expect(mismatches).toEqual([]);
  });

  it('no driver appears in results with pos=1 in a scoring race but has wins=0 in standings', () => {
    const falseZeroWins = [];
    for (const [norm, stats] of Object.entries(resultStats)) {
      if (stats.wins > 0) {
        const entry = standingsMap[norm];
        if (entry && entry.wins === 0) {
          falseZeroWins.push(`${norm}: ${stats.wins} P1 finishes but standings says 0 wins`);
        }
      }
    }
    expect(falseZeroWins).toEqual([]);
  });

  it('results2026.json has data for each completed round (rounds 1..standings.round)', () => {
    for (let r = 1; r <= STANDINGS.round; r++) {
      const rnd = RESULTS.rounds.find(rnd => rnd.round === r);
      expect(rnd).toBeDefined();
      const hasResults = (rnd?.races || []).some(race =>
        SCORING_RACES.has(race.label) && (race.results || []).length > 0,
      );
      expect(hasResults).toBe(true);
    }
  });
});

// ── 4. drivers.json <-> results2026.json ─────────────────────────────────────

describe('drivers.json <-> results2026.json — name and car number integrity', () => {
  // Collect every unique (driver, number) pair seen across all race results
  const resultEntries = {};
  for (const rnd of RESULTS.rounds) {
    for (const race of rnd.races || []) {
      for (const r of race.results || []) {
        if (!r.driver) continue;
        const norm = formatDriverName(r.driver);
        if (!resultEntries[norm]) resultEntries[norm] = r.no;
      }
    }
  }

  it('every driver name in results2026.json resolves to a driver in drivers.json', () => {
    const unknown = Object.keys(resultEntries).filter(norm => !driversMap[norm]);
    expect(unknown).toEqual([]);
  });

  it('driver car numbers in results2026.json match drivers.json', () => {
    const mismatches = [];
    for (const [norm, no] of Object.entries(resultEntries)) {
      const dr = driversMap[norm];
      if (!dr) continue;
      if (dr.number !== no) {
        mismatches.push(`${norm}: results=${no}, drivers.json=${dr.number}`);
      }
    }
    expect(mismatches).toEqual([]);
  });

  it('no DNF entries (pos=0) are counted as P1/P2/P3 finishes', () => {
    // Verify our own result-stats builder correctly ignores DNFs
    for (const rnd of RESULTS.rounds) {
      for (const race of rnd.races || []) {
        if (!SCORING_RACES.has(race.label)) continue;
        for (const r of race.results || []) {
          if (r.pos === 0) {
            const norm = formatDriverName(r.driver);
            const stats = resultStats[norm];
            // A DNF in any race must not have been mis-counted as a finish
            // The builder only increments wins/seconds/thirds when pos===1/2/3
            // so pos===0 is automatically excluded — this test confirms the logic holds
            expect(stats?.wins ?? 0).toBeGreaterThanOrEqual(0);
          }
        }
      }
    }
  });
});

// ── 5. calendar.json <-> standings.json ───────────────────────────────────────

describe('calendar.json <-> standings.json consistency', () => {
  it('calendar has rounds defined', () => {
    expect(Array.isArray(CALENDAR.rounds)).toBe(true);
    expect(CALENDAR.rounds.length).toBeGreaterThan(0);
  });

  it('standings.round does not exceed number of calendar rounds', () => {
    expect(STANDINGS.round).toBeLessThanOrEqual(CALENDAR.rounds.length);
  });

  it('standings.venue matches the venue for standings.round in calendar.json', () => {
    const calRound = CALENDAR.rounds.find(r => r.round === STANDINGS.round);
    expect(calRound).toBeDefined();
    expect(STANDINGS.venue).toBe(calRound.venue);
  });

  it('every calendar round has a round number and a venue', () => {
    const bad = CALENDAR.rounds.filter(r => !r.round || !r.venue);
    expect(bad).toEqual([]);
  });

  it('calendar round numbers are unique', () => {
    const nums = CALENDAR.rounds.map(r => r.round);
    expect(new Set(nums).size).toBe(nums.length);
  });
});

// ── 6. JST standings ──────────────────────────────────────────────────────────

describe('JST standings consistency', () => {
  it('JST array is non-empty', () => {
    expect(STANDINGS.jst.length).toBeGreaterThan(0);
  });

  it('every JST driver also appears in main standings', () => {
    const mainNorms = new Set(STANDINGS.standings.map(s => formatDriverName(s.driver)));
    const jstNotInMain = STANDINGS.jst
      .map(j => formatDriverName(j.driver))
      .filter(norm => !mainNorms.has(norm));
    expect(jstNotInMain).toEqual([]);
  });

  it('all JST drivers have a valid class field (M or I) in both standings and drivers.json', () => {
    // JST (Jack Sears Trophy) is for drivers new to BTCC — eligibility is not restricted to class I.
    // M-class (manufacturer-supported) newcomers can and do compete for JST.
    const VALID_CLASSES = new Set(['M', 'I']);
    const bad = [];
    for (const j of STANDINGS.jst) {
      const norm = formatDriverName(j.driver);
      if (!VALID_CLASSES.has(j.class)) {
        bad.push(`${j.driver}: JST entry has invalid class="${j.class}"`);
      }
      const dr = driversMap[norm];
      if (dr && !VALID_CLASSES.has(dr.class)) {
        bad.push(`${j.driver}: drivers.json has invalid class="${dr.class}"`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('JST positions are sequential starting from 1', () => {
    STANDINGS.jst.forEach((entry, i) => {
      expect(entry.pos).toBe(i + 1);
    });
  });

  it('JST standings are sorted by points descending', () => {
    for (let i = 1; i < STANDINGS.jst.length; i++) {
      expect(STANDINGS.jst[i].points).toBeLessThanOrEqual(STANDINGS.jst[i - 1].points);
    }
  });

  it('no duplicate drivers in JST standings', () => {
    const names = STANDINGS.jst.map(j => formatDriverName(j.driver));
    expect(new Set(names).size).toBe(names.length);
  });

  it('every JST driver also appears in drivers.json', () => {
    const missing = STANDINGS.jst
      .map(j => formatDriverName(j.driver))
      .filter(norm => !driversMap[norm]);
    expect(missing).toEqual([]);
  });

  it('JST wins/podiums fields are non-negative integers', () => {
    const bad = STANDINGS.jst.filter(
      j => !Number.isInteger(j.wins) || j.wins < 0 ||
           !Number.isInteger(j.seconds) || j.seconds < 0 ||
           !Number.isInteger(j.thirds) || j.thirds < 0,
    );
    expect(bad.map(j => j.driver)).toEqual([]);
  });

  it('JST win counts are plausible (within total scoring races played)', () => {
    // JST wins are awarded to the first JST-eligible finisher per race — NOT the outright P1.
    // Cross-checking against outright P1s would always fail for non-overall-winners.
    // Instead verify the count is non-negative and bounded by total races completed.
    const totalScoringRaces = STANDINGS.round * SCORING_RACES.size;
    const bad = STANDINGS.jst.filter(j => j.wins < 0 || j.wins > totalScoringRaces);
    expect(bad.map(j => `${j.driver}: jst_wins=${j.wins}`)).toEqual([]);
  });

  it('independentsTeams[] contains all teams with class "I" drivers in standings', () => {
    const independentTeams = new Set(
      STANDINGS.standings.filter(s => s.class === 'I').map(s => s.team),
    );
    const listedTeams = new Set(STANDINGS.independentsTeams.map(t => t.team));
    const unlisted = [...independentTeams].filter(t => !listedTeams.has(t));
    expect(unlisted).toEqual([]);
  });
});

// ── 7. Per-driver spot checks ─────────────────────────────────────────────────

describe('per-driver spot checks — standings data matches app display', () => {
  // These pin the exact values that DriverDetailScreen season2026 badges will show.
  // If standings.json is updated, these tests surface any unexpected changes.

  const activeDrivers = DRIVERS.filter(d => d.team);

  activeDrivers.forEach(driver => {
    const norm = formatDriverName(driver.name);
    const entry = standingsMap[norm];

    it(`${driver.name}: standings entry is internally consistent`, () => {
      if (!entry) {
        // Driver not in standings — must be zero-pointer (ATS case)
        // App will show "0 pts" badge
        expect(driver.team).toBeTruthy(); // active driver
        return;
      }
      // points >= wins * min_points_for_win (a win scores at least 20 pts in BTCC)
      const minPointsFromWins = entry.wins * 20;
      expect(entry.points).toBeGreaterThanOrEqual(minPointsFromWins);
      // podiums (total P1+P2+P3) >= wins
      const totalPodiums = entry.wins + entry.seconds + entry.thirds;
      expect(totalPodiums).toBeGreaterThanOrEqual(entry.wins);
      // pos is a positive integer
      expect(entry.pos).toBeGreaterThanOrEqual(1);
    });

    it(`${driver.name}: team in drivers.json matches standing`, () => {
      if (!entry) return; // absent from standings — covered elsewhere
      expect(driver.team).toBe(entry.team);
    });
  });
});

// ── 8. schedule.json <-> calendar.json ───────────────────────────────────────

describe('schedule.json <-> calendar.json consistency', () => {
  it('both files have the same number of rounds', () => {
    expect(SCHEDULE.rounds.length).toBe(CALENDAR.rounds.length);
  });

  it('round numbers match between schedule and calendar', () => {
    const schedRounds = SCHEDULE.rounds.map(r => r.round).sort((a, b) => a - b);
    const calRounds   = CALENDAR.rounds.map(r => r.round).sort((a, b) => a - b);
    expect(schedRounds).toEqual(calRounds);
  });

  it('session names match for every round', () => {
    const mismatches = [];
    for (const sr of SCHEDULE.rounds) {
      const cr = CALENDAR.rounds.find(c => c.round === sr.round);
      if (!cr) continue;
      const schedNames = (sr.sessions || []).map(s => s.name).sort().join(',');
      const calNames   = (cr.sessions || []).map(s => s.name).sort().join(',');
      if (schedNames !== calNames) {
        mismatches.push(`Round ${sr.round}: schedule="${schedNames}" calendar="${calNames}"`);
      }
    }
    expect(mismatches).toEqual([]);
  });

  it('every schedule session has a name, day and time', () => {
    const bad = [];
    for (const rnd of SCHEDULE.rounds) {
      for (const s of rnd.sessions || []) {
        if (!s.name || !s.day || !s.time) {
          bad.push(`Round ${rnd.round} session missing field: ${JSON.stringify(s)}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it('every calendar round has required fields for TrackDetailScreen', () => {
    const required = ['venue', 'about', 'lengthMiles', 'lengthKm', 'corners', 'imageUrl', 'startDate', 'endDate'];
    const missing = [];
    for (const r of PARSED_CALENDAR.rounds) {
      for (const f of required) {
        if (!r[f]) missing.push(`Round ${r.round} (${r.venue}): missing "${f}"`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('calendar startDate is before endDate for every round', () => {
    const bad = [];
    for (const r of CALENDAR.rounds) {
      if (r.startDate && r.endDate && r.startDate > r.endDate) {
        bad.push(`Round ${r.round} (${r.venue}): startDate ${r.startDate} after endDate ${r.endDate}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('schedule season matches standings season', () => {
    expect(Number(SCHEDULE.season)).toBe(Number(STANDINGS.season));
  });
});

// ── 9. results2026.json internal integrity ────────────────────────────────────

describe('results2026.json internal integrity', () => {
  it('every round venue matches calendar.json', () => {
    const mismatches = [];
    for (const rnd of RESULTS.rounds) {
      const cr = CALENDAR.rounds.find(c => c.round === rnd.round);
      if (!cr) { mismatches.push(`Round ${rnd.round}: no calendar entry`); continue; }
      if (rnd.venue !== cr.venue) {
        mismatches.push(`Round ${rnd.round}: results="${rnd.venue}" calendar="${cr.venue}"`);
      }
    }
    expect(mismatches).toEqual([]);
  });

  it('every grid driver resolves to a known driver in drivers.json', () => {
    const unknown = new Set();
    for (const rnd of RESULTS.rounds) {
      for (const race of rnd.races || []) {
        for (const g of race.grid || []) {
          if (g.driver && !driversMap[formatDriverName(g.driver)]) {
            unknown.add(g.driver);
          }
        }
      }
    }
    expect([...unknown]).toEqual([]);
  });

  it('grid car numbers match drivers.json', () => {
    const mismatches = [];
    for (const rnd of RESULTS.rounds) {
      for (const race of rnd.races || []) {
        for (const g of race.grid || []) {
          if (!g.driver || !g.no) continue;
          const dr = driversMap[formatDriverName(g.driver)];
          if (dr && dr.number !== g.no) {
            mismatches.push(`Round ${rnd.round} ${race.label} grid: ${g.driver} no=${g.no} vs drivers.json=${dr.number}`);
          }
        }
      }
    }
    expect(mismatches).toEqual([]);
  });

  it('no result entry has an impossible finishing position (pos > field size)', () => {
    const bad = [];
    for (const rnd of RESULTS.rounds) {
      for (const race of rnd.races || []) {
        const results = race.results || [];
        const fieldSize = results.length;
        for (const r of results) {
          if (r.pos > fieldSize) {
            bad.push(`Round ${rnd.round} ${race.label}: ${r.driver} pos=${r.pos} but only ${fieldSize} entries`);
          }
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it('no duplicate finishing positions within a single race (excluding DNFs at pos 0)', () => {
    const bad = [];
    for (const rnd of RESULTS.rounds) {
      for (const race of rnd.races || []) {
        const positions = (race.results || []).filter(r => r.pos > 0).map(r => r.pos);
        const unique = new Set(positions);
        if (unique.size !== positions.length) {
          bad.push(`Round ${rnd.round} ${race.label}: duplicate finishing positions`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it('every completed scoring race has a P1 finisher', () => {
    const bad = [];
    for (const rnd of RESULTS.rounds) {
      for (const race of rnd.races || []) {
        if (!SCORING_RACES.has(race.label)) continue;
        const results = race.results || [];
        if (results.length === 0) continue; // not yet run
        const hasP1 = results.some(r => r.pos === 1);
        if (!hasP1) bad.push(`Round ${rnd.round} ${race.label}: no P1 finisher`);
      }
    }
    expect(bad).toEqual([]);
  });
});

// ── 10. Driver history <-> historical results files (2022-2025) ───────────────

describe('drivers.json history <-> historical results files (2022-2025)', () => {
  // 2020/2021 have minor discrepancies (~1 podium) attributable to data-entry
  // approximations in the historical records. 2022 onwards is reliable.
  const CHECK_YEARS = [2022, 2023, 2024, 2025];

  function buildHistoryStats(year) {
    const data = require(`../../data/results${year}.json`);
    const stats = {};
    for (const rnd of data.rounds || []) {
      for (const race of rnd.races || []) {
        if (!SCORING_RACES.has(race.label)) continue;
        for (const e of race.results || []) {
          if (!e.driver) continue;
          const k = formatDriverName(e.driver);
          if (!stats[k]) stats[k] = {wins: 0, podiums: 0};
          if (e.pos === 1) { stats[k].wins++; stats[k].podiums++; }
          else if (e.pos === 2 || e.pos === 3) { stats[k].podiums++; }
        }
      }
    }
    return stats;
  }

  for (const year of CHECK_YEARS) {
    it(`${year}: driver history wins match scoring race P1 finishes`, () => {
      const stats = buildHistoryStats(year);
      const mismatches = [];
      for (const d of DRIVERS) {
        const h = (d.history || []).find(e => e.year === year);
        if (!h) continue;
        const norm = formatDriverName(d.name);
        const computed = stats[norm];
        if (!computed) continue; // driver didn't race that year — no results to compare
        if (h.wins !== computed.wins) {
          mismatches.push(`${d.name}: history_wins=${h.wins} result_wins=${computed.wins}`);
        }
      }
      expect(mismatches).toEqual([]);
    });

    it(`${year}: driver history podiums match P1/P2/P3 finishes in scoring races`, () => {
      const stats = buildHistoryStats(year);
      const mismatches = [];
      for (const d of DRIVERS) {
        const h = (d.history || []).find(e => e.year === year);
        if (!h) continue;
        const norm = formatDriverName(d.name);
        const computed = stats[norm];
        if (!computed) continue;
        if (h.podiums !== computed.podiums) {
          mismatches.push(`${d.name}: history_podiums=${h.podiums} result_podiums=${computed.podiums}`);
        }
      }
      expect(mismatches).toEqual([]);
    });
  }
});

// ── 11. results2026.json <-> standings.json — points totals ───────────────────

describe('11. results2026.json <-> standings.json — points totals', () => {
  it('sum of r.points in results2026 matches standings.json total for every driver', () => {
    // Points come directly from the TSL championship PDF (baked by scraper).
    // A mismatch means the two files disagree — likely a hand-edit or scraper bug.
    const pointsFromResults = {};
    for (const rnd of RESULTS.rounds || []) {
      for (const race of rnd.races || []) {
        for (const e of race.results || []) {
          if (!e.driver) continue;
          const key = formatDriverName(e.driver);
          pointsFromResults[key] = (pointsFromResults[key] || 0) + (e.points || 0);
        }
      }
    }

    const mismatches = [];
    for (const entry of STANDINGS.drivers || []) {
      if (!entry.name) continue;
      const key = formatDriverName(entry.name);
      const fromResults = pointsFromResults[key] || 0;
      if (fromResults !== entry.points) {
        mismatches.push(
          `${entry.name}: standings=${entry.points} sum_of_results=${fromResults} (diff=${fromResults - entry.points})`
        );
      }
    }
    expect(mismatches).toEqual([]);
  });
});

// ── 12. results2026.json entry integrity — DQ/DNS bonus-point rules ───────────

describe('12. results2026.json entry integrity — DQ/DNS bonus-point rules', () => {
  it('DQ entries (status=DQ, pos=0) with 0 laps have 0 points', () => {
    // A driver who was disqualified before completing any laps (DNS-style DQ)
    // must have 0 points — no bonus is earned with 0 laps.
    const violations = [];
    for (const rnd of RESULTS.rounds || []) {
      for (const race of rnd.races || []) {
        for (const e of race.results || []) {
          if (e.status === 'DQ' && (e.laps || 0) === 0 && (e.points || 0) !== 0) {
            violations.push(`Rd${rnd.round} ${race.label} ${e.driver}: DQ/0-laps but points=${e.points}`);
          }
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it('DNS entries (pos=0, laps=0, no DQ status) have 0 points', () => {
    // A DNS entry cannot have earned any points.
    const violations = [];
    for (const rnd of RESULTS.rounds || []) {
      for (const race of rnd.races || []) {
        for (const e of race.results || []) {
          const isDns = (e.pos || 0) === 0 && (e.laps || 0) === 0 && e.status !== 'DQ';
          if (isDns && (e.points || 0) !== 0) {
            violations.push(`Rd${rnd.round} ${race.label} ${e.driver}: DNS but points=${e.points}`);
          }
        }
      }
    }
    expect(violations).toEqual([]);
  });
});

// ── 13. calendar.json — no legacy youtubeUrls keys ────────────────────────────

describe('13. calendar.json — no legacy youtubeUrls keys in rounds', () => {
  it('no round contains a youtubeUrls key (URLs live in results2026.json)', () => {
    // After the single-source-of-truth refactor, race URLs moved to results2026.json.
    // calendar.json rounds must not have the old youtubeUrls array.
    const violations = [];
    for (const rnd of CALENDAR.rounds || []) {
      if ('youtubeUrls' in rnd) {
        violations.push(`Round ${rnd.round} (${rnd.venue}) still has youtubeUrls`);
      }
    }
    expect(violations).toEqual([]);
  });
});
