// Bundled season data with official standings (2004-2025).
// Each entry is a loader function so Metro defers module evaluation until
// the season is actually requested — avoids parsing 7MB of JSON at startup.
const seasons = {
  2004: () => require('./data/season_2004.json'),
  2005: () => require('./data/season_2005.json'),
  2006: () => require('./data/season_2006.json'),
  2007: () => require('./data/season_2007.json'),
  2008: () => require('./data/season_2008.json'),
  2009: () => require('./data/season_2009.json'),
  2010: () => require('./data/season_2010.json'),
  2011: () => require('./data/season_2011.json'),
  2012: () => require('./data/season_2012.json'),
  2013: () => require('./data/season_2013.json'),
  2014: () => require('./data/season_2014.json'),
  2015: () => require('./data/season_2015.json'),
  2016: () => require('./data/season_2016.json'),
  2017: () => require('./data/season_2017.json'),
  2018: () => require('./data/season_2018.json'),
  2019: () => require('./data/season_2019.json'),
  2020: () => require('./data/season_2020.json'),
  2021: () => require('./data/season_2021.json'),
  2022: () => require('./data/season_2022.json'),
  2023: () => require('./data/season_2023.json'),
  2024: () => require('./data/season_2024.json'),
  2025: () => require('./data/season_2025.json'),
};

// Cache so repeated calls to getSeasonData(year) don't re-evaluate the module
const cache = {};

export function getSeasonData(year) {
  if (cache[year] !== undefined) return cache[year];
  const loader = seasons[year];
  cache[year] = loader ? loader() : null;
  return cache[year];
}

// Computed once at module load — all data is bundled so this is synchronous.
const MIN_STARTS = 30;

// Official all-time records — auto-scraped from motorsportstats.com
// To refresh: run tools/scraper/scrape_records.py then copy data/records/records.json here
const MSS = require('./data/records.json');

// Lazy-computed driver records — iterates all season JSON files on first call.
// Kept lazy so importing this module at startup doesn't trigger parsing 7MB of JSON.
let _driverRecords = null;
export function getDriverRecords() {
  if (_driverRecords) return _driverRecords;
  const map = {};
  for (const loader of Object.values(seasons)) {
    const season = loader();
    for (const round of season.rounds || []) {
      for (const race of round.races || []) {
        for (const result of race.results || []) {
          const name = result.driver || result.name;
          if (!name) continue;
          if (!map[name]) map[name] = {wins: 0, podiums: 0, fastestLaps: 0, poles: 0, dnfs: 0, starts: 0, points: 0, seasonSet: new Set()};
          const s = map[name];
          s.starts++;
          s.points += result.points || 0;
          if (result.pos === 1) s.wins++;
          if (result.pos >= 1 && result.pos <= 3) s.podiums++;
          if (result.fl || result.fastestLap) s.fastestLaps++;
          if (result.p || result.pole) s.poles++;
          if (result.pos === 0) s.dnfs++;
          if (season.season) s.seasonSet.add(season.season);
        }
      }
    }
  }
  _driverRecords = Object.entries(map)
    .filter(([, s]) => s.starts >= MIN_STARTS)
    .map(([driver, s]) => ({
      driver,
      wins: s.wins,
      podiums: s.podiums,
      fastestLaps: s.fastestLaps,
      poles: s.poles,
      dnfs: s.dnfs,
      starts: s.starts,
      points: s.points,
      seasons: s.seasonSet.size,
      championships: MSS.championships[driver] || 0,
      winPct: s.wins / s.starts,
      podiumPct: s.podiums / s.starts,
      pointsPerStart: s.points / s.starts,
      dnfPct: s.dnfs / s.starts,
    }));
  return _driverRecords;
}

// All-time records — sourced from MSS (records.json), all drivers, no minimum starts
export const ALL_TIME_RECORDS = (() => {
  const tables = [
    MSS.wins, MSS.podiums, MSS.poles, MSS.fastestLaps,
    MSS.championships, MSS.starts, MSS.lapsLed, MSS.racesLed,
    MSS.hatTricks, MSS.winStreak, MSS.bestSeasonWins,
    MSS.podiumStreak, MSS.bestSeasonPodiums,
    MSS.poleStreak, MSS.bestSeasonPoles,
    MSS.consecutiveFinishes, MSS.consecutivePoints, MSS.dnfs,
  ];
  const allDrivers = new Set(tables.flatMap(t => Object.keys(t || {})));
  const get = (table, driver) => table?.[driver] || 0;
  return [...allDrivers].map(driver => ({
    driver,
    championships:      get(MSS.championships,      driver),
    starts:             get(MSS.starts,             driver),
    wins:               get(MSS.wins,               driver),
    podiums:            get(MSS.podiums,            driver),
    poles:              get(MSS.poles,              driver),
    fastestLaps:        get(MSS.fastestLaps,        driver),
    lapsLed:            get(MSS.lapsLed,            driver),
    racesLed:           get(MSS.racesLed,           driver),
    hatTricks:          get(MSS.hatTricks,          driver),
    winStreak:          get(MSS.winStreak,          driver),
    bestSeasonWins:     get(MSS.bestSeasonWins,     driver),
    podiumStreak:       get(MSS.podiumStreak,       driver),
    bestSeasonPodiums:  get(MSS.bestSeasonPodiums,  driver),
    poleStreak:         get(MSS.poleStreak,         driver),
    bestSeasonPoles:    get(MSS.bestSeasonPoles,    driver),
    consecutive:        get(MSS.consecutiveFinishes, driver),
    consecutivePoints:  get(MSS.consecutivePoints,  driver),
    dnfs:               get(MSS.dnfs,               driver),
  }));
})();

