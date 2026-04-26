/**
 * Season data integrity tests.
 *
 * Cross-validates that the standings data (Drivers tab) and race results
 * (Table tab) are internally consistent for every bundled season 2004–2025.
 *
 * Checks:
 *   - Win counts in standings === P1 finishes in race results
 *   - 2nd place counts in standings === P2 finishes in race results
 *   - 3rd place counts in standings === P3 finishes in race results
 *   - Points totals match within a known tolerance (bonus points FL/lead/pole
 *     may not be captured in old results data; DSQs cause post-race reductions)
 *
 * Known legitimate deviations are listed in KNOWN_POINTS_GAPS.
 */

const SEASONS = [
  2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013,
  2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023,
  2024, 2025,
];

// Races that score championship points
const RACE_LABELS = new Set(['Qualifying Race', 'Race 1', 'Race 2', 'Race 3']);

// Known legitimate gaps between standings points and results points:
//   Positive diff = standings > results (bonus points not in results JSON)
//   Negative diff = standings < results (DSQ/penalty applied post-race)
// Format: { year_driverNorm: allowedDiff }
const KNOWN_POINTS_GAPS = {
  // 2018: race results data under-counts bonus points (FL/lead/pole) for several drivers
  // Official standings figures are correct; results JSON is missing some bonus-point entries
  '2018_colin turkington': 10,   // 304 standings vs 294 results
  '2018_tom ingram': 15,         // 292 standings vs 277 results
  '2018_tom chilton': 11,        // 266 standings vs 255 results
  '2018_josh cook': 11,          // 246 standings vs 235 results
  '2018_daniel lloyd': 7,        // 87 standings vs 80 results
  '2018_bobby thompson': 6,      // 23 standings vs 17 results
  // 2023: Tom Chilton had post-race DSQ that reduced his official points below results total
  '2023_tom chilton': -5,        // 97 standings vs 102 results
  // 2024: Aiden Moffat had post-race penalty reducing official points below results total
  '2024_aiden moffat': -5,       // 138 standings vs 143 results
  // 2025 post-race penalties
  '2025_josh cook': -30,
  '2025_árón taylor-smith': -15,
  '2025_mikey doble': -5,
  // Small bonus-point rounding in older seasons — allow ±3
};
const POINTS_TOLERANCE = 3; // FL+lead+pole = max 3 bonus pts per race

function normName(s) {
  return (s || '').toLowerCase().trim().replace(/\s+/g, ' ');
}

// Build per-driver stats by summing across all scoring race results
function buildFromResults(rounds) {
  const map = {};
  for (const round of rounds) {
    for (const race of round.races || []) {
      if (!RACE_LABELS.has(race.label)) continue;
      for (const d of race.results || []) {
        if (!d.driver) continue;
        const key = normName(d.driver);
        if (!map[key]) map[key] = {points: 0, wins: 0, seconds: 0, thirds: 0};
        map[key].points += d.points || 0;
        if (d.pos === 1) map[key].wins++;
        if (d.pos === 2) map[key].seconds++;
        if (d.pos === 3) map[key].thirds++;
      }
    }
  }
  return map;
}

describe('Season data integrity', () => {
  for (const year of SEASONS) {
    describe(`${year} season`, () => {
      let season;
      let fromResults;

      beforeAll(() => {
        season = require(`../../src/assets/data/season_${year}.json`);
        fromResults = buildFromResults(season.rounds);
      });

      it('has standings and rounds data', () => {
        expect(season.drivers).toBeDefined();
        expect(season.drivers.length).toBeGreaterThan(0);
        expect(season.rounds).toBeDefined();
        expect(season.rounds.length).toBeGreaterThan(0);
      });

      it('win counts in standings match P1 finishes in race results', () => {
        const mismatches = [];
        for (const driver of season.drivers) {
          if (driver.wins === undefined) continue;
          const key = normName(driver.name);
          const computed = fromResults[key]?.wins ?? 0;
          if (computed !== driver.wins) {
            mismatches.push(
              `${driver.name}: standings_wins=${driver.wins}, result_p1s=${computed}`,
            );
          }
        }
        expect(mismatches).toEqual([]);
      });

      it('2nd place counts in standings match P2 finishes in race results', () => {
        const mismatches = [];
        for (const driver of season.drivers) {
          if (driver.seconds === undefined) continue;
          const key = normName(driver.name);
          const computed = fromResults[key]?.seconds ?? 0;
          if (computed !== driver.seconds) {
            mismatches.push(
              `${driver.name}: standings_2nds=${driver.seconds}, result_p2s=${computed}`,
            );
          }
        }
        expect(mismatches).toEqual([]);
      });

      it('3rd place counts in standings match P3 finishes in race results', () => {
        const mismatches = [];
        for (const driver of season.drivers) {
          if (driver.thirds === undefined) continue;
          const key = normName(driver.name);
          const computed = fromResults[key]?.thirds ?? 0;
          if (computed !== driver.thirds) {
            mismatches.push(
              `${driver.name}: standings_3rds=${driver.thirds}, result_p3s=${computed}`,
            );
          }
        }
        expect(mismatches).toEqual([]);
      });

      it('points totals are within tolerance (accounting for bonus pts and known DSQ gaps)', () => {
        const unexplained = [];
        for (const driver of season.drivers) {
          const key = normName(driver.name);
          const computed = fromResults[key]?.points ?? 0;
          const diff = driver.points - computed; // positive = standings higher
          const knownGap = KNOWN_POINTS_GAPS[`${year}_${key}`];

          if (knownGap !== undefined) {
            // Known deviation — must match exactly
            if (diff !== knownGap) {
              unexplained.push(
                `${driver.name}: expected known gap of ${knownGap} but got ${diff}`,
              );
            }
          } else if (Math.abs(diff) > POINTS_TOLERANCE) {
            // Unexplained gap — real data inconsistency
            unexplained.push(
              `${driver.name}: standings=${driver.points}, results=${computed} (diff ${diff}, exceeds tolerance ±${POINTS_TOLERANCE})`,
            );
          }
        }
        expect(unexplained).toEqual([]);
      });
    });
  }

  // Regression anchors — pin known correct values
  describe('spot checks', () => {
    it('2025: Tom Ingram — 462 points, 7 wins, 8 seconds, 3 thirds', () => {
      const season = require('../../src/assets/data/season_2025.json');
      const ingram = season.drivers.find(d => normName(d.name) === 'tom ingram');
      expect(ingram).toBeDefined();
      expect(ingram.points).toBe(462);
      expect(ingram.wins).toBe(7);
      expect(ingram.seconds).toBe(8);
      expect(ingram.thirds).toBe(3);
    });

    it('2025: Ashley Sutton — 428 points', () => {
      const season = require('../../src/assets/data/season_2025.json');
      const sutton = season.drivers.find(d => normName(d.name) === 'ashley sutton');
      expect(sutton).toBeDefined();
      expect(sutton.points).toBe(428);
    });

    it('2025: championship leader is Tom Ingram (first in standings array)', () => {
      const season = require('../../src/assets/data/season_2025.json');
      expect(normName(season.drivers[0].name)).toBe('tom ingram');
    });

    it('standings are sorted by points descending', () => {
      for (const year of SEASONS) {
        const season = require(`../../src/assets/data/season_${year}.json`);
        for (let i = 1; i < season.drivers.length; i++) {
          expect(season.drivers[i].points).toBeLessThanOrEqual(season.drivers[i - 1].points);
        }
      }
    });

    it('no driver appears twice in standings for any season', () => {
      for (const year of SEASONS) {
        const season = require(`../../src/assets/data/season_${year}.json`);
        const names = season.drivers.map(d => normName(d.name));
        const unique = new Set(names);
        expect(unique.size).toBe(names.length);
      }
    });
  });
});
